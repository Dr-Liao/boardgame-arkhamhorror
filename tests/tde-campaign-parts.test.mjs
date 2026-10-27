// TDE P3 批次 1：双 part 数据模型（campaign-parts.js）的 Node 验收。
//
// 覆盖：座位映射（2+2 / 2+1 / 非连续）、模式校验、逐线记录读写、跨线勾销、
// 切 part 五步、两袋混乱袋、inPart 作用域、JSON 往返。全部使用**合成两 part 战役**，
// 不依赖 TDE 8 章内容（路线图 §5.5 / §13 任务 8）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PART_SCOPED_FIELDS, PARTS, createPartsState, crossOutInPart, defaultPartScope, inPart,
  laneCounts, laneSeatOf, mutateBothBags, normalizeSeatParts, partChaosBag, partFlowCondition,
  partRecord, partScope, recordInPart, roomSeatOf, seatPartMap, seatsOfLane, setPart,
  validateModeSeats,
} from '../src/campaign/campaign-parts.js'

const clone = value => JSON.parse(JSON.stringify(value))

function syntheticState({ mode = 'pick', seatParts = ['A', 'B', 'A', 'B'], currentPart = null } = {}) {
  const parts = createPartsState({ mode, seatParts, currentPart })
  const campaign = {
    id: 'syntheticDual',
    ...parts,
    records: {},
    investigators: {},
    retired: [],
    trauma: {},
    xp: 0,
    victory: 0,
    chaosBag: ['+1', '0', 'skull'],
    storySections: {},
    flow: { nodeId: 'a1' },
    scenarioResults: [],
    leadSeat: 0,
  }
  return {
    schemaVersion: 7,
    rulesVersion: 'n6.0',
    numInvestigators: seatParts.length,
    investigators: seatParts.map((_, seat) => ({ seat })),
    campaign,
    chaosBag: [...campaign.chaosBag],
  }
}

test('座位映射：2+2 的 roomSeat↔laneSeat 与线内人数', () => {
  const map = seatPartMap(['A', 'B', 'A', 'B'])
  assert.deepEqual(map.laneOfRoom, ['A', 'B', 'A', 'B'])
  assert.deepEqual(map.laneSeatOfRoom, [0, 0, 1, 1])
  assert.deepEqual(map.roomSeatsOfLane, { A: [0, 2], B: [1, 3] })
  assert.deepEqual({ ...map.laneCounts }, { A: 2, B: 2 })
})

test('座位映射：非连续房间座位（B,A,B,A）仍派生连续 laneSeat', () => {
  const seatParts = ['B', 'A', 'B', 'A']
  assert.deepEqual(seatParts.map((_, seat) => laneSeatOf(seatParts, seat)), [0, 0, 1, 1])
  assert.equal(roomSeatOf(seatParts, 'A', 0), 1)
  assert.equal(roomSeatOf(seatParts, 'A', 1), 3)
  assert.equal(roomSeatOf(seatParts, 'B', 1), 2)
  assert.equal(roomSeatOf(seatParts, 'A', 2), null, '越界线内座位返回 null，不做静默截断')
})

test('座位映射：2+1 分选与线内人数', () => {
  const seatParts = ['A', 'A', 'B']
  assert.deepEqual(laneCounts(seatParts), { A: 2, B: 1 })
  assert.deepEqual(seatsOfLane(seatParts, 'B'), [2])
  assert.equal(laneSeatOf(seatParts, 2), 0)
})

test('座位映射：非法 seatParts / 越界房间座位抛错', () => {
  assert.throws(() => normalizeSeatParts([]), /非空数组/)
  assert.throws(() => normalizeSeatParts(['A', 'C']), /seatParts\[1\]/)
  assert.throws(() => laneSeatOf(['A'], 1), /越界/)
})

test('开局人数校验：parallel 仅偶数且等分', () => {
  assert.equal(validateModeSeats({ mode: 'parallel', seatParts: ['A', 'B', 'A', 'B'] }).ok, true)
  const odd = validateModeSeats({ mode: 'parallel', seatParts: ['A', 'B', 'A'] })
  assert.equal(odd.ok, false)
  assert.match(odd.reason, /人数为奇数|人数相等/)
  const uneven = validateModeSeats({ mode: 'parallel', seatParts: ['A', 'A', 'B'] })
  assert.equal(uneven.ok, false)
  assert.match(uneven.reason, /人数相等/)
})

test('开局人数校验：单线不得混线、分选两线各 ≥1', () => {
  assert.equal(validateModeSeats({ mode: 'singleA', seatParts: ['A', 'A', 'A'] }).ok, true)
  assert.equal(validateModeSeats({ mode: 'singleA', seatParts: ['A', 'B'] }).ok, false)
  assert.equal(validateModeSeats({ mode: 'singleB', seatParts: ['B', 'B'] }).ok, true)
  assert.equal(validateModeSeats({ mode: 'singleB', seatParts: ['A', 'B'] }).ok, false)
  assert.equal(validateModeSeats({ mode: 'pick', seatParts: ['A', 'B', 'A'] }).ok, true)
  const emptyLane = validateModeSeats({ mode: 'pick', seatParts: ['A', 'A'] })
  assert.equal(emptyLane.ok, false)
  assert.match(emptyLane.reason, /两线各至少 1/)
})

