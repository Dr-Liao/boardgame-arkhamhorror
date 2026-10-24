import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theCircleUndone',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tcuCampaign', 'notz'],
  requiredEncounterGroupIds: [
    'inTheClutchesOfChaos', 'agentsOfAzathoth', 'nightgaunts',
    'musicOfTheDamned', 'anettesCoven', 'cityOfSins', 'witchcraft',
    'secretsOfTheUniverse', 'silverTwilightLodge', 'strikingFear',
  ],
  requiredMechanicIds: ['tcuBreaches', 'tcuChaos'],
  setAsideAliases: ['05088'],
  recordReads: [
    'anetteMasonIsPossessedByEvil', 'carlSanfordPossessesTheSecretsOfTheUniverse',
    'theInvestigatorsAreNeverSeenOrHeardFromAgain',
  ],
  recordWrites: [
    'theInvestigatorsContinuedAlone', 'theInvestigatorsAskedAnetteForAssistance',
    'theInvestigatorsArrestedAnette', 'anetteTaughtYouTheSpellsOfOld',
    'theInvestigatorsAskedSanfordForAssistance', 'theInvestigatorsArrestedSanford',
    'theInvestigatorsAssumedControlOfTheSilverTwilightLodge', 'doomDrawsEverCloser',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
