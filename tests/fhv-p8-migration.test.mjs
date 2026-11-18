// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P8 发布验收总账本的自检。
//
// 目标：`audit/fhv-migration.json` 必须由 `tools/audit-fhv.mjs` 逐字节复算——复算与签入结果一致，
// 且发布账本的最低事实面成立：441 条记录（301 战役 + 20 调查员 + 120 玩家）、12 章（4 序曲 + 8 章）、
// 26 遭遇组 / 18 共享组、6 关键词、35 流程节点、240 键战役记录、1462 叶正文、三组 confirmations、
// 逐卡门禁、发布浏览器截图与回归证据都与实际门禁一致。
//
// 本测试属 slow tier：每次运行会 spawn 账本 `--check-ledger` 子命令，而该命令按 P8 口径「一个事实源」
// 真实复算——重跑 scan/audit/verify/plan/import/build 的 --check 子命令、实跑战役 E2E 与守卫测试、
// golden replay 对比、并逐张复核发布浏览器截图哈希（约 2 分钟）。不放进 fast；也不在这里重复
// `--write`（那会把同样的复算再跑一遍），确定性由 `--check-ledger` 的逐字节比较保证。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chapters, encounterGroups, partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { manifest } from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import { FHV_FLOW_NODE_ORDER } from '../content/campaigns/theFeastOfHemlockVale/flow.js'
import { FHV_RECORD_SCHEMA } from '../content/campaigns/theFeastOfHemlockVale/records.js'
import { FHV_KEYWORDS } from '../content/campaigns/theFeastOfHemlockVale/keywords.js'
import { RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS } from '../content/migration-confirmation.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const REPORT = `${MOD}audit/fhv-migration.json`
const REQUIRED_GATES = [
  'registration', 'ledgers', 'allCards', 'campaignE2E', 'releaseBrowser', 'regression', 'replay',
  'guards', 'assets', 'confirmations', 'storyGuides', 'flowDeclared', 'docs', 'scripts',
]
const readReport = () => JSON.parse(readFileSync(REPORT, 'utf8'))

test('P8 FHV 发布账本：逐字节复算一致', () => {
  assert.ok(existsSync(REPORT), '缺少 audit/fhv-migration.json：先运行 node tools/audit-fhv.mjs --write')
  const result = spawnSync(process.execPath, ['tools/audit-fhv.mjs', '--check-ledger'], {
    cwd: MOD,
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 900_000,
  })
  assert.equal(result.status, 0, (result.stderr || result.stdout || '').slice(-2000))
})

test('P8 FHV 发布账本：发布状态由门禁推导，441 条记录与十二章齐备', () => {
  const report = readReport()
  const failed = Object.keys(report.gate).filter(key => report.gate[key] !== true)
  assert.equal(report.status, failed.length ? 'pending' : 'verified')
  assert.equal(report.playable, report.status === 'verified')
  assert.equal(report.launchEnabled, true)
  assert.equal(report.earlyAccess, false)
  assert.equal(report.equivalenceCertified, failed.length === 0)
  assert.equal(report.cycle, 'fhv')
  assert.equal(report.campaignId, 'theFeastOfHemlockVale')
  assert.equal(report.stage, 'P8')
  assert.equal(report.milestone, 'M5')
  assert.equal(report.releaseAcceptance.status, failed.length ? 'pending' : 'complete')
  assert.deepEqual(report.releaseAcceptance.deferred, [])
  assert.match(report.releaseAcceptance.note, /earlyAccess:false/)
  const pending = report.remaining.find(row => row.kind === 'gate-pending')
  assert.deepEqual(pending?.gates ?? [], failed)
})

test('P8 FHV 发布账本：计数与内容层现算一致（441 / 301 / 20 / 120 / 12 / 26 / 18）', () => {
  const report = readReport()
  assert.deepEqual(report.counts, {
    campaignCards: 301,
    investigatorCards: 20,
    playerCards: 120,
    total: 441,
    chapters: 12,
    encounterGroups: 26,
    sharedEncounterGroups: 18,
    keys: 6,
    flowNodes: FHV_FLOW_NODE_ORDER.length,
    recordKeys: Object.keys(FHV_RECORD_SCHEMA).length,
    chaosBags: 4,
    storyLeaves: 1462,
  })
  // 与内容层组合根现算交叉核对（不复制冻结结论）。
  assert.equal(partitions.fhvCampaign.length, 301)
  assert.equal(partitions.fhvInvestigators.length, 20)
  assert.equal(partitions.fhvPlayer.length, 120)
  assert.equal(chapters.length, 12)
  assert.equal(Object.keys(encounterGroups).length, 26)
  assert.equal(manifest.sharedEncounterGroupIds.length, 18)
  assert.equal(FHV_KEYWORDS.length, 6)
  assert.equal(Object.keys(FHV_RECORD_SCHEMA).length, 240)
  assert.equal(FHV_FLOW_NODE_ORDER.length, 35)
})

