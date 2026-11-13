// 钥匙议会（congressOfTheKeys · 09694 · 通古斯卡）· 章节装配。
//
// P7 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import {
  ACT1_VERSIONS, ACT_CARDS, CHAPTER_ENTRY_CODES, CONGRESS_KEYS, EXTERNAL_SUBSETS, GATHER_GROUPS, LOCATION_RULES,
  OTHERWORLD_LOCATION_CODES, RAW_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_CODES, SET_ASIDE_LOCATION_CODES,
  SHARED_GROUPS, STORY_ASSET_CODES, TRIAL_OUTCOME_RECORDS, identities, scenario,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps,
  ACT1_VERSIONS, ACT_CARDS, CHAPTER_ENTRY_CODES, CONGRESS_KEYS, EXTERNAL_SUBSETS, GATHER_GROUPS, LOCATION_RULES,
  OTHERWORLD_LOCATION_CODES, RAW_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_CODES, SET_ASIDE_LOCATION_CODES,
  SHARED_GROUPS, STORY_ASSET_CODES, TRIAL_OUTCOME_RECORDS,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  // `notz`：参考 setup 的 gatherJust 会收「恐惧打击」的 2 张（01164/01165，core 包），
  // 该遭遇组由《午夜假面》/《吞噬万物之下》的战役清单登记，本章只声明依赖。
  requiredPackIds: ['core', 'notz', 'tskCampaign'],
  requiredEncounterGroupIds: [
    'agentsOfTheOutside',
    'beyondTheBeyond',
    'congressOfTheKeys',
    'globetrotting',
    'outsiders',
    'redCoterie',
    'scarletSorcery',
    'secretWar',
    'spatialAnomaly',
    'spreadingCorruption',
  ],
  requiredInvestigatorIds: [],
  // 本章实际使用的 TSK P2 原语：隐匿迷你卡、绯红密钥变换/持有、空洞与存在抹除、同志会乱入、
  // 世界地图时间轴。机制 id 由 Lead 在 P7 收口时登记到 content/mechanics.js，本 worker 不写共享层。
  requiredMechanicIds: ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskCoterie', 'tskMap'],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CODES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
// 剧本参考卡 09694：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '09694'
manifest.contentVersion = '0.1.0'

export const implementedCodes = CHAPTER_ENTRY_CODES
