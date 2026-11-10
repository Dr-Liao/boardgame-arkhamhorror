// 八循环《绯红密钥》P2 原语：世界地图启程（Embark）、时间轴（Time）与状况报告。
//
// 覆盖 P1 原语目录：
//   · new.worldMap        —— 地图状态：当前位置/已访问/已解锁/时间（不存图结构，图由内容层传入）
//   · new.travelTime      —— 旅行耗时：普通节点 1、绿地 0、目的地绿地 +1（参考 campaign travel）
//   · new.embarkChoice    —— 启程候选（目的地/耗时/是否解锁/是否强制）
//   · new.statusReports   —— 时间阈值触发 α–ω；θ/ψ 由剧情指定时间；效果以描述符返回给内容层
//   · new.expeditedTicket —— 快捷旅票：记 1 时间直达任意目的地（放逐由内容层完成）
//   · new.mapNodeUnlocks  —— 剧情解锁地图节点 / 时间满阈值强制通古斯卡
//   · new.sideStories     —— 绿地节点触发的独立冒险（只登记状态与选择载荷）
//   · new.dossierReading  —— 战役地图密档的解锁/已读状态
//   · extend.campaignFlow —— 在战役图里新增 `map` 节点类型（见 src/campaign/campaign-flow.js）
//   · extend.choices      —— 启程/密档的合法动作载荷
//   · core.mapGraph       —— 图查询复用（0-1 加权距离见 src/engine/map-graph.js#weightedDistance）
//
// 状态（战役级，跨关持久）：
//   campaign.tsk.map          = { version:1, current, visited[], unlocked[], time, forcedNode? }
//   campaign.tsk.statusReports= { version:1, triggered[], pending[], theta, psi }
//   campaign.tsk.dossiers     = { version:1, unlocked[], read[] }
//   campaign.tsk.sideStories  = { version:1, completed[] }
//
// 口径：引擎不认地图节点名/卡号——图（nodes/绿地/强制节点）由内容层在调用时传入。
import { assertTskFields, assertTskObject, assertCodeList, tskCampaignState } from './tsk-state.js'
import { weightedDistance } from './map-graph.js'

export const MAP_STATE_VERSION = 1
export const DYNAMIC_STATUS_REPORTS = Object.freeze(['theta', 'psi'])
const REPORT_IDS = Object.freeze(['alpha', 'beta', 'epsilon', 'zeta', 'gamma', 'theta', 'psi', 'omega'])

function campaignOf(state, create = false) {
  return tskCampaignState(state, create)
}

function mapState(state, create = false) {
  const campaign = campaignOf(state, create)
  if (!campaign) return null
  if (create) return campaign.map ||= { version: MAP_STATE_VERSION, current: null, visited: [], unlocked: [], time: 0, forcedNode: null }
  return campaign.map || null
}

function graphError(graph) {
  if (!graph || !Array.isArray(graph.nodes)) throw new TypeError('世界地图需要 { nodes } 图结构')
  const byId = new Map()
  for (const node of graph.nodes) {
    assertTskObject(node, '地图节点')
    if (typeof node.id !== 'string' || !node.id) throw new TypeError('地图节点 id 无效')
    if (byId.has(node.id)) throw new TypeError(`地图节点重复：${node.id}`)
    if (!Array.isArray(node.connections) || node.connections.some(to => typeof to !== 'string' || !to)) throw new TypeError('地图节点连接无效')
    const type = node.type ?? 'standard'
    if (!['standard', 'locked', 'side'].includes(type)) throw new TypeError('地图节点类型必须是 standard/locked/side')
    byId.set(node.id, { id: node.id, type, connections: [...node.connections] })
  }
  for (const node of byId.values()) for (const to of node.connections) if (!byId.has(to)) throw new RangeError(`地图节点连接了未知节点 ${to}`)
  return byId
}

