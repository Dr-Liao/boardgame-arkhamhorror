// 地点特性原语（src/engine/location-traits.js）回归。
//
// 两个配套能力：
//   1. 运行期特性授予 / 撤销（location.traitGrants 按来源记账，印刷特性永不删除）；
//   2. 阶段声明的特性连接规则（actRule/agendaRule.locationTraitLinks）：
//      「带某特性的在场地点互相连接」，由引擎在阶段进出/地点进出/特性授予时重算，
//      规则失效只撤销自己加过的边，印刷连接（含单向连接）不受影响。
//
// 03126「誓约」（往事回声）是第一个使用方；本文件用假条目验证原语本身，
// 并用真实 03126 registration 验证「声明 → 引擎自动接线」这一段。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocationTraits, grantedTraitsOf, locationHasTrait } from '../src/engine/location-traits.js'

const registry = {
  'act-rule': { actRule: { locationTraitLinks: ['Passageway'] } },
  'agenda-rule': { agendaRule: { locationTraitLinks: ['Passageway'] } },
}
const createPrimitive = (customRegistry = registry) => createLocationTraits({
  registeredEntry: code => customRegistry[code] || null,
  cardDef: () => null,
})

// 印刷定义：hall 没有连接；libraryA/B 单向印刷连接到 hall（用于验证单向连接不被误删）。
const definitions = {
  hall: { connections: [], traits: [] },
  libraryA: { connections: ['hall'], traits: ['Passageway'] },
  libraryB: { connections: ['hall'], traits: ['Passageway'] },
  archive: { connections: ['hall'], traits: [] },
}
function fixture() {
  return {
    scenario: { locations: structuredClone(definitions) },
    locations: [
      { id: 'hall', traits: [], connections: [] },
      { id: 'libraryA', traits: ['Passageway'], connections: ['hall'] },
      { id: 'libraryB', traits: ['Passageway'], connections: ['hall'] },
      { id: 'archive', traits: [], connections: ['hall'] },
    ],
    acts: [{ originalCode: 'act-rule' }],
    agendas: [],
    actIndex: 0,
    agendaIndex: 0,
  }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id)
const connectionsOf = (state, id) => [...(locationOf(state, id)?.connections || [])].sort()
const linkState = state => state.locationTraitLinks || null

test('grantedTraitsOf：只报运行期授予的特性，印刷特性不算；多来源合并', () => {
  const state = fixture()
  const traits = createPrimitive()
  const library = locationOf(state, 'libraryA')
  assert.deepEqual(grantedTraitsOf(library), [], '印刷特性不在 grantedTraits 里')
  assert.equal(locationHasTrait(library, 'Passageway'), true, '印刷特性仍然生效')
  traits.addLocationTrait(state, library, 'passageway', { source: 'peabody' })
  traits.addLocationTrait(state, library, 'Passageway', { source: 'other' })
  assert.deepEqual(grantedTraitsOf(library), ['Passageway'], '大小写归一 + 去重')
  assert.deepEqual(library.traitGrants.Passageway, ['other', 'peabody'], '来源排序记账')
  traits.removeLocationTrait(state, library, 'Passageway', { source: 'peabody' })
  assert.deepEqual(grantedTraitsOf(library), ['Passageway'], '还有其它来源时特性保留')
  traits.removeLocationTrait(state, library, 'Passageway', { source: 'other' })
  assert.deepEqual(grantedTraitsOf(library), [], '来源清空后取消授予')
  assert.equal(locationHasTrait(library, 'Passageway'), true, '印刷特性不会被撤销')
  assert.deepEqual(library.traitGrants, undefined, '空记账字段被删除（不污染存档）')
})

test('幕规则：带[[通道]]特性的地点互相连接；失效只撤销自动边，印刷单向连接保留', () => {
  const state = fixture()
  const traits = createPrimitive()
  traits.syncLocationTraitLinks(state)
  assert.deepEqual(linkState(state).rules, [{ id: 'act:act-rule:Passageway', trait: 'Passageway' }])
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall', 'libraryB'], '同类地点双向连接')
  assert.deepEqual(connectionsOf(state, 'libraryB'), ['hall', 'libraryA'])
  assert.deepEqual(connectionsOf(state, 'archive'), ['hall'], '非[[通道]]地点不受影响')
  assert.deepEqual(connectionsOf(state, 'hall'), [], 'hall 没有被连上（印刷无连接）')
  assert.deepEqual(linkState(state).added, [['libraryA', 'libraryB'], ['libraryB', 'libraryA']], '只记录引擎加过的方向')

  // 幂等：再同步不应改变任何状态。
  const snapshot = JSON.stringify(state)
  traits.syncLocationTraitLinks(state)
  assert.equal(JSON.stringify(state), snapshot, '重复同步幂等')

  // 规则失效（离开幕 3）：自动边撤销，印刷的 libraryA→hall 单向连接保留。
  state.acts = [{ originalCode: 'other' }]
  traits.syncLocationTraitLinks(state)
  assert.equal(linkState(state), null, '规则失效后不保留状态键')
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall'])
  assert.deepEqual(connectionsOf(state, 'libraryB'), ['hall'])
  assert.deepEqual(connectionsOf(state, 'hall'), [])
})

