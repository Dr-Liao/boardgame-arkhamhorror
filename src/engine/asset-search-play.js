import { blockedByDeckTopLock } from './eote-investigator-support.js'
import { availableResources } from './resource-bank.js'
import { availablePlayResources } from './play-payment.js'

export function searchableAssetZones(state, inv, { discardLocked = false, zones = null } = {}) {
  return ['hand', ...(!discardLocked ? ['discard'] : []), ...(!blockedByDeckTopLock(state, inv) ? ['deck'] : [])]
    .filter(zone => !zones || zones.includes(zone))
}

export function playableAssetSearchChoices(state, inv, titles, options = {}) {
  const { cardDef, isWeaknessCard } = options
  const named = new Set(titles)
  const zones = searchableAssetZones(state, inv, options)
  return zones.flatMap(zone => [...new Set(inv[zone] || [])].flatMap(code => {
    const card = cardDef(code)
    if (card?.type !== 'asset' || !named.has(card.name) || isWeaknessCard(card)) return []
    const candidate = { zone, code }
    const allowed = options.canPlay ? options.canPlay(candidate, options)
      : (options.reservedResources || 0) <= availableResources(inv)
        && Math.max(0, card.cost || 0) + (options.reservedResources || 0) <= availablePlayResources(state, inv, card)
    return allowed ? [candidate] : []
  }))
}

export function canSearchPlayableAsset(state, inv, titles, options) {
  return playableAssetSearchChoices(state, inv, titles, options).length > 0
}
