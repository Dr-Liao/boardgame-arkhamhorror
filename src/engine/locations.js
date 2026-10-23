// 地点与线索（放置 / 揭示 / 移出 / 线索发现与归还）从 engine.js 拆出的模块
// （Phase 6 · 6d-23）。
//
// 这一组是「地图怎么变」：从探索牌库放出地点、翻开、移出（含离开时的结算）、
// 以及线索的发现/归还/同步。地点相关的反应窗口（locationRevealed 等）通过
// triggerReaction 触发，所以本模块依赖它。
import { registeredEntry } from './ability.js'

// 地点卡自己的「揭示时」规则由条目声明（静态注册表，不进 state）。
function locationRuleOf(loc) {
  return registeredEntry(loc?.originalCode || loc?.code)?.locationRule || null
}

// A location entering play must be connected to the locations already in play
// by its printed symbols, in both directions (A prints B's symbol, B prints A's
// symbol). Static connections are computed at chapter-build time against base
// ids, which is not enough for encounter locations that enter play under an
// instance id (location02327-1): story locations placed later (e.g. The Edge of
// the Universe / Tear Through Time) would otherwise stay unreachable until some
// other encounter location happened to be placed and refreshed every connection.
// Additive only: never replace a connection list, so hand-made links (e.g. the
// Blood on the Altar hidden chamber) and printed one-way links are preserved.
// Shared with the encounter-location placement path (scenario-runtime), which
// used to rebuild every connection list and dropped hand-made links.
export function linkLocationBySymbols(state, loc) {
  const mine = loc.symbols?.front
  if (!mine || !Array.isArray(loc.connections)) return
  for (const other of state.locations) {
    if (other === loc) continue
    const theirs = other.symbols?.front
    if (!theirs || !Array.isArray(other.connections)) continue
    if ((mine.links || []).includes(theirs.symbol) && !loc.connections.includes(other.id)) {
      loc.connections.push(other.id)
    }
    if ((theirs.links || []).includes(mine.symbol) && !other.connections.includes(loc.id)) {
      other.connections.push(loc.id)
    }
  }
}

export function createLocations(deps) {
  const {
    entityModifierTotal,
    ALL_CARDS,
    ALL_TREACHERIES,
    relocateDestinationCode,
    aliveInvestigators,
    assetPassiveData,
    autoEngageAll,
    autoEngageAt,
    clueBlockerName,
    discardBarricades,
    engagedWithClueBlocker,
    entityRuleActive,
    getThreatEffect,
    info,
    locationCounterTreacheries,
    locationExists,
    locationRevealCue,
    requestChoice,
    reactionWindow,
    scenarioBehavior,
    scenarioRuntime,
    spendClues,
    triggerReaction,
  } = deps

function locName(state, id) {
  const l = state.locations.find((x) => x.id === id)
  return l ? l.name : id
}

// 副标题是地点名的一部分（「展厅」+「禁止入内」/「阿萨帕斯卡尔展区」）。
// 只给 AI/描述层用；日志里的 locName 保持原名，避免所有旧文案一起变长。
function locSubname(loc, includeHidden = false) {
  if (!loc || (!includeHidden && loc.revealed === false)) return ''
  const card = ALL_CARDS[loc.code] || ALL_CARDS[loc.originalCode]
  return String(loc.subname || card?.subnameZh || card?.subname || '').trim()
}

function locLabel(state, id, options = {}) {
  const loc = state.locations.find((x) => x.id === id) || state.scenario?.locations?.[id]
  if (!loc) return id
  const name = loc.name || id
  const subname = locSubname(loc, options.includeHidden)
  return subname && !name.includes(subname) ? `${name}（${subname}）` : name
}

function placeLocation(state, id, events, seat = null) {
  if (locationExists(state, id)) return
  const base = state.scenario.locations[id]
  if (!base) return
  const def = { ...base, ...(state.locationVariants?.[id] || {}) }
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null ? def.cluesPerInvestigator * state.numInvestigators : (def.clues || 0))
  const revealed = Boolean(scenarioBehavior(state).locationsStartRevealed)
    || state.investigators.some(inv => inv.location === id)
  const loc = { ...def, id, revealed, clues: revealed ? clues : 0, maxClues: clues }
  state.locations.push(loc)
  linkLocationBySymbols(state, loc)
  info(state, events, `📍 「${loc.name}」进入游戏。`)
  // 印刷就是 0 线索的地点（如 04227 深入幽嘶）：入场即视为「已被完全调查」，
  // 胜利/复仇点数立刻进胜利区（否则地点复仇 2 永远不会计入）。
  if (loc.revealed) awardLocationVictory(state, loc, events)
  // 杰克·威廉斯：新地点入场后可以横置并抽牌（仅限放置该地点的调查员）。
  if (seat != null) {
    const placer = state.investigators[seat]
    if (placer?.assets.some(asset => assetPassiveData(asset.code)?.noOpportunityFirstAction)) {
      triggerReaction(state, seat, 'locationRevealed', events, { when: 'locationRevealed', seat, location: id })
    }
  }
}