test('createPartsState：parallel 两条同时活动、currentPart 为 null', () => {
  const parts = createPartsState({ mode: 'parallel', seatParts: ['A', 'B', 'A', 'B'] })
  assert.equal(parts.mode, 'parallel')
  assert.deepEqual(parts.activeParts, ['A', 'B'])
  assert.equal(parts.currentPart, null)
  assert.deepEqual(parts.parts, {})
})

test('createPartsState：pick 只有当前线，singleA 全 A', () => {
  const pick = createPartsState({ mode: 'pick', seatParts: ['A', 'B'] })
  assert.deepEqual(pick.activeParts, ['A'])
  assert.equal(pick.currentPart, 'A')
  const single = createPartsState({ mode: 'singleA', seatParts: ['A', 'A'] })
  assert.deepEqual(single.activeParts, ['A'])
  assert.equal(single.currentPart, 'A')
})

test('逐线记录：当前线读顶层，非活动线读快照', () => {
  const state = syntheticState()
  state.campaign.records.metTheCat = true
  assert.equal(partRecord(state.campaign, 'A', 'metTheCat'), true)
  assert.equal(partRecord(state.campaign, 'B', 'metTheCat'), undefined)
  recordInPart(state.campaign, 'B', 'metTheCat', 'B-only')
  assert.equal(partRecord(state.campaign, 'B', 'metTheCat'), 'B-only')
  assert.equal(state.campaign.records.metTheCat, true, '写另一线不得污染当前线')
})

test('跨线写入后切 part：两边记录互不覆盖', () => {
  const state = syntheticState()
  recordInPart(state.campaign, 'A', 'aOnly', 1)
  recordInPart(state.campaign, 'B', 'bOnly', 2)
  const switched = setPart(state, 'B')
  assert.equal(switched.changed, true)
  assert.equal(partRecord(state.campaign, 'B', 'bOnly'), 2)
  assert.equal(state.campaign.records.bOnly, 2, '切到 B 后 bOnly 升为顶层记录')
  assert.equal(state.campaign.records.aOnly, undefined)
  assert.equal(partRecord(state.campaign, 'A', 'aOnly'), 1, 'A 的旧记录留在快照里')
})

test('跨线勾销：只影响目标线并返回旧值', () => {
  const state = syntheticState()
  recordInPart(state.campaign, 'B', 'doomed', true)
  assert.equal(crossOutInPart(state.campaign, 'B', 'doomed'), true)
  assert.equal(partRecord(state.campaign, 'B', 'doomed'), undefined)
  recordInPart(state.campaign, 'A', 'kept', true)
  crossOutInPart(state.campaign, 'A', 'kept')
  assert.equal(state.campaign.records.kept, undefined)
})

test('切 part：当前线整块存快照、共享字段不动、袋同步', () => {
  const state = syntheticState()
  state.campaign.records.aRecord = true
  state.campaign.xp = 3
  state.campaign.victory = 2
  state.campaign.flow = { nodeId: 'pair2-A' }
  state.campaign.scenarioResults = ['a1']
  state.chaosBag = ['+1', 'skull', 'cultist']
  state.campaign.chaosBag = [...state.chaosBag]
  const result = setPart(state, 'B')
  assert.deepEqual(result, { changed: true, from: 'A', to: 'B', initialized: true })
  assert.equal(state.campaign.currentPart, 'B')
  assert.deepEqual(state.campaign.parts.A.records, { aRecord: true })
  assert.equal(state.campaign.parts.A.xp, 3)
  assert.deepEqual(state.campaign.parts.A.chaosBag, ['+1', 'skull', 'cultist'])
  assert.deepEqual(state.campaign.records, {}, 'B 线新开：记录为空')
  assert.equal(state.campaign.xp, 0)
  assert.equal(state.campaign.victory, 0)
  assert.deepEqual(state.chaosBag, [], 'B 线新开：袋为空且与 campaign 同步')
  assert.deepEqual(state.campaign.flow, { nodeId: 'pair2-A' }, '共享 flow 不被切片')
  assert.deepEqual(state.campaign.scenarioResults, ['a1'], '共享 scenarioResults 不被切片')
})

test('切 part：重复切同一条线是非变更', () => {
  const state = syntheticState()
  assert.deepEqual(setPart(state, 'A'), { changed: false, from: 'A', to: 'A', initialized: false })
})

test('切 part：来回切换保持两条线数据', () => {
  const state = syntheticState()
  state.campaign.records.a = 1
  setPart(state, 'B')
  state.campaign.records.b = 2
  setPart(state, 'A')
  assert.equal(state.campaign.records.a, 1)
  assert.equal(state.campaign.records.b, undefined)
  assert.equal(partRecord(state.campaign, 'B', 'b'), 2)
  assert.equal(state.campaign.parts.B.records.b, 2)
})

