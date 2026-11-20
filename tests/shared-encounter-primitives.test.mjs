import test from 'node:test'
import assert from 'node:assert/strict'

import { nearestLocations, shortestPaths } from '../src/engine/map-graph.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTreachery } from '../src/engine/engine.js'
import { choiceError, resolveTransaction } from '../src/engine/resolution.js'
import { resolveDeclarativeTreacheryTest } from '../src/cards/card-rules.js'
import { fixture } from './core-fixture.mjs'

test('最近候选保留所有并列地点，不以不合格的端点阻断路径', () => {
  const locations = [
    { id: 'right-target' },
    { id: 'off-map', connections: ['obstructed'], inPlay: false },
    { id: 'obstructed' },
    { id: 'origin', connections: ['left', 'off-map', 'right', 'missing'] },
    { id: 'left', connections: ['left-target', 'origin'] },
    { id: 'right', connections: ['right-target', 'origin'] },
    { id: 'left-target', connections: ['right-target'] },
  ]
  assert.deepEqual(nearestLocations(locations, 'origin', loc => loc.id.includes('target')).map(x => x.id),
    ['right-target', 'left-target'])
  assert.deepEqual(nearestLocations(locations, 'origin', loc => loc.id === 'obstructed'), [])
  assert.deepEqual(nearestLocations(locations, 'missing'), [])
  assert.deepEqual(nearestLocations(locations, 'origin').map(x => x.id), ['origin'])
  assert.deepEqual(shortestPaths(locations, 'origin', 'left-target'), [['origin', 'left', 'left-target']])
})

test('最近水位候选跳过上限和锁定，查询不创建状态', () => {
  const state = { locations: [
    { id: 'start', connections: ['lock', 'end'] },
    { id: 'lock', connections: ['far'] },
    { id: 'end', connections: ['far'] },
    { id: 'far' },
  ] }
  const api = createMechanicsApi(state)
  assert.deepEqual(api.water.nearestTargets('start'), ['start'])
  assert.equal(Object.hasOwn(state, 'scenarioFlags'), false)
  api.water.set('start', 2)
  api.water.set('end', 2)
  api.water.lock('lock')
  const before = structuredClone(state)
  assert.deepEqual(api.water.nearestTargets('start'), ['far'])
  assert.deepEqual(api.water.nearestTargets('start', -1), ['start'])
  assert.throws(() => api.water.nearestTargets('start', 0), /非零整数/)
  assert.deepEqual(state, before)
  assert.equal(api.water.change('far', 1), 1)
  assert.equal(api.water.level('far'), 1)
})

const choiceCode = 'fixture-shared-encounter-choice'
const fixtureRule = (test, code = choiceCode) => ({ code, scope: 'treachery', implemented: true,
  treacheryRule: { test } })
const rule = {
  skills: ['intellect', 'combat'],
  difficulty: { base: 0, plus: 'shroud' },
  fail: { kind: 'discardChosenByAmount', max: 2 },
}

test('备选技能和弃牌上限在注册时校验，备选声明与输入隔离', () => {
  assert.throws(() => registerCardAbilities(fixtureRule({ ...rule, skills: ['combat', 'combat'] })), /至少两项不同/)
  assert.throws(() => registerCardAbilities(fixtureRule({ ...rule, skill: 'agility' })), /不能与 skill 并用/)
  assert.throws(() => registerCardAbilities(fixtureRule({ ...rule, fail: { ...rule.fail, max: -1 } })), /正整数/)
  const code = 'fixture-shared-encounter-immutable'
  const source = structuredClone(rule)
  registerCardAbilities(fixtureRule(source, code))
  source.skills.reverse()
  assert.deepEqual(registeredEntry(code).treacheryRule.test.skills, ['intellect', 'combat'])
  assert.equal(Object.isFrozen(registeredEntry(code).treacheryRule.test.skills), true)
})

test('遭遇检定选择属于揭示者，存档恢复保留同码牌实体位置与失败上限', () => {
  registerCardAbilities(fixtureRule(rule))
  let state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const actor = state.investigators[1]
  actor.hand = ['01088', '11126', '01088', '01089', '01091']
  state.locations.find(location => location.id === actor.location).shroud = 6
  state.locations.find(location => location.id === actor.location).shroudMod = 20
  state.chaosBag = ['autofail']
  const card = { code: choiceCode, name: '合成遭遇用例', entryRevelation: true, peril: true }
  const execute = (draft, seat) => resolveTreachery(draft, draft.investigators[seat], card, [])
  resolveTransaction(state, 1, { action: 'fixtureRevelation' }, execute)
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['intellect', 'combat'])
  const first = { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'combat' }
  assert.ok(choiceError(state, 0, first))
  assert.equal(choiceError(state, 1, first), null)
  state = JSON.parse(JSON.stringify(state))
  resolveTransaction(state, 1, first, execute)
  const visitedDiscards = []
  const discards = ['2', '2']
  for (let i = 0; state.pendingChoice && i < 32; i++) {
    const choice = state.pendingChoice
    assert.equal(choice.seat, 1)
    if (choice.kind === 'discard') {
      assert.equal(choice.source, choiceCode)
      assert.ok(!choice.options.some(option => option.cardCode === '11126'))
      visitedDiscards.push(choice.options.map(option => option.cardCode))
    }
    const next = { action: 'choose', choiceId: choice.id,
      optionId: choice.kind === 'discard' ? discards.shift() : (choice.options.find(option => option.id === 'done') || choice.options[0]).id }
    assert.equal(choiceError(state, 1, next), null)
    resolveTransaction(state, 1, next, execute)
  }
  assert.equal(state.pendingChoice, null)
  assert.equal(state.lastTestResult.skill, 'combat')
  assert.equal(state.lastTestResult.difficulty, 6)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(visitedDiscards.length, 2)
  assert.deepEqual(state.investigators[1].hand, ['01088', '11126', '01091'])
  assert.deepEqual(state.investigators[1].discard, ['01088', '01089'])
  assert.deepEqual(state.investigators[0].discard, [])
  assert.deepEqual(state.chaosBag, ['autofail'])
})

test('单技能声明保持现有调用形状，成功无需失败惩罚', () => {
  const actor = { seat: 0 }
  const calls = []
  const api = {
    test(...args) { calls.push(args.slice(0, 3), args.length); args[3]({ success: true }) },
    applyPenalty() { assert.fail('successful test applied its failure consequence') },
  }
  assert.equal(resolveDeclarativeTreacheryTest({}, actor, { code: 'fixture-only-skill' }, api,
    { skill: 'willpower', difficulty: 2, fail: { kind: 'takeDamage', amount: 1 } }), false)
  assert.deepEqual(calls, [[0, 'willpower', 2], 4])
})
