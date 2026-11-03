import { addPoolTokens, payPoolTokens, payablePoolTokens, poolTokenRoom } from './chaos-token-pool.js'
let shroudReader = (state, inv) => {
  const loc = state.locations.find(loc => loc.id === inv.location)
  return (loc?.shroud || 0) + (loc?.shroudMod || 0) + (state.fogMod || 0)
}
export function setTokenCostShroudReader(reader) { shroudReader = reader }
export function validateTokenCost(spec) {
  if (spec == null) return
  if (typeof spec !== 'object' || Array.isArray(spec)
    || Object.keys(spec).some(key => !['token', 'operation', 'count', 'sealed'].includes(key))
    || !['bless', 'curse'].includes(spec.token) || !['add', 'pay'].includes(spec.operation)
    || !(Number.isSafeInteger(spec.count) && spec.count >= 0 || ['shroud', 'difficulty'].includes(spec.count))
    || spec.sealed != null && typeof spec.sealed !== 'boolean') throw new TypeError('非法额外混乱标记费用')
}
export function tokenCostAmount(state, inv, spec) {
  if (spec.count === 'difficulty') return Math.max(0, state.skillTest?.difficulty || 0)
  if (spec.count === 'shroud') return Math.max(0, shroudReader(state, inv))
  return spec.count
}
export function tokenCostAvailable(state, inv, spec) {
  if (!spec) return true
  const count = tokenCostAmount(state, inv, spec)
  return spec.operation === 'add' ? poolTokenRoom(state, spec.token) >= count
    : payablePoolTokens(state, spec.token, spec).length >= count
}
export function payTokenCost(state, inv, spec) {
  if (!spec) return true
  if (!tokenCostAvailable(state, inv, spec)) return false
  const count = tokenCostAmount(state, inv, spec)
  return spec.operation === 'add' ? addPoolTokens(state, spec.token, count, { exact: true }) !== false
    : payPoolTokens(state, spec.token, count, spec) !== false
}
