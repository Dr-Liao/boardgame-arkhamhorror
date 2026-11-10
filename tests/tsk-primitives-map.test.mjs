// TSK P2 原语验收 D：世界地图启程/时间/状况报告/密档/side story（map）。
//
// 覆盖 new.worldMap / travelTime / embarkChoice / statusReports / expeditedTicket / mapNodeUnlocks /
// sideStories / dossierReading、extend.mapGraph（0-1 加权距离）、extend.choices。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FORCED_TIME_THRESHOLD, currentMapNode, dossiers, embarkOptions, forcedDestination, initializeStatusReports,
  initializeWorldMap, mapChoices, mapTime, queueStatusReports, readDossier, resolveStatusReport, setDynamicStatusReport,
  statusReportsDue, travelTimeCost, travelTo, unlockDossier, unlockMapNode,
  useExpeditedTicket, validateTskMap, worldMapState,
} from '../src/engine/tsk-map.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { weightedDistance } from '../src/engine/map-graph.js'

const graph = () => ({
  nodes: [
    { id: 'hub', connections: ['a', 'b'] },
    { id: 'a', connections: ['hub', 'green1'] },
    { id: 'green1', type: 'side', connections: ['a', 'b'] },
    { id: 'b', connections: ['hub', 'green1', 'far'] },
    { id: 'far', type: 'locked', connections: ['b'] },
  ],
})
const plain = () => ({
  round: 1,
  investigators: [{ seat: 0, name: '甲', location: 'locA', assets: [], threat: [] }],
  locations: [{ id: 'locA', name: '甲地', connections: [] }],
  enemies: [],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))

test('0-1 加权距离：绿地进入代价 0、普通 1；不可达返回 null；未知节点抛错', () => {
  const nodes = graph().nodes
  assert.equal(weightedDistance(nodes, 'hub', 'a', node => node.type === 'side' ? 0 : 1), 1)
  // hub → a → green1：进入 a(1)+green1(0) = 1；hub → b → green1：同样 1。
  assert.equal(weightedDistance(nodes, 'hub', 'green1', node => node.type === 'side' ? 0 : 1), 1)
  assert.equal(weightedDistance(nodes, 'hub', 'far', node => node.type === 'side' ? 0 : 1), 2)
  assert.throws(() => weightedDistance(nodes, 'hub', 'nope', () => 1), /未知加权距离终点/)
  assert.equal(weightedDistance([{ id: 'x', connections: [] }, { id: 'y', connections: [] }], 'x', 'y', () => 1), null)
})

test('世界地图初始化：起点/解锁校验；重复初始化拒绝', () => {
  const state = plain()
  assert.equal(worldMapState(state), null)
  assert.equal(currentMapNode(state), null)
  assert.equal(mapTime(state), 0)
  const map = initializeWorldMap(state, { graph: graph(), start: 'hub', unlocked: ['a'], forcedNode: 'far' })
  assert.equal(map.current, 'hub')
  assert.equal(map.time, 0)
  assert.deepEqual(map.unlocked, ['hub', 'a'])
  assert.deepEqual(map.visited, ['hub'])
  assert.throws(() => initializeWorldMap(state, { graph: graph(), start: 'hub' }), /已经初始化/)
  const broken = plain()
  assert.throws(() => initializeWorldMap(broken, { graph: graph(), start: 'ghost' }), /未知起点/)
  assert.throws(() => initializeWorldMap(broken, { graph: graph(), start: 'hub', unlocked: ['ghost'] }), /未知初始解锁节点/)
  assert.throws(() => unlockMapNode(state, 'ghost', { graph: graph() }), /未知地图节点/)
  assert.deepEqual(unlockMapNode(state, 'b', { graph: graph() }), ['hub', 'a', 'b'])
})

