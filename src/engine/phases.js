import { investigatorRule } from '../cards/card-rules.js'
// 阶段机（补给阶段 / 密谋揭示）从 engine.js 拆出的第五个模块（Phase 6 · 6d-5）。
//
// roadmap 的「按域拆分」里，阶段机是第三块：它把「一个阶段的固定流程」从引擎主循环里分出来，
// 主循环只剩「按序调用各阶段 + 处理关间/结局」。
// 依赖注入同 combat/actions；依赖清单由「engine 顶层声明 ∪ import 绑定 − 函数内局部」生成（先剥注释）。

export function createPhases(deps) {
  const {
    campaignState,
    ALL_CARDS,
    aliveInvestigators,
    applyHorror,
    assetEffect,
    assetsCannotReady,
    autoEngageAll,
    basicWeaknessPool,
    cardName,
    defeatAll,
    defeatEnemy,
    discardHandTo,
    discardRandomFromHand,
    discardUntilEnemyTrait,
    drawCards,
    eliminateInvestigator,
    expireEffects,
    exploreOnlyActionBonus,
    extraActionBonus,
    finishScenario,
    firstAliveSeat,
    getHandSize,
    getThreatEffect,
    info,
    investigatorTextBlanked,
    isWeaknessCode,
    leadDecisionSeat,
    leaveAsset,
    locationExists,
    performTest,
    phaseBeginningWindow,
    placeDoomOnCard,
    placeLocation,
    playerWindow,
    randomValue,
    registeredEntry,
    removeOne,
    requestChoice,
    resourceBank,
    runAgendaForced,
    runEnemyRoundEnd,
    runLocationRoundEnd,
    runThreatEndTurn,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    spawnEnemy,
    campaignDiscardOnYourOwn,
  } = deps

function upkeepPhase(state) {
  const events = []
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'upkeep'
  info(state, events, '🔧 重整阶段……', { kind: 'phase', phase: 'upkeep', round: state.round, text: '重整卡牌 · 抽牌 · 获得资源' })
  phaseBeginningWindow(state, events)

  for (const inv of aliveInvestigators(state)) {
    inv.actionsLeft = 3 + extraActionBonus(inv)
    inv.exploreOnlyActions = exploreOnlyActionBonus(inv)
    inv.tomeActionUsed = false
    // 兼容清理：旧存档可能残留 phaseStatBonus(s)；新逻辑写 state.effects。
    inv.phaseStatBonus = null
    inv.phaseStatBonuses = []
    inv.fearExtraPaid = false
    if (!assetsCannotReady(inv, state.round)) {
      for (const a of inv.assets) a.exhausted = false
      // 2026-10-25 修复：威胁区的卡（如 05019 安息日男爵这类「[fast] 横置」资产）也应在
      // 重整阶段复位；旧实现只重置 inv.assets，导致威胁区卡的 exhaustion 永久保留、能力只能用一次。
      for (const threat of inv.threat) threat.exhausted = false
    }
    if (campaignState.cannotReadyRound(inv) === state.round) campaignState.clearCannotReadyRound(inv)
    for (const threat of inv.threat) if (getThreatEffect(threat)?.debt) threat.debtPaymentsThisRound = 0
  }
  for (const enemy of state.enemies) if (!enemy.bindMonster) {
    if (enemy.snareTrap) {
      state.investigators[enemy.snareTrap.ownerSeat]?.discard.push(enemy.snareTrap.code)
      delete enemy.snareTrap
    } else if (enemy.preventReady && enemy.preventReady.from + enemy.preventReady.rounds > state.round) {
      // 「悄然遁去」等：下个补给阶段不重整。
      continue
    } else if (enemy.attachments?.some(entry => registeredEntry(entry.code)?.restrainsReady) && !enemy.elite) {
      // 「手铐」：附属的非精英敌人不能重整。
      continue
    } else enemy.exhausted = false
  }
  for (const enemy of state.enemies.slice().filter(enemy => enemy.bindMonster)) {
    const owner = state.investigators[enemy.bindMonster.ownerSeat]
    if (!owner || owner.defeated || owner.resigned) {
      if (owner) owner.discard.push(enemy.bindMonster.code)
      delete enemy.bindMonster
      enemy.exhausted = false
      continue
    }
    // Phase 5（5a-25）：检定的来源卡号用「实际绑定的那张牌」，不写死 02031。
    performTest(state, owner.seat, 'willpower', 3, { source: { label: '维持绑定', name: enemy.name, code: enemy.bindMonster.code }, resolve: result => {
      if (result.success || !enemy.bindMonster) return
      owner.discard.push(enemy.bindMonster.code)
      delete enemy.bindMonster
      enemy.exhausted = false
      info(state, events, `维持「绑定怪物」失败；「${enemy.name}」解除绑定并重整。`)
    } })
  }
  autoEngageAll(state, events)

  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      const payment = assetEffect(inv, asset)?.forcedUpkeepPayOrDiscard
      if (!payment) continue
      const keep = inv.resources >= payment && requestChoice(state, { kind: 'upkeep', source: asset.id, seat: inv.seat,
        prompt: `是否支付 ${payment} 资源保留「${cardName(asset.code)}」？`,
        options: [{ id: 'pay', label: '支付资源' }, { id: 'discard', label: '弃置支援' }] }) === 'pay'
      if (keep) resourceBank.spendFromPool(inv, payment)
      else { leaveAsset(state, inv, asset); inv.discard.push(asset.code) }
    }
    if (!scenarioBehavior(state).skipUpkeepIncome?.(state, inv)) {
      // P6（食梦者 · 派翠丝·海瑟薇）：补给阶段的抽牌可以整段替换——
      //   `investigatorRule(code).upkeepDraw = { discardNonWeakness: true, handSize: 5 }`
      // 对应卡面「不抽取 1 张卡牌，改为弃掉手牌中的全部非弱点卡牌，抽到你有 5 张手牌」。
      const upkeepDraw = investigatorRule(inv.code)?.upkeepDraw
      let drawTexts = []
      if (upkeepDraw && !investigatorTextBlanked(state, inv)) {
        const keep = (inv.hand || []).filter(code => isWeaknessCode(code))
        const discarded = (inv.hand || []).filter(code => !isWeaknessCode(code))
        inv.hand = keep
        if (discarded.length) {
          inv.discard.push(...discarded)
          info(state, events, `${inv.name} 弃掉手牌中的 ${discarded.length} 张非弱点卡牌（补给阶段替换抽牌）。`)
        }
        const target = Math.max(0, Number(upkeepDraw.handSize) || 0)
        drawTexts = drawCards(state, inv, Math.max(0, target - (inv.hand || []).length), events)
      } else if (scenarioBehavior(state).skipUpkeepDraw?.(state, inv)) {
        drawTexts = []
      } else {
        drawTexts = drawCards(state, inv, 1, events)
      }
      const texts = drawTexts
      for (const t of texts) info(state, events, t, { kind: 'automatic', phase: 'upkeep', round: state.round, text: t, effect: 'draw', seat: inv.seat, location: inv.location })
      const supply = !investigatorTextBlanked(state, inv) ? investigatorRule(inv.code)?.upkeepResources || 1 : 1
      const darkHorseAsset = inv.assets.find(asset => assetEffect(inv, asset)?.passive?.darkHorse)
      const skipIncome = Boolean(darkHorseAsset) && requestChoice(state, { kind: 'upkeep', source: darkHorseAsset.code, seat: inv.seat,
        prompt: '黑马：本回合是否放弃获得资源？',
        options: [{ id: 'gain', label: `获得 ${supply} 资源` }, { id: 'skip', label: '不获得资源（保持 0 资源）' }] }) === 'skip'
      if (!skipIncome && scenarioBehavior(state).canGainResources?.(state, inv) !== false) {
        inv.resources += supply
        const supplyText = `${inv.name} 获得 ${supply} 资源（当前 ${inv.resources}）。`
        info(state, events, supplyText, { kind: 'automatic', phase: 'upkeep', round: state.round, text: supplyText, effect: 'resource', delta: supply, seat: inv.seat, location: inv.location })
      }
    }
    const limit = Math.max(0, getHandSize(state, inv)
      - (scenarioBehavior(state).handSizePenalty?.(state, inv) || 0))
    discardHandTo(state, inv, limit, events)
    runThreatEndTurn(state, inv, events, 'round')
    for (const asset of inv.assets.slice()) {
      const eff = assetEffect(inv, asset)
      if (asset.temporaryAllyRound === state.round || eff?.forcedRoundEndDiscard) {
        leaveAsset(state, inv, asset); inv.discard.push(asset.code)
      }
      // 「英勇无畏」：由技能牌转化而来的支援在轮末弃掉。
      const roundEndDiscard = campaignState.roundEndDiscardRound(asset)
    if (roundEndDiscard != null && roundEndDiscard <= state.round) {
        leaveAsset(state, inv, asset); inv.discard.push(asset.code)
        info(state, events, `「${cardName(asset.code)}」在轮末被弃掉。`)
      }
    }
    // 「自食其力」：控制占用盟友槽位的支援时强制弃掉。
    campaignDiscardOnYourOwn(state, inv, events)
  }

  playerWindow(state, 'upkeep.end', events)
  // 地底噬魔：仪式地回合结束补线索；坚韧的黑山羊幼崽治愈 2。
  runLocationRoundEnd(state, events)
  runEnemyRoundEnd(state, events)
  scenarioBehavior(state).roundEnded?.(state, scenarioRuntime(state, events))

  runAgendaForced(state, 'roundEnd', events)
  for (const inv of state.investigators) { inv.onTheLam = false; inv.skillSubstitute = null }
  return events
}

function runAgendaReveal(state, ag, events) {
  const r = ag.reveal
  if (!r) return
  const scId = state.scenario.id
  // 第 5 批：关卡行为能按 reveal.type 接管的，先交给行为（集结的密谋 1–3）。
  if (r.type !== 'campaignRule'
    && scenarioBehavior(state).agendaReveal?.(state, ag, scenarioRuntime(state, events), r.type)) return
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).agendaReveal) throw new Error(`密谋规则尚未迁移：${ag.originalCode}`)
      scenarioBehavior(state).agendaReveal(state, ag, scenarioRuntime(state, events))
      break
    default:
      throw new Error(`未实现的密谋效果：${r.type}`)
  }
}

  return { upkeepPhase, runAgendaReveal }
}
