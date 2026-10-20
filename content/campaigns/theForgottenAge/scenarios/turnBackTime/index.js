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
    'turnBackTime', 'theDoomOfEztli', 'agentsOfYig', 'venom', 'flux', 'traps', 'ruins',
    'poison', 'chillingCold',
  ],
  requiredMechanicIds: [
    'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoisoned', 'tfaRelicOfAges',
    'tfaYigsFury',
  ],
  setAsideLocations: ['chamberOfTime'],
  setAsideAliases: ['04061', '04062', '04296', '04102', '04102', '04102', '04102'],
  recordReads: [
    'theInvestigatorsWereForcedToWaitForAdditionalSupplies',
    'theInvestigatorsClearedAPathToTheEztliRuins',
    'theInvestigatorsRecruitedTheHelpOfAnotherExpedition',
    'theInvestigatorsTurnedBackTime',
    'theInvestigatorsFellIntoTheDepths',
    'theNexusIsNear',
    'theBraziersAreLit',
    'theBraziersRemainUnlit',
    'yigsFury',
  ],
  recordWrites: [
    'theFabricOfTimeIsUnwoven',
    'theInvestigatorsSealedTheRelicOfAgesForever',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 迁移账本要求每个已迁移章节保留真实剧本卡号（scenarioManifest 目前不产出该字段）。
manifest.referenceCode = scenario.originalCode
