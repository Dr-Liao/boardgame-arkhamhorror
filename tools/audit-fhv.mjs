#!/usr/bin/env node
// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale，FHV）P8：发布验收总账本。
//
//   node tools/audit-fhv.mjs                    打印账本（复算，不写盘）
//   node tools/audit-fhv.mjs --write            生成 audit/fhv-migration.json 与 artifacts/migration/fhv/p8/
//                                               （status!=='verified' 时写盘后退出码 1）
//   node tools/audit-fhv.mjs --check            逐字节复算；要求 status=verified
//   node tools/audit-fhv.mjs --check-ledger     逐字节复算；允许如实的 pending（门禁未全真）
//   node tools/audit-fhv.mjs --verify-files     只校验发布浏览器账本登记的截图文件（存在 + sha256）
//   node tools/audit-fhv.mjs --capture-baseline 冻结 P0 基线（保留：P0 基线逻辑不删）
//   node tools/audit-fhv.mjs --check-fast [p1|p2|p2-followup|p3] [--preexisting <report.json>]
//                                               比较本次快速回归与 P0 基线（保留）
//
// 口径（docs/arkham-content-migration.md §4.8 M5 / §5.6；README P8）：
//   · 一个事实源：逐卡/逐章账本要么直接 import 内容层现算（counts/flow/schema/正文叶子），要么实跑
//     既有 `--check` 命令（scan/audit/verify/plan/import/build 系列），不复制「已冻结的结论」；
//   · 逐卡：audit/fhv-all-card-acceptance.json（tools/audit-fhv-all-cards.mjs 生成）必须
//     status=verified、missing=0、total=441、rows.length=441；
//   · 战役 E2E：实跑 tests/fhv-p8-campaign.test.mjs + 既有 flow/engine/records 测试，并核对标题覆盖
//     （勘察/夜探/难度/存档/replay/撤退/居民 七类中 ≥5 类，P8 FHV 前缀标题 ≥6 条）；
//   · 浏览器发布：audit/fhv-release-browser.json（tools/playwright-fhv-release-reporter.mjs 生成）
//     status=passed、complete、sourceStableDuringRun、tests 全 passed、视口去重 ≥2、
//     release/progression/online × desktop/mobile 全真 + privacy 双视口 + permissionBoundary +
//     disconnectRecovery；截图 ≥20 张且逐张 {path, bytes>0, sha256 64hex}，并核对磁盘存在/哈希。
//     字段映射：本循环报告器用嵌套 checks[phase][viewport]（与 TSK P8 一致）；builder 同时容忍
//     `checks.releaseDesktop` 这类扁平命名、`tests[].ok` 旧式字段与 `sourceStable` 别名取反，
//     以兼容其它报告器写入的同一账本。
//   · confirmations：scenarios（12 章 × §6 12 项）/ keywords（6）/ rulebook 全部 verified，
//     并用 content/migration-confirmation.js#assertMigrationConfirmations 自检（错误入 selfCheck）；
//   · 回归：audit/fhv-regression.json（tools/verify-fhv.mjs --regression）status=passed、无新增失败、
//     knownFailures 逐条 title+reason、replay exitCode=0 且 matches=true；
//   · replay：实跑 `node tools/replay-fixtures.mjs --compare tests/fixtures/replay/golden-replays.json`；
//   · 资产：audit/fhv-assets.json（tools/audit-fhv-assets.mjs 生成）status=verified、441 条记录图片
//     全部可解析（本地/远程回退二元状态）、运行时零 `参考资源/` 读点；
//   · 原语：audit/fhv-primitive-plan.json status=done、pending 0、escape 0；下一阶段 P9。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import {
  CAMPAIGN_ID as FHV_CAMPAIGN_ID, CHAOS_BAGS, chapters, encounterGroups, partitions,
} from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { manifest as fhvManifest } from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import { FHV_FLOW, FHV_FLOW_NODE_ORDER, campaignFlowExtras } from '../content/campaigns/theFeastOfHemlockVale/flow.js'
import { FHV_RECORD_SCHEMA } from '../content/campaigns/theFeastOfHemlockVale/records.js'
import { FHV_STORY_TEXT } from '../content/campaigns/theFeastOfHemlockVale/story-text.js'
import { FHV_KEYWORDS } from '../content/campaigns/theFeastOfHemlockVale/keywords.js'
import {
  assertMigrationConfirmations, KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS,
} from '../content/migration-confirmation.js'
import { getAvailability } from '../src/deck/availability.js'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const HALL = join(MOD, '../..')
const RUN = join(HALL, 'artifacts/migration/fhv')
const REPORTS = join(RUN, 'reports')
const CAMPAIGN_ID = FHV_CAMPAIGN_ID
const CYCLE = 'fhv'
const REPORT = join(MOD, 'audit/fhv-migration.json')
const SCOPE_LEDGER = 'audit/fhv-scope.json'
const BASELINE_LEDGER = 'audit/fhv-baseline.json'
const SCAN_LEDGER = 'audit/fhv-mechanism-scan.json'
const PRIMITIVE_PLAN = 'audit/fhv-primitive-plan.json'
const PRIMITIVE_CATALOG = 'audit/fhv-primitive-catalog.json'
const RULES_LEDGER = 'audit/fhv-rules.json'
const RULES_BROWSER = 'audit/fhv-rules-browser.json'
const INTERACTIONS_LEDGER = 'audit/fhv-interactions.json'
const INTERACTIONS_BROWSER = 'audit/fhv-interactions-browser.json'
const INVESTIGATORS_LEDGER = 'audit/fhv-investigators.json'
const INVESTIGATORS_BROWSER = 'audit/fhv-investigators-browser.json'
const PLAYER_LEDGER = 'audit/fhv-player-acceptance.json'
const PLAYER_BROWSER = 'audit/fhv-player-browser.json'
const PLAYER_SHARDS = 'audit/fhv-player-shards.json'
const CAMPAIGN_PLAN = 'audit/fhv-campaign-plan.json'
const SCENARIO_LEDGER = 'audit/fhv-scenario-acceptance.json'
const SCENARIO_BROWSER = 'audit/fhv-scenarios-browser.json'
const NODE_LEDGER = 'audit/fhv-node-acceptance.json'
const REGRESSION_LEDGER = 'audit/fhv-regression.json'
const ALL_CARDS_LEDGER = 'audit/fhv-all-card-acceptance.json'
const RELEASE_BROWSER = 'audit/fhv-release-browser.json'
const ASSETS_LEDGER = 'audit/fhv-assets.json'
const REPLAY_FIXTURE = 'tests/fixtures/replay/golden-replays.json'
const EVIDENCE_DIR = 'artifacts/migration/fhv/p8'
// 本循环 P8 发布浏览器账本的必备检查（报告器字段名：嵌套 phase[viewport] + 两个布尔 claim）。
const REQUIRED_BROWSER_CHECKS = [
  ['release', 'desktop'], ['release', 'mobile'],
  ['progression', 'desktop'], ['progression', 'mobile'],
  ['online', 'desktop'], ['online', 'mobile'],
  ['privacy', 'desktop'], ['privacy', 'mobile'],
]
const REQUIRED_BROWSER_FLAGS = ['permissionBoundary', 'disconnectRecovery']
const MIN_SCREENSHOTS = 20
const REQUIRED_SCRIPTS = [
  'audit:fhv', 'audit:fhv:check', 'plan:fhv:campaign', 'test:fhv:scenarios', 'test:fhv:scenarios:browser',
  'verify:fhv:node', 'verify:fhv:regression', 'audit:fhv:allcards', 'audit:fhv:assets',
]
// P8 战役 E2E：新写的 P8 用例 + 既有 P7 战役层测试（同一 spawn 内跑，标题按 TAP 解析）。
const E2E_FILES = [
  'tests/fhv-p8-campaign.test.mjs',
  'tests/fhv-campaign-flow.test.mjs',
  'tests/fhv-campaign-engine.test.mjs',
  'tests/fhv-campaign-records.test.mjs',
]
const E2E_MARKERS = [
  ['survey', /勘察/], ['night', /夜探/], ['difficulty', /难度/], ['save', /存档|往返|恢复/],
  ['replay', /replay|回放|复算/i], ['retreat', /撤退|resign|失败/], ['residents', /居民/],
]
const MIN_E2E_MARKERS = 5
const MIN_P8_TITLES = 6
// 单卡/合规/展示/文档守卫（与 TSK P8 同口径）。
const GUARD_TESTS = [
  'tests/architecture-guard.test.mjs', 'tests/suite-manifest.test.mjs', 'tests/card-entries.test.mjs',
  'tests/encounter-entries.test.mjs', 'tests/scenario-guides.test.mjs',
]
// 来源清单：固定路径，存在才收；sha256 用文件原始字节（UTF-8 源码即字节）。
const SOURCE_PATHS = [
  SCOPE_LEDGER, BASELINE_LEDGER, SCAN_LEDGER, PRIMITIVE_PLAN, PRIMITIVE_CATALOG,
  RULES_LEDGER, RULES_BROWSER, INTERACTIONS_LEDGER, INTERACTIONS_BROWSER,
  INVESTIGATORS_LEDGER, INVESTIGATORS_BROWSER, PLAYER_LEDGER, PLAYER_BROWSER, PLAYER_SHARDS,
  CAMPAIGN_PLAN, SCENARIO_LEDGER, SCENARIO_BROWSER, NODE_LEDGER, REGRESSION_LEDGER,
  ALL_CARDS_LEDGER, RELEASE_BROWSER, ASSETS_LEDGER,
  REPLAY_FIXTURE,
  'content/campaigns/theFeastOfHemlockVale/story-text.js',
  'content/campaigns/theFeastOfHemlockVale/manifest.js',
  'content/campaigns/theFeastOfHemlockVale/flow.js',
  'content/campaigns/theFeastOfHemlockVale/shared.js',
  'content/registered.js',
]
const DISCLOSED_SCOPES = new Set(['verified', 'simplified', 'scenarioData', 'scenarioReference'])

