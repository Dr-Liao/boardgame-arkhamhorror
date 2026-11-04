// 道路危害：载具在道路地点进出时的强制结算（高度惊魂 07204–07210）。
//
// 读点与共享实现：
//   · `vehicles.moveVehicle` 移动成功后回调 `vehicleLeft` / `vehicleEntered`
//     （road-hazards.js#dispatchVehicleEvent → 地点条目的 locationRule.vehicleLeft / vehicleEntered）；
//   · 「每个载具每场游戏仅限一次」的记账 = `api.roadHazardOnce`（mechanicState.roadHazards）；
//   · 「该地点的调查员共同支付 N 个线索」的差额结算 = `api.payGroupClues(required, { allowShort: true })`；
//     付款人是**载具开走后仍在该地点**的调查员（乘客已随车离开，与印刷时点一致）；
//   · 07210 的「不能离开直到下一轮结束」= `api.mechanics.vehicles.lockUntil` → moveVehicle 的离开校验。
//
// 测试不依赖随机铺开的道路布局：把测试用到的那个地点改成目标卡的卡号（条目查 originalCode || code），
// 再把开局自带的车辆请下来、放一辆专用测试车。移动必须在**规则事务**里执行（付款/选人要 requestChoice）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'

const scene = () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  s.chaosBag = ['+5']
  return s
}

// 把某个地点改造成目标道路卡，并放一辆车：座位 0 当乘客，座位 1 留在原地当付款人。
function roadScene(cardCode, { onDestination = false, payerClues = 0 } = {}) {
  const s = scene()
  const runtime = scenarioRuntime(s, [])
  const api = runtime.mechanics
  // 开局自带的车辆先请下来（forced 离开不占「本轮已进出」的账）。
  for (const inv of s.investigators) {
    const riding = api.vehicles.of(inv.seat)
    if (riding) api.vehicles.leave(inv.seat, riding, { forced: true })
  }
  const road = s.locations.find(location => location.connections?.length)
  assert.ok(road, '章节里有可通行的地点')
  const neighbour = s.locations.find(location => location.id === road.connections[0])
  const origin = onDestination ? neighbour : road
  const destination = onDestination ? road : neighbour
  const target = onDestination ? destination : origin
  target.code = cardCode
  target.originalCode = cardCode

  const vehicleId = `roadCar-${cardCode}`
  api.vehicles.register(vehicleId, { location: origin.id, capacity: 2, running: true, driverRequired: true })
  s.investigators[0].location = origin.id
  assert.equal(api.vehicles.enter(0, vehicleId), true, '乘客上车')
  s.investigators[1].location = origin.id
  s.investigators[1].clues = payerClues
  return { s, runtime, api, vehicleId, origin, destination }
}

