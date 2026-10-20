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
    'heartOfTheEldersPart1', 'pillarsOfJudgment', 'sharedHeartOfTheElders',
    'rainforest', 'serpents', 'expedition', 'poison',
  ],
  requiredMechanicIds: ['tfaExploration', 'tfaSupplies', 'tfaPoisoned', 'tfaVengeance'],
  // 04 102 中毒弱点（4 张，按调查员牌组占用数动态放在一边）与 04 209b 羽翼蛇族
  // 都不进遭遇牌库：前者放在一边，后者由场景 1 推进带出。
  setAsideAliases: ['04102', '04102', '04102', '04102', '04209b'],
  recordReads: [
    'pathsAreKnownToYou', 'theInvestigatorsMappedOutTheWayForward',
  ],
  recordWrites: [
    'pathsAreKnownToYou', 'theJungleWatches', 'yigsFury',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
