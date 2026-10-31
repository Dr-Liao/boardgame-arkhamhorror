// 回合与阶段推进（神话 / 敌人 / 轮末 / 回合开始与结束）从 engine.js 拆出的模块
// （Phase 6 · 6d-25）。
//
// `upkeepPhase` 与密谋揭示已在 phases.js；这里补齐另一半：
//   runMythos / enemyPhase / hunterStep —— 神话与敌人阶段（含猎人移动）
//   runLocationRoundEnd / runEnemyRoundEnd / runThreatEndTurn —— 轮末与威胁到期
//   phaseBeginningWindow / turnBeginningWindow / beginInvestigationPhase /
//   runBetweenInvestigationPhases — 阶段与回合的窗口
//   doEndTurn —— 结束回合
// 拆完后 engine.js 里的「状态机」只剩一个顶层循环（startScenario → 各阶段 → 结局）。

// 第 5 步 P6：法术专用额外行动的授权/清理只走 spell-actions 的算术（纯函数，无依赖）。
import { clearSpellCredit, grantSpellCredit } from './spell-actions.js'
// P6（食梦者）：受限额外行动（托尼·摩尔根的赏金行动）的授权与清理。
import {
  clearRestrictedAction, grantRestrictedAction, restrictedActionRule,
} from './restricted-actions.js'
import { enemyRuleFlags, investigatorRule } from '../cards/card-rules.js'
import { dreamGateEntryError, setDreamGatesAside } from './dream-gate.js'

