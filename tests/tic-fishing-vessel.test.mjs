// 渔船（07178）与偷偷上船（07187）：恶魔礁的载具通道。
//
// 载具状态在 `mechanicState.vehicles`：id = 剧情支援实例 id，含 location / capacity / running /
// protectsFromFlood / passengers。写入口在 vehicles.js（register / enter / leave / move / remove）：
//   · move 会逐个用权威位移入口搬乘客，任何一位乘客的目的地校验失败整段不生效；
//   · 载具的**物理卡**也要跟着走（剧情支援用实例上的 location 记录位置），否则下一次
//     [action] 的范围判定会读到旧地点；
//   · leave 会把 `vehicleAccess[seat]` 记成当前轮，本轮不能再进入——正好是 07187
//     「离开载具的调查员不能再进入该载具，直到本轮结束」的既有读点。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { move, settle } from './core-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'

const boatOf = s => (s.storyAssets || []).find(asset => asset.code === '07178')
const vehicle = (s, id) => s.scenarioFlags.mechanics.vehicles[id]

test('07178 渔船：只在载具所在地点提供「移动到连接的[[海洋]]地点」，移动时带走乘客与卡面', () => {
  const s = chapterFixture('devilReef', 2)
  const boat = boatOf(s)
  assert.ok(boat, '开局渔船在场上')
  assert.deepEqual(vehicle(s, boat.id).passengers, [0, 1], '开局两位调查员都在船上')

  const commands = legalMoves(s).filter(command => command.action === 'entityAbility' && command.entityId === boat.id)
  assert.ok(commands.length > 0, '船上时出现移动渔船的行动')
  const origin = vehicle(s, boat.id).location
  const here = s.locations.find(location => location.id === origin)
  const destination = commands[0].targetId
  assert.ok(here.connections.includes(destination), '目标必须是连接地点')
  assert.ok(s.locations.find(location => location.id === destination).traits.includes('Ocean'))

  move(s, commands[0])
  settle(s)
  assert.equal(vehicle(s, boat.id).location, destination, '载具位置更新')
  assert.equal(boatOf(s).location, destination, '载具卡面跟着走')
  assert.deepEqual(s.investigators.map(inv => inv.location), [destination, destination], '乘客一起移动')
})

test('07178 渔船：移动到内陆（非[[海洋]]）地点不是合法目标', () => {
  const s = chapterFixture('devilReef', 1)
  const boat = boatOf(s)
  const origin = vehicle(s, boat.id).location
  const here = s.locations.find(location => location.id === origin)
  // 把一个连接地点改成内陆：它不该出现在载具的目标里。
  const inland = s.locations.find(location => location.id === here.connections[0])
  inland.traits = ['Innsmouth']
  const commands = legalMoves(s).filter(command => command.action === 'entityAbility' && command.entityId === boat.id)
  assert.equal(commands.some(command => command.targetId === inland.id), false)
})

test('07187 偷偷上船：选择离开载具的调查员本轮不能再进入', () => {
  const s = chapterFixture('devilReef', 2)
  const boat = boatOf(s)
  const entry = registeredEntry('07187')
  const execute = draft => entry.encounterResolve(draft, draft.investigators[0], { code: '07187', name: '偷偷上船' },
    { mechanics: createMechanicsApi(draft), damage: () => {}, horror: () => {}, choice: () => 'leave',
      info: () => {}, scenario: null })
  resolveTransaction(s, 0, { action: 'testTicVehicles' }, execute)
  assert.deepEqual(vehicle(s, boat.id).passengers, [], '两位都选择离开')
  for (const seat of [0, 1]) {
    assert.equal(s.scenarioFlags.mechanics.vehicleAccess[seat], s.round, '本轮已进出过载具')
    assert.equal(createMechanicsApi(s).vehicles.enter(seat, boat.id), false, '本轮不能再进入')
  }
})

test('07187 偷偷上船：选择承受的调查员留在船上并受到 1 点伤害与 1 点恐惧', () => {
  const s = chapterFixture('devilReef', 2)
  const boat = boatOf(s)
  const entry = registeredEntry('07187')
  const execute = draft => entry.encounterResolve(draft, draft.investigators[0], { code: '07187', name: '偷偷上船' },
    { mechanics: createMechanicsApi(draft), damage: (seat, n) => { draft.investigators[seat].damage += n },
      horror: (seat, n) => { draft.investigators[seat].horror += n }, choice: () => 'harm', info: () => {}, scenario: null })
  resolveTransaction(s, 0, { action: 'testTicVehicles' }, execute)
  assert.deepEqual(vehicle(s, boat.id).passengers, [0, 1], '留在船上')
  assert.deepEqual(s.investigators.map(inv => inv.damage), [1, 1])
  assert.deepEqual(s.investigators.map(inv => inv.horror), [1, 1])
})

test('07187 偷偷上船：没有调查员在载具上时获得涌动', () => {
  const s = chapterFixture('devilReef', 2)
  const api = createMechanicsApi(s)
  for (const seat of [0, 1]) api.vehicles.leave(seat, boatOf(s).id)
  const result = registeredEntry('07187').encounterResolve(s, s.investigators[0], { code: '07187' },
    { mechanics: createMechanicsApi(s), info: () => {}, scenario: null })
  assert.deepEqual(result, { gainSurge: true })
})
