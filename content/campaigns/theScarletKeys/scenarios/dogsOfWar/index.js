// 战争疮痍（Dogs of War · 09635）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified 的关卡），单测直接 import 本章五件套，
// 不依赖 content/registered.js；主进程合并后统一重建索引/注册。
import {
  CHAPTER_ENTRY_CODES, GATHER_GROUPS, LOCATIONS, RAW_CODES, RECORD_READS, RECORD_WRITES,
  SET_ASIDE_CODES, V1_IN_PLAY_CODES, identities, scenario,
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
  // gatherSets 点名的六组（专属组 + 五个共享组；版本一/三多收黑暗异教徒，版本二多收扫荡团伙）。
  requiredEncounterGroupIds: [
    'cleanupCrew',
    'dogsOfWar',
    'scarletSorcery',
    'spatialAnomaly',
    'spreadingCorruption',
  ],
  requiredInvestigatorIds: [],
  // 本章实际使用的 P2 原语：绯红密钥（法罗斯之光/Shift）、隐匿迷你卡（版本二的结社刺客）、
  // 巡逻（有钥匙节点的最近地点）、世界地图时间轴（time 记录）。
  requiredMechanicIds: ['tskScarletKeys', 'tskConcealed', 'tskPatrol', 'tskMap'],
  // 放在一边：两个首领的两面 + 两个钥匙节点面 + 法罗斯之光的两面 + 三个版本里不用的地点变体。
  setAsideAliases: [...SET_ASIDE_CODES],
  inPlayAliases: [...V1_IN_PLAY_CODES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
// 剧本参考卡 09635：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = RAW_CODES.scenario
manifest.contentVersion = '0.1.0'

export const implementedCodes = CHAPTER_ENTRY_CODES
