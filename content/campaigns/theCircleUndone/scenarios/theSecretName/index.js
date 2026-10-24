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
    'theSecretName', 'cityOfSins', 'inexorableFate', 'realmOfDeath', 'witchcraft', 'rats',
  ],
  requiredMechanicIds: [
    'tcuChaos', 'tcuHaunted', 'tcuSpectral', 'tcuMemento', 'tcuCampaignAssets', 'tcuCosmos',
  ],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: ['05149', '05148', '05150', '05144', '05144'],
  recordReads: [
    'theInvestigatorsAreMembersOfTheLodge', 'theInvestigatorsAreEnemiesOfTheLodge',
    'theInvestigatorsLearnedNothingOfTheLodgesSchemes', 'theInvestigatorsAreNeverSeenOrHeardFromAgain',
  ],
  recordWrites: [
    'theInvestigatorsToldTheLodgeAboutTheCoven', 'theInvestigatorsHidTheirKnowledgeOfTheCoven',
    'mementosDiscovered',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
