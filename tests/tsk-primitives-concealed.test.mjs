// TSK P2 原语验收 B：阴影/隐匿迷你卡（concealed）。
//
// 覆盖 new.concealedEntity / concealedDistribution / concealedExpose / concealedExposeRange /
// shadowPositions / concealedRoundEnd / windowExposed / concealedIdentityProjection。
// 口径：正路径、负路径（非法值不产生部分写入）、JSON 存档往返、读档校验。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPOSED_WINDOW, SHADOW_POSITIONS, concealTargetScope, concealedAt, concealedById, concealedMiniCards,
  concealedProjection, distributeConcealed, exposeMiniCard, isInShadows, placeMiniCard, reshuffleConcealed,
  setInShadows, validateTskConcealed,
} from '../src/engine/tsk-concealed.js'
import { windows } from '../src/engine/windows.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'

const plain = () => ({
  round: 3,
  investigators: [{ seat: 0, name: '甲', location: 'locA', assets: [], threat: [] }],
  locations: [
    { id: 'locA', name: '甲地', connections: ['locB'] },
    { id: 'locB', name: '乙地', connections: ['locA', 'locC'] },
    { id: 'locC', name: '丙地', connections: ['locB'] },
  ],
  enemies: [],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))
const copy = value => structuredClone(value)
const fixedShuffle = cards => [...cards].reverse()

test('阴影位置：地点进入阴影 + 三位置摆放；非法位置/地点拒绝', () => {
  const state = plain()
  assert.equal(isInShadows(state, 'locA'), false)
  assert.equal(setInShadows(state, 'locA', true), true)
  assert.equal(isInShadows(state, 'locA'), true)
  setInShadows(state, 'locA', false)
  assert.equal(isInShadows(state, 'locA'), false)
  assert.deepEqual([...SHADOW_POSITIONS], ['left', 'middle', 'right'])
  const mini = placeMiniCard(state, { kind: 'CoterieAgentA', locationId: 'locA', position: 'left' })
  assert.equal(mini.position, 'left')
  assert.equal('decoy' in mini ? mini.decoy : false, false)
  assert.equal(concealedAt(state, 'locA', 'left').length, 1)
  assert.equal(concealedAt(state, 'locA', 'middle').length, 0)
  assert.throws(() => placeMiniCard(state, { kind: 'CoterieAgentA', locationId: 'locA', position: 'top' }), /位置/)
  assert.throws(() => placeMiniCard(state, { kind: '', locationId: 'locA' }), /kind/)
  assert.throws(() => placeMiniCard(state, { kind: 'K', locationId: 'nope' }), /无效地点/)
  assert.equal(concealedMiniCards(state).length, 1, '非法放置不得写入')
})

test('分配混洗：数量守恒；数量不符/改写卡定义在写入前拒绝', () => {
  const state = plain()
  const cards = [
    { kind: 'CoterieAgentA', decoy: false },
    { kind: 'Decoy', decoy: true },
    { kind: 'Decoy', decoy: true },
  ]
  const created = distributeConcealed(state, {
    cards,
    placements: [{ locationId: 'locA', count: 2 }, { locationId: 'locB', count: 1 }],
    shuffle: fixedShuffle,
  })
  assert.equal(created.length, 3)
  assert.equal(concealedAt(state, 'locA').length, 2)
  assert.equal(concealedAt(state, 'locB').length, 1)
  // 分配顺序被确定性洗牌（reverse）：第一张是 decoy。
  assert.equal(created[0].decoy, true)
  const before = copy(state)
  assert.throws(() => distributeConcealed(state, { cards, placements: [{ locationId: 'locA', count: 2 }] }), /不一致/)
  assert.throws(() => distributeConcealed(state, {
    cards, placements: [{ locationId: 'locA', count: 3 }], shuffle: () => [...cards, { kind: 'X', decoy: false }],
  }), /同一数量|不得增删/)
  assert.throws(() => distributeConcealed(state, { cards, placements: [{ locationId: 'locA', count: 3 }], shuffle: () => [{ kind: 'X', decoy: false }] }), /同一数量|不得增删/)
  assert.deepEqual(state, before, '失败分配不得产生部分写入')
})

