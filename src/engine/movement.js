// 移动与位置（调查员移动 / 敌人移动 / 距离）从 engine.js 拆出的模块（Phase 6 · 6d-21）。
//
// 这一组是「谁在哪里、怎么过去」：连接图 BFS、可去地点枚举、移动执行（含进入地点的代价与
// 借机攻击）、把调查员/敌人挪走。它们被 do*（攻击/躲避/调查）与剧本运行时同时使用。
//
// 依赖注入同前；performTest / scenarioRuntime / triggerReaction 已迁出，作为函数声明引用即可。

export function createMovement(deps) {
  const {
    advanceAct,
    aliveInvestigators,
    applyDamage,
    applyHorror,
    applyPenalty,
    autoEngageAt,
    counterTreacheryCode,
    discardBarricades,
    disengageEnemy,
    info,
    investigatorEntryError,
    locName,
    locationExists,
    locationRevealCue,
    movementError,
    payActionCost,
    performTest,
    placeLocation,
    processPlayerEnemyEntry,
    registeredEntry,
    requestChoice,
    revealLocation,
    scenarioBehavior,
    scenarioRuntime,
    triggerReaction,
  } = deps

function stepToward(state, fromId, toId) {
  if (fromId === toId) return fromId
  const from = state.locations.find((l) => l.id === fromId)
  if (!from) return null
  if (from.connections.includes(toId)) return toId
  const q = [{ id: fromId, first: null }]
  const seen = new Set([fromId])
  while (q.length) {
    const cur = q.shift()
    const loc = state.locations.find((l) => l.id === cur.id)
    for (const nb of (loc ? loc.connections : [])) {
      if (seen.has(nb)) continue
      if (nb === toId) return cur.first || nb
      seen.add(nb)
      q.push({ id: nb, first: cur.first || nb })
    }
  }
  return null
}

function distanceToInvestigator(state, fromId, targetInvestigators = aliveInvestigators(state)) {
  const targets = new Set(targetInvestigators.map((i) => i.location))
  if (targets.has(fromId)) return 0
  const seen = new Set([fromId])
  const queue = [{ id: fromId, distance: 0 }]
  while (queue.length) {
    const cur = queue.shift()
    const loc = state.locations.find((l) => l.id === cur.id)
    for (const nb of (loc ? loc.connections : [])) {
      if (seen.has(nb) || !state.locations.some((l) => l.id === nb)) continue
      if (targets.has(nb)) return cur.distance + 1
      seen.add(nb)
      queue.push({ id: nb, distance: cur.distance + 1 })
    }
  }
  return Infinity
}

// 猎手移动一步：取距离最近调查员最短的相邻地点，等距路线由队长选择。

function investigatorMoveDestinations(state, seat, effect) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === inv.location)
  let destinations = (loc?.connections || []).filter(id => state.locations.some(item => item.id === id))
  if (effect.anyRevealed) {
    destinations = state.locations.filter(item => item.id !== inv.location && item.revealed && !state.enemies.some(enemy => enemy.location === item.id)).map(item => item.id)
  }
  return destinations.filter(id => !investigatorEntryError(state, id, seat) && (!effect.destination || id === effect.destination))
}

function moveInvestigatorTo(state, seat, effect, events) {
  const inv = state.investigators[seat]
  const destinations = investigatorMoveDestinations(state, seat, effect)
  if (!destinations.length) { info(state, events, '没有可移动的连接地点。'); return }
  const id = effect.destination || (destinations.length === 1 ? destinations[0] : requestChoice(state, {
    kind: 'move', source: effect.source || 'move', seat, prompt: '选择要移动到的连接地点。',
    options: destinations.map(locId => ({ id: locId, label: locName(state, locId) })),
  }))
  if (!effect.keepEngaged) for (const enemyId of inv.engaged.slice()) {
    const enemy = state.enemies.find(e => e.id === enemyId)
    if (enemy) disengageEnemy(state, enemy)
  }
  relocateInvestigator(state, seat, id, events, `${inv.name} 从「${locName(state, inv.location)}」移动到「${locName(state, id)}」；本次移动不触发借机攻击。`)
}

