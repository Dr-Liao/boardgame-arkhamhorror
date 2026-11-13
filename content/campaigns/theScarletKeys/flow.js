// 《绯红密钥》（The Scarlet Keys）· 战役流程图组装与 manifest 片段（P7）。
//
// 输入（均已按参考实现锁定，见各文件头）：
//   parts.js（步骤/地图/幕间/状况报告/密档常量 + nextStep 语义 + 正文键解析）、
//   prologue.js（序幕 + 开局初始化）、interludes.js（幕间 I / 16 段密档幕间 / 状况报告 α–ω / 密档 /
//   快捷旅票 / 支线幕间）、checkpoints.js（本循环没有检查点，显式空表）、epilogue.js（多结局与收口）、
//   records.js（Key.hs 记录键、常量、正文读取）。
// 输出：
//   · `TSK_FLOW`：可序列化的 `{ start, nodes }`，直接合入 `manifest.flow`；
//   · `campaignFlowExtras`：供 Lead 合并进 `manifest.js` 的片段（flow/记录/升级窗/顺序/地图语义）；
//   · `nextWorldMapNode(state)`：世界地图启程循环的**只读路由读点**（未处理的状况报告 → 强制终局）；
//   · `validateTskFlow(flow, opts)`：构建期自检（`validateCampaignGraph` 的注册期口径）。
//
// 流程形状（参考 TheScarletKeys.hs#nextStep / travel / embark 逐条镜像）：
//   序幕 prologue → 战役准备 prologueRules → 谜雨 riddlesAndRain → 幕间 I interlude1
//   → 世界地图 worldMap（`map` 节点：引擎停下、由战役行为选择目的地）
//        ─ 8 章 scenario ──────────────→ 回到 worldMap
//        ─ 16 段密档幕间 interlude14…55 ─→ 回到 worldMap
//        ─ 状况报告 α–ω / 密档 / 快捷旅票 / 支线幕间 ─→ 回到 worldMap
//   → 前往通古斯卡 endgameApproach → 钥匙议会 congressOfTheKeys → 尾声 epilogue → end
//
// 世界地图是**环**：所有到达节点完成后都回到 `worldMap`（参考每次 `campaignStep_ (embark attrs)`），
// 引擎在该节点停下并把控制权交给世界地图面板；面板用 `tskTravelTarget(mapNodeId)` 取目的地的进入节点，
// 写入 `campaign.pendingNode` 后继续 `progressCampaign`。`worldMap.next` 只作为「直接结束启程循环」的
// 兜底出口（`endgameApproach`），不会在正常流程里被自动用到。
import { validateCampaignGraph } from '../../../src/campaign/campaign-flow.js'
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { forcedDestination, queueStatusReports, statusReportState, worldMapState } from '../../../src/engine/tsk-map.js'
import {
  ALL_RECORD_KEYS, ERASED_CAMPAIGN_CARDS, EXPEDITED_TICKET, recordLabels, recordSchema,
} from './records.js'
import { STATUS_REPORTS } from './shared.js'
import {
  TSK_CAMPAIGN_ID, TSK_CAMPAIGN_STEPS, TSK_DOSSIER_KEYS, TSK_ENDGAME_MAP_NODE, TSK_ENDGAME_STEP,
  TSK_END_STEP, TSK_EPILOGUE_STEP, TSK_FORCED_ENDGAME_TIME, TSK_INITIAL_UNLOCKED, TSK_INTERLUDE_IDS,
  TSK_MAINLINE_SCENARIO_IDS, TSK_NODE_ORDER, TSK_PROLOGUE_STEP, TSK_SCENARIO_IDS, TSK_SCENARIO_UNITS,
  TSK_START_LOCATION, TSK_START_STEP, TSK_STATUS_REPORT_NODE_BY_ID, TSK_STATUS_REPORT_STEPS,
  TSK_TICKET_STEP, TSK_TRAVEL_TRIGGERS, TSK_WORLD_MAP, TSK_WORLD_MAP_IDS, TSK_SIDE_STORY_STEP, TSK_WORLD_MAP_STEP,
  campaignRecordLabel, campaignStoryLabel, campaignStoryText,
} from './parts.js'
import { PROLOGUE_NODES } from './prologue.js'
import { CHECKPOINT_NODES } from './checkpoints.js'
import {
  INTERLUDE_NODES, syncKeyRecords, syncMapRecords,
} from './interludes.js'
import { EPILOGUE_NODES } from './epilogue.js'
// 2026-11-13 P1-12：章节公开状态投影声明（observation / mechanic-view 共用同一份清单）。
import { TSK_PUBLIC_SCENARIO_FLAGS } from './public-flags.js'