test('揭露：翻面并取出；真身/诱饵结果可信；重复揭露与未知 id 拒绝', () => {
  const state = plain()
  const mini = placeMiniCard(state, { kind: 'TheRedGlovedMan', decoy: false, locationId: 'locA' })
  const result = exposeMiniCard(state, mini.id)
  assert.deepEqual(result, { id: mini.id, kind: 'TheRedGlovedMan', decoy: false })
  assert.equal(concealedById(state, mini.id), null)
  assert.equal(concealedMiniCards(state).length, 0)
  assert.throws(() => exposeMiniCard(state, mini.id), /未知隐匿迷你卡/)
  const decoy = placeMiniCard(state, { kind: 'Decoy', decoy: true, locationId: 'locB' })
  assert.equal(exposeMiniCard(state, decoy.id).decoy, true)
  // 窗口已注册为可触发时机（exposed）。
  assert.ok(windows().some(window => window.id === EXPOSED_WINDOW))
})

test('攻防范围裁决：位置内迷你卡可被相邻地点攻防，揭露只能同地点', () => {
  const state = plain()
  const inPosition = placeMiniCard(state, { kind: 'CoterieAgentA', locationId: 'locB', position: 'left' })
  const sameLocation = placeMiniCard(state, { kind: 'CoterieAgentA', locationId: 'locB' })
  const scopeA = concealTargetScope(state, inPosition.id)
  assert.deepEqual(scopeA.expose, ['locB'])
  assert.deepEqual(scopeA.fightOrEvade.sort(), ['locA', 'locB', 'locC'].sort())
  assert.equal(scopeA.adjacentOnly, true)
  const scopeB = concealTargetScope(state, sameLocation.id)
  assert.deepEqual(scopeB.fightOrEvade, ['locB'])
  assert.equal(scopeB.adjacentOnly, false)
  assert.throws(() => concealTargetScope(state, 'nope'), /未知隐匿迷你卡/)
})

test('轮末混洗：不增删、不跨出当前地点集合；非法 shuffle 拒绝', () => {
  const state = plain()
  placeMiniCard(state, { kind: 'A', locationId: 'locA' })
  placeMiniCard(state, { kind: 'B', decoy: true, locationId: 'locB' })
  const before = concealedMiniCards(state).map(card => card.kind).sort()
  const mixed = reshuffleConcealed(state, { shuffle: fixedShuffle })
  assert.deepEqual(mixed.map(card => card.kind).sort(), before, '混洗不得增删')
  const spots = mixed.map(card => card.locationId).sort()
  assert.deepEqual(spots, ['locA', 'locB'])
  assert.throws(() => reshuffleConcealed(state, { shuffle: cards => cards.slice(0, 1) }), /同一数量|不得增删/)
})

test('观察投影：未翻面只给位置/数量；known 后才给身份', () => {
  const state = plain()
  const mini = placeMiniCard(state, { kind: 'HiddenKind', decoy: true, locationId: 'locA', position: 'right' })
  const hidden = concealedProjection(state)
  assert.equal(hidden.length, 1)
  assert.deepEqual(Object.keys(hidden[0]).sort(), ['locationId', 'position', 'visible'])
  assert.equal(hidden[0].visible, false)
  state.scenarioFlags.mechanics.tsk.concealed.miniCards[0].known = true
  assert.equal(concealedProjection(state)[0].kind, 'HiddenKind')
  assert.equal(concealedProjection(state)[0].decoy, true)
  assert.equal(concealedProjection(state, { revealAll: true })[0].id, mini.id)
})

test('存档往返与读档校验：合法容器通过；重复 id/非法地点/非法位置被拒绝', () => {
  const state = plain()
  distributeConcealed(state, {
    cards: [{ kind: 'A', decoy: false }, { kind: 'Decoy', decoy: true }],
    placements: [{ locationId: 'locA', count: 2 }], shuffle: fixedShuffle,
  })
  setInShadows(state, 'locB', true)
  validateTskConcealed(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(concealedMiniCards(restored).length, 2)
  // 负路径：重复 id、悬空地点、非法位置、陈旧版本。
  const duplicated = roundTrip(state)
  duplicated.scenarioFlags.mechanics.tsk.concealed.miniCards.push({ ...duplicated.scenarioFlags.mechanics.tsk.concealed.miniCards[0] })
  assert.throws(() => validateTskState(duplicated), /重复或无效/)
  const dangling = roundTrip(state)
  dangling.scenarioFlags.mechanics.tsk.concealed.miniCards[0].locationId = 'gone'
  assert.throws(() => validateTskState(dangling), /无效地点/)
  const badPosition = roundTrip(state)
  badPosition.scenarioFlags.mechanics.tsk.concealed.miniCards[0].position = 'top'
  assert.throws(() => validateTskState(badPosition), /位置无效/)
  const badVersion = roundTrip(state)
  badVersion.scenarioFlags.mechanics.tsk.concealed.version = 99
  assert.throws(() => validateTskState(badVersion), /不支持的隐匿迷你卡版本/)
})