function doShortcutMove(state, seat, move, events) {
  const inv = state.investigators[seat]
  // Phase 5（5a-28）：「捷径」这类提供地点行动的附属由条目级 grantsShortcutMove 声明。
  const attachment = (state.playerLocationAttachments || []).find(item =>
    registeredEntry(item.code)?.grantsShortcutMove && item.location === inv.location && !item.exhausted)
  if (!attachment) return
  attachment.exhausted = true
  relocateInvestigator(state, seat, move.locationId, events,
    `${inv.name} 使用「捷径」移动到「${locName(state, move.locationId)}」。`)
}

function doMove(state, seat, locationId, events) {
  const inv = state.investigators[seat]
  payActionCost(state, inv, 'move', events)
  if (!locationExists(state, locationId) && (state.scenario.setAsideLocations || []).includes(locationId)) {
    placeLocation(state, locationId, events, seat)
  }
  relocateInvestigator(state, seat, locationId, events)
}

// Entering a location has the same consequences for an action or a card effect.
// Action payment and effect-specific disengagement stay with the caller.

function relocateInvestigator(state, seat, locationId, events, message = null) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned || inv.location === locationId || !locationExists(state, locationId)) return
  if (inv.steamImmobileRound === state.round) return
  const moveError = movementError(state, inv)
  if (moveError) { info(state, events, moveError); return }
  const entryError = investigatorEntryError(state, locationId, seat)
  if (entryError) { info(state, events, entryError); return }
  const from = locName(state, inv.location)
  const prevLoc = state.locations.find((l) => l.id === inv.location)
  const companions = state.enemies.filter(enemy => enemy.engagedSeat === seat).map(enemy => enemy.id)
  const enter = () => {
  if (prevLoc && prevLoc.barricade) {
    discardBarricades(state, prevLoc)
    info(state, events, `🚧 「${prevLoc.name}」上的屏障因调查员离开而被弃掉。`)
  }
  inv.location = locationId
  inv.handSlotsPenalty = state.locations.find(location => location.id === locationId)?.handSlotsPenalty || 0
  if (state.phase === 'investigation' && state.turnSerial) {
    if (inv.hiddenMoves?.turnSerial !== state.turnSerial) inv.hiddenMoves = { turnSerial: state.turnSerial, count: 0 }
    inv.hiddenMoves.count++
  }
  info(state, events, message || `🚶 ${inv.name} 从「${from}」移动到「${locName(state, locationId)}」。`)
  for (const enemy of state.enemies.filter(enemy => enemy.engagedSeat === seat)) {
    if (enemy.bindMonster) { disengageEnemy(state, enemy); continue }
    const previous = enemy.location
    enemy.location = locationId
    scenarioBehavior(state).enemyMoved?.(state, enemy, previous, scenarioRuntime(state, events), seat)
  }
  const alreadyRevealed = state.locations.find(l => l.id === locationId)?.revealed
  revealLocation(state, locationId, events, seat)
  autoEngageAt(state, locationId, events)
  const loc = state.locations.find((l) => l.id === locationId)
  scenarioBehavior(state).locationEntered?.(state, inv, loc, scenarioRuntime(state, events), companions)
  if (loc && loc.onEnter) {
    if (alreadyRevealed) info(state, events, `${inv.name} 进入「${loc.name}」，触发地点效果。`, locationRevealCue(loc, true, seat))
    if (loc.onEnter.horror) { info(state, events, `😱 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.horror} 点恐惧。`); applyHorror(state, inv, loc.onEnter.horror, events) }
    if (loc.onEnter.damage) { info(state, events, `💥 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.damage} 点伤害。`); applyDamage(state, inv, loc.onEnter.damage, events) }
    if (loc.onEnter.test) {
      performTest(state, seat, loc.onEnter.test.skill, loc.onEnter.test.difficulty, { source: { label: '进入地点', name: loc.name, code: loc.originalCode || loc.code }, resolve: r => {
        if (!r.success && loc.id === 'graveyard') {
          const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
          const rivertown = state.locations.find((item) => item.id === 'rivertown')
          if (rivertown) options.push({ id: 'move', label: '移动到河岸城' })
          const answer = options.length === 1 ? 'horror' : requestChoice(state, {
            kind: 'location', source: loc.id, seat: inv.seat, prompt: '墓地检定失败：选择受到 2 点恐惧或移动到河岸城。', options,
          })
          if (answer === 'move') {
            relocateInvestigator(state, seat, 'rivertown', events)
          } else {
            info(state, events, `😱 「墓地」检定失败：${inv.name} 受到 2 点恐惧。`)
            applyHorror(state, inv, 2, events)
          }
        } else if (!r.success) {
          applyPenalty(state, inv, loc.onEnter.fail, Math.max(0, loc.onEnter.test.difficulty - r.value), events)
        }
      } })
    }
  }
  if (!inv.defeated && !inv.resigned && inv.location === locationId) {
    triggerReaction(state, seat, 'move', events, { when: 'move', seat, location: locationId })
  }
  // 地底噬魔场景 2 目标：进入仪式地。
  const act = state.acts[state.actIndex]
  if (act && act.objective && act.objective.type === 'enterLocation' && locationId === act.objective.location) {
    advanceAct(state, events)
  }
  }
  const moveAfterCosts = () => {
  scenarioBehavior(state).beforeMove?.(state, inv, state.locations.find(loc => loc.id === locationId), scenarioRuntime(state, events))
  if (prevLoc?.id === 'twistingPaths') {
    performTest(state, seat, 'intellect', 3, { source: { label: '离开地点', name: prevLoc.name, code: prevLoc.originalCode || prevLoc.code }, resolve: r => {
        if (r.success) enter()
        else { inv.location = prevLoc.id; info(state, events, `🌀 「扭曲的道路」：${inv.name} 迷路了，移动被取消。`) }
    } })
  } else {
    const leaveTest = scenarioBehavior(state).locationLeaveTest?.(state, inv, prevLoc, locationId)
    if (leaveTest) performTest(state, seat, leaveTest.skill, leaveTest.difficulty,
      { source: { label: '离开地点', name: prevLoc.name, code: prevLoc.originalCode || prevLoc.code }, resolve: result => {
        if (result.success) enter()
        else scenarioBehavior(state).locationLeaveFailed?.(state, inv, prevLoc, scenarioRuntime(state, events))
      } })
    else enter()
  }
  if (prevLoc && prevLoc.id !== inv.location) scenarioBehavior(state).locationLeft?.(state, inv, prevLoc, scenarioRuntime(state, events))
  }
  const barriers = state.locations.filter(loc => [inv.location, locationId].includes(loc.id))
    .flatMap(loc => Array(loc.arcaneBarriers || 0).fill(loc))
  const payBarrier = index => {
    if (index >= barriers.length) return moveAfterCosts()
    const loc = barriers[index]
    // Phase 5（5a-22）：奥术屏障的卡号来自「地点计数 → 遭遇卡」那张规则表。
    const barrierCode = counterTreacheryCode('arcaneBarriers')
    performTest(state, seat, 'willpower', 4, { source: { label: '奥术屏障', code: barrierCode }, resolve: result => {
      if (result.success) { loc.arcaneBarriers--; state.encounterDiscard.push(barrierCode); payBarrier(index + 1) }
      else if (requestChoice(state, { kind: 'encounter', source: barrierCode, seat,
        prompt: '奥术屏障：取消移动，或弃掉牌库顶 5 张牌继续移动。',
        options: [{ id: 'cancel', label: '取消移动' }, { id: 'mill', label: '弃掉 5 张牌继续移动' }] }) === 'mill') {
        scenarioRuntime(state, events).discardTop(seat, 5)
        if (!inv.defeated) payBarrier(index + 1)
      }
    } })
  }
  payBarrier(0)
}

function relocateEnemy(state, enemy, destination, events) {
  if (!enemy || enemy.bindMonster || !destination || enemy.location === destination || !locationExists(state, destination)) return
  // 「不能移动，也不能被移动」（04337 无形之子）：任何移动来源都被拦住。
  if (enemy.immobile) {
    info(state, events, `⛔ 「${enemy.name}」不能移动，也不能被移动。`)
    return
  }
  if (!enemy.elite && state.locations.find(loc => loc.id === destination)?.barricade) return
  const previous = enemy.location
  enemy.location = destination
  if (enemy.engagedSeat != null && state.investigators[enemy.engagedSeat]?.location !== destination) disengageEnemy(state, enemy)
  processPlayerEnemyEntry(state, enemy, events)
  scenarioBehavior(state).enemyMoved?.(state, enemy, previous, scenarioRuntime(state, events))
  autoEngageAt(state, destination, events)
}

  return { stepToward, distanceToInvestigator, investigatorMoveDestinations, moveInvestigatorTo, doShortcutMove, doMove, relocateInvestigator, relocateEnemy }
}
