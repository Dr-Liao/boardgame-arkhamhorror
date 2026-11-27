import { registeredEntry } from './ability.js'
import { discardPlayerCards } from './player-zones.js'
import { hasWindowListener } from './window-listeners.js'
import { reactionSource } from './reaction-source.js'

export function discardPlayerCardWithWindow(state, inv, code, from, events, reactionWindow) {
  if (!code) return false
  const context = { when: 'wouldDiscardPlayerCard', seat: inv.seat, location: inv.location, from, cardCode: code, source: reactionSource(state), discardDestination: null }
  if (hasWindowListener(state, 'wouldDiscardPlayerCard')) {
    reactionWindow(state, 'wouldDiscardPlayerCard', context, events, { allowNested: true })
  }
  if (context.discardDestination === 'deckTop') {
    inv.deck.push(code)
    return false
  }
  discardPlayerCards(state, inv, code)
  if (from === 'deck' && registeredEntry(code)?.abilities?.some(ability => ability.trigger.includes('deckCardDiscarded'))) {
    reactionWindow(state, 'deckCardDiscarded', { ...context, when: 'deckCardDiscarded' }, events, { allowNested: true })
  }
  return true
}
