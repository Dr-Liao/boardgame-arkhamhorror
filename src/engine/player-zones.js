import { ALL_CARDS } from '../cards/cards-data.js'
import { cannotLeaveHand, registeredEntry } from './ability.js'
import { findBondedMain, bondedSetKey } from './bonded.js'

export function replacePlayerZoneCards(state, inv, codes, reason) {
  return codes.filter(code => {
    if (registeredEntry(code)?.zoneReplacement?.[reason] !== 'bonded') return true
    const related = Object.keys(state.bondedSets || {}).find(key => state.bondedSets[key].seat === inv.seat
      && ALL_CARDS[key.split('@')[0]]?.bondedCards?.some(card => card.code === code))
    const main = related?.split('@')[0] || findBondedMain(ALL_CARDS, code)
    if (!main) return true
    state.bondedSets ||= {}
    const set = state.bondedSets[bondedSetKey(state, main, inv.seat)] ||= { seat: inv.seat, cards: [], retrieved: true }
    set.cards.push(code)
    return false
  })
}

export function discardPlayerCards(state, inv, ...codes) {
  if (!inv) return 0
  // 2026-11-13 P1-16（09766）：不能离开手牌的牌即使被前置逻辑移出，也放回手牌而不进弃牌堆。
  const kept = []
  const discardable = []
  for (const code of codes) {
    if (cannotLeaveHand(code)) kept.push(code)
    else discardable.push(code)
  }
  for (const code of kept) inv.hand.push(code)
  return inv.discard.push(...replacePlayerZoneCards(state, inv, discardable, 'discard'))
}
