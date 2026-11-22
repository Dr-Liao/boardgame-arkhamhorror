// 批次 4：调查员套件接线验收（可用性 / 平行与替换签名构筑 / Subject 5U-21 特殊牌组）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { INVESTIGATORS, ALL_CARDS } from '../src/cards/cards-data.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { getAvailability, SELECTABLE_INVESTIGATOR_CODES } from '../src/deck/availability.js'
import { corePlayerPool } from '../src/engine/engine.js'
import {
  campaignAllowsInvestigator, campaignRequiredInvestigatorCodes, campaignSeatingIncludesRequired,
} from '../src/campaign/campaign.js'
import { manifest as redTideRising } from '../content/campaigns/redTideRising/manifest.js'
import { fixture } from './core-fixture.mjs'

const counts = codes => codes.reduce((out, code) => { out[code] = (out[code] || 0) + 1; return out }, {})

test('批次 4 调查员套件：平行/印刷调查员可选、无重复且签名依赖合法', () => {
  const expected = [
    '90037', '90046', '90049', '90059', '90062', '90078', '90081', '90084', '90087',
    '98001', '98004', '98007', '98010', '98013', '98016', '98019', '99001', '89001',
  ]
  for (const code of expected) {
    assert.equal(SELECTABLE_INVESTIGATOR_CODES.includes(code), true, `${code} 应可选`)
    assert.equal(getAvailability(code).selectable, true, `${code} availability.selectable`)
  }
  assert.equal(SELECTABLE_INVESTIGATOR_CODES.length, new Set(SELECTABLE_INVESTIGATOR_CODES).size, '可选调查员不能重复')
  // 平行 Wendy 必带 90038；Jim 必带 90052；Wendy 平行不能把 Tidal Memento 塞给核心温蒂。
  const wendy = buildDeck(INVESTIGATORS['90037'], { seed: 'batch4-wendy' })
  assert.equal(wendy.playerCards.length, 30)
  assert.ok(wendy.signatureCards.includes('90038'), '平行温蒂必带 Tidal Memento')
  assert.ok(wendy.signatureCards.includes('01014') || wendy.signatureCards.includes('90039'))
  const coreWendy = buildDeck(INVESTIGATORS['01005'], { seed: 'batch4-core-wendy' })
  assert.ok(!coreWendy.signatureCards.includes('90038'), '核心温蒂不应自动带平行专属卡')
  const jim = buildDeck(INVESTIGATORS['90049'], { seed: 'batch4-jim' })
  assert.ok(jim.signatureCards.includes('90052'), '平行吉姆必带 The Beyond')
})

test('批次 4 调查员套件：平行与书籍替换签名按 advanced/both 正确替换', () => {
  // 平行 Wendy：advanced = 90039/90040（90038 恒带）。
  const wendy = buildDeck(INVESTIGATORS['90037'], { seed: 'advanced-wendy', investigatorBuild: { back: '90037', signatures: 'advanced' } })
  assert.ok(wendy.signatureCards.includes('90038'))
  assert.ok(wendy.signatureCards.includes('90039'))
  assert.ok(wendy.signatureWeaknesses.includes('90040'))
  // 小说 Roland：advanced 替换为 98005/98006。
  const roland = buildDeck(INVESTIGATORS['98004'], { seed: 'novel-roland', investigatorBuild: { back: '98004', signatures: 'advanced' } })
  assert.ok(roland.signatureCards.includes('98005'))
  assert.ok(roland.signatureWeaknesses.includes('98006'))
  // 纪念 Marie：advanced 替换为 99002/99003。
  const marie = buildDeck(INVESTIGATORS['99001'], { seed: 'promo-marie', investigatorBuild: { back: '99001', signatures: 'advanced' } })
  assert.ok(marie.signatureCards.includes('99002'))
  assert.ok(marie.signatureWeaknesses.includes('99003'))
  // Lola 平行：advanced = 5 张 Leading Lady（签名事件）+ Samuel Blake（专属弱点）。
  const lola = buildDeck(INVESTIGATORS['90087'], { seed: 'lola', investigatorBuild: { back: '90087', signatures: 'advanced' } })
  for (const code of ['90088', '90089', '90090', '90091', '90092']) assert.ok(lola.signatureCards.includes(code), `Lola advanced 缺少 ${code}`)
  assert.ok(lola.signatureWeaknesses.includes('90093'))
})

test('批次 4 Subject 5U-21：50 张、五职业各≥7、3 反刍/3 现实溶蚀/2 基础弱点', () => {
  const state = fixture('01001')
  const pool = corePlayerPool(state, '89001')
  assert.ok(pool.length > 100, 'Subject 自动构筑使用全部已开放玩家池')
  const deck = buildDeck(INVESTIGATORS['89001'], { seed: 'subject', playerPool: pool })
  assert.equal(deck.playerCards.length, 50)
  const byClass = counts(deck.playerCards.map(code => ALL_CARDS[code]?.klass).filter(Boolean))
  for (const klass of ['guardian', 'seeker', 'rogue', 'mystic', 'survivor']) {
    assert.ok((byClass[klass] || 0) >= 7, `${klass} 至少 7 张，实际 ${byClass[klass] || 0}`)
  }
  const signature = counts(deck.signatureCards)
  assert.equal(signature['89002'], 1, 'Ravenous 1 张')
  assert.equal(signature['89003'], 3, 'Regurgitation 3 张')
  const weaknesses = counts(deck.signatureWeaknesses)
  assert.equal(weaknesses['89004'], 3, 'Reality Acid 3 张')
  assert.equal(deck.basicWeaknesses.length, 2, '2 张随机基础弱点')
})

test('批次 4 挑战多人语义：指定调查员必须在场，其余席位任意', () => {
  for (const [campaign, required] of [[redTideRising, '90037']]) {
    assert.deepEqual(campaignRequiredInvestigatorCodes(campaign), [required])
    assert.equal(campaignAllowsInvestigator(campaign, required), true)
    assert.equal(campaignAllowsInvestigator(campaign, '01001'), true, '任意队友调查员可加入')
    assert.equal(campaignSeatingIncludesRequired(campaign, [required, '01001']), true)
    assert.equal(campaignSeatingIncludesRequired(campaign, ['01001', '01002']), false, '缺少指定调查员应拒绝')
  }
})
