import { mechanicState, integer, locationAt } from './mechanic-state.js'
import { registeredEntry } from './ability.js'
const endpoints = (a, b) => [a, b].sort()
export function canPlaceBarrier(state, a, b) {
  const left = locationAt(state, a), right = locationAt(state, b)
  return a !== b && (left.connections?.includes(b) || right.connections?.includes(a))
    && ![left, right].some(loc => registeredEntry(loc.originalCode || loc.code)?.locationRule?.cannotPlaceBarriers)
}
export function barrierCount(state, a, b) {
  return (mechanicState(state)?.barriers || []).find(edge => edge.a === endpoints(a, b)[0] && edge.b === endpoints(a, b)[1])?.count || 0
}
export function setBarrierCount(state, a, b, count, { setup = false } = {}) {
  const left = locationAt(state, a), right = locationAt(state, b)
  integer(count)
  if (a === b || !left.connections?.includes(b) && !right.connections?.includes(a)) throw new TypeError('Barriers require a connected pair of locations')
  const before = barrierCount(state, a, b)
  if (!setup && count > before && [left, right].some(loc => registeredEntry(loc.originalCode || loc.code)?.locationRule?.cannotPlaceBarriers)) return false
  const data = mechanicState(state, true); data.barriers ||= []
  const [first, second] = endpoints(a, b), old = data.barriers.find(edge => edge.a === first && edge.b === second)
  if (old) old.count = count
  else if (count) data.barriers.push({ a: first, b: second, count })
  data.barriers = data.barriers.filter(edge => edge.count > 0)
  return count
}
export function changeBarrierCount(state, a, b, delta, options) {
  if (!Number.isSafeInteger(delta)) throw new TypeError('Invalid barrier change')
  return setBarrierCount(state, a, b, Math.max(0, barrierCount(state, a, b) + delta), options)
}
export function barrierEdges(state, location = null) {
  return (mechanicState(state)?.barriers || []).filter(edge => location == null || [edge.a, edge.b].includes(location)).map(edge => ({ ...edge }))
}
