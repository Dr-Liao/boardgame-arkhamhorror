// 月之暗面（darkSideOfTheMoon）· 章节装配（照 TCU theWitchingHour/index.js 的形状）。
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
  requiredEncounterGroupIds: ['darkSideOfTheMoon', 'corsairs', 'dreamersCurse', 'ancientEvils'],
  requiredMechanicIds: ['tdeChaos', 'tdeAlarmLevel', 'tdeSwarming', 'tdeStoryAssets'],
  setAsideLocations: scenario.setAsideLocations,
  // 非地点「放在一边」卡：月蜥 ×1、维吉尔·格雷 ×1、船长 ×1、卡达斯 ×1。
  setAsideAliases: ['06226', '06224', '06225', '06233'],
  recordReads: ['wasCaptured', 'randolphWasCaptured'],
  recordWrites: [
    'theInvestigatorsWereCarriedToTheColdWastes', 'theInvestigatorsTraveledToTheColdWastes',
    'randolphCarterDidNotSurviveTheVoyage', 'randolphSurvivedTheVoyage', 'evidenceOfKadath',
  ],
  behaviorIds: [behavior.id],
})
manifest.referenceCode = '06206'
manifest.contentVersion = '1.0.0'
