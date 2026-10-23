// 万象无终（TCU）第 2 步 P2.2 原语验收：幽灵界第二遭遇牌堆。
//
// 覆盖路线图 §4.1 的必测项：建堆、抽牌、洗回、弃牌、存档、隐私（牌堆顺序不外泄）。
// 单元段直接测 alt-decks.js 的纯数据操作；集成段走 engine 导出的 drawExtraEncounter，
// 证明第二牌堆与普通遭遇牌共用同一条显现管线，而且两套牌堆互不污染。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, settle } from './core-fixture.mjs'
import { drawExtraEncounter } from '../src/engine/engine.js'
import {
  EXTRA_ENCOUNTER_DECKS, addToExtraEncounterDeck, discardFromExtraEncounterDeck,
  discardTopOfExtraEncounterDeck, drawFromExtraEncounterDeck, extraDeckId, extraDeckPiles,
  extraEncounterDeckInfo, extraEncounterDecksInfo, resetExtraEncounterDecks,
  setExtraEncounterDeck, shuffleIntoExtraEncounterDeck,
} from '../src/engine/alt-decks.js'
import { campaignProjection } from '../src/cards/campaign-view.js'

const identity = list => [...list]
const reverse = list => [...list].reverse()

test('P2.2 词表：只接受已登记的牌堆 id，未知 id 立即失败', () => {
  assert.deepEqual([...EXTRA_ENCOUNTER_DECKS], ['spectral'])
  assert.equal(extraDeckId('spectral'), 'spectral')
  assert.throws(() => extraDeckId('mythos'), /未知的额外遭遇牌堆/)
  assert.throws(() => extraDeckId(undefined), /未知的额外遭遇牌堆/)
})

test('P2.2 建堆：去重 + 注入的洗牌顺序 + 清空弃牌堆', () => {
  const state = { extraEncounterDecks: { spectral: { deck: ['old'], discard: ['oldDiscard'] } } }
  const piles = setExtraEncounterDeck(state, 'spectral', ['a', 'b', 'a', 'c'], { shuffle: reverse })
  assert.deepEqual(piles.deck, ['c', 'b', 'a'])
  assert.deepEqual(piles.discard, [])
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 3, discard: [] })
  assert.throws(() => setExtraEncounterDeck(state, 'spectral', 'abc'), /卡号数组/)
})

test('P2.2 加牌：默认放牌库底，top 放牌库顶', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a'], { shuffle: identity })
  addToExtraEncounterDeck(state, 'spectral', ['b', 'c'])
  assert.deepEqual(extraDeckPiles(state, 'spectral').deck, ['b', 'c', 'a'])
  addToExtraEncounterDeck(state, 'spectral', ['d', 'e'], { top: true })
  assert.deepEqual(extraDeckPiles(state, 'spectral').deck, ['b', 'c', 'a', 'e', 'd'])
})

test('P2.2 洗回：与牌堆合并后重新洗牌', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a', 'b'], { shuffle: identity })
  const size = shuffleIntoExtraEncounterDeck(state, 'spectral', ['c', 'd'], { shuffle: reverse })
  assert.equal(size, 4)
  assert.deepEqual(extraDeckPiles(state, 'spectral').deck, ['d', 'c', 'b', 'a'])
})

test('P2.2 抽牌：从牌堆顶抽；空了把弃牌堆洗回来；两堆都空返回 null', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a', 'b'], { shuffle: identity })
  assert.equal(drawFromExtraEncounterDeck(state, 'spectral'), 'b')
  assert.equal(drawFromExtraEncounterDeck(state, 'spectral'), 'a')
  assert.equal(drawFromExtraEncounterDeck(state, 'spectral'), null)

  discardFromExtraEncounterDeck(state, 'spectral', ['x', 'y'])
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 0, discard: ['x', 'y'] })
  assert.equal(drawFromExtraEncounterDeck(state, 'spectral', { shuffle: reverse }), 'x')
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 1, discard: [] })
})

