import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tfaCampaign'],
  requiredEncounterGroupIds: [
    'theDoomOfEztli', 'agentsOfYig', 'venom', 'flux', 'traps', 'ruins', 'poison', 'chillingCold',
  ],
  requiredMechanicIds: ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoisoned', 'tfaRelicOfAges'],
  setAsideLocations: ['chamberOfTime'],
  setAsideAliases: ['04061', '04062', '04102', '04102', '04102', '04102'],
  recordReads: [
    'theInvestigatorsWereForcedToWaitForAdditionalSupplies', 'theInvestigatorsRecoveredTheRelicOfAges',
    'alejandroRecoveredTheRelicOfAges', 'yigsFury',
  ],
  recordWrites: [
    'theInvestigatorsRecoveredTheRelicOfAges', 'alejandroRecoveredTheRelicOfAges',
    'theHarbingerIsStillAlive', 'yigsFury',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
