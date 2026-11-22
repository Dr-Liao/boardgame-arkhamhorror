import { assetTextBlanked, assetTextBlankedExceptForced } from './card-text.js'

// Optional histories are kept only for investigators whose cards read them.
export function tracksHistory(state, inv, key, registeredEntry) {
  const codes = [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || []),
    ...(inv.assets || []).map(card => card.code), ...(inv.threat || []).map(card => card.code),
    ...(state.campaign?.investigators?.[inv.seat]?.deck || [])]
  return codes.some(code => registeredEntry(typeof code === 'string' ? code : code.code)?.[key])
}

export function performedActionKinds(move, kind, registeredEntry) {
  const kinds = [kind]
  if (move.action === 'ability' || move.action === 'entityAbility') kinds.push('activate')
  if (move.action === 'play') {
    const played = registeredEntry?.(move.copyCode || move.cardId)?.abilities.find(descriptor => descriptor.kind === 'played')
    kinds.push(...(played?.additionalActionKinds || []), 'play')
  }
  return [...new Set(kinds)]
}

export function recordPerformedAction(state, inv, move, kind, registeredEntry) {
  if (['draw', 'resource'].includes(kind)) recordRoundAction(state, inv, 'actions', kind, registeredEntry)
  if (!state.investigators.some(owner => tracksHistory(state, owner, 'trackActionHistory', registeredEntry))) return []
  if (inv.actionHistory?.turn !== state.turnSerial) inv.actionHistory = { turn: state.turnSerial, entries: [] }
  const current = performedActionKinds(move, kind, registeredEntry)
  const previous = inv.actionHistory.entries.at(-1) || []
  inv.actionHistory.entries.push(current)
  return current.filter(value => previous.includes(value))
}

export function firstActionExemptsOpportunityAttack(state, inv, kind, registeredEntry) {
  if (!inv.assets.some(asset => registeredEntry(asset.code)?.assetRule?.firstActionNoAoO === kind
    && !assetTextBlanked(asset, inv) && !assetTextBlankedExceptForced(asset))) return false
  return inv.actionHistory?.turn !== state.turnSerial || !inv.actionHistory.entries.some(types => types.includes(kind))
}

export function recordRoundAction(state, inv, category, kind, registeredEntry) {
  const ownHistory = tracksHistory(state, inv, 'trackRoundActionHistory', registeredEntry)
  const trackShared = category === 'opportunityAttacks'
    && state.investigators.some(owner => tracksHistory(state, owner, 'trackRoundActionHistory', registeredEntry))
  if (!ownHistory && !trackShared) return
  if (inv.roundActionHistory?.round !== state.round) {
    inv.roundActionHistory = { round: state.round, actions: [], successes: [], enemyDraws: 0 }
  }
  if (category === 'enemyDraws' || category === 'opportunityAttacks') {
    inv.roundActionHistory[category] = (inv.roundActionHistory[category] || 0) + 1
  } else inv.roundActionHistory[category].push(kind)
}

export function roundActionCount(state, inv, kind) {
  const history = inv.roundActionHistory
  return history?.round === state.round ? history.actions.filter(item => item === kind).length : 0
}

export function recordRegulatedAction(state, inv, kind, registeredEntry) {
  if (inv.assets.some(asset => registeredEntry(asset.code)?.assetRule?.regulationAction === kind)) {
    recordRoundAction(state, inv, 'actions', kind, registeredEntry)
  }
}

export function trackTestAssetSource(state, inv, registeredEntry) {
  return registeredEntry(inv.code)?.campaignDeck?.trackTestAssetSource === true
    || state.investigators.some(owner => tracksHistory(state, owner, 'trackTestAssetSource', registeredEntry))
}

export function defeatedHealthThisTurn(state, inv) {
  return inv.defeatedHealthHistory?.turn === state.turnSerial ? inv.defeatedHealthHistory.total : 0
}

export function defeatedPrintedHealthThisTurn(state, inv) {
  return inv.defeatedPrintedHealthHistory?.turn === state.turnSerial ? inv.defeatedPrintedHealthHistory.total : 0
}

export function roundPlayRules(state, registeredEntry) {
  return Object.entries(state.scenario?.locations || {}).map(([id, location]) =>
    registeredEntry(location.originalCode || location.code || id)?.locationRule?.firstMatchingTraitOfRound).filter(Boolean)
}

export function recordPlayedCard(state, inv, card, registeredEntry) {
  recordRegulatedAction(state, inv, 'play', registeredEntry)
  const trackAsset = registeredEntry(inv.code)?.investigator?.firstAssetOfRound && card.type === 'asset'
  if (!trackAsset && !roundPlayRules(state, registeredEntry).length) return
  if (inv.playedCardsHistory?.round !== state.round) inv.playedCardsHistory = { round: state.round, traits: [] }
  inv.playedCardsHistory.traits.push(...(card.traits || []).map(trait => trait.toLowerCase()))
  if (trackAsset) {
    const traits = inv.playedCardsHistory.assetTraits ||= []
    traits.push(...(card.traits || []).map(trait => trait.toLowerCase()))
  }
}

export function firstAssetDiscount(state, inv, definition, registeredEntry) {
  const rule = registeredEntry(inv.code)?.investigator?.firstAssetOfRound
  if (!rule || definition.type !== 'asset') return 0
  const trait = rule.trait.toLowerCase()
  if (!definition.traits?.some(value => value.toLowerCase() === trait)) return 0
  return inv.playedCardsHistory?.round === state.round && inv.playedCardsHistory.assetTraits?.includes(trait) ? 0 : rule.amount
}