function flipScenarioLocation(state, id, seat, events) {
  const loc = state.locations.find(location => location.id === id)
  if (!loc || loc.cannotFlipAgain) return false
  const api = scenarioRuntime(state, events)
  scenarioBehavior(state).locationWillFlip?.(state, loc, api, seat)
  scenarioBehavior(state).locationStory?.(state, loc, api, seat)
  scenarioBehavior(state).locationFlipped?.(state, loc, api, seat)
  autoEngageAll(state, events)
  info(state, events, `「${loc.name}」完成翻面结算。`, locationRevealCue(loc, false, seat))
  return true
}

function revealLocation(state, id, events, seat = null) {
  const loc = state.locations.find((l) => l.id === id)
  if (loc && !loc.revealed) {
    loc.revealed = true
    if (loc.unrevealedActualName) { loc.name = loc.unrevealedActualName; delete loc.unrevealedActualName }
    delete loc.hiddenIdentity
    delete loc.artCode
    // D1：地点卡自己的声明式线索修正；剧本钩子仍然优先（历史数据依赖它的覆盖语义）。
    const clueDelta = entityModifierTotal(state, loc, 'locationClues')
    const clueOverride = scenarioBehavior(state).cluesOnReveal?.(state, loc, seat == null ? null : state.investigators[seat])
    loc.clues = Math.max(0, clueOverride ?? ((loc.maxClues || 0) + clueDelta))
    info(state, events, `「${loc.name}」被揭示。`, locationRevealCue(loc, false, seat))
    awardLocationVictory(state, loc, events)
    const ignored = seat != null
      && (entityRuleActive(state, loc, 'ignore:revealText')
        || scenarioBehavior(state).ignoreLocationRevealText?.(state, state.investigators[seat], loc))
    if (!ignored) {
      scenarioBehavior(state).locationRevealed?.(state, loc, scenarioRuntime(state, events), seat)
      // 第 55 轮：地点卡自己的「揭示时」规则（02173/02176/02177/02285–02292 等）。
      locationRuleOf(loc)?.onReveal?.(state, loc, scenarioRuntime(state, events), seat)
    }
    if (seat != null) triggerReaction(state, seat, 'locationRevealed', events, { when: 'locationRevealed', seat, location: loc.id })
    // 「地点入场/被揭示后」的玩家卡（04306 有利位置）读最近一次揭示；回合结束自然过期。
    state.lastLocationRevealed = { id: loc.id, round: state.round, turnSerial: state.turnSerial ?? null }
  }
}

