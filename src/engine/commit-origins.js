import { mechanicState, investigatorAt } from './mechanic-state.js'
import { registeredEntry } from './ability.js'
export function isPublicBeneath(state, seat, host) {
  return state.investigators[seat]?.code === host && registeredEntry(host)?.investigator?.beneathPublic === true
}
function storage(state, seat, host, create = false) {
  investigatorAt(state, seat)
  if (typeof host !== 'string' || !host) throw new TypeError('卡下方牌需要宿主 id')
  const data = mechanicState(state, create)
  if (create) { data.beneath ||= {}; data.beneath[seat] ||= {}; return data.beneath[seat][host] ||= [] }
  return data?.beneath?.[seat]?.[host] || []
}
export function beneathCards(state, seat, host) { return [...storage(state, seat, host)] }
export function storeBeneath(state, seat, host, code, { from = 'hand' } = {}) {
  const inv = investigatorAt(state, seat)
  if (!['hand', 'deck', 'discard'].includes(from)) throw new TypeError('无效卡牌来源区')
  const index = inv[from]?.indexOf(code) ?? -1
  if (index < 0) return false
  const cards = storage(state, seat, host, true)
  inv[from].splice(index, 1); cards.push(code)
  return true
}
export function takeBeneath(state, seat, host, code, destination = 'hand') {
  if (!['hand', 'discard', 'deck'].includes(destination)) throw new TypeError('无效卡牌目的区')
  const cards = storage(state, seat, host), index = cards.indexOf(code)
  if (index < 0) return false
  cards.splice(index, 1); investigatorAt(state, seat)[destination].push(code)
  return true
}
// The caller supplies the existing commit API so eligibility, costs, icons and windows have one reader.
export function commitFromOrigin(state, seat, { host = null, code, from = 'beneath', retain = false, ignoreAdditionalCosts = false }, commit) {
  const inv = investigatorAt(state, seat)
  const origin = from === 'beneath' ? storage(state, seat, host) : from === 'discard' ? inv.discard : null
  if (!origin) throw new TypeError('无效投入来源')
  const index = origin.indexOf(code)
  if (index < 0 || !state.skillTest) return false
  if (typeof commit !== 'function') throw new TypeError('需要权威投入入口')
  // Borrow to hand only inside the resolution transaction. Failure restores the exact source index.
  origin.splice(index, 1); const handIndex = inv.hand.length; inv.hand.push(code)
  try {
    const item = commit(seat, code, { ignoreAdditionalCosts })
    if (!item) { inv.hand.splice(handIndex, 1); origin.splice(index, 0, code); return false }
    if (retain && from === 'beneath') { item.destination = 'origin'; item.origin = { seat, host } }
    if (retain && from === 'discard') item.destination = 'hand'
    return item
  } catch (error) {
    if (inv.hand[handIndex] === code) inv.hand.splice(handIndex, 1)
    origin.splice(index, 0, code); throw error
  }
}
export function returnCommitment(state, item) {
  if (item.destination !== 'origin' || !item.origin) return false
  storage(state, item.origin.seat, item.origin.host, true).push(item.code)
  return true
}

// A physical commitment can be retrieved before determining the result. The test reader
// removes its contribution/reward once; it must not also be discarded at test cleanup.
export function withdrawCommitment(state, seat, index) {
  const test = state.skillTest, inv = investigatorAt(state, seat)
  if (!test || !['ST.1', 'ST.2', 'ST.3', 'ST.4'].includes(test.stage) || !Number.isSafeInteger(index)) return false
  const item = test.committed?.[index]
  if (!item || item.seat !== seat || item.withdrawn || item.cancelled) return false
  item.withdrawn = true
  test.committed.splice(index, 1)
  test.value = (test.value || 0) - (item.icons || 0)
  inv.hand.push(item.code)
  return true
}
