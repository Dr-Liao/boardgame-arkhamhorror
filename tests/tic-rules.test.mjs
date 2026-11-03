import test from 'node:test'
import assert from 'node:assert/strict'
import { RULES, RULE_INDEX, ruleById, cardRuleIds, matchingRules } from '../web/rulebook-data.js'
import { TIC_RULES, TIC_RULE_IDS } from '../web/tic-rules.js'
import { TIC_KEYWORDS } from '../content/campaigns/theInnsmouthConspiracy/keywords.js'
import { CYCLE_CODES } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildScan } from '../tools/scan-tic-mechanisms.mjs'
import { deckCardLimit, upgradeQuote } from '../web/deck-rules.js'

test('P3 关键词全集与扫描一致；全部代表卡都有有效的卡文直达', () => {
  const scanned = buildScan().mechanisms.filter(row => row.type === 'keyword')
  assert.deepEqual(TIC_KEYWORDS.map(row => row.id).sort(), scanned.map(row => row.id).sort())
  for (const keyword of TIC_KEYWORDS) {
    assert.equal(ruleById(keyword.ruleId).id, keyword.ruleId)
    assert.deepEqual(keyword.cardCodes, scanned.find(row => row.id === keyword.id).cards)
    assert.ok(keyword.primitives.length)
    for (const code of keyword.cardCodes) assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId), `${code} 缺 ${keyword.ruleId}`)
  }
  for (const code of CYCLE_CODES) assert.ok(cardRuleIds(ALL_CARDS[code]).includes('ticCampaign'))
})
test('P3 中英规则条目、拼音索引和相关跳转完整，正文不含实现状态或源码路径', () => {
  assert.equal(new Set(RULES.map(rule => rule.id)).size, RULES.length)
  assert.deepEqual(TIC_RULE_IDS, TIC_RULES.map(rule => rule.id))
  for (const rule of TIC_RULES) {
    assert.ok(rule.body.length >= 3 && rule.bodyEn.length === rule.body.length)
    assert.ok(rule.titleEn && rule.groupEn)
    assert.match(RULE_INDEX.find(item => item.id === rule.id).sortKey, /^[a-z]+$/)
    for (const id of rule.related) assert.equal(ruleById(id).id, id)
    assert.doesNotMatch(rule.body.join(''), /引擎|实现|审计|verified|pending|src\/|界面|按钮/)
    assert.ok(matchingRules(rule.title).some(row => row.id === rule.id))
    assert.ok(matchingRules(rule.titleEn).some(row => row.id === rule.id))
  }
})
test('P3 关键口径：有限池、检定外揭示、淹没无固有效果、空气、钥匙和 Road X', () => {
  const body = id => ruleById(id).body.join('\n')
  assert.match(body('ticBless'), /10/); assert.match(body('ticBless'), /之外/)
  assert.match(body('ticCurse'), /额外费用/); assert.match(body('ticSeal'), /离场/)
  assert.match(body('ticFlood'), /没有固有效果/); assert.match(body('ticFlood'), /5 点直接伤害/)
  assert.match(body('ticKeys'), /提示卡/); assert.match(body('ticKeys'), /同地点/)
  assert.match(body('ticVehicles'), /每轮/); assert.match(body('ticVehicles'), /不能独立/)
  assert.match(body('ticRoad'), /同一列/); assert.match(body('ticRoad'), /第一张取道路牌库顶/)
  assert.match(body('ticCampaign'), /没有通常的升级窗口/)
})
test('P3 复用构筑关键词：卓越单张与双倍经验，永久不占张数的现有规则入口保持有效', () => {
  const exceptional = ALL_CARDS['07224']
  assert.equal(deckCardLimit(exceptional), 1)
  assert.equal(upgradeQuote(exceptional, null).printed, exceptional.xp * 2)
  assert.match(ruleById('permanent').body.join(''), /不占牌组张数/)
  assert.ok(cardRuleIds(exceptional).includes('upgrade'))
})