test('P2.2 弃牌：弃顶 N 张进弃牌堆，牌堆不足时有多少弃多少', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a', 'b', 'c'], { shuffle: identity })
  assert.deepEqual(discardTopOfExtraEncounterDeck(state, 'spectral', 2), ['c', 'b'])
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 1, discard: ['c', 'b'] })
  assert.deepEqual(discardTopOfExtraEncounterDeck(state, 'spectral', 5), ['a'])
  assert.deepEqual(discardTopOfExtraEncounterDeck(state, 'spectral', 1), [])
})

test('P2.2 公开读数：只给张数与弃牌堆，不泄露牌堆顺序', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a', 'b', 'c'], { shuffle: identity })
  const info = extraEncounterDeckInfo(state, 'spectral')
  assert.deepEqual(Object.keys(info).sort(), ['deck', 'discard'])
  assert.equal(info.deck, 3)
  // 弃牌堆返回副本：调用方修改不会污染 state。
  info.discard.push('leak')
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral').discard, [])
  assert.deepEqual(extraEncounterDecksInfo(state), { spectral: { deck: 3, discard: [] } })
})

test('P2.2 重置：新关卡清空所有额外牌堆', () => {
  const state = {}
  setExtraEncounterDeck(state, 'spectral', ['a'])
  resetExtraEncounterDecks(state)
  assert.deepEqual(state.extraEncounterDecks, {})
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 0, discard: [] })
})

// ---------------------------------------------------------------------------
// 集成段：真实引擎里的第二牌堆
// ---------------------------------------------------------------------------

function spectralFixture(codes) {
  const state = fixture('01001', 1)
  setExtraEncounterDeck(state, 'spectral', codes, { shuffle: identity })
  return { state, inv: state.investigators[0] }
}

test('P2.2 集成：从第二牌堆抽牌走同一条显现管线，结算后进威胁区/弃牌堆', () => {
  const { state, inv } = spectralFixture(['dissonantVoices'])
  const standardBefore = [...state.encounterDeck]
  const events = []
  drawExtraEncounter(state, inv, events, 'spectral')
  settle(state)
  // 这是一张「放置入场」的诡计：结算完在威胁区，不进弃牌堆。
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 0, discard: [] })
  assert.deepEqual(state.investigators[0].threat.map(card => card.code), ['dissonantVoices'])
  // 普通遭遇牌库完全没被动过（两套牌堆隔离）。
  assert.deepEqual(state.encounterDeck, standardBefore)
  assert.ok(state.log.some(line => line.includes('翻开遭遇卡')))
})

test('P2.2 集成：第二牌堆两堆都空时不抽牌也不抛错', () => {
  const { state, inv } = spectralFixture([])
  const before = state.log.length
  drawExtraEncounter(state, inv, [], 'spectral')
  assert.equal(state.log.length, before)
  assert.deepEqual(extraEncounterDeckInfo(state, 'spectral'), { deck: 0, discard: [] })
})

test('P2.2 集成：存档往返后第二牌堆仍在，且能继续抽牌', () => {
  const { state } = spectralFixture(['dissonantVoices'])
  // 建堆会去重；再手动加一张同名牌，验证「抽一张后还剩一张」。
  addToExtraEncounterDeck(state, 'spectral', ['dissonantVoices'])
  const restored = JSON.parse(JSON.stringify(state))
  restored.pendingChoice = null
  assert.deepEqual(extraEncounterDeckInfo(restored, 'spectral'), { deck: 2, discard: [] })
  const target = restored.investigators[0]
  drawExtraEncounter(restored, target, [], 'spectral')
  settle(restored)
  assert.deepEqual(extraEncounterDeckInfo(restored, 'spectral'), { deck: 1, discard: [] })
  assert.deepEqual(restored.investigators[0].threat.map(card => card.code), ['dissonantVoices'])
})

test('P2.2 集成：观察投影只在建过堆的关卡出现 spectral，且只公开张数与弃牌堆', () => {
  const plain = fixture('01001', 1)
  assert.equal('spectral' in campaignProjection(plain), false)

  const { state } = spectralFixture(['dissonantVoices'])
  const projection = campaignProjection(state)
  assert.deepEqual(projection.spectral, { deck: 1, discard: [] })
  assert.equal('deck' in projection.spectral, true)
  // 牌堆顺序不在投影里：只有张数。
  assert.equal(typeof projection.spectral.deck, 'number')
})