test('两袋混乱袋：读当前线与快照，mutateBothBags 同时改两袋', () => {
  const state = syntheticState()
  recordInPart(state.campaign, 'B', 'seed', true)
  setPart(state, 'B')
  state.chaosBag = ['+1', 'skull']
  state.campaign.chaosBag = [...state.chaosBag]
  setPart(state, 'A')
  assert.deepEqual(partChaosBag(state, 'A'), ['+1', '0', 'skull'])
  assert.deepEqual(partChaosBag(state, 'B'), ['+1', 'skull'])
  const next = mutateBothBags(state, bag => [...bag, 'cultist'])
  assert.ok(next.A.includes('cultist') && next.B.includes('cultist'))
  assert.ok(state.campaign.chaosBag.includes('cultist'), '当前线的袋同步到 campaign')
  assert.ok(state.campaign.parts.B.chaosBag.includes('cultist'), '非活动线落进快照')
  assert.deepEqual(partChaosBag(state, 'B'), next.B)
})

test('inPart：在另一线作用域内读写，退出后完全还原', () => {
  const state = syntheticState()
  state.campaign.records.a = 'A-value'
  state.campaign.flow = { nodeId: 'shared' }
  const seen = inPart(state, 'B', inner => {
    inner.campaign.records.b = 'B-value'
    inner.chaosBag.push('tablet')
    inner.campaign.chaosBag = [...inner.chaosBag]
    return { a: inner.campaign.records.a, b: inner.campaign.records.b, bag: [...inner.chaosBag] }
  })
  assert.deepEqual(seen, { a: undefined, b: 'B-value', bag: ['tablet'] })
  assert.equal(state.campaign.records.a, 'A-value', '当前线记录还原')
  assert.equal(state.campaign.records.b, undefined, '目标线写入留在快照')
  assert.equal(state.campaign.parts.B.records.b, 'B-value')
  assert.deepEqual(state.campaign.parts.B.chaosBag, ['tablet'])
  assert.deepEqual(state.campaign.flow, { nodeId: 'shared' })
})

test('inPart：回调抛错时作用域仍还原', () => {
  const state = syntheticState()
  state.campaign.records.a = 'keep'
  assert.throws(() => inPart(state, 'B', () => { throw new Error('boom') }), /boom/)
  assert.equal(state.campaign.records.a, 'keep')
  assert.equal(state.campaign.currentPart, 'A')
  assert.deepEqual(state.chaosBag, state.campaign.chaosBag)
})

test('partScope / PART_SCOPED_FIELDS：默认空线形状稳定', () => {
  const state = syntheticState()
  assert.deepEqual(Object.keys(partScope(state.campaign, 'B')).sort(), [...PART_SCOPED_FIELDS].sort())
  assert.deepEqual(partScope(state.campaign, 'B'), defaultPartScope())
  assert.deepEqual(PARTS, ['A', 'B'])
})

test('partFlowCondition：part / mode / modeIn / activeParts', () => {
  const state = syntheticState({ mode: 'pick', seatParts: ['A', 'B'] })
  assert.equal(partFlowCondition(state.campaign, { part: 'A' }), true)
  assert.equal(partFlowCondition(state.campaign, { part: 'B' }), false)
  assert.equal(partFlowCondition(state.campaign, { mode: 'pick' }), true)
  assert.equal(partFlowCondition(state.campaign, { mode: 'parallel' }), false)
  assert.equal(partFlowCondition(state.campaign, { modeIn: ['pick', 'parallel'] }), true)
  assert.equal(partFlowCondition(state.campaign, { activeParts: ['A'] }), true)
  assert.equal(partFlowCondition(state.campaign, { activeParts: ['A', 'B'] }), false)
  assert.equal(partFlowCondition(state.campaign, { unknownKey: 1 }), true, '未知键不参与匹配（由 P5 加载期校验）')
  assert.equal(partFlowCondition(null, { part: 'A' }), false)
})

test('JSON 往返：序列化后状态逐字节一致，且仍可继续切 part', () => {
  const state = syntheticState()
  recordInPart(state.campaign, 'A', 'a', 1)
  recordInPart(state.campaign, 'B', 'b', 2)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored, state)
  const switched = setPart(restored, 'B')
  assert.equal(switched.changed, true)
  assert.equal(restored.campaign.records.b, 2)
  assert.equal(restored.campaign.parts.A.records.a, 1)
})

test('非 TDE 状态：只有显式建 parts 才写字段（不声明就不产生字节变化）', () => {
  const plain = { schemaVersion: 7, campaign: { id: 'nightOfTheZealot', records: {}, xp: 0 } }
  const before = JSON.stringify(plain)
  assert.equal(JSON.stringify(plain), before)
  assert.equal('parts' in plain.campaign, false)
  assert.equal('mode' in plain.campaign, false)
  assert.deepEqual(clone(plain), plain)
})