const existsAt = relative => existsSync(join(MOD, relative))
const readText = path => {
  const buffer = readFileSync(path)
  // PowerShell 的 `*>` 重定向默认写 UTF-16LE（带 BOM）；账本与源码仍是 UTF-8。
  return (buffer[0] === 0xFF && buffer[1] === 0xFE ? buffer.toString('utf16le') : buffer.toString('utf8'))
    .replace(/^\uFEFF/, '')
}
const readJson = path => JSON.parse(readText(path))
const readAt = relative => (existsAt(relative) ? readText(join(MOD, relative)) : null)
const readMaybe = relative => {
  try { return readJson(join(MOD, relative)) } catch { return null }
}
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const fileSha = relative => (existsAt(relative) ? digest(join(MOD, relative)) : null)
const json = value => JSON.stringify(value, null, 2) + '\n'
const lines = value => value.split(/\r?\n/).filter(Boolean)

// ---------------------------------------------------------------------------
// 0. 命令执行（真实子进程；--check 类命令只读，不写账本）
// ---------------------------------------------------------------------------
function runNode(args, { timeout = 900_000 } = {}) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, args, { cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout })
  return {
    command: `node ${args.join(' ')}`,
    exitCode: result.status ?? null,
    stdout: (result.stdout || '').slice(-8000),
    stderr: (result.stderr || '').slice(-4000),
  }
}

// TAP 解析：totals 取 `# tests/pass/fail`，titles 取顶层 `ok N - title`（跳过 SKIP/TODO）。
function parseTap(output) {
  const text = String(output || '')
  const totalOf = key => {
    const match = text.match(new RegExp(`^# ${key} (\\d+)\\r?$`, 'm'))
    return match ? Number(match[1]) : null
  }
  const titles = []
  const failedTitles = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^(not ok|ok) \d+ - (.+?)(?:\s+# (?:SKIP|TODO)\b.*)?$/.exec(line)
    if (!match) continue
    const title = match[2].trim()
    if (match[1] === 'ok') titles.push(title)
    else failedTitles.push(title)
  }
  const totals = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, totalOf(key)]))
  return { totals, titles, failedTitles }
}

function runTests(files) {
  if (!files.length) return {
    command: 'node --test', exitCode: null, tests: 0, pass: 0, fail: 0, titles: [], failedTitles: [],
    totals: { tests: 0, pass: 0, fail: 0 }, missing: [],
  }
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 900_000,
  })
  const tap = parseTap(`${result.stdout || ''}\n${result.stderr || ''}`)
  return {
    command: `node --test ${files.join(' ')}`,
    exitCode: result.status ?? null,
    tests: tap.totals.tests ?? tap.titles.length + tap.failedTitles.length,
    pass: tap.totals.pass ?? tap.titles.length,
    fail: tap.totals.fail ?? tap.failedTitles.length,
    titles: tap.titles,
    failedTitles: tap.failedTitles,
  }
}

// 账本里不得出现本机绝对路径（与 TSK P8 账本同口径）：命令尾巴先按工作区/Mod 根归一。
const sanitizeText = value => {
  let text = String(value ?? '')
  const variants = [
    [`file:///${HALL.replaceAll('\\', '/')}/games/arkhamhorror/`, ''],
    [`file:///${HALL.replaceAll('\\', '/')}/`, ''],
    [`${MOD}\\`, ''], [`${MOD}/`, ''], [`${HALL}\\`, ''], [`${HALL}/`, ''],
    [MOD, ''], [HALL, ''],
  ]
  for (const [needle, replacement] of variants) if (needle) text = text.split(needle).join(replacement)
  return text
}

function commandRow(result) {
  return {
    pass: result.exitCode === 0,
    command: result.command,
    exitCode: result.exitCode,
    tail: sanitizeText(result.stderr ? result.stderr.slice(-600) : result.stdout.slice(-400)),
  }
}

// 发布浏览器截图：报告器只信磁盘写入 {path,base,viewport,phase,bytes,sha256}；这里复验记录值并核磁盘。
// （--verify-files 只走这一段，不重跑 P8 总账，符合「只校验浏览器截图文件」的命令行约定。）
function validateScreenshots(ledger) {
  return (ledger?.screenshots || []).map(shot => {
    const relative = typeof shot === 'string' ? shot : shot?.path
    const record = typeof shot === 'object' && shot ? shot : {}
    const recorded = record.base === 'repo-root' && Boolean(relative) && record.bytes > 0
      && /^[a-f0-9]{64}$/.test(String(record.sha256 || ''))
    // 浏览器账本的 base='repo-root' 指工作区根（artifacts/ 在根目录，不在 Mod 子目录）。
    const absolute = relative ? join(record.base === 'repo-root' ? HALL : MOD, relative) : null
    const exists = Boolean(absolute) && existsSync(absolute)
    const bytes = exists ? readFileSync(absolute).length : null
    const hashMatches = exists && record.base === 'repo-root' && record.bytes === bytes
      && record.sha256 === digest(absolute)
    return {
      path: relative || null, viewport: record.viewport ?? null, phase: record.phase ?? null,
      recorded, exists, bytes, hashMatches,
    }
  })
}

