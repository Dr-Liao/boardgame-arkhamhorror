// 07213 追击快车 / 07214 一车打手：最后方生成 + 攻击伤害加成。
//
// 读点：
//   · 「生成 - 最后方的地点」= 条目级 `spawnRearmost`：enemies.js#spawnEnemy 按
//     `mechanicState(state).road.columns` 的最小列取地点（columns 以地点**实例 id** 为键）。
//     抽牌路径还要不与抽牌者交战：encounter.js 的敌人分支用 printedSpawnLocation 判据跳过
//     「与抽牌者交战」的默认行为。
//   · 「如果你不在载具上：其本次攻击造成 +2 伤害」= `enemyRule.attackDamageBonus`
//     `{ amount: 2, unlessTargetInVehicle: true }`，读点在 enemies.js#enemyAttack。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { drawEncounter, legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { enemy, move, settle } from './core-fixture.mjs'

function drawInTransaction(s, code) {
  const execute = draft => { draft.encounterDeck = [code]; drawEncounter(draft, draft.investigators[0], []) }
  resolveTransaction(s, 0, { action: 'testRearmostSpawn' }, execute)
  for (let guard = 0; s.pendingChoice && guard < 30; guard++) {
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option)) ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
  return s.enemies.find(enemy => enemy.code === code)
}
const rearColumn = s => {
  const columns = s.scenarioFlags?.mechanics?.road?.columns || {}
  const ranked = s.locations.map(location => ({ location, column: Number(columns[location.id]) }))
    .filter(item => Number.isFinite(item.column))
  const best = Math.min(...ranked.map(item => item.column))
  return ranked.filter(item => item.column === best).map(item => item.location.id)
}

test('07214 一车打手：从遭遇牌库抽到时生成在最后方的地点，且不与抽牌者交战', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  const spawned = drawInTransaction(s, '07214')
  assert.ok(spawned, '已生成')
  assert.deepEqual(rearColumn(s), ['innsmouthLocation6'], '最后方是列号最小的地点')
  assert.equal(spawned.location, 'innsmouthLocation6', '生成在最后方')
  assert.equal(spawned.engagedSeat ?? null, null, '印刷没有「与你交战」，因此不自动交战')
})

test('07213 追击快车：同样生成在最后方', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  const spawned = drawInTransaction(s, '07213')
  assert.ok(spawned)
  assert.equal(spawned.location, rearColumn(s)[0])
})

test('07213：目标不在载具上时攻击 +2 伤害，在载具上则不加', () => {
  // 不在载具上：3 + 2 = 5
  const alone = chapterFixture('devilReef', 1)
  alone.enemies = []
  const aloneApi = createMechanicsApi(alone)
  const riding = aloneApi.vehicles.of(0)
  if (riding) aloneApi.vehicles.leave(0, riding, { forced: true })
  const invA = alone.investigators[0]
  const chaseA = { id: 'chaseA', code: '07213', name: '追击快车', location: invA.location,
    damage: 3, horror: 0, engagedSeat: 0, exhausted: false, traits: ['Vehicle'] }
  alone.enemies = [chaseA]
  invA.engaged = [chaseA.id]
  const beforeA = invA.damage
  scenarioRuntime(alone, []).attack(chaseA, invA)
  assert.equal(invA.damage - beforeA, 5, '不在载具上：3 + 2 点伤害')

  // 在载具上（恶魔礁开局全员在渔船上）：不加 2 点。
  const aboard = chapterFixture('devilReef', 1)
  aboard.enemies = []
  const invB = aboard.investigators[0]
  assert.ok(createMechanicsApi(aboard).vehicles.of(0), '开局在载具上')
  const chaseB = { id: 'chaseB', code: '07213', name: '追击快车', location: invB.location,
    damage: 3, horror: 0, engagedSeat: 0, exhausted: false, traits: ['Vehicle'] }
  aboard.enemies = [chaseB]
  invB.engaged = [chaseB.id]
  const beforeB = invB.damage
  scenarioRuntime(aboard, []).attack(chaseB, invB)
  assert.equal(invB.damage - beforeB, 3, '在载具上：只受印刷的 3 点')
})

test('07199b 魔鬼礁石的骇物：将要被击败时改为移除伤害并横置，本轮剩余时间不能重整', () => {
  const s = chapterFixture('horrorInHighGear', 1)
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = [] }
  const big = enemy(s, { code: '07199b', engagedSeat: 0, health: 4, traits: ['Monster', 'Elite'] })
  s.investigators[0].engaged = [big.id]
  s.investigators[0].combat = 8
  s.chaosBag = ['+5']
  big.damageTaken = 4
  const fight = legalMoves(s).find(command => command.action === 'fight' && command.enemyId === big.id)
  assert.ok(fight)
  move(s, fight)
  settle(s)
  const after = s.enemies.find(item => item.id === big.id)
  assert.ok(after, '没有被击败')
  assert.equal(after.damageTaken, 0, '移除所有伤害')
  assert.equal(after.exhausted, true, '横置')
  assert.deepEqual(after.preventReady, { from: s.round, rounds: 1 }, '本轮剩余时间不能重整')
})

test('两张卡都标记为已实现且声明了生成/攻击加成读点', () => {
  assert.equal(registeredEntry('07214').implemented, true)
  assert.equal(registeredEntry('07214').spawnRearmost, true)
  assert.equal(registeredEntry('07213').implemented, true)
  assert.equal(registeredEntry('07213').spawnRearmost, true)
  assert.deepEqual(registeredEntry('07213').enemyRule.attackDamageBonus, { amount: 2, unlessTargetInVehicle: true })
})
