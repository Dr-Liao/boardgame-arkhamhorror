// TDE P5 批次 3：关卡运行时重建（laneSeat）与大厅边界转换的 Node 验收。
//
// 用合成双线战役跑真实 hub：分选 3 人（A 线座位 0、2；B 线座位 1）进入 A1 后，
//   · state.investigators 只含 A 线的两个座位且密集（0/1）；
//   · campaign.investigators 以 laneSeat 为键并带 roomSeat；
//   · 大厅边界（index.js）的 legalMoves/viewState/decisionSeat 做 room↔lane 转换；
//   · 另一条线座位没有行动权、看不到别人的私牌；
//   · 关卡结算后离开运行时：记录键回到 roomSeat、全部座位运行时恢复。
import test from 'node:test'
import assert from 'node:assert/strict'

import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import { dualPartFlow } from '../src/campaign/part-flow.js'
import {
  enterLaneRuntime, laneToRoomSeat, leaveLaneRuntime, roomKeyedRecords, roomSeatForEvent, roomToLaneSeat,
} from '../src/engine/lane-runtime.js'
import mod from '../index.js'
import { settle } from './core-fixture.mjs'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'

const CHAPTER_IDS = ['a1', 'b1', 'a2', 'b2']
const PARTS = Object.freeze({
  A: Object.freeze({ name: '梦寻', chapters: [{ scenarioId: 'a1' }, { scenarioId: 'a2' }] }),
  B: Object.freeze({ name: '梦网', chapters: [{ scenarioId: 'b1' }, { scenarioId: 'b2' }] }),
})

