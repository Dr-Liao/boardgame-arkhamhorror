import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  layout, sharedIdentities: sharedEncounterIdentities,
  setAsideAliases: ['theMaskedHunter'],
  requiredEncounterGroupIds: ['theMidnightMasks', 'chillingCold', 'darkCult', 'nightgaunts', 'lockedDoors'],
  recordReads: ['houseBurned', 'ghoulPriestAlive'],
  recordWrites: ['cultistsInterrogated', 'cultistsEscaped', 'ghoulPriestAlive', 'pastMidnight'],
  behaviorIds: [behavior.id],
})
