// 《绯红密钥》（The Scarlet Keys）· 战役推进骨架（P7）：步骤顺序、世界地图触发、nextStep 语义与正文键解析。
//
// 事实源（锁定，只读）：
//   · 参考实现 `backend/arkham-api/library/Arkham/Campaign/Campaigns/TheScarletKeys.hs`
//     的 `nextStep` / `travel` / `embark` / `InterludeStep` 分支；
//   · `Campaigns/TheScarletKeys/{CampaignSteps,Meta,Helpers,Keys}.hs`（ScenarioStep 卡号、36 节点世界地图、
//     状况报告阈值、快捷旅票）；
//   · `docs/campaign/theScarletKeys/README.md` §4「十章路线与战役推进骨架」；
//   · `content/campaigns/theScarletKeys/shared.js`（P0 锁定：十章身份、36 节点、17 段幕间、状况报告阈值、绿地）。
//
// 本文件**不写卡、不改引擎**：只有常量、纯函数与只读正文解析，供 flow.js / prologue.js /
// interludes.js / epilogue.js 与测试共用。节点正文只存 `textKey`，正文由本文件的
// `campaignStoryText` / `campaignStoryHeading` 统一读取（详见 §7 的解析口径）。
//
// 推进骨架（参考 nextStep 逐字镜像）：
//   序幕 prologue → 谜雨 riddlesAndRain → 幕间 I interlude1 → 世界地图 worldMap（启程循环）
//   启程循环里每个地图节点落到：章节 scenario（8 章）/ 密档幕间 interlude14…55 / 支线幕间 sideStory；
//   每次启程按耗时推进时间，跨越 7/10/15/20/24/θ/ψ/35 时依次触发状况报告 α/ε/β/ζ/γ/θ/ψ/ω；
//   时间满 35 或前往通古斯卡 → 钥匙议会 congressOfTheKeys → 尾声 epilogue → end。
import {
  CHAPTER_MAP_TRIGGERS, chapters, DYNAMIC_STATUS_REPORTS, GREEN_LOCATIONS, INITIAL_UNLOCKED, INTERLUDES,
  SIDE_STORY_LOCATIONS, START_LOCATION, STATUS_REPORTS, WORLD_MAP, WORLD_MAP_IDS,
} from './shared.js'
import { FORCED_ENDGAME_TIME_LIMIT, storyBody, storyHeading } from './records.js'
import { flattenStory } from './story-access.js'
import { TSK_STORY_TEXT } from './story-text.js'

export const TSK_CAMPAIGN_ID = 'theScarletKeys'

// ---------------------------------------------------------------------------
// 1. 步骤 id（参考实现的 CampaignStep 全集 × 引擎流程图节点）
// ---------------------------------------------------------------------------
export const TSK_PROLOGUE_STEP = 'prologue'
export const TSK_START_STEP = 'riddlesAndRain'
export const TSK_ENDGAME_STEP = 'congressOfTheKeys'
export const TSK_EPILOGUE_STEP = 'epilogue'
export const TSK_END_STEP = 'end'
// 世界地图启程段：引擎 `map` 节点（`src/engine/campaign-flow.js#progressCampaign` 停在节点交给战役行为）。
export const TSK_WORLD_MAP_STEP = 'worldMap'
// 时间满 35 强制前往通古斯卡（Helpers.hs/`travel`：`if t >= 35 then Tunguska`）。
export const TSK_FORCED_ENDGAME_TIME = FORCED_ENDGAME_TIME_LIMIT
export const TSK_ENDGAME_MAP_NODE = 'Tunguska'