test('P8 FHV 发布账本：十四个门禁齐全，gate 视图与 gates[k].pass 一致', () => {
  const report = readReport()
  assert.deepEqual(Object.keys(report.gates), REQUIRED_GATES)
  for (const gate of REQUIRED_GATES) {
    assert.ok(report.gates?.[gate], `缺少门禁 ${gate}`)
    assert.equal(report.gate?.[gate], report.gates[gate].pass === true, gate)
  }
  // 逐卡 / 战役 E2E / 发布浏览器 / 资产：关键证据字段必须存在（值可为 false，但不得缺失）。
  assert.equal(report.gates.allCards.total !== undefined, true, 'allCards 缺少 total')
  assert.equal(typeof report.gates.allCards.summary?.gateComplete, 'boolean')
  assert.equal(typeof report.gates.campaignE2E.p8Titles, 'number')
  assert.equal(typeof report.gates.releaseBrowser.screenshots, 'number')
  assert.equal(typeof report.gates.assets.images?.total, 'number')
  assert.equal(report.gates.flowDeclared.start, 'prologue')
  assert.equal(report.gates.flowDeclared.flowNodes, 35)
  assert.equal(report.gates.flowDeclared.recordKeys, 240)
  assert.equal(report.gates.flowDeclared.flowRecordKeys, 240)
})

test('P8 FHV 发布账本：三组确认分组齐全，12 章 × 12 项 / 6 关键词 / 6 规则书项', () => {
  const report = readReport()
  assert.equal(report.confirmations.selfCheck.pass, true, report.confirmations.selfCheck.error || '')
  assert.equal(report.confirmations.scenarios.status, 'verified')
  assert.equal(report.confirmations.scenarios.items.length, 12)
  assert.equal(report.confirmations.keywords.status, 'verified')
  assert.equal(report.confirmations.rulebook.status, 'verified')
  assert.deepEqual(report.confirmations.selfCheck, { pass: true, error: null })
  // 章顺序与 shared.js#chapters 一致，每项 12 个 §6 检查全真且带证据。
  assert.deepEqual(report.confirmations.scenarios.items.map(item => item.id), chapters.map(chapter => chapter.id))
  for (const item of report.confirmations.scenarios.items) {
    assert.equal(item.status, 'verified', item.id)
    assert.deepEqual(Object.keys(item.checks).sort(), [...SCENARIO_MIGRATION_CHECKS].sort(), item.id)
    for (const check of SCENARIO_MIGRATION_CHECKS) {
      assert.equal(item.checks[check], true, `${item.id}.checks.${check}`)
    }
    assert.ok(item.evidence.length >= 3, `${item.id} 证据不足`)
  }
  assert.equal(report.confirmations.keywords.items.length, 6)
  for (const item of report.confirmations.keywords.items) {
    assert.equal(item.status, 'verified', item.id)
    assert.ok(item.evidence.length > 0, `${item.id} 缺少证据`)
  }
  assert.deepEqual(Object.keys(report.confirmations.rulebook.checks).sort(), [...RULEBOOK_MIGRATION_CHECKS].sort())
  for (const check of RULEBOOK_MIGRATION_CHECKS) {
    assert.equal(report.confirmations.rulebook.checks[check], true, `rulebook.checks.${check}`)
  }
  assert.ok(existsSync(`${MOD}web/fhv-rules.js`), '缺少 web/fhv-rules.js')
  assert.ok(existsSync(`${MOD}web/rulebook-data.js`), '缺少 web/rulebook-data.js')
})

