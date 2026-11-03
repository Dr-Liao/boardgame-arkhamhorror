import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { bondedCardList, bondedSetKey } from './bonded.js'

export function bondedPlayCostAvailable(state, inv, code) {
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!rule) return true
  const main = rule.main || code
  const set = state.bondedSets?.[bondedSetKey(state, main, inv.seat)]
  const allowed = bondedCardList(ALL_CARDS[main])
  const count = set ? set.cards.filter(code => allowed.some(copy => copy.code === code)).length
    : allowed.reduce((sum, copy) => sum + copy.count, 0)
  return count >= rule.count
}

export function preparePlayAttempt(state, inv, code, events, deps, discount = 0) {
  const active = state._prePlayAttempt
  if (active?.seat === inv.seat && active.cardCode === code) return active
  const context = { when: 'beforePlayAttempt', seat: inv.seat, location: inv.location,
    cardCode: code, cost: Math.max(0, deps.playCost(state, inv, deps.cardDef(code)) - discount), costReduction: 0 }
  if (inv.assets.some(asset => registeredEntry(asset.code)?.abilities.some(descriptor => descriptor.trigger.includes('beforePlayAttempt')))) {
    deps.reactionWindow(state, 'beforePlayAttempt', context, events, { allowNested: true })
  }
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!context.cancelled && rule) {
    if (!bondedPlayCostAvailable(state, inv, code)) return { ...context, cancelled: true }
  }
  return context
}

export function payBondedPlayCost(state, inv, code, deps) {
  const rule = registeredEntry(code)?.bondedShufflePlayCost
  if (!rule) return true
  if (!bondedPlayCostAvailable(state, inv, code)) return false
    const main = rule.main || code
    const copies = bondedCardList(ALL_CARDS[main])
    state.bondedSets ||= {}
    const key = bondedSetKey(state, main, inv.seat)
    const set = state.bondedSets[key] ||= { seat: inv.seat,
      cards: copies.flatMap(copy => Array(copy.count).fill(copy.code)), retrieved: false }
    const taken = []
    for (let i = set.cards.length - 1; i >= 0 && taken.length < rule.count; i--) {
      if (copies.some(copy => copy.code === set.cards[i])) taken.push(set.cards.splice(i, 1)[0])
    }
    set.retrieved = true
    inv.deck = deps.shuffle([...inv.deck, ...taken], () => deps.randomValue(state))
  return true
}
