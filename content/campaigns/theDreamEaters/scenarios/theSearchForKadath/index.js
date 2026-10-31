import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'
import { SET_ASIDE_ALIASES } from './definition.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

// 剧本参考卡 06119 由 manifest.referenceCode 承载（不建单卡条目）。
export const REFERENCE_CODE = scenario.originalCode

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDreamEaters',
  // P8 阶段：章节可在开发态单独加载/自检，但战役启动仍要求对应模式全部章节确认。
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdeCampaign'], // 印刷包由 tdeCampaign 的 cardRanges 06039–06354 覆盖
  requiredEncounterGroupIds: [
    'theSearchForKadath', 'agentsOfNyarlathotep', 'corsairs', 'dreamlands', 'whispersOfHypnos', 'zoogs',
  ],
  requiredMechanicIds: [
    'tdeVeiled', 'tdeSwarming', 'tdeStoryAssets', 'tdeSignsOfTheGods', 'tdeDreamQuest', 'tdeChaos',
  ],
  // setup 放在一边的 12 张敌人（按印刷数量重复）。
  setAsideAliases: [...SET_ASIDE_ALIASES],
  setAsideLocations: scenario.setAsideLocations,
  recordReads: [
    'theInvestigatorsParleyedWithTheZoogs',
    'theInvestigatorsWereSavedByRandolphCarder',
    'theCatsCollectedTheirTributeFromTheZoogs',
    'theInvestigatorsForcedTheirWayIntoTheTemple',
  ],
  recordWrites: [
    'theInvestigatorsForcedTheirWayIntoTheTemple',
    'evidenceOfKadath',
    'wasCaptured',
    'hasBrokenTheLawOfUlthar',
    'virgilWasCaptured',
    'randolphEludedCapture',
    'randolphWasCaptured',
  ],
  behaviorIds: [behavior.id],
})

manifest.referenceCode = REFERENCE_CODE
manifest.contentVersion = '1.0.0'