export const EMBARK_HANDLER_ID = 'scarletKeysEmbark'

// ---------------------------------------------------------------------------
// 1. 战役记录 schema（引擎口径：`key → 'boolean' | 'number' | 'string' | 'string[]'`）
// ---------------------------------------------------------------------------
// records.js 的 `recordSchema` 是「类型 + 默认值」的内容层视图；引擎（setup.js / campaign-flow.js）
// 需要纯类型映射，故这里做一次投影，不重复维护键表。
// 三处类型覆盖（有据）：
//   · `foundationTrust` / `cellDeception` —— 参考 Key.hs 用 `recordCount`（计数），
//     records.js 按「Campaign Log 复选框」默认成布尔；尾声要写 0..N 的整数；
//   · `statusReportsRead` —— 记录面板按数字读（records.js#recordsSnapshot `Number(...)`），
//     records.js 未把它列入 NUMBER_KEYS，这里按数值声明以与实际写入一致。
const RECORD_TYPE_OVERRIDES = Object.freeze({
  foundationTrust: 'number',
  cellDeception: 'number',
  statusReportsRead: 'number',
})

export const TSK_RECORD_TYPES = Object.freeze(Object.fromEntries(ALL_RECORD_KEYS.map(key => [
  key, RECORD_TYPE_OVERRIDES[key] || recordSchema[key].type,
])))

// 流程层自有记录（不在 Key.hs 复选框里，但跨章读写；命名与章节级记录区分）。
export const TSK_FLOW_RECORDS = Object.freeze({
  currentLocation: 'string', // 当前世界地图节点（quidProQuo/strangeArchitecture/specialDelivery 的路由条件）
  mapVisitedLocations: 'string[]', // 已访问地图节点（quidProQuo 的 intel 分支排除已去过的城市）
  wrongLeadCount: 'number', // 幕间 14「错误线索」计数
  rusesFound: 'boolean', // 幕间 14 本次是否找到真线索
  deltaTime: 'number', // δ 时间点（幕间 44/55 写入，幕间 45 读取）
  psiTime: 'number', // ψ 时间点（幕间 32 写入，幕间 50 读取）
  deltaDeadline: 'number', // δ 宽限（δ + 10）
  psiDeadline: 'number', // ψ 宽限（ψ + 10）
  thetaTime: 'number', // θ 时间点（圣所 F4 线索写入；幕间 52 安全屋判定）
  foundationIntelDelivered: 'boolean', // 已交付 Foundation Intel（尾声信任计数 +1）
  campaignOutcome: 'string', // 最终结局标签（epilogue.js#EPILOGUE_OUTCOMES）
  statusReportsSeen: 'string[]', // 已演出状况报告 id
  interludeVisits: 'string[]', // 已进入幕间步骤 id（审计/去重）
  keysStolen: 'string[]', // 被敌人夺走的密钥（`<keyId>:<enemyId>`）
  tskStartingHandBonus: 'number', // 下一关起始手牌加成（幕间 20 无活动分支）
  tskStartingResourcesBonus: 'number', // 下一关起始资源加成（幕间 51 在岗分支）
})

export const TSK_RECORD_SCHEMA = Object.freeze({ ...TSK_RECORD_TYPES, ...TSK_FLOW_RECORDS })

export const TSK_RECORD_DEFAULTS = Object.freeze(Object.fromEntries(
  Object.entries(TSK_RECORD_SCHEMA).map(([key, type]) => [key,
    type === 'boolean' ? false : type === 'number' ? 0 : type === 'string[]' ? [] : ''])))

