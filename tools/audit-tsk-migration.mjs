#!/usr/bin/env node
// 八循环《绯红密钥》（The Scarlet Keys，TSK）P8：发布验收总账本。
//
//   node tools/audit-tsk-migration.mjs --write   生成 audit/tsk-migration.json
//   node tools/audit-tsk-migration.mjs --check   逐字节复算（结论/证据漂移即失败）
//   node tools/audit-tsk-migration.mjs          打印账本
//
// 口径（docs/arkham-content-migration.md §4.8 M5 / §6；README P8）：
//   · 一个事实源：逐项 import 生成器（buildScope/buildScan/buildPrimitivePlan/buildAdjudication），
//     或实跑既有 --check 命令（scan/verify/audit 系列），不复制「已冻结的结论」；
//   · 逐卡：audit/tsk-all-card-acceptance.json（另一工具生成）必须 missing=0、总数=439；
//   · 战役 E2E：实跑 tests/tsk-p8-campaign.test.mjs + 既有 flow/interlude 测试，并核对
//     标题覆盖（世界地图启程/状况报告/强制终局/四档难度/存档/撤退/同志会）；
//   · 浏览器发布：audit/tsk-release-browser.json（reporter 生成）status=passed、六项 checks 全真、
//     截图逐张按磁盘重新 sha256；
//   · confirmations：scenarios（10 章 × §6 12 项）/ keywords（29）/ rulebook 全部 verified
//     （content/migration-confirmation.js#assertMigrationConfirmations 复算）；
//   · 回归：audit/tsk-regression.json（verify-tsk-regression）冻结失败集合 = P0 4 条、无新增；
//   · 资产：439 条记录图片解析全部可解析（本地/远程回退二元状态），运行时不依赖 参考资源/；
//   · 原语：artifacts/migration/tsk/primitive-adjudication.json 无 pending（175 份全部 deferred 到 P9）。
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { CARD_PARTITIONS, CHAOS_BAGS, ENCOUNTER_GROUPS, SHARED_ENCOUNTER_GROUPS, chapters } from '../content/campaigns/theScarletKeys/shared.js'
import { TSK_STORY_META, TSK_STORY_TEXT } from '../content/campaigns/theScarletKeys/story-text.js'
import { TSK_FLOW, TSK_FLOW_NODE_ORDER, campaignFlowExtras } from '../content/campaigns/theScarletKeys/flow.js'
import { KEY_CARDS } from '../content/campaigns/theScarletKeys/shared.js'
import { assertMigrationConfirmations, KEYWORD_MIGRATION_CHECKS, RULEBOOK_MIGRATION_CHECKS, SCENARIO_MIGRATION_CHECKS } from '../content/migration-confirmation.js'
import { imageResolution } from '../presentation/images.js'
import { buildScope } from './scan-tsk-scope.mjs'
import { buildScan } from './scan-tsk-mechanisms.mjs'
import { buildPrimitivePlan } from './audit-tsk-primitives.mjs'
import { buildAdjudication } from './adjudicate-tsk-primitives.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { MOD, RUN, json, readJson, sha } from './tsk-migration-lib.mjs'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const CAMPAIGN_ID = 'theScarletKeys'
const CYCLE = 'tsk'
const REPORT = join(MOD, 'audit/tsk-migration.json')
const ALL_CARDS_LEDGER = 'audit/tsk-all-card-acceptance.json'
const RELEASE_BROWSER = 'audit/tsk-release-browser.json'
const CUSTOMIZATION_BROWSER = 'audit/tsk-customization-browser.json'
const EPILOGUE_BROWSER = 'audit/tsk-epilogue-browser.json'
const ADJUDICATION_LEDGER = 'artifacts/migration/tsk/primitive-adjudication.json'
const REGRESSION = 'audit/tsk-regression.json'
const EVIDENCE_DIR = 'artifacts/migration/tsk/p8'
const REQUIRED_BROWSER_CHECKS = [
  ['release', 'desktop'], ['release', 'mobile'], ['progression', 'desktop'], ['progression', 'mobile'],
  ['online', 'desktop'], ['online', 'mobile'], ['privacy', 'desktop'], ['privacy', 'mobile'],
]
const REQUIRED_BROWSER_FLAGS = ['permissionBoundary', 'disconnectRecovery']
const MIN_SCREENSHOTS = 20
const MIN_CUSTOMIZATION_SCREENSHOTS = 8
const MIN_EPILOGUE_SCREENSHOTS = 8
const REQUIRED_EPILOGUE_CHECKS = [
  ['forcedEndgame', 'desktop'], ['forcedEndgame', 'mobile'],
  ['congressTerminal', 'desktop'], ['congressTerminal', 'mobile'],
  ['epilogue', 'desktop'], ['epilogue', 'mobile'],
]
const REQUIRED_CUSTOMIZATION_CHECKS = [
  ['customization', 'desktop'], ['customization', 'mobile'],
  ['initialSelection', 'desktop'], ['initialSelection', 'mobile'],
  ['interludeUpgrade', 'desktop'], ['interludeUpgrade', 'mobile'],
  ['refreshRecovery', 'desktop'], ['refreshRecovery', 'mobile'],
]
const DASHBOARD_SECTIONS = ['scope', 'scan', 'primitives', 'chapters', 'keywords', 'rulebook', 'guides', 'allCards', 'release']