function requireNode(byId, id, label = '地图节点') {
  if (typeof id !== 'string' || !byId.has(id)) throw new RangeError(`未知${label} ${JSON.stringify(id)}`)
  return byId.get(id)
}

/**
 * 初始化世界地图（战役 setup）：start 必须在图里；unlocked 缺省包含 start。
 * 重复初始化拒绝（避免跨关 setup 覆盖时间轴）。
 */
export function initializeWorldMap(state, { graph, start, unlocked = [], forcedNode = null } = {}) {
  const byId = graphError(graph)
  requireNode(byId, start, '起点')
  const campaign = campaignOf(state, true)
  if (campaign.map) throw new Error('世界地图已经初始化')
  const uniqueUnlocked = [...new Set([start, ...unlocked])]
  for (const id of uniqueUnlocked) requireNode(byId, id, '初始解锁节点')
  if (forcedNode != null) requireNode(byId, forcedNode, '强制目的地')
  campaign.map = { version: MAP_STATE_VERSION, current: start, visited: [start], unlocked: uniqueUnlocked, time: 0, forcedNode }
  return { ...campaign.map, visited: [...campaign.map.visited], unlocked: [...campaign.map.unlocked] }
}

/** 地图状态（只读副本）；未初始化返回 null。 */
export function worldMapState(state) {
  const map = mapState(state)
  return map ? { ...map, visited: [...map.visited], unlocked: [...map.unlocked] } : null
}

/** 当前所在地图节点；未初始化返回 null。 */
export function currentMapNode(state) {
  return mapState(state)?.current ?? null
}

/** 时间累计值；未初始化返回 0。 */
export function mapTime(state) {
  return mapState(state)?.time ?? 0
}

/** 已访问/已解锁节点列表（只读副本）。 */
export function mapVisited(state) {
  return [...(mapState(state)?.visited || [])]
}

export function mapUnlocked(state) {
  return [...(mapState(state)?.unlocked || [])]
}

/** 单次旅行的耗时：目的地绿地 +1；图内距离按「进入非绿地节点计 1、绿地计 0」的 0-1 BFS 计算。 */
export function travelTimeCost(graph, { from, to } = {}) {
  const byId = graphError(graph)
  requireNode(byId, from, '起点')
  requireNode(byId, to, '目的地')
  const distance = weightedDistance([...byId.values()], from, to, node => node.type === 'side' ? 0 : 1)
  if (distance == null) throw new RangeError(`${from} 到 ${to} 之间没有航路`)
  return distance + (byId.get(to).type === 'side' ? 1 : 0)
}

/** 解锁一个地图节点（幂等）；非法节点拒绝。 */
export function unlockMapNode(state, id, { graph } = {}) {
  const byId = graphError(graph)
  requireNode(byId, id)
  const map = mapState(state, true)
  if (!map.unlocked.includes(id)) map.unlocked.push(id)
  return [...map.unlocked]
}

/** 时间满强制节点阈值时，启程只能去 forcedNode（参考 travel 的 `if t >= 35 then Tunguska`）。 */
export function forcedDestination(state) {
  const map = mapState(state)
  if (!map) return null
  return map.time >= FORCED_TIME_THRESHOLD ? map.forcedNode : null
}

export const FORCED_TIME_THRESHOLD = 35

/**
 * 启程候选（Embark）：返回所有目的地的耗时/是否解锁/是否强制。
 * 强制目的地出现时，其它目的地标记 forcedBlocked（P4 面板据此置灰）。
 */
export function embarkOptions(state, { graph } = {}) {
  const byId = graphError(graph)
  const map = mapState(state, true)
  const from = map.current
  requireNode(byId, from, '当前节点')
  const forced = forcedDestination(state)
  const options = [...byId.values()].map(node => {
    let cost = null
    try {
      cost = travelTimeCost(graph, { from, to: node.id })
    } catch {
      cost = null
    }
    return {
      destination: node.id,
      cost,
      reachable: cost != null,
      unlocked: map.unlocked.includes(node.id),
      sideStory: node.type === 'side',
      forcedBlocked: forced != null && node.id !== forced,
    }
  }).filter(option => option.reachable)
  return { from, forced, time: map.time, options: options.sort((a, b) => a.destination.localeCompare(b.destination)) }
}

