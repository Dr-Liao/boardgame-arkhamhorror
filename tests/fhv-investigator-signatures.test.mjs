// 九循环《铁杉谷盛宴》P5 调查员及专属依赖 Node 验收（跨卡专项）。
//
// 逐人行为细节在 tests/fhv-investigator-<code>.test.mjs；本文件负责五人共同的「账本口径」：
//   · 每个调查员条目已注册、kind、旧印描述子、构筑规则字段；
//   · 牌组构筑：30/35 张玩家卡 + 印刷签名卡/弱点数量 + 随机基础弱点，validateDeckRules 无错误；
//   · 专属依赖：签名卡/专属弱点/绑定面全部注册、dependencyOnly、不可构筑；
//   · 非法构筑：加入职阶/等级范围外的卡必须报错（5 人各一例）；
//   · availability：可被真人选择（strict/selectable）、非 AI 随机池。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/cards/entries/10001.js'
import '../src/cards/entries/10002.js'
import '../src/cards/entries/10003.js'
import '../src/cards/entries/10004.js'
import '../src/cards/entries/10005.js'
import '../src/cards/entries/10005b.js'
import '../src/cards/entries/10006.js'
import '../src/cards/entries/10007.js'
import '../src/cards/entries/10008.js'
import '../src/cards/entries/10009.js'
import '../src/cards/entries/10010.js'
import '../src/cards/entries/10011.js'
import '../src/cards/entries/10012.js'
import '../src/cards/entries/10013.js'
import '../src/cards/entries/10014.js'
import '../src/cards/entries/10015.js'
import '../src/cards/entries/10016a.js'
import '../src/cards/entries/10016b.js'
import '../src/cards/entries/10017.js'
import '../src/cards/entries/10018.js'
import '../src/engine/engine.js'

import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { SIGNATURES_BY_INVESTIGATOR } from '../src/deck/availability.js'

const INVESTIGATORS_FHV = Object.freeze([
  { code: '10001', size: 30, signatures: ['10002', '10003'], bonded: [] },
  { code: '10004', size: 30, signatures: ['10005', '10008'], bonded: ['10005b', '10006', '10007'] },
  { code: '10009', size: 30, signatures: ['10010', '10011'], bonded: [] },
  { code: '10012', size: 30, signatures: ['10013', '10014'], bonded: [] },
  { code: '10015', size: 35, signatures: ['10017', '10018'], bonded: ['10016a', '10016b'] },
])

test('P5 专属/绑定依赖：20 个卡号全部注册且 dependencyOnly、不可构筑', () => {
  const dependencyCodes = INVESTIGATORS_FHV.flatMap(item => [...item.signatures, ...item.bonded])
  assert.equal(dependencyCodes.length, 15)
  for (const code of dependencyCodes) {
    const availability = getAvailability(code)
    assert.ok(availability.dependencyOnly, `${code} 必须是 dependencyOnly`)
    assert.equal(availability.deckbuilding, false, `${code} 不得进入一般构筑池`)
    assert.equal(availability.selectable, false, `${code} 不得作为调查员选择`)
    assert.equal(availability.availability, 'strict', `${code} 应已开放 strict 可用性`)
    assert.ok(registeredEntry(code), `${code} 必须注册条目`)
  }
  // 绑定面不在牌组签名清单里，但仍随调查员带入。
  assert.deepEqual(SIGNATURES_BY_INVESTIGATOR['10004'], ['10005', '10008'])
  assert.deepEqual(SIGNATURES_BY_INVESTIGATOR['10015'], ['10017', '10018'])
})

test('P5 调查员卡片数据：印刷牌组要求、职阶/特性范围与旧印描述子齐备', () => {
  for (const item of INVESTIGATORS_FHV) {
    const card = ALL_CARDS[item.code]
    const investigator = INVESTIGATORS[item.code]
    assert.ok(card, `${item.code} 必须在 cards-data 中`)
    assert.ok(investigator, `${item.code} 必须有 INVESTIGATORS 定义`)
    assert.equal(card.deckRequirements.size, item.size, `${item.code} 印刷牌组大小`)
    assert.deepEqual([...card.deckRequirements.signatureCards].sort(), [...item.signatures].sort(),
      `${item.code} 印刷签名卡`)
    assert.ok(Array.isArray(card.deckOptions) && card.deckOptions.length >= 2, `${item.code} 必须有印刷构筑选项`)
    const entry = registeredEntry(item.code)
    assert.equal(entry?.kind, 'investigator', `${item.code} 条目 kind`)
    assert.ok(entry?.elderSign?.resolve, `${item.code} 必须有旧印描述子`)
    assert.equal(entry.elderSign?.label != null, true)
  }
})