const FLOW_RECORD_LABELS = Object.freeze({
  // records.js#FLOW_RECORD_KEYS（不在 Key.hs 复选框里，没有官方中文标签；补内容层中文，不冒充官方）。
  time: '时间',
  xp: '经验值',
  totalXp: '总经验值',
  statusReportsRead: '已读状况报告数',
  dossiersRead: '已读密档',
  sideStoriesCompleted: '已完成支线冒险',
  keysHeld: '持有的绯红密钥',
  coterieStatus: '同志会状态',
  conspiracyStatus: '密谋状态',
  chaptersCompleted: '已完成章节',
  scenarioOrder: '战役章节顺序',
  erasedCards: '存在抹除',
  trauma: '创伤',
  expeditedTickets: '快捷旅票',
  // 流程层自有记录。
  currentLocation: '当前位置',
  mapVisitedLocations: '已访问地点',
  wrongLeadCount: '错误线索计数',
  rusesFound: '找到真线索',
  deltaTime: 'δ 时间点',
  psiTime: 'ψ 时间点',
  deltaDeadline: 'δ 宽限',
  psiDeadline: 'ψ 宽限',
  thetaTime: 'θ 时间点',
  foundationIntelDelivered: '已交付基金会情报',
  campaignOutcome: '最终结局',
  statusReportsSeen: '已读状况报告',
  interludeVisits: '已进入幕间',
  keysStolen: '被夺走的密钥',
  tskStartingHandBonus: '起始手牌加成',
  tskStartingResourcesBonus: '起始资源加成',
})

// 标签：以 Key.hs 的 Campaign Log 标签（`sections.key.<key>`）为准，缺译回退 records.js 的英文标签，
// 流程层自有键用本文件的中文标签（不是剧情正文，只是记录面板的键名）。
export const TSK_RECORD_LABELS = Object.freeze(Object.fromEntries(
  Object.keys(TSK_RECORD_SCHEMA).map(key => [
    key, campaignRecordLabel(key) || FLOW_RECORD_LABELS[key] || recordLabels()[key] || key,
  ])))

// ---------------------------------------------------------------------------
// 2. 世界地图节点（启程循环）
// ---------------------------------------------------------------------------
// 引擎：`walkCampaign` 在 `map` 节点停下（`src/campaign/campaign-flow.js`），`progressCampaign`
// 把阶段置为 interlude 并把控制权交给战役行为；目的地选择走 `ctx.api.tsk.map`（tsk-interactions.js）。
// 这里的效果只做记账（地图/密钥记录同步、十章完成清单）与状况报告排队，不替玩家选目的地。
const worldMapNode = {
  type: 'map',
  title: campaignStoryText(`locations.${TSK_START_LOCATION}.name`) || 'World Map',
  mapStep: TSK_WORLD_MAP_STEP,
  effects: [{ type: 'registered', handler: EMBARK_HANDLER_ID, event: 'embark' }],
  next: 'endgameApproach',
}

// ---------------------------------------------------------------------------
// 3. 节点表组装
// ---------------------------------------------------------------------------
const clone = value => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)))

/** 章节节点：`scenarioId` 是引擎读点；标题/卡号仅供展示与审计。 */
function chapterNodes () {
  const nodes = {}
  for (const unit of TSK_SCENARIO_UNITS) {
    const next = unit.id === TSK_START_STEP
      ? 'interlude1'
      : unit.id === TSK_ENDGAME_STEP ? TSK_EPILOGUE_STEP : TSK_WORLD_MAP_STEP
    nodes[unit.id] = {
      type: 'scenario',
      scenarioId: unit.id,
      title: unit.name,
      nameEn: unit.nameEn,
      cardCode: unit.cardCode,
      mapLocationId: unit.mapLocationId,
      archiveLabel: unit.archiveLabel,
      next,
    }
  }
  return nodes
}

/** 前往通古斯卡：把「自愿 / 时间到点强制」区分记进记录，再进终章。 */
const endgameApproachNode = {
  type: 'story',
  title: campaignStoryText(`locations.${TSK_ENDGAME_MAP_NODE}.name`) || 'Tunguska',
  textKey: 'embarkingAndTravel',
  text: campaignStoryText('embarkingAndTravel'),
  effects: [{ type: 'registered', handler: EMBARK_HANDLER_ID, event: 'endgameApproach' }],
  next: TSK_ENDGAME_STEP,
}