/**
 * 旅行到目的地：校验解锁与可达；耗时 = travelTimeCost（快捷旅票走 useExpeditedTicket）。
 * 若时间累计达阈值则改去强制节点（并把这作为实际目的地返回）。
 * 返回 { from, to, requested, cost, time, forced }。
 */
export function travelTo(state, { graph, destination } = {}) {
  const byId = graphError(graph)
  const map = mapState(state, true)
  const from = map.current
  requireNode(byId, destination, '目的地')
  const forced = forcedDestination(state)
  if (forced != null && destination !== forced) throw new Error(`时间已达 ${FORCED_TIME_THRESHOLD}，只能前往强制目的地`)
  // 强制目的地由剧情指定，不要求事先解锁（时间到点即被迫启程）。
  if (forced == null && !map.unlocked.includes(destination)) throw new Error(`地图节点 ${destination} 尚未解锁`)
  const cost = travelTimeCost(graph, { from, to: destination })
  map.current = destination
  map.time += cost
  if (!map.visited.includes(destination)) map.visited.push(destination)
  return { from, to: destination, requested: destination, cost, time: map.time, forced: forced != null }
}

/**
 * 快捷旅票（09765 的通用原语）：放逐/使用的动作由内容层完成；本函数只记 1 时间并直达任意目的地。
 * 目的地无需解锁（规则：任意地点，含锁定节点）；图内不可达时拒绝。
 */
export function useExpeditedTicket(state, { graph, destination } = {}) {
  const byId = graphError(graph)
  const map = mapState(state, true)
  const from = map.current
  requireNode(byId, destination, '目的地')
  if (destination === from) throw new Error('快捷旅票不能用于原地')
  // 图必须保证目的地与当前节点同连通域，否则票也无法到达（不做静默传送）。
  try {
    travelTimeCost(graph, { from, to: destination })
  } catch {
    throw new RangeError(`快捷旅票无法到达 ${destination}`)
  }
  map.current = destination
  map.time += 1
  map.unlocked ||= []
  if (!map.unlocked.includes(destination)) map.unlocked.push(destination)
  if (!map.visited.includes(destination)) map.visited.push(destination)
  return { from, to: destination, cost: 1, time: map.time }
}

// ---------------------------------------------------------------------------
// 状况报告（α–ω）
// ---------------------------------------------------------------------------
function statusState(state, create = false) {
  const campaign = campaignOf(state, create)
  if (!campaign) return null
  if (create) {
    campaign.statusReports ||= { version: MAP_STATE_VERSION, triggered: [], pending: [], theta: null, psi: null }
    return campaign.statusReports
  }
  return campaign.statusReports || null
}

/**
 * 初始化状况报告状态：thresholds 是 [{ report, threshold }]（内容层从指南读入），
 * dynamic 由剧情在指定时间点写入 θ/ψ。
 */
export function initializeStatusReports(state, { thresholds } = {}) {
  if (!Array.isArray(thresholds) || !thresholds.length) throw new TypeError('状况报告需要阈值表')
  const container = statusState(state, true)
  if (container.triggered.length || container.pending.length) throw new Error('状况报告已经初始化')
  container.thresholds = thresholds.map(entry => {
    assertTskFields(entry, ['report', 'threshold'], '状况报告阈值')
    if (!REPORT_IDS.includes(entry.report)) throw new TypeError(`未知状况报告 ${entry.report}`)
    if (!Number.isSafeInteger(entry.threshold) || entry.threshold < 1) throw new TypeError('状况报告阈值必须是正整数')
    return { report: entry.report, threshold: entry.threshold }
  }).sort((a, b) => a.threshold - b.threshold)
  return { ...container, thresholds: container.thresholds.map(entry => ({ ...entry })) }
}

