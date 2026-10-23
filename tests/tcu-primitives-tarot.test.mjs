// 万象无终（TCU）第 2 步 P2.4 原语验收：塔罗牌组（22 张大阿卡纳）。
//
// 覆盖路线图 §4.1 的必测项：洗牌确定性、重复抽取、选择、存档、投影。
// 塔罗是剧本级牌组（不是 05 卡号），随机只有 shuffle 与 positive/negative（正逆位）两个注入点，
// 因此这里可以完全确定性地断言顺序与结果。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAJOR_ARCANA, TAROT_ORIENTATIONS, arcanaById, buildTarotDeck, chooseTarot, discardDrawnTarot,
  drawTarot, normalizeOrientation, resetTarotDeck, shuffleTarotIntoDeck, tarotInfo, tarotOrientation,
  tarotRemaining, validateTarotCards,
} from '../src/engine/tarot.js'
import { campaignProjection } from '../src/cards/campaign-view.js'

const identity = list => [...list]
const reverse = list => [...list].reverse()

test('P2.4 规范表：22 张大阿卡纳 id 0–21 唯一且可反查', () => {
  assert.equal(MAJOR_ARCANA.length, 22)
  assert.deepEqual(MAJOR_ARCANA.map(arcana => arcana.id), Array.from({ length: 22 }, (_, i) => i))
  assert.equal(arcanaById(0).nameEn, 'The Fool')
  assert.equal(arcanaById(21).name, '世界')
  assert.equal(arcanaById(99), null)
  assert.deepEqual([...TAROT_ORIENTATIONS], ['upright', 'reverse'])
})

test('P2.4 校验：未知 id、重复、非 22 张都直接失败', () => {
  assert.throws(() => validateTarotCards([0, 22]), /未知的大阿卡纳/)
  assert.throws(() => validateTarotCards([0, 0]), /塔罗牌重复/)
  assert.throws(() => buildTarotDeck({}, { shuffle: identity, cards: [0, 1] }), /必须是 22 张/)
  assert.throws(() => buildTarotDeck({}, {}), /需要注入 shuffle/)
})

test('P2.4 建堆：22 张按注入的 shuffle 排列，牌库顺序不进入公开投影', () => {
  const state = {}
  const pile = buildTarotDeck(state, { shuffle: reverse })
  assert.equal(pile.deck.length, 22)
  assert.equal(pile.deck[0], 21)
  assert.equal(pile.deck.at(-1), 0)
  assert.deepEqual(pile.drawn, [])
  const info = tarotInfo(state)
  assert.deepEqual(Object.keys(info).sort(), ['deck', 'discarded', 'drawn'])
  assert.equal(info.deck, 22)
  // 投影里没有 deck 数组本身（只有张数）。
  assert.equal(typeof info.deck, 'number')
})

test('P2.4 抽牌：从牌库顶抽、正逆位可指定、抽走的牌不再出现', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: identity }) // deck = [0..21]，顶 = 21
  const [first] = drawTarot(state, { orientation: 'upright' })
  assert.equal(first.arcana, 21)
  assert.equal(first.orientation, 'upright')
  const [second] = drawTarot(state, { orientation: 'reverse' })
  assert.equal(second.arcana, 20)
  assert.equal(second.orientation, 'reverse')
  assert.equal(tarotRemaining(state).length, 20)
  assert.deepEqual(tarotInfo(state).drawn.map(entry => entry.arcana), [21, 20])
  assert.throws(() => drawTarot(state, { orientation: 'sideways' }), /正逆位无效/)
  assert.throws(() => normalizeOrientation('up'), /正逆位无效/)
})

test('P2.4 抽牌：一次抽多张不重复；牌库空了返回空数组（不自动洗回）', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  const entries = drawTarot(state, { count: 3 })
  assert.deepEqual(entries.map(entry => entry.arcana), [21, 20, 19])
  assert.equal(new Set(entries.map(entry => entry.arcana)).size, 3)
  drawTarot(state, { count: 30 })
  assert.deepEqual(tarotRemaining(state), [])
  assert.deepEqual(drawTarot(state, { count: 1 }), [])
  assert.equal(tarotInfo(state).drawn.length, 22)
})