// ---------------------------------------------------------------------------
// 2. 十章（世界地图章节节点）
// ---------------------------------------------------------------------------
// chapters 顺序 = 参考 CampaignSteps.hs 的 ScenarioStep 卡号顺序 = 推荐验收顺序；
// 除首章《谜雨》（伦敦序幕关）与终章《钥匙议会》（通古斯卡）外，其余八章由玩家自由规划航线按时间解锁。
export const TSK_SCENARIO_UNITS = Object.freeze(chapters.map(chapter => Object.freeze({
  id: chapter.id,
  chapter: chapter.id,
  cardCode: chapter.referenceCode,
  code: chapter.referenceCode,
  name: chapter.name,
  nameEn: chapter.nameEn,
  mapLocationId: chapter.mapLocationId,
  archiveLabel: chapter.archiveLabel,
  encounterCode: chapter.encounterCode,
  chapterStep: chapter.id,
})))
export const TSK_SCENARIO_IDS = Object.freeze(TSK_SCENARIO_UNITS.map(unit => unit.id))
// 十章都在主线上（没有《致命幻景》式的可选章节）：跳段由世界地图航线决定，不由 skip 标记决定。
export const TSK_MAINLINE_SCENARIO_IDS = TSK_SCENARIO_IDS
export const TSK_ENDGAME_SCENARIO_ID = TSK_ENDGAME_STEP

/** 章节单元（未知 id 返回 null）。 */
export function scenarioUnitOf (id) {
  return TSK_SCENARIO_UNITS.find(unit => unit.id === id) || null
}

/** 地图节点 → 章节 id（《谜雨》在序幕直接开始，故不在表里）。 */
export const TSK_CHAPTER_MAP_TRIGGERS = Object.freeze({ ...CHAPTER_MAP_TRIGGERS })

// ---------------------------------------------------------------------------
// 3. 幕间（17 段：幕间 I + 16 段世界地图密档幕间）
// ---------------------------------------------------------------------------
// shared.js#INTERLUDES 的第 1 段是幕间 I（序幕后、启程前），其余 16 段是世界地图节点触发的密档幕间。
export const TSK_INTERLUDE_STEPS = Object.freeze(INTERLUDES.map(interlude => Object.freeze({
  id: `interlude${interlude.number}`,
  number: interlude.number,
  scopeId: interlude.scopeId,
  kind: interlude.kind || (interlude.number === 1 ? 'campaign' : 'dossier'),
  triggerLocations: interlude.triggerLocations,
  headingKey: `headings.interludes.${interlude.number}`,
  titleKey: `${interlude.scopeId}.title`,
})))
export const TSK_INTERLUDE_IDS = Object.freeze(TSK_INTERLUDE_STEPS.map(step => step.id))
// 幕间 I 之外的 16 段世界地图密档幕间（documents/README §4 的 14–55）。
export const TSK_DOSSIER_INTERLUDE_IDS = Object.freeze(
  TSK_INTERLUDE_STEPS.filter(step => step.number !== 1).map(step => step.id))

/** 幕间步骤（未知 id 返回 null）。 */
export function interludeStepOf (id) {
  return TSK_INTERLUDE_STEPS.find(step => step.id === id) || null
}

/** 世界地图节点 → 幕间步骤（14/20/26/27/32/36/37/44/45/49/50/51/52/53/54/55）。 */
export const TSK_INTERLUDE_MAP_TRIGGERS = Object.freeze(Object.fromEntries(
  TSK_INTERLUDE_STEPS
    .filter(step => step.triggerLocations.length)
    .flatMap(step => step.triggerLocations.map(location => [location, step.id])),
))

// ---------------------------------------------------------------------------
// 4. 状况报告（α–ω）
// ---------------------------------------------------------------------------
// 固定阈值来自 Helpers.hs#markTime；θ/ψ 由剧情写入时间点（幕间 32 写 ψ、幕间 44/55 写 δ 供幕间 45、
// 圣所 F4 线索写 θ —— P7 只登记阈值与节点，写入由 interludes.js 的处理器完成）。
export const TSK_STATUS_REPORT_IDS = Object.freeze([
  ...STATUS_REPORTS.map(report => report.report),
  ...DYNAMIC_STATUS_REPORTS,
])
export const TSK_STATUS_REPORT_STEPS = Object.freeze([
  ...STATUS_REPORTS.map(report => Object.freeze({
    id: report.report,
    nodeId: `statusReport${report.report[0].toUpperCase()}${report.report.slice(1)}`,
    threshold: report.threshold,
    dynamic: false,
    titleKey: 'statusReport.title',
    textKey: `statusReport.${report.report}`,
  })),
  ...DYNAMIC_STATUS_REPORTS.map(report => Object.freeze({
    id: report,
    nodeId: `statusReport${report[0].toUpperCase()}${report.slice(1)}`,
    threshold: null,
    dynamic: true,
    titleKey: 'statusReport.title',
    textKey: `statusReport.${report}`,
  })),
])
export const TSK_STATUS_REPORT_NODE_BY_ID = Object.freeze(Object.fromEntries(
  TSK_STATUS_REPORT_STEPS.map(step => [step.id, step.nodeId])))

