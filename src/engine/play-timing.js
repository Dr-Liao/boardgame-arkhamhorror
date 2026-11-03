import { registeredEntry } from './ability.js'
import { availableResources } from './resource-bank.js'
import { availableUseCost } from './use-transfer.js'
import { assetTextBlankedExceptForced } from './card-text.js'
export function playTimingCandidates(state, inv, card) {
  return inv.assets.flatMap(source => {
    const provider = registeredEntry(source.code)?.playTimingProvider
    if (!provider || assetTextBlankedExceptForced(source)) return []
    const spec = provider({ state, inv, card, source })
    if (!spec?.fast) return []
    if (spec.cost?.uses && availableUseCost(state, source, registeredEntry) < spec.cost.uses) return []
    if (spec.cost?.resources && availableResources(inv) < spec.cost.resources) return []
    if (spec.cost?.exhaust && source.exhausted) return []
    return [{ source, spec }]
  })
}
export const playTimingSource = (state, inv, card, id) => playTimingCandidates(state, inv, card).find(item => item.source.id === id) || null