/** 剧情写入 θ/ψ 的时间点（动态状况报告）。 */
export function setDynamicStatusReport(state, report, threshold) {
  if (!DYNAMIC_STATUS_REPORTS.includes(report)) throw new TypeError('动态状况报告只有 theta/psi')
  if (!Number.isSafeInteger(threshold) || threshold < 1) throw new TypeError('动态状况报告阈值必须是正整数')
  const container = statusState(state, true)
  container[report] = threshold
  return threshold
}

/** 当前时间应触发但尚未处理的状况报告（按阈值排序）。 */
export function statusReportsDue(state, { time = mapTime(state) } = {}) {
  const container = statusState(state)
  if (!container) return []
  const fixed = container.thresholds || []
  const dynamic = DYNAMIC_STATUS_REPORTS
    .filter(report => Number.isSafeInteger(container[report]))
    .map(report => ({ report, threshold: container[report] }))
  return [...fixed, ...dynamic]
    .filter(entry => entry.threshold <= time
      && !container.triggered.includes(entry.report)
      && !container.pending.includes(entry.report))
    .sort((a, b) => a.threshold - b.threshold || a.report.localeCompare(b.report))
}

/**
 * 把到期的状况报告排入待处理队列；返回新增的 report id 列表。
 * 效果（追 cultist/解锁节点/偷密钥/加诡计）由内容层按描述符执行，引擎只调度。
 */
export function queueStatusReports(state) {
  const due = statusReportsDue(state)
  const container = statusState(state, true)
  for (const entry of due) if (!container.pending.includes(entry.report)) container.pending.push(entry.report)
  return due.map(entry => entry.report)
}

/**
 * 结算一份待处理状况报告：`effects` 是内容层提供的效果描述符（引擎不解释字段），
 * 返回 { report, effects }；已排队才可结算，重复结算拒绝。
 */
export function resolveStatusReport(state, report, effects = null) {
  const container = statusState(state, true)
  if (!container.pending.includes(report)) throw new Error(`状况报告 ${report} 不在待处理队列`)
  container.pending = container.pending.filter(item => item !== report)
  if (!container.triggered.includes(report)) container.triggered.push(report)
  return { report, effects: effects == null ? null : structuredClone(effects) }
}

/** 已触发/待处理状况报告列表（只读）。 */
export function statusReportState(state) {
  const container = statusState(state)
  return container ? structuredClone(container) : null
}

// ---------------------------------------------------------------------------
// 密档（Dossier）与 Side story
// ---------------------------------------------------------------------------
function dossierState(state, create = false) {
  const campaign = campaignOf(state, create)
  if (!campaign) return null
  if (create) return campaign.dossiers ||= { version: MAP_STATE_VERSION, unlocked: [], read: [] }
  return campaign.dossiers || null
}

/** 解锁一份地图密档（幂等）；key 由内容层命名（如 map node / dossier key）。 */
export function unlockDossier(state, key) {
  if (typeof key !== 'string' || !key) throw new TypeError('密档 key 无效')
  const container = dossierState(state, true)
  if (!container.unlocked.includes(key)) container.unlocked.push(key)
  return [...container.unlocked]
}

/** 标记密档已读；未解锁不能读。 */
export function readDossier(state, key) {
  const container = dossierState(state, true)
  if (!container.unlocked.includes(key)) throw new Error(`密档 ${key} 尚未解锁`)
  if (!container.read.includes(key)) container.read.push(key)
  return [...container.read]
}

export function dossiers(state) {
  const container = dossierState(state)
  return container ? { unlocked: [...container.unlocked], read: [...container.read] } : { unlocked: [], read: [] }
}

function sideStoryState(state, create = false) {
  const campaign = campaignOf(state, create)
  if (!campaign) return null
  if (create) return campaign.sideStories ||= { version: MAP_STATE_VERSION, completed: [] }
  return campaign.sideStories || null
}