test('P8 FHV 发布账本：来源清单 ≥20 且 sha256 为 UTF-8 文件字节', () => {
  const report = readReport()
  assert.ok(report.sources.length >= 20, `来源清单不足：${report.sources.length}`)
  for (const source of report.sources) {
    assert.equal(typeof source.path, 'string')
    assert.match(source.sha256, /^[0-9a-f]{64}$/, source.path)
    assert.ok(existsSync(`${MOD}${source.path}`), `来源文件不存在：${source.path}`)
  }
  // 关键来源必须在清单内（发布浏览器/资产/回归/正文/组合根）。
  const paths = new Set(report.sources.map(source => source.path))
  for (const required of [
    'audit/fhv-all-card-acceptance.json', 'audit/fhv-release-browser.json', 'audit/fhv-assets.json',
    'audit/fhv-regression.json', 'tests/fixtures/replay/golden-replays.json',
    'content/campaigns/theFeastOfHemlockVale/story-text.js', 'content/registered.js',
  ]) {
    assert.ok(paths.has(required), `来源清单缺少 ${required}`)
  }
})

test('P8 FHV 发布账本：逐卡账本 gateComplete 且 missing=0', () => {
  const report = readReport()
  assert.equal(report.gates.allCards.pass, true)
  assert.equal(report.gates.allCards.status, 'verified')
  assert.equal(report.gates.allCards.summary.gateComplete, true)
  assert.deepEqual(report.gates.allCards.summary.missing, [])
  assert.deepEqual(report.gates.allCards.summary.blocked, [])
  assert.equal(report.gates.allCards.summary.total, 441)
  assert.equal(report.gates.allCards.rows, 441)
  assert.equal(report.evidence.allCards.summary.total, 441)
})

test('P8 FHV 发布账本：素材 441 条全部解析，运行时零 参考资源/ 依赖', () => {
  const report = readReport()
  assert.equal(report.gates.assets.pass, true)
  assert.equal(report.gates.assets.status, 'verified')
  assert.equal(report.gates.assets.images.total, 441)
  assert.equal(report.gates.assets.images.unresolved, 0)
  assert.equal(report.gates.assets.images.local + report.gates.assets.images.remote, 441)
  assert.deepEqual(report.gates.assets.runtimeReferenceHits, [])
})

test('P8 FHV 发布账本：发布浏览器截图 ≥20 且逐张登记哈希', () => {
  const report = readReport()
  assert.equal(report.gates.releaseBrowser.pass, true)
  assert.equal(report.gates.releaseBrowser.status, 'passed')
  assert.equal(report.gates.releaseBrowser.complete, true)
  assert.equal(report.gates.releaseBrowser.sourceStable, true)
  assert.ok(report.gates.releaseBrowser.screenshots >= 20,
    `发布浏览器截图不足：${report.gates.releaseBrowser.screenshots}`)
  assert.equal(report.gates.releaseBrowser.screenshotsOk, true)
  assert.ok(report.evidence.releaseBrowser.screenshots >= 20)
  // 三项 phase × 双视口 + 隐私双视口 + 权限/断线（报告器字段名）。
  assert.equal(report.gates.releaseBrowser.requiredChecks, true)
  assert.equal(report.gates.releaseBrowser.requiredFlags, true)
})

test('P8 FHV 发布账本：回归无新增失败、replay 一致、baseline 冻结', () => {
  const report = readReport()
  assert.equal(report.gates.regression.pass, true)
  assert.equal(report.gates.regression.status, 'passed')
  assert.deepEqual(report.gates.regression.fast.newFailures, [])
  assert.equal(report.gates.regression.knownFailuresOk, true)
  assert.equal(report.gates.regression.replay.exitCode, 0)
  assert.equal(report.gates.regression.replay.matches, true)
  assert.equal(report.gates.replay.pass, true)
  assert.equal(report.gates.replay.exitCode, 0)
  assert.equal(report.gates.replay.baseline, 'tests/fixtures/replay/golden-replays.json')
  // 披露类余项：近似（player + campaign）与数据型/参考卡，数值来自 allCards.summary。
  const summary = report.evidence.allCards.summary
  const approximation = report.remaining.find(row => row.kind === 'disclosed-approximation')
  assert.equal(approximation.playerSimplified, summary.playerSimplified)
  assert.equal(approximation.campaignSimplified, summary.campaignSimplified)
  assert.equal(approximation.count, summary.playerSimplified + summary.campaignSimplified)
  assert.equal(approximation.playerSimplified, 54)
  assert.equal(approximation.campaignSimplified, 54)
  assert.equal(report.remaining.find(row => row.kind === 'scenario-data').count, summary.scenarioData)
  assert.equal(report.remaining.find(row => row.kind === 'scenario-reference').count, summary.scenarioReference)
  assert.equal(report.primitives.status, 'done')
  assert.equal(report.primitives.pending, 0)
  assert.equal(report.primitives.escape, 0)
  assert.equal(report.primitives.nextPhase, 'P9')
})