test('旅行耗时与启程候选：普通 1、绿地 0+1、已解锁与强制标记', () => {
  const state = plain()
  initializeWorldMap(state, { graph: graph(), start: 'hub', unlocked: ['a', 'b', 'green1'], forcedNode: 'far' })
  assert.equal(travelTimeCost(graph(), { from: 'hub', to: 'a' }), 1)
  assert.equal(travelTimeCost(graph(), { from: 'hub', to: 'b' }), 1)
  // green1 是 side 节点：距离 1 + 目的地绿地 1 = 2。
  assert.equal(travelTimeCost(graph(), { from: 'hub', to: 'green1' }), 2)
  const options = embarkOptions(state, { graph: graph() })
  assert.equal(options.from, 'hub')
  assert.equal(options.forced, null)
  const byId = new Map(options.options.map(option => [option.destination, option]))
  assert.equal(byId.get('green1').sideStory, true)
  assert.equal(byId.get('a').unlocked, true)
  // far 未解锁：仍列出（P4 面板显示锁定），但 forcedBlocked 为 false。
  assert.equal(byId.get('far').unlocked, false)
})

test('旅行：未解锁/强制目标未达时拒绝；到达后累计时间与访问记录', () => {
  const state = plain()
  initializeWorldMap(state, { graph: graph(), start: 'hub', unlocked: ['a'], forcedNode: 'far' })
  const first = travelTo(state, { graph: graph(), destination: 'a' })
  assert.deepEqual(first, { from: 'hub', to: 'a', requested: 'a', cost: 1, time: 1, forced: false })
  assert.equal(currentMapNode(state), 'a')
  assert.equal(mapTime(state), 1)
  assert.throws(() => travelTo(state, { graph: graph(), destination: 'b' }), /尚未解锁/)
  unlockMapNode(state, 'b', { graph: graph() })
  assert.equal(travelTo(state, { graph: graph(), destination: 'b' }).cost, 1)
  // 时间达到强制阈值后只能去 forcedNode；强制目的地无需事先解锁。
  state.campaign.tsk.map.time = FORCED_TIME_THRESHOLD
  assert.equal(forcedDestination(state), 'far')
  assert.throws(() => travelTo(state, { graph: graph(), destination: 'green1' }), /只能前往强制目的地/)
  const forced = travelTo(state, { graph: graph(), destination: 'far' })
  assert.equal(forced.forced, true)
  assert.equal(currentMapNode(state), 'far')
})

test('快捷旅票：直达无需解锁、记 1 时间；原地/不可达拒绝', () => {
  const state = plain()
  initializeWorldMap(state, { graph: graph(), start: 'hub', unlocked: [], forcedNode: 'far' })
  assert.throws(() => useExpeditedTicket(state, { graph: graph(), destination: 'hub' }), /不能用于原地/)
  const result = useExpeditedTicket(state, { graph: graph(), destination: 'far' })
  assert.equal(result.cost, 1)
  assert.equal(currentMapNode(state), 'far')
  assert.equal(worldMapState(state).unlocked.includes('far'), true)
  const isolated = plain()
  initializeWorldMap(isolated, { graph: { nodes: [{ id: 'hub', connections: [] }, { id: 'elsewhere', connections: [] }] }, start: 'hub' })
  assert.throws(() => useExpeditedTicket(isolated, { graph: { nodes: [{ id: 'hub', connections: [] }, { id: 'elsewhere', connections: [] }] }, destination: 'elsewhere' }), /无法到达/)
})

