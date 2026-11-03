// 沉睡达贡（07292a）的真实卡牌行为：检定失败上资源、达到阈值翻面、花钥匙移除资源。
//
// 免疫/不能攻击/不能交战由 effect-provenance 统一执行，这里只验证这张卡自己的两条能力，
// 以及翻面后引用真实 07292b 的印刷数值。
//
// 注意：`resolveTransaction` 成功后会用草稿替换 state 内容，事务前拿到的敌人引用会失效，
// 所以每个事务之后都按 id 从 state 重新取实例。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { enemyIsSlumbering } from '../src/engine/effect-provenance.js'
import { registeredEntry } from '../src/engine/ability.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicSlumberingBoss' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 60, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const failTest = (s, seat = 0) => transaction(s, draft => scenarioRuntime(draft, []).test(seat, 'willpower', 20, () => {}))
const bossIn = (s, id) => s.enemies.find(item => item.id === id)

test('07292a 沉睡达贡：本地点的调查员检定失败后上资源，达到 1[per_investigator]+2 才翻面', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: s.investigators[0].location }).id
  assert.equal(enemyIsSlumbering(s, bossIn(s, bossId), { entryOf: registeredEntry }), true)
  s.chaosBag = ['autofail']
  const threshold = s.numInvestigators + 2
  const enemiesBefore = s.enemies.length
  for (let index = 1; index < threshold; index++) {
    failTest(s)
    assert.equal(bossIn(s, bossId).resources, index, `第 ${index} 次失败后资源数`)
    assert.equal(bossIn(s, bossId).code, '07292a', '未达阈值不翻面')
  }
  failTest(s)
  assert.equal(bossIn(s, bossId).code, '07292b', '达到阈值翻到清醒面')
  assert.equal(s.enemies.length, enemiesBefore, '翻面只换同一张物理卡的面，不产生第二个敌人')
  assert.equal(enemyIsSlumbering(s, bossIn(s, bossId), { entryOf: registeredEntry }), false)
})

test('07292a 沉睡达贡：远处地点的检定失败不放置资源', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const elsewhere = s.locations.find(location => location.id !== s.investigators[0].location).id
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: elsewhere }).id
  s.chaosBag = ['autofail']
  failTest(s)
  assert.equal(bossIn(s, bossId).resources ?? 0, 0, '达贡不在检定者所在地点时不触发')
})

test('07292a 沉睡达贡：花1把钥匙移除1资源，资源为0时该行动不出现', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  const bossId = enemy(s, { code: '07292a', engagedSeat: null, location: s.investigators[0].location }).id
  const actionFor = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === bossId && command.actionKind === 'activate')
  assert.equal(actionFor(), undefined, '没有资源时没有可用的「花钥匙移除资源」行动')
  bossIn(s, bossId).resources = 2
  const api = createMechanicsApi(s)
  assert.equal(api.keys.transfer('green', s.scenarioFlags.mechanics.keys.green.holder, 'investigator:0', { reveal: true }), true)
  const command = actionFor()
  assert.ok(command, '有资源且有钥匙时行动出现')
  move(s, command)
  settle(s)
  assert.equal(bossIn(s, bossId).resources, 1)
  assert.equal(keysAt(s, 'reference').includes('green'), true, '钥匙进了当前场景')
  assert.equal(keysAt(s, 'investigator:0').includes('green'), false)
})