test('密谋规则同样生效；没有声明时不新增 state 键', () => {
  const state = fixture()
  state.acts = [{ originalCode: 'none' }]
  state.agendas = [{ originalCode: 'agenda-rule' }]
  const traits = createPrimitive()
  traits.syncLocationTraitLinks(state)
  assert.deepEqual(linkState(state).rules, [{ id: 'agenda:agenda-rule:Passageway', trait: 'Passageway' }])
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall', 'libraryB'])

  const plain = fixture()
  plain.acts = [{ originalCode: 'none' }]
  plain.agendas = []
  traits.syncLocationTraitLinks(plain)
  assert.equal(linkState(plain), null, '无规则且无历史时不写 state.locationTraitLinks')
})

test('授予特性让新地点加入网络；撤销后离开网络；印刷特性地点保持连通', () => {
  const state = fixture()
  const traits = createPrimitive()
  traits.syncLocationTraitLinks(state)
  traits.addLocationTrait(state, 'archive', 'Passageway', { source: '03141' })
  assert.deepEqual(connectionsOf(state, 'archive'), ['hall', 'libraryA', 'libraryB'])
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['archive', 'hall', 'libraryB'])
  assert.deepEqual(grantedTraitsOf(locationOf(state, 'archive')), ['Passageway'])

  traits.removeLocationTrait(state, 'archive', 'Passageway', { source: '03141' })
  assert.deepEqual(connectionsOf(state, 'archive'), ['hall'], '撤销后恢复原连接')
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall', 'libraryB'])
  assert.equal(locationHasTrait(locationOf(state, 'archive'), 'Passageway'), false)
})

test('地点移出网络：从 state.locations 移除后自动边一并撤销', () => {
  const state = fixture()
  const traits = createPrimitive()
  traits.syncLocationTraitLinks(state)
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall', 'libraryB'])
  state.locations = state.locations.filter(location => location.id !== 'libraryB')
  traits.syncLocationTraitLinks(state)
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall'])
  assert.deepEqual(linkState(state).added, [], '离场地点的自动边全部撤销')
})

test('存档往返：traitGrants / locationTraitLinks 都是纯 JSON，重载后重放同步结果一致', () => {
  const state = fixture()
  const traits = createPrimitive()
  traits.syncLocationTraitLinks(state)
  traits.addLocationTrait(state, 'archive', 'Passageway', { source: '03141' })
  const roundtrip = JSON.parse(JSON.stringify(state))
  const before = JSON.stringify(roundtrip)
  createPrimitive().syncLocationTraitLinks(roundtrip)
  assert.equal(JSON.stringify(roundtrip), before, '重载后重复同步零变化')
  assert.deepEqual(grantedTraitsOf(locationOf(roundtrip, 'archive')), ['Passageway'])
  assert.deepEqual(roundtrip.locationTraitLinks.added, state.locationTraitLinks.added)
})

test('引擎接线：03126 誓约的 actRule.locationTraitLinks 声明会自动互联印刷[[通道]]地点', async () => {
  const engine = await import('../src/engine/engine.js')
  const state = fixture()
  state.acts = [{ originalCode: '03126', name: '誓约' }]
  engine.syncLocationTraitLinks(state)
  assert.deepEqual(engine.activeLocationTraitLinks(state)?.rules,
    [{ id: 'act:03126:Passageway', trait: 'Passageway' }], '03126 条目声明被引擎读到')
  assert.deepEqual(connectionsOf(state, 'libraryA'), ['hall', 'libraryB'])
  assert.deepEqual(connectionsOf(state, 'libraryB'), ['hall', 'libraryA'])

  // 引擎导出的授予入口与 behavioral api 同源。
  engine.addLocationTrait(state, 'archive', 'Passageway', { source: '03141' })
  assert.deepEqual(engine.grantedLocationTraits(locationOf(state, 'archive')), ['Passageway'])
  assert.deepEqual(connectionsOf(state, 'archive'), ['hall', 'libraryA', 'libraryB'])
  engine.removeLocationTrait(state, 'archive', 'Passageway', { source: '03141' })
  assert.deepEqual(connectionsOf(state, 'archive'), ['hall'])
})
