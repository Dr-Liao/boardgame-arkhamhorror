import { beginChaosTest, drawChaosToken, endChaosTest, sealChaosToken } from './chaos-bag.js'
import { integer, mechanicState } from './mechanic-state.js'

export const POOL_LIMITS = Object.freeze({ bless: 10, curse: 10 })
function tokenName(token) {
  if (!Object.hasOwn(POOL_LIMITS, token)) throw new TypeError(`无效有限池标记 ${token}`)
}
export function poolTokenCount(state, token) {
  tokenName(token)
  return (state.chaosBag || []).filter(t => t === token).length
    + (state.chaos?.revealed || []).filter(t => t === token).length
    + (state.chaos?.sealed || []).filter(t => t.token === token).length
}
export function poolTokenRoom(state, token) { return Math.max(0, POOL_LIMITS[token] - poolTokenCount(state, token)) }
export function addPoolTokens(state, token, count, { exact = false } = {}) {
  tokenName(token); integer(count)
  const amount = Math.min(count, poolTokenRoom(state, token))
  if (exact && amount !== count) return false
  if (!amount) return 0
  state.chaosBag.push(...Array(amount).fill(token))
  // chaos.removed is a history, not a second physical pool.
  return amount
}
export function payablePoolTokens(state, token, { sealed = false } = {}) {
  tokenName(token)
  return [...(state.chaosBag || []).flatMap((face, index) => face === token ? [{ zone: 'bag', index }] : []),
    ...(sealed ? (state.chaos?.sealed || []).flatMap((item, index) => item.token === token ? [{ zone: 'sealed', index, source: item.source }] : []) : [])]
}
export function payPoolTokens(state, token, count, { sealed = false, selection = null } = {}) {
  tokenName(token); integer(count)
  const candidates = payablePoolTokens(state, token, { sealed })
  const chosen = selection || candidates.slice(0, count)
  if (chosen.length !== count || new Set(chosen.map(item => `${item.zone}:${item.index}`)).size !== count
    || chosen.some(item => !candidates.some(c => c.zone === item.zone && c.index === item.index))) return false
  for (const zone of ['bag', 'sealed']) {
    const indexes = chosen.filter(item => item.zone === zone).map(item => item.index).sort((a, b) => b - a)
    if (!indexes.length) continue
    const array = zone === 'bag' ? state.chaosBag : state.chaos.sealed
    for (const index of indexes) array.splice(index, 1)
  }
  if (state.chaos?.sealed) state.sealedTokens = state.chaos.sealed.map(item => item.token)
  return count
}
export function replacePoolTokens(state, from, to, count, { exact = false } = {}) {
  tokenName(from); tokenName(to); integer(count)
  if (from === to) throw new TypeError('替换标记必须不同')
  const found = state.chaosBag.filter(t => t === from).length
  // Replacement removes each selected old token even when the new token pool is exhausted.
  if (exact && found < count) return false
  const removed = Math.min(found, count)
  payPoolTokens(state, from, removed)
  return { removed, added: addPoolTokens(state, to, removed) }
}
export function sealPoolTokens(state, source, token, count, { exact = true } = {}) {
  if (typeof source !== 'string' || !source) throw new TypeError('封印需要来源实例')
  if (!['bless', 'curse', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign', 'frost'].includes(token) && !/^[+-]?\d+$/.test(token)) throw new TypeError('无效混乱标记')
  integer(count)
  const available = state.chaosBag.filter(t => t === token).length
  if (exact && available < count) return false
  const amount = Math.min(count, available)
  for (let i = 0; i < amount; i++) sealChaosToken(state, token, source)
  return amount
}
export function releasePoolTokens(state, source, token = null, count = Infinity, { toPool = false } = {}) {
  if (typeof source !== 'string' || !source) throw new TypeError('释放需要来源实例')
  if (count !== Infinity) integer(count)
  const matches = (state.chaos?.sealed || []).filter(t => t.source === source && (token == null || token === t.token)).slice(0, count)
  for (const item of matches) {
    state.chaos.sealed.splice(state.chaos.sealed.indexOf(item), 1)
    if (!toPool) state.chaosBag.push(item.token)
  }
  if (state.chaos?.sealed) state.sealedTokens = state.chaos.sealed.map(item => item.token)
  return matches.length
}
// The physical token joins the current test's revealed zone, and is consumed/returned normally.
export function revealSealedToken(state, source, token) {
  const index = state.chaos?.sealed?.findIndex(item => item.source === source && item.token === token) ?? -1
  if (index < 0 || !state.chaos?.frames?.length) return null
  const [item] = state.chaos.sealed.splice(index, 1)
  state.chaos.revealed.push(item.token)
  state.sealedTokens = state.chaos.sealed.map(t => t.token)
  return item.token
}
// Outside a skill test, revealing tokens does not resolve their effects or trigger extra draws.
export function inspectChaosTokens(state, count) {
  integer(count)
  beginChaosTest(state)
  const tokens = []
  try { for (let i = 0; i < count && state.chaosBag.length; i++) tokens.push(drawChaosToken(state)) }
  finally { endChaosTest(state, []) }
  return tokens
}
export function schedulePoolReplacement(state, from, to) {
  tokenName(from); tokenName(to)
  if (from === to) throw new TypeError('替换标记必须不同')
  const data = mechanicState(state, true); data.tokenSchedules ||= []
  data.tokenSchedules.push({ from, to, round: state.round })
  return true
}
export function resolvePoolSchedules(state) {
  const data = mechanicState(state)
  if (!data?.tokenSchedules?.length) return []
  const due = data.tokenSchedules.filter(record => record.round <= state.round)
  data.tokenSchedules = data.tokenSchedules.filter(record => record.round > state.round)
  return due.map(record => replacePoolTokens(state, record.from, record.to, state.chaosBag.filter(face => face === record.from).length))
}
