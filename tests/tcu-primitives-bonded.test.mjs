// 万象无终（TCU）第 2 步 P2.8 原语验收：绑定（Bonded）。
//
// 覆盖路线图 §4.1 的必测项：入场/离场、牌堆计数、存档、UI（公开投影）。
// 数据来自卡面：圣化之镜 05313 → 3 份舒缓旋律 05314；密教辞典 05316 → 3 份鲜血仪式 05317。
// 绑定副本放在场外集合；主卡入场检索（1 张入手、其余洗回牌库），离场收回。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, settle, use } from './core-fixture.mjs'
import {
  bondedGroupOf, bondedProjection, retrieveBonded, returnAllBonded, returnBonded,
} from '../src/engine/engine.js'
import { bondedCardList, bondedSetProjection, createBonded, findBondedMain, isBondedCopy } from '../src/engine/bonded.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { campaignProjection } from '../src/cards/campaign-view.js'

const mirror = '05313'
const melody = '05314'
const lexicon = '05316'
const rite = '05317'

function bondedFixture() {
  const state = fixture('01001', 1)
  return { state, inv: state.investigators[0] }
}

test('P2.8 读点：主卡/副本关系来自卡面数据，双向可解析', () => {
  assert.deepEqual(bondedGroupOf(mirror).copies, [{ code: melody, count: 3 }])
  assert.equal(bondedGroupOf(melody).copyOf, mirror)
  assert.equal(bondedGroupOf(lexicon).copies[0].code, rite)
  assert.equal(bondedGroupOf('01001'), null)
  assert.equal(findBondedMain({ '05313': { name: 'Hallowed Mirror', bondedCards: [{ code: '05314', count: 3 }] }, '05314': { bondedTo: 'Hallowed Mirror' } }, '05314'), '05313')
  assert.equal(isBondedCopy({ bondedTo: 'x' }), true)
  assert.equal(isBondedCopy({ bondedCount: 3 }), true)
  assert.equal(isBondedCopy({}), false)
  assert.deepEqual(bondedCardList({ bondedCards: [{ code: 'a', count: 2 }, { code: 'b' }] }), [{ code: 'a', count: 2 }, { code: 'b', count: 1 }])
})

test('P2.8 入场：检索 3 张，1 张进手牌，其余洗回牌库（不入弃牌堆）', () => {
  const { state, inv } = bondedFixture()
  const deckBefore = [...inv.deck]
  const retrieved = retrieveBonded(state, inv, mirror)
  assert.equal(retrieved.length, 3)
  assert.deepEqual(state.investigators[0].hand, [melody])
  const after = state.investigators[0]
  assert.equal(after.deck.filter(code => code === melody).length, 2)
  assert.equal(after.deck.length, deckBefore.length + 2)
  assert.deepEqual(after.discard, [])
  // 场外集合清空，但保留「已检索」状态，避免重复检索。
  assert.deepEqual(bondedProjection(state)[mirror], { seat: 0, cards: [], retrieved: true })
  const again = retrieveBonded(state, inv, mirror)
  assert.deepEqual(again, [])
  assert.equal(state.investigators[0].hand.length, 1)
})

test('P2.8 离场：副本从手牌/牌库/弃牌堆/场上收回场外集合', () => {
  const { state, inv } = bondedFixture()
  retrieveBonded(state, inv, mirror)
  const current = state.investigators[0]
  // 模拟：一张被弃置、一张当作场上支援、一张仍在牌库（总数仍是 3 张）。
  current.discard.push(current.hand.pop())
  const deckIndex = current.deck.indexOf(melody)
  current.deck.splice(deckIndex, 1)
  current.assets.push({ id: 'c1', code: melody, exhausted: false })
  const returned = returnBonded(state, state.investigators[0], mirror)
  assert.equal(returned.length, 3)
  assert.deepEqual(bondedProjection(state)[mirror], { seat: 0, cards: [melody, melody, melody], retrieved: true })
  const after = state.investigators[0]
  assert.equal(after.deck.filter(code => code === melody).length, 0)
  assert.equal(after.discard.filter(code => code === melody).length, 0)
  assert.equal(after.assets.filter(asset => asset.code === melody).length, 0)
  // 收回后可以再次检索（下一关/再次入场）。
  retrieveBonded(state, state.investigators[0], mirror)
  assert.equal(state.investigators[0].hand.filter(code => code === melody).length, 1)
})

