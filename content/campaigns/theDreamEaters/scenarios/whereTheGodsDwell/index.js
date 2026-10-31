// 神居之所（Where the Gods Dwell · 06286）· 章节模块入口（P8 / M3，status: development）。
//
// 照 TCU `content/campaigns/theCircleUndone/scenarios/theWitchingHour/index.js` 的装配形状：
// manifest 由 `scenarioManifest` 统一生成，注册进 registry 由 P10（主进程）完成；
// 本文件只声明本章依赖的卡包、遭遇组、机制与记录读写。
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
    'whereTheGodsDwell',
    'agentsOfNyarlathotep',
    'dreamersCurse',
    'whispersOfHypnos',
    'darkCult',
  ],
  requiredMechanicIds: ['tdeChaos'],
  setAsideLocations: scenario.setAsideLocations,
  // 放在一边的 13 张遭遇卡（大祭司 ×1、奈亚拉托提普 ×5、混沌低语 ×4、万千化身 ×2、蠕动之雾 ×1）。
  setAsideAliases: [
    '06311',
    '06306', '06307', '06308', '06309', '06310',
    '06314', '06315', '06316', '06317',
    '06318', '06318',
    '06086',
  ],
  recordReads: [
    'theInvestigatorsWereCarriedToTheColdWastes',
    'theInvestigatorsTraveledToTheColdWastes',
    'randolphSurvivedTheVoyage',
    'theBlackCatIsAtYourSide',
    'evidenceOfKadath',
    'theBlackCatKnowsTheTruth',
    'theInvestigatorsPossessTheSilverKey',
    'theDreamersKnowOfAnotherPath',
  ],
  recordWrites: [
    'nyarlathotepsInvasionHasBegun',
    'theDreamersEscapedFromNyarlathotepsGrasp',
    'theDreamersBanishedNyarlathotep',
    'theDreamersAwoke',
    'theDreamersStayedInTheDreamlandsForever',
    'theDreamersTraveledBeneathTheMonastery',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 06286 由 manifest.referenceCode 承载（不建单卡条目；Lead 的 P8 口径）。
manifest.referenceCode = '06286'