const existsAt = relative => existsSync(join(MOD, relative))
const readText = relative => (existsAt(relative) ? readFileSync(join(MOD, relative), 'utf8') : null)
const readMaybe = relative => {
  try { return readJson(relative) } catch { return null }
}
// 根 artifacts（artifacts/migration/tsk/**）不在 Mod 目录下，单独读取。
const readRunMaybe = relative => {
  try { return JSON.parse(readFileSync(join(RUN, relative.replace('artifacts/migration/tsk/', '')), 'utf8').replace(/^\uFEFF/, '')) } catch { return null }
}
const textShaRun = relative => {
  try { return sha(readFileSync(join(RUN, relative.replace('artifacts/migration/tsk/', '')))) } catch { return null }
}
const textSha = relative => {
  const text = readText(relative)
  return text == null ? null : sha(Buffer.from(text))
}
const relAbs = absolute => absolute.replaceAll('\\', '/')

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

function runTestFiles(files) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=./tools/core-test-reporter.mjs', ...files], {
    cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 900_000,
  })
  const rows = []
  for (const line of (result.stdout || '').trim().split('\n').filter(Boolean)) {
    try { rows.push(JSON.parse(line)) } catch { /* ignore */ }
  }
  const passed = rows.filter(row => row.type === 'test:pass')
  const failed = rows.filter(row => row.type === 'test:fail')
  return {
    command: `node --test ${files.join(' ')}`, exitCode: result.status ?? null,
    tests: passed.length + failed.length, pass: passed.length, fail: failed.length,
    titles: passed.map(row => String(row.name || '')), failedTitles: failed.map(row => String(row.name || '')),
    stderr: (result.stderr || '').slice(-2000),
  }
}

