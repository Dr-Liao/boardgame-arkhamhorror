import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tfaCampaign'],
  requiredEncounterGroupIds: [
    'theDepthsOfYoth', 'agentsOfYig', 'venom', 'expedition', 'ruins', 'poison',
  ],
  requiredMechanicIds: [
    'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaYigsFury', 'tfaPoisoned', 'tfaRelicOfAges',
  ],
  // 4 处地点由布置随机挑选放在一边，无法静态声明；一边的固定内容只剩遗物、中毒与敌人。
  setAsideLocations: [],
  setAsideAliases: [
    '04062', '04296', '04303', '04102', '04102', '04102', '04102',
  ],
  recordReads: [
    'yigsFury', 'theHarbingerIsStillAlive', 'youAreForgingYourOwnWay', 'ichtacasFaithIsRestored',
    'ichtacaIsSetAgainstYou', 'theRelicIsMissing', 'theInvestigatorsFoundTheMissingRelic',
  ],
  recordWrites: [
    'yigsFury', 'theHarbingerIsStillAlive', 'ichtacaIsSetAgainstYou',
    'theInvestigatorsFoundTheMissingRelic', 'theRelicIsMissing',
    'theInvestigatorsFellIntoTheDepths', 'theNexusIsNear',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
