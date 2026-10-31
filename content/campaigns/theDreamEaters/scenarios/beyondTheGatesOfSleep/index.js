// 梦境门外（Beyond the Gates of Sleep · 06039）· 章节装配（照 theWitchingHour/index.js）。
//
// P8 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套）。
import { scenario, identities, SET_ASIDE_ALIASES, IN_PLAY_LOCATIONS } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDreamEaters',
  status: 'development',
  layout,
  requiredPackIds: ['core', 'tdeCampaign'], // 印刷包由 tdeCampaign 的 cardRanges 06039–06354 覆盖
  requiredEncounterGroupIds: [
    'beyondTheGatesOfSleep', 'agentsOfNyarlathotep', 'zoogs', 'dreamersCurse', 'dreamlands', 'chillingCold',
  ],
  requiredMechanicIds: ['tdeSwarming', 'tdeStoryAssets'],
  requiredInvestigatorIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: SET_ASIDE_ALIASES,
  inPlayAliases: [...IN_PLAY_LOCATIONS.map(id => scenario.locations[id]?.originalCode).filter(Boolean)],
  recordReads: [],
  recordWrites: [
    'theDreamersStrayedFromThePath', 'theInvestigatorsWereSavedByRandolphCarder',
    'theCatsCollectedTheirTributeFromTheZoogs', 'theInvestigatorsParleyedWithTheZoogs',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 06039：check-tde-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '06039'
