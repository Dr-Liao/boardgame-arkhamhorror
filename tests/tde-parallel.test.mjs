// TDE P5 批次 3：并行双运行时管线（container → 引擎/观察/存档）的 Node 验收。
//
// 路线图 §7.5.2（D8-C）：一个房间、两条线各自跑自己的关卡；命令按座位路由到本线，
// 事件/投影带 lane 与 roomSeat；单文件存档；两边结算到同一章对才封盘。
import test from 'node:test'
import assert from 'node:assert/strict'

import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import { dualPartFlow } from '../src/campaign/part-flow.js'
import {
  advanceParallelPair, isParallelState, launchParallelLanes, markLaneFinished, parallelActingSeats,
  parallelDecisionSeats, parallelView, restoreParallelState, serializeParallelState,
} from '../src/integration/parallel-runtime.js'
import {
  checkpointView, createSessionCheckpoint, forkSessionCheckpoint,
} from '../src/integration/hall-integration.js'
import mod from '../index.js'
import { settle } from './core-fixture.mjs'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'

const CHAPTER_IDS = ['a1', 'b1', 'a2', 'b2']
const PARTS = Object.freeze({
  A: Object.freeze({ name: '梦寻', chapters: [{ scenarioId: 'a1' }, { scenarioId: 'a2' }] }),
  B: Object.freeze({ name: '梦网', chapters: [{ scenarioId: 'b1' }, { scenarioId: 'b2' }] }),
})

function registerCampaign(id = 'parallelTest', { gate = 'open', chapters = CHAPTER_IDS, parts = PARTS } = {}) {
  if (contentRegistry.getCampaign(id)) return
  const base = contentRegistry.getCampaign('nightOfTheZealot')
  const scenarios = chapters.map(item => ({
    manifest: { ...gathering.manifest, id: item, campaignId: id, behaviorIds: [item] },
    scenario: { ...gathering.scenario, id: item, behaviorId: item },
    behavior: { ...gathering.behavior, id: item },
  }))
  registerContentBundle({
    campaigns: [{
      ...base, id, name: '并行测试战役', scenarioIds: [...chapters],
      unlock: Object.fromEntries(chapters.map(item => [item, []])),
      parts, modes: ['singleA', 'singleB', 'pick', 'parallel'], ...(gate ? { dualLineGate: gate } : {}), flow: dualPartFlow(parts),
    }],
    scenarios,
  })
}

const movesOf = (state, action, seat = null) =>
  legalMoves(state, seat ?? decisionSeat(state)).filter(move => move.action === action)
