import { integer, investigatorAt, locationAt, mechanicState } from './mechanic-state.js'
import { eventWindowContext } from './event-window.js'
import { registeredEntry } from './ability.js'
function activeFloodBounds(location) {
  const bounds=registeredEntry(location.originalCode || location.code)?.locationRule?.floodBounds || {}
  return bounds.onlyRevealed && !location.revealed ? {} : bounds
}
export const FLOOD_LEVELS = Object.freeze({ unflooded: 0, partial: 1, full: 2 })
export function floodLevel(state, id) { locationAt(state, id); return mechanicState(state)?.flood?.[id] || 0 }
export function canChangeFloodLevel(state, id, delta) {
  const location = locationAt(state, id), before = floodLevel(state, id)
  if (delta > 0 && mechanicState(state)?.floodPolicy?.locked?.includes(id)) return false
  const bounds = activeFloodBounds(location)
  return Math.max(bounds.min ?? 0, Math.min(bounds.max ?? 2, before + delta)) !== before
}
export function setFloodLevel(state, id, level, { cannotIncrease = false, ignoreRestrictions = false, onChange = null } = {}) {
  const location = locationAt(state, id); integer(level)
  if (level > 2) throw new TypeError('淹没等级必须为 0、1 或 2')
  const before = floodLevel(state, id)
  if (cannotIncrease && level > before) return false
  if (!ignoreRestrictions && level > before && mechanicState(state)?.floodPolicy?.locked?.includes(id)) return false
  if (!ignoreRestrictions) {
    const bounds = activeFloodBounds(location)
    level = Math.max(bounds.min ?? 0, Math.min(bounds.max ?? 2, level))
  }
  const data = mechanicState(state, true)
  data.flood ||= {}; data.flood[id] = level
  if (before !== level) onChange?.(eventWindowContext(state, { location: id, before, after: level, delta: level - before }))
  return level
}
export function setRevealFloodPolicy(state, policy) {
  if (!policy || !['increase', 'set'].includes(policy.mode) || ![1, 2].includes(policy.amount)) throw new TypeError('Invalid reveal flood policy')
  const data = mechanicState(state, true); data.floodPolicy ||= {}
  data.floodPolicy.reveal = { mode: policy.mode, amount: policy.amount }
}
export function lockFloodLevel(state, id) {
  locationAt(state, id)
  const data = mechanicState(state, true); data.floodPolicy ||= {}; data.floodPolicy.locked ||= []
  if (!data.floodPolicy.locked.includes(id)) data.floodPolicy.locked.push(id)
  return true
}
export function applyRevealFloodPolicy(state, id, options = {}) {
  const policy = mechanicState(state)?.floodPolicy?.reveal
  if (!policy) return
  if (policy.mode === 'set') return setFloodLevel(state, id, policy.amount, options)
  return changeFloodLevel(state, id, policy.amount, options)
}
export function changeFloodLevel(state, id, delta, options = {}) {
  if (!Number.isSafeInteger(delta)) throw new TypeError('淹没变化必须为整数')
  return setFloodLevel(state, id, Math.max(0, Math.min(2, floodLevel(state, id) + delta)), options)
}
export function effectiveFloodLevel(state, seat, { reduce = 0, immune = false, location = null } = {}) {
  const inv = investigatorAt(state, seat)
  const target = location ?? inv.location
  const vehicle = Object.values(mechanicState(state)?.vehicles || {}).find(v => v.passengers.includes(seat))
  if (immune || vehicle?.protectsFromFlood && target === inv.location && vehicle.location === target) return 0
  return Math.max(0, floodLevel(state, target) - integer(reduce))
}
export function beginAirTurn(state, seat, { damage = 5, protectedFromAir = false } = {}) {
  integer(damage); const inv = investigatorAt(state, seat)
  const turn = state.turnSerial || 0
  if (mechanicState(state)?.airTurns?.[seat] === turn) return false
  const data = mechanicState(state, true); data.airTurns ||= {}; data.airTurns[seat] = turn
  if (inv.defeated || inv.resigned || protectedFromAir || effectiveFloodLevel(state, seat) < 2) return false
  data.air ||= {}
  data.air[seat] ||= { turn: state.turnSerial || 0, damage }
  return true
}
export function checkAirAfterMove(state, seat) {
  const data = mechanicState(state)
  if (!data?.air?.[seat]) return false
  if (effectiveFloodLevel(state, seat) >= 2) return false
  delete data.air[seat]
  return true
}
export function endAirTurn(state, seat, directDamage) {
  const inv = investigatorAt(state, seat)
  const data = mechanicState(state)
  const risk = data?.air?.[seat]
  if (!risk) return 0
  if (typeof directDamage !== 'function') throw new TypeError('空气结算需要直接伤害入口')
  delete data.air[seat]
  if (inv.defeated || inv.resigned) return 0
  directDamage(seat, risk.damage)
  return risk.damage
}
