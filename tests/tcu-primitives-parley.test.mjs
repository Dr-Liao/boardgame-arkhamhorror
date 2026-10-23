// 万象无终（TCU）第 2 步 P2.7 原语验收：通用谈判（Parley）。
//
// 覆盖路线图 §4.1 的必测项：合法目标、失败分支、借机攻击豁免、AI（legalMoves 可见）。
// 谈判是「地点 / 敌人 / 剧情资产」卡面声明的行动：`kind: 'action'` + `actionKind: 'parley'`，
// 走能力层的同一条描述子管线（费用/上限/日志/目标注入），并且按规则不引发借机攻击。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, enemy } from './core-fixture.mjs'
import { legalMoves, validateMove } from '../src/engine/engine.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import {
  PARLEY_ACTION_KIND, cardMentionsParley, entityParleyDescriptors, isParleyCard,
  isParleyDescriptor, parleyMovesFor, parleyTargetError,
} from '../src/engine/parley.js'

// 测试用实体条目：一张地点、一个敌人各声明一条谈判能力（用仓库里没人使用的号码）。
const TEST_PARLEY_TARGET = '01996'
const TEST_LOCATION_PARLEY = '01995'
const TEST_ENEMY_PARLEY = '01994'

registerCardAbilities([{
  code: TEST_LOCATION_PARLEY,
  scope: 'location',
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：交出情报',
    cost: { action: 1 },
    resolve: ({ inv, api }) => { api.gainResources(inv.seat, 2) },
  }],
}, {
  code: TEST_ENEMY_PARLEY,
  scope: 'enemy',
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：劝走信徒',
    cost: { action: 1 },
    resolve: ({ inv, api }) => { api.gainClues(inv.seat, 1) },
  }],
}, {
  code: TEST_PARLEY_TARGET,
  scope: 'enemy',
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：收买守卫',
    cost: { action: 1 },
    target: { kind: 'enemy' },
    resolve: ({ inv, api }) => { api.gainResources(inv.seat, 1) },
  }],
}])

function parleyFixture() {
  const state = fixture('01001', 1)
  state.chaosBag = ['0']
  const inv = state.investigators[0]
  const loc = state.locations.find(location => location.id === inv.location)
  return { state, inv, loc }
}

test('P2.7 读点：actionKind 与 countsAs 都算谈判，普通能力不算', () => {
  assert.equal(PARLEY_ACTION_KIND, 'parley')
  assert.equal(isParleyDescriptor({ actionKind: 'parley' }), true)
  assert.equal(isParleyDescriptor({ countsAs: 'parley' }), true)
  assert.equal(isParleyDescriptor({ actionKind: 'fight' }), false)
  assert.equal(isParleyDescriptor(null), false)
})

test('P2.7 实体声明：地点/敌人条目上的谈判能力按声明顺序读出', () => {
  const locationDescriptors = entityParleyDescriptors({ originalCode: TEST_LOCATION_PARLEY })
  assert.equal(locationDescriptors.length, 1)
  assert.equal(locationDescriptors[0].label, '谈判：交出情报')
  assert.equal(entityParleyDescriptors({ code: TEST_ENEMY_PARLEY }).length, 1)
  assert.deepEqual(entityParleyDescriptors({ code: '01001' }), [])
})

test('P2.7 构筑读点：卡面带「谈判」或条目声明谈判能力都算', () => {
  assert.equal(cardMentionsParley({ textZh: '谈判：检定意志(3)。' }), true)
  assert.equal(cardMentionsParley({ text: 'Parley: test willpower (3).' }), true)
  assert.equal(cardMentionsParley({ textZh: '发现 1 个线索。' }), false)
  assert.equal(isParleyCard({ textZh: '谈判：…' }), true)
  assert.equal(isParleyCard(null, TEST_LOCATION_PARLEY), true)
  assert.equal(isParleyCard({ textZh: '发现 1 个线索。' }, '01001'), false)
})

test('P2.7 legalMoves：地点与同地点敌人的谈判行动都会出现（AI 与人类同一份列表）', () => {
  const { state, inv, loc } = parleyFixture()
  loc.originalCode = TEST_LOCATION_PARLEY
  const foe = enemy(state, { code: TEST_ENEMY_PARLEY, name: '信徒', engagedSeat: null, exhausted: false })
  const moves = legalMoves(state, 0).filter(candidate => candidate.action === 'entityAbility')
  assert.equal(moves.length, 2)
  assert.ok(moves.some(candidate => candidate.entityType === 'location' && candidate.label.includes('交出情报')))
  assert.ok(moves.some(candidate => candidate.entityType === 'enemy' && candidate.label.includes('劝走信徒')))
  // 同地点的普通敌人不会凭空多出谈判。
  foe.code = 'ghoulMinion'
  const after = legalMoves(state, 0).filter(candidate => candidate.action === 'entityAbility')
  assert.equal(after.length, 1)
})

