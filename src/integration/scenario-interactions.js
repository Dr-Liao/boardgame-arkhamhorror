// 食梦者交互 3–10 的观察投影。
//
// 只读引擎已经算好的字段，不按卡号分支，也不改状态。没有任何一种机制在场时返回 null，
// 其它战役的视图不增加 scenarioInteractions。
// 隐私：蜂拥卡面朝下（不给卡号）、滋生袋只给张数和已揭示、隐藏牌只给观察者自己的卡号、
// 掩藏背面故事只在翻面之后出现、结局矩阵只给已经到达的那一格。
import { swarmCardsOf, swarmBlockedReason } from '../engine/swarm.js'
import { tokenBagInfo, INFESTATION_BAG_ID, infestedCount } from '../engine/token-bag.js'
import { counterMax, counterSummary, ALARM_LEVEL_MAX } from '../engine/counters.js'
import { veiledLocationsOf, veiledFlipBlockedReason, isVeiledRevealed } from '../engine/veiled.js'
import { markerSummary } from '../engine/marker-count.js'
import { orderVerticalChain, chainNeighbors, verticalIndexOf } from '../engine/vertical-chain.js'
import { epilogueFor, isEpilogueMatrix } from '../campaign/epilogue-matrix.js'

function storyCodeOf(location) {
  return location?.backCode || location?.linkedToCode || location?.linkedCardCode || location?.storyCode || null
}

export function scenarioInteractionsView(state, observerSeat = null) {
  if (!state || typeof state !== 'object') return null
  const observer = Number.isInteger(observerSeat) ? observerSeat : null
  const observerInv = (state.investigators || []).find(inv => inv.seat === observer) || null
  const view = {}

  const swarm = (state.enemies || []).flatMap(enemy => {
    if (!Array.isArray(enemy?.swarmCards)) return []
    const cards = swarmCardsOf(enemy)
    const sources = [...new Set(cards.map(card => card.source).filter(Boolean))]
    return [{
      hostId: enemy.id ?? null,
      name: enemy.name || null,
      count: cards.length,
      sources,
      blockedReason: swarmBlockedReason(enemy),
    }]
  })
  if (swarm.length) view.swarm = swarm

  if (state.tokenBags && typeof state.tokenBags === 'object') {
    const bags = Object.keys(state.tokenBags).map(id => {
      const info = tokenBagInfo(state, id)
      return { id, count: info.count, revealed: info.revealed }
    })
    view.tokenBag = {
      bags,
      infested: Array.isArray(state.infestedLocations) ? [...state.infestedLocations] : [],
      infestedCount: infestedCount(state),
      infestationId: INFESTATION_BAG_ID,
    }
  }

  if (state.investigatorCounters?.alarmLevel) {
    const total = Math.max(state.numInvestigators || 0, (state.investigators || []).length)
    view.alarm = {
      max: counterMax(state, 'alarmLevel') ?? ALARM_LEVEL_MAX,
      seats: counterSummary(state, 'alarmLevel', total).map((value, seat) => ({ seat, value })),
    }
  }

  const hiddenSeats = (state.investigators || []).flatMap(inv => {
    const codes = Array.isArray(inv.hiddenCards) ? inv.hiddenCards.filter(Boolean) : []
    if (!codes.length) return []
    const own = inv.seat === observer
    return [{ seat: inv.seat, count: codes.length, ...(own ? { codes: [...codes] } : {}) }]
  })
  if (hiddenSeats.length) view.hidden = { seats: hiddenSeats }

  const veiled = veiledLocationsOf(state).map(location => {
    const flipped = isVeiledRevealed(location)
    return {
      id: location.id,
      name: location.name || null,
      flipped,
      reason: flipped ? null : veiledFlipBlockedReason(location),
      here: observerInv?.location === location.id,
      storyCode: flipped ? storyCodeOf(location) : null,
    }
  })
  if (veiled.length) view.veiled = veiled

  const markers = markerSummary(state)
  if (markers.length) view.markers = markers

  const chain = orderVerticalChain(state.locations || []).filter(location => verticalIndexOf(location) != null)
  if (chain.length) {
    view.vertical = chain.map(location => ({
      id: location.id,
      name: location.name || null,
      index: verticalIndexOf(location),
      ...chainNeighbors(state, location.id),
    }))
  }

  const gates = (state.locations || []).filter(location => location?.dreamGate === true).map(location => ({
    id: location.id,
    name: location.name || null,
  }))
  const matrix = state.campaign?.epilogueMatrix
  if (gates.length || isEpilogueMatrix(matrix)) {
    const resolved = state.campaign?.epilogueResolved
    const reached = isEpilogueMatrix(matrix) && resolved?.a && resolved?.b
      ? epilogueFor(matrix, resolved.a, resolved.b)
      : null
    view.epilogue = {
      gates,
      status: reached ? 'reached' : 'pending',
      title: reached?.title || null,
      textKey: reached?.textKey || null,
    }
  }

  return Object.keys(view).length ? view : null
}
