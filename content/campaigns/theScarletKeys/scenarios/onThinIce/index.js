// 如履薄冰（On Thin Ice · 09609）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified 的关卡），单测直接 import 本章五件套，
// 不依赖 content/registered.js；主进程合并后统一重建索引/注册。
import {
  CHAPTER_ENTRY_CODES, GATHER_GROUPS, IN_PLAY_CODES, LOCATIONS, RAW_CODES, RECORD_READS, RECORD_WRITES,
  SET_ASIDE_CODES, SET_ASIDE_LOCATION_IDS, identities, scenario,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps,
  CHAPTER_ENTRY_CODES, RAW_CODES, RECORD_READS, RECORD_WRITES, GATHER_GROUPS, LOCATIONS,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tskCampaign'],
  // gatherSets 点名的八组：专属组 + 七个共享组（共享组的行为由共享组 worker 交付）。
  requiredEncounterGroupIds: [
    'agentsOfTheOutside',
    'agentsOfYuggoth',
    'crimsonConspiracy',
    'darkVeiling',
    'globetrotting',
    'onThinIce',
    'outsiders',
    'redCoterie',
    'spatialAnomaly',
  ],
  requiredInvestigatorIds: [],
  // 本章实际使用的 P2 原语：隐匿迷你卡（Concealed/Expose）、绯红密钥（玄丧之镜/Shift）、
  // 空洞区（hollow/recall/erase）、巡逻（凶残巨喙）、世界地图时间轴（time 记录）。
  requiredMechanicIds: ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskPatrol', 'tskMap'],
  // 放在一边：索恩两面 + 五张虚空奇美拉 + 玄丧之镜（卡号别名）与三张界外荒地（地点卡）；
  // 开局在场：安克雷奇/费尔班克斯 + 三张背面朝上的阿拉斯加荒地。
  setAsideAliases: [...SET_ASIDE_CODES],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
  inPlayAliases: [...IN_PLAY_CODES],
})
// 剧本参考卡 09609：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = RAW_CODES.scenario
manifest.contentVersion = '0.1.0'

export const implementedCodes = CHAPTER_ENTRY_CODES
