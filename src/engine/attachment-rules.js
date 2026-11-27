import { registeredEntry } from './ability.js'
import { assetTextBlanked } from './card-text.js'

export function attachmentTextBlanked(state, card) {
  return (card?.textBlankTurn != null && card.textBlankTurn === (state.turnSerial ?? 0))
    || (card?.textBlankRound != null && card.textBlankRound === state.round)
}

export function liveLocationAttachmentRules(state, locationId) {
  const location = state.locations?.find(item => item.id === locationId)
  return (location?.attachments || []).filter(card => !attachmentTextBlanked(state, card))
    .map(card => registeredEntry(card.originalCode || card.code)?.treacheryRule).filter(Boolean)
}

export function attachmentPreventsReady(state, card) {
  return (card?.attachments || []).some(attachment => !attachmentTextBlanked(state, attachment)
    && registeredEntry(attachment.originalCode || attachment.code)?.treacheryRule?.preventsHostReady === true)
}

export function attachedAbilityCards(inv) {
  return (inv.assets || []).flatMap(asset => (asset.attachments || []).filter(source =>
    !source.assetReference && source.ownerSeat === inv.seat
    && registeredEntry(source.code)?.abilities.some(({ kind }) => kind === 'free' || kind === 'action')))
}

export function attachmentIgnoresOpportunityAttack(state, inv, move) {
  if (move.action !== 'ability') return false
  const host = (state.investigators[move.ownerSeat ?? inv.seat]?.assets || []).find(asset => asset.id === move.assetId)
  return (host?.attachments || []).some(source => {
    if (source.assetReference || assetTextBlanked(source, inv)) return false
    return registeredEntry(source.code)?.assetRule?.hostIgnoresOpportunityAttack?.({ state, inv, source, host }) === true
  })
}