// 命令行模式：--capture-baseline / --check-fast 只复用 P0 基线逻辑，不构建 P8 账本（保持原来的秒级）。
const argv = process.argv.slice(2)
const has = flag => argv.includes(flag)
const MODE = has('--capture-baseline') ? 'capture-baseline'
  : has('--check-fast') ? 'check-fast'
    : has('--write') ? 'write'
      : has('--check') ? 'check'
        : has('--check-ledger') ? 'check-ledger'
          : has('--verify-files') ? 'verify-files' : 'print'

// ---------------------------------------------------------------------------
// 1. 生产注册事实（组合根；缺失即如实 false，不伪造）
// ---------------------------------------------------------------------------
function buildReport() {
const registered = {
  campaign: (() => {
    try {
      const campaign = contentRegistry.assertLaunchable(CAMPAIGN_ID)
      return { launchable: campaign?.id === CAMPAIGN_ID, status: campaign?.status || null, error: null }
    } catch (error) { return { launchable: false, status: null, error: String(error?.message || error) } }
  })(),
  lobby: (() => {
    const row = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
    return row
      ? { visible: true, status: row.status, earlyAccess: row.earlyAccess, scenarios: (row.scenarios || []).map(scenario => scenario.id) }
      : { visible: false, status: null, earlyAccess: null, scenarios: [] }
  })(),
  scenarios: contentRegistry.listScenarios(CAMPAIGN_ID).map(scenario => ({ id: scenario.id, status: scenario.status, campaignId: scenario.campaignId })),
  packs: ['fhvCampaign', 'fhvInvestigators', 'fhvPlayer'].map(id => {
    const pack = contentRegistry.getPack(id)
    const counts = partitions[id] || []
    return {
      id,
      status: pack?.status || null,
      cards: pack?.cards?.length ?? 0,
      expectedCards: counts.length,
      rulesImplemented: Boolean(pack?.cards?.every(card => card.rulesImplemented === true)),
      deckbuilding: (pack?.cards || []).filter(card => card.deckbuilding === true).length,
      codesMatch: Boolean(pack?.cards && pack.cards.map(card => card.code).sort().join(',') === [...counts].sort().join(',')),
    }
  }),
}
const availabilitySummary = {
  campaignCardsStrict: partitions.fhvCampaign.every(code => getAvailability(code).availability === 'strict'),
  playerBuildable: partitions.fhvPlayer.filter(code => getAvailability(code).deckbuilding === true).length,
  investigatorSelectable: partitions.fhvInvestigators.filter(code => getAvailability(code).selectable === true).length,
}
registered.availability = availabilitySummary

// ---------------------------------------------------------------------------
// 2. 账本复算（实跑既有 --check 命令；每项记录 command/exitCode/tail）
// ---------------------------------------------------------------------------
const ledgerCheckRuns = {
  scope: runNode(['tools/scan-fhv-scope.mjs', '--check']),
  scan: runNode(['tools/scan-fhv-mechanisms.mjs', '--check']),
  primitivePlan: runNode(['tools/plan-fhv-primitives.mjs', '--check']),
}
const scopeLedger = readMaybe(SCOPE_LEDGER)
const scanLedger = readMaybe(SCAN_LEDGER)
const primitiveLedger = readMaybe(PRIMITIVE_PLAN)
const ledgerChecks = {
  scope: {
    ...commandRow(ledgerCheckRuns.scope),
    path: SCOPE_LEDGER, sha256: fileSha(SCOPE_LEDGER),
    records: scopeLedger?.counts?.records ?? null,
    status: scopeLedger?.status ?? null,
    pass: ledgerCheckRuns.scope.exitCode === 0 && scopeLedger?.counts?.records === 441,
  },
  scan: {
    ...commandRow(ledgerCheckRuns.scan),
    path: SCAN_LEDGER, sha256: fileSha(SCAN_LEDGER),
    gates: scanLedger?.gates ?? null,
    status: scanLedger?.status ?? null,
    pass: ledgerCheckRuns.scan.exitCode === 0 && Boolean(scanLedger?.gates) && Object.values(scanLedger.gates).every(Boolean),
  },
  primitivePlan: {
    ...commandRow(ledgerCheckRuns.primitivePlan),
    path: PRIMITIVE_PLAN, sha256: fileSha(PRIMITIVE_PLAN),
    status: primitiveLedger?.status ?? null,
    pending: primitiveLedger?.pending?.length ?? null,
    pass: ledgerCheckRuns.primitivePlan.exitCode === 0 && primitiveLedger?.status === 'done'
      && (primitiveLedger?.pending || []).length === 0,
  },
}
const ledgerRunCommands = {
  nodeAcceptance: runNode(['tools/verify-fhv.mjs', '--node', '--check']),
  rules: runNode(['tools/audit-fhv-rules.mjs', '--check']),
  interactions: runNode(['tools/audit-fhv-interactions.mjs', '--check']),
  investigators: runNode(['tools/audit-fhv-investigators.mjs', '--check']),
  player: runNode(['tools/audit-fhv-player.mjs', '--check']),
  scenarios: runNode(['tools/audit-fhv-scenarios.mjs', '--check']),
  campaignPlan: runNode(['tools/plan-fhv-campaign.mjs', '--check']),
  story: runNode(['tools/import-fhv-story.mjs', '--check']),
  guides: runNode(['tools/build-fhv-guides.mjs', '--check']),
  allCardsTool: runNode(['tools/audit-fhv-all-cards.mjs', '--check']),
}
const ledgerGates = Object.fromEntries(
  Object.entries(ledgerRunCommands).map(([key, row]) => [key, commandRow(row)]))
const nodeLedger = readMaybe(NODE_LEDGER)
const rulesLedger = readMaybe(RULES_LEDGER)
const interactionsLedger = readMaybe(INTERACTIONS_LEDGER)
const investigatorsLedger = readMaybe(INVESTIGATORS_LEDGER)
const playerLedger = readMaybe(PLAYER_LEDGER)
const scenarioLedger = readMaybe(SCENARIO_LEDGER)
const campaignPlan = readMaybe(CAMPAIGN_PLAN)
const evidenceStatuses = {
  baseline: readMaybe(BASELINE_LEDGER)?.fast?.failures ?? null,
  nodeAcceptance: nodeLedger?.gates ?? null,
  rules: rulesLedger?.gates ?? null,
  interactions: interactionsLedger?.status ?? null,
  investigators: investigatorsLedger?.status ?? null,
  player: playerLedger?.status ?? null,
  scenarios: scenarioLedger?.status ?? null,
  campaignPlan: campaignPlan?.status ?? null,
}

// ---------------------------------------------------------------------------
// 3. 逐卡账本
// ---------------------------------------------------------------------------
const allCards = readMaybe(ALL_CARDS_LEDGER)
const allCardsRows = allCards?.rows || []
const allCardsGate = {
  pass: Boolean(allCards && allCards.status === 'verified' && allCards.summary?.gateComplete === true
    && (allCards.summary?.missing || []).length === 0 && allCards.summary?.total === 441
    && allCardsRows.length === 441),
  path: ALL_CARDS_LEDGER,
  sha256: fileSha(ALL_CARDS_LEDGER),
  status: allCards?.status ?? null,
  summary: allCards?.summary || null,
  total: allCards?.summary?.total ?? null,
  rows: allCardsRows.length,
  missing: (allCards?.summary?.missing || []).length,
}

// ---------------------------------------------------------------------------
// 4. 战役 E2E（实跑新 P8 用例 + 既有战役层测试，TAP 标题覆盖）
// ---------------------------------------------------------------------------
const e2eMissing = E2E_FILES.filter(file => !existsAt(file))
const e2eRun = e2eMissing.length
  ? { command: `node --test ${E2E_FILES.join(' ')}`, exitCode: null, tests: 0, pass: 0, fail: 0, titles: [], failedTitles: [] }
  : runTests(E2E_FILES)
const e2eCoverage = Object.fromEntries(
  E2E_MARKERS.map(([key, pattern]) => [key, e2eRun.titles.some(title => pattern.test(title))]))
const e2eMarkerCount = Object.values(e2eCoverage).filter(Boolean).length
const p8Titles = e2eRun.titles.filter(title => title.startsWith('P8 FHV ')).length
const campaignE2EGate = {
  pass: e2eMissing.length === 0 && e2eRun.exitCode === 0 && e2eRun.fail === 0
    && p8Titles >= MIN_P8_TITLES && e2eMarkerCount >= MIN_E2E_MARKERS,
  command: e2eRun.command,
  exitCode: e2eRun.exitCode,
  tests: e2eRun.tests,
  passCount: e2eRun.pass,
  fail: e2eRun.fail,
  coverage: e2eCoverage,
  markerCount: e2eMarkerCount,
  p8Titles,
  failedTitles: e2eRun.failedTitles,
  missing: e2eMissing,
  tail: (e2eRun.failedTitles || []).slice(0, 5),
}

// ---------------------------------------------------------------------------
// 5. 发布浏览器账本（真实大厅；截图逐张存在 + sha256）
// ---------------------------------------------------------------------------
const releaseBrowser = readMaybe(RELEASE_BROWSER)
const releaseBrowserChecks = releaseBrowser?.checks || {}
const browserFlag = names => names.some(name => releaseBrowserChecks[name] === true)
const browserCheck = (group, viewport) => releaseBrowserChecks?.[group]?.[viewport] === true
  // 扁平命名兼容（其它报告器可能写 checks.releaseDesktop）。
  || releaseBrowserChecks?.[`${group}${viewport[0].toUpperCase()}${viewport.slice(1)}`] === true
const browserRequiredChecks = REQUIRED_BROWSER_CHECKS.every(([group, viewport]) => browserCheck(group, viewport))
const browserRequiredFlags = browserFlag(['permissionBoundary', 'permission'])
  && browserFlag(['disconnectRecovery', 'disconnect'])
const browserTests = releaseBrowser?.tests || []
const browserTestPassed = row => row?.status === 'passed' || row?.ok === true
const browserTestsPassed = browserTests.length >= 2 && browserTests.every(browserTestPassed)
const browserViewports = new Set(browserTests.map(row => row.viewport).filter(Boolean))
const browserSourceStable = releaseBrowser?.sourceStableDuringRun === true || releaseBrowser?.sourceStable === true
// 截图：记录值 + 磁盘存在/sha256 逐张复核。
const screenshotRows = validateScreenshots(releaseBrowser)
const screenshotsOk = screenshotRows.length >= MIN_SCREENSHOTS
  && screenshotRows.every(row => row.recorded && row.exists && row.hashMatches)
const releaseBrowserGate = {
  pass: Boolean(releaseBrowser && releaseBrowser.status === 'passed' && releaseBrowser.complete === true
    && browserSourceStable && browserTestsPassed && browserViewports.size >= 2
    && browserRequiredChecks && browserRequiredFlags && screenshotsOk),
  path: RELEASE_BROWSER,
  sha256: fileSha(RELEASE_BROWSER),
  status: releaseBrowser?.status ?? null,
  complete: releaseBrowser?.complete ?? null,
  sourceStable: browserSourceStable,
  tests: browserTests.length,
  viewports: [...browserViewports].sort(),
  checks: releaseBrowserChecks,
  requiredChecks: browserRequiredChecks,
  requiredFlags: browserRequiredFlags,
  screenshots: screenshotRows.length,
  screenshotsOk,
  screenshotMissing: screenshotRows.filter(row => !row.exists).map(row => row.path),
  screenshotMismatch: screenshotRows.filter(row => row.exists && !row.hashMatches).map(row => row.path),
}

// ---------------------------------------------------------------------------
// 6. 回归 / replay
// ---------------------------------------------------------------------------
const regression = readMaybe(REGRESSION_LEDGER)
const regressionKnownFailures = (regression?.knownFailures || [])
const knownFailuresOk = regressionKnownFailures.every(row =>
  typeof row?.title === 'string' && row.title.trim() && typeof row?.reason === 'string' && row.reason.trim())
const regressionGate = {
  pass: Boolean(regression && regression.status === 'passed'
    && (regression.fast?.newFailures || []).length === 0
    && knownFailuresOk
    && regression.replay?.exitCode === 0 && regression.replay?.matches === true),
  path: REGRESSION_LEDGER,
  sha256: fileSha(REGRESSION_LEDGER),
  status: regression?.status ?? null,
  fast: regression?.fast || null,
  knownFailures: regressionKnownFailures.length,
  knownFailuresOk,
  replay: regression?.replay || null,
}
const replayRun = runNode(['tools/replay-fixtures.mjs', '--compare', REPLAY_FIXTURE])
const replayGate = {
  ...commandRow(replayRun),
  baseline: REPLAY_FIXTURE,
  sha256: fileSha(REPLAY_FIXTURE),
}

// ---------------------------------------------------------------------------
// 7. 单卡/合规/展示/文档/资产守卫
// ---------------------------------------------------------------------------
const guardFiles = GUARD_TESTS.filter(file => existsAt(file))
const guardRun = runTests(guardFiles)
const guardCommands = {
  cardIndex: runNode(['tools/build-card-index.mjs', '--check']),
  encounterIndex: runNode(['tools/build-encounter-index.mjs', '--check']),
  compliance: runNode(['tools/audit-card-entry-compliance.mjs', '--check']),
  presentation: runNode(['tools/build-presentation.mjs', '--check']),
  docs: runNode(['tools/check-doc-links.mjs']),
}
const guardCommandRows = Object.fromEntries(Object.entries(guardCommands).map(([key, row]) => [key, commandRow(row)]))
const guardsGate = {
  pass: guardFiles.length === GUARD_TESTS.length && guardRun.exitCode === 0 && guardRun.fail === 0
    && Object.values(guardCommandRows).every(row => row.pass),
  tests: {
    command: guardRun.command, tests: guardRun.tests, pass: guardRun.pass, fail: guardRun.fail,
    failedTitles: guardRun.failedTitles,
  },
  commands: guardCommandRows,
}
const assets = readMaybe(ASSETS_LEDGER)
const assetsImages = assets?.images || null
const assetRuntimeHits = assets?.runtimeReferenceHits || null
const assetsGate = {
  pass: Boolean(assets && assets.status === 'verified'
    && (assetsImages?.unresolved || []).length === 0
    && assetsImages?.total === 441
    && Array.isArray(assetRuntimeHits) && assetRuntimeHits.length === 0),
  path: ASSETS_LEDGER,
  sha256: fileSha(ASSETS_LEDGER),
  status: assets?.status ?? null,
  images: assetsImages
    ? {
      total: assetsImages.total, local: assetsImages.local, remote: assetsImages.remote,
      localized: assetsImages.localized, unresolved: (assetsImages.unresolved || []).length,
      faces: assetsImages.faces || null,
    }
    : null,
  runtimeReferenceHits: assetRuntimeHits,
  disclosed: (assets?.disclosed || []).length,
}

// ---------------------------------------------------------------------------
// 8. confirmations（scenarios 12 × §6 12 项 / keywords 6 / rulebook）
// ---------------------------------------------------------------------------
const scenarioBrowser = readMaybe(SCENARIO_BROWSER)
const rulesBrowser = readMaybe(RULES_BROWSER)
const chapterTestFiles = chapters.map(chapter => `tests/fhv-scenario-${chapter.id}.test.mjs`)
const chapterRun = runTests(chapterTestFiles.filter(file => existsAt(file)))
const chapterTitles = Object.fromEntries(chapters.map(chapter => [chapter.id,
  chapterRun.titles.filter(title => title.includes(chapter.id) || title.includes(chapter.name))]))
const titleHas = (titles, pattern) => titles.some(title => pattern.test(title))
const fileHas = (file, pattern) => {
  const text = existsAt(file) ? readAt(file) : null
  return Boolean(text && pattern.test(text))
}
const chapterEvidence = (chapterId, titles, pattern) =>
  titleHas(titles, pattern) || fileHas(`tests/fhv-scenario-${chapterId}.test.mjs`, pattern)
const scopeScenario = id => (scopeLedger?.scenarios || []).find(row => row.id === id) || null
const scenarioSourceLocked = id => {
  const row = scopeScenario(id)
  // 来源锁：范围账本记录的场景参考模块（.hs）路径 + 已签入的内容来源哈希。
  const source = row?.source || null
  const sha256 = source ? scopeLedger?.sources?.[source]?.sha256 : null
  return Boolean(source && /^[a-f0-9]{64}$/.test(String(sha256 || '')))
}
const buildScenarioConfirmations = () => chapters.map(chapter => {
  const ledgerRow = (scenarioLedger?.scenarios || []).find(row => row.id === chapter.id) || null
  const titles = chapterTitles[chapter.id] || []
  // 序曲（4 段）没有专属战役卡（plan.nodes[].cards=0），逐卡证据落在各章的剧本参考提示卡
  // （shared.js#chapters[].referenceCodes，如 10704/10501）；章则用 node===chapter.id 的专属卡行。
  const ownRows = allCardsRows.filter(card => card.node === chapter.id)
  const referenceRows = allCardsRows.filter(card => (chapter.referenceCodes || []).includes(card.code))
  const behaviorRows = ownRows.length ? ownRows : referenceRows
  const storyChapter = FHV_STORY_TEXT.chapters?.[chapter.id] || null
  const checks = {
    sourceLocked: scenarioSourceLocked(chapter.id),
    identityRegistered: Boolean(ledgerRow?.checks?.moduleLoaded && ledgerRow?.checks?.manifestComplete),
    setupAndZones: titles.length > 0 && chapterEvidence(chapter.id, titles, /设置|布置|setup|preScenarioSetup/i),
    actsAndAgendas: chapterEvidence(chapter.id, titles, /幕|议程|密谋|act|agenda/i),
    locationsAndConnections: chapterEvidence(chapter.id, titles, /地点|连接|layout/i),
    encounterBehaviors: chapterEvidence(chapter.id, titles, /敌人|诡计|条目|遭遇/),
    literalCardBehavior: Boolean(allCardsGate.pass) && behaviorRows.length > 0
      && behaviorRows.every(card => DISCLOSED_SCOPES.has(card.status))
      && (ownRows.length > 0 || ledgerRow?.checks?.cardEntries === true),
    chaosEffects: chapterEvidence(chapter.id, titles, /混乱|符号|混沌/),
    resolutionsAndRecords: chapterEvidence(chapter.id, titles, /结局|记录|时间|勘察/),
    storyText: Boolean(storyChapter) && (storyChapter.chineseGaps || []).length === 0
      && Object.keys(storyChapter.sectionsEn || {}).length > 0
      && chapterEvidence(chapter.id, titles, /正文|story|指南|campaignStory|story-text/),
    saveReplay: chapterEvidence(chapter.id, titles, /JSON|往返|存档|恢复/),
    browserAcceptance: Boolean(scenarioBrowser?.status === 'passed'
      && scenarioBrowser?.checks?.desktop === true && scenarioBrowser?.checks?.mobile === true
      && releaseBrowserGate.pass),
  }
  const complete = SCENARIO_MIGRATION_CHECKS.every(check => checks[check] === true)
  return {
    id: chapter.id,
    status: complete ? 'verified' : 'pending',
    checks,
    evidence: [
      SCENARIO_LEDGER, `tests/fhv-scenario-${chapter.id}.test.mjs`, SCENARIO_BROWSER,
      ALL_CARDS_LEDGER, RELEASE_BROWSER,
    ],
  }
})
const keywordSource = rulesLedger?.confirmations?.keywords
const keywordItems = (keywordSource?.items || []).map(item => ({
  id: item.id, ruleId: item.ruleId, origin: item.origin,
  checks: { ...item.checks }, status: item.status,
  evidence: item.evidence || [RULES_LEDGER],
}))
const rulebookSource = rulesLedger?.confirmations?.rulebook
const rulebookItems = rulebookSource?.items || []
const rulebookVerified = rulebookSource?.status === 'verified'
const rulebookCheckGroup = (predicate) => rulebookVerified && rulebookItems.length > 0
  && rulebookItems.some(item => predicate(item) && item.status === 'verified')
const keywordEntriesVerified = rulebookVerified && ['fhvDayNight', 'fhvElusive', 'fhvBlessCurse']
  .every(id => rulebookItems.some(item => item.id === id && item.status === 'verified'))
const confirmations = {
  scenarios: {
    status: null,
    checks: SCENARIO_MIGRATION_CHECKS,
    items: buildScenarioConfirmations(),
  },
  keywords: {
    status: keywordSource?.status === 'verified' && keywordItems.length === 6
      && keywordItems.every(item => item.status === 'verified') ? 'verified' : 'pending',
    checked: keywordItems.filter(item => item.status === 'verified').length,
    total: keywordItems.length,
    checks: KEYWORD_MIGRATION_CHECKS,
    items: keywordItems,
  },
  rulebook: {
    status: null,
    checks: {
      campaignOverview: rulebookCheckGroup(item => item.id === 'fhvCampaign'),
      scenarioMechanics: rulebookVerified && ['fhvTime', 'fhvSurvey', 'fhvCodex', 'fhvResidents', 'fhvGrid', 'fhvFatigue', 'fhvChaos']
        .every(id => rulebookItems.some(item => item.id === id && item.status === 'verified')),
      keywordEntries: keywordEntriesVerified,
      cardLinks: rulebookVerified && rulebookItems.length > 0
        && rulebookItems.every(item => item.checks?.cardLinks === true),
      desktopBrowser: rulesBrowser?.checks?.desktop === true,
      mobileBrowser: rulesBrowser?.checks?.mobile === true,
    },
    entries: rulebookSource?.entries ?? null,
    evidence: [RULES_LEDGER, RULES_BROWSER, 'web/fhv-rules.js', 'web/rulebook-data.js'],
  },
  selfCheck: { pass: false, error: null },
}
confirmations.scenarios.status = confirmations.scenarios.items.every(item => item.status === 'verified')
  ? 'verified' : 'pending'
confirmations.rulebook.status = RULEBOOK_MIGRATION_CHECKS.every(check => confirmations.rulebook.checks[check] === true)
  ? 'verified' : 'pending'
const confirmationProbe = { playable: true, earlyAccess: false, confirmations }
try {
  assertMigrationConfirmations(confirmationProbe, chapters.map(chapter => chapter.id))
  confirmations.selfCheck = { pass: true, error: null }
} catch (error) {
  confirmations.selfCheck = { pass: false, error: String(error?.message || error) }
}
const confirmationsGate = {
  pass: confirmations.selfCheck.pass
    && confirmations.scenarios.status === 'verified'
    && confirmations.keywords.status === 'verified'
    && confirmations.rulebook.status === 'verified',
  error: confirmations.selfCheck.error,
  scenarios: confirmations.scenarios.status,
  keywords: confirmations.keywords.status,
  rulebook: confirmations.rulebook.status,
  scenarioBrowser: scenarioBrowser?.status ?? null,
  keywordItems: keywordItems.length,
  rulebookItems: rulebookItems.length,
}

// ---------------------------------------------------------------------------
// 9. 正文 / 流程 / 文档 / 脚本
// ---------------------------------------------------------------------------
const storyFiles = FHV_STORY_TEXT.files || {}
const storyLeaves = Object.values(storyFiles)
  .reduce((total, file) => total + Object.keys(file?.sectionsEn || {}).length, 0)
const storyGaps = Object.values(storyFiles).reduce((total, file) => total + (file?.chineseGaps || []).length, 0)
  + Object.values(FHV_STORY_TEXT.chapters || {}).reduce((total, chapter) => total + (chapter?.chineseGaps || []).length, 0)
const storyGuideGate = {
  pass: ledgerGates.story.pass && ledgerGates.guides.pass
    && Object.keys(storyFiles).length === 9 && storyLeaves === 1462 && storyGaps === 0,
  files: Object.keys(storyFiles).length,
  leaves: storyLeaves,
  chineseGaps: storyGaps,
  storyCommand: ledgerGates.story,
  guidesCommand: ledgerGates.guides,
}
const recordKeys = Object.keys(FHV_RECORD_SCHEMA).length
const flowDeclaredGate = {
  pass: FHV_FLOW?.start === 'prologue'
    && FHV_FLOW_NODE_ORDER.length >= 25 && FHV_FLOW_NODE_ORDER.length <= 40
    && Object.keys(campaignFlowExtras.recordSchema || {}).length === 240
    && recordKeys === 240,
  start: FHV_FLOW?.start ?? null,
  flowNodes: FHV_FLOW_NODE_ORDER.length,
  recordKeys,
  flowRecordKeys: Object.keys(campaignFlowExtras.recordSchema || {}).length,
}
const readme = readAt('docs/campaign/theFeastOfHemlockVale/README.md') || ''
const p8Section = (() => {
  const start = readme.indexOf('### P8：整体验收与发布')
  if (start < 0) return ''
  // 下一个同级或更高级标题（### 阶段总览… / ## 4 …）：P8 节只含七项 checkbox。
  const next = [readme.indexOf('\n## ', start), readme.indexOf('\n### ', start)]
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0]
  return next === undefined ? readme.slice(start) : readme.slice(start, next)
})()
const p8Checklist = [...p8Section.matchAll(/^- \[( |x)\] (.+)$/gm)]
  .map(match => ({ checked: match[1] === 'x', text: match[2] }))
