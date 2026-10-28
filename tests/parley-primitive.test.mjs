// 通用谈判（Parley）原语回归：非玩家实体的谈判行动由条目声明 actionKind:'parley' 的
// action 描述子，legalMoves / 行动点 / 借机攻击豁免 / 目标校验都由引擎 src/engine/parley.js
// 与 ability-exec 的 doEntityAbility 处理，内容层不再写 enemyScript.encounterAction。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, legalMoves, move, settle } from './core-fixture.mjs'
import { parleyMovesFor } from '../src/engine/parley.js'

function withEnemy(code, extra = {}) {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const id = `enemy-${code}`
  state.enemies.push({
    id, code, originalCode: code, name: code,
    location: inv.location, fight: 2, evade: 2, health: 3, damage: 1, horror: 1, doom: 0,
    ...extra,
  })
  return { state, inv, id, enemy: () => state.enemies.find(item => item.id === id) }
}

const parleyMove = state => legalMoves(state).find(m => m.action === 'entityAbility' && m.actionKind === 'parley')

test('05095 秘社新信徒：谈判是通用 Parley 行动，成功清空毁灭并消耗 1 行动', () => {
  const { state, inv, id, enemy } = withEnemy('05095', { doom: 2 })
  const parley = parleyMove(state)
  assert.ok(parley, 'legalMoves 里有谈判行动')
  assert.match(parley.label, /谈判/)
  const actions = inv.actionsLeft
  move(state, { action: 'entityAbility', entityType: 'enemy', entityId: id, abilityIndex: parley.abilityIndex })
  assert.equal(state.investigators[0].actionsLeft, actions - 1, '谈判是普通行动，消耗 1 个行动点')
  assert.equal(state.skillTest.skill, 'willpower')
  assert.equal(state.skillTest.difficulty, 2)
  settle(state)
  assert.equal(enemy().doom, undefined, '成功移除所有毁灭标记')
})

test('05096 守密人：谈判用智识(3)，成功清空毁灭', () => {
  const { state, id, enemy } = withEnemy('05096', { doom: 1 })
  const parley = parleyMove(state)
  move(state, { action: 'entityAbility', entityType: 'enemy', entityId: id, abilityIndex: parley.abilityIndex })
  assert.equal(state.skillTest.skill, 'intellect')
  assert.equal(state.skillTest.difficulty, 3)
  settle(state)
  assert.equal(enemy().doom, undefined)
})

test('03093 骚灵：谈判成功对其造成 1 点伤害（即使不可被普通伤害）', () => {
  const { state, id, enemy } = withEnemy('03093')
  const parley = parleyMove(state)
  move(state, { action: 'entityAbility', entityType: 'enemy', entityId: id, abilityIndex: parley.abilityIndex })
  settle(state)
  assert.equal(enemy().damageTaken, 1, '遭遇来源的伤害允许')
})

test('03258 地下墓穴讲师：团队每场游戏一次，成功查看一处地下墓穴', () => {
  const { state, inv, id } = withEnemy('03258')
  const crypt = { id: 'crypt', name: '墓穴', originalCode: '03247', revealed: false, shroud: 2, clues: 1, connections: [] }
  state.locations.push(crypt)
  assert.ok(parleyMove(state), '未使用时可见')
  const parley = parleyMove(state)
  move(state, { action: 'entityAbility', entityType: 'enemy', entityId: id, abilityIndex: parley.abilityIndex })
  assert.equal(state.scenarioFlags.catacombsLecturerUsed, true, '行动开始即标记本场已用')
  settle(state)
  assert.ok(state.log.some(line => String(line).includes('地下墓穴讲师')), '成功时给出查看结果')
  assert.equal(parleyMovesFor(state, inv).length, 0, '用过后不再出现在谈判列表')
})