/** 未经本地化的原始节点表。 */
export function rawTskFlowNodes () {
  return {
    ...clone(PROLOGUE_NODES),
    ...chapterNodes(),
    ...clone(INTERLUDE_NODES),
    ...clone(CHECKPOINT_NODES),
    worldMap: clone(worldMapNode),
    endgameApproach: clone(endgameApproachNode),
    ...clone(EPILOGUE_NODES),
  }
}

/** 正文绑定：节点 `textKey`/`textKeys` → story-text 展示文本；`titleKey` → 小标题；选项 `labelKey` → 标签。 */
function localizeNodes (nodes) {
  for (const node of Object.values(nodes)) {
    if (!node || typeof node !== 'object') continue
    const textKeys = [node.textKey, ...(node.textKeys || [])].filter(Boolean)
    if (textKeys.length) {
      const text = textKeys.map(campaignStoryText).filter(Boolean).join('\n\n')
      if (text) node.text = text
    }
    if (node.titleKey) {
      const title = campaignStoryLabel(node.titleKey)
      if (title) node.title = title
    }
    for (const option of node.options || []) {
      if (!option?.labelKey) continue
      const label = campaignStoryLabel(option.labelKey)
      if (label) option.label = label
    }
  }
  return nodes
}

/** P7 交付的完整 flow：`{ start: 'prologue', nodes }`，可序列化纯数据。 */
export const TSK_FLOW = Object.freeze({ start: TSK_PROLOGUE_STEP, nodes: localizeNodes(rawTskFlowNodes()) })

/** 流程图节点清单（构建顺序；供账本/测试断言节点集合稳定）。 */
export const TSK_FLOW_NODE_ORDER = Object.freeze(Object.keys(TSK_FLOW.nodes))

