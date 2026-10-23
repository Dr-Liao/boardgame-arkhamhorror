// 万象无终（TCU）第 2 步 P2.5 原语验收：阵法（Circle）多技能合成检定。
//
// 覆盖路线图 §4.1 的必测项：技能值合成、难度、成功/失败、合法/非法、actionKind。
// 真实用法：地点卡印着「[action]：阵法。检定[意志]+[智识](10)…」——检定值 = 两个技能值之和，
// 投入的卡牌只要匹配其中任一技能就算图标（万能图标只算一次）。
//
// 引擎的选择必须发生在规则事务里（performTest 会打开投入窗口），所以用 withinTransaction 包一层，
// 与 tests/phase2-primitives.test.mjs 的调用方式一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { normalizeTestSkills, testSkillLabel } from '../src/engine/tests.js'
import { SKILL_NAMES } from '../src/engine/presentation-constants.js'

function testFixture() {
  const state = fixture('01001', 1)
  state.chaosBag = ['0']
  return { state, inv: state.investigators[0] }
}

function withinTransaction(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tcuCirclePrimitiveTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 60, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('P2.5 规范化：单技能保持字符串语义，多技能 2–4 项，非法输入立即失败', () => {
  assert.deepEqual(normalizeTestSkills('intellect'), ['intellect'])
  assert.deepEqual(normalizeTestSkills(['willpower', 'intellect']), ['willpower', 'intellect'])
  assert.deepEqual(normalizeTestSkills(['willpower', 'intellect', 'combat', 'agility']).length, 4)
  assert.throws(() => normalizeTestSkills([]), /至少需要一个技能/)
  assert.throws(() => normalizeTestSkills('luck'), /未知技能/)
  assert.throws(() => normalizeTestSkills(['willpower', 'intellect', 'combat', 'agility', 'wild']), /最多使用 4 项技能/)
})

test('P2.5 标签：单技能与引擎技能名表逐字一致，多技能用 + 连接', () => {
  for (const skill of Object.keys(SKILL_NAMES)) {
    assert.equal(testSkillLabel(skill), SKILL_NAMES[skill])
    assert.equal(testSkillLabel([skill]), SKILL_NAMES[skill])
  }
  assert.equal(testSkillLabel(['willpower', 'intellect']), `${SKILL_NAMES.willpower}+${SKILL_NAMES.intellect}`)
})

test('P2.5 合成：检定值是各技能值之和（罗兰：意志 3 + 智识 3 = 6）', () => {
  const { state, inv } = testFixture()
  let single = null
  withinTransaction(state, current => { single = performTest(current, 0, 'willpower', 6, { resolve: () => {} }) })
  assert.equal(single.value, inv.willpower)
  assert.equal(single.success, false)

  state.chaosBag = ['0']
  let combined = null
  withinTransaction(state, current => {
    combined = performTest(current, 0, ['willpower', 'intellect'], 6, { resolve: () => {} })
  })
  assert.equal(combined.value, inv.willpower + inv.intellect)
  assert.equal(combined.success, true)
  assert.deepEqual(combined.summary.skill, ['willpower', 'intellect'])
})

test('P2.5 难度：合成后的难度照常比较（难度 7 时 6 点失败）', () => {
  const { state } = testFixture()
  let failed = null
  withinTransaction(state, current => { failed = performTest(current, 0, ['willpower', 'intellect'], 7, { resolve: () => {} }) })
  assert.equal(failed.success, false)
  assert.equal(failed.summary.failedBy, 1)

  state.chaosBag = ['0']
  let passed = null
  withinTransaction(state, current => { passed = performTest(current, 0, ['willpower', 'intellect'], 5, { resolve: () => {} }) })
  assert.equal(passed.success, true)
  assert.equal(passed.summary.successBy, 1)
})

test('P2.5 单技能零变化：四项技能的检定值与旧实现一致（不因数组化改动数值）', () => {
  const { state, inv } = testFixture()
  for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
    state.chaosBag = ['0']
    let result = null
    withinTransaction(state, current => { result = performTest(current, 0, skill, 99, { resolve: () => {} }) })
    assert.equal(result.value, inv[skill], `${skill} 的检定值应等于技能值`)
    assert.equal(result.summary.skill, skill)
  }
})

test('P2.5 actionKind：阵法检定把行动种类记进检定记录与 testBegins 上下文', () => {
  const { state } = testFixture()
  let seen = null
  withinTransaction(state, current => {
    performTest(current, 0, ['willpower', 'intellect'], 10, {
      actionKind: 'circle',
      source: { type: 'scenario', label: '阵法', code: '05251' },
      resolve: () => { seen = { ...current.skillTest } },
    })
  })
  assert.equal(seen.actionKind, 'circle')
  assert.deepEqual(seen.skill, ['willpower', 'intellect'])

  // 不传 actionKind 时旧行为不变（记录里没有这个字段）。
  state.chaosBag = ['0']
  let plain = null
  withinTransaction(state, current => {
    performTest(current, 0, 'intellect', 2, { resolve: () => { plain = { ...current.skillTest } } })
  })
  assert.equal('actionKind' in plain, false)
})

test('P2.5 投入：匹配任一技能的图标都计入，万能图标只算一次', () => {
  const { state, inv } = testFixture()
  state.investigators[0].hand = ['01088']
  // 同一张牌分别在单技能检定与合成检定里投入：差值只能是第二个技能值本身。
  let single = null
  let committedOnce = false
  withinTransaction(state, current => { single = performTest(current, 0, 'intellect', 99, { resolve: () => {} }) },
    pending => (pending.kind === 'commit' && !committedOnce && (committedOnce = true)
      ? pending.options.find(option => !['done', 'help'].includes(option.id))?.id ?? 'done'
      : null))

  state.chaosBag = ['0']
  state.investigators[0].hand = ['01088']
  state.investigators[0].discard = []
  let committedTwo = false
  let combined = null
  withinTransaction(state, current => { combined = performTest(current, 0, ['intellect', 'agility'], 99, { resolve: () => {} }) },
    pending => (pending.kind === 'commit' && !committedTwo && (committedTwo = true)
      ? pending.options.find(option => !['done', 'help'].includes(option.id))?.id ?? 'done'
      : null))

  assert.equal(combined.value - single.value, inv.agility)
})

test('P2.5 真实引擎：阵法检定失败后仍走统一的失败窗口（可被卡面读取）', () => {
  const { state } = testFixture()
  state.chaosBag = ['-8']
  let failed = null
  withinTransaction(state, current => {
    performTest(current, 0, ['willpower', 'intellect'], 20, {
      actionKind: 'circle',
      resolve: result => { failed = result },
    })
  })
  assert.equal(failed.success, false)
  assert.equal(state.lastTestResult.success, false)
  assert.deepEqual(state.lastTestResult.skill, ['willpower', 'intellect'])
})

test('P2.5 状态：合成检定结束后 skillTest 复原，不把数组留在权威状态里', () => {
  const { state } = testFixture()
  withinTransaction(state, current => { performTest(current, 0, ['willpower', 'intellect'], 5, { resolve: () => {} }) })
  assert.equal(state.skillTest, null)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.lastTestResult.skill, ['willpower', 'intellect'])
})
