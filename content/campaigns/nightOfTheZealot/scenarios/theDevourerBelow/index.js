import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { sharedEncounterIdentities } from '../../../../packs/shared-identities.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  layout, sharedIdentities: sharedEncounterIdentities,
  setAsideAliases: ['umordhoth'],
  requiredEncounterGroupIds: ['theDevourerBelow', 'ghouls', 'strikingFear', 'ancientEvils', 'darkCult'],
  recordReads: ['cultistsEscaped', 'pastMidnight', 'ghoulPriestAlive', 'litaOwner'],
  recordWrites: ['succumbedToUmordhoth', 'ritualBroken', 'repelledUmordhoth', 'sacrificedLita'],
  behaviorIds: [behavior.id],
})
