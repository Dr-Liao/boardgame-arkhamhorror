import { shuffle } from '../deck/deckbuilding.js'
import { syncPassiveDeckTop } from './eote-investigator-support.js'
import { replacePlayerZoneCards } from './player-zones.js'
import { nextInstanceId, randomValue } from './rules-state.js'

export function revealTopForSharedPlay(state, ownerSeat) {
  const owner = state.investigators[ownerSeat]
  const code = owner?.deck.pop()
  if (!code) return null
  const card = { id: nextInstanceId(state, 'c'), code, ownerSeat }
  ;(state.sharedPlayCards ||= []).push(card)
  syncPassiveDeckTop(state, ownerSeat, { force: true })
  return card
}

export function returnSharedPlayCards(state) {
  if (!state.sharedPlayCards) return
  const cards = state.sharedPlayCards
  delete state.sharedPlayCards
  for (const owner of state.investigators) {
    const codes = cards.filter(card => card.ownerSeat === owner.seat).map(card => card.code)
    if (!codes.length) continue
    owner.deck = replacePlayerZoneCards(state, owner, shuffle([...owner.deck, ...codes], () => randomValue(state)), 'shuffle')
    syncPassiveDeckTop(state, owner.seat, { force: true })
  }
}

export function sharedPlayOwner(state, inv, code) {
  const transfer = state._playedUnderControl
  if (transfer?.seat !== inv.seat || transfer.code !== code) return inv
  return state.investigators[transfer.fromSeat] || inv
}