test('P2.4 正逆位：orientation=random 用注入的随机源决定，边界稳定', () => {
  assert.equal(tarotOrientation('upright'), 'upright')
  assert.equal(tarotOrientation('reverse'), 'reverse')
  assert.equal(tarotOrientation('random', () => 0.1), 'reverse')
  assert.equal(tarotOrientation('random', () => 0.9), 'upright')
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  const [low] = drawTarot(state, { orientation: 'random', random: () => 0.2 })
  const [high] = drawTarot(state, { orientation: 'random', random: () => 0.8 })
  assert.equal(low.orientation, 'reverse')
  assert.equal(high.orientation, 'upright')
})

test('P2.4 选择：抽出 N 选 1，未选中的放回牌库底，选中的留在已抽区', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  const asked = []
  const chosen = chooseTarot(state, {
    seat: 0, count: 3, requestChoice: (target, request) => { asked.push(request); return '19' },
  })
  assert.equal(chosen.arcana, 19)
  assert.equal(asked.length, 1)
  assert.equal(asked[0].kind, 'pickTarot')
  assert.deepEqual(asked[0].options.map(option => option.id), ['21', '20', '19'])
  // 选项自带界面要显示的牌面信息（编号 / 正逆位 / 中英文名），前端不再存 22 张表。
  assert.equal(asked[0].options[0].arcana, 21)
  assert.equal(asked[0].options[0].orientation, 'upright')
  assert.equal(asked[0].options[0].nameZh, '世界')
  assert.equal(asked[0].source.kind, 'tarot')
  // 21/20 放回牌库底（unshift 保持原顺序），19 保留。
  assert.deepEqual(tarotRemaining(state), [21, 20, ...Array.from({ length: 19 }, (_, i) => i)])
  assert.deepEqual(tarotInfo(state).drawn.map(entry => entry.arcana), [19])
})

test('P2.4 洗回与弃置：显式洗回用注入的随机源，弃置进 discarded', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  drawTarot(state, { count: 2 }) // 21, 20
  shuffleTarotIntoDeck(state, { shuffle: identity })
  assert.equal(tarotRemaining(state).length, 22)
  assert.deepEqual(tarotInfo(state).drawn, [])
  drawTarot(state, { count: 1 }) // 洗回后牌库顶是 20（21/20 追加在末尾）
  assert.equal(discardDrawnTarot(state, 20), true)
  assert.equal(discardDrawnTarot(state, 20), false)
  assert.deepEqual(tarotInfo(state), { deck: 21, drawn: [], discarded: [20] })
  assert.throws(() => shuffleTarotIntoDeck(state, {}), /需要注入 shuffle/)
})

test('P2.4 存档：牌库、已抽出的正逆位与弃置区随存档往返', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  drawTarot(state, { count: 2, orientation: 'reverse' })
  discardDrawnTarot(state, 20)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(tarotInfo(restored), {
    deck: 20,
    drawn: [{ arcana: 21, orientation: 'reverse', nameZh: '世界', nameEn: 'The World' }],
    discarded: [20],
  })
  // 往返后还能继续抽。
  assert.equal(drawTarot(restored, { count: 1 })[0].arcana, 19)
  // 重置只删塔罗，不动其它剧本牌组。
  resetTarotDeck(restored)
  assert.equal(tarotInfo(restored), null)
})

test('P2.4 投影：只有建过塔罗牌组的关卡才出现 tarot，且不含顺序', () => {
  const plain = {}
  assert.equal('tarot' in campaignProjection(plain), false)
  const state = {}
  buildTarotDeck(state, { shuffle: identity })
  drawTarot(state, { count: 1, orientation: 'reverse' })
  const projection = campaignProjection(state)
  assert.deepEqual(projection.tarot, {
    deck: 21,
    drawn: [{ arcana: 21, orientation: 'reverse', nameZh: '世界', nameEn: 'The World' }],
    discarded: [],
  })
})