const overviewP8 = /^- \[x\] P8 /m.test(readme)
const evidenceRowMatch = readme.match(/^\| (\d{4}-\d{2}-\d{2}) \| P8 /m)
const docsGate = {
  pass: p8Checklist.length >= 7 && p8Checklist.every(item => item.checked)
    && overviewP8 && Boolean(evidenceRowMatch) && guardCommands.docs.exitCode === 0,
  p8Items: p8Checklist,
  overviewChecked: overviewP8,
  evidenceRow: evidenceRowMatch ? evidenceRowMatch[1] : null,
  docsCommandExit: guardCommands.docs.exitCode,
}
const pkg = JSON.parse(readAt('package.json') || '{}')
const missingScripts = REQUIRED_SCRIPTS.filter(script => typeof pkg?.scripts?.[script] !== 'string')
const scriptsGate = { pass: missingScripts.length === 0, missing: missingScripts }

// ---------------------------------------------------------------------------
// 10. 汇总
// ---------------------------------------------------------------------------
const registrationGate = {
  pass: registered.campaign.launchable && registered.campaign.status === 'playable'
    && registered.lobby.visible === true && registered.lobby.earlyAccess === false
    && registered.scenarios.length === 12 && registered.scenarios.every(scenario => scenario.status === 'playable')
    && registered.packs.every(pack => pack.status === 'playable' && pack.rulesImplemented && pack.codesMatch
      && pack.cards === pack.expectedCards && pack.deckbuilding === (pack.id === 'fhvPlayer' ? 102 : 0))
    && availabilitySummary.campaignCardsStrict
    && availabilitySummary.playerBuildable === 102
    && availabilitySummary.investigatorSelectable === 5,
  registered,
  availability: availabilitySummary,
}
const ledgersGate = {
  pass: Object.values(ledgerChecks).every(check => check.pass)
    && Object.values(ledgerGates).every(gate => gate.pass),
  checks: ledgerChecks,
  commands: ledgerGates,
  evidence: evidenceStatuses,
}
const gates = {
  registration: registrationGate,
  ledgers: ledgersGate,
  allCards: allCardsGate,
  campaignE2E: campaignE2EGate,
  releaseBrowser: releaseBrowserGate,
  regression: regressionGate,
  replay: replayGate,
  guards: guardsGate,
  assets: assetsGate,
  confirmations: confirmationsGate,
  storyGuides: storyGuideGate,
  flowDeclared: flowDeclaredGate,
  docs: docsGate,
  scripts: scriptsGate,
}
const failedGates = Object.entries(gates).filter(([, gate]) => gate.pass !== true).map(([key]) => key)
const status = failedGates.length === 0 ? 'verified' : 'pending'