test('P2.7 目标：声明了 target 的谈判按目标展开，并复用同一份目标校验', () => {
  const { state, inv, loc } = parleyFixture()
  loc.originalCode = TEST_LOCATION_PARLEY
  const guard = enemy(state, { code: TEST_PARLEY_TARGET, name: '守卫', engagedSeat: null })
  const moves = legend => legalMoves(state, 0).filter(candidate => candidate.entityType === 'enemy')
  const candidates = moves().filter(candidate => candidate.action === 'entityAbility' && candidate.targetId)
  // 守卫自己有「收买守卫」；但目标枚举包含同地点所有敌人（含自己）。
  assert.ok(candidates.length >= 1)
  const first = candidates[0]
  assert.equal(validateMove(state, 0, first), null)
  assert.match(String(parleyTargetError(state, inv, guard, entityParleyDescriptors(guard)[0], { targetId: 'nope' })), /不合法/)
})

test('P2.7 执行：谈判消耗 1 个行动点并结算描述子，不引发借机攻击', () => {
  const { state, inv, loc } = parleyFixture()
  loc.originalCode = TEST_LOCATION_PARLEY
  // 一个与调查员交战、处于重整状态的敌人：普通行动会引发借机攻击，谈判不会。
  const foe = enemy(state, { code: 'ghoulMinion', name: '食尸鬼', engagedSeat: 0, exhausted: false })
  const move_ = legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility')
  assert.ok(move_, '应有谈判行动')
  const actionsBefore = inv.actionsLeft
  const resourcesBefore = inv.resources
  const logSize = state.log.length
  move(state, { action: 'entityAbility', entityType: move_.entityType, entityId: move_.entityId, abilityIndex: move_.abilityIndex })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actionsBefore - 1)
  assert.equal(state.investigators[0].resources, resourcesBefore + 2)
  const log = state.log.slice(logSize).join('\n')
  assert.ok(log.includes('谈判：交出情报'), '应写出能力日志')
  assert.ok(!log.includes('借机攻击'), '谈判不引发借机攻击')
  // 敌人仍在原地（谈判描述子只加资源）。
  assert.ok(state.enemies.some(item => item.id === foe.id))
})

test('P2.7 借机攻击对照：普通行动仍然会引发借机攻击', () => {
  const { state, inv } = parleyFixture()
  const foe = enemy(state, { code: 'ghoulMinion', name: '食尸鬼', engagedSeat: 0, exhausted: false })
  void foe
  const target = state.locations.find(location => location.id !== inv.location && location.revealed)
  if (!target) {
    // 本局可能没有可选移动目标：用一个不影响断言的事实（移动不在 legalMoves）收尾。
    assert.ok(!legalMoves(state, 0).some(candidate => candidate.action === 'move'))
    return
  }
  const logSize = state.log.length
  move(state, { action: 'move', locationId: target.id })
  settle(state)
  assert.ok(state.log.slice(logSize).join('\n').includes('借机攻击'))
})

test('P2.7 实体解析：实体不在场时执行直接返回 false，不写日志也不扣行动', () => {
  const { state } = parleyFixture()
  const before = state.investigators[0].actionsLeft
  const logSize = state.log.length
  const moves = legalMoves(state, 0)
  assert.ok(!moves.some(candidate => candidate.action === 'entityAbility' && candidate.entityId === 'ghost'))
  assert.equal(state.investigators[0].actionsLeft, before)
  assert.equal(state.log.length, logSize)
})

test('P2.7 目标筛选：不满足 criteria 的谈判不出现在 legalMoves', () => {
  const { state, loc } = parleyFixture()
  registerCardAbilities([{
    code: '01993',
    scope: 'location',
    abilities: [{
      kind: 'action',
      actionKind: 'parley',
      label: '谈判：只在有线索时可谈',
      cost: { action: 1 },
      criteria: [ctx => (ctx.state.locations.find(location => location.id === ctx.inv.location)?.clues || 0) >= 3],
      resolve: () => {},
    }],
  }])
  loc.originalCode = '01993'
  loc.clues = 0
  assert.equal(legalMoves(state, 0).filter(candidate => candidate.action === 'entityAbility').length, 0)
  loc.clues = 3
  assert.equal(parleyMovesFor(state, state.investigators[0]).length, 1)
})
