// 万象无终（TCU）第 2 步 P2.12 原语验收：异端者多面与放逐。
//
// 覆盖路线图 §4.1 的必测项：翻面、不能击败、放逐、胜利区、存档。
// 数据在关卡 definition 的敌人上：faces = [{ code, side: 'enemy' | 'unfinishedBusiness' }]；
// 放逐把敌人移进胜利展示区（有胜利点就计分），不进遭遇弃牌堆。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy } from './core-fixture.mjs'
import {
  banishEnemyToVictory, currentFaceCode, enemyCannotBeDefeated, enemyFacesOf, faceOf, flipEnemyFace,
} from '../src/engine/engine.js'
import { createScenarioRuntime } from '../src/engine/scenario-runtime.js'

const ENEMY_FACE = '05046'
const UNFINISHED_FACE = '05178a'

function facesFixture(extra = {}) {
  const state = fixture('01001', 1)
  const foe = enemy(state, {
    code: ENEMY_FACE, name: '异端者', fight: 3, evade: 2, health: 6, engagedSeat: 0,
    faces: [
      { code: ENEMY_FACE, side: 'enemy' },
      { code: UNFINISHED_FACE, side: 'unfinishedBusiness' },
    ],
    ...extra,
  })
  return { state, foe }
}

const defOf = code => (code === ENEMY_FACE
  ? { name: '异端者', fight: 3, evade: 2, health: 6 }
  : code === UNFINISHED_FACE ? { name: '未了之事' } : null)

test('P2.12 读点：当前面、全部面、不能击败的标记', () => {
  const { foe } = facesFixture()
  assert.equal(faceOf(foe), 'enemy')
  assert.equal(currentFaceCode(foe), ENEMY_FACE)
  assert.equal(enemyFacesOf(foe).length, 2)
  assert.equal(enemyCannotBeDefeated(foe), false)
  assert.equal(enemyCannotBeDefeated({ cannotBeDefeated: true }), true)
  assert.equal(faceOf({ side: 'unfinishedBusiness' }), 'unfinishedBusiness')
  assert.deepEqual(enemyFacesOf({}), [])
})

test('P2.12 翻面：敌人面 → 未了之事面（离场进威胁区，解除交战）', () => {
  const { state, foe } = facesFixture()
  const outcome = flipEnemyFace(state, foe, UNFINISHED_FACE, { defOf, info: () => {}, events: [] })
  assert.equal(outcome.side, 'unfinishedBusiness')
  assert.equal(outcome.changed, true)
  assert.equal(state.enemies.includes(foe), false)
  assert.deepEqual(state.investigators[0].engaged, [])
  assert.deepEqual(state.investigators[0].threat.map(card => card.code), [UNFINISHED_FACE])
  // 已经是这一面时不重复翻。
  assert.equal(flipEnemyFace(state, foe, UNFINISHED_FACE, { defOf }).changed, false)
  // 未知的下一面返回 null。
  assert.equal(flipEnemyFace(state, foe, '99999', { defOf }), null)
})

test('P2.12 翻面：未了之事面 → 敌人面（回到战场并换回属性）', () => {
  const { state, foe } = facesFixture()
  flipEnemyFace(state, foe, UNFINISHED_FACE, { defOf })
  const back = flipEnemyFace(state, foe, ENEMY_FACE, { defOf })
  assert.equal(back.side, 'enemy')
  assert.equal(foe.side, 'enemy')
  assert.equal(foe.code, ENEMY_FACE)
  assert.equal(foe.fight, 3)
  assert.equal(state.enemies.includes(foe), true)
  assert.deepEqual(state.investigators[0].threat.map(card => card.code), [])
})

test('P2.12 放逐：移出敌人列表、解除交战、进胜利展示区并计分', () => {
  const { state, foe } = facesFixture({ victory: 2 })
  foe.engagedSeat = 0
  state.investigators[0].engaged = [foe.id]
  assert.equal(banishEnemyToVictory(state, foe, { info: () => {}, events: [] }), true)
  assert.equal(state.enemies.includes(foe), false)
  assert.deepEqual(state.investigators[0].engaged, [])
  assert.equal(state.victory >= 2, true)
  const entry = state.victoryDisplay.find(card => card.code === foe.code)
  assert.ok(entry, '胜利区应有这张卡')
  assert.equal(entry.victory, 2)
  // 放逐没有胜利点时不进胜利区、也不抛错。
  const plain = facesFixture({ victory: 0 })
  assert.equal(banishEnemyToVictory(plain.state, plain.foe, { info: () => {}, events: [] }), true)
  assert.equal(plain.state.victoryDisplay.some(card => card.code === plain.foe.code), false)
})

test('P2.12 存档：翻面后的面与威胁区实例随存档往返', () => {
  const { state, foe } = facesFixture()
  flipEnemyFace(state, foe, UNFINISHED_FACE, { defOf })
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(restored.investigators[0].threat[0].code, UNFINISHED_FACE)
  assert.equal(restored.enemies.some(item => item.code === ENEMY_FACE), false)
})

test('P2.12 内容层接口：scenarioRuntime 暴露 flipEnemy/banish/enemyFace', () => {
  // 键存在性用空依赖的工厂直接枚举（与本轮审计工具同一手法），不执行方法体。
  const proxy = new Proxy({}, { get: () => () => {} })
  const runtime = createScenarioRuntime(proxy)({}, [], null)
  for (const key of ['flipEnemy', 'enemyFace', 'banish']) {
    assert.equal(typeof runtime[key], 'function', `scenarioRuntime.${key}`)
  }
})
