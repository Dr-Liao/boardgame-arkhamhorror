import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign'],
  requiredEncounterGroupIds: [
    'theWitchingHour', 'anettesCoven', 'cityOfSins', 'witchcraft', 'ancientEvils', 'strikingFear',
  ],
  requiredMechanicIds: ['tcuChaos', 'tcuTarot'],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: ['05057'],
  recordReads: [],
  recordWrites: [
    'youHaveAcceptedYourFate', 'youHaveRejectedYourFate', 'theWitchesSpellWasBroken',
    'theWitchesSpellWasCast', 'erynnWantsToMeet', 'mementosDiscovered',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
