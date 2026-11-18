// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P3 关键词与规则书 Node 验收（数据层）。
//
// 覆盖：
//   · 关键词清单（6 项：逃逸／昼夜／法典／巡逻／警戒／祝福诅咒）与 P1 机制扫描逐条一致；
//     每个关键词有引擎读点导出、P2 原语全部 done、规则书条目与卡文直达；
//   · 规则书 11 条：中英双语、分组、拼音排序、相关跳转、搜索、卡文直达；
//   · 441 张 10 段卡全部有规则链接；关键词卡、居民面、传家宝、时间标记与章节参考卡逐一命中；
//   · 账本与浏览器验收在 tests/fhv-rules-ledger.test.mjs 复算（本文件不依赖 audit/ 账本）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { FHV_KEYWORDS } from '../content/campaigns/theFeastOfHemlockVale/keywords.js'
import { CYCLE_CODES, SCENARIO_REFERENCE_CODES, chapters } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import { FHV_CARD_RULE_PATTERNS, FHV_RULE_IDS, FHV_RULES } from '../web/fhv-rules.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const readJson = path => JSON.parse(readFileSync(join(MOD, path), 'utf8'))
const scan = readJson('audit/fhv-mechanism-scan.json')
const plan = readJson('audit/fhv-primitive-plan.json')
const scope = readJson('audit/fhv-scope.json')
const planRows = new Map([...plan.reuse, ...plan.new, ...plan.pending].map(row => [row.id, row]))
const ENGINEERING_WORDS = /引擎|实现方式|依赖注入|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i
const KEYWORD_TEXT = card => [card?.text, card?.backText, card?.customizationText, card?.customizationChange,
  (card?.traits || []).join(' ')].join('\n')
const CARD_TEXT = code => {
  const card = ALL_CARDS[code] || {}
  return [card.name || '', card.subname || '', card.text || '', card.backText || '', card.textZh || '',
    card.customizationText || '', card.customizationChange || '', (card.traits || []).join(' ')].join('\n')
}