test('P2.8 两组绑定互不影响，章节结束一次性收回', () => {
  const { state, inv } = bondedFixture()
  retrieveBonded(state, inv, mirror)
  retrieveBonded(state, inv, lexicon)
  assert.equal(state.investigators[0].hand.length, 2)
  assert.deepEqual(state.investigators[0].hand.sort(), [melody, rite].sort())
  const total = returnAllBonded(state)
  assert.equal(total, 6)
  assert.deepEqual(state.investigators[0].hand, [])
  assert.equal(bondedProjection(state)[mirror].cards.length, 3)
  assert.equal(bondedProjection(state)[lexicon].cards.length, 3)
})

test('P2.8 没有绑定集合时一次性收回是空操作（旧战役不新增状态键）', () => {
  const { state } = bondedFixture()
  assert.equal(returnAllBonded(state), 0)
  assert.equal('bondedSets' in state, false)
  assert.deepEqual(bondedProjection(state), {})
})

test('P2.8 存档：场外集合与已检索标记随存档往返', () => {
  const { state, inv } = bondedFixture()
  retrieveBonded(state, inv, mirror)
  const restored = JSON.parse(JSON.stringify(state))
  restored.pendingChoice = null
  assert.deepEqual(bondedProjection(restored)[mirror], { seat: 0, cards: [], retrieved: true })
  returnBonded(restored, restored.investigators[0], mirror)
  assert.deepEqual(bondedProjection(restored)[mirror].cards, [melody, melody, melody])
})

test('P2.8 纯工厂：洗牌由注入函数决定（确定性可测）', () => {
  const inv = { seat: 0, hand: [], deck: ['01088'], discard: [], assets: [], threat: [] }
  const state = { investigators: [inv], bondedSets: undefined }
  const logs = []
  const bonded = createBonded({
    ALL_CARDS: {
      '05313': { name: 'Hallowed Mirror', bondedCards: [{ code: '05314', count: 3 }] },
      '05314': { bondedTo: 'Hallowed Mirror', bondedCount: 3 },
    },
    cardName: code => code,
    info: (target, events, text) => logs.push(text),
  })
  assert.equal(bonded.groupOf('05313').copies[0].count, 3)
  bonded.retrieve(state, inv, '05313', { events: [], shuffle: list => [...list].reverse() })
  assert.deepEqual(inv.hand, ['05314'])
  assert.deepEqual(inv.deck, ['05314', '05314', '01088'])
  assert.ok(logs.some(text => text.includes('绑定卡')))
})


// 测试用条目：一条能力走 ctx.api.bonded 检索，一条走收回（与真实卡的生命周期钩子同形）。
registerCardAbilities([{
  code: '01992',
  abilities: [
    { kind: 'action', label: '测试：检索绑定副本', resolve: ({ inv, api }) => { api.bonded.retrieve(inv.seat, '05313') } },
    { kind: 'action', label: '测试：收回绑定副本', resolve: ({ inv, api }) => { api.bonded.return(inv.seat, '05313') } },
  ],
}])

test('P2.8 ctx.api：卡面生命周期钩子可以通过 api.bonded 检索/收回', () => {
  const state = fixture('01001', 1)
  const card = { id: 'c992', code: '01992', exhausted: false }
  state.investigators[0].assets.push(card)
  const before = state.investigators[0].hand.length
  use(state, card)
  settle(state)
  assert.equal(state.investigators[0].hand.filter(code => code === melody).length, 1)
  assert.equal(state.investigators[0].hand.length, before + 1)
  // 第二张能力收回：副本回到场外集合。
  use(state, state.investigators[0].assets.find(asset => asset.id === card.id), { abilityIndex: 1 })
  settle(state)
  assert.equal(state.investigators[0].hand.filter(code => code === melody).length, 0)
  assert.deepEqual(bondedSetProjection(state)[mirror].cards, ['05314', '05314', '05314'])
})

test('P2.8 投影：有绑定集合时才出现在观察投影里，内容为公开信息', () => {
  const state = fixture('01001', 1)
  assert.equal('bonded' in campaignProjection(state), false)
  retrieveBonded(state, state.investigators[0], mirror)
  const projection = campaignProjection(state)
  assert.deepEqual(projection.bonded[mirror], { seat: 0, cards: [], retrieved: true })
})