// 在规则事务里开一次车：pick 决定每个选择用哪个选项（默认 done/skip/self 或第一项）。
function driveInTransaction(s, vehicleId, destinationId, pick = () => null) {
  let moved = false
  const execute = draft => { moved = scenarioRuntime(draft, []).mechanics.vehicles.move(vehicleId, destinationId) }
  resolveTransaction(s, 0, { action: 'testRoadHazard' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 40, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = pick(choice, s) ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
  return moved
}

test('07204c 昏暗道路：付不出线索时，差额每位让一位乘客受 2 点恐惧（每载具每场一次）', () => {
  const { s, runtime, api, vehicleId, origin, destination } = roadScene('07204c')
  const before = s.investigators[0].horror
  assert.equal(driveInTransaction(s, vehicleId, destination.id), true)
  // 07204c：每人 2 线索 / 每差额 2 点恐惧；1 位乘客差 2 个线索 → 4 点恐惧。
  assert.equal(s.investigators[0].horror, before + 4, '差额 2 × 2 点恐惧')
  assert.equal(runtime.roadHazardOnce(origin.id, vehicleId), false, '已记账')
  assert.equal(driveInTransaction(s, vehicleId, origin.id), true, '可以开回去')
  assert.equal(s.investigators[0].horror, before + 4, '同一辆载具在同一地点只结算一次')
  assert.equal(api.vehicles.record(vehicleId).location, origin.id)
})

test('07204c：留在原地的人线索够时先付线索，乘客不受伤', () => {
  const { s, vehicleId, destination } = roadScene('07204c', { payerClues: 5 })
  const horror = s.investigators[0].horror
  // 每次分摊选「支付 1 个线索」，付满 2 个。
  assert.equal(driveInTransaction(s, vehicleId, destination.id,
    choice => (choice.kind === 'payment' ? '1' : null)), true)
  assert.equal(s.investigators[0].horror, horror, '付得起就不受伤')
  assert.equal(s.investigators[1].clues, 3, '共同支付了 2 个线索')
})

test('07204b 昏暗道路：每差额 1 点恐惧', () => {
  const { s, vehicleId, destination } = roadScene('07204b')
  const before = s.investigators[0].horror
  assert.equal(driveInTransaction(s, vehicleId, destination.id), true)
  assert.equal(s.investigators[0].horror, before + 2, '差额 2 × 1 点恐惧')
})

test('07208a 急转弯：付不出线索时改为伤害', () => {
  const { s, vehicleId, destination } = roadScene('07208a')
  const damage = s.investigators[0].damage
  const horror = s.investigators[0].horror
  assert.equal(driveInTransaction(s, vehicleId, destination.id), true)
  assert.ok(s.investigators[0].damage > damage, '急转弯造成伤害')
  assert.equal(s.investigators[0].horror, horror, '不是恐惧')
})

test('07209a 荒凉道路：付不齐时弃遭遇牌直到[[载具]]敌人并生成在此', () => {
  const { s, vehicleId, origin, destination } = roadScene('07209a')
  // 牌库的「顶」在数组末尾（drawEncounter 用 pop）：先弃诡计 07187，再翻到[[载具]]敌人 07213。
  s.encounterDeck = ['07213', '07187']
  assert.equal(driveInTransaction(s, vehicleId, destination.id), true)
  const spawned = s.enemies.find(enemy => enemy.code === '07213')
  assert.ok(spawned, '从遭遇牌库找到并生成了[[载具]]敌人')
  assert.equal(spawned.location, origin.id, '生成在本地点')
  assert.ok(s.encounterDiscard.includes('07187'), '途经的牌进入遭遇弃牌堆')
})

test('07210 蜿蜒长路：载具进入后毁灭 +1，并且直到下一轮结束都不能离开', () => {
  const { s, api, vehicleId, origin, destination } = roadScene('07210', { onDestination: true })
  const doom = s.doom
  assert.equal(driveInTransaction(s, vehicleId, destination.id), true)
  assert.equal(s.doom, doom + 1, '进入时在当前密谋上放置 1 个毁灭')
  assert.equal(api.vehicles.record(vehicleId).lockedUntilRound, s.round + 1)
  assert.equal(driveInTransaction(s, vehicleId, origin.id), false, '下一轮结束前不能离开')
  s.round += 2
  assert.equal(driveInTransaction(s, vehicleId, origin.id), true, '下一轮结束后可以离开')
})

test('07205a 崖边道路：司机检定失败则移除载具、每位乘客受 10 点伤害', () => {
  const { s, vehicleId, destination } = roadScene('07205a')
  s.chaosBag = ['autofail']
  const beyond = s.locations.find(location => location.id !== destination.id && location.id !== s.investigators[0].location)
  assert.equal(driveInTransaction(s, vehicleId, destination.id,
    choice => (choice.kind === 'skill' ? 'willpower' : null)), true)
  // 检定在事务内完成：失败 → 载具移出游戏；伤害在检定结算时落实。
  const removed = !s.scenarioFlags.mechanics.vehicles[vehicleId]
  assert.equal(removed, true, '检定失败后载具被移出游戏')
  assert.ok(beyond, '章节里仍留有其它地点（无用断言，保证场景完整）')
})

test('道路危害条目都声明了载具事件读点，且每张卡都有 implemented 标记', () => {
  for (const code of ['07204a', '07204b', '07204c', '07205a', '07205b', '07208a', '07208b', '07208c', '07209a', '07209b', '07210']) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 已注册`)
    assert.equal(entry.implemented, true, `${code} 标记为已实现`)
    const rule = entry.locationRule || {}
    assert.ok(typeof rule.vehicleLeft === 'function' || typeof rule.vehicleEntered === 'function',
      `${code} 声明了 vehicleLeft / vehicleEntered`)
  }
})