// ---------------------------------------------------------------------------
// 4. manifest 片段
// ---------------------------------------------------------------------------
export const campaignFlowExtras = Object.freeze({
  // 引擎读点：`campaignGraph(manifest)` 直接返回 manifest.flow。
  flow: TSK_FLOW,
  // 记录 schema（引擎口径的类型映射）、默认值、中文标签。
  recordSchema: TSK_RECORD_SCHEMA,
  recordDefaults: TSK_RECORD_DEFAULTS,
  recordLabels: TSK_RECORD_LABELS,
  // 引擎读点：`interludeFlow: 'continuous'` → 幕间准备结束后一次读完幕间子图（选择仍在 choice 节点询问）。
  interludeFlow: 'continuous',
  // 升级权限（引擎用 node.type 判定；这里显式登记，供 P8 大厅/审计读取）。
  upgradeWindows: Object.freeze({ interlude: true, checkpoint: false, scenario: false, map: false }),
  // 章节顺序（P8 大厅/验收用）：十章按 CampaignSteps.hs 顺序；没有可跳段。
  scenarioOrder: TSK_SCENARIO_IDS,
  mainlineScenarioOrder: TSK_MAINLINE_SCENARIO_IDS,
  skippableScenarioIds: Object.freeze([]),
  stepOrder: TSK_CAMPAIGN_STEPS,
  // 步骤级节点顺序（56 个：章节/幕间入口/状况报告/密档/世界地图/终章/尾声）与完整节点顺序（143 个）。
  nodeOrder: TSK_NODE_ORDER,
  flowNodeOrder: TSK_FLOW_NODE_ORDER,
  // 世界地图语义：36 节点、起点 London、初始解锁 26、绿地、时间阈值与强制终局。
  mapNodeOrder: TSK_WORLD_MAP_IDS,
  startLocation: TSK_START_LOCATION,
  initialUnlockedLocations: TSK_INITIAL_UNLOCKED,
  travelTriggers: TSK_TRAVEL_TRIGGERS,
  forcedEndgameTime: TSK_FORCED_ENDGAME_TIME,
  forcedEndgameNode: TSK_ENDGAME_MAP_NODE,
  // P8：世界地图的**可序列化**读点（引擎 hub 启程、大厅/观察投影与验收测试共用一套数据）。
  // 引擎不 import 本内容模块：图、目的地→流程节点、地图节点 id 都由 manifest 传入；
  // 节点名只做展示（来自 story-text `locations.<id>.name`，缺译回退 id），不新增手写卡号。
  // P8 approximation：worldMapGraph 只保留 id/type/connections 三个规则字段（不把节点正文/密档
  // 正文塞进 manifest）；展示名另放 mapNodeNames，避免观察投影为了名字去读剧情正文。
  worldMapGraph: Object.freeze({
    nodes: Object.freeze(TSK_WORLD_MAP.map(node => Object.freeze({
      id: node.id,
      type: node.type,
      connections: Object.freeze([...node.connections]),
    }))),
  }),
  // 目的地（地图节点 id）→ 到达后进入的流程图节点：8 章 + 16 段密档幕间 + 5 处绿地支线 + 通古斯卡（→ 终章入口）。
  travelNodes: Object.freeze(Object.fromEntries(
    TSK_WORLD_MAP_IDS.map(id => [id, nodeForTravel(id)]).filter(([, nodeId]) => Boolean(nodeId)))),
  mapNodeId: TSK_WORLD_MAP_STEP,
  endgameApproachNodeId: 'endgameApproach',
  mapNodeNames: Object.freeze(Object.fromEntries(TSK_WORLD_MAP_IDS.map(id => [
    id, campaignStoryText(`locations.${id}.name`) || id,
  ]))),
  // 幕间/状况报告/密档节点。
  interludeIds: TSK_INTERLUDE_IDS,
  statusReportThresholds: STATUS_REPORTS,
  statusReportNodes: TSK_STATUS_REPORT_NODE_BY_ID,
  statusReportNodeIds: TSK_STATUS_REPORT_STEPS.map(step => step.nodeId),
  dossierKeys: TSK_DOSSIER_KEYS.map(dossier => dossier.key),
  ticketStep: TSK_TICKET_STEP,
  sideStoryStep: TSK_SIDE_STORY_STEP,
  expeditedTicketCode: EXPEDITED_TICKET,
  // 存在抹除/战役禁用卡（构筑可用性读点）。
  invalidCampaignCards: ERASED_CAMPAIGN_CARDS,
  // 2026-11-13 P1-12：可公开的章节状态子键（不泄露正文/牌序/未揭示身份）。
  publicScenarioFlags: TSK_PUBLIC_SCENARIO_FLAGS,
})

// ---------------------------------------------------------------------------
// 5. 世界地图路由读点（只读；P8 大厅/地图面板使用）
// ---------------------------------------------------------------------------
/**
 * 世界地图节点停下后「必须先进入」的流程图节点（没有返回 null，表示由玩家选目的地）。
 *   1. 时间满 35 → `endgameApproach`（强制终章，参考 `travel` 的 `if t >= 35 then Tunguska`）；
 *   2. 待处理状况报告（按阈值排序）→ 对应状况报告节点（参考 `markTime` 的逐阈值演出）。
 * 不写状态：状况报告的排队由 `worldMap` 节点的处理器完成。
 */
export function nextWorldMapNode (state) {
  const forced = forcedDestination(state)
  if (forced) return { kind: 'endgame', nodeId: 'endgameApproach', mapNode: forced, forced: true }
  const time = Number(state?.campaign?.records?.time) || Number(worldMapState(state)?.time) || 0
  if (time >= TSK_FORCED_ENDGAME_TIME) {
    return { kind: 'endgame', nodeId: 'endgameApproach', mapNode: TSK_ENDGAME_MAP_NODE, forced: true }
  }
  const pending = statusReportState(state)?.pending || []
  for (const report of pending) {
    const nodeId = TSK_STATUS_REPORT_NODE_BY_ID[report]
    if (nodeId) return { kind: 'statusReport', nodeId, report }
  }
  return null
}

/** 目的地 → 进入节点（`tskTravelTarget` 的节点视角封装；未知/只路过返回 null）。 */
export function nodeForTravel (mapNodeId) {
  const target = TSK_TRAVEL_TRIGGERS[mapNodeId]
  if (!target || !target.stepId) return null
  return target.kind === 'endgame' ? 'endgameApproach' : target.stepId
}

