// 万千骇形（aThousandShapesOfHorror）· 章节装配（照 TCU theWitchingHour/index.js 的形状）。
// P8 章节 status='development'：引擎只把 playable/verified 的章节装进 SCENARIOS，测试直接 import 本章模块。
import { scenario, identities } from './definition.js'
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
    'aThousandShapesOfHorror', 'creaturesOfTheUnderworld', 'mergingRealities',
    'chillingCold', 'ghouls', 'lockedDoors', 'rats',
  ],
  requiredMechanicIds: ['tdeChaos', 'tdeSwarming', 'tdeStoryAssets'],
  setAsideLocations: scenario.setAsideLocations,
  // 非地点的「放在一边」卡：不可名状之物 ×1、银钥匙 ×1、无尽深入 ×4（index.js 按张数登记）。
  setAsideAliases: [
    '06169b',
    '06189',
    '06190', '06190', '06190', '06190',
  ],
  recordReads: ['theBlackCatIsAtYourSide'],
  recordWrites: [
    'randolphSurvivedTheDescent', 'randolphDidNotSurviveTheDescent', 'theInvestigatorsPossessTheSilverKey',
  ],
  behaviorIds: [behavior.id],
})
// 剧本参考卡 06168：由 manifest.referenceCode 承载（type=scenario 的卡不建单卡条目）。
manifest.referenceCode = '06168'
manifest.contentVersion = '1.0.0'
