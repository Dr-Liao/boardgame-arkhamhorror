// TSK P2 原语验收 F：红色同志会/巡逻（coterie）与调查员接口（investigator）。
//
// 覆盖 new.redCoterie / coterieEncounterInjection / patrolKeyword、
// new.crossSeatAction / crossSeatActionWindow / healTrigger / evadeDiscard / doomDiscount / evidence、
// extend.records（三池）、extend.choices（授权/巡逻载荷）。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COTERIE_POOLS, alliedCoterie, coteriePool, coterieSnapshot, defeatedCoterie, initializeCoterie,
  injectCoterieEnemy, injectedCoterie, moveCoterieMember, patrolChoices, patrolDestination,
  patrolTargetLocation, validateTskCoterie,
} from '../src/engine/tsk-coterie.js'
import {
  CROSS_SEAT_WINDOW, DAMAGE_HEALED_WINDOW, addEvidence, crossSeatActionPending, crossSeatChoices,
  damageHealedContext, doomDiscountPlan, doomDiscountUsed, evidenceOf, evidenceSpendPlan, evadeDiscardPlan,
  grantCrossSeatAction, markDoomDiscountUsed, markEvidenceSpent, spendEvidence, takeCrossSeatAction,
  totalEvidence, validateTskCrossSeat, validateTskDoomDiscount, validateTskEvidence,
} from '../src/engine/tsk-investigator.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { windows } from '../src/engine/windows.js'

const plain = () => ({
  round: 2,
  investigators: [
    { seat: 0, name: '甲', location: 'locA', assets: [], threat: [], damage: 2, hand: [], deck: [] },
    { seat: 1, name: '乙', location: 'locA', assets: [], threat: [], damage: 0, hand: [], deck: [] },
  ],
  locations: [
    { id: 'locA', name: '甲地', connections: ['locB'], traits: ['Wilderness'] },
    { id: 'locB', name: '乙地', connections: ['locA', 'locC'], traits: [] },
    { id: 'locC', name: '丙地', connections: ['locB'], traits: [] },
  ],
  enemies: [{ id: 'e1', name: '敌人一', location: 'locB', exhausted: true, elite: false }],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))

test('同志会三池：初始化/跨池唯一/转移/快照；重复初始化与非法池拒绝', () => {
  const state = plain()
  assert.equal(coterieSnapshot(state), null)
  assert.deepEqual(initializeCoterie(state, { members: { unresolved: ['c1'], ally: ['c3'], defeated: ['c2'] } }),
    { unresolved: ['c1'], ally: ['c3'], defeated: ['c2'] })
  assert.throws(() => initializeCoterie(state, { members: { unresolved: ['c9'] } }), /已经初始化/)
  assert.deepEqual([...COTERIE_POOLS], ['unresolved', 'ally', 'defeated'])
  // 只填一个池也合法（成员总数 > 0 即可）。
  const single = plain()
  initializeCoterie(single, { members: { unresolved: ['c1'] } })
  assert.deepEqual(coterieSnapshot(single), { unresolved: ['c1'], ally: [], defeated: [] })
  // 全空/重复成员/未知池拒绝。
  assert.throws(() => initializeCoterie(plain(), { members: {} }), /不能为空/)
  assert.throws(() => initializeCoterie(plain(), { members: { unresolved: ['x'], ally: ['x'] } }), /同时出现在/)
  assert.throws(() => initializeCoterie(plain(), { members: { unresolved: ['x'], nope: ['y'] } }), /未知字段/)
  // 池间转移：成功与失败路径（不在源池/目标池已有）。
  assert.deepEqual(moveCoterieMember(state, { code: 'c1', from: 'unresolved', to: 'ally' }), ['c3', 'c1'])
  assert.deepEqual(coteriePool(state, 'unresolved'), [])
  assert.throws(() => moveCoterieMember(state, { code: 'c1', from: 'unresolved', to: 'allely' }), /转移目标非法/)
  assert.throws(() => moveCoterieMember(state, { code: 'ghost', from: 'ally', to: 'defeated' }), /不在 ally 池/)
  assert.throws(() => moveCoterieMember(state, { code: 'c1', from: 'ally', to: 'defeated2' }), /转移目标非法/)
  assert.deepEqual(defeatedCoterie(state), ['c2'])
  assert.deepEqual(alliedCoterie(state), ['c3', 'c1'])
})