// ---------------------------------------------------------------------------
// 6. 世界地图节点效果处理器
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function syncCampaignProgress (state, log) {
  const campaign = state.campaign
  const records = campaign.records || (campaign.records = {})
  const chapters = [...new Set((campaign.scenarioResults || []).map(result => result?.scenarioId).filter(Boolean))]
  records.chaptersCompleted = [...new Set([...(records.chaptersCompleted || []), ...chapters])]
  syncKeyRecords(state)
  const map = syncMapRecords(state)
  logLine(log, `🌍 世界地图：当前 ${records.currentLocation || '?'}；时间 ${records.time}；`
    + `已完成 ${records.chaptersCompleted.length} 章；已读状况报告 ${(records.statusReportsSeen || []).length} 段；`
    + `已访问 ${(records.mapVisitedLocations || []).length} 个地点。`)
  return map
}

export function runEmbarkEffect (state, effect, log) {
  const campaign = state?.campaign
  if (!campaign) throw new Error('世界地图效果需要 state.campaign')
  const records = campaign.records || (campaign.records = {})
  if (effect.event === 'embark') {
    syncCampaignProgress(state, log)
    // 排队到期的状况报告：演出顺序由 nextWorldMapNode 按阈值给出。
    let due = []
    try {
      due = queueStatusReports(state)
    } catch (error) {
      logLine(log, `⚠️ 状况报告排队失败：${error.message}`)
    }
    if (due.length) logLine(log, `📻 到期的状况报告：${due.map(report => report.toUpperCase()).join('、')}。`)
    if (Number(records.time) >= TSK_FORCED_ENDGAME_TIME) {
      records.tskEndgameForced = true
      logLine(log, `⌛ 时间已达 ${TSK_FORCED_ENDGAME_TIME}：必须启程前往通古斯卡。`)
    }
    return { due, time: records.time, location: records.currentLocation }
  }
  if (effect.event === 'endgameApproach') {
    syncCampaignProgress(state, log)
    const forced = Number(records.time) >= TSK_FORCED_ENDGAME_TIME
    records.tskEndgameForced = forced
    logLine(log, forced
      ? `🌌 时间已到：调查队被迫启程前往通古斯卡，钥匙议会即将开始。`
      : `🌌 调查队主动启程前往通古斯卡，钥匙议会即将开始。`)
    return { forced }
  }
  throw new Error(`未知世界地图效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(EMBARK_HANDLER_ID, runEmbarkEffect)

// ---------------------------------------------------------------------------
// 7. 构建期自检
// ---------------------------------------------------------------------------
/** 与 `src/engine/campaign-flow.js#progressCampaign` 相同的升级窗判据。 */
export function upgradeWindowForNode (node) {
  return node?.type === 'interlude' && node.upgrades !== false
}

/**
 * 构建期自检：flow 必须通过战役图注册期校验（失败即抛，内容注册时 fail closed）。
 * `scenarioIds` 可覆盖（单章夹具用），默认十一章顺序；`extraEffects` 允许调用方先登记处理器。
 */
export function validateTskFlow (flow = TSK_FLOW, { scenarioIds = TSK_SCENARIO_IDS } = {}) {
  return validateCampaignGraph({
    id: TSK_CAMPAIGN_ID,
    scenarioIds,
    recordSchema: TSK_RECORD_SCHEMA,
    flow,
  })
}

validateTskFlow()

// 反查表：节点 id → 所属步骤（账本/测试用；不参与引擎读点）。
export const TSK_STEP_OF_NODE = Object.freeze({
  ...Object.fromEntries(TSK_SCENARIO_IDS.map(id => [id, id])),
  ...Object.fromEntries(TSK_STATUS_REPORT_STEPS.map(step => [step.nodeId, step.id])),
  ...Object.fromEntries(TSK_DOSSIER_KEYS.map(dossier => [dossier.stepId, 'dossier'])),
  worldMap: TSK_WORLD_MAP_STEP,
  endgameApproach: TSK_ENDGAME_STEP,
  [TSK_PROLOGUE_STEP]: TSK_PROLOGUE_STEP,
  [TSK_END_STEP]: TSK_END_STEP,
})