const primitives = {
  status: primitiveLedger?.status ?? null,
  pending: primitiveLedger?.pending?.length ?? null,
  new: primitiveLedger?.new?.length ?? null,
  reuse: primitiveLedger?.reuse?.length ?? null,
  escape: primitiveLedger?.escape?.length ?? null,
  nextPhase: 'P9',
  backlog: primitiveLedger?.pending?.length ?? 0,
  ledger: { path: PRIMITIVE_PLAN, sha256: fileSha(PRIMITIVE_PLAN) },
}

const sources = SOURCE_PATHS.filter(existsAt).map(path => ({ path, sha256: fileSha(path) }))

const allCardsSummary = allCards?.summary || null
const released = failedGates.length === 0
const disclosureRows = [
  {
    kind: 'disclosed-approximation',
    count: (allCardsSummary?.playerSimplified || 0) + (allCardsSummary?.campaignSimplified || 0),
    playerSimplified: allCardsSummary?.playerSimplified || 0,
    campaignSimplified: allCardsSummary?.campaignSimplified || 0,
    note: '近似披露的行为卡（player 54 + campaign 54，逐条 note/章节 approximations 登记；只披露，不改写为 verified）'
      + (released ? '；发布验收完成（M5/P8，14 项门禁全真）' : ''),
  },
  {
    kind: 'scenario-data',
    count: allCardsSummary?.scenarioData || 0,
    note: '地点/幕/议程/剧情资产等数据型战役卡：行为由章 behavior 承接并有章测试证据；逐卡字面验收保留到后续批次',
  },
  {
    kind: 'scenario-reference',
    count: allCardsSummary?.scenarioReference || 0,
    note: '各章桌面的剧本参考提示卡：只做身份/来源登记，行为由场景模块与指南承接',
  },
]
// 未通过门禁逐项登记（docs/scripts 另有专条）：原因字符串全部来自本次复算，不引用冻结结论。
const gateReason = key => {
  const gate = gates[key]
  switch (key) {
    case 'registration':
      return `launchable=${gate.registered.campaign.launchable} status=${gate.registered.campaign.status} lobby=${gate.registered.lobby.visible} earlyAccess=${gate.registered.lobby.earlyAccess} scenarios=${gate.registered.scenarios.length}`
    case 'ledgers':
      return `失败复算=${[
        ...Object.entries(gate.checks).filter(([, row]) => !row.pass).map(([name]) => name),
        ...Object.entries(gate.commands).filter(([, row]) => !row.pass).map(([name]) => name),
      ].join(',') || '无'}`
    case 'allCards':
      return `status=${gate.status} total=${gate.total} rows=${gate.rows} missing=${gate.missing}`
    case 'campaignE2E':
      return `exit=${gate.exitCode} fail=${gate.fail} p8Titles=${gate.p8Titles} markers=${gate.markerCount}/7 missing=${gate.missing.join(',') || '无'}`
    case 'releaseBrowser':
      return `status=${gate.status} complete=${gate.complete} tests=${gate.tests} screenshots=${gate.screenshots} checks=${gate.requiredChecks} flags=${gate.requiredFlags}`
    case 'regression':
      return `status=${gate.status} newFailures=${(gate.fast?.newFailures || []).length} replayExit=${gate.replay?.exitCode} matches=${gate.replay?.matches}`
    case 'replay':
      return `exit=${gate.exitCode}`
    case 'guards':
      return `testsFail=${gate.tests.fail} 失败命令=${Object.entries(gate.commands).filter(([, row]) => !row.pass).map(([name]) => name).join(',') || '无'}`
    case 'assets':
      return `status=${gate.status} total=${gate.images?.total ?? null} unresolved=${gate.images?.unresolved ?? null} runtimeHits=${gate.runtimeReferenceHits?.length ?? null}`
    case 'confirmations':
      return `scenarios=${gate.scenarios} keywords=${gate.keywords} rulebook=${gate.rulebook} error=${gate.error || '无'}`
    case 'storyGuides':
      return `files=${gate.files} leaves=${gate.leaves} gaps=${gate.chineseGaps} storyExit=${gate.storyCommand?.exitCode} guidesExit=${gate.guidesCommand?.exitCode}`
    case 'flowDeclared':
      return `start=${gate.start} flowNodes=${gate.flowNodes} recordKeys=${gate.recordKeys}`
    default:
      return `pass=${gate.pass}`
  }
}
const remaining = [
  ...disclosureRows,
  ...(missingScripts.length ? [{ kind: 'scripts-missing', missing: missingScripts, note: 'package.json 尚未登记 P8 脚本（主进程补登记后重跑 --write）' }] : []),
  ...(docsGate.pass ? [] : [{
    kind: 'docs-pending',
    path: 'docs/campaign/theFeastOfHemlockVale/README.md',
    unchecked: p8Checklist.filter(item => !item.checked).map(item => item.text.slice(0, 60)),
    note: 'README P8 七项/阶段总览/证据行尚未由主进程勾选；文档更新后重跑 --write',
  }]),
  ...failedGates
    .filter(gate => gate !== 'docs' && gate !== 'scripts')
    .map(gate => ({ kind: 'missing-evidence', gate, pass: gates[gate].pass, reason: gateReason(gate) })),
  ...(failedGates.length ? [{ kind: 'gate-pending', gates: failedGates }] : []),
]

