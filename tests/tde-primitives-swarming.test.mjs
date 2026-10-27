// TDE P3 批次 2：Swarming X 的 X 求值（enemy.swarmingValue）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  perInvestigatorCount, swarmingCount, swarmingCountForText, swarmingSpec, swarmingXFromState,
} from '../src/engine/swarming.js'

test('解析固定值 / [per_investigator] / X 两种剧本口径', () => {
  assert.deepEqual(swarmingSpec('Swarming 2. X equals the number of Swarm of Spiders enemies.').kind, 'fixed')
  assert.equal(swarmingSpec('Swarming 2.').value, 2)
  assert.equal(swarmingSpec('Hunter. Swarming 1 [per_investigator].').kind, 'perInvestigator')
  assert.equal(swarmingSpec('Hunter. Swarming 1 [per_investigator].').value, 1)
  assert.equal(swarmingSpec('Hunter. Swarming X. X is your alarm level (or the highest alarm level among investigators).').kind, 'alarmLevel')
  assert.equal(swarmingSpec('Spawn - Any Sea of Pitch location. Swarming X. X is the amount of damage on the scenario reference card.').kind, 'scenarioDamage')
  assert.equal(swarmingSpec('Swarming X. X is the number of cats.').kind, 'unknown')
  assert.equal(swarmingSpec('Hunter. Alert.'), null)
})

test('固定值求值', () => {
  const spec = swarmingSpec('Swarming 2.')
  assert.equal(swarmingCount(spec, { numInvestigators: 4 }), 2)
})

test('按人数：1 × 人数；人数至少 1', () => {
  assert.equal(perInvestigatorCount(1, 4), 4)
  assert.equal(perInvestigatorCount(1, 0), 1)
  const spec = swarmingSpec('Swarming 1 [per_investigator].')
  assert.equal(swarmingCount(spec, { numInvestigators: 3 }), 3)
})

test('X 口径缺 x 时抛错，不静默按 0', () => {
  const alarm = swarmingSpec('Swarming X. X is your alarm level.')
  assert.throws(() => swarmingCount(alarm, { numInvestigators: 2 }), /alarmLevel 的 X/)
  assert.throws(() => swarmingCount(alarm, { x: -1 }), /非负整数/)
  assert.throws(() => swarmingCount(alarm, { x: 1.5 }), /非负整数/)
  assert.equal(swarmingCount(alarm, { x: 3 }), 3)
})

test('X 从状态读：警报等级（按座位/全桌最高）与剧本参考卡伤害', () => {
  const state = {
    numInvestigators: 2,
    investigatorCounters: { alarmLevel: { seats: [1, 4] } },
    scenarioFlags: { referenceDamage: 6 },
  }
  assert.equal(swarmingXFromState(state, 'alarmLevel'), 4)
  assert.equal(swarmingXFromState(state, 'alarmLevel', 1), 4)
  assert.equal(swarmingXFromState(state, 'alarmLevel', 0), 1)
  assert.equal(swarmingXFromState(state, 'scenarioDamage'), 6)
  assert.equal(swarmingXFromState(state, 'fixed'), null)
})

test('一次算完：文本 + 状态 → count', () => {
  const state = {
    numInvestigators: 3,
    investigatorCounters: { alarmLevel: { seats: [0, 5] } },
    scenarioFlags: { referenceDamage: 2 },
  }
  assert.deepEqual(
    swarmingCountForText(state, 'Swarming 1 [per_investigator].'),
    { spec: { kind: 'perInvestigator', value: 1, perInvestigator: true, raw: 'Swarming 1 [per_investigator]' }, count: 3 },
  )
  assert.equal(swarmingCountForText(state, 'Swarming X. X is the highest alarm level among investigators.').count, 5)
  assert.equal(swarmingCountForText(state, 'Swarming X. X is your alarm level.', { seat: 0 }).count, 0)
  assert.equal(swarmingCountForText(state, 'Swarming X. X is the amount of damage on the scenario reference card.').count, 2)
  assert.equal(swarmingCountForText(state, 'Hunter. Alert.'), null)
})

test('未知 X 的文本：调用方必须给 x（unknown 分支）', () => {
  const spec = swarmingSpec('Swarming X. X is the number of cats.')
  assert.equal(spec.kind, 'unknown')
  assert.throws(() => swarmingCount(spec, { numInvestigators: 2 }), /unknown 的 X/)
  assert.equal(swarmingCount(spec, { x: 7 }), 7)
})
