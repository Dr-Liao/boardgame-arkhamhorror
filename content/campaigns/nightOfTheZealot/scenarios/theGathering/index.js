import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  layout, sharedIdentities: sharedEncounterIdentities,
  setAsideAliases: ['ghoulPriest', '01117'],
  requiredEncounterGroupIds: ['theGathering', 'rats', 'ghouls', 'strikingFear', 'ancientEvils', 'chillingCold'],
  recordWrites: ['houseBurned', 'ghoulPriestAlive', 'litaOwner', 'litaForcedOthers'],
  behaviorIds: [behavior.id],
})