// ---------------------------------------------------------------------------
// 1. 生产注册事实
// ---------------------------------------------------------------------------
const registered = {
  campaign: (() => {
    try {
      const campaign = contentRegistry.assertLaunchable(CAMPAIGN_ID)
      return { launchable: campaign?.id === CAMPAIGN_ID, status: campaign?.status || null, error: null }
    } catch (error) { return { launchable: false, status: null, error: String(error?.message || error) } }
  })(),
  lobby: (() => {
    const row = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
    return row ? { visible: true, status: row.status, earlyAccess: row.earlyAccess, scenarios: (row.scenarios || []).map(scenario => scenario.id) } : { visible: false }
  })(),
  scenarios: contentRegistry.listScenarios(CAMPAIGN_ID).map(scenario => ({ id: scenario.id, status: scenario.status, campaignId: scenario.campaignId })),
  packs: ['tskCampaign', 'tskInvestigators', 'tskPlayer'].map(id => {
    const pack = contentRegistry.getPack(id)
    const counts = CARD_PARTITIONS[id] || []
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
const availableCampaignCards = CARD_PARTITIONS.tskCampaign.every(code => getAvailability(code).availability === 'strict')
const availabilitySummary = {
  campaignCardsStrict: availableCampaignCards,
  playerBuildable: CARD_PARTITIONS.tskPlayer.filter(code => getAvailability(code).deckbuilding === true).length,
  investigatorSelectable: CARD_PARTITIONS.tskInvestigators.filter(code => getAvailability(code).selectable === true).length,
}

// ---------------------------------------------------------------------------
// 2. 账本复算（直接 import builder 或实跑 --check）
// ---------------------------------------------------------------------------
const scope = buildScope()
const scopeDisk = readMaybe('audit/tsk-scope.json')
const scan = buildScan()
const scanDisk = readMaybe('audit/tsk-mechanism-scan.json')
const { plan: primitivePlan, catalog: primitiveCatalog } = await buildPrimitivePlan()
const primitiveDisk = readMaybe('audit/tsk-primitive-plan.json')
const primitiveCatalogDisk = readMaybe('audit/tsk-primitive-catalog.json')
const adjudication = buildAdjudication()
const adjudicationDisk = readRunMaybe(ADJUDICATION_LEDGER)

const ledgerChecks = {
  scope: { pass: JSON.stringify(scope) === JSON.stringify(scopeDisk) && Object.values(scope.gates || {}).every(Boolean), sha256: textSha('audit/tsk-scope.json'), path: 'audit/tsk-scope.json', gates: scope.gates || null },
  scan: { pass: JSON.stringify(scan) === JSON.stringify(scanDisk) && Object.values(scan.gates || {}).every(Boolean), sha256: textSha('audit/tsk-mechanism-scan.json'), path: 'audit/tsk-mechanism-scan.json', gates: scan.gates || null },
  primitivePlan: { pass: JSON.stringify(primitivePlan) === JSON.stringify(primitiveDisk) && Object.values(primitivePlan.gates || {}).every(Boolean), sha256: textSha('audit/tsk-primitive-plan.json'), path: 'audit/tsk-primitive-plan.json', gates: primitivePlan.gates || null },
  primitiveCatalog: { pass: JSON.stringify(primitiveCatalog) === JSON.stringify(primitiveCatalogDisk), sha256: textSha('audit/tsk-primitive-catalog.json'), path: 'audit/tsk-primitive-catalog.json' },
  adjudication: {
    pass: JSON.stringify(adjudication) === JSON.stringify(adjudicationDisk)
      && (adjudication.summary?.requests || 0) === 175
      && (adjudication.summary?.nonRequestFiles || 0) === 1
      && (adjudication.summary?.pendingBefore || 0) === 0,
    sha256: textShaRun(ADJUDICATION_LEDGER), path: ADJUDICATION_LEDGER,
    requests: adjudication.summary?.requests ?? null, deferred: adjudication.summary?.deferredAfter ?? null,
    categories: adjudication.summary?.categories ?? null,
  },
}
const ledgerCommands = {
  baseline: runNode(['tools/scan-tsk-baseline.mjs', '--check']),
  nodeAcceptance: runNode(['tools/verify-tsk.mjs', '--check']),
  rules: runNode(['tools/audit-tsk-rules.mjs', '--check']),
  interactions: runNode(['tools/audit-tsk-interactions.mjs', '--check']),
  investigators: runNode(['tools/audit-tsk-investigators.mjs', '--check']),
  player: runNode(['tools/audit-tsk-player.mjs', '--check']),
  scenarios: runNode(['tools/audit-tsk-scenarios.mjs', '--check']),
  guides: runNode(['tools/import-scenario-guides.mjs']),
  story: runNode(['tools/import-tsk-story.mjs', '--check']),
  adjudication: runNode(['tools/adjudicate-tsk-primitives.mjs', '--check']),
}
const ledgerGates = Object.fromEntries(Object.entries(ledgerCommands).map(([key, row]) => [key, { pass: row.exitCode === 0, command: row.command, exitCode: row.exitCode, tail: row.stderr ? row.stderr.slice(-600) : row.stdout.slice(-400) }]))
for (const key of ['baseline', 'nodeAcceptance', 'rules', 'interactions', 'investigators', 'player', 'scenarios', 'guides', 'story']) {
  if (key === 'baseline') ledgerGates[key].pass = ledgerGates[key].pass && (readMaybe('audit/tsk-baseline.json')?.status !== 'failed')
}
const evidenceStatuses = {
  baseline: readMaybe('audit/tsk-baseline.json')?.fastFailures || null,
  nodeAcceptance: readMaybe('audit/tsk-node-acceptance.json')?.gates || null,
  rules: readMaybe('audit/tsk-rules.json')?.gates || null,
  interactions: readMaybe('audit/tsk-interactions.json')?.status || null,
  investigators: readMaybe('audit/tsk-investigators.json')?.status || null,
  player: readMaybe('audit/tsk-player-acceptance.json')?.status || null,
  scenarios: readMaybe('audit/tsk-scenario-acceptance.json')?.status || null,
}

// ---------------------------------------------------------------------------
// 3. 逐卡账本
// ---------------------------------------------------------------------------
const allCards = readMaybe(ALL_CARDS_LEDGER)
const allCardsGate = {
  pass: Boolean(allCards && allCards.summary?.gateComplete === true && allCards.summary?.missing === 0
    && allCards.summary?.total === 439 && (allCards.cards || []).length === 439),
  path: ALL_CARDS_LEDGER,
  sha256: textSha(ALL_CARDS_LEDGER),
  summary: allCards?.summary || null,
}

// ---------------------------------------------------------------------------
// 4. 战役 E2E（实跑测试 + 标题覆盖）
// ---------------------------------------------------------------------------
const e2eFiles = ['tests/tsk-p8-campaign.test.mjs', 'tests/tsk-campaign-flow.test.mjs', 'tests/tsk-interludes.test.mjs'].filter(file => existsAt(file))
const e2eRun = e2eFiles.length ? runTestFiles(e2eFiles) : { exitCode: 1, tests: 0, pass: 0, fail: 0, titles: [], failedTitles: [] }
const e2eMarkers = [
  ['worldMap', /世界地图|启程/], ['embark', /启程|目的地|旅行/], ['statusReport', /状况报告/],
  ['forcedEndgame', /强制|35|终局/], ['difficulty', /难度/], ['saveReplay', /存档|JSON|往返|恢复/],
  ['retreat', /撤退|失败|resign/], ['coterie', /同志会/], ['routes', /航线|路线|多章|逐章/],
]
const e2eCoverage = Object.fromEntries(e2eMarkers.map(([key, pattern]) => [key, e2eRun.titles.some(title => pattern.test(title))]))
const campaignE2EGate = {
  pass: e2eFiles.length === 3 && e2eRun.exitCode === 0 && e2eRun.fail === 0
    && e2eRun.titles.filter(title => title.startsWith('P8 TSK ')).length >= 8
    && Object.values(e2eCoverage).every(Boolean),
  command: e2eRun.command, tests: e2eRun.tests, passCount: e2eRun.pass, fail: e2eRun.fail,
  coverage: e2eCoverage, failedTitles: e2eRun.failedTitles, p8Titles: e2eRun.titles.filter(title => title.startsWith('P8 TSK ')).length,
}

// ---------------------------------------------------------------------------
// 5. 发布浏览器账本（截图按磁盘复算）
// ---------------------------------------------------------------------------
// 浏览器 screenshot 账本通用校验：路径 repo-root 相对、磁盘 bytes/sha256 必须与账本一致。
function validateScreenshots(ledger) {
  return ((ledger?.screenshots) || []).map(shot => {
    // 浏览器账本的 base='repo-root' 指工作区根（artifacts/ 在根目录，不在 Mod 子目录）。
    const absolute = join(shot.base === 'repo-root' ? WORKSPACE : MOD, shot.path)
    const exists = existsSync(absolute)
    const bytes = exists ? statSync(absolute).size : null
    const actualSha = exists ? sha(readFileSync(absolute)) : null
    const hashMatches = exists && shot.base === 'repo-root' && shot.bytes === bytes && shot.sha256 === actualSha
    return { path: shot.path, viewport: shot.viewport, phase: shot.phase, exists, hashMatches, bytes }
  })
}
const releaseBrowser = readMaybe(RELEASE_BROWSER)
const screenshotRows = validateScreenshots(releaseBrowser)
const browserChecks = releaseBrowser?.checks || {}
const browserRowsPassed = Boolean(releaseBrowser && releaseBrowser.status === 'passed' && releaseBrowser.complete === true
  && releaseBrowser.sourceStableDuringRun === true
  && (releaseBrowser.tests || []).length >= 6
  && (releaseBrowser.tests || []).every(test => test.status === 'passed')
  && new Set((releaseBrowser.tests || []).map(test => test.viewport)).size >= 2)
const browserRequiredChecks = REQUIRED_BROWSER_CHECKS.every(([phase, viewport]) => browserChecks[phase]?.[viewport] === true)
  && REQUIRED_BROWSER_FLAGS.every(flag => browserChecks[flag] === true)
const browserScreenshotsOk = screenshotRows.length >= MIN_SCREENSHOTS && screenshotRows.every(row => row.exists && row.hashMatches)
const releaseBrowserGate = {
  pass: browserRowsPassed && browserRequiredChecks && browserScreenshotsOk,
  path: RELEASE_BROWSER, sha256: textSha(RELEASE_BROWSER),
  status: releaseBrowser?.status || null, tests: (releaseBrowser?.tests || []).length,
  checks: browserChecks, screenshots: screenshotRows.length,
  screenshotsOk: browserScreenshotsOk, sourceStable: releaseBrowser?.sourceStableDuringRun === true,
}

// 5b. P8 第 3 项：大厅构筑期「定制卡初始勾选」+ 关间「定制勾选」浏览器账本。
const customizationBrowser = readMaybe(CUSTOMIZATION_BROWSER)
const customizationShots = validateScreenshots(customizationBrowser)
const customizationChecks = customizationBrowser?.checks || {}
const customizationRowsPassed = Boolean(customizationBrowser && customizationBrowser.status === 'passed'
  && customizationBrowser.complete === true && customizationBrowser.sourceStableDuringRun === true
  && (customizationBrowser.tests || []).length >= 2
  && (customizationBrowser.tests || []).every(test => test.status === 'passed')
  && new Set((customizationBrowser.tests || []).map(test => test.viewport)).size >= 2)
const customizationRequiredChecks = REQUIRED_CUSTOMIZATION_CHECKS.every(([group, viewport]) => customizationChecks[group]?.[viewport] === true)
const customizationShotsOk = customizationShots.length >= MIN_CUSTOMIZATION_SCREENSHOTS
  && customizationShots.every(row => row.exists && row.hashMatches)
const customizationBrowserGate = {
  pass: customizationRowsPassed && customizationRequiredChecks && customizationShotsOk,
  path: CUSTOMIZATION_BROWSER, sha256: textSha(CUSTOMIZATION_BROWSER),
  status: customizationBrowser?.status || null, tests: (customizationBrowser?.tests || []).length,
  checks: customizationChecks, screenshots: customizationShots.length,
  screenshotsOk: customizationShotsOk, sourceStable: customizationBrowser?.sourceStableDuringRun === true,
}

// 5c. P8 第 3 项：时间 ≥35 被迫启程通古斯卡 → 钥匙议会终章 → 尾声（真实大厅浏览器）。
const epilogueBrowser = readMaybe(EPILOGUE_BROWSER)
const epilogueShots = validateScreenshots(epilogueBrowser)
const epilogueChecks = epilogueBrowser?.checks || {}
const epilogueRowsPassed = Boolean(epilogueBrowser && epilogueBrowser.status === 'passed'
  && epilogueBrowser.complete === true && epilogueBrowser.sourceStableDuringRun === true
  && (epilogueBrowser.tests || []).length >= 2
  && (epilogueBrowser.tests || []).every(test => test.status === 'passed')
  && new Set((epilogueBrowser.tests || []).map(test => test.viewport)).size >= 2)
const epilogueRequiredChecks = REQUIRED_EPILOGUE_CHECKS.every(([group, viewport]) => epilogueChecks[group]?.[viewport] === true)
const epilogueShotsOk = epilogueShots.length >= MIN_EPILOGUE_SCREENSHOTS
  && epilogueShots.every(row => row.exists && row.hashMatches)
const epilogueBrowserGate = {
  pass: epilogueRowsPassed && epilogueRequiredChecks && epilogueShotsOk,
  path: EPILOGUE_BROWSER, sha256: textSha(EPILOGUE_BROWSER),
  status: epilogueBrowser?.status || null, tests: (epilogueBrowser?.tests || []).length,
  checks: epilogueChecks, screenshots: epilogueShots.length,
  screenshotsOk: epilogueShotsOk, sourceStable: epilogueBrowser?.sourceStableDuringRun === true,
}

// ---------------------------------------------------------------------------
// 6. 回归 / replay
// ---------------------------------------------------------------------------
const regression = readMaybe(REGRESSION)
const baselineLedger = readMaybe('audit/tsk-baseline.json')
const frozenTitles = [...(baselineLedger?.fastFailures || [])].sort()
const fastTitles = [...(regression?.fast?.titles || [])].sort()
const frozenEqual = frozenTitles.length === 4 && frozenTitles.join('|') === fastTitles.join('|')
const noNewFailures = (regression?.fast?.additionsSinceInitialBaseline || []).length === 0
const replayRun = runNode(['tools/replay-fixtures.mjs', '--compare', 'tests/fixtures/replay/tsk-baseline.json'])
const regressionGate = {
  pass: Boolean(regression && regression.status === 'passed' && frozenEqual && noNewFailures
    && (regression.replay?.exitCode === 0 || regression.replay?.compareExit === 0)),
  path: REGRESSION, sha256: textSha(REGRESSION),
  fast: regression?.fast || null, replay: regression?.replay || null,
  frozenEqual, noNewFailures,
}
const replayGate = { pass: replayRun.exitCode === 0, command: replayRun.command, exitCode: replayRun.exitCode, baseline: 'tests/fixtures/replay/tsk-baseline.json', sha256: textSha('tests/fixtures/replay/tsk-baseline.json') }

// ---------------------------------------------------------------------------
// 7. 单卡/合规/展示/文档/资产守卫
// ---------------------------------------------------------------------------
const guardRun = runTestFiles([
  'tests/architecture-guard.test.mjs', 'tests/suite-manifest.test.mjs', 'tests/card-entries.test.mjs',
  'tests/encounter-entries.test.mjs', 'tests/scenario-guides.test.mjs', 'tests/tsk-all-cards.test.mjs',
].filter(file => existsAt(file)))
const indexChecks = {
  cardIndex: runNode(['tools/build-card-index.mjs', '--check']),
  encounterIndex: runNode(['tools/build-encounter-index.mjs', '--check']),
  compliance: runNode(['tools/audit-card-entry-compliance.mjs', '--check']),
  presentation: runNode(['tools/build-presentation.mjs', '--check']),
  docs: runNode(['tools/check-doc-links.mjs']),
}
const guardsGate = {
  pass: guardRun.exitCode === 0 && guardRun.fail === 0 && existsAt('tests/tsk-all-cards.test.mjs')
    && Object.values(indexChecks).every(row => row.exitCode === 0),
  tests: { command: guardRun.command, tests: guardRun.tests, pass: guardRun.pass, fail: guardRun.fail, failedTitles: guardRun.failedTitles },
  commands: Object.fromEntries(Object.entries(indexChecks).map(([key, row]) => [key, { pass: row.exitCode === 0, command: row.command, exitCode: row.exitCode, tail: row.stderr ? row.stderr.slice(-500) : row.stdout.slice(-300) }])),
}
const imageStats = (() => {
  const codes = [...CARD_PARTITIONS.tskCampaign, ...CARD_PARTITIONS.tskInvestigators, ...CARD_PARTITIONS.tskPlayer]
  const stats = { total: codes.length, unresolved: [], local: 0, remote: 0, localized: 0 }
  for (const code of codes) {
    const resolution = imageResolution(code)
    if (resolution.imageStatus === 'unresolved') stats.unresolved.push(code)
    else if (resolution.imageStatus === 'local') stats.local += 1
    else stats.remote += 1
    if (resolution.localizedFront) stats.localized += 1
  }
  return stats
})()
const runtimeMarkerHits = (() => {
  const hits = []
  const roots = ['lib', 'src', 'content', 'web']
  const walk = (dir) => {
    if (!existsSync(join(MOD, dir))) return
    for (const entry of readdirSync(join(MOD, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(relative)
      else if (/\.(js|mjs|cjs|json|css|html)$/.test(entry.name)) {
        const text = readText(relative) || ''
        // 运行时不得依赖 参考资源/：只拦 import/require/readFile 等真实读取；注释里的来源说明不算。
        if (/(?:from\s*['"][^'"]*参考资源|require\(\s*['"][^'"]*参考资源|readFileSync\([^)]*参考资源|import\(\s*['"][^'"]*参考资源)/.test(text)) hits.push(relative)
      }
    }
  }
  for (const root of roots) walk(root)
  return hits
})()
const assetsGate = {
  pass: imageStats.unresolved.length === 0 && imageStats.total === 439 && runtimeMarkerHits.length === 0
    && Boolean(readMaybe('audit/local-images.json')?.fingerprint),
  images: imageStats, runtimeReferenceHits: runtimeMarkerHits,
  localImagesLedger: { path: 'audit/local-images.json', sha256: textSha('audit/local-images.json') },
}

// ---------------------------------------------------------------------------
// 8. confirmations（scenarios 10 × §6 12 项 / keywords 29 / rulebook）
// ---------------------------------------------------------------------------
const scenarioLedger = readMaybe('audit/tsk-scenario-acceptance.json')
const rulesLedger = readMaybe('audit/tsk-rules.json')
const scenarioBrowser = readMaybe('audit/tsk-scenarios-browser.json')
const rulesBrowser = readMaybe('audit/tsk-browser-acceptance.json')
const chapterTests = runTestFiles(chapters.map(chapter => `tests/tsk-scenario-${chapter.id}.test.mjs`).filter(file => existsAt(file)))
const chapterTitles = Object.fromEntries(chapters.map(chapter => [chapter.id, chapterTests.titles.filter(title => title.includes(chapter.name) || title.includes(chapter.id))]))
const titleHas = (titles, pattern) => titles.some(title => pattern.test(title))
const fileHas = (file, pattern) => { const text = readText(file); return Boolean(text && pattern.test(text)) }
const chapterTestFile = chapterId => `tests/tsk-scenario-${chapterId}.test.mjs`
const chapterEvidence = (chapterId, titles, pattern) => titleHas(titles, pattern) || fileHas(chapterTestFile(chapterId), pattern)
const buildScenarioConfirmations = () => chapters.map(chapter => {
  const ledgerRow = (scenarioLedger?.chapters || []).find(row => row.id === chapter.id) || null
  const titles = chapterTitles[chapter.id] || []
  const cardRows = (allCards?.cards || []).filter(card => card.scenarioId === chapter.id)
  const checks = {
    sourceLocked: Boolean((chapter.guideSources || []).length || (ledgerRow?.sources || []).length),
    identityRegistered: Boolean(ledgerRow?.checks?.moduleLoaded && ledgerRow?.checks?.manifestComplete),
    setupAndZones: titles.length > 0 && chapterEvidence(chapter.id, titles, /设置|布置|setup|preScenarioSetup/i),
    actsAndAgendas: chapterEvidence(chapter.id, titles, /幕|议程|密谋|act|agenda/i),
    locationsAndConnections: chapterEvidence(chapter.id, titles, /地点|连接|layout/i),
    encounterBehaviors: chapterEvidence(chapter.id, titles, /敌人|诡计|条目|遭遇/),
    literalCardBehavior: Boolean(allCardsGate.pass) && cardRows.length > 0 && cardRows.every(card => ['verified', 'simplified', 'scenario-data', 'scenario-reference'].includes(card.status)),
    chaosEffects: chapterEvidence(chapter.id, titles, /混乱|符号|混沌/),
    resolutionsAndRecords: chapterEvidence(chapter.id, titles, /结局|记录|时间|密钥/),
    storyText: Boolean(TSK_STORY_TEXT.chapters?.[chapter.id]) && (TSK_STORY_TEXT.chapters[chapter.id].chineseGaps || []).length === 0 && chapterEvidence(chapter.id, titles, /正文|story|指南|campaignStory|story-text/),
    saveReplay: chapterEvidence(chapter.id, titles, /JSON|往返|存档|恢复/),
    browserAcceptance: Boolean(scenarioBrowser?.status === 'passed' && scenarioBrowser?.checks?.desktop && scenarioBrowser?.checks?.mobile && releaseBrowserGate.pass && customizationBrowserGate.pass),
  }
  const complete = SCENARIO_MIGRATION_CHECKS.every(check => checks[check] === true)
  return {
    id: chapter.id, status: complete ? 'verified' : 'pending', checks,
    evidence: [
      'audit/tsk-scenario-acceptance.json', `tests/tsk-scenario-${chapter.id}.test.mjs`, 'audit/tsk-scenarios-browser.json',
      'audit/tsk-all-card-acceptance.json', 'audit/tsk-release-browser.json',
    ],
  }
})
const keywordItems = (rulesLedger?.confirmations?.keywords?.items || []).map(item => ({ ...item, evidence: item.evidence || ['audit/tsk-rules.json'] }))
const confirmations = {
  scenarios: {
    status: null,
    items: buildScenarioConfirmations(),
  },
  keywords: {
    status: rulesLedger?.confirmations?.keywords?.status || 'pending',
    checked: keywordItems.filter(item => item.status === 'verified').length,
    total: keywordItems.length,
    checks: KEYWORD_MIGRATION_CHECKS,
    items: keywordItems,
  },
  rulebook: {
    status: null,
    checks: {
      campaignOverview: Boolean(rulesLedger?.gates?.campaignOverview ?? true),
      scenarioMechanics: Boolean(rulesLedger?.gates?.scenarioMechanics ?? true),
      keywordEntries: Boolean(rulesLedger?.gates?.keywordEntries ?? true),
      cardLinks: Boolean(rulesLedger?.gates?.cardLinks ?? true),
      desktopBrowser: rulesBrowser?.checks?.desktop === true,
      mobileBrowser: rulesBrowser?.checks?.mobile === true,
    },
    evidence: ['audit/tsk-rules.json', 'audit/tsk-browser-acceptance.json', 'web/tsk-rules.js', 'web/rulebook-data.js'],
  },
}
confirmations.scenarios.status = confirmations.scenarios.items.every(item => item.status === 'verified') ? 'verified' : 'pending'
confirmations.rulebook.status = RULEBOOK_MIGRATION_CHECKS.every(check => confirmations.rulebook.checks[check] === true) ? 'verified' : 'pending'
const confirmationProbe = {
  playable: true,
  earlyAccess: false,
  confirmations,
}
let confirmationsError = null
try { assertMigrationConfirmations(confirmationProbe, chapters.map(chapter => chapter.id)) } catch (error) { confirmationsError = String(error?.message || error) }
const keywordsGate = confirmations.keywords.status === 'verified' && keywordItems.length === 29 && keywordItems.every(item => item.status === 'verified')
const storyGuideGate = ledgerGates.story.pass && ledgerGates.guides.pass && Boolean(TSK_STORY_META) && (TSK_STORY_TEXT.campaign?.chineseGaps || []).length === 0

// ---------------------------------------------------------------------------
// 9. 文档 / README / 脚本
// ---------------------------------------------------------------------------
const readme = readText('docs/campaign/theScarletKeys/README.md') || ''
const p8Section = (() => {
  const start = readme.indexOf('### P8：整体验收与发布')
  if (start < 0) return ''
  const next = readme.indexOf('\n## ', start)
  return next < 0 ? readme.slice(start) : readme.slice(start, next)
})()
const p8Checklist = [...p8Section.matchAll(/^- \[( |x)\] (.+)$/gm)].map(match => ({ checked: match[1] === 'x', text: match[2] }))
const docsGate = {
  pass: p8Checklist.length >= 6 && p8Checklist.every(item => item.checked)
    && readme.includes('| 2026-11-12 | P8 ') && indexChecks.docs.exitCode === 0,
  p8Items: p8Checklist, evidenceRow: readme.includes('| 2026-11-12 | P8 '),
  docsCommandExit: indexChecks.docs.exitCode,
}
const pkg = JSON.parse(readText('package.json'))
const requiredScripts = ['plan:tsk:release', 'audit:tsk:release', 'plan:tsk:allcards', 'audit:tsk:allcards',
  'test:tsk:p8', 'test:tsk:release:browser', 'plan:tsk:primitives:adjudicate', 'audit:tsk:primitives:adjudicate']
const scriptsGate = {
  pass: requiredScripts.every(script => typeof pkg.scripts[script] === 'string'),
  missing: requiredScripts.filter(script => typeof pkg.scripts[script] !== 'string'),
}

// ---------------------------------------------------------------------------
// 10. 汇总
// ---------------------------------------------------------------------------
const gates = {
  registration: {
    pass: registered.campaign.launchable && registered.campaign.status === 'playable'
      && registered.lobby.visible === true && registered.lobby.earlyAccess === false
      && registered.scenarios.length === 10 && registered.scenarios.every(scenario => scenario.status === 'playable')
      && registered.packs.every(pack => pack.status === 'playable' && pack.rulesImplemented && pack.codesMatch && pack.cards === pack.expectedCards
        && pack.deckbuilding === (pack.id === 'tskPlayer' ? 103 : 0))
      && availabilitySummary.campaignCardsStrict && availabilitySummary.playerBuildable === 103,
    registered, availability: availabilitySummary,
  },
  ledgers: { pass: Object.values(ledgerChecks).every(check => check.pass) && Object.values(ledgerGates).every(gate => gate.pass), checks: ledgerChecks, commands: ledgerGates, evidence: evidenceStatuses },
  allCards: allCardsGate,
  campaignE2E: campaignE2EGate,
  releaseBrowser: releaseBrowserGate,
  lobbyCustomization: customizationBrowserGate,
  lobbyEpilogue: epilogueBrowserGate,
  regression: regressionGate,
  replay: replayGate,
  guards: guardsGate,
  assets: assetsGate,
  confirmations: {
    pass: confirmationsError === null && confirmations.scenarios.status === 'verified'
      && confirmations.keywords.status === 'verified' && confirmations.rulebook.status === 'verified',
    error: confirmationsError, scenarios: confirmations.scenarios.status, keywords: confirmations.keywords.status,
    rulebook: confirmations.rulebook.status, scenarioBrowser: scenarioBrowser?.status || null,
  },
  storyGuides: {
    pass: storyGuideGate,
    story: { chapters: Object.keys(TSK_STORY_TEXT.chapters || {}).length, campaignSections: Boolean(TSK_STORY_TEXT.campaign), gaps: (TSK_STORY_TEXT.campaign?.chineseGaps || []).length },
    storyCommand: ledgerGates.story, guidesCommand: ledgerGates.guides,
  },
  flowDeclared: {
    pass: TSK_FLOW?.start === 'prologue' && TSK_FLOW_NODE_ORDER.length >= 143
      && (campaignFlowExtras.scenarioOrder || []).length === 10
      && (campaignFlowExtras.travelTriggers || null) != null
      && (campaignFlowExtras.statusReportNodes || null) != null
      && Object.keys(campaignFlowExtras.recordSchema || {}).length >= 100
      && (KEY_CARDS || []).length === 10 && ENCOUNTER_GROUPS.length === 26 && SHARED_ENCOUNTER_GROUPS.length === 16,
    flowNodes: TSK_FLOW_NODE_ORDER.length, recordKeys: Object.keys(campaignFlowExtras.recordSchema || {}).length,
  },
  docs: docsGate,
  scripts: scriptsGate,
}
const failedGates = Object.entries(gates).filter(([, gate]) => gate.pass !== true).map(([key]) => key)
const status = failedGates.length === 0 ? 'verified' : 'pending'

const sources = [
  ADJUDICATION_LEDGER,
  'audit/tsk-scope.json', 'audit/tsk-baseline.json', 'audit/tsk-mechanism-scan.json', 'audit/tsk-primitive-plan.json',
  'audit/tsk-primitive-catalog.json', 'audit/tsk-node-acceptance.json', 'audit/tsk-rules.json', 'audit/tsk-interactions.json',
  'audit/tsk-investigators.json', 'audit/tsk-player-acceptance.json', 'audit/tsk-scenario-acceptance.json',
  'audit/tsk-campaign-plan.json', 'audit/tsk-scenarios-browser.json', 'audit/tsk-browser-acceptance.json',
  'audit/tsk-interactions-browser.json', 'audit/tsk-investigators-browser.json', 'audit/tsk-player-browser.json',
  'audit/tsk-regression.json', ALL_CARDS_LEDGER, RELEASE_BROWSER, CUSTOMIZATION_BROWSER, EPILOGUE_BROWSER, 'audit/local-images.json',
  'tests/fixtures/replay/tsk-baseline.json', 'content/campaigns/theScarletKeys/story-text.js',
  'content/campaigns/theScarletKeys/manifest.js', 'content/campaigns/theScarletKeys/flow.js',
  'content/registered.js', 'content/mechanics.js',
].filter(file => existsAt(file) || file === ADJUDICATION_LEDGER).map(file => ({ path: file, sha256: existsAt(file) ? textSha(file) : textShaRun(file) }))

const report = {
  schemaVersion: 1,
  cycle: CYCLE,
  cycleName: 'The Scarlet Keys',
  cycleNameZh: '绯红密钥',
  campaignId: CAMPAIGN_ID,
  milestone: 'M5',
  stage: 'P8',
  generatedBy: 'tools/audit-tsk-migration.mjs',
  docs: ['docs/arkham-content-migration.md#48-m5', 'docs/campaign/theScarletKeys/README.md#P8', 'docs/campaign/theScarletKeys/README.md#6-每章完成模板'],
  status,
  playable: status === 'verified',
  launchEnabled: registered.campaign.launchable,
  earlyAccess: false,
  equivalenceCertified: status === 'verified',
  gates,
  registered,
  counts: {
    campaignCards: CARD_PARTITIONS.tskCampaign.length,
    investigatorCards: CARD_PARTITIONS.tskInvestigators.length,
    playerCards: CARD_PARTITIONS.tskPlayer.length,
    total: CARD_PARTITIONS.tskCampaign.length + CARD_PARTITIONS.tskInvestigators.length + CARD_PARTITIONS.tskPlayer.length,
    chapters: chapters.length,
    encounterGroups: ENCOUNTER_GROUPS.length,
    sharedEncounterGroups: SHARED_ENCOUNTER_GROUPS.length,
    keys: KEY_CARDS.length,
    flowNodes: TSK_FLOW_NODE_ORDER.length,
    recordKeys: Object.keys(campaignFlowExtras.recordSchema || {}).length,
    chaosBags: Object.keys(CHAOS_BAGS).length,
    storyLeaves: Object.values(TSK_STORY_TEXT.chapters || {}).reduce((total, chapter) => total + Object.keys(chapter.sectionsEn || {}).length, 0),
  },
  confirmations,
  primitives: {
    adjudication: adjudication.summary || null,
    pendingRequests: adjudication.summary?.pendingBefore ?? null,
    deferredRequests: adjudication.summary?.deferredAfter ?? null,
    nextPhase: 'P9',
    ledger: { path: ADJUDICATION_LEDGER, sha256: textShaRun(ADJUDICATION_LEDGER) },
  },
  evidence: {
    fast: regression?.fast || null,
    replay: regression?.replay || null,
    releaseBrowser: { path: RELEASE_BROWSER, sha256: textSha(RELEASE_BROWSER), checks: browserChecks, screenshots: screenshotRows.length },
    customizationBrowser: { path: CUSTOMIZATION_BROWSER, sha256: textSha(CUSTOMIZATION_BROWSER), checks: customizationChecks, screenshots: customizationShots.length },
    epilogueBrowser: { path: EPILOGUE_BROWSER, sha256: textSha(EPILOGUE_BROWSER), checks: epilogueChecks, screenshots: epilogueShots.length },
    allCards: { path: ALL_CARDS_LEDGER, sha256: textSha(ALL_CARDS_LEDGER), summary: allCards?.summary || null },
    campaignE2E: { command: campaignE2EGate.command, tests: campaignE2EGate.tests, coverage: e2eCoverage, p8Titles: campaignE2EGate.p8Titles },
    images: imageStats,
    guides: ledgerGates.guides,
    story: ledgerGates.story,
  },
  sources,
  remaining: [
    ...(ALL_CARDS_LEDGER && allCards?.summary ? [
      { kind: 'disclosed-approximation', count: allCards.summary.simplified || 0, note: '有近似披露的行为卡（条目 note/章节 approximations 逐条登记）' },
      { kind: 'scenario-data', count: allCards.summary.scenarioData || 0, note: '地点/幕/议程/剧情资产等数据型战役卡：行为由章 behavior 承接并有章测试证据，逐卡字面在 P9 逐卡验收' },
    ] : []),
    { kind: 'primitive-backlog', count: adjudication.summary?.deferredAfter || 0, note: 'P8 裁决为 deferred，进入 P9 原语批次（artifacts/migration/tsk/primitive-adjudication.json）' },
    ...(failedGates.length ? [{ kind: 'gate-pending', gates: failedGates }] : []),
  ],
  gate: Object.fromEntries(Object.entries(gates).map(([key, value]) => [key, value.pass === true])),
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const body = json(report)
  if (process.argv.includes('--write')) {
    mkdirSync(join(RUN, 'p8'), { recursive: true })
    mkdirSync(join(MOD, EVIDENCE_DIR), { recursive: true })
    writeFileSync(REPORT, body)
    console.log(`tsk migration: 已写入（status=${status}，失败门禁：${failedGates.join(',') || '无'}）`)
    console.log(JSON.stringify(report.gate))
    if (status !== 'verified') process.exitCode = 1
  } else if (process.argv.includes('--check')) {
    if (!existsSync(REPORT)) throw new Error('audit/tsk-migration.json 不存在：先 --write')
    if (readFileSync(REPORT, 'utf8') !== body) throw new Error('audit/tsk-migration.json 与复算不一致：审阅后 --write')
    if (status !== 'verified') throw new Error(`tsk migration 门禁未全真：${failedGates.join(',')}`)
    console.log('tsk migration: 复算一致（status=verified）')
  } else {
    console.log(body)
  }
}
