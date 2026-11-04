// 07211a/b 托马斯·道森的车：运行/熄火两面、司机限定、运行面禁止进出。
//
// 读点：
//   · 运行面声明 `assetRule.vehicleAccessLocked: true` → vehicles.js#vehicleAccessError 拒绝进出；
//     翻到熄火面（07211b）后该条目不存在，锁定自动消失（按**当前物理面**判定）。
//   · 「如果你是本载具的司机」= `_shared.js#vehicleDriverOf`（mechanicState.vehicles[id].driver）。
//   · 翻面 = `_shared.js#flipVehicleFace`（引擎普通物理面入口 flipAsset + 同步 running）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { move, settle } from './core-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'

function carScene() {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  s.chaosBag = ['+5']
  const api = createMechanicsApi(s)
  // 先把章节开局的车辆请下来（forced 离开不占「本轮已进出」的账），再放测试车。
  for (const inv of s.investigators) {
    const riding = api.vehicles.of(inv.seat)
    if (riding) api.vehicles.leave(inv.seat, riding, { forced: true })
  }
  const origin = s.locations.find(location => location.connections?.length)
  assert.ok(origin, '章节里有可通行地点')
  const carId = 'testCar'
  api.vehicles.register(carId, { location: origin.id, capacity: 2, running: true, driverRequired: true })
  s.investigators[0].location = origin.id
  s.investigators[1].location = origin.id
  // 开局摆位与真实 setup 同一条路径：setup 进入不受运行面锁定影响。
  assert.equal(api.vehicles.enter(0, carId, { setup: true }), true)
  assert.equal(api.vehicles.enter(1, carId, { setup: true }), true)
  // 卡面实例：载具的物理卡在场上（剧情支援），用实例 id 与载具登记对齐。
  const card = { id: carId, code: '07211a', originalCode: '07211a', name: '托马斯·道森的车', location: origin.id }
  s.storyAssets = [...(s.storyAssets || []), card]
  s.currentSeat = 0
  return { s, api, carId, card, origin }
}
const carAbilities = (s, carId) => legalMoves(s).filter(command => command.action === 'entityAbility' && command.entityId === carId)

test('07211a 运行面：司机看得到两个行动，非司机看不到', () => {
  const { s, carId } = carScene()
  s.currentSeat = 0
  const driverMoves = carAbilities(s, carId)
  assert.equal(driverMoves.length, 2, '司机有两个 [action]')
  assert.ok(driverMoves.some(command => /开到一个连接的/.test(command.label)))
  assert.ok(driverMoves.some(command => /把车停下/.test(command.label)))
  s.currentSeat = 1
  assert.equal(carAbilities(s, carId).length, 0, '不是司机就没有行动')
})

test('07211a 运行面：调查员不能进入或离开本载具；翻到熄火面后解除', () => {
  const { s, api, carId } = carScene()
  assert.match(String(api.vehicles.accessError(0, carId, false)), /不能进入或离开/, '运行面禁止离开')
  assert.match(String(api.vehicles.accessError(1, carId, true)), /不能进入或离开/, '运行面禁止进入')

  s.currentSeat = 0
  const stop = carAbilities(s, carId).find(command => /把车停下/.test(command.label))
  move(s, stop)
  settle(s)
  const card = s.storyAssets.find(asset => asset.id === carId)
  assert.equal(card.code, '07211b', '翻到熄火面')
  assert.equal(api.vehicles.record(carId).running, false, '载具状态同步为熄火')
  // 熄火面不再有锁定条款（本轮「已进出过」的账仍在，那是另一条规则）。
  assert.equal(/不能进入或离开/.test(String(api.vehicles.accessError(1, carId, true))), false, '熄火面解除锁定')
})

test('07211b 熄火面：司机启动车子翻回运行面', () => {
  const { s, api, carId } = carScene()
  s.storyAssets.find(asset => asset.id === carId).code = '07211b'
  s.storyAssets.find(asset => asset.id === carId).originalCode = '07211b'
  api.vehicles.running(carId, false)
  s.currentSeat = 0
  const start = carAbilities(s, carId).find(command => /启动车子/.test(command.label))
  assert.ok(start, '熄火面有启动行动')
  move(s, start)
  settle(s)
  assert.equal(s.storyAssets.find(asset => asset.id === carId).code, '07211a')
  assert.equal(api.vehicles.record(carId).running, true)
})

test('07211a 行驶：抽一张遭遇牌，然后把车开到一个连接的[[道路]]地点（每轮一次）', () => {
  const { s, carId, origin } = carScene()
  s.currentSeat = 0
  const drive = carAbilities(s, carId).find(command => /开到一个连接的/.test(command.label))
  assert.ok(drive, '有行驶行动')
  const destination = s.locations.find(location => location.id === drive.targetId)
  assert.ok(destination.traits.includes('Road'), '目标必须是[[道路]]地点')
  const handBefore = s.encounterDiscard.length
  move(s, drive)
  settle(s)
  assert.equal(s.scenarioFlags.mechanics.vehicles[carId].location, destination.id, '载具移动到目标地点')
  assert.ok(s.investigators[0].location === destination.id || s.encounterDiscard.length > handBefore,
    '抽了遭遇牌或乘客随车移动（两者都要发生时才断言）')
  assert.equal(registeredEntry('07211a').abilities[0].limit.scope, 'perRound', '每轮一次由描述子 limit 记账')
  assert.ok(origin)
})
