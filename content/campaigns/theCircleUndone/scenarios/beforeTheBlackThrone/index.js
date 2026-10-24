import { scenario, identities, AZATHOTH } from './definition.js'
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
    'beforeTheBlackThrone', 'agentsOfAzathoth', 'inexorableFate', 'ancientEvils', 'pentagram',
  ],
  requiredMechanicIds: ['tcuCosmos', 'tcuChaos', 'tcuHaunted'],
  setAsideLocations: ['courtOfTheGreatOldOnes', 'theBlackThrone'],
  setAsideAliases: ['05088'],
  inPlayAliases: [AZATHOTH],
  recordReads: [
    'thePathWindsBeforeYou', 'youHaveAcceptedYourFate', 'youHaveRejectedYourFate', 'mementosDiscovered',
  ],
  recordWrites: [
    'azathothDevouredTheUniverse', 'theLeadInvestigatorHasJoinedThePipersOfAzathoth',
    'azathothSlumbersForNow', 'theInvestigatorsSignedTheBlackBookOfAzathoth',
    'theInvestigatorsReversedTheIncantation',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