test('P3 关键词清单：6 项身份与 P1 机制扫描逐条一致，原语全部在 P2 交付', async () => {
  assert.equal(FHV_KEYWORDS.length, 6)
  assert.deepEqual([...FHV_KEYWORDS.map(keyword => keyword.id)],
    ['elusive', 'dayNight', 'codex', 'patrol', 'alert', 'blessCurse'])
  assert.deepEqual([...FHV_KEYWORDS.map(keyword => keyword.mechanismId)],
    ['keyword.elusive', 'keyword.dayNight', 'rulebook.codex', 'keyword.patrol', 'keyword.alert', 'keyword.blessCurse'])
  for (const keyword of FHV_KEYWORDS) {
    const scanned = scan.mechanisms.find(row => row.id === keyword.mechanismId)
    assert.ok(scanned, `${keyword.id} 的机制 ${keyword.mechanismId} 不在 P1 扫描账本`)
    assert.ok(scanned.cards.length > 0, `${keyword.id} 没有卡面来源`)
    assert.deepEqual([...keyword.cardCodes], scanned.cards, `${keyword.id} 的 cardCodes 必须与 P1 扫描逐张一致`)
    assert.ok(['keyword', 'token'].includes(keyword.kind), `${keyword.id} 的 kind 非法`)
    assert.ok(['new', 'existing'].includes(keyword.origin), `${keyword.id} 的 origin 非法`)
    assert.ok(keyword.zh, `${keyword.id} 缺少中文名`)
    // 卡面来源可复算：只扫正文与特质（与 P1 扫描器同一语料），pattern 命中集合与 cardCodes 一致。
    const recomputed = CYCLE_CODES.filter(code =>
      keyword.patterns.some(pattern => new RegExp(pattern, 'i').test(KEYWORD_TEXT(ALL_CARDS[code]))))
    assert.deepEqual(recomputed, [...keyword.cardCodes], `${keyword.id} 的判据复算与 cardCodes 不一致`)
    // 原语在 P2 计划中全部 done。
    assert.ok(keyword.primitives.length > 0, `${keyword.id} 没有登记原语`)
    for (const primitive of keyword.primitives) {
      const row = planRows.get(primitive)
      assert.ok(row, `${keyword.id} 引用了未登记原语 ${primitive}`)
      assert.equal(row.status, 'done', `${keyword.id} 的原语 ${primitive} 未在 P2 交付`)
    }
    // 引擎读点：声明的模块真的导出这些函数（不能只由前端解释关键词）。
    for (const entry of keyword.engine) {
      const module = await import(`../${entry.module}`)
      for (const name of entry.names) assert.equal(typeof module[name], 'function', `${keyword.id} 缺少引擎导出 ${entry.module}#${name}`)
    }
    // 规则书条目存在、分组正确、中文名可搜索。
    const rule = ruleById(keyword.ruleId)
    assert.equal(rule.id, keyword.ruleId, `${keyword.id} 的规则条目 ${keyword.ruleId} 未注册`)
    assert.ok(rule.aliases.includes(keyword.zh), `${keyword.id} 的中文名「${keyword.zh}」必须是规则别名，搜索框才搜得到`)
    assert.ok(`${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.includes(keyword.zh),
      `${keyword.id} 的规则条目搜不到「${keyword.zh}」`)
  }
})

test('P3 规则书：11 条全部注册、中英双语、拼音排序、相关跳转与搜索可解析', () => {
  assert.equal(FHV_RULES.length, 11)
  assert.deepEqual([...FHV_RULE_IDS], FHV_RULES.map(entry => entry.id))
  assert.equal(RULES.filter(entry => entry.group === '铁杉谷盛宴').length, FHV_RULES.length)
  for (const entry of FHV_RULES) {
    assert.equal(ruleById(entry.id)?.id, entry.id, `${entry.id} 未注册到规则书`)
    assert.ok(Array.isArray(entry.body) && entry.body.length >= 2, `${entry.id} 中文正文段数不足`)
    assert.ok(Array.isArray(entry.bodyEn) && entry.bodyEn.length === entry.body.length, `${entry.id} 中英文段数不一致`)
    assert.ok(entry.titleEn && entry.groupEn, `${entry.id} 缺少英文标题/分组`)
    assert.equal(entry.group, '铁杉谷盛宴')
    assert.equal(entry.groupEn, 'The Feast of Hemlock Vale')
    assert.ok(entry.aliases.includes(entry.title) && entry.aliases.includes(entry.titleEn), `${entry.id} 别名缺少标题`)
    assert.match(String(RULE_INDEX.find(item => item.id === entry.id)?.sortKey || ''), /^[a-z]+$/, `${entry.id} 缺少拼音排序键`)
    for (const related of entry.related) assert.equal(ruleById(related)?.id, related, `${entry.id} 的相关条目 ${related} 未注册`)
    assert.ok(matchingRules(entry.title).some(item => item.id === entry.id), `${entry.id} 中文标题不可搜索`)
    assert.ok(matchingRules(entry.titleEn).some(item => item.id === entry.id), `${entry.id} 英文标题不可搜索`)
    assert.equal(ENGINEERING_WORDS.test([...entry.body, ...entry.bodyEn].join('')), false,
      `${entry.id} 正文不得写实现/引擎/验证字样（规则书只描述已实现的规则本身）`)
  }
})

test('P3 卡文直达：441 张卡全部有规则链接，关键词、居民、传家宝、时间标记与章节参考卡逐一命中', () => {
  assert.equal(CYCLE_CODES.length, 441)
  assert.deepEqual(CYCLE_CODES, scope.codes, '本循环卡号必须与 P0 范围账本一致')
  const unlinked = CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0)
  assert.deepEqual(unlinked, [], '每张 10 段卡都必须至少连到一条规则')
  assert.equal(CYCLE_CODES.every(code => cardRuleIds(ALL_CARDS[code]).includes('fhvCampaign')), true,
    '每张 10 段卡都必须连到战役概览条目')
  // 关键词卡逐一命中对应条目。
  for (const keyword of FHV_KEYWORDS) {
    for (const code of keyword.cardCodes) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId),
        `${code} 命中关键词 ${keyword.id} 却没有连到规则 ${keyword.ruleId}`)
    }
  }
  // 反向核对：规则的 pattern 命中卡必须都能反查到该规则（与 fhvCardRuleIds 同一判据）。
  for (const [ruleId, pattern] of FHV_CARD_RULE_PATTERNS) {
    const matched = CYCLE_CODES.filter(code => pattern.test(CARD_TEXT(code)))
    for (const code of matched) assert.ok(cardRuleIds(ALL_CARDS[code]).includes(ruleId), `${code} 命中 ${ruleId} 却未连入`)
  }
  // 卡名/战役记录承载身份的卡按卡号直达。
  const references = UI_CARDS.rulebookReferences
  for (const code of references.fhvResidentFaces) {
    for (const ruleId of ['fhvResidents', 'fhvCodex']) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(ruleId), `居民面 ${code} 未连到 ${ruleId}`)
    }
  }
  for (const code of references.fhvHeirloomCards) {
    assert.ok(cardRuleIds(ALL_CARDS[code]).includes('fhvResidents'), `传家宝 ${code} 未连到 fhvResidents`)
  }
  for (const code of references.fhvTimeMarkerCards) {
    assert.ok(cardRuleIds(ALL_CARDS[code]).includes('fhvTime'), `时间标记 ${code} 未连到 fhvTime`)
  }
  for (const code of SCENARIO_REFERENCE_CODES) {
    assert.equal(ALL_CARDS[code]?.type, 'scenario', `章节参考卡 ${code} 类型必须是 scenario`)
    assert.ok(cardRuleIds(ALL_CARDS[code]).includes('fhvCampaign'), `章节参考卡 ${code} 未连到战役概览`)
  }
  // 章节与范围账本一致（12 个可游玩/勘察入口，10 张真实提示卡——《岩间密语》另有 10502）。
  assert.equal(chapters.length, 12)
  assert.equal(SCENARIO_REFERENCE_CODES.length, 10)
})