/** 状况报告步骤（未知 id 返回 null）。 */
export function statusReportStepOf (id) {
  return TSK_STATUS_REPORT_STEPS.find(step => step.id === id) || null
}

// ---------------------------------------------------------------------------
// 5. 世界地图（启程循环）
// ---------------------------------------------------------------------------
// 36 节点（Meta.hs#worldMap）。initialUnlocked = Meta.hs#initUnlockedLocations；
// startLocation = London（initMeta 的 currentLocation）。
export const TSK_WORLD_MAP = WORLD_MAP
export const TSK_WORLD_MAP_IDS = WORLD_MAP_IDS
export const TSK_INITIAL_UNLOCKED = INITIAL_UNLOCKED
export const TSK_START_LOCATION = START_LOCATION
export const TSK_GREEN_LOCATIONS = GREEN_LOCATIONS
export const TSK_SIDE_STORY_LOCATIONS = SIDE_STORY_LOCATIONS

// 密档（Foundation Dossier）：14 份，覆盖世界地图上所有「带档案号」的空间。
// 触发节点是该密档在世界地图上可阅读的空间（Sanctums = 26–G 的六座圣所，DrIrawan = 44–O/55–X）。
export const TSK_DOSSIER_KEYS = Object.freeze([
  Object.freeze({ key: 'Marrakesh', nodes: Object.freeze(['Marrakesh']), stepId: 'dossierMarrakesh' }),
  Object.freeze({ key: 'BuenosAires', nodes: Object.freeze(['BuenosAires']), stepId: 'dossierBuenosAires' }),
  Object.freeze({ key: 'Constantinople', nodes: Object.freeze(['Constantinople']), stepId: 'dossierConstantinople' }),
  Object.freeze({ key: 'Sanctums', nodes: Object.freeze(['Moscow', 'SanFrancisco']), stepId: 'dossierSanctums' }),
  Object.freeze({ key: 'Havana', nodes: Object.freeze(['Havana']), stepId: 'dossierHavana' }),
  Object.freeze({ key: 'Shanghai', nodes: Object.freeze(['Shanghai']), stepId: 'dossierShanghai' }),
  Object.freeze({ key: 'Anchorage', nodes: Object.freeze(['Anchorage']), stepId: 'dossierAnchorage' }),
  Object.freeze({ key: 'Tokyo', nodes: Object.freeze(['Tokyo']), stepId: 'dossierTokyo' }),
  Object.freeze({ key: 'Alexandria', nodes: Object.freeze(['Alexandria']), stepId: 'dossierAlexandria' }),
  Object.freeze({ key: 'DrIrawan', nodes: Object.freeze(['RioDeJaneiro', 'Manokwari']), stepId: 'dossierDrIrawan' }),
  Object.freeze({ key: 'Sydney', nodes: Object.freeze(['Sydney']), stepId: 'dossierSydney' }),
  Object.freeze({ key: 'YborCity', nodes: Object.freeze(['YborCity']), stepId: 'dossierYborCity' }),
  Object.freeze({ key: 'Kathmandu', nodes: Object.freeze(['Kathmandu']), stepId: 'dossierKathmandu' }),
  Object.freeze({ key: 'Nairobi', nodes: Object.freeze(['Nairobi']), stepId: 'dossierNairobi' }),
])
export const TSK_DOSSIER_KEYS_BY_NODE = Object.freeze(Object.fromEntries(
  TSK_DOSSIER_KEYS.flatMap(dossier => dossier.nodes.map(node => [node, dossier.key]))))

/** 密档正文键（`worldMap.dossiers.<Key>`）。 */
export function dossierTextKey (key) {
  return `worldMap.dossiers.${key}`
}