const report = {
  schemaVersion: 1,
  cycle: CYCLE,
  cycleName: 'The Feast of Hemlock Vale',
  cycleNameZh: '铁杉谷盛宴',
  campaignId: CAMPAIGN_ID,
  milestone: 'M5',
  stage: 'P8',
  generatedBy: 'tools/audit-fhv.mjs',
  docs: [
    'docs/campaign/theFeastOfHemlockVale/README.md#P8',
    'docs/campaign/theFeastOfHemlockVale/campaign.md',
    'docs/arkham-content-migration.md',
  ],
  status,
  playable: status === 'verified',
  launchEnabled: registered.campaign.launchable,
  earlyAccess: false,
  equivalenceCertified: status === 'verified',
  gates,
  registered,
  counts: {
    campaignCards: partitions.fhvCampaign.length,
    investigatorCards: partitions.fhvInvestigators.length,
    playerCards: partitions.fhvPlayer.length,
    total: partitions.fhvCampaign.length + partitions.fhvInvestigators.length + partitions.fhvPlayer.length,
    chapters: chapters.length,
    encounterGroups: Object.keys(encounterGroups).length,
    sharedEncounterGroups: fhvManifest.sharedEncounterGroupIds.length,
    keys: FHV_KEYWORDS.length,
    flowNodes: FHV_FLOW_NODE_ORDER.length,
    recordKeys,
    chaosBags: Object.keys(CHAOS_BAGS).length,
    storyLeaves,
  },
  confirmations,
  primitives,
  evidence: {
    node: {
      path: NODE_LEDGER, sha256: fileSha(NODE_LEDGER), ...ledgerGates.nodeAcceptance,
      gates: nodeLedger?.gates ?? null, totals: nodeLedger?.tests?.totals ?? null,
    },
    rules: { path: RULES_LEDGER, sha256: fileSha(RULES_LEDGER), ...ledgerGates.rules, gates: rulesLedger?.gates ?? null },
    interactions: { path: INTERACTIONS_LEDGER, sha256: fileSha(INTERACTIONS_LEDGER), ...ledgerGates.interactions, gates: interactionsLedger?.gates ?? null },
    investigators: { path: INVESTIGATORS_LEDGER, sha256: fileSha(INVESTIGATORS_LEDGER), ...ledgerGates.investigators, gates: investigatorsLedger?.gates ?? null },
    player: { path: PLAYER_LEDGER, sha256: fileSha(PLAYER_LEDGER), ...ledgerGates.player, gates: playerLedger?.gates ?? null },
    scenarios: { path: SCENARIO_LEDGER, sha256: fileSha(SCENARIO_LEDGER), ...ledgerGates.scenarios, gates: scenarioLedger?.gates ?? null },
    allCards: { path: ALL_CARDS_LEDGER, sha256: fileSha(ALL_CARDS_LEDGER), summary: allCardsSummary },
    campaignE2E: {
      command: campaignE2EGate.command, exitCode: campaignE2EGate.exitCode,
      tests: campaignE2EGate.tests, pass: campaignE2EGate.passCount, fail: campaignE2EGate.fail,
      coverage: e2eCoverage, p8Titles, missing: e2eMissing,
    },
    releaseBrowser: {
      path: RELEASE_BROWSER, sha256: fileSha(RELEASE_BROWSER), checks: releaseBrowserChecks,
      tests: browserTests.length, screenshots: screenshotRows.length,
    },
    images: assetsGate.images,
    guides: ledgerGates.guides,
    story: { ...ledgerGates.story, files: Object.keys(storyFiles).length, leaves: storyLeaves, chineseGaps: storyGaps },
    guards: { tests: guardsGate.tests, commands: guardCommandRows },
  },
  sources,
  remaining,
  releaseAcceptance: {
    status: status === 'verified' ? 'complete' : 'pending',
    deferred: [],
    note: '不采用提前开放；earlyAccess:false',
  },
  gate: Object.fromEntries(Object.entries(gates).map(([key, value]) => [key, value.pass === true])),
}
return { report, status, failedGates, screenshotRows }
}

