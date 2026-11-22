import { mechanicState, investigatorAt } from './mechanic-state.js'
import { registeredEntry } from './ability.js'
import { splicePlayerDiscard } from './player-zones.js'
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
export function storeBeneath(state, seat, host, code, { from = 'hand', capacity = Infinity } = {}) {
  const inv = investigatorAt(state, seat)
  if (!['hand', 'deck', 'discard'].includes(from)) throw new TypeError('无效卡牌来源区')
  if (capacity !== Infinity && (!Number.isSafeInteger(capacity) || capacity < 0)) throw new TypeError('无效暗置区容量')
  const index = inv[from]?.indexOf(code) ?? -1
  if (index < 0 || storage(state, seat, host).length >= capacity) return false
  const cards = storage(state, seat, host, true)
  inv[from].splice(index, 1); cards.push(code)
  return true
}
export function swapBeneathWithHand(state, seat, host, beneathCode, handCode) {
  const inv = investigatorAt(state, seat)
  const pile = storage(state, seat, host)
  const beneathIndex = pile.indexOf(beneathCode)
  const handIndex = inv.hand.indexOf(handCode)
  if (beneathIndex < 0 || handIndex < 0) return false
  pile[beneathIndex] = handCode
  inv.hand[handIndex] = beneathCode
  return true
}

export function stashBeneath(state, seat, host, code, capacity) {
  if (storage(state, seat, host).length >= capacity) return false
  storage(state, seat, host, true).push(code)
  return true
}

export function pullBeneath(state, seat, host, code, index = null) {
  const pile = storage(state, seat, host)
  const at = index != null && pile[index] === code ? index : pile.indexOf(code)
  return at < 0 ? null : pile.splice(at, 1)[0]
}

export function takeBeneath(state, seat, host, code, destination = 'hand') {
  if (!['hand', 'discard', 'deck'].includes(destination)) throw new TypeError('无效卡牌目的区')
  const cards = storage(state, seat, host), index = cards.indexOf(code)
  if (index < 0) return false
  cards.splice(index, 1); investigatorAt(state, seat)[destination].push(code)
  return true
}
// The caller supplies the existing commit API so eligibility, costs, icons and windows have one reader.
export function commitFromOrigin(state, seat, { host = null, code, from = 'beneath', retain = false,
  ignoreAdditionalCosts = false, ownerSeat = seat, returnToOwnerDeckBottom = false }, commit) {
  const inv = investigatorAt(state, seat)
  const owner = investigatorAt(state, ownerSeat)
  if (ownerSeat !== seat && (from !== 'discard' || !returnToOwnerDeckBottom)) throw new Error('借用弃牌堆卡牌必须指定归还去向')
  const origin = from === 'beneath' ? storage(state, seat, host) : from === 'discard' ? owner.discard : null
  if (!origin) throw new TypeError('无效投入来源')
  const index = origin.indexOf(code)
  if (index < 0 || !state.skillTest) return false
  if (typeof commit !== 'function') throw new TypeError('需要权威投入入口')
  // Borrow to hand only inside the resolution transaction. Failure restores the exact source index.
  const deferred = from === 'discard' ? owner.deferredEventReturns?.filter(item => item.index === index) : null
  const restore = () => {
    if (from === 'discard') {
      splicePlayerDiscard(owner, index, 0, code)
      if (deferred?.length) (owner.deferredEventReturns ||= []).push(...deferred)
    } else origin.splice(index, 0, code)
  }
  if (from === 'discard') splicePlayerDiscard(owner, index, 1)
  else origin.splice(index, 1)
  const handIndex = inv.hand.length
  inv.hand.push(code)
  try {
    const item = commit(seat, code, { ignoreAdditionalCosts, syntheticHand: true,
      ...(returnToOwnerDeckBottom ? { handIndex } : {}) })
    if (!item) {
      inv.hand.splice(handIndex, 1)
      restore()
      return false
    }
    if (retain && from === 'beneath') { item.destination = 'origin'; item.origin = { seat, host } }
    if (retain && from === 'discard') item.destination = 'hand'
    if (returnToOwnerDeckBottom) item.returnToOwnerDeckBottom = ownerSeat
    return item
  } catch (error) {
    if (inv.hand[handIndex] === code) inv.hand.splice(handIndex, 1)
    restore()
    throw error
  }
}
export function returnCommitment(state, item) {
  if (Number.isSafeInteger(item.returnToOwnerDeckBottom)) {
    investigatorAt(state, item.returnToOwnerDeckBottom).deck.unshift(item.code)
    return true
  }
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
  if (Number.isSafeInteger(item.returnToOwnerDeckBottom)) (test.borrowedReturns ||= []).push(item)
  else inv.hand.push(item.code)
  return true
}