/** 地图节点可阅读的密档步骤（无密档返回 null）。 */
export function dossierStepOf (mapNodeId) {
  const key = TSK_DOSSIER_KEYS_BY_NODE[mapNodeId]
  return key ? TSK_DOSSIER_KEYS.find(dossier => dossier.key === key) : null
}

// 启程循环里的特殊节点：快捷旅票（09765）与绿地支线幕间。
export const TSK_TICKET_STEP = 'expeditedTicket'
export const TSK_SIDE_STORY_STEP = 'sideStory'

// 地图节点 → 到达后进入的流程图节点（参考 Campaigns/TheScarletKeys.hs#travel 的 case 分支逐条镜像）。
//   kind: 'scenario' 章节 / 'interlude' 密档幕间 / 'sideStory' 绿地支线 / 'endgame' 终章
export const TSK_TRAVEL_TRIGGERS = Object.freeze(Object.fromEntries(WORLD_MAP_IDS.map(nodeId => {
  const chapter = TSK_SCENARIO_UNITS.find(unit => unit.mapLocationId === nodeId && unit.id !== TSK_START_STEP)
  const interlude = TSK_INTERLUDE_MAP_TRIGGERS[nodeId]
  if (nodeId === TSK_ENDGAME_MAP_NODE) {
    return [nodeId, Object.freeze({ kind: 'endgame', stepId: TSK_ENDGAME_STEP, nodeId })]
  }
  if (chapter) return [nodeId, Object.freeze({ kind: 'scenario', stepId: chapter.id, scenarioId: chapter.id })]
  if (interlude) return [nodeId, Object.freeze({ kind: 'interlude', stepId: interlude })]
  if (TSK_SIDE_STORY_LOCATIONS.includes(nodeId)) return [nodeId, Object.freeze({ kind: 'sideStory', stepId: TSK_SIDE_STORY_STEP })]
  // 只路过、没有剧情的空间（Cairo 等绿地之外的普通/锁定节点，以及 London 起点）。
  return [nodeId, Object.freeze({ kind: 'passThrough', stepId: null })]
})))

/** 旅行到某地图节点后应进入的步骤（未知节点返回 null；时间满 35 由调用方先走强制终局）。 */
export function tskTravelTarget (mapNodeId) {
  return TSK_TRAVEL_TRIGGERS[mapNodeId] || null
}

// 状况报告 / 剧情解锁的地图节点（参考 statusReport 分支与各幕间 `campaignSpecific "unlock"`）。
export const TSK_UNLOCK_RULES = Object.freeze([
  Object.freeze({ source: 'statusReport.beta', report: 'beta', nodes: Object.freeze([TSK_ENDGAME_MAP_NODE]), stepId: null }),
  Object.freeze({ source: 'statusReport.zeta', report: 'zeta', nodes: Object.freeze(['Kabul', 'Quito', 'SanJuan', 'Reykjavik']), stepId: null }),
  Object.freeze({ source: 'statusReport.psi', report: 'psi', nodes: Object.freeze(['HongKong']), stepId: null }),
  Object.freeze({ source: 'interlude32Step5', report: null, nodes: Object.freeze(['HongKong']), stepId: 'interlude32' }),
  Object.freeze({ source: 'interlude44Step2', report: null, nodes: Object.freeze(['Manokwari']), stepId: 'interlude44' }),
  Object.freeze({ source: 'interlude49Step2', report: null, nodes: Object.freeze(['London']), stepId: 'interlude49' }),
  Object.freeze({ source: 'interlude49Step3', report: null, nodes: Object.freeze(['London']), stepId: 'interlude49' }),
  Object.freeze({ source: 'interlude50', report: null, nodes: Object.freeze(['KualaLumpur']), stepId: 'interlude50' }),
  Object.freeze({ source: 'interlude51Step1', report: null, nodes: Object.freeze(['BermudaTriangle']), stepId: 'interlude51' }),
  Object.freeze({ source: 'interlude55Step2', report: null, nodes: Object.freeze(['Manokwari']), stepId: 'interlude55' }),
])