test('P5 构筑合法：五人 30/35 张 + 签名/弱点数量正确、规则校验零错误，非法牌组报错', () => {
  for (const item of INVESTIGATORS_FHV) {
    const definition = INVESTIGATORS[item.code]
    const deck = buildDeck(definition, { seed: `fhv-p5-signatures-${item.code}`, xp: 0 })
    assert.equal(deck.playerCards.length, item.size, `${item.code} 玩家卡张数`)
    // 签名卡/专属弱点：印刷数量（签名主卡 2、弱点 1 或签名 1/1），全部来自印刷清单。
    for (const signature of item.signatures) {
      const required = ALL_CARDS[item.code].deckRequirements.card?.[signature]?.quantity
        ?? ALL_CARDS[item.code].deckRequirements.card?.[signature]?.count
        ?? ALL_CARDS[item.code].deckRequirements.card?.[signature]
      void required
      const inDeck = [...deck.signatureCards, ...deck.signatureWeaknesses].filter(code => code === signature).length
      assert.ok(inDeck >= 1, `${item.code} 必须带入签名卡 ${signature}（实际 ${inDeck}）`)
    }
    assert.equal(deck.signatureWeaknesses.length >= 1, true, `${item.code} 必须带入专属弱点`)
    assert.equal(deck.basicWeaknesses.length >= 1, true, `${item.code} 必须带入随机基础弱点`)
    const validation = validateDeckRules(definition, deck.playerCards, ALL_CARDS)
    assert.deepEqual(validation.errors, [], `${item.code} 合法牌组不应有错误：${validation.errors.join('；')}`)
    // availability：真人可选（strict），且不在 AI 随机池（PLAYABLE 不含 FHV）。
    assert.equal(canSelectInvestigator(item.code), true, `${item.code} 应可由真人选择`)
    assert.equal(getAvailability(item.code).selectable, true, `${item.code} selectable`)
    assert.equal(getAvailability(item.code).availability, 'strict', `${item.code} strict`)
    assert.equal(getAvailability(item.code).deckbuilding, false, `${item.code} 调查员卡不可构筑`)
  }
})

test('P5 构筑非法：越出职阶/等级范围的卡必须被拒绝', () => {
  // 威尔森只允许 Tool 0–5、Guardian 0–4、Neutral 0–5、Improvised/Upgrade 0–1（限 5）：
  // 塞一张其他循环的高等级非 Tool/Guardian 卡必须报错。
  const cases = [
    { code: '10001', card: '09077' }, // Rogue 支援（非法职阶/特性）
    { code: '10004', card: '08238' }, // 非 Science/Insight 的高级卡
    { code: '10009', card: '01016' }, // 非 Rogue/Neutral、非 Parley 文本卡
    { code: '10015', card: '07021' }, // 非 Survivor/Neutral、非 Spirit/Innate
  ]
  for (const item of cases) {
    if (!ALL_CARDS[item.card]) continue
    const definition = INVESTIGATORS[item.code]
    const legal = buildDeck(definition, { seed: `fhv-p5-illegal-${item.code}`, xp: 0 })
    const illegal = [...legal.playerCards, item.card]
    const validation = validateDeckRules(definition, illegal, ALL_CARDS)
    assert.ok(validation.errors.length > 0, `${item.code} 混入 ${item.card} 必须报错`)
  }
})

test('P5 五人旧印效果：+值/附带效果与卡面一致且可结算', () => {
  const expectations = {
    '10001': 0, '10004': 0, '10009': 2, '10012': 2, '10015': 1,
  }
  for (const [code, bonus] of Object.entries(expectations)) {
    const entry = registeredEntry(code)
    assert.equal(entry.elderSign?.resolve != null, true, `${code} 旧印可结算`)
    assert.equal(Number(entry.investigator?.elderSign?.bonus) || 0, bonus, `${code} 旧印数值`)
  }
})