function removeLocation(state, id, events) {
  const i = state.locations.findIndex((l) => l.id === id)
  if (i >= 0) {
    // Phase 5（5a-32）：移出地点时的默认去向在卡号规则数据里。
    const destination = state.locations.find(loc => (loc.originalCode || loc.code) === relocateDestinationCode() && loc.id !== id)
    const departing = destination ? aliveInvestigators(state).filter(inv => inv.location === id) : []
    if (destination) {
      const companions = state.enemies.filter(enemy => enemy.location === id && departing.some(inv => inv.seat === enemy.engagedSeat))
      for (const inv of departing) inv.location = destination.id
      for (const enemy of state.enemies.filter(enemy => enemy.location === id)) {
        enemy.location = destination.id
        scenarioBehavior(state).enemyMoved?.(state, enemy, id, scenarioRuntime(state, events), enemy.engagedSeat)
      }
      for (const inv of departing) scenarioBehavior(state).locationEntered?.(state, inv, destination, scenarioRuntime(state, events), companions.map(enemy => enemy.id))
      autoEngageAt(state, destination.id, events)
    }
    const [loc] = state.locations.splice(i, 1)
    for (const attachment of loc.attachments || []) {
      const code = typeof attachment === 'string' ? attachment : attachment?.code
      if (code && ALL_TREACHERIES[code]) state.encounterDiscard.push(code)
    }
    discardBarricades(state, loc)
    // Phase 5（5a-14）：地点上的计数对应哪张遭遇卡在卡号规则数据里。
    state.encounterDiscard.push(...locationCounterTreacheries(loc))
    info(state, events, `📍 「${loc.name}」被移出游戏。`)
    for (const inv of departing) scenarioBehavior(state).investigatorMovedByEncounterCard?.(state, inv, scenarioRuntime(state, events))
  }
}

function syncClues(state) {
  state.clues = state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
}

function placeCluesOnLocation(state, inv, amount, events) {
  const n = Math.min(amount, inv.clues)
  const loc = state.locations.find((l) => l.id === inv.location)
  if (n <= 0 || !loc) return
  spendClues(state, inv, n)
  loc.clues += n
  loc.maxClues = Math.max(loc.maxClues || 0, loc.clues)
  info(state, events, `🔍 ${inv.name} 将 ${n} 个线索放回「${loc.name}」。`)
}

// ---------------------------------------------------------------------------
// 技能检定 + 混乱袋（4 难度 + 特殊标记按剧本动态结算）
// ---------------------------------------------------------------------------

function notifyCluesRemoved(state, loc, amount, events) {
  if (!loc || amount <= 0) return
  scenarioBehavior(state).cluesRemoved?.(state, loc, amount, scenarioRuntime(state, events))
}

// 「只能通过调查发现线索」这类限制的查询点（02213 学校）：限制属于**目标地点**，
// 不是调查员所在地点——例如「发现任意地点的 1 个线索」这类远程发现（02224）。
function canDiscoverClueAt(state, inv, loc) {
  if (!loc || loc.clues <= 0) return false
  if (scenarioBehavior(state).canDiscoverClues?.(state, inv, loc) === false) return false
  // 交战中的「不能发现线索」敌人（影子特工）跟着调查员走，与目标地点无关。
  return !engagedWithClueBlocker(state, inv)
}

