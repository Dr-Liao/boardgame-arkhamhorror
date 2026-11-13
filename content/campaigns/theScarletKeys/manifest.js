// 《绯红密钥》战役清单（P7：流程/记录/世界地图语义已接线，发布状态仍 catalog-only）。
//
// 与 P0 目录清单的差别：
//   · `flow` / `recordSchema` / `recordDefaults` / `recordLabels` / 世界地图语义来自
//     `content/campaigns/theScarletKeys/flow.js#campaignFlowExtras`（P7 战役流程层）；
//   · 十个 `scenarioIds` 与 `unlock` 改成世界地图口径：首章《谜雨》由序幕直接开始，其余九章
//     （含终章《钥匙议会》）只有「已完成《谜雨》」这一条保守前驱——真正的可去与解锁由世界地图
//     节点状态决定（`flow.travelTriggers` / `campaign.tsk.map.unlocked`），不由线性 unlock 决定；
//   · `status` 仍是 `catalog-only`：十章与共享遭遇组由各 worker/P8 逐章收口，主进程整合时改
//     `playable` 并把战役 + 十章注册进 `content/registered.js`（本文件不写组合根）。
//
// 记录 schema 的章级键（`tskTime` / `tskPrologueIntent` / `deadHeatResolution` …）由各章
// `manifest.recordReads/recordWrites` 声明；P8 注册时必须把它们并入 `recordSchema`（content/schema.js
// 会逐键校验「章节读写过的战役记录必须在战役清单里声明」）。本文件只声明战役流程层与 Key.hs 的键。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_NAME_ZH, CHAOS_BAGS, ENCOUNTER_GROUPS, SHARED_ENCOUNTER_GROUPS,
} from './shared.js'
import { campaignFlowExtras } from './flow.js'
import { TSK_SCENARIO_IDS } from './parts.js'
import { TSK_STORY_META } from './story-text.js'

// 世界地图口径的 unlock：首章无前驱；其余章只要求「已完成《谜雨》」（前置必须出现在 scenarioIds 更早位置）。
const FIRST_CHAPTER = TSK_SCENARIO_IDS[0]
export const TSK_UNLOCK = Object.freeze(Object.fromEntries(TSK_SCENARIO_IDS.map(id => [
  id, Object.freeze(id === FIRST_CHAPTER ? [] : [FIRST_CHAPTER]),
])))

// 十章 manifest.recordReads/recordWrites 中使用、但不在 Key.hs/flow 表内的记录键（P7 注册期并入）。
// content/schema.js 只接受 boolean/number/string/string[] 四种类型；物件型记录一律拆成并列键。
export const TSK_CHAPTER_RECORD_TYPES = Object.freeze({
  deadHeatCiviliansRescued: 'number',
  deadHeatCiviliansSlain: 'number',
  deadHeatResolution: 'string',
  deadHeatTimes: 'number',
  matiasBolivarDoesntTrustYou: 'boolean',
  matiasBolivarTrustsYou: 'boolean',
  shadeReaperBearer: 'string',
  theLastBlossomBearer: 'string',
  twistedAntiprismBearer: 'string',
  youHaventSeenTheLastOfThorne: 'boolean',
})
const chapterRecordDefaults = Object.freeze(Object.fromEntries(Object.entries(TSK_CHAPTER_RECORD_TYPES).map(([key, type]) => [
  key, type === 'number' ? 0 : type === 'boolean' ? false : type === 'string[]' ? [] : '',
])))

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: CAMPAIGN_NAME_ZH,
  nameEn: CAMPAIGN_NAME,
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  // P7：十章 + 26 个遭遇组逐章验收完成后，战役开放为可启动（playable）；生产组合根见 content/registered.js。
  status: 'playable',
  requiredPackIds: ['core', 'tskCampaign', 'tskInvestigators', 'tskPlayer'],
  scenarioIds: TSK_SCENARIO_IDS,
  sharedEncounterGroupIds: SHARED_ENCOUNTER_GROUPS,
  encounterGroupIds: ENCOUNTER_GROUPS,
  unlock: TSK_UNLOCK,
  chaosBags: CHAOS_BAGS,
  interludeHandlerId: 'scarletKeysInterludes',
  resolutionIds: ['victory', 'defeat'],
  story: Object.freeze({
    status: TSK_STORY_META.status,
    sourceKind: TSK_STORY_META.sourceKind,
    officialChinese: TSK_STORY_META.officialChinese === true,
    generator: TSK_STORY_META.generator,
    note: TSK_STORY_META.note,
  }),
  ...campaignFlowExtras,
  // 十章记录键并入（P7 注册期）：content/schema 会逐键校验章节读写过的记录必须在战役清单声明。
  recordSchema: Object.freeze({ ...campaignFlowExtras.recordSchema, ...TSK_CHAPTER_RECORD_TYPES }),
  recordDefaults: Object.freeze({ ...campaignFlowExtras.recordDefaults, ...chapterRecordDefaults }),
})
