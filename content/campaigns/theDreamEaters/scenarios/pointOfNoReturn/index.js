import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

// 放在一边：9 张地点（幕推进时入场）+ 4 组遭遇卡（16 张）+ 古革哨兵 + 皮克曼 + 卡达斯。
// 区域账本按印张数量登记（scenarioZoneReport 与卡池 quantity 对账）。
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDreamEaters',
  status: 'development',
  layout,
  // tdeCampaign 的 cardRanges 06039–06354 覆盖本章全部 TDE 卡；core 提供 Ghouls/Striking Fear/
  // Ancient Evils/Nightgaunts 四个核心组。
  requiredPackIds: ['core', 'tdeCampaign'],
  requiredEncounterGroupIds: [
    'pointOfNoReturn', 'creaturesOfTheUnderworld', 'whispersOfHypnos', 'ancientEvils', 'ghouls',
    'strikingFear', 'descentIntoThePitch', 'terrorOfTheVale', 'agentsOfAtlachNacha', 'nightgaunts',
  ],
  requiredMechanicIds: ['tdeVeiled', 'tdeStoryAssets', 'tdeSwarming'],
  setAsideAliases: [
    // 4 组放一边的遭遇卡（按印张数量）。
    '06271', '06272', '06272', '06272',
    '06273', '06273', '06274', '06274',
    '06084', '06084', '06085', '06085',
    '01172', '01172', '01173', '01173',
    // 单张放一边。
    '06267', '06266', '06275',
  ],
  recordReads: ['randolphDidNotSurviveTheDescent', 'stepsOfTheBridge'],
  recordWrites: [
    'stepsOfTheBridge',
    'theInvestigatorsFoundAWayOutOfTheUnderworld',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 06247 由本章 definition/behavior 承载（无单卡条目；check-tde-scenario 按此对上账）。
manifest.referenceCode = scenario.originalCode