test('遭遇注入：从恩怨未了池抽取；空池返回 null；确定性 random 可重放', () => {
  const state = plain()
  initializeCoterie(state, { members: { unresolved: ['c1', 'c2', 'c3'], ally: [], defeated: [] } })
  const draw = injectCoterieEnemy(state, { random: () => 0 })
  assert.deepEqual(draw, { code: 'c1', remaining: 2 })
  assert.deepEqual(injectedCoterie(state), ['c1'])
  const drawLast = injectCoterieEnemy(state, { random: () => 0.999 })
  assert.equal(drawLast.code, 'c3')
  assert.throws(() => injectCoterieEnemy(state, { random: () => 1 }), /\[0,1\)/)
  assert.equal(injectCoterieEnemy(state, { random: () => 0 }).code, 'c2')
  assert.equal(injectCoterieEnemy(state, { random: () => 0 }), null, '池空返回 null')
  assert.deepEqual(coteriePool(state, 'unresolved'), [])
  // 读档校验 + JSON 往返。
  validateTskCoterie(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.deepEqual(injectedCoterie(restored), ['c1', 'c3', 'c2'])
})

test('巡逻：named/trait 目标解析与下一步地点；非法目标拒绝', () => {
  const state = plain()
  // 敌人从 locC 出发，巡逻到命名地点 locA：下一步是 locB（敌人必须在 state.enemies 里，路径才把它的位置当可进入）。
  state.enemies = [{ id: 'p1', name: '巡逻者', location: 'locC', patrol: { kind: 'named', locationId: 'locA' } }]
  assert.equal(patrolTargetLocation(state, { kind: 'named', locationId: 'locA' }), 'locA')
  assert.equal(patrolDestination(state, state.enemies[0]), 'locB')
  // 已在目标地点：不移动。
  assert.equal(patrolDestination(state, { id: 'p2', location: 'locA', patrol: { kind: 'named', locationId: 'locA' } }), null)
  // 特质目标：选第一个（按 id 排序）匹配地点。
  assert.equal(patrolTargetLocation(state, { kind: 'trait', trait: 'Wilderness' }), 'locA')
  assert.equal(patrolTargetLocation(state, { kind: 'trait', trait: 'Nonexistent' }), null)
  assert.throws(() => patrolTargetLocation(state, { kind: 'named', locationId: 'ghost' }), /不在场/)
  assert.throws(() => patrolTargetLocation(state, { kind: 'weird' }), /kind/)
  // 合法动作载荷。
  assert.deepEqual(patrolChoices(state, state.enemies), [{ enemyId: 'p1', patrol: { kind: 'named', locationId: 'locA' }, destination: 'locB' }])
  // 窗口：跨座位/治疗窗口已注册。
  const ids = new Set(windows().map(window => window.id))
  assert.ok(ids.has(CROSS_SEAT_WINDOW))
  assert.ok(ids.has(DAMAGE_HEALED_WINDOW))
})

test('跨座位即时行动：每轮每目标一次、消耗后不可重复；JSON 往返', () => {
  const state = plain()
  assert.equal(crossSeatActionPending(state, 1), null)
  const grant = grantCrossSeatAction(state, { fromSeat: 0, targetSeat: 1 })
  assert.deepEqual(grant, { targetSeat: 1, from: 0, round: 2, used: false })
  assert.throws(() => grantCrossSeatAction(state, { fromSeat: 0, targetSeat: 1 }), /本轮已经获得过/)
  assert.throws(() => grantCrossSeatAction(state, { fromSeat: 0, targetSeat: 0 }), /不能授权自己/)
  assert.throws(() => grantCrossSeatAction(state, { fromSeat: 0, targetSeat: 9 }), /座位无效/)
  assert.deepEqual(crossSeatChoices(state).pending, [{ targetSeat: 1, fromSeat: 0, round: 2 }])
  assert.deepEqual(takeCrossSeatAction(state, 1), { targetSeat: 1, from: 0, round: 2, used: true })
  assert.equal(takeCrossSeatAction(state, 1), null)
  assert.deepEqual(crossSeatChoices(state).pending, [])
  validateTskCrossSeat(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(restored.scenarioFlags.mechanics.tsk.crossSeat.grants['1'][0].used, true)
})

test('治疗窗口上下文/躲避弃置/毁灭减费：正负路径与每轮一次', () => {
  const state = plain()
  const context = damageHealedContext(state, { healerSeat: 0, healedSeat: 1, amount: 2, cardCode: 'x' })
  assert.deepEqual(context, { when: 'damageHealed', seat: 0, cardSeat: 0, healedSeat: 1, amount: 2, cardCode: 'x' })
  assert.throws(() => damageHealedContext(state, { healerSeat: 0, healedSeat: 1, amount: 0 }), /治疗量/)
  // 躲避弃置：精英/未横置拒绝，横置非精英允许。
  assert.deepEqual(evadeDiscardPlan({ exhausted: true, elite: false }), { allowed: true })
  assert.equal(evadeDiscardPlan({ exhausted: true, elite: true }).allowed, false)
  assert.equal(evadeDiscardPlan({ exhausted: false }).allowed, false)
  // 毁灭减费：每轮一次、减至 0、登记后拒绝。
  assert.deepEqual(doomDiscountPlan(state, { seat: 0, baseCost: 3 }), { allowed: true, baseCost: 3, cost: 0, doom: 1, round: 2 })
  assert.equal(doomDiscountUsed(state, 0), false)
  assert.equal(markDoomDiscountUsed(state, 0), 2)
  assert.equal(doomDiscountUsed(state, 0), true)
  assert.equal(doomDiscountPlan(state, { seat: 0, baseCost: 3 }).allowed, false)
  assert.equal(doomDiscountPlan(state, { seat: 1, baseCost: 5 }).allowed, true)
  state.round = 3
  assert.equal(doomDiscountUsed(state, 0), false, '下一轮重新可用')
  validateTskDoomDiscount(state)
})

test('证据：卡实例计数器、花费下限、每次检定限一次；总数为规则读数', () => {
  const state = plain()
  const location = state.locations[0]
  assert.equal(addEvidence(location, 2), 2)
  assert.equal(evidenceOf(location), 2)
  assert.equal(addEvidence(location), 3)
  assert.equal(totalEvidence(state), 3)
  // 花费超过现有数量：花光全部并返回实际花费数；已为 0 时返回 0 且保持原状。
  assert.equal(spendEvidence(location, 5), 3)
  assert.equal(evidenceOf(location), 0)
  assert.equal(spendEvidence(location, 1), 0, '已有 0 时花费返回 0')
  assert.equal(addEvidence(location, 2), 2, '0.5 之类的小数按整数截断不产生写入')
  // 每次检定限一次。
  assert.deepEqual(evidenceSpendPlan(state, { seat: 0, testKey: 'test-1' }), { allowed: true, amount: 2, testKey: 'test-1' })
  markEvidenceSpent(state, 0, 'test-1')
  assert.equal(evidenceSpendPlan(state, { seat: 0, testKey: 'test-1' }).allowed, false)
  assert.equal(evidenceSpendPlan(state, { seat: 0, testKey: 'test-2' }).allowed, true)
  assert.throws(() => evidenceSpendPlan(state, { seat: 0 }), /testKey/)
  validateTskEvidence(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(totalEvidence(restored), 2)
})
