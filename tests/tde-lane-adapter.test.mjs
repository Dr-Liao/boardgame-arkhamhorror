// TDE P5 批次 3：双线座位适配器（lane-adapter）的 Node 验收。
//
// 路线图 §7.2.2 / §11.2 门禁 7：roomSeat↔laneSeat 双向转换覆盖当前座位、待决选择、
// 座位列表、事件与观察者；线内数组密集；非双线战役原样透传（零变化）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  activeLane, assertDenseRuntime, laneSeats, laneSummary, laneViewFor, pendingChoiceToRoom,
  seatsToLane, seatsToRoom, tagEventLane, toLaneCommand, toLaneSeat, toRoomSeat,
  toRoomSeatValue, visibleToLane,
} from '../src/campaign/lane-adapter.js'

const pickCampaign = () => ({ mode: 'pick', seatParts: ['A', 'B', 'A'], activeParts: ['A'], currentPart: 'A' })
const parallelCampaign = () => ({ mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'], activeParts: ['A', 'B'], currentPart: null })
const plainCampaign = () => ({ mode: null })

test('非双线战役：适配器全部原样透传（不新增字段、不改座位）', () => {
  const campaign = plainCampaign()
  const move = { action: 'draw' }
  assert.deepEqual(toLaneCommand(campaign, 2, move), { seat: 2, lane: null, move })
  assert.equal(toRoomSeatValue(campaign, null, 3), 3)
  assert.deepEqual(seatsToRoom(campaign, null, [0, 1]), [0, 1])
  assert.deepEqual(seatsToLane(campaign, null, [0, 1]), [0, 1])
  const event = { kind: 'log', seat: 1 }
  assert.equal(tagEventLane(campaign, event), event, '未声明 parts 时返回原对象，不写 lane')
  assert.equal('lane' in event, false)
})

test('分选 2+1：roomSeat↔laneSeat 双向转换与线内座位表', () => {
  const campaign = pickCampaign()
  assert.deepEqual(laneSeats(campaign), { A: [0, 2], B: [1] })
  assert.equal(activeLane(campaign), 'A')
  assert.equal(toLaneSeat(campaign, 0), 0)
  assert.equal(toLaneSeat(campaign, 2), 1)
  assert.equal(toRoomSeat(campaign, 'A', 1), 2)
  assert.equal(toRoomSeat(campaign, 'B', 0), 1)
  assert.equal(toRoomSeat(campaign, 'B', 1), null, '越界线内座位返回 null，不静默截断')
  assert.deepEqual(toLaneCommand(campaign, 2, { action: 'draw' }), { seat: 1, lane: 'A', move: { action: 'draw' } })
  assert.throws(() => toLaneCommand({ ...campaign, seatParts: ['A'] }, 3, {}), /不属于任何线|越界/)
  assert.equal(toRoomSeatValue(campaign, 'A', 1), 2)
  assert.deepEqual(seatsToRoom(campaign, 'A', [0, 1]), [0, 2])
  assert.deepEqual(seatsToLane(campaign, 'A', [0, 1, 2]), [0, 1])
  assert.deepEqual(seatsToLane(campaign, 'B', [0, 1, 2]), [0])
})

test('待决选择：seat / seats / responderSeat / 选项 responderSeat 全部转回 roomSeat', () => {
  const campaign = pickCampaign()
  const pending = {
    id: 'choice-1', kind: 'mulligan', seat: 1, seats: [0, 1],
    options: [
      { id: 'a', label: 'A', responderSeat: 0 },
      { id: 'b', label: 'B', responderSeat: 1 },
      { id: 'c', label: 'C' },
    ],
  }
  const room = pendingChoiceToRoom(campaign, pending, 'A')
  assert.equal(room.seat, 2)
  assert.deepEqual(room.seats, [0, 2])
  assert.deepEqual(room.options.map(option => option.responderSeat), [0, 2, undefined])
  // 不修改入参。
  assert.equal(pending.seat, 1)
  assert.deepEqual(pending.seats, [0, 1])
  // 非双线战役原样返回。
  assert.equal(pendingChoiceToRoom(plainCampaign(), pending, null), pending)
  assert.equal(pendingChoiceToRoom(campaign, null, 'A'), null)
})

test('观察者归属线：活动线的座位有 lane 视图，另一线座位只给公开投影', () => {
  const campaign = pickCampaign()
  assert.deepEqual(laneViewFor(campaign, 2), { lane: 'A', laneSeat: 1, roomSeat: 2 })
  assert.equal(laneViewFor(campaign, 1), null, '非活动线座位没有 lane 视图')
  const parallel = parallelCampaign()
  assert.deepEqual(laneViewFor(parallel, 1), { lane: 'A', laneSeat: 1, roomSeat: 1 })
  assert.deepEqual(laneViewFor(parallel, 3), { lane: 'B', laneSeat: 1, roomSeat: 3 })
  assert.equal(activeLane(parallel), null, '并行时两条都活动，没有唯一活动线')
  assert.deepEqual(laneViewFor(plainCampaign(), 2), { lane: null, laneSeat: 2, roomSeat: 2 })
})

test('运行期座位密集性断言：0..n-1 无洞；重复/缺号会被点名', () => {
  assert.deepEqual(assertDenseRuntime([{ seat: 0 }, { seat: 1 }]), { ok: true, problems: [], count: 2 })
  const hole = assertDenseRuntime([{ seat: 0 }, { seat: 2 }])
  assert.equal(hole.ok, false)
  assert.match(hole.problems[0], /不密集/)
  const duplicate = assertDenseRuntime([{ seat: 0 }, { seat: 0 }])
  assert.equal(duplicate.ok, false)
  assert.equal(assertDenseRuntime([]).ok, true)
  assert.equal(assertDenseRuntime([{ seat: 0.5 }]).ok, false)
})

test('事件 lane 标记与按线可见性：shared 全见、本线可见、另一线私有不可见', () => {
  const campaign = pickCampaign()
  const event = { kind: 'move', seat: 1, text: '托米移动' }
  const tagged = tagEventLane(campaign, event, 'A')
  assert.equal(tagged.lane, 'A')
  assert.equal(tagged.seat, 2, '事件里的 seat 必须转回 roomSeat')
  assert.equal(event.seat, 1, '不修改原事件')
  const view = laneViewFor(campaign, 2)
  assert.equal(visibleToLane(tagged, view), true)
  assert.equal(visibleToLane({ kind: 'x', lane: 'shared' }, null), true)
  assert.equal(visibleToLane({ kind: 'x', lane: 'B' }, view), false)
  assert.equal(visibleToLane(tagged, null), false)
  // 并行：两条线各自只看到自己的事件。
  const parallel = parallelCampaign()
  assert.equal(visibleToLane(tagEventLane(parallel, { seat: 0 }, 'B'), laneViewFor(parallel, 0)), false)
  assert.equal(visibleToLane(tagEventLane(parallel, { seat: 0 }, 'A'), laneViewFor(parallel, 0)), true)
})

test('座位统计：总人数、两线人数与空线标记', () => {
  assert.deepEqual(laneSummary(pickCampaign()), { total: 3, A: 2, B: 1, empty: false })
  assert.deepEqual(laneSummary(parallelCampaign()), { total: 4, A: 2, B: 2, empty: false })
  assert.deepEqual(laneSummary({ seatParts: ['A', 'A'] }), { total: 2, A: 2, B: 0, empty: true })
})