/** 某个来源（状况报告 / 幕间步骤）解锁的地图节点列表。 */
export function tskUnlockNodesFor (source) {
  return TSK_UNLOCK_RULES.filter(rule => rule.source === source).flatMap(rule => rule.nodes)
}

// ---------------------------------------------------------------------------
// 6. 步骤顺序与 nextStep 语义
// ---------------------------------------------------------------------------
// 参考 nextStep（逐条镜像；顺序即 CampaignStep 出现顺序）：
//   PrologueStep → RiddlesAndRain → InterludeStep 1 → embark
//   8 章 / 16 段密档幕间 → embark；CongressOfTheKeys → EpilogueStep；EpilogueStep → 结束。
export const TSK_CAMPAIGN_STEPS = Object.freeze([
  TSK_PROLOGUE_STEP,
  TSK_START_STEP,
  'interlude1',
  ...TSK_DOSSIER_INTERLUDE_IDS,
  ...TSK_SCENARIO_IDS.filter(id => id !== TSK_START_STEP && id !== TSK_ENDGAME_STEP),
  TSK_ENDGAME_STEP,
  TSK_EPILOGUE_STEP,
])

// 流程图里的节点出现顺序（含引擎专用节点：世界地图段、状况报告、密档、快捷旅票、支线幕间）。
export const TSK_NODE_ORDER = Object.freeze([
  TSK_PROLOGUE_STEP,
  'prologueRules',
  TSK_START_STEP,
  'interlude1',
  TSK_WORLD_MAP_STEP,
  ...TSK_DOSSIER_INTERLUDE_IDS,
  ...TSK_STATUS_REPORT_STEPS.map(step => step.nodeId),
  ...TSK_DOSSIER_KEYS.map(dossier => dossier.stepId),
  TSK_TICKET_STEP,
  TSK_SIDE_STORY_STEP,
  ...TSK_SCENARIO_IDS.filter(id => id !== TSK_START_STEP && id !== TSK_ENDGAME_STEP),
  TSK_ENDGAME_STEP,
  TSK_EPILOGUE_STEP,
  TSK_END_STEP,
])

// 静态 nextStep（数组 = 参考实现的候选出口顺序；世界地图段由 `worldMap` 节点接管，见 tskNextStep）。
export const TSK_NEXT_STEP = Object.freeze({
  [TSK_PROLOGUE_STEP]: Object.freeze([TSK_START_STEP]),
  [TSK_START_STEP]: Object.freeze(['interlude1']),
  interlude1: Object.freeze([TSK_WORLD_MAP_STEP]),
  [TSK_WORLD_MAP_STEP]: Object.freeze([TSK_ENDGAME_STEP]),
  [TSK_ENDGAME_STEP]: Object.freeze([TSK_EPILOGUE_STEP]),
  [TSK_EPILOGUE_STEP]: Object.freeze([]),
  // 8 章与 16 段密档幕间完成后都回到启程循环（参考 `campaignStep_ (embark attrs)`）。
  ...Object.fromEntries(TSK_DOSSIER_INTERLUDE_IDS.map(id => [id, Object.freeze([TSK_WORLD_MAP_STEP])])),
  ...Object.fromEntries(TSK_SCENARIO_IDS
    .filter(id => id !== TSK_START_STEP && id !== TSK_ENDGAME_STEP)
    .map(id => [id, Object.freeze([TSK_WORLD_MAP_STEP])])),
  // 状况报告/密档/快捷旅票/支线幕间是「启程循环内的插入段」：读完回到世界地图。
  ...Object.fromEntries(TSK_STATUS_REPORT_STEPS.map(step => [step.nodeId, Object.freeze([TSK_WORLD_MAP_STEP])])),
  ...Object.fromEntries(TSK_DOSSIER_KEYS.map(dossier => [dossier.stepId, Object.freeze([TSK_WORLD_MAP_STEP])])),
  [TSK_TICKET_STEP]: Object.freeze([TSK_WORLD_MAP_STEP]),
  [TSK_SIDE_STORY_STEP]: Object.freeze([TSK_WORLD_MAP_STEP]),
})

