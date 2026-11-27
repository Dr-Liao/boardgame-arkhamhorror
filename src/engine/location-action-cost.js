import { locationRuleFor } from '../cards/card-rules.js'
import { investigatorsAt } from './matcher.js'
import { availableResources, spendFromPool } from './resource-bank.js'

function ownsSupply(state, seat, name) {
  return state.campaign?.supplies?.[seat]?.includes(name)
}

export function hasLocalSupply(state, inv, name, hasSupply = ownsSupply, locationId = inv.location) {
  return investigatorsAt(state, locationId).some(owner => hasSupply(state, owner.seat, name))
    || (locationId !== inv.location && !inv.defeated && !inv.resigned && Boolean(hasSupply(state, inv.seat, name)))
}

function supplyActionCost(state, inv, action, locationId) {
  const location = state.locations.find(item => item.id === locationId)
  const cost = locationRuleFor(location?.originalCode || location?.code)?.supplyActionCost
  if (!cost?.actions.includes(action) || hasLocalSupply(state, inv, cost.unlessSupply, ownsSupply, locationId)) return null
  return cost
}

export function locationActionResourceCost(state, inv, action, locationId = inv.location) {
  const supply = supplyActionCost(state, inv, action, locationId)?.resources || 0
  const location = state.locations.find(item => item.id === locationId)
  const rule = locationRuleFor(location?.originalCode || location?.code)
  return supply + (action === 'investigate' ? (Number(rule?.investigateResourceCost) || 0) : 0)
}

export function locationExploreExtraActions(state, inv) {
  return supplyActionCost(state, inv, 'explore', inv.location)?.extraActions || 0
}

export function abilityLocationResourceCost(state, inv, descriptor, effect = descriptor?.effect, locationId = inv.location) {
  const action = descriptor?.actionKind || descriptor?.countsAs || effect?.type
  if (action === 'investigateForResources') return locationActionResourceCost(state, inv, 'investigate', locationId)
  if (action !== 'investigate' && action !== 'explore') return 0
  return locationActionResourceCost(state, inv, action, locationId)
}

export function payLocationActionCost(state, inv, action, requestChoice) {
  const cost = locationActionResourceCost(state, inv, action)
  if (availableResources(inv) < cost) return false
  if (cost) spendFromPool(inv, cost, state, requestChoice)
  return true
}
