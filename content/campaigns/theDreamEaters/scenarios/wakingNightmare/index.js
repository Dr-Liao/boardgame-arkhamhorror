// 清醒噩梦（Waking Nightmare · 06063）· 章节装配（照 theWitchingHour/index.js）。
//
// P8 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import { scenario, identities, SET_ASIDE_ALIASES } from './definition.js'
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
    'wakingNightmare', 'mergingRealities', 'whispersOfHypnos', 'lockedDoors', 'strikingFear',
    'agentsOfAtlachNacha', 'spiders',
  ],
  requiredMechanicIds: ['tdeInfestationBag', 'tdeStoryAssets'],
  requiredInvestigatorIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: SET_ASIDE_ALIASES,
  recordReads: ['drMaheswaranJoinedTheInvestigation', 'drMaheswaranStayedWithHerPatients'],
  recordWrites: [
    'stepsOfTheBridge', 'drMaheswaransFateIsUnknown', 'randolphEscapedTheHospitalOnHisOwn',
    'randolphEscapedTheHospitalWithTheInvestigators', 'drMaheswaranIsAlive', 'drMaheswaranIsMissing',
    'theDreamersGrowWeaker', 'drMaheswaranJoinedTheInvestigation', 'drMaheswaranStayedWithHerPatients',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 剧本参考卡 06063：check-tde-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '06063'
