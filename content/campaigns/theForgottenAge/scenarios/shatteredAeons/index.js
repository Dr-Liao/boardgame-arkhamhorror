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
    'shatteredAeons', 'pnakoticBrotherhood', 'flux', 'ancientEvils', 'agentsOfYig',
  ],
  requiredMechanicIds: ['tfaExploration', 'tfaVengeance', 'tfaYigsFury', 'tfaRelicOfAges'],
  setAsideLocations: [
    'aPocketInTime', 'ruinsOfNewYork', 'mu', 'atlantis', 'pnakotus', 'valusia', 'plateauOfLeng',
  ],
  setAsideAliases: [
    '04343', '04325', '04326', '04337', '04322', '04323',
    '04102', '04102', '04102', '04102',
  ],
  recordReads: [
    'theBraziersAreLit',
    'theRelicIsMissing',
    'theInvestigatorsFoundTheMissingRelic',
    'ichtacaIsSetAgainstYou',
    'alejandroIsSetAgainstYou',
    'yigsFury',
  ],
  recordWrites: [
    'theInvestigatorsMendedTheTearInTheFabricOfTime',
    'theInvestigatorsSavedTheCivilizationOfTheSerpents',
    'theInvestigatorsSavedTheCivilizationOfTheYithians',
    'theFabricOfTimeIsUnwoven',
    'theInvestigatorsTurnedBackTime',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