const play = (state, move, seat = null) => {
  const target = seat ?? decisionSeat(state)
  const error = validateMove(state, target, move)
  assert.equal(error, null, `move ${JSON.stringify(move)} 应合法：${error}`)
  return applyMove(state, target, move)
}
const clean = move => Object.fromEntries(Object.entries(move)
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

/** 4 人并行：A 线座位 0、1；B 线座位 2、3。准备完成后（尚未启动）。 */
function parallelHub() {
  registerCampaign()
  const state = createGameState({ campaignId: 'parallelTest', campaignHub: true, seed: 'parallel-runtime' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }])
  play(state, clean(movesOf(state, 'hubSetMode').find(move => move.mode === 'parallel')))
  play(state, clean(movesOf(state, 'hubGoSetup')[0]))
  for (const seat of [0, 1, 2, 3]) {
    play(state, clean(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  return state
}

function parallelLaunched() {
  const state = parallelHub()
  const launched = launchParallelLanes(state)
  assert.equal(launched.ok, true)
  return state
}

function parallelGame() {
  const state = parallelLaunched()
  for (const lane of ['A', 'B']) settle(state.parallel.lanes[lane])
  return state
}

test('启动双运行时：两条线各自进入 a1 / b1，座位映射独立且密集', () => {
  const state = parallelGame()
  assert.equal(isParallelState(state), true)
  const { A, B } = state.parallel.lanes
  assert.equal(A.scenario.id, 'a1')
  assert.equal(B.scenario.id, 'b1')
  assert.deepEqual(A.laneRuntime.roomSeats, [0, 1])
  assert.deepEqual(B.laneRuntime.roomSeats, [2, 3])
  assert.deepEqual(A.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(B.investigators.map(inv => inv.seat), [0, 1])
  assert.equal(A.campaign.currentPart, 'A')
  assert.equal(B.campaign.currentPart, 'B')
  assert.equal(A.numInvestigators, 2)
  assert.equal(B.numInvestigators, 2)
})

test('命令按座位路由：两条线各自结算、互不污染，事件带 lane 与 roomSeat', () => {
  const state = parallelGame()
  // 用「获得资源」做路由断言：+1 资源是确定性的（抽牌可能抽到弱点而被结算掉）。
  // 用「获得资源」做路由断言：+1 资源是确定性的（抽牌可能抽到弱点而被结算掉）。
  // 两条线各自有决策座位（roomSeat）；按 C 线上的决策座位取，不能用 legalMoves 猜
  // （引擎的 legalMoves 对非行动座位也会列出候选）。
  const decisions = parallelDecisionSeats(state)
  const aRoom = decisions.find(seat => seat === 0 || seat === 1)
  const bRoom = decisions.find(seat => seat === 2 || seat === 3)
  assert.ok(aRoom != null && bRoom != null)
  // 事务会重建 state 内的对象，断言一律重新读（不能持有旧 inv 引用）。
  const resourceA0 = state.parallel.lanes.A.investigators[aRoom].resources
  const resourceB0 = state.parallel.lanes.B.investigators[bRoom - 2].resources
  const events = mod.applyMove(state, aRoom, { action: 'resource' })
  assert.equal(state.parallel.lanes.A.investigators[aRoom].resources, resourceA0 + 1)
  assert.equal(state.parallel.lanes.B.investigators[bRoom - 2].resources, resourceB0, 'A 线行动不能改到 B 线')
  assert.ok(events.every(event => event.lane === 'A' || event.lane == null))
  mod.applyMove(state, bRoom, { action: 'resource' })
  assert.equal(state.parallel.lanes.B.investigators[bRoom - 2].resources, resourceB0 + 1)
  // 同一时刻两条线各自有决策座位（roomSeat）。
  const acting = mod.actingSeats(state)
  assert.ok(acting.length >= 1)
  assert.ok(acting.every(seat => [0, 1, 2, 3].includes(seat)))
  assert.ok(parallelDecisionSeats(state).every(seat => [0, 1, 2, 3].includes(seat)))
})

test('观察投影：本线视图带 parallel.lane 与另一线公开摘要；AI 描述不外泄', () => {
  const state = parallelGame()
  const viewA = mod.viewState(state, 0)
  assert.equal(viewA.parallel.lane, 'A')
  assert.equal(viewA.parallel.other.scenarioId, 'b1')
  assert.deepEqual(viewA.parallel.other.seats, [2, 3])
  assert.ok(JSON.stringify(viewA).includes('a1'))
  const viewB = mod.viewState(state, 3)
  assert.equal(viewB.parallel.lane, 'B')
  assert.equal(viewB.parallel.scenarioId, 'b1')
  // 另一线的手牌不在摘要里。
  assert.equal('investigators' in viewA.parallel.other, false)
  // 另一线的座位不拿到 A 线视图。
  const text = mod.describeState(state, 2)
  assert.ok(typeof text === 'string')
  assert.ok(!text.includes('a1'), 'B 线 AI 描述不能出现 A 线关卡')
})

test('单文件存档：容器往返后两条线继续可用', () => {
  const state = parallelGame()
  const saved = serializeParallelState(state)
  const restored = restoreParallelState(saved)
  assert.equal(restored.parallel.lanes.A.scenario.id, 'a1')
  assert.equal(restored.parallel.lanes.B.scenario.id, 'b1')
  assert.deepEqual(JSON.parse(serializeParallelState(restored)), JSON.parse(saved))
  // 恢复后仍能按座位下发命令。
  const resource = restored.parallel.lanes.A.investigators[0].resources
  mod.applyMove(restored, 0, { action: 'resource' })
  assert.equal(restored.parallel.lanes.A.investigators[0].resources, resource + 1)
  assert.throws(() => restoreParallelState(JSON.stringify({ campaign: {} })), /不是并行双运行时状态/)
})

test('关卡屏障：只有两边都结算到同一章对才封盘；未封盘不能推进', () => {
  const state = parallelGame()
  const first = markLaneFinished(state, 'A', 1)
  assert.equal(first.sealed, false, '只有 A 线结算时不能封盘')
  assert.equal(advanceParallelPair(state, 1).ok, false)
  const second = markLaneFinished(state, 'B', 1)
  assert.equal(second.sealed, true)
  assert.ok(state.parallel.sealed[1])
  assert.deepEqual(state.parallel.awaiting, { A: 1, B: 1 })
  // 封盘后推进由 hub 动作完成；测试里只断言封盘标记与等待状态，真实关卡结算由剧本测试覆盖。
  const again = markLaneFinished(state, 'A', 1)
  assert.equal(again.sealed, true)
  assert.equal(state.parallel.sealed[1] != null, true)
})

test('非并行状态：管线 API 拒绝而不是静默降级', () => {
  registerCampaign()
  const hub = createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'not-parallel' }, [{ seat: 0 }])
  assert.equal(isParallelState(hub), false)
  assert.throws(() => launchParallelLanes(hub), /只有声明 parts/)
  assert.throws(() => markLaneFinished(hub, 'A', 1), /不是并行双运行时状态/)
  assert.throws(() => serializeParallelState(hub), /不是并行双运行时状态/)
})

test('大厅开闸：hubBeginScenario 在 mod 边界启动双运行时，纯引擎仍拒绝', () => {
  const state = parallelHub()
  const begin = clean(movesOf(state, 'hubBeginScenario')[0])
  // 纯引擎（测试/工具）不直接启动容器；大厅边界负责开闸。
  assert.throws(() => play(state, begin), /大厅边界|并行/)
  const events = mod.applyMove(state, decisionSeat(state), begin)
  assert.ok(events.length >= 1)
  assert.equal(isParallelState(state), true)
  assert.equal(state.uiState, 'inScenario')
  const viewA = mod.viewState(state, 0)
  const viewB = mod.viewState(state, 3)
  assert.equal(viewA.parallel.lane, 'A')
  assert.equal(viewA.scenario.id, 'a1')
  assert.equal(viewB.parallel.lane, 'B')
  assert.equal(viewB.scenario.id, 'b1')
  // 观战视图只给公开摘要。
  const publicView = mod.viewState(state, null)
  assert.equal(publicView.parallel.public, true)
  assert.ok(Array.isArray(publicView.investigators), '观战也应有公开的调查员摘要')
  assert.ok(publicView.investigators.every(inv => !Array.isArray(inv.hand) || inv.hand.length === 0))
})

test('章对屏障：未封盘时本线不能开下一章', () => {
  const state = parallelGame()
  assert.throws(() => mod.applyMove(state, 0, { action: 'hubBeginScenario' }), /另一条线/)
  markLaneFinished(state, 'B', 2)
  assert.throws(() => mod.applyMove(state, 0, { action: 'hubBeginScenario' }), /另一条线/)
})

test('P9.5 开闸前：没有 dualLineGate 的战役在 mod 边界拒绝启动并行', () => {
  const closedChapters = ['c1', 'c2', 'c3', 'c4']
  const closedParts = {
    A: { name: 'A', chapters: [{ scenarioId: 'c1' }, { scenarioId: 'c3' }] },
    B: { name: 'B', chapters: [{ scenarioId: 'c2' }, { scenarioId: 'c4' }] },
  }
  registerCampaign('parallelClosed', { gate: '', chapters: closedChapters, parts: closedParts })
  const state = createGameState({ campaignId: 'parallelClosed', campaignHub: true, seed: 'parallel-closed' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }])
  play(state, clean(movesOf(state, 'hubSetMode').find(move => move.mode === 'parallel')))
  play(state, clean(movesOf(state, 'hubGoSetup')[0]))
  for (const seat of [0, 1, 2, 3]) {
    play(state, clean(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  assert.throws(() => mod.applyMove(state, 0, clean(movesOf(state, 'hubBeginScenario')[0])), /P9\.5|dualLineGate/)
  assert.equal(isParallelState(state), false)
})

test('双线队长：A/B 各自选队长，启动后两条线使用自己的队长座位', () => {
  const state = parallelHub()
  assert.deepEqual(state.campaign.partLeads, { A: 0, B: 2 })
  play(state, { action: 'hubSetPartLeader', part: 'B', leadSeat: 3 }, 0)
  assert.deepEqual(state.campaign.partLeads, { A: 0, B: 3 })
  // 把 B 线队长从座位 4 换走后，改线到 A 会触发该线队长重选（回退到该线第一个座位）。
  play(state, { action: 'hubSetPartLeader', part: 'A', leadSeat: 1 }, 0)
  assert.deepEqual(state.campaign.partLeads, { A: 1, B: 3 })
  const launched = launchParallelLanes(state)
  assert.equal(launched.ok, true)
  assert.equal(state.parallel.lanes.A.campaign.leadSeat, 1, 'A 线队长：房间座位 2 → 线内座位 1')
  assert.equal(state.parallel.lanes.B.campaign.leadSeat, 1, 'B 线队长：房间座位 4 → 线内座位 1')
})

test('大厅代答钩子：并行线待决选择映射成房间座位，容器本身仍为 null', () => {
  const state = parallelLaunched()
  assert.equal(state.pendingChoice, null)
  assert.equal(state.parallel.lanes.A.pendingChoice.kind, 'mulligan')
  const choice = mod.pendingChoice(state)
  assert.ok(choice)
  assert.equal(choice.kind, 'mulligan')
  assert.equal(choice.seat, 0, 'A 线座位 1 → 房间座位 0')
  assert.equal(choice.lane, 'A')
  assert.ok(choice.options.every(option => option.id))
  // B 线：线内座位 0 → 房间座位 2（A 线优先返回）
  state.parallel.lanes.A.pendingChoice = null
  const bChoice = mod.pendingChoice(state)
  assert.equal(bChoice.seat, 2)
  assert.equal(bChoice.lane, 'B')
})

test('批量换牌：并行线在 lane 克隆上原子提交，容器版本 +1 且事件换回房间座位', () => {
  const state = parallelLaunched()
  const laneA = state.parallel.lanes.A
  const choice = laneA.pendingChoice
  assert.equal(choice.kind, 'mulligan')
  const hand = laneA.investigators[0].hand
  const candidate = choice.options.find(option => option.id !== 'done')
  const index = Number(candidate.id)
  const session = { state, events: [], sessionId: 'parallel-batch' }
  const baseRevision = state.revision
  const receipt = mod.commitChoiceBatch(session, 0, {
    kind: 'mulligan', choiceId: choice.id, selected: [{ index, code: hand[index] }], finish: 'done',
  }, {
    moveError: message => Object.assign(new Error(message)),
    commitMove() { throw new Error('并行批量选择不应走容器 commitMove') },
  })
  assert.equal(receipt.action ?? receipt.move.action, 'choiceBatch')
  assert.equal(state.revision, baseRevision + 1)
  assert.equal(state.parallel.lanes.A.investigators[0].hand.length, hand.length, '换牌后重新抽回同数量')
  assert.ok(receipt.events.length >= 1)
  assert.ok(receipt.events.every(event => event.lane === 'A' || event.lane === undefined))
  // 失败不落地：换一个过期 choiceId 应该抛错且容器版本不变。
  const revision = state.revision
  assert.throws(() => mod.commitChoiceBatch({ state, events: [] }, 0, {
    kind: 'mulligan', choiceId: 'stale', selected: [{ index: 0, code: hand[0] }], finish: 'done',
  }, { moveError: message => Object.assign(new Error(message)), commitMove() {} }), /当前选择已变化/)
  assert.equal(state.revision, revision)
})

test('观战投影：并行无座位视图含公开 campaign/牌桌摘要，且不含私密手牌', () => {
  const state = parallelGame()
  const view = mod.viewState(state, null)
  assert.equal(view.parallel.public, true)
  assert.equal(view.parallel.lanes.length, 2)
  assert.ok(view.campaign?.id)
  assert.ok(Array.isArray(view.investigators))
  assert.ok(view.investigators.every(inv => !Array.isArray(inv.hand) || inv.hand.length === 0))
})

test('并行换线权限：真人只能换自己，房主只能代 AI 换线', () => {
  registerCampaign()
  const state = createGameState({ campaignId: 'parallelTest', campaignHub: true, seed: 'parallel-perm' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }, { seat: 2, role: 'ai' }, { seat: 3, role: 'ai' }])
  play(state, clean(movesOf(state, 'hubSetMode').find(move => move.mode === 'parallel')))
  const hostSeats = legalMoves(state, 0).filter(move => move.action === 'hubSetSeatPart').map(move => move.seat).sort()
  assert.deepEqual(hostSeats, [0, 2, 3], '房主：自己 + AI，不能替另一名真人换线')
  play(state, clean(movesOf(state, 'hubGoSetup')[0]))
  for (const seat of [0, 1, 2, 3]) {
    play(state, clean(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  assert.deepEqual(legalMoves(state, 0).filter(move => move.action === 'hubSetSeatPart').map(move => move.seat).sort(), [0, 2, 3])
  assert.deepEqual(legalMoves(state, 1).filter(move => move.action === 'hubSetSeatPart').map(move => move.seat), [1])
  // 真人 2 可以自己换线；房主不能替他换。
  play(state, { action: 'hubSetSeatPart', seat: 1, part: 'B' }, 1)
  assert.equal(state.campaign.seatParts[1], 'B')
  assert.throws(() => play(state, { action: 'hubSetSeatPart', seat: 1, part: 'A' }, 0), /只能代 AI|当前不可执行/)
})

test('并行关卡检查点：记录两条线，任一队长可回档', () => {
  const state = parallelLaunched()
  const session = { state, events: [], scenarioCheckpoints: [], modId: 'arkhamhorror', modName: 'test', players: [], settings: {} }
  const checkpoint = createSessionCheckpoint(session, { move: { action: 'hubBeginScenario' }, after: state })
  assert.ok(checkpoint)
  assert.match(checkpoint.scenarioName, / \/ /)
  assert.equal(checkpoint.scenarioId, 'a1|b1')
  assert.equal(checkpoint.snapshot.state.parallel.lanes.A.scenario.id, 'a1')
  assert.equal(checkpoint.snapshot.state.parallel.lanes.B.scenario.id, 'b1')
  session.scenarioCheckpoints = [checkpoint]
  assert.equal(checkpointView(session, state.campaign.partLeads.A)[0].canFork, true)
  assert.equal(checkpointView(session, state.campaign.partLeads.B)[0].canFork, true)
  assert.equal(checkpointView(session, 9)[0].canFork, false)
  const branch = forkSessionCheckpoint(session, checkpoint.checkpointId, {
    sessionId: 'parallel-fork', revision: 999, seat: state.campaign.partLeads.B,
  })
  assert.equal(branch.state.parallel.lanes.B.scenario.id, 'b1')
  assert.equal(branch.state.revision, 999)
})

test('大厅版本号：容器 revision 提交到 lane 前必须剥离（否则所有行动都会被判过期）', () => {
  const state = parallelGame()
  const seat = mod.decisionSeat(state)
  assert.ok([0, 1, 2, 3].includes(seat))
  const move = { action: 'resource', revision: state.revision }
  assert.equal(mod.validateMove(state, seat, move), null)
  const laneSeat = state.parallel.lanes[state.campaign.seatParts[seat]].laneRuntime.roomSeats.indexOf(seat)
  const before = state.parallel.lanes[state.campaign.seatParts[seat]].investigators[laneSeat].resources
  mod.applyMove(state, seat, move)
  assert.equal(state.parallel.lanes[state.campaign.seatParts[seat]].investigators[laneSeat].resources, before + 1)
})