/**
 * 参考实现 `nextStep` 的纯函数镜像：给定当前步骤返回下一批候选步骤（空数组 = 战役结束）。
 * `context.time` 给出当前时间（缺省从 records 读）；时间达到 35 时启程只能去通古斯卡。
 */
export function tskNextStep (stepId, context = {}) {
  const time = Number(context.time ?? context.records?.time ?? 0)
  if (stepId === TSK_WORLD_MAP_STEP) {
    // 启程循环：时间到点强制终章，否则由玩家选目的地（候选 = 未访问过的已解锁节点）。
    if (time >= TSK_FORCED_ENDGAME_TIME) return [TSK_ENDGAME_STEP]
    return []
  }
  const next = TSK_NEXT_STEP[stepId]
  return next ? [...next] : []
}

/** 步骤是否属于主线（序幕 / 谜雨 / 幕间 I / 十章 / 尾声；不含启程循环内的插入段）。 */
export function isMainlineStep (stepId) {
  return TSK_CAMPAIGN_STEPS.includes(stepId)
}

// ---------------------------------------------------------------------------
// 7. 正文键解析（textKey → 中文展示文本）
// ---------------------------------------------------------------------------
// 口径：流程节点只存 textKey。`records.storyBody` 读的是 story-text 的 `keys` 视图，
// 而该视图按「顶层分组子树」重建、路径前缀丢失（`chineseGaps` 逐键为 missing），
// 当前生成物下会把 campaign 正文回退成英文。P7 流程层因此优先读生成物的**展示树**
// `TSK_STORY_TEXT.campaign.sections`（与 guide 生成器同一来源，已含本地补充层、中文齐全），
// 再回退到 `records.storyBody`/`storyHeading`（生成物修正 keys 视图后两条通道一致）。
// 这里不是第二套文案：正文仍只来自 story-text，节点里没有手写死字符串。
const CAMPAIGN_SECTIONS = TSK_STORY_TEXT.campaign?.sections ?? {}

/** 与 records.js 同口径的 HTML → 纯文本归一（生成物正文是带 HTML 的 locale 文本）。 */
function plainText (value) {
  return String(value ?? '')
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sectionOf (path) {
  let cursor = CAMPAIGN_SECTIONS
  for (const segment of String(path ?? '').split('.')) {
    if (cursor == null || typeof cursor !== 'object') return null
    cursor = Array.isArray(cursor) ? cursor[Number(segment)] : cursor[segment]
    if (cursor == null) return null
  }
  return cursor
}

/** 展示树里某路径的纯文本（叶节点字符串或 {title, body} 子树）。 */
function sectionText (value) {
  if (value == null) return ''
  if (typeof value === 'string') return plainText(value)
  if (typeof value !== 'object') return ''
  if (typeof value.body === 'string') return plainText(value.body)
  if (typeof value.title === 'string') return plainText(value.title)
  return plainText(flattenStory(value))
}

/** 战役正文：`prologue` / `interlude1.theFoundation1` / `statusReport.alpha` / `worldMap.dossiers.Havana`。 */
export function campaignStoryText (path) {
  const text = sectionText(sectionOf(path))
  return text || storyBody(path)
}

/** 战役小标题：`headings.interludes.14` / `interlude1`（取 `.title`）等。 */
export function campaignStoryHeading (path) {
  const node = sectionOf(`${path}.title`)
  const heading = sectionText(node)
  if (heading) return heading
  const section = sectionOf(path)
  if (typeof section === 'string') return plainText(section)
  return storyHeading(path)
}

/** 展示树里的选项标签（`interlude1.label.tell` 等）。 */
export function campaignStoryLabel (path) {
  const text = sectionText(sectionOf(path))
  return text || storyBody(path)
}

/** 记录键的中文标签（Key.hs 复选框；`sections.key.<key>`）。 */
export function campaignRecordLabel (key) {
  return sectionText(sectionOf(`key.${key}`)) || ''
}

/** 密档小标题（`locations.<Node>.subtitle`，例如「档案#28-I」）。 */
export function mapNodeArchiveLabel (mapNodeId) {
  return campaignStoryText(`locations.${mapNodeId}.subtitle`)
}
