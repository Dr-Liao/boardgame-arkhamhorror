import { ALL_CARDS } from '../cards/cards-data.js'
import { registeredEntry } from './ability.js'
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
  return inv.discard.push(...replacePlayerZoneCards(state, inv, codes, 'discard'))
}
