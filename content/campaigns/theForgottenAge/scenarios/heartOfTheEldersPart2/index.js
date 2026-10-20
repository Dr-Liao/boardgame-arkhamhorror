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
    'knyan', 'sharedHeartOfTheElders', 'agentsOfYig', 'venom', 'ruins', 'traps', 'poison',
  ],
  requiredMechanicIds: ['tfaExploration', 'tfaSupplies', 'tfaPoisoned', 'tfaVengeance'],
  // 放在一边：深入幽嘶（地点，按原卡号登记，避免被移动行动直接放下场）、
  // 战役敌人瓦卢西亚的预示者、未进入牌组的中毒弱点。
  setAsideAliases: ['04227', '04062', '04102', '04102', '04102', '04102'],
  recordReads: [
    'theJungleWatches', 'yigsFury', 'theHarbingerIsStillAlive', 'theInvestigatorsRescuedAlejandro',
  ],
  recordWrites: ['yigsFury', 'theHarbingerIsStillAlive'],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
