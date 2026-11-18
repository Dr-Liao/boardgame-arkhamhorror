// 九循环《铁杉谷盛宴》P3 审计账本与浏览器验收复算。
//
// 覆盖：
//   · audit/fhv-rules.json 由 buildRulesAudit() 逐字节复算，门禁全真；
//   · confirmations.keywords 6/6、confirmations.rulebook 11 条全部 verified；
//   · 浏览器账本 audit/fhv-rules-browser.json：桌面 1440 / 移动 390 × 中英、卡文直达、无横向滚动；
//   · 迁移总账 audit/fhv-migration.json 正确合并 P3 规则确认（content/migration-confirmation.js 复算）；
//   · P2 交付声明：关键词原语全部 done，无 P3/P4 推迟项。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildRulesAudit } from '../tools/audit-fhv-rules.mjs'
import { KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { FHV_KEYWORDS } from '../content/campaigns/theFeastOfHemlockVale/keywords.js'
import { FHV_RULES } from '../web/fhv-rules.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))
const json = value => JSON.stringify(value, null, 2) + '\n'

test('P3 审计账本：confirmations 全部 verified、门禁全真且可逐字节复算', async () => {
  const report = await buildRulesAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `规则审计门禁失败：${failed.join(', ')}`)
  assert.equal(json(report), readText('audit/fhv-rules.json'),
    '规则审计账本必须由 buildRulesAudit() 逐字节复算（--check 口径）')
  assert.equal(report.milestone, 'P3')
  assert.equal(report.campaignId, 'theFeastOfHemlockVale')
  assert.equal(report.docs, 'docs/campaign/theFeastOfHemlockVale/rulebook.md')
  // confirmations.keywords：6/6 verified，检查项与迁移规范一致，覆盖 P1 扫描里的全部关键词机制。
  const keywords = report.confirmations.keywords
  assert.deepEqual(keywords.checks, [...KEYWORD_MIGRATION_CHECKS])
  assert.equal(keywords.total, FHV_KEYWORDS.length)
  assert.equal(keywords.checked, FHV_KEYWORDS.length)
  assert.equal(keywords.status, 'verified')
  assert.deepEqual(keywords.items.map(item => item.id), FHV_KEYWORDS.map(keyword => keyword.id))
  assert.deepEqual(keywords.coverage.confirmed, FHV_KEYWORDS.map(keyword => keyword.mechanismId))
  assert.deepEqual(keywords.coverage.scanned, ['keyword.elusive', 'keyword.dayNight', 'keyword.patrol',
    'keyword.alert', 'keyword.blessCurse'])
  assert.deepEqual(keywords.coverage.rulebookMechanisms, ['rulebook.codex', 'rulebook.survey', 'rulebook.locationAdjacency'])
  assert.deepEqual(keywords.coverage.excluded.map(row => row.mechanismId), ['keyword.bonded'])
  assert.ok(keywords.coverage.excluded[0].reason, '未并入 P3 的关键词机制必须显式登记理由')
  for (const item of keywords.items) {
    assert.equal(item.status, 'verified', `关键词 ${item.id} 未 verified`)
    assert.ok(item.cards.length > 0, `关键词 ${item.id} 缺少代表卡号`)
    assert.ok(item.evidence.length > 0, `关键词 ${item.id} 缺少证据`)
    assert.ok(['new', 'existing'].includes(item.origin), `关键词 ${item.id} 缺少新增/既有判定`)
  }
  // confirmations.rulebook：11/11 verified，检查项与迁移规范一致。
  const rulebook = report.confirmations.rulebook
  assert.equal(rulebook.status, 'verified')
  assert.equal(rulebook.entries, FHV_RULES.length)
  assert.deepEqual(Object.keys(rulebook.checks), [...RULEBOOK_MIGRATION_CHECKS])
  assert.deepEqual(rulebook.requiredRuleIds, FHV_RULES.map(entry => entry.id))
  for (const item of rulebook.items) assert.equal(item.status, 'verified', `规则 ${item.id} 未 verified`)
  assert.equal(rulebook.campaignOverview.listsEveryChapter, true)
  assert.equal(rulebook.campaignOverview.statesScenarioOrder, true)
  assert.equal(rulebook.scenarioMechanics.entriesPresent, true)
  assert.equal(rulebook.scenarioMechanics.scenarioCardsLinkCampaignRule, true)
  assert.equal(rulebook.cardLinks.linked, 441)
  assert.deepEqual(rulebook.cardLinks.unlinked, [])
  assert.equal(rulebook.chineseText, true)
  assert.equal(rulebook.englishText, true)
  // 证据来源：node 验收 + 浏览器验收 + 源码 SHA-256。
  for (const source of report.sources) {
    assert.match(String(source.sha256), /^[0-9a-f]{64}$/, `${source.path} 缺少 SHA-256`)
  }
  assert.equal(report.gates.nodeAcceptance, true)
  assert.equal(report.gates.browserAcceptance, true)
  // P3 对 P2 的交付声明：关键词所用原语全部 done，无 P3/P4 推迟项。
  assert.equal(report.deliveredPrimitives.length,
    new Set(FHV_KEYWORDS.flatMap(keyword => keyword.primitives)).size)
  assert.deepEqual(report.deferredPrimitives, { p3: [], p4: [] })
  // 确定性：两次构建逐字节一致。
  assert.equal(json(await buildRulesAudit()), json(report))
})

test('P3 浏览器验收账本：桌面 1440 / 移动 390 × 中英、卡文直达、无横向滚动', () => {
  const browser = readJson('audit/fhv-rules-browser.json')
  assert.equal(browser.status, 'passed')
  assert.deepEqual(browser.checks, {
    desktop: true, mobile: true, zh: true, en: true, cardLink: true, noHorizontalScroll: true,
  })
  assert.ok(browser.tests.length >= 6, '浏览器用例数不足（四象限阅读 + 两视口卡文直达）')
  assert.ok(browser.tests.every(entry => entry.ok === true), '浏览器用例必须全部通过')
  assert.ok(browser.screenshots.length >= 6)
  for (const screenshot of browser.screenshots) {
    assert.match(screenshot, /^artifacts\/migration\/fhv\/reports\/screenshots\/(desktop|mobile)-[^/]+\.png$/)
  }
})

test('P3/P8 迁移总账：confirmations.keywords / rulebook 合并为 verified，且符合迁移确认校验器', () => {
  const migration = readJson('audit/fhv-migration.json')
  const scope = readJson('audit/fhv-scope.json')
  assertMigrationConfirmations(migration, scope.scenarios.map(scenario => scenario.id))
  assert.equal(migration.confirmations.keywords.status, 'verified')
  assert.deepEqual(migration.confirmations.keywords.items.map(item => item.id),
    ['elusive', 'dayNight', 'codex', 'patrol', 'alert', 'blessCurse'])
  assert.equal(migration.confirmations.rulebook.status, 'verified')
  // P8 发布验收完成后战役已完整开放（P3 时该字段为 false，本断言随阶段推进到最终发布口径）。
  assert.equal(migration.status, 'verified')
  assert.equal(migration.playable, true, 'P8 发布验收完成后 playable 必须为 true')
  assert.equal(migration.earlyAccess, false)
})