test('状况报告：固定阈值 + 动态 θ/ψ；到期排队、结算一次、不重复', () => {
  const state = plain()
  initializeStatusReports(state, { thresholds: [
    { report: 'alpha', threshold: 7 }, { report: 'beta', threshold: 15 }, { report: 'omega', threshold: 35 },
  ] })
  setDynamicStatusReport(state, 'theta', 12)
  assert.deepEqual(statusReportsDue(state, { time: 6 }), [])
  assert.deepEqual(statusReportsDue(state, { time: 8 }).map(entry => entry.report), ['alpha'])
  assert.deepEqual(statusReportsDue(state, { time: 16 }).map(entry => entry.report), ['alpha', 'theta', 'beta'])
  // 排队 → 结算 → 已触发不再重复（queueStatusReports 从地图当前时间读数）。
  state.campaign.tsk.map ||= { version: 1, current: 'hub', visited: ['hub'], unlocked: ['hub'], time: 16, forcedNode: null }
  assert.deepEqual(queueStatusReports(state), ['alpha', 'theta', 'beta'])
  const resolved = resolveStatusReport(state, 'alpha', { unlock: ['dossier-1'] })
  assert.deepEqual(resolved, { report: 'alpha', effects: { unlock: ['dossier-1'] } })
  assert.throws(() => resolveStatusReport(state, 'alpha'), /不在待处理队列/)
  assert.deepEqual(statusReportsDue(state, { time: 40 }).map(entry => entry.report), ['omega'])
  assert.throws(() => setDynamicStatusReport(state, 'alpha', 3), /动态状况报告只有/)
})

test('密档与 side story：解锁/已读状态；未解锁不能读', () => {
  const state = plain()
  assert.deepEqual(dossiers(state), { unlocked: [], read: [] })
  unlockDossier(state, 'file-14-C')
  assert.throws(() => readDossier(state, 'file-16-D'), /尚未解锁/)
  assert.deepEqual(readDossier(state, 'file-14-C'), ['file-14-C'])
  assert.deepEqual(dossiers(state), { unlocked: ['file-14-C'], read: ['file-14-C'] })
  assert.throws(() => unlockDossier(state, ''), /key 无效/)
  const choices = mapChoices(state, { graph: graph() })
  assert.ok(choices.dossiers.read.includes('file-14-C'))
})

test('extend.scenarioDecks：异界牌库顶牌顺序读点（查看/按序放回/总数）', async () => {
  const { createScenarioDeckApi } = await import('../src/engine/scenario-decks.js')
  const state = plain()
  const api = createScenarioDeckApi(state, { choice: () => '0', cardName: code => code })
  api.initialize('otherworld', ['c1', 'c2', 'c3'], { shuffle: false })
  assert.equal(api.total('otherworld'), 3)
  assert.deepEqual(api.top('otherworld', 2), ['c3', 'c2'])
  assert.equal(api.top('otherworld', 4), false, '张数不足 fail closed')
  const taken = api.take('otherworld', 2)
  assert.deepEqual(taken, ['c3', 'c2'])
  assert.equal(api.returnTop('otherworld', ['c2', 'c3']), 2, 'codes[0] 成为新的顶牌')
  assert.deepEqual(api.top('otherworld', 2), ['c2', 'c3'])
  assert.equal(api.total('otherworld'), 3)
  assert.throws(() => api.top('missing', 1), /not initialized/)
  assert.throws(() => api.returnTop('otherworld', ['x', 42]), /必须是非空字符串数组/)
})

test('存档往返与读档校验：合法地图/报告/密档通过；坏值被拒绝', () => {
  const state = plain()
  initializeWorldMap(state, { graph: graph(), start: 'hub', unlocked: ['a'], forcedNode: 'far' })
  initializeStatusReports(state, { thresholds: [{ report: 'alpha', threshold: 7 }] })
  setDynamicStatusReport(state, 'psi', 20)
  unlockDossier(state, 'file-1')
  validateTskMap(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(restored.campaign.tsk.map.current, 'hub')
  assert.equal(restored.campaign.tsk.statusReports.psi, 20)
  const badMap = roundTrip(state)
  badMap.campaign.tsk.map.time = -1
  assert.throws(() => validateTskState(badMap), /地图时间无效/)
  const badReport = roundTrip(state)
  badReport.campaign.tsk.statusReports.triggered = ['nope']
  assert.throws(() => validateTskState(badReport), /状况报告/)
  const badDossier = roundTrip(state)
  badDossier.campaign.tsk.dossiers.read = ['file-1', 'file-2']
  assert.throws(() => validateTskState(badDossier), /密档已读但未解锁/)
})
