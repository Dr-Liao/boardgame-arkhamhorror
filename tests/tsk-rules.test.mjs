// 八循环《绯红密钥》（TSK）P3 关键词与规则书 Node 验收。
//
// 覆盖：
//   · 关键词清单（29 个）与 P1 机制扫描逐条一致；每个关键词的规则条目与卡文直达可解析；
//   · 规则书 17 条：中英双语、分组、拼音排序、相关跳转、搜索、卡文直达；439 张卡全部有规则链接；
//   · 审计账本 audit/tsk-rules.json：confirmations.keywords / rulebook 全部 verified，门禁全真、可复算；
//   · 浏览器验收账本 audit/tsk-browser-acceptance.json：桌面 1440 / 移动 390 × 中英、卡文直达、无横向滚动。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildRulesAudit } from '../tools/audit-tsk-rules.mjs'
import { TSK_KEYWORD_IDS, TSK_KEYWORDS } from '../content/campaigns/theScarletKeys/keywords.js'
import { chapters, CYCLE_CODES } from '../content/campaigns/theScarletKeys/shared.js'
import { KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { PRIMITIVE_CATALOG } from '../tools/tsk-mechanism-primitives.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { MOD, json, readJson } from '../tools/tsk-migration-lib.mjs'
import { RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { TSK_CARD_RULE_PATTERNS, TSK_RULE_IDS, TSK_RULES, tskCardRuleIds } from '../web/tsk-rules.js'

const scan = readJson(join(MOD, 'audit/tsk-mechanism-scan.json'))
const plan = readJson(join(MOD, 'audit/tsk-primitive-plan.json'))
const ENGINEERING_WORDS = /引擎|实现方式|依赖注入|源码|审计|界面|按钮|\b(?:verified|pending|engine|implementation)\b|src\//i
const planRows = new Map([...plan.reuse, ...plan.p2.new, ...plan.p2.extend].map(row => [row.id, row]))

test('P3 关键词清单：29 个与 P1 机制扫描逐条一致，原语全部在 P2 交付', () => {
  const scanKeywords = scan.mechanisms.filter(row => row.type === 'keyword')
  assert.equal(TSK_KEYWORDS.length, 29)
  assert.deepEqual([...TSK_KEYWORD_IDS], scanKeywords.map(row => row.id), '关键词顺序必须与 P1 扫描账本一致')
  for (const keyword of TSK_KEYWORDS) {
    const scanned = scanKeywords.find(row => row.id === keyword.id)
    assert.ok(scanned, `${keyword.id} 不在 P1 扫描账本`)
    assert.deepEqual([...keyword.cardCodes], scanned.cards, `${keyword.id} 的 cardCodes 必须与 P1 扫描逐张一致`)
    assert.ok(keyword.cardCodes.length > 0, `${keyword.id} 没有卡面来源`)
    assert.ok(['keyword', 'token', 'trait'].includes(keyword.kind), `${keyword.id} 的 kind 非法`)
    assert.equal(ruleById(keyword.ruleId)?.id, keyword.ruleId, `${keyword.id} 的规则条目 ${keyword.ruleId} 未注册`)
    for (const primitive of keyword.primitives) {
      assert.ok(PRIMITIVE_CATALOG[primitive], `${keyword.id} 引用了未登记原语 ${primitive}`)
      const row = planRows.get(primitive)
      assert.ok(row && ['done', 'registered'].includes(row.status), `${keyword.id} 的原语 ${primitive} 未在 P2 交付`)
    }
    // 关键词判据可复算：pattern/fields 命中集合与 cardCodes 一致。
    const corpus = code => {
      const card = ALL_CARDS[code]
      return [card.name || '', card.subname || '', card.text || '', card.backText || '',
        card.customizationText || '', card.customizationChange || '', (card.traits || []).join(' ')].join('\n')
    }
    const recomputed = CYCLE_CODES.filter(code => {
      const card = ALL_CARDS[code]
      if (keyword.fields && keyword.fields.some(field => String(card[field] || '').trim())) return true
      return keyword.patterns.some(pattern => new RegExp(pattern, 'i').test(corpus(code)))
    })
    assert.deepEqual(recomputed, [...keyword.cardCodes], `${keyword.id} 的判据复算与 cardCodes 不一致`)
  }
})

test('P3 规则书：17 条全部注册、中英双语、拼音排序、相关跳转与搜索可解析', () => {
  assert.equal(TSK_RULES.length, 17)
  assert.deepEqual([...TSK_RULE_IDS], TSK_RULES.map(rule => rule.id))
  assert.equal(RULES.filter(rule => rule.group === '绯红密钥').length, TSK_RULES.length)
  for (const rule of TSK_RULES) {
    assert.equal(ruleById(rule.id)?.id, rule.id, `${rule.id} 未注册到规则书`)
    assert.ok(Array.isArray(rule.body) && rule.body.length >= 2, `${rule.id} 中文正文段数不足`)
    assert.ok(Array.isArray(rule.bodyEn) && rule.bodyEn.length === rule.body.length, `${rule.id} 中英文段数不一致`)
    assert.ok(rule.titleEn && rule.groupEn, `${rule.id} 缺少英文标题/分组`)
    assert.equal(rule.group, '绯红密钥')
    assert.equal(rule.groupEn, 'The Scarlet Keys')
    assert.ok(rule.aliases.includes(rule.title) && rule.aliases.includes(rule.titleEn), `${rule.id} 别名缺少标题`)
    assert.match(String(RULE_INDEX.find(item => item.id === rule.id)?.sortKey || ''), /^[a-z]+$/, `${rule.id} 缺少拼音排序键`)
    for (const related of rule.related) assert.equal(ruleById(related)?.id, related, `${rule.id} 的相关条目 ${related} 未注册`)
    assert.ok(matchingRules(rule.title).some(item => item.id === rule.id), `${rule.id} 中文标题不可搜索`)
    assert.ok(matchingRules(rule.titleEn).some(item => item.id === rule.id), `${rule.id} 英文标题不可搜索`)
    assert.equal(ENGINEERING_WORDS.test([...rule.body, ...rule.bodyEn].join('')), false,
      `${rule.id} 正文不得写实现/引擎/验证字样（规则书只描述已实现的规则本身）`)
  }
  // 关键词的 ruleId 必须落在已注册条目里（含复用基础条目）。
  for (const keyword of TSK_KEYWORDS) assert.equal(ruleById(keyword.ruleId)?.id, keyword.ruleId)
})

test('P3 卡文直达：439 张卡全部有规则链接，关键词卡与章节参考卡逐一命中', () => {
  const unlinked = CYCLE_CODES.filter(code => cardRuleIds(ALL_CARDS[code]).length === 0)
  assert.deepEqual(unlinked, [], '每张 09 卡都必须至少连到一条规则')
  assert.equal(CYCLE_CODES.every(code => cardRuleIds(ALL_CARDS[code]).includes('tskCampaign')), true,
    '每张 09 卡都必须连到战役概览条目')
  for (const keyword of TSK_KEYWORDS) {
    for (const code of keyword.cardCodes) {
      assert.ok(cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId),
        `${code} 命中关键词 ${keyword.id} 却没有连到规则 ${keyword.ruleId}`)
    }
  }
  // 章节参考卡（10 章）连到战役概览。
  for (const chapter of chapters) {
    assert.equal(ALL_CARDS[chapter.code]?.type, 'scenario', `章节参考卡 ${chapter.code} 不在卡表`)
    assert.ok(cardRuleIds(ALL_CARDS[chapter.code]).includes('tskCampaign'))
  }
  // 类型直达：调查员 / 密钥 / 章节卡。
  const investigatorCard = CYCLE_CODES.find(code => ALL_CARDS[code].type === 'investigator')
  assert.ok(cardRuleIds(ALL_CARDS[investigatorCard]).includes('tskInvestigator'))
  const keyCard = CYCLE_CODES.find(code => ALL_CARDS[code].type === 'key')
  assert.ok(cardRuleIds(ALL_CARDS[keyCard]).includes('tskKeys'))
  const scenarioCard = CYCLE_CODES.find(code => ALL_CARDS[code].type === 'scenario')
  assert.ok(cardRuleIds(ALL_CARDS[scenarioCard]).includes('tskMap'))
  // 反向核对：规则的 pattern 命中卡必须都能反查到该规则（与 tskCardRuleIds 同一判据）。
  for (const [ruleId, pattern] of TSK_CARD_RULE_PATTERNS) {
    const matched = CYCLE_CODES.filter(code => pattern.test([
      ALL_CARDS[code].name || '', ALL_CARDS[code].subname || '', ALL_CARDS[code].text || '',
      ALL_CARDS[code].backText || '', ALL_CARDS[code].customizationText || '',
      ALL_CARDS[code].customizationChange || '', (ALL_CARDS[code].traits || []).join(' '),
    ].join('\n')))
    for (const code of matched) assert.ok(cardRuleIds(ALL_CARDS[code]).includes(ruleId), `${code} 命中 ${ruleId} 却未连入`)
  }
  assert.equal(tskCardRuleIds(ALL_CARDS[CYCLE_CODES[0]]).includes('tskCampaign'), true)
})

test('P3 审计账本：confirmations 全部 verified、门禁全真且可逐字节复算', async () => {
  const report = await buildRulesAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `规则审计门禁失败：${failed.join(', ')}`)
  assert.equal(json(report), readFileSync(join(MOD, 'audit/tsk-rules.json'), 'utf8'),
    '规则审计账本必须由 buildRulesAudit() 逐字节复算（--check 口径）')
  assert.equal(report.milestone, 'P3')
  // confirmations.keywords：29/29 verified，检查项与迁移规范一致。
  assert.deepEqual(report.confirmations.keywords.checks, [...KEYWORD_MIGRATION_CHECKS])
  assert.equal(report.confirmations.keywords.total, 29)
  assert.equal(report.confirmations.keywords.checked, 29)
  assert.equal(report.confirmations.keywords.status, 'verified')
  for (const item of report.confirmations.keywords.items) {
    assert.equal(item.status, 'verified', `关键词 ${item.id} 未 verified`)
    assert.ok(item.cards.length > 0)
    assert.ok(item.evidence.length > 0)
  }
  // confirmations.rulebook：17/17 verified，检查项与迁移规范一致。
  const rulebook = report.confirmations.rulebook
  assert.equal(rulebook.status, 'verified')
  assert.equal(rulebook.entries, 17)
  assert.deepEqual(Object.keys(rulebook.checks), [...RULEBOOK_MIGRATION_CHECKS])
  for (const item of rulebook.items) assert.equal(item.status, 'verified', `规则 ${item.id} 未 verified`)
  assert.equal(rulebook.campaignOverview.listsEveryChapter, true)
  assert.equal(rulebook.cardLinks.linked, CYCLE_CODES.length)
  assert.deepEqual(rulebook.cardLinks.unlinked, [])
  // 证据来源：node 验收 + 浏览器验收 + 源码 SHA。
  assert.equal(report.gates.nodeAcceptance, true)
  assert.equal(report.gates.browserAcceptance, true)
  assert.equal(report.confirmations.rulebook.desktopBrowser, true)
  assert.equal(report.confirmations.rulebook.mobileBrowser, true)
  assert.equal(report.confirmations.rulebook.chineseText, true)
  assert.equal(report.confirmations.rulebook.englishText, true)
  for (const source of report.sources) assert.match(String(source.sha256), /^[0-9a-f]{64}$/, `${source.path} 缺少 SHA-256`)
  // P3 对 P2 的交付声明：关键词所用原语全部 done，无 P3/P4 推迟项。
  assert.ok(report.deliveredPrimitives.length > 0)
  for (const id of report.deliveredPrimitives) assert.ok(['done', 'registered'].includes(planRows.get(id)?.status))
  assert.deepEqual(report.deferredPrimitives, { p3: [], p4: [] })
  // 浏览器验收账本：六项 checks 全真、截图真实存在。
  const browser = readJson(join(MOD, 'audit/tsk-browser-acceptance.json'))
  assert.equal(browser.status, 'passed')
  assert.deepEqual(browser.checks, {
    desktop: true, mobile: true, zh: true, en: true, cardLink: true, noHorizontalScroll: true,
  })
  assert.ok(browser.screenshots.length >= 6)
  for (const screenshot of browser.screenshots) {
    assert.equal(existsSync(join(MOD, '..', '..', screenshot)), true, `截图缺失：${screenshot}`)
  }
  // 确定性：两次构建逐字节一致。
  assert.equal(json(await buildRulesAudit()), json(report))
})