function discoverClueAt(state, inv, amount, events, opts = {}) {
  // 默认发现调查员所在地点的线索；卡面允许指定别的地点（02224「发现任意地点的 1 个线索」）。
  const targetId = opts.locationId ?? inv.location
  let loc = state.locations.find((l) => l.id === targetId)
  if (scenarioBehavior(state).canDiscoverClues?.(state, inv, loc) === false) return false
  // Revelation can put the hunter into play after an event was paid for.
  // Recheck at resolution, including discoveries that bypass investigation.
  const clueBlocker = engagedWithClueBlocker(state, inv)
  if (clueBlocker) {
    info(state, events, `${inv.name} 与${clueBlockerName(state, clueBlocker)}交战，不能发现线索。`)
    return false
  }
  // 04094 一片漆黑：每位调查员每轮从单个地点最多发现 1 个线索（硬上限）。
  if (state.scenarioFlags?.deepDark) {
    state.scenarioFlags.deepDarkClaims ||= {}
    const key = `${state.round}:${inv.seat}:${targetId}`
    const claims = state.scenarioFlags.deepDarkClaims
    if ((claims[key] || 0) >= 1) return false
    claims[key] = (claims[key] || 0) + 1
    amount = Math.min(amount, 1)
  }
  if (!state._discoveringClue) {
    state._discoveringClue = true
    try {
      triggerReaction(state, inv.seat, 'discoverClue', events, {
        when: 'discoverClue', seat: inv.seat, location: targetId, amount,
      })
    } finally {
      state._discoveringClue = false
    }
  }
  const coverUp = inv.threat.find((t) => {
    const th = getThreatEffect(t)
    return th && th.redirectClues && (t.counters || 0) > 0
  })
  // 掩盖罪证只在「你所在地点」替换发现，远程发现不触发。
  loc = state.locations.find((l) => l.id === targetId)
  if (coverUp && targetId === inv.location && loc?.clues > 0) {
    const answer = requestChoice(state, { kind: 'reaction', source: coverUp.id, seat: inv.seat,
      prompt: '是否用本次发现移除掩盖罪证上的线索？', canSkip: true,
      options: [{ id: 'skip', label: '正常发现地点线索' }, { id: 'remove', label: '移除掩盖罪证上的线索' }] })
    if (answer === 'remove') {
      const removed = Math.min(amount, loc.clues, coverUp.counters)
      coverUp.counters -= removed
      info(state, events, `移除掩盖罪证上的 ${removed} 个线索。`)
      return true
    }
  }
  if (loc && loc.clues > 0) {
    const got = Math.min(amount, loc.clues)
    loc.clues -= got
    inv.clues += got
    syncClues(state)
    info(state, events, `🔍 ${inv.name} 获得 ${got} 个线索！（队内累计 ${state.clues}）`)
    notifyCluesRemoved(state, loc, got, events)
    scenarioBehavior(state).cluesGained?.(state, inv, got, scenarioRuntime(state, events))
    // 能力层窗口：发现线索后（02061 沃伦·莱斯教授、05025 串联线索等）。
    const clueContext = { when: 'clueDiscovered', seat: inv.seat,
      location: loc.id, amount: got, lastClue: loc.clues === 0, shroud: loc.shroud,
      prompt: `${inv.name} 发现了 ${got} 个线索` }
    triggerReaction(state, inv.seat, 'clueDiscovered', events, clueContext)
    reactionWindow(state, 'clueDiscovered', clueContext, events)
    return true
  }
  info(state, events, '这里没有线索。')
  return false
}

function awardLocationVictory(state, loc, events) {
  const printed = ALL_CARDS[loc.originalCode || loc.code] || {}
  const victory = Number(loc.victory || printed.victory || 0)
  if (loc.clues <= 0 && victory && !loc.victoryAwarded) {
    loc.victoryAwarded = true
    state.victory += victory
    // 复仇：地点进入胜利区时同样计入复仇点数（定义没写就回落到印刷值）。
    const vengeance = Number(loc.vengeance ?? printed.vengeance ?? 0)
    state.victoryDisplay ||= []
    state.victoryDisplay.push({ id: `location:${loc.id}`, code: loc.originalCode || loc.code,
      originalCode: loc.originalCode || loc.code, victory, vengeance })
    info(state, events, `💎 「${loc.name}」被完全调查，胜利点 +${victory}（累计 ${state.victory}）。`)
  }
}

  return { locName, locLabel, placeLocation, flipScenarioLocation, revealLocation, removeLocation, syncClues, placeCluesOnLocation, notifyCluesRemoved, canDiscoverClueAt, discoverClueAt, awardLocationVictory }
}