// ---------------------------------------------------------------------------
// 11. P0 基线冻结与快速回归比较（保留原逻辑，不删）
// ---------------------------------------------------------------------------
function run(tool, ...args) {
  const result = spawnSync(process.execPath, [`tools/${tool}`, ...args], { cwd: MOD, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${tool} 执行失败`)
}

function regression(path, exitPath) {
  const log = readText(path)
  // 兼容 node --test 的两种默认报告器：重定向到文件时为 TAP，控制台/TTY 为 spec。
  const totalOf = key => {
    const match = log.match(new RegExp(`^(?:# |. )${key} (\\d+)\\r?$`, 'm')) ?? log.match(new RegExp(`^# ${key} (\\d+)\\r?$`, 'm'))
    return match ? Number(match[1]) : null
  }
  const totals = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, totalOf(key)]))
  assert(Number.isFinite(totals.tests), `回归尚未完成 ${path}`)
  const failures = [...new Set([
    ...[...log.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(([, title]) => title.trim()),
    ...[...log.matchAll(/^\s*✖ (.+?)(?: \(\d+(?:\.\d+)?ms\))?\r?$/gm)].map(([, title]) => title.trim()),
  ])].filter(title => title && title !== 'failing tests:')
  const exitCode = Number(readText(exitPath).trim())
  assert.equal(exitCode, Number(totals.fail + totals.cancelled > 0), `回归退出码不一致 ${path}`)
  return { exitCode, totals, failures }
}

