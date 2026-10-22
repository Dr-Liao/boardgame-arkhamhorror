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
    leadDecisionSeat,
    leaveAsset,
    locName,
    performTest,
    placeDoomOnCard,
    playerWindow,
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
    state.doom += 1
    info(state, events, `🌑 神话阶段（第 ${state.round} 回合）：密谋上放置 1 点毁灭（当前 ${state.doom}）。`,
      { kind: 'phase', phase: 'mythos', round: state.round, text: `密谋增加 1 点毁灭 · 当前 ${state.doom}`, effect: 'doom', delta: 1 })
    // 神话阶段的毁灭也是「放置毁灭」，剧本的强制要能看到（04282/04283）。
    scenarioBehavior(state).doomPlaced?.(state,
      { target: null, amount: 1, agenda: true }, scenarioRuntime(state, events))
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
  // 神话阶段结束强制：数据中的 mythosEndDoom。
  for (const enemy of state.enemies.slice()) {
    const doom = enemyTextBlanked(state, enemy) ? 0 : enemyDef(enemy.code)?.mythosEndDoom || 0
    if (doom > 0) {
      placeDoomOnCard(state, enemy, doom, events, { silent: true })
      info(state, events, `🌑 「${enemy.name}」上放置 ${doom} 点毁灭（当前 ${enemy.doom}）。`)
    }
  }
  for (const inv of aliveInvestigators(state)) {
    for (const asset of inv.assets.slice()) {
      if (!assetEffect(inv, asset)?.forcedMythosEndDiscard) continue
      leaveAsset(state, inv, asset)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
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
    if (target && target !== enemy.location) {
      const prev = enemy.location
      relocateEnemy(state, enemy, target, events)
      info(state, events, `「${enemy.name}」从「${locName(state, prev)}」移动到「${locName(state, target)}」。`, {
        kind: 'automatic', phase: 'enemy', round: state.round, code: enemy.originalCode || enemyDef(enemy.code)?.originalCode || enemy.code,
        name: enemy.name, text: `${enemy.name}：${locName(state, prev)} → ${locName(state, target)}`, effect: 'hunter', enemyId: enemy.id, from: prev, to: target, location: target })
    }
  }
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
  const lure = state.locations.find(item => item.lure?.round === state.round)
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
  for (const loc of state.locations) {
    if (loc.lure?.round === state.round) { state.investigators[loc.lure.seat]?.discard.push(loc.lure.code); delete loc.lure }
    // 地点自己的「回合结束」规则（01156 仪式地：线索补至每人 2 个）。
    const roundEnd = registeredEntry(loc.originalCode || loc.code)?.locationRule?.onRoundEnd
    if (roundEnd?.cluesPerInvestigator) {
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
    if (inv.pendingActionLoss) delete inv.pendingActionLoss[state.round]
  }
  // Phase 1（A1）：阶段级临时修正改由 state.effects 承载，上面的 expireEffects 已经清掉，
  // 这里保留旧的 phaseStatBonus 兼容清理（外部存档/测试可能仍有该字段）。
  for (const inv of aliveInvestigators(state)) inv.phaseStatBonus = null
  state.phase = 'investigation'
  phaseBeginningWindow(state, events)
  const first = chooseTurn(state)
  if (first == null) { checkOutcome(state, events); return }
  state.currentSeat = first
  info(state, events, `${repeated ? '黄金怀表重复调查阶段；' : ''}第 ${state.round} 回合 · 调查阶段开始，轮到 ${state.investigators[first].name}。`,
    { kind: 'phase', phase: 'investigation', round: state.round, text: `轮到 ${state.investigators[first].name} 行动` })
  turnBeginningWindow(state, events)
}

function runBetweenInvestigationPhases(state, events) {
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
