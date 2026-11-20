// 《沉没之城》（The Drowned City）· 战役清单（P7 内容批次）。
//
// 组成：
//   · `flow` / `recordSchema` / `recordDefaults` / `recordLabels` / 路线与门槛语义来自
//     `content/campaigns/theDrownedCity/flow.js#campaignFlowExtras`；
//   · 10 个 `scenarioIds` = `CampaignSteps.hs` 的 10 个 ScenarioStep（顺序与 shared.js#chapters 一致）；
//   · `unlock` 为「保守前驱」：所有远征章节只需《金盆洗手》，墓穴/终章沿主轴依次前进；
//     真正的可去/下一关由 flow.js 的 `routeRouter` + 各关结局决定，不由线性 unlock 决定；
//   · 记录 schema 只含 CONTRACT §4 的 44 个键（章节 worker 的 recordReads/recordWrites 必须闭包于此）；
//   · 组合根与大厅入口由主进程写 `content/registered.js`（本文件不写注册表）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_NAME_EN, CHAOS_BAGS, SCENARIO_IDS, SHARED_ENCOUNTER_GROUP_IDS,
  chapters, encounterGroupId, encounterGroups,
} from './shared.js'
import { campaignFlowExtras } from './flow.js'
import { TDC_RECORD_DEFAULTS, TDC_RECORD_LABELS, TDC_RECORD_TYPES } from './records.js'

export const TDC_CAMPAIGN_ID = CAMPAIGN_ID

// 保守前驱（引擎 schema 只做闭包校验；真正可去由 routeRouter/各关结局决定）。
export const TDC_UNLOCK = Object.freeze({
  oneLastJob: Object.freeze([]),
  theWesternWall: Object.freeze(['oneLastJob']),
  // 西线从西墙进入（theWesternWall 在前）；东线从黑曜石峡谷进入，第二关才到淹没城区。
  // 两者都只要求开场关，路线由 `theExpeditionHeadedWest/East` 决定。
  theDrownedQuarter: Object.freeze(['oneLastJob']),
  theApiary: Object.freeze(['oneLastJob']),
  theGrandVault: Object.freeze(['oneLastJob']),
  courtOfTheAncients: Object.freeze(['oneLastJob']),
  obsidianCanyons: Object.freeze(['oneLastJob']),
  sepulchreOfTheSleeper: Object.freeze([
    'oneLastJob', 'theWesternWall', 'theDrownedQuarter', 'theApiary',
    'theGrandVault', 'courtOfTheAncients', 'obsidianCanyons',
  ]),
  theDoomOfArkhamPartI: Object.freeze(['sepulchreOfTheSleeper']),
  theDoomOfArkhamPartII: Object.freeze(['theDoomOfArkhamPartI']),
})

// 章节专属遭遇组（10 个）与跨章共享组（15 组里的 13 个 + 任务/远征剧情组）。
// 单卡条目归属算法读 `encounterGroupIds`；共享组落 `theDrownedCity/_shared/<组>/`。
export const TDC_CHAPTER_ENCOUNTER_GROUP_IDS = Object.freeze(
  chapters.map(chapter => encounterGroupId(chapter.group)))
export const TDC_SHARED_ENCOUNTER_GROUPS = SHARED_ENCOUNTER_GROUP_IDS
export const TDC_ENCOUNTER_GROUP_IDS = Object.freeze(
  Object.keys(encounterGroups).map(encounterGroupId).sort())

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: CAMPAIGN_NAME,
  nameEn: CAMPAIGN_NAME_EN,
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  // TDC 复用《夜之狂热》的《午夜假面》Arkham 地点组（01124–01136）与核心包若干组，
  // 因此战役同时依赖 core/notz；否则章节 requiredEncounterGroupIds 的注册期校验缺组。
  requiredPackIds: ['core', 'notz', 'tdcCampaign'],
  scenarioIds: SCENARIO_IDS,
  sharedEncounterGroupIds: TDC_SHARED_ENCOUNTER_GROUPS,
  // 八张任务资产（11753a–11760b）由幕间 I 逐人领取、幕间 IV 结算，不属于任何单章布置，
  // 按 EotE/FHV 的「战役共用剧情资产」口径声明落点，否则单卡条目归属算法会判 unresolved。
  sharedStoryAssetGroups: Object.freeze(Object.fromEntries([
    '11753a', '11753b', '11754a', '11754b', '11755a', '11755b', '11756a', '11756b',
    '11757a', '11757b', '11758a', '11758b', '11759a', '11759b', '11760a', '11760b',
  ].map(code => [code, 'tasks']))),
  encounterGroupIds: TDC_ENCOUNTER_GROUP_IDS,
  unlock: TDC_UNLOCK,
  chaosBags: CHAOS_BAGS,
  // 战役层效果处理器（prologue / interludes / epilogue 三个模块的 registerCampaignEffectHandler id）。
  interludeHandlerId: campaignFlowExtras.handlers.interlude,
  // 与 EpilogueStep 的分支一一对应（1–4 号尾声 + 战役失败）。
  resolutionIds: ['epilogue1', 'epilogue2', 'epilogue3', 'epilogue4', 'campaignLost'],
  ...campaignFlowExtras,
  // 记录 schema（引擎口径）：CONTRACT §4 全量 44 键；其余片段展开不会覆盖这三项。
  recordSchema: TDC_RECORD_TYPES,
  recordDefaults: TDC_RECORD_DEFAULTS,
  recordLabels: TDC_RECORD_LABELS,
})

// 章节目录（P0 身份表；真实章模块由 `scenarios/index.js` 汇总，这里保持只读清单）。
export const chapterIds = Object.freeze(chapters.map(chapter => chapter.id))
