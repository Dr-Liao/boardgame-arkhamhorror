// Optional histories are kept only for investigators whose cards read them.
export function tracksHistory(state, inv, key, registeredEntry) {
  const codes = [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || []),
    ...(inv.assets || []).map(card => card.code), ...(state.campaign?.investigators?.[inv.seat]?.deck || [])]
  return codes.some(code => registeredEntry(typeof code === 'string' ? code : code.code)?.[key])
}

export function performedActionKinds(move, kind) {
  const kinds = [kind]
  if (move.action === 'ability' || move.action === 'entityAbility') kinds.push('activate')
  if (move.action === 'play') kinds.push('play')
  return [...new Set(kinds)]
}

export function recordPerformedAction(state, inv, move, kind, registeredEntry) {
  if (!state.investigators.some(owner => tracksHistory(state, owner, 'trackActionHistory', registeredEntry))) return []
  if (inv.actionHistory?.turn !== state.turnSerial) inv.actionHistory = { turn: state.turnSerial, entries: [] }
  const current = performedActionKinds(move, kind)
  const previous = inv.actionHistory.entries.at(-1) || []
  inv.actionHistory.entries.push(current)
  return current.filter(value => previous.includes(value))
}

export function defeatedHealthThisTurn(state, inv) {
  return inv.defeatedHealthHistory?.turn === state.turnSerial ? inv.defeatedHealthHistory.total : 0
}

export function roundPlayRules(state, registeredEntry) {
  return Object.entries(state.scenario?.locations || {}).map(([id, location]) =>
    registeredEntry(location.originalCode || location.code || id)?.locationRule?.firstMatchingTraitOfRound).filter(Boolean)
}

export function recordPlayedCard(state, inv, card, registeredEntry) {
  if (!roundPlayRules(state, registeredEntry).length) return
  if (inv.playedCardsHistory?.round !== state.round) inv.playedCardsHistory = { round: state.round, traits: [] }
  inv.playedCardsHistory.traits.push(...(card.traits || []).map(trait => trait.toLowerCase()))
}