export function createTurn(deps) {
  const {
    upkeepPhase,
    EFFECTS,
    PREY_RANK,
    aliveInvestigators,
    applyThreatForced,
    assetEffect,
    autoEngageAll,
    cardName,
    checkAct,
    checkAgenda,
    checkDefeated,
    checkOutcome,
    chooseAmong,
    chooseAttack,
    chooseTurn,
    disengageEnemy,
    distanceToInvestigator,
    drawEncounter,
    enemiesEngagedWith,
    enemyAttack,
    enemyDef,
    enemyTextBlanked,
    expireEffects,
    exploreOnlyActionBonus,
    extraActionBonus,
    getThreatEffect,
    info,
    // 第 5 步 P6：直觉牌库的揭示/洗回与资源寄存的回合结算。
    hunchDeck,
    investigatorTextBlanked,
    resourceBank,
    leadDecisionSeat,
    leaveAsset,
    locName,
    performTest,
    placeDoomOnCard,
    playerWindow,
    openAbilityWindow,
    reactionWindow,
    registeredEntry,
    relocateEnemy,
    removeOne,
    removeThreat,
    requestChoice,
    ruleIgnored,
    runAgendaForced,
    scenarioBehavior,
    scenarioRuntime,
    campaignBorrowedTimeTurnStart,
    triggerReaction,
    useGoldPocketWatch,
  } = deps

function runMythos(state, repeated = false) {
  const events = []
  // 上一轮的「本轮内」效果在这里到期；神话阶段自身的临时效果在敌人阶段开始时到期。
  for (const effect of expireEffects(state, 'endOfRound')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本轮结束）。`)
  }
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'mythos'
  state.phaseActionCount = 0
  if (!repeated) state.round += 1
  // 「轮末弃置」的支援（如柯尔特袖珍手枪）在新一轮开始时弃掉。
  if (!repeated) {
    for (const inv of state.investigators) {
      if (!inv || inv.defeated || inv.resigned) continue
      // Phase 6（6e-14）：轮末弃置从条目级字段读（旧 DSL 条目回落）。
      for (const asset of inv.assets.filter(item =>
        (registeredEntry(item.code)?.discardAtRoundEnd)).slice()) {
        leaveAsset(state, inv, asset, [])
        inv.discard.push(asset.code)
      }
    }
  }
  // 卡面「跳过神话阶段的『在当前密谋放置 1 个毁灭』步骤」（03121/03122/03123）。
  const currentAgenda = state.agendas[state.agendaIndex]
  const skipMythosDoom = registeredEntry(currentAgenda?.originalCode || currentAgenda?.code)?.skipMythosDoom === true
  if (skipMythosDoom) {
    info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：「${currentAgenda?.name || '当前密谋'}」跳过放置毁灭步骤（当前 ${state.doom}）。`,
      { kind: 'phase', phase: 'mythos', round: state.round, text: '跳过密谋毁灭 · 当前无变化', effect: 'doom', delta: 0 })
  } else {
    // 2026-10-25 第四轮修复 05285：神话阶段的「在当前密谋放置 1 点毁灭」也走统一替换钩子
    // （behavior.doomPlacementReplacement 可把这次放置替换成别的效果；05285 改为放裂口）。
    const replacedByBehavior = scenarioBehavior(state).doomPlacementReplacement?.(
      state, 1, scenarioRuntime(state, events)) === true
    if (replacedByBehavior) {
      info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：「在当前密谋放置 1 点毁灭」被剧本效果替换。`,
        { kind: 'phase', phase: 'mythos', round: state.round, text: '密谋毁灭被替换', effect: 'doom', delta: 0 })
    } else {
      state.doom += 1
      info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：密谋上放置 1 点毁灭（当前 ${state.doom}）。`,
        { kind: 'phase', phase: 'mythos', round: state.round, text: `密谋增加 1 点毁灭 · 当前 ${state.doom}`, effect: 'doom', delta: 1 })
      // 神话阶段的毁灭也是「放置毁灭」，剧本的强制要能看到（04282/04283）。
      scenarioBehavior(state).doomPlaced?.(state,
        { target: null, amount: 1, agenda: true }, scenarioRuntime(state, events))
    }
  }
  phaseBeginningWindow(state, events)
  checkAgenda(state, events)
  // 神话阶段「检查毁灭阈值」步骤结束后的剧本强制（04284 复仇等）。
  if (state.status === 'playing') scenarioBehavior(state).mythosDoomChecked?.(state, scenarioRuntime(state, events))
  if (state.status !== 'playing') return events
  for (const inv of aliveInvestigators(state)) {
    drawEncounter(state, inv, events)
  }
  playerWindow(state, 'mythos.afterEncounter', events)
  // 2026-10-25 第七轮修复 05021：神话阶段结束的 pay-or-discard 窗口。
  // 仅当真的有带 mythosEnd 能力的卡时才开窗（避免空窗口改变重放指纹）。
  for (const inv of aliveInvestigators(state)) {
    const hasMythosEnd = [...(inv.assets || []), ...(inv.threat || []), ...(inv.attachments || [])]
      .some(card => (registeredEntry(card.code)?.abilities || []).some(ability => ability.trigger === 'mythosEnd'))
    if (!hasMythosEnd) continue
    openAbilityWindow(state, 'mythosEnd', {
      when: 'mythosEnd', seat: inv.seat, location: inv.location,
      prompt: `${inv.name} 的神话阶段结束窗口`,
    }, events)
  }
  // 神话阶段结束强制：数据中的 mythosEndDoom。
  for (const enemy of state.enemies.slice()) {
    const doom = enemyTextBlanked(state, enemy) ? 0
      : (enemyDef(enemy.code)?.mythosEndDoom || enemyRuleFlags(enemy.code).mythosEndDoom || 0)
    if (doom > 0) {
      placeDoomOnCard(state, enemy, doom, events, { silent: true })
      info(state, events, `🌑 「${enemy.name}」上放置 ${doom} 点毁灭（当前 ${enemy.doom}）。`)
    }
  }
  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      if (!assetEffect(inv, asset)?.forcedMythosEndDiscard) continue
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      info(state, events, `🌑 「${cardName(asset.code)}」在神话阶段结束时被弃掉。`)
    }
  }
  scenarioBehavior(state).mythosEnded?.(state, scenarioRuntime(state, events))
  return events
}

