import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'thePathToCarcosa',
  status: 'verified',
  layout,
  requiredPackIds: ['core', 'carcosaCampaign'],
  requiredEncounterGroupIds: [
    'curtainCall', 'evilPortents', 'delusions', 'hauntings',
    'cultOfTheYellowSign', 'strikingFear', 'rats',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaChaosEffects', 'curtainCallHazards'],
  setAsideAliases: ['03059', '03060'],
  recordWrites: [
    'theStrangerIsOnToYou', 'chasingTheStranger', 'youTriedToWarnThePolice',
    'thePoliceAreSuspiciousOfYou', 'youChoseNotToGoToThePolice', 'doubt', 'conviction',
    'pallidMaskBearer',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
