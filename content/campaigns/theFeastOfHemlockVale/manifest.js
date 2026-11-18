// 《铁杉谷盛宴》战役清单（P7：流程/记录/三天三夜/勘察语义已接线，状态升 playable）。
//
// 与 P0 目录清单的差别：
//   · `flow` / `recordSchema` / `recordDefaults` / `recordLabels` / 勘察与夜探语义来自
//     `content/campaigns/theFeastOfHemlockVale/flow.js#campaignFlowExtras`（P7 战役流程层）；
//   · 12 个 `scenarioIds` 就是 `CampaignSteps.hs` 的 12 个 ScenarioStep（4 段序曲 + 5 个勘察关 +
//     2 个夜章 + 终章），顺序与 `shared.js#chapters` 一致；
//   · `unlock` 改成「保守前驱」：所有勘察/夜章只需《欢迎来到铁杉谷》，后两段序曲与终章沿时间轴
//     依次前进（真正的可去/下一段由 flow.js 的 `surveyRouter` 与 `nextStep` 决定，不由线性 unlock 决定）；
//   · `status` 升为 `playable`：12 章、共享遭遇组与两条纯叙事夜由 P7 各 worker 逐章收口，
//     组合根仍由主进程写 `content/registered.js`（本文件不写注册表/大厅入口）。
//
// 记录 schema 的章级键：各章 `manifest.recordReads/recordWrites` 声明的键必须能在战役清单里找到
// （`content/schema.js#assertContentBundle` 逐键校验）。records.js 已汇总 P7 各章 worker 的 `RECORD_KEYS`；
// 并行落盘中新出现的键通过 `FHV_CHAPTER_RECORD_TYPES` 并入（主进程合并时按需追加）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CHAOS_BAGS, chapters, encounterGroupId, encounterGroups,
} from './shared.js'
import { campaignFlowExtras } from './flow.js'
import { FHV_HEIRLOOM_CODES, FHV_RESIDENT_LIST } from './records.js'
import { FHV_SCENARIO_IDS, FHV_UNLOCK_STEPS, FHV_SURVEY_SCENARIO_IDS } from './parts.js'
import { FHV_STORY_META } from './story-text.js'

export const FHV_CAMPAIGN_ID = CAMPAIGN_ID

// 保守前驱（与 flow.js#campaignFlowExtras.unlock 同一对象；约束见 parts.js#FHV_UNLOCK_STEPS）。
export const FHV_UNLOCK = FHV_UNLOCK_STEPS

// 并行 worker 仍在落盘的章级记录键（P7 注册期并入；新增时只加不删）。
// content/schema.js 只接受 boolean/number/string/string[] 四种类型。
export const FHV_CHAPTER_RECORD_TYPES = Object.freeze({
  dawnOfTheSecondDayResolution: 'string',
  dawnOfTheSecondDayResolvedTo: 'string',
  hemlockCurseAdded: 'boolean',
  dawnOfTheFinalDayResolution: 'string',
  dawnOfTheFinalDayResolvedTo: 'string',
  youAreDeliveringAPackage: 'boolean',
  theInvestigatorsAreDoomed: 'boolean',
  // 最终日黎明按 tally **数字**写入（records.js#FHV_CHAPTER_RECORDS 同口径；印刷日志把它画成
  // Simeon 分节里的复选框，章节 `planTally` 同时容忍 boolean/Notes 集合两种旧写法）。
  thePlanIsUnderway: 'number',
})

// 8 个「章节专属遭遇组」= shared.js#chapters 里带 `group` 的那 8 章（writtenInRock、hemlockHouse …）。
// 其余 18 组跨章复用/战役级共享（居民、山谷、传家宝、霍乱石、色彩使徒、变形、枯萎、折射、森林、
// 真菌、变异、火 等）→ 单卡条目归 `theFeastOfHemlockVale/_shared/<组>/`（tools/encounter-entry-placement.mjs
// 与 tests/encounter-entries.test.mjs 的归属算法读这个字段）。
export const FHV_CHAPTER_ENCOUNTER_GROUP_IDS = Object.freeze(chapters
  .filter(chapter => chapter.group)
  .map(chapter => encounterGroupId(chapter.group)))
export const FHV_SHARED_ENCOUNTER_GROUPS = Object.freeze(Object.keys(encounterGroups)
  .map(encounterGroupId)
  .sort()
  .filter(group => !FHV_CHAPTER_ENCOUNTER_GROUP_IDS.includes(group)))

const chapterRecordDefaults = Object.freeze(Object.fromEntries(
  Object.entries(FHV_CHAPTER_RECORD_TYPES).map(([key, type]) => [
    key, type === 'number' ? 0 : type === 'boolean' ? false : type === 'string[]' ? [] : '',
  ])))

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: CAMPAIGN_NAME,
  nameEn: 'The Feast of Hemlock Vale',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  // P7：12 章 + 共享遭遇组 + 两段纯叙事夜全部接线，战役开放为可启动（playable）。
  status: 'playable',
  requiredPackIds: ['core', 'fhvCampaign', 'fhvInvestigators', 'fhvPlayer'],
  scenarioIds: FHV_SCENARIO_IDS,
  sharedEncounterGroupIds: FHV_SHARED_ENCOUNTER_GROUPS,
  encounterGroupIds: Object.keys(encounterGroups).map(encounterGroupId).sort(),
  unlock: FHV_UNLOCK,
  chaosBags: CHAOS_BAGS,
  interludeHandlerId: 'fhvInterludes',
  resolutionIds: ['victory', 'defeat'],
  // 居民清单（引擎 `resident-record.js` 的声明形状；章节 definition 也可内联自己的 residents）。
  residents: FHV_RESIDENT_LIST,
  heirloomCodes: FHV_HEIRLOOM_CODES,
  // 传家宝（10713–10715）是战役级奖励（序曲/幕间的法典发放），**没有章节 gather 它们**：
  // 按 EotE 的「战役共用剧情资产」口径声明落点，否则 tools/encounter-entry-placement.mjs 的
  // 归属算法会因「没有章节 token/组命中」把它们判成 unresolved。
  sharedStoryAssetGroups: Object.freeze(Object.fromEntries(
    FHV_HEIRLOOM_CODES.map(code => [code, 'heirlooms']))),
  story: Object.freeze({
    status: FHV_STORY_META.status,
    sourceKind: FHV_STORY_META.sourceKind,
    officialChinese: FHV_STORY_META.officialChinese === true,
    generator: FHV_STORY_META.generator,
    note: FHV_STORY_META.note,
    chineseGapCount: FHV_STORY_META.chineseGapCount,
  }),
  ...campaignFlowExtras,
  // 章级记录键并入（P7 注册期）：content/schema 会逐键校验章节读写过的记录必须在战役清单声明。
  recordSchema: Object.freeze({ ...campaignFlowExtras.recordSchema, ...FHV_CHAPTER_RECORD_TYPES }),
  recordDefaults: Object.freeze({ ...campaignFlowExtras.recordDefaults, ...chapterRecordDefaults }),
})

// 章节目录（P0 身份表；真实章模块由 `scenarios/index.js` 汇总，这里保持只读清单）。
export const chapterIds = Object.freeze(chapters.map(chapter => chapter.id))
