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
    'theUntamedWilds', 'wilds', 'rainforest', 'serpents', 'expedition',
    'guardiansOfTime', 'agentsOfYig', 'poison',
  ],
  requiredMechanicIds: ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoisoned'],
  setAsideLocations: ['ruinsOfEztli', 'templeOfTheFang', 'overgrownRuins'],
  setAsideAliases: ['04051', '04052', '04102', '04102', '04102', '04102'],
  recordReads: [
    'theInvestigatorsWereForcedToWaitForAdditionalSupplies', 'ichtacaObservedYourProgressWithKeenInterest',
    'alejandroFollowedTheInvestigatorsIntoTheRuins', 'ichtacaIsWaryOfTheInvestigators',
    'theInvestigatorsHaveEarnedIchtacasTrust', 'alejandroChoseToRemainAtCamp',
    'theInvestigatorsClearedAPathToTheEztliRuins',
  ],
  recordWrites: [
    'theInvestigatorsWereForcedToWaitForAdditionalSupplies', 'ichtacaObservedYourProgressWithKeenInterest',
    'alejandroFollowedTheInvestigatorsIntoTheRuins', 'ichtacaIsWaryOfTheInvestigators',
    'theInvestigatorsHaveEarnedIchtacasTrust', 'alejandroChoseToRemainAtCamp',
    'theInvestigatorsClearedAPathToTheEztliRuins',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