function enemyPhase(state) {
  const events = []
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phase = 'enemy'
  state.fogMod = 0
  info(state, events, '⚔️ 敌人阶段……', { kind: 'phase', phase: 'enemy', round: state.round, text: '猎手移动 · 交战 · 敌人攻击' })
  phaseBeginningWindow(state, events)
  scenarioBehavior(state).enemyPhaseStart?.(state, scenarioRuntime(state, events))
  reactionWindow(state, 'enemyPhaseBegins', { when: 'enemyPhaseBegins', prompt: '敌人阶段开始' }, events)

  // 1) 猎手移动
  for (const enemy of state.enemies.slice()) {
    if (!enemy.hunter || enemyTextBlanked(state, enemy) || enemy.engagedSeat != null || enemy.exhausted || enemy.immobile) continue
    if (aliveInvestigators(state).some((inv) => inv.location === enemy.location && (enemy.prey !== 'bearer' || inv.seat === enemy.bearerSeat))) continue
    if (scenarioBehavior(state).hunterMove?.(state, enemy, scenarioRuntime(state, events))) continue
    const target = hunterStep(state, enemy)
    if (target && dreamGateEntryError(null, state.locations.find(location => location.id === target))) continue
    if (target && target !== enemy.location) {
      const prev = enemy.location
      relocateEnemy(state, enemy, target, events)
      info(state, events, `「${enemy.name}」从「${locName(state, prev)}」移动到「${locName(state, target)}」。`, {
        kind: 'automatic', phase: 'enemy', round: state.round, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code,
        name: enemy.name, text: `${enemy.name}：${locName(state, prev)} → ${locName(state, target)}`, effect: 'hunter', enemyId: enemy.id, from: prev, to: target, location: target })
    }
  }
  // 2026-10-25：新增「猎手移动后」剧本钩子（05067 等「在敌人经猎手关键词移动后」的强制时点）。
  scenarioBehavior(state).enemyPhaseAfterHunters?.(state, scenarioRuntime(state, events))
  autoEngageAll(state, events)
  playerWindow(state, 'enemy.afterHunters', events)

  // Resolve each investigator's attacks in their chosen order. Massive enemies
  // attack every eligible investigator before exhausting.
  const attacked = new Set()
  const seats = [...aliveInvestigators(state)].sort((a,b) =>
    (a.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators -
    (b.seat - state.campaign.leadSeat + state.numInvestigators) % state.numInvestigators)
  for (const inv of seats) {
    const pending = enemiesEngagedWith(state, inv)
      .filter(e => !e.exhausted && e.skipAttackRound !== state.round)
      .map(e => e.id)
    while (pending.length && !inv.defeated && !inv.resigned) {
      const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
      if (!candidates.length) break
      const enemy = chooseAttack(state, inv, candidates, 'enemyPhase')
      pending.splice(pending.indexOf(enemy.id), 1)
      if (inv.onTheLam && !enemy.elite) continue
      if (inv.infighting?.round === state.round && inv.infighting?.phase === 'enemy' && !enemy.elite) {
        info(state, events, `🥊 「内讧」取消了「${enemy.name}」对 ${inv.name} 的攻击。`)
        continue
      }
      const resolved = enemyAttack(state, enemy, inv, events)
      attacked.add(enemy.id)
      if (!enemy.massive) enemy.exhausted = true
      checkDefeated(state, inv.seat, events)
      if (state.status !== 'playing') return events
    }
  }
  for (const enemy of state.enemies) if (attacked.has(enemy.id)) enemy.exhausted = true
  playerWindow(state, 'enemy.afterAttacks', events)
  for (const attachment of (state.playerLocationAttachments || []).slice()) {
    const location = attachment.location
    const owner = state.investigators[attachment.ownerSeat]
    if (registeredEntry(attachment.code)?.grantsHidingSpot
      && state.enemies.some(enemy => enemy.location === location && !enemy.exhausted)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「藏身地点」在敌人阶段结束时被弃置。`)
    }
    if (registeredEntry(attachment.code)?.ambushAttachment
      && !aliveInvestigators(state).some(inv => inv.location === location)) {
      removeOne(state.playerLocationAttachments, attachment)
      owner?.discard.push(attachment.code)
      info(state, events, `「埋伏」的附属地点没有调查员，被弃置。`)
    }
  }

  // 3) 密谋 3 强制（集结：敌人阶段结束食尸鬼向客厅移动）
  runAgendaForced(state, 'enemyPhaseEnd', events)
  scenarioBehavior(state).enemyPhaseEnd?.(state, scenarioRuntime(state, events))
  return events
}

function hunterStep(state, enemy, options = {}) {
  const loc = state.locations.find((l) => l.id === enemy.location)
  const extraConnections = scenarioBehavior(state).enemyConnections?.(state, enemy, loc) || []
  const neighbours = [...new Set([...(loc ? loc.connections : []), ...extraConnections])].filter((id) => {
    const target = state.locations.find((l) => l.id === id)
    if (!target) return false
    if (target.barricade && !enemy.elite) return false
    return true
  })
  if (!neighbours.length) return null
  // 2026-10-25 第七轮修复 05323：地点附属的 locationLure 是真实诱饵（多诱饵取最近）。
  const lureAttachments = (state.playerLocationAttachments || [])
    .filter(attachment => registeredEntry(attachment.code)?.locationLure === true
      && (!(attachment.extra?.round ?? attachment.round) || (attachment.extra?.round ?? attachment.round) === state.round))
  const lureByAttachment = lureAttachments.length
    ? lureAttachments
      .map(attachment => ({ location: attachment.location,
        distance: distanceToInvestigator(state, enemy.location, [{ location: attachment.location }]) }))
      .sort((a, b) => a.distance - b.distance)[0]
    : null
  const lure = lureByAttachment ? { id: lureByAttachment.location }
    : state.locations.find(item => item.lure?.round === state.round)
  if (lure) {
    const target = [{ location: lure.id }]
    const distances = neighbours.map(id => distanceToInvestigator(state, id, target))
    const best = Math.min(...distances)
    const pool = neighbours.filter((_, index) => distances[index] === best)
    return chooseAmong(state, { kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
      prompt: `选择「${enemy.name}」向诱饵移动的路线。`, options: pool.map(id => ({ id, label: locName(state, id) })) })
  }
  let targets = options.targets || aliveInvestigators(state).filter(i => enemy.prey !== 'bearer' || i.seat === enemy.bearerSeat)
  // Phase 2（C1）：ignore:hunter —— 声明「敌人不把你当作猎手目标」的调查员不参与猎物计算。
  if (!options.targets) targets = targets.filter(i => !ruleIgnored(state, i, 'hunter'))
  if (!targets.length) return null
  const proximity = targets.map(i => distanceToInvestigator(state, enemy.location, [i]))
  const nearest = Math.min(...proximity)
  targets = targets.filter((_, index) => proximity[index] === nearest)
  // 2026-10-25 本循环修复 hunter-step-prey-tiebreak（05087/05100）：敌人身上的猎物标记
  // （preySeat）只在「与最近调查员并列」时用于裁决目标，否则仍朝最近的调查员移动。
  // 2026-10-25 交叉复核修复 05221：并列时先问剧本 preyRank（如「猎物 - 控制最多钥匙的调查员」），
  // 卡片自身的猎物定义优先于通用猎物标记。
  if (targets.length > 1 && !enemyTextBlanked(state, enemy)) {
    const ranked = scenarioBehavior(state).preyRank?.(state, enemy, targets)
    if (Array.isArray(ranked) && ranked.length && ranked.length < targets.length) targets = ranked
    else if (Number.isInteger(enemy.preySeat)) {
      const preferred = targets.find(inv => inv.seat === enemy.preySeat)
      if (preferred) targets = [preferred]
    }
  }
  const rank = PREY_RANK[enemy.prey]
  if (rank && targets.length) {
    const best = Math.min(...targets.map(i => rank(state, i)))
    targets = targets.filter(i => rank(state, i) === best)
  }
  const distances = neighbours.map((id) => distanceToInvestigator(state, id, targets))
  const best = Math.min(...distances)
  if (!Number.isFinite(best)) return null
  const pool = neighbours.filter((_, index) => distances[index] === best)
  return chooseAmong(state, {
    kind: 'hunter', source: { type: 'enemy', code: enemy.code }, seat: leadDecisionSeat(state),
    prompt: `选择「${enemy.name}」的移动路线（多条等距路线）。`,
    options: pool.map((id) => ({ id, label: locName(state, id) })),
  })
}

function runLocationRoundEnd(state, events) {
  // 2026-10-25 第七轮修复 05323：轮末弃掉声明 discardAtRoundEnd 的地点附属。
  for (const attachment of [...(state.playerLocationAttachments || [])]) {
    if (registeredEntry(attachment.code)?.discardAtRoundEnd !== true) continue
    const index = state.playerLocationAttachments.indexOf(attachment)
    if (index >= 0) state.playerLocationAttachments.splice(index, 1)
    const owner = state.investigators[attachment.ownerSeat]
    if (owner) owner.discard.push(attachment.code)
    info(state, events, `「${cardName(attachment.code)}」在轮末被弃掉。`)
  }
  for (const loc of state.locations) {
    if (loc.lure?.round === state.round) { state.investigators[loc.lure.seat]?.discard.push(loc.lure.code); delete loc.lure }
    // 地点自己的「回合结束」规则（01156 仪式地：线索补至每人 2 个；05141 祭品场所：补到 3×人数）。
    // 2026-10-25 修复：条目可以写函数 onRoundEnd；此前引擎只读 cluesPerInvestigator 字段，
    // 05141 这类「函数写在条目里」的规则永远不会执行。
    const roundEnd = registeredEntry(loc.originalCode || loc.code)?.locationRule?.onRoundEnd
    if (typeof roundEnd === 'function') {
      roundEnd(state, loc, scenarioRuntime(state, events))
    } else if (roundEnd?.cluesPerInvestigator) {
      const target = state.numInvestigators * roundEnd.cluesPerInvestigator
      if (loc.clues < target) {
        loc.clues = target
        info(state, events, `🔍 「${loc.name}」的线索补至 ${loc.clues}。`)
      }
    }
  }
}

function runEnemyRoundEnd(state, events) {
  // 敌人「回合结束时」的强制效果由各自的 forced 描述子结算（如坚韧的黑山羊幼崽治愈 2 点）。
  const seat = leadDecisionSeat(state)
  if (seat == null) return
  for (const enemy of state.enemies.slice()) {
    triggerReaction(state, seat, 'enemyRoundEnd', events, { enemy, seat })
  }
}

function runThreatEndTurn(state, inv, events, timing = 'turn') {
  for (const t of inv.threat.slice()) {
    const th = getThreatEffect(t)
    if (!th) continue
    if (th.endTurnTest && timing === 'turn') {
      performTest(state, inv.seat, th.endTurnTest.skill, th.endTurnTest.difficulty, { source: { label: '回合结束', name: cardName(t.code), code: t.code }, resolve: r => {
        if (r.success) {
          removeThreat(state, inv, t, events)
          info(state, events, `✔️ ${inv.name} 通过检定，弃掉了「${cardName(t.code)}」。`)
        } else {
          info(state, events, `❌ ${inv.name} 未通过「${cardName(t.code)}」的回合结束检定。`)
        }
      } })
    } else if (th.forced?.onTurnEnd && timing === 'turn') {
      applyThreatForced(state, inv, t, th.forced.onTurnEnd, events)
      if (inv.defeated || inv.resigned) return
    } else if (th.roundEndDiscard && timing === 'round') {
      removeThreat(state, inv, t, events)
      info(state, events, `♻️ 「${cardName(t.code)}」在回合末被弃掉。`)
    }
  }
}

function phaseBeginningWindow(state, events) {
  for (const enemy of state.enemies) if (enemy.massive && enemy.engagedSeat != null && !enemyTextBlanked(state, enemy)) disengageEnemy(state, enemy)
  // 剧本可以在每个阶段开始时结算持续/强制效果（04256 的「调查阶段开始」等）。
  scenarioBehavior(state).phaseBegan?.(state, state.phase, scenarioRuntime(state, events))
  for (const inv of aliveInvestigators(state)) triggerReaction(state, inv.seat, 'phaseBegins', events, {})
  reactionWindow(state, 'phaseBegins', { when: 'phaseBegins', prompt: '阶段开始' }, events)
}

function turnBeginningWindow(state, events) {
  const inv = state.investigators[state.currentSeat]
  state.turnSerial = (state.turnSerial || 0) + 1
  if (inv) {
    inv.turnEnded = false
    inv.actionsTakenThisTurn = 0
    // 第 5 步 P6：回合开始时清理上一回合的「法术专用额外行动」授权，再按当前毁灭标记重新授权，
    // 资源寄存支援的「放置 4 资源」也在这里结算（都是「在你的回合开始时」）。
    clearSpellCredit(inv)
    resourceBank.beginTurn(state, inv, events)
    grantSpellCredit(state, inv, {
      blanked: investigatorTextBlanked(state, inv),
      info: text => info(state, events, text),
    })
    // P6（食梦者 · 托尼·摩尔根）：回合开始时授予「只能用于交战/攻击带赏金敌人」的额外行动。
    const restrictedRule = restrictedActionRule(inv.code, investigatorRule)
    if (restrictedRule && !investigatorTextBlanked(state, inv)) {
      clearRestrictedAction(inv, restrictedRule.kind)
      grantRestrictedAction(state, inv, restrictedRule.kind)
      info(state, events, `${inv.name} 获得 1 个${restrictedRule.kind === 'bounty' ? '只能用于交战或攻击带赏金敌人' : '受限'}的额外行动。`)
    }
    scenarioBehavior(state).turnBegins?.(state, inv, scenarioRuntime(state, events))
    // 「时间借取」：回合开始时移除所有滴答，换取等量额外行动。
    campaignBorrowedTimeTurnStart(state, inv, events)
    triggerReaction(state, inv.seat, 'turnBegins', events, { seat: inv.seat, location: inv.location })
    reactionWindow(state, 'turnBegins', { when: 'turnBegins', seat: inv.seat, location: inv.location, prompt: `${inv.name} 的回合开始` }, events)
    // 「未知的呼唤」：回合开始时选择本回合要调查的地点。
    for (const threat of inv.threat.filter(item => getThreatEffect(item)?.turnForced === 'callOfTheUnknown')) {
      const options = state.locations.filter(loc => loc.id !== inv.location)
        .map(loc => ({ id: loc.id, label: loc.name }))
      if (!options.length) continue
      threat.callTarget = requestChoice(state, { kind: 'location', source: threat.code, seat: inv.seat,
        prompt: '「未知的呼唤」：选择本回合必须成功调查的地点。', options })
      info(state, events, `「${cardName(threat.code)}」：${inv.name} 本回合必须成功调查「${locName(state, threat.callTarget)}」。`)
    }
  }
}

function beginInvestigationPhase(state, events, repeated = false) {
  for (const effect of expireEffects(state, 'endOfPhase')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（阶段结束）。`)
  }
  state.phaseActionCount = 0
  state.turnsTaken = []
  for (const inv of aliveInvestigators(state)) {
    const loss = inv.pendingActionLoss?.[state.round] || 0
    inv.actionsLeft = Math.max(0, 3 + extraActionBonus(inv) - loss)
    inv.exploreOnlyActions = Math.max(0, exploreOnlyActionBonus(inv) - loss)
    // 第 5 步 P6：「下个回合期间可以额外行动一次」（序章故事调查员的旧印）。
    if (inv.extraActionNextTurn) {
      inv.actionsLeft += 1
      delete inv.extraActionNextTurn
    }
    clearSpellCredit(inv)
    // P6（食梦者）：上一轮的受限额外行动额度一并清掉（回合开始会重新授予）。
    const rule = investigatorRule(inv.code)?.restrictedAction
    if (rule?.kind) clearRestrictedAction(inv, rule.kind)
    if (inv.pendingActionLoss) delete inv.pendingActionLoss[state.round]
  }
  // Phase 1（A1）：阶段级临时修正改由 state.effects 承载，上面的 expireEffects 已经清掉，
  // 这里保留旧的 phaseStatBonus 兼容清理（外部存档/测试可能仍有该字段）。
  for (const inv of aliveInvestigators(state)) inv.phaseStatBonus = null
  state.phase = 'investigation'
  phaseBeginningWindow(state, events)
  // 第 5 步 P6：「强制 - 在调查阶段开始时：揭示你直觉牌库顶 1 张卡牌」。
  for (const inv of aliveInvestigators(state)) hunchDeck.reveal(state, inv, events)
  const first = chooseTurn(state)
  if (first == null) { checkOutcome(state, events); return }
  state.currentSeat = first
  info(state, events, `${repeated ? '黄金怀表重复调查阶段；' : ''}第 ${state.round} 回合 · 调查阶段开始，轮到 ${state.investigators[first].name}。`,
    { kind: 'phase', phase: 'investigation', round: state.round, text: `轮到 ${state.investigators[first].name} 行动` })
  turnBeginningWindow(state, events)
}

function runBetweenInvestigationPhases(state, events) {
  // 第 5 步 P6：调查阶段结束——直觉牌库顶那张没打出的牌洗回直觉牌库。
  for (const inv of aliveInvestigators(state)) hunchDeck.returnCard(state, inv, events)
  setDreamGatesAside(state, {
    choose: (inv, ids) => requestChoice(state, {
      kind: 'location', source: 'dream-gate', seat: inv.seat, prompt: '梦境之门被放在一边。选择一个已揭示地点。',
      options: ids.map(id => ({ id, label: locName(state, id) })),
    }),
    applyHorror: (game, inv, amount) => { inv.horror = (inv.horror || 0) + amount },
    info: text => info(state, events, text),
  })
  if (!useGoldPocketWatch(state, 'begin', 'enemy', events)) {
    events.push(...enemyPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'enemy', events)) events.push(...enemyPhase(state))
  }
  if (state.status !== 'playing') return
  if (!useGoldPocketWatch(state, 'begin', 'upkeep', events)) {
    events.push(...upkeepPhase(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'upkeep', events)) events.push(...upkeepPhase(state))
  }
  if (state.status !== 'playing') return
  state._roundEndWindow = true
  try { checkAct(state, events) } finally { delete state._roundEndWindow }
  if (state.status !== 'playing') return
  if (useGoldPocketWatch(state, 'begin', 'mythos', events)) {
    state.phase = 'mythos'; state.round += 1
  } else {
    events.push(...runMythos(state))
    if (state.status !== 'playing') return
    if (useGoldPocketWatch(state, 'end', 'mythos', events)) events.push(...runMythos(state, true))
  }
}

function doEndTurn(state, seat, events) {
  const inv = state.investigators[seat]
  for (const asset of inv.assets.filter(item => item.sleightOfHand?.round === state.round
    && item.sleightOfHand.turnSeat === state.currentSeat).slice()) {
    leaveAsset(state, inv, asset, events)
    inv.hand.push(asset.code)
  }
  inv.actionsLeft = 0
  delete inv.lolaDiscount
  info(state, events, `${inv.name} 结束了本回合的行动。`)
}

// ---------------------------------------------------------------------------
// 合法行动 / 校验
// ---------------------------------------------------------------------------

  return { runMythos, enemyPhase, hunterStep, runLocationRoundEnd, runEnemyRoundEnd, runThreatEndTurn, phaseBeginningWindow, turnBeginningWindow, beginInvestigationPhase, runBetweenInvestigationPhases, doEndTurn }
}