function registerCampaign() {
  if (contentRegistry.getCampaign('laneRuntimeTest')) return
  const base = contentRegistry.getCampaign('nightOfTheZealot')
  const scenarios = CHAPTER_IDS.map(id => ({
    manifest: { ...gathering.manifest, id, campaignId: 'laneRuntimeTest', behaviorIds: [id] },
    scenario: { ...gathering.scenario, id, behaviorId: id },
    behavior: { ...gathering.behavior, id },
  }))
  registerContentBundle({
    campaigns: [{
      ...base, id: 'laneRuntimeTest', name: '运行时测试战役', scenarioIds: [...CHAPTER_IDS],
      unlock: Object.fromEntries(CHAPTER_IDS.map(id => [id, []])),
      parts: PARTS, modes: ['singleA', 'singleB', 'pick', 'parallel'], flow: dualPartFlow(PARTS),
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

/** 3 人分选：A 线座位 0、2；B 线座位 1。准备完成后进入 A1。 */
function pickGameInScenario() {
  registerCampaign()
  const state = createGameState({ campaignId: 'laneRuntimeTest', campaignHub: true, seed: 'lane-runtime' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }])
  play(state, clean(movesOf(state, 'hubSetMode').find(move => move.mode === 'pick')))
  play(state, clean(movesOf(state, 'hubGoSetup')[0]))
  for (const seat of [0, 1, 2]) {
    play(state, clean(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, clean(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  play(state, clean(movesOf(state, 'hubBeginScenario')[0]))
  settle(state)
  return state
}

test('进入分选 A 线：运行时只有本线座位且密集，记录键改成 laneSeat 并保留 roomSeat', () => {
  const state = pickGameInScenario()
  assert.equal(state.scenario.id, 'a1')
  assert.equal(state.laneRuntime.part, 'A')
  assert.deepEqual(state.laneRuntime.roomSeats, [0, 2])
  assert.deepEqual(state.investigators.map(inv => inv.seat), [0, 1], '线内座位必须密集')
  assert.equal(state.numInvestigators, 2)
  assert.deepEqual(Object.keys(state.campaign.investigators).sort(), ['0', '1'])
  assert.equal(state.campaign.investigators[0].roomSeat, 0)
  assert.equal(state.campaign.investigators[1].roomSeat, 2)
  assert.equal(state.campaign.investigators[1].seat, 1)
  assert.equal(state.campaign.leadSeat, 0, '队长座位改成线内座位')
  assert.deepEqual(state.humanSeats, [0])
  // 反向映射
  assert.equal(laneToRoomSeat(state, 1), 2)
  assert.equal(roomToLaneSeat(state, 2), 1)
  assert.equal(roomToLaneSeat(state, 1), null, 'B 线座位不属于当前运行时')
})

test('大厅边界：另一条线座位不能行动，本线座位换算成 laneSeat 后可行动', () => {
  const state = pickGameInScenario()
  // B 线座位（room 1）在关卡内没有行动权。
  assert.deepEqual(mod.legalMoves(state, 1), [])
  assert.match(mod.validateMove(state, 1, { action: 'draw' }), /另一条线/)
  assert.throws(() => mod.applyMove(state, 1, { action: 'draw' }), /另一条线/)
  // A 线当前行动座位：边界上拿到的是 roomSeat，内部换算成 laneSeat 后 draw 合法。
  const currentRoom = mod.decisionSeat(state)
  assert.ok([0, 2].includes(currentRoom))
  const currentLane = roomToLaneSeat(state, currentRoom)
  assert.ok(currentLane != null)
  assert.ok(mod.legalMoves(state, currentRoom).some(move => move.action === 'draw'))
  assert.equal(mod.validateMove(state, currentRoom, { action: 'draw' }), null)
  const handBefore = state.investigators[currentLane].hand.length
  mod.applyMove(state, currentRoom, { action: 'draw' })
  assert.equal(state.investigators[currentLane].hand.length, handBefore + 1)
  // 线内座位 1（room 2）虽然不是当前行动者，也必须有映射；room 1 属于另一条线，没有映射。
  assert.equal(roomToLaneSeat(state, 2), 1)
  assert.equal(roomToLaneSeat(state, 1), null)
  // decisionSeat 在边界上换回 roomSeat。
  assert.ok([0, 2].includes(mod.decisionSeat(state)))
  // 关卡内 actingSeats 只有当前行动座位，但边界上必须是 roomSeat（属于 A 线）。
  assert.deepEqual(mod.actingSeats(state), [mod.decisionSeat(state)])
  assert.ok(mod.actingSeats(state).every(seat => [0, 2].includes(seat)))
})

test('观察投影：本线座位映射到 laneSeat，另一线座位只拿公开视图', () => {
  const state = pickGameInScenario()
  // 给 lane seat 1 一张私有手牌，便于区分。
  state.investigators[1].hand = ['01088']
  const own = mod.viewState(state, 2)
  assert.deepEqual(own.investigators.find(inv => inv.seat === 1)?.hand, ['01088'])
  const waiting = mod.viewState(state, 1)
  assert.equal(waiting.investigators.some(inv => Array.isArray(inv.hand) && inv.hand.length > 0), false,
    '另一条线座位看不到别人的手牌')
})

test('离开运行时：记录键回到 roomSeat、全部座位运行时恢复、队长回房间座位', () => {
  const state = pickGameInScenario()
  leaveLaneRuntime(state)
  assert.equal(state.laneRuntime, undefined)
  assert.deepEqual(state.investigators.map(inv => inv.seat), [0, 1, 2])
  assert.deepEqual(Object.keys(state.campaign.investigators).sort(), ['0', '2'])
  assert.equal(state.campaign.investigators[0].seat, 0)
  assert.equal(state.campaign.investigators[2].seat, 2)
  assert.equal(state.campaign.investigators['0'].roomSeat, undefined, 'roomSeat 是运行期字段，离开时清掉')
  assert.equal(state.campaign.leadSeat, 0)
  assert.equal(state.numInvestigators, 3)
  // 可以再次进入（下一关），幂等。
  const again = enterLaneRuntime(state)
  assert.deepEqual(again.roomSeats, [0, 2])
  leaveLaneRuntime(state)
  assert.equal(enterLaneRuntime({ campaign: { id: 'plain' }, investigators: [] }), null)
})

test('非双线战役：进入/离开都是 no-op，状态不新增字段', () => {
  registerCampaign()
  const state = createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'plain-lane' }, [{ seat: 0 }])
  const before = { investigators: state.investigators.length, keys: Object.keys(state.campaign.investigators).length }
  assert.equal(enterLaneRuntime(state), null)
  assert.equal(leaveLaneRuntime(state), null)
  assert.equal('laneRuntime' in state, false)
  assert.equal(state.investigators.length, before.investigators)
  assert.equal(Object.keys(state.campaign.investigators).length, before.keys)
})

test('事件座位：私有事件带 roomSeat，另一线/公开投影按房间座位过滤', () => {
  const state = pickGameInScenario()
  assert.equal(roomSeatForEvent(state, 1), 2)
  assert.equal(roomSeatForEvent(state, 0), 0)
  // 没有运行时（关间）时原样返回。
  const plain = { campaign: { id: 'x' }, investigators: [] }
  assert.equal(roomSeatForEvent(plain, 3), 3)
})

test('离开运行时：结算快照里的 recordsBefore/After 键改回 roomSeat', () => {
  const state = pickGameInScenario()
  state.campaign.scenarioResults = [{
    scenarioId: 'a1',
    investigators: [{ seat: 2, id: 'inv-b' }],
    recordsBefore: { 0: { seat: 0, roomSeat: 0, xp: 0 }, 1: { seat: 1, roomSeat: 2, xp: 0 } },
    recordsAfter: { 0: { seat: 0, roomSeat: 0, xp: 2 }, 1: { seat: 1, roomSeat: 2, xp: 2 } },
  }]
  leaveLaneRuntime(state)
  const result = state.campaign.scenarioResults[0]
  assert.deepEqual(Object.keys(result.recordsBefore).sort(), ['0', '2'])
  assert.equal(result.recordsBefore[2].xp, 0)
  assert.equal(result.recordsAfter[2].xp, 2)
  assert.equal(result.recordsBefore[2].roomSeat, undefined, '快照里的运行期字段清掉')
  assert.deepEqual(roomKeyedRecords([0, 2], { 1: { seat: 1, roomSeat: 2 } }), { 2: { seat: 2 } })
})