/** 完成一个 side story（记状态；内容层负责实际剧本流程）。 */
export function completeSideStory(state, id) {
  if (typeof id !== 'string' || !id) throw new TypeError('side story id 无效')
  const container = sideStoryState(state, true)
  if (!container.completed.includes(id)) container.completed.push(id)
  return [...container.completed]
}

export function completedSideStories(state) {
  return [...(sideStoryState(state)?.completed || [])]
}

/** 地图/启程/密档的合法动作载荷（extend.choices）。 */
export function mapChoices(state, { graph } = {}) {
  const embark = graph && worldMapState(state) ? embarkOptions(state, { graph }) : null
  return {
    map: worldMapState(state),
    embark,
    dossiers: dossiers(state),
    sideStories: completedSideStories(state),
    statusReports: statusReportState(state),
  }
}

// ---------------------------------------------------------------------------
// 读档校验
// ---------------------------------------------------------------------------
export function validateTskMap(state, value = mapState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'current', 'visited', 'unlocked', 'time', 'forcedNode'], '世界地图状态')
  if (value.version !== MAP_STATE_VERSION) throw new TypeError(`不支持的世界地图版本 ${value.version}`)
  if (value.current != null && typeof value.current !== 'string') throw new TypeError('地图当前位置无效')
  assertCodeList(value.visited, '地图已访问节点')
  assertCodeList(value.unlocked, '地图已解锁节点')
  if (!Number.isSafeInteger(value.time) || value.time < 0) throw new TypeError('地图时间无效')
  if (value.forcedNode != null && typeof value.forcedNode !== 'string') throw new TypeError('地图强制目的地无效')
  return true
}

export function validateTskStatusReports(state, value = statusState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'triggered', 'pending', 'theta', 'psi', 'thresholds'], '状况报告状态')
  if (value.version !== MAP_STATE_VERSION) throw new TypeError(`不支持的状况报告版本 ${value.version}`)
  for (const list of [value.triggered, value.pending]) {
    if (!Array.isArray(list) || list.some(report => !REPORT_IDS.includes(report))) throw new TypeError('状况报告队列无效')
  }
  for (const report of [...value.triggered, ...value.pending]) {
    if (typeof report !== 'string' || !REPORT_IDS.includes(report)) throw new TypeError('状况报告 id 无效')
  }
  if (new Set(value.triggered).size !== value.triggered.length || new Set(value.pending).size !== value.pending.length) {
    throw new TypeError('状况报告队列重复')
  }
  for (const report of DYNAMIC_STATUS_REPORTS) {
    if (value[report] != null && (!Number.isSafeInteger(value[report]) || value[report] < 1)) throw new TypeError('动态状况报告阈值无效')
  }
  if (value.thresholds != null) {
    if (!Array.isArray(value.thresholds)) throw new TypeError('状况报告阈值表无效')
    for (const entry of value.thresholds) {
      assertTskFields(entry, ['report', 'threshold'], '状况报告阈值')
      if (!REPORT_IDS.includes(entry.report) || !Number.isSafeInteger(entry.threshold)) throw new TypeError('状况报告阈值无效')
    }
  }
  return true
}

export function validateTskDossiers(state, value = dossierState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'unlocked', 'read'], '密档状态')
  if (value.version !== MAP_STATE_VERSION) throw new TypeError(`不支持的密档版本 ${value.version}`)
  assertCodeList(value.unlocked, '密档解锁列表')
  assertCodeList(value.read, '密档已读列表')
  if (value.read.some(key => !value.unlocked.includes(key))) throw new TypeError('密档已读但未解锁')
  return true
}

export function validateTskSideStories(state, value = sideStoryState(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'completed'], 'side story 状态')
  if (value.version !== MAP_STATE_VERSION) throw new TypeError(`不支持的 side story 版本 ${value.version}`)
  assertCodeList(value.completed, 'side story 完成列表')
  return true
}
