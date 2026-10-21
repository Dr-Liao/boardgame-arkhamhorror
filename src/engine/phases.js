// 阶段机（补给阶段 / 密谋揭示）从 engine.js 拆出的第五个模块（Phase 6 · 6d-5）。
//
// roadmap 的「按域拆分」里，阶段机是第三块：它把「一个阶段的固定流程」从引擎主循环里分出来，
// 主循环只剩「按序调用各阶段 + 处理关间/结局」。
// 依赖注入同 combat/actions；依赖清单由「engine 顶层声明 ∪ import 绑定 − 函数内局部」生成（先剥注释）。

export function createPhases(deps) {
  const {
    campaignState,
    ALL_CARDS,
    INVESTIGATOR_ABILITIES,
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
    enemyAttack,
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
    maskedHunterPrey,
    performTest,
    phaseBeginningWindow,
    placeDoomOnCard,
    placeLocation,
    playerWindow,
    randomValue,
    registeredEntry,
    removeOne,
    requestChoice,
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
    if (!assetsCannotReady(inv, state.round)) for (const a of inv.assets) a.exhausted = false
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
      info(state, events, `维持「绑定怪物」失败；「${enemy.name}」解除绑定并攻击 ${owner.name}。`)
      enemyAttack(state, enemy, owner, events, `「${enemy.name}」解除绑定后攻击。`, { kind: 'effect' })
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
      if (keep) inv.resources -= payment
      else { leaveAsset(state, inv, asset); inv.discard.push(asset.code) }
    }
    if (!scenarioBehavior(state).skipUpkeepIncome?.(state, inv)) {
      const texts = scenarioBehavior(state).skipUpkeepDraw?.(state, inv) ? [] : drawCards(state, inv, 1, events)
      for (const t of texts) info(state, events, t, { kind: 'automatic', phase: 'upkeep', round: state.round, text: t, effect: 'draw', seat: inv.seat, location: inv.location })
      const supply = !investigatorTextBlanked(state, inv) ? INVESTIGATOR_ABILITIES[inv.code]?.upkeepResources || 1 : 1
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
    const limit = getHandSize(state, inv)
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
  switch (r.type) {
    case 'campaignRule':
      if (!scenarioBehavior(state).agendaReveal) throw new Error(`密谋规则尚未迁移：${ag.originalCode}`)
      scenarioBehavior(state).agendaReveal(state, ag, scenarioRuntime(state, events))
      break
    case 'agenda1Reveal': {
      const lead = state.investigators[state.campaign.leadSeat] && !state.investigators[state.campaign.leadSeat].defeated
        && !state.investigators[state.campaign.leadSeat].resigned
        ? state.investigators[state.campaign.leadSeat] : state.investigators[firstAliveSeat(state)]
      if (!lead) break
      // Both options are always legal; with empty hands the discard branch simply
      // does nothing, so the lead investigator may still choose it.
      const options = [{ id: 'discard', label: '每位调查员随机弃掉 1 张手牌' },
        { id: 'horror', label: '队长受到 2 点恐惧' }]
      const answer = requestChoice(state, {
        kind: 'agenda', source: ag.id, seat: leadDecisionSeat(state),
        prompt: '到底发生了什么？！队长必须选择一项。', options,
      })
      if (answer === 'discard') {
        for (const inv of aliveInvestigators(state)) {
          if (!inv.hand.length) continue
          info(state, events, `🎲 ${inv.name} 随机弃掉 1 张手牌。`)
          discardRandomFromHand(state, inv, 1, events)
        }
      } else {
        info(state, events, `😱 ${lead.name} 作为队长受到 2 点恐惧（密谋 1 揭示）。`)
        applyHorror(state, lead, 2, events)
      }
      break
    }
    case 'agenda2Reveal': {
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const lead = state.investigators[state.campaign.leadSeat]
      const ghoul = discardUntilEnemyTrait(state, 'ghoul', events)
      if (ghoul && lead) {
        const enemy = spawnEnemy(state, ghoul, lead.location, lead.seat)
        if (enemy) info(state, events, `👹 密谋 2 揭示：「${enemy.name}」被引出，与 ${lead.name} 交战！`)
      } else {
        info(state, events, '密谋 2 揭示：遭遇牌库中没有食尸鬼敌人。')
      }
      break
    }
    case 'agenda3Reveal': {
      if (state.actIndex <= 1) {
        info(state, events, '☠️ 食尸鬼们破墙而出！调查队被团团包围，无处可逃……')
        defeatAll(state, events)
        finishScenario(state, 'r3', events)
      } else {
        // 01107 背面：若已推进到场景 3，未撤退的调查员被击败并各承受 1 点肉体创伤。
        for (const inv of aliveInvestigators(state)) {
          inv.defeated = true
          inv.defeatCause = 'damage'
          eliminateInvestigator(state, inv, events)
        }
        info(state, events, '🏃 你们在食尸鬼涌出前逃出了房子，但未撤退的调查员被击败。')
        finishScenario(state, 'noResolution', events)
      }
      break
    }
    case 'spawnMaskedHunter': {
      // 午夜假面密谋 1：生成假面猎手并与猎物交战。
      const target = maskedHunterPrey(state)
      const enemy = spawnEnemy(state, 'theMaskedHunter', target != null ? state.investigators[target].location : state.scenario.startLocation, target)
      if (enemy) info(state, events, `👹 「${enemy.name}」现身，与 ${target != null ? state.investigators[target].name : '无人'} 交战！`)
      break
    }
    case 'resolution2': {
      finishScenario(state, 'r2', events)
      break
    }
    case 'drawMonsterAtMainPath': {
      // 地底噬魔密谋 1：洗回弃牌，弃牌直到翻出怪物敌人，生成于主道路 + 1 毁灭。
      if (state.encounterDiscard.length) {
        state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
        state.encounterDiscard = []
      }
      const code = discardUntilEnemyTrait(state, 'monster', events)
      if (code) {
        const enemy = spawnEnemy(state, code, 'mainPath', null, true)
        if (enemy) {
          placeDoomOnCard(state, enemy, 1, events, { silent: true })
          info(state, events, `👹 「${enemy.name}」在「主道路」生成，并放置 1 点毁灭。`)
        }
      }
      break
    }
    case 'madnessTest': {
      // 地底噬魔密谋 2：每位调查员意志(6)检定，失败从基础弱点池加入一张疯狂弱点。
      const pool = basicWeaknessPool().filter(code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'madness'))
      if (!pool.length) throw new Error('疯狂弱点依赖缺失')
      for (const inv of aliveInvestigators(state)) {
        performTest(state, inv.seat, 'willpower', 6, { source: { label: '密谋结算', name: '疯狂侵蚀' }, resolve: r => {
          if (r.success) {
            info(state, events, `✔️ ${inv.name} 通过意志检定，未被疯狂侵蚀。`)
          } else {
            const code = pool[Math.floor(randomValue(state) * pool.length)]
            inv.hand.push(code)
            info(state, events, `❌ ${inv.name} 意志检定失败，获得疯狂弱点「${cardName(code)}」。`)
          }
        } })
      }
      break
    }
    case 'spawnUmordhoth': {
      // 地底噬魔密谋 3：放置仪式地（或在仪式地清理敌人），生成乌默尔多斯。
      if (locationExists(state, 'ritualSite')) {
        for (const e of state.enemies.filter((x) => x.location === 'ritualSite').slice()) {
          removeOne(state.enemies, e)
          if (e.engagedSeat != null) {
            const target = state.investigators[e.engagedSeat]
            if (target) removeOne(target.engaged, e.id)
          }
          if (isWeaknessCode(e.code)) state.investigators[e.bearerSeat].discard.push(e.code)
          else state.encounterDiscard.push(e.code)
          info(state, events, `♻️ 「${e.name}」因仪式地让位于乌默尔多斯而进入遭遇弃牌堆。`)
        }
      } else {
        placeLocation(state, 'ritualSite', events)
      }
      const boss = spawnEnemy(state, 'umordhoth', 'ritualSite', null)
      if (boss) info(state, events, `👹 古神「${boss.name}」降临于「仪式地」！`)
      // 3b replaces both decks. Its objective remains in play until the Ancient
      // One is defeated; the old ritual objective can no longer be completed.
      const final = { ...ag, name: '地底噬魔', stage: '3b', face: 'back', doomThreshold: null, reveal: null,
        text: '目标 — 如果乌默尔多斯被击败，推进至结局 2。' }
      state.agendas = [final]; state.agendaIndex = 0
      state.acts = [{ ...final, id: 'finalObjective', objective: { type: 'defeatEnemy', enemy: 'umordhoth' },
        reveal: { type: 'resolution2' } }]; state.actIndex = 0
      autoEngageAll(state, events)
      break
    }
    default:
      throw new Error(`未实现的密谋效果：${r.type}`)
  }
}

  return { upkeepPhase, runAgendaReveal }
}
