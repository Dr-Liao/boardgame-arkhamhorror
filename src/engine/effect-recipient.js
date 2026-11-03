import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'

const failureScopes = new WeakMap()
export function withFailureRecipient(state, fromSeat, toSeat, resolve) {
  if (toSeat == null || toSeat === fromSeat) return resolve()
  const previous = failureScopes.get(state)
  failureScopes.set(state, { fromSeat, toSeat })
  try { return resolve() }
  finally {
    if (previous) failureScopes.set(state, previous)
    else failureScopes.delete(state)
  }
}
export function effectRecipient(state, inv) {
  const redirect = failureScopes.get(state)
  return redirect && inv?.seat === redirect.fromSeat ? state.investigators[redirect.toSeat] : inv
}

export function playerEffectCanAffect(state, targetSeat, { sourceSeat = state._resolvingSeat, sourceCode = state._resolvingCardCode } = {}) {
  if (sourceSeat == null || sourceSeat === targetSeat || !['asset','event','skill','investigator'].includes(ALL_CARDS[sourceCode]?.type)) return true
  return !state.investigators[sourceSeat]?.threat.some(card => registeredEntry(card.code)?.cannotAffectOtherInvestigators)
}

const SEAT_EFFECTS = new Set(['healDamage','healHorror','gainResources','loseResources','spendResources','drawCards',
  'drawCardsLogged','discardFromHand','checkHandSizeNow','bankResources','withdrawBanked','spendBanked','returnClueToLocation',
  'drawEncounter','endTurn','discardTopOfDeck','investigate','fight','evade','move','relocateInvestigator',
  'loseActions','gainActions','grantActions','addScenarioXpBonus','mill','searchDeck','searchTop','lookAt','loseClues',
  'moveTo','moveInvestigator','substituteSkill',
  'returnToHand','putIntoDiscard','playCard','setResources','setClues','setActions','resign'])
export function wrapInvestigatorEffects(state, api) {
  for (const key of SEAT_EFFECTS) if (typeof api[key] === 'function') {
    const original = api[key]
    api[key] = (seat, ...args) => {
      const recipient = effectRecipient(state, state.investigators[seat])
      if (recipient && !playerEffectCanAffect(state, recipient.seat)) return false
      return original(recipient?.seat ?? seat, ...args)
    }
  }
  api.canAffectInvestigator = seat => playerEffectCanAffect(state, seat)
  for (const key of ['choose','choice']) if (typeof api[key] === 'function') {
    const original = api[key]
    api[key] = request => original({ ...request,
      seat: effectRecipient(state, state.investigators[request.seat])?.seat ?? request.seat })
  }
  return api
}
