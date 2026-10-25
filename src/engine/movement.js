// 移动与位置（调查员移动 / 敌人移动 / 距离）从 engine.js 拆出的模块（Phase 6 · 6d-21）。
//
// 这一组是「谁在哪里、怎么过去」：连接图 BFS、可去地点枚举、移动执行（含进入地点的代价与
// 借机攻击）、把调查员/敌人挪走。它们被 do*（攻击/躲避/调查）与剧本运行时同时使用。
//
// 依赖注入同前；performTest / scenarioRuntime / triggerReaction 已迁出，作为函数声明引用即可。

import { registeredEntries } from './ability.js'

export function createMovement(deps) {
  const {
    advanceAct,
    aliveInvestigators,
    applyDamage,
    applyHorror,
    applyPenalty,
    autoEngageAt,
    discardBarricades,
    disengageEnemy,
    info,
    investigatorEntryError,
    locName,
    locationExists,
    locationRevealCue,
    makeRuntime,
    movementError,
    payActionCost,
    performTest,
    placeLocation,
    processPlayerEnemyEntry,
    registeredEntry,
    requestChoice,
    // 2026-10-25 第六轮修复 05036：「移动后、将要自动交战前」的玩家反应窗口。
    reactionWindow,
    resolveEffect,
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

// 地点进入检定的失败选项：数值 / 文案 / 效果全部来自卡条目的 locationRule（onEnter.failChoice），
// 引擎只做「过滤不可用选项 + 询问 + 按效果原语结算」。墓地（REPORT.md §2.1）曾是这里的写死分支。
function resolveEntryFailChoice(state, seat, inv, loc, enterRule, events) {
  const spec = enterRule.failChoice
  const options = (spec.options || [])
    .filter(option => !option.requiresLocation || locationExists(state, option.requiresLocation))
  if (!options.length) return
  const answer = options.length === 1 ? options[0].id : requestChoice(state, {
    kind: 'location', source: loc.id, seat: inv.seat, prompt: spec.prompt,
    options: options.map(option => ({ id: option.id, label: option.label })),
  })
  const picked = options.find(option => option.id === answer)
  if (!picked) return
  if (picked.log) info(state, events, picked.log.replaceAll('{name}', inv.name).replaceAll('{location}', loc.name))
  if (picked.effect) resolveEffect(state, seat, picked.effect, makeRuntime(state, events))
}

// 地点自身的行为规则由卡条目声明（静态注册表，不进 state，因此不改重放指纹）。
function locationRuleOf(loc) {
  return registeredEntry(loc?.originalCode || loc?.code)?.locationRule || null
}

// 地点计数器型障碍（奥术屏障）：规则来自卡条目的 locationBarrier，引擎只认计数器名。
function locationBarrierEntry(counter) {
  return registeredEntries().find(entry => entry.locationBarrier?.counter === counter) || null
}

function moveInvestigatorTo(state, seat, effect, events) {
  const inv = state.investigators[seat]
  // 卡面条件「如果你未与任何敌人交战」（02108 探路者）：由效果体的 requiresNoEnemies 声明。
  if (effect.requiresNoEnemies && state.enemies.some(enemy => enemy.engagedSeat === seat && !enemy.defeated)) {
    info(state, events, `${inv.name} 正与敌人交战，不能使用这项移动。`)
    return
  }
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

function doDetachLocationAttachment(state, seat, move, events) {
  const inv = state.investigators[seat]
  const loc = state.locations.find(item => item.id === move.locationId)
  const attachment = loc?.attachments?.[move.attachmentIndex]
  if (!inv || !loc || !attachment) return
  if (attachment.ownerSeat != null && attachment.ownerSeat !== seat) return
  payActionCost(state, inv, 'action', events)
  loc.attachments.splice(move.attachmentIndex, 1)
  const owner = state.investigators[attachment.ownerSeat ?? seat] || inv
  state.instanceCounter = (state.instanceCounter || 0) + 1
  owner.assets.push({
    id: `detached-${attachment.code}-${state.instanceCounter}`,
    code: attachment.code, exhausted: false, enteredRound: state.round,
  })
  info(state, events, `🔓 ${inv.name} 解除「${attachment.code}」并放回${owner.name}的游戏区域。`)
}

function doMove(state, seat, locationId, events) {
  const inv = state.investigators[seat]
  payActionCost(state, inv, 'move', events)
  if (!locationExists(state, locationId) && (state.scenario.setAsideLocations || []).includes(locationId)) {
    placeLocation(state, locationId, events, seat)
  }
  relocateInvestigator(state, seat, locationId, events, null, { reason: 'move' })
}

// Entering a location has the same consequences for an action or a card effect.
// Action payment and effect-specific disengagement stay with the caller.

function relocateInvestigator(state, seat, locationId, events, message = null, options = {}) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned || inv.location === locationId || !locationExists(state, locationId)) return
  if (inv.steamImmobileRound === state.round) return
  const moveError = movementError(state, inv, locationId)
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
  const enteredLocation = state.locations.find(location => location.id === locationId)
  // 03250：手部槽位 -1 只在该地点调查时生效，不能常驻。
  inv.handSlotsPenalty = registeredEntry(enteredLocation?.originalCode || enteredLocation?.code)?.handSlotsPenaltyWhileInvestigating
    ? 0 : (enteredLocation?.handSlotsPenalty || 0)
  // 03148 埋伏：被附属地点没有调查员时立刻弃掉（持续条件）。
  if (prevLoc) {
    for (const attachment of (state.playerLocationAttachments || []).filter(item =>
      item.location === prevLoc.id && registeredEntry(item.code)?.discardWhenNoInvestigator)) {
      if (state.investigators.some(other => !other.defeated && !other.resigned && other.location === prevLoc.id)) continue
      const index = state.playerLocationAttachments.indexOf(attachment)
      if (index >= 0) state.playerLocationAttachments.splice(index, 1)
      const owner = state.investigators[attachment.ownerSeat]
      if (owner) owner.discard.push(attachment.code)
      info(state, events, `🪤 「${attachment.code}」因「${prevLoc.name || prevLoc.id}」没有调查员而被弃掉。`)
    }
  }
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
  // 2026-10-25 第六轮修复 05036：进入地点后、自动交战前开反应窗口（05236 钉鞋等）。
  const engageCandidates = state.enemies.filter(enemy => enemy.location === locationId
    && !enemy.defeated && !enemy.engagedSeat && !enemy.massive)
  {
    reactionWindow(state, 'moveBeforeEngage', {
      when: 'moveBeforeEngage', seat: inv.seat, location: locationId,
      enemy: engageCandidates[0], enemies: engageCandidates.map(enemy => enemy.id),
      prompt: `${inv.name} 进入「${locName(state, locationId)}」并将与 ${engageCandidates.length} 个敌人交战`,
    }, events)
  }
  autoEngageAt(state, locationId, events)
  const loc = state.locations.find((l) => l.id === locationId)
  scenarioBehavior(state).locationEntered?.(state, inv, loc, scenarioRuntime(state, events), companions)
  // 第 55 轮：地点卡自己的「进入时」自定义效果（02132/02134 等）；与剧本钩子同序。
  locationRuleOf(loc)?.onEnter?.effect?.(state, loc, scenarioRuntime(state, events), inv)
  const enterRule = (loc ? locationRuleOf(loc)?.onEnter : null) || loc?.onEnter
  if (loc && enterRule) {
    if (alreadyRevealed) info(state, events, `${inv.name} 进入「${loc.name}」，触发地点效果。`, locationRevealCue(loc, true, seat))
    if (loc.onEnter?.horror) { info(state, events, `😱 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.horror} 点恐惧。`); applyHorror(state, inv, loc.onEnter.horror, events) }
    if (loc.onEnter?.damage) { info(state, events, `💥 进入「${loc.name}」：${inv.name} 受到 ${loc.onEnter.damage} 点伤害。`); applyDamage(state, inv, loc.onEnter.damage, events) }
    if (enterRule.test) {
      performTest(state, seat, enterRule.test.skill, enterRule.test.difficulty, { source: { label: '进入地点', name: loc.name, code: loc.originalCode || loc.code }, resolve: r => {
        if (r.success) return
        if (enterRule.failChoice) {
          resolveEntryFailChoice(state, seat, inv, loc, enterRule, events)
          return
        }
        applyPenalty(state, inv, enterRule.fail || loc.onEnter?.fail, Math.max(0, enterRule.test.difficulty - r.value), events)
      } })
    }
  }
  if (!inv.defeated && !inv.resigned && inv.location === locationId) {
    triggerReaction(state, seat, 'move', events, { when: 'move', seat, location: locationId })
  }
  // 地底噬魔场景 2 目标：进入仪式地。关卡自带 checkObjectives 的剧本用 scenarioAdvance
  // 标记「推进由剧本结算」，避免在移动结算中途提前触发 actReveal。
  const act = state.acts[state.actIndex]
  if (act && act.objective && act.objective.type === 'enterLocation'
    && !act.objective.scenarioAdvance && locationId === act.objective.location) {
    advanceAct(state, events)
  }
  }
  const moveAfterCosts = () => {
  // 2026-10-25 本循环修复 05254：beforeMove 第 5 参携带位移来源 { reason: 'move' | 'effect' }，
  // 使「下一次移动行动额外花费」只对移动行动生效、效果位移不加价。
  scenarioBehavior(state).beforeMove?.(state, inv, state.locations.find(loc => loc.id === locationId), scenarioRuntime(state, events),
    { reason: options.reason === 'move' ? 'move' : 'effect' })
  // 离开地点的检定由地点卡条目声明（locationRule.onLeave.test），引擎不再按地点 id 分支。
  const leaveRule = locationRuleOf(prevLoc)?.onLeave || prevLoc?.onLeave
  const leaveDestination = state.locations.find(loc => loc.id === locationId)
  const leaveTestApplies = leaveRule?.test && (!leaveRule.test.onlyUnrevealedDestination || !leaveDestination?.revealed)
  if (leaveTestApplies) {
    performTest(state, seat, leaveRule.test.skill, leaveRule.test.difficulty, { source: { label: '离开地点', name: prevLoc.name, code: prevLoc.originalCode || prevLoc.code }, resolve: r => {
        if (r.success) enter()
        else {
          inv.location = prevLoc.id
          const text = leaveRule.cancelMessage || `🌀 「${prevLoc.name}」：${inv.name} 的移动被取消。`
          info(state, events, text.replaceAll('{name}', inv.name))
          leaveRule.onFail?.(state, prevLoc, scenarioRuntime(state, events), inv)
        }
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
  if (prevLoc && prevLoc.id !== inv.location) {
    scenarioBehavior(state).locationLeft?.(state, inv, prevLoc, scenarioRuntime(state, events))
    // 第 66 轮：地点卡自己的「离开后」效果（02326 无尽之桥）。
    locationRuleOf(prevLoc)?.onLeave?.effect?.(state, prevLoc, scenarioRuntime(state, events), inv)
  }
  }
  const barriers = state.locations.filter(loc => [inv.location, locationId].includes(loc.id))
    .flatMap(loc => Array(loc.arcaneBarriers || 0).fill(loc))
  const barrierEntry = barriers.length ? locationBarrierEntry('arcaneBarriers') : null
  if (barriers.length && !barrierEntry) throw new Error('arcaneBarriers 计数器缺少卡条目的 locationBarrier 声明')
  const payBarrier = index => {
    if (index >= barriers.length) return moveAfterCosts()
    const loc = barriers[index]
    const rule = barrierEntry.locationBarrier
    performTest(state, seat, rule.test.skill, rule.test.difficulty, { source: { label: rule.label, code: barrierEntry.code }, resolve: result => {
      if (result.success) {
        loc.arcaneBarriers--
        state.encounterDiscard.push(barrierEntry.code)
        payBarrier(index + 1)
        return
      }
      const mill = (rule.options || []).find(option => option.mill)
      const answer = requestChoice(state, { kind: 'encounter', source: barrierEntry.code, seat,
        prompt: rule.prompt,
        options: rule.options.map(option => ({ id: option.id, label: option.label })) })
      if (mill && answer === mill.id) {
        scenarioRuntime(state, events).discardTop(seat, mill.mill)
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

  return { stepToward, distanceToInvestigator, investigatorMoveDestinations, moveInvestigatorTo, doShortcutMove, doDetachLocationAttachment, doMove, relocateInvestigator, relocateEnemy }
}
