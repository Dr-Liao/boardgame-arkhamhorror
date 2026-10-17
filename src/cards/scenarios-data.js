// Compatibility exports for existing rules, tests and saved scenarios.
// New content is registered through content/registry.js.
export { DIFFICULTIES, CHAOS_BAGS, SYMBOL_DEFAULTS } from '../../content/campaigns/nightOfTheZealot/shared.js'
import { scenario as gathering, identities as gatheringIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { scenario as masks, identities as masksIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/definition.js'
import { scenario as devourer, identities as devourerIdentities } from '../../content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/definition.js'
export { CAMPAIGN } from '../../content/campaigns/nightOfTheZealot/manifest.js'
export const SCENARIOS = Object.freeze({ theGathering: gathering, theMidnightMasks: masks, theDevourerBelow: devourer })
export const SCENARIO_CARD_IDENTITIES = Object.freeze({ theGathering: gatheringIdentities, theMidnightMasks: masksIdentities, theDevourerBelow: devourerIdentities })