function replaySummary(path) {
  const replay = readJson(path)
  assert(replay.fixtures.length && replay.fixtures.every(fixture => fixture.hashes.length === fixture.log.moves.length + 1))
  return {
    sha256: digest(path),
    rulesVersion: replay.rulesVersion, stateSchemaVersion: replay.schemaVersion, hashVersion: replay.hashVersion,
    games: replay.fixtures.length,
    moves: replay.fixtures.reduce((total, fixture) => total + fixture.log.moves.length, 0),
    fingerprints: replay.fixtures.reduce((total, fixture) => total + fixture.hashes.length, 0),
  }
}

function captureBaseline() {
  const commit = prefix => {
    const head = readText(join(REPORTS, `${prefix}-head.txt`)).trim()
    assert.match(head, /^[0-9a-f]{40}$/)
    return { head, status: lines(readText(join(REPORTS, `${prefix}-status.txt`))) }
  }
  const checkNames = ['cards-check', 'encounter-check', 'entries-check', 'hardcode-check']
  const baseline = {
    schemaVersion: 1,
    campaignId: CAMPAIGN_ID,
    start: { mod: commit('mod'), hall: commit('hall') },
    architecture: readJson(join(REPORTS, 'architecture-before.json')),
    checks: Object.fromEntries(checkNames.map(name => [name, Number(readText(join(REPORTS, `${name}-before.exit`)).trim())])),
    fast: regression(join(REPORTS, 'fast-before.log'), join(REPORTS, 'fast-before.exit')),
    replay: { ...replaySummary(join(RUN, 'replay-before.json')), fixture: REPLAY_FIXTURE },
  }
  assert.deepEqual(replaySummary(join(MOD, REPLAY_FIXTURE)), replaySummary(join(RUN, 'replay-before.json')),
    '版本库中的 golden replay 无法复算 P0 基线')
  writeFileSync(join(MOD, BASELINE_LEDGER), json(baseline), { flag: 'wx' })
  writeFileSync(join(RUN, 'fhv-baseline.json'), json(baseline))
  console.log(`fhv baseline: ${BASELINE_LEDGER}`)
}

function checkFast(baseline, phase, preexistingFile = null) {
  assert([undefined, 'p1', 'p2', 'p2-followup', 'p3'].includes(phase),
    '用法：node tools/audit-fhv.mjs --check-fast [p1|p2|p2-followup|p3] [--preexisting <report.json>]')
  const stem = phase ? `${phase}-fast` : 'fast-after'
  const after = regression(join(REPORTS, `${stem}.log`), join(REPORTS, `${stem}.exit`))
  // 既有失败记账：只接受显式传入、逐条带理由、且确实在本次回归中复现的清单（例如 HEAD 中其他循环的账本漂移）。
  const declared = preexistingFile
    ? readJson(join(MOD, preexistingFile)).fastBaseline.failures.map(title => ({
      title, reason: readJson(join(MOD, preexistingFile)).rootCause?.summary || '',
    }))
    : []
  assert(declared.every(row => row.title && row.reason), '既有失败记账必须逐条给出 title 与 reason')
  const declaredTitles = declared.map(row => row.title)
  const notReproduced = declaredTitles.filter(title => !after.failures.includes(title))
  const remainingFailures = [...baseline.fast.failures]
  const introduced = after.failures.filter(title => {
    if (declaredTitles.includes(title)) return false
    const index = remainingFailures.indexOf(title)
    if (index < 0) return true
    remainingFailures.splice(index, 1)
    return false
  })
  const result = {
    ...after,
    newFailures: introduced,
    preexistingFailures: declared,
    declaredNotReproduced: notReproduced,
    clearedBaselineFailures: remainingFailures,
    ...(preexistingFile ? { preexistingEvidence: preexistingFile } : {}),
  }
  writeFileSync(join(REPORTS, phase ? `${phase}-fast-compare.json` : 'fast-compare.json'), json(result))
  assert(!introduced.length && !notReproduced.length && after.totals.cancelled <= baseline.fast.totals.cancelled,
    `新增回归失败：${introduced.join('、') || '无'}${notReproduced.length ? `；既有失败未复现：${notReproduced.join('、')}` : ''}`)
  console.log(`fhv fast: ${after.totals.pass}/${after.totals.tests}，新增失败 0${declared.length ? `（既有失败 ${declared.length} 项按 ${preexistingFile} 单独记账）` : ''}`)
}

// ---------------------------------------------------------------------------
// 12. 命令行
// ---------------------------------------------------------------------------
const isCli = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (isCli) {
  if (MODE === 'capture-baseline') {
    captureBaseline()
  } else if (MODE === 'check-fast') {
    const preexistingAt = argv.indexOf('--preexisting')
    const preexisting = preexistingAt >= 0 ? argv[preexistingAt + 1] : null
    const phase = argv.find((value, index) => !value.startsWith('--') && index !== preexistingAt + 1)
    checkFast(readJson(join(MOD, BASELINE_LEDGER)), phase, preexisting)
  } else if (MODE === 'verify-files') {
    // 只校验发布浏览器账本登记的截图文件，不重跑总账、不写账本。
    const screenshotRows = validateScreenshots(readMaybe(RELEASE_BROWSER))
    for (const row of screenshotRows) {
      console.log(`fhv p8 screenshot: ${row.path} ${row.exists ? (row.hashMatches ? 'ok' : 'hash-mismatch') : 'missing'}`)
    }
    const ok = screenshotRows.length >= MIN_SCREENSHOTS
      && screenshotRows.every(row => row.recorded && row.exists && row.hashMatches)
    console.log(`fhv p8 screenshots: ${screenshotRows.length} 张，${ok ? 'passed' : 'missing or mismatched'}`)
    if (!ok) process.exitCode = 1
  } else {
    // P8 发布账本：每次命令都真实复算（子进程 --check + 实跑测试 + replay），不读缓存结论。
    const { report, status, failedGates } = buildReport()
    const body = json(report)
    if (MODE === 'write') {
      mkdirSync(join(RUN, 'p8'), { recursive: true })
      writeFileSync(REPORT, body)
      console.log(`fhv migration: 已写入（status=${status}，失败门禁：${failedGates.join(',') || '无'}）`)
      console.log(JSON.stringify(report.gate))
      if (status !== 'verified') process.exitCode = 1
    } else if (MODE === 'check' || MODE === 'check-ledger') {
      if (!existsSync(REPORT)) throw new Error('audit/fhv-migration.json 不存在：先 --write')
      if (readFileSync(REPORT, 'utf8') !== body) throw new Error('audit/fhv-migration.json 与复算不一致：审阅后 --write')
      if (MODE === 'check' && status !== 'verified') throw new Error(`fhv migration 门禁未全真：${failedGates.join(',')}`)
      console.log(`fhv migration: 复算一致（status=${status}）`)
    } else {
      console.log(body)
    }
  }
}
