// TIC P8 发布审计：把浏览器证据账本复核成 audit/tic-release-acceptance.json。
//
// 输入（只读）：
//   · audit/tic-release-browser.json      —— tools/playwright-tic-release-reporter.mjs 生成；
//   · audit/tic-scenario-acceptance.json  —— 8 章逐章账本（aud 维护）；
//   · 生产组合根 content/registered.js    —— assertLaunchable / campaignListForUi 实时事实。
//
// 复核内容（任一不满足 → status=failed，退出码 1）：
//   1) launch：contentRegistry.assertLaunchable('theInnsmouthConspiracy') 通过且 status=playable；
//      campaignListForUi 可见、earlyAccess=false、恰好 8 章；
//   2) chapters：逐章账本 8/8 verified；
//   3) 浏览器账本：status=passed、complete=true、sourceStableDuringRun=true；
//      6 条用例（3 spec × desktop/mobile）全部 passed；specs 覆盖 expectedSpecs；
//   4) checks（aud/Lead 约定字段名）：desktopBrowser / mobileBrowser / release{desktop,mobile} /
//      online{desktop,mobile} / progression{desktop,mobile} / privacy{desktop,mobile} /
//      permission / disconnect 全部 true；required 映射成发布门禁名称；
//   5) screenshots：逐张重新 stat + sha256（只信磁盘，不信账本自报），路径为 repo 根相对且存在；
//      release/online/progression 每个 phase × 视口至少 4/4/4 张、全局 ≥ 20 张；
//   6) sourceFiles 非空（源码快照存在）。
//
// 输出刻意无时间戳/耗时/宿主信息：同一份证据 + 同一份源码跑同一命令得到逐字节相同结论（--check 可证）。
//
// 用法（在 games/arkhamhorror 下）：
//   node tools/audit-tic-release.mjs --write   # 写 audit/tic-release-acceptance.json
//   node tools/audit-tic-release.mjs --check   # 复算并与现有文件逐字节比较，漂移则退出码 1
//   node tools/audit-tic-release.mjs           # 只打印 JSON
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MOD, WORKSPACE, RUN, json, sha, writeJson } from './tic-migration-lib.mjs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { TIC_RULE_IDS } from '../web/tic-rules.js'

const CAMPAIGN_ID = 'theInnsmouthConspiracy'
const REPORT = join(MOD, 'audit/tic-release-acceptance.json')
const BROWSER_LEDGER = 'audit/tic-release-browser.json'
const SCENARIO_LEDGER = 'audit/tic-scenario-acceptance.json'
const REQUIRED_KEYS = ['launch', 'chapters', 'releaseDesktop', 'releaseMobile', 'onlineDesktop', 'onlineMobile',
  'progressionDesktop', 'progressionMobile', 'privacyDesktop', 'privacyMobile', 'permissionBoundary', 'disconnectRecovery']
const MIN_SHOTS_BY_PHASE = { release: 4, online: 4, progression: 4 }
const MIN_SHOTS_TOTAL = 20

const readJson = path => {
  try {
    return JSON.parse(readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}
const require = (condition, message) => {
  if (!condition) throw new Error(message)
}

// ---------------------------------------------------------------- 生产事实
let launch = { launchable: false, id: null, status: null, error: null }
try {
  const campaign = contentRegistry.assertLaunchable(CAMPAIGN_ID)
  launch = { launchable: campaign?.id === CAMPAIGN_ID, id: campaign?.id || null, status: campaign?.status || null, error: null }
} catch (error) {
  launch.error = String(error?.message || error)
}
const lobby = (() => {
  try {
    const row = campaignListForUi(contentRegistry).find(campaign => campaign.id === CAMPAIGN_ID)
    return row ? { visible: true, status: row.status, earlyAccess: row.earlyAccess,
      scenarios: (row.scenarios || []).map(scenario => scenario.id) } : { visible: false }
  } catch (error) {
    return { visible: false, error: String(error?.message || error) }
  }
})()

// ---------------------------------------------------------------- 逐章账本
const scenarioLedger = readJson(SCENARIO_LEDGER)
const scenarioItems = Array.isArray(scenarioLedger?.items) ? scenarioLedger.items : []
const chapterRows = chapters.map(chapter => {
  const item = scenarioItems.find(entry => entry.id === chapter.id) || null
  return { id: chapter.id, code: chapter.code, name: chapter.name,
    status: item?.status || null, verified: item?.status === 'verified' }
})
const chaptersVerified = chapterRows.length === chapters.length && chapterRows.every(row => row.verified)

// ---------------------------------------------------------------- 浏览器账本
const ledger = readJson(BROWSER_LEDGER)
require(ledger, `缺少浏览器证据账本 ${BROWSER_LEDGER}`)
const checks = ledger.checks || {}
const ledgerTests = Array.isArray(ledger.tests) ? ledger.tests : []
const expectedSpecs = Array.isArray(ledger.expectedSpecs) ? ledger.expectedSpecs : []
const specs = Array.isArray(ledger.specs) ? ledger.specs : []
const testsPassed = ledgerTests.length > 0 && ledgerTests.every(test => test.status === 'passed')
const specsCovered = expectedSpecs.length > 0 && expectedSpecs.every(spec => specs.includes(spec)) && specs.length === expectedSpecs.length
const viewports = new Set(ledgerTests.map(test => test.viewport))
const ledgerOk = ledger.status === 'passed' && ledger.complete === true && ledger.sourceStableDuringRun === true
  && testsPassed && specsCovered && ledgerTests.length === expectedSpecs.length * 2
  && viewports.has('desktop') && viewports.has('mobile') && Array.isArray(ledger.sourceFiles) && ledger.sourceFiles.length > 0

// 截图逐张重新校验（只信磁盘）：存在 + 字节数 + sha256 与账本一致。
const screenshots = (Array.isArray(ledger.screenshots) ? ledger.screenshots : []).map(shot => {
  const absolute = join(WORKSPACE, shot.path)
  const exists = existsSync(absolute)
  const bytes = exists ? statSync(absolute).size : null
  const sha256 = exists ? sha(readFileSync(absolute)) : null
  return {
    path: shot.path, base: shot.base, viewport: shot.viewport, phase: shot.phase,
    exists, bytes, sha256,
    hashMatches: exists && shot.base === 'repo-root' && shot.sha256 === sha256 && shot.bytes === bytes,
  }
})
const screenshotRows = screenshots.filter(shot => shot.exists && shot.hashMatches)
const shotsByPhaseViewport = phase => ({
  desktop: screenshotRows.some(shot => shot.phase === phase && shot.viewport === 'desktop'),
  mobile: screenshotRows.some(shot => shot.phase === phase && shot.viewport === 'mobile'),
})
const phaseShotCounts = Object.fromEntries(Object.keys(MIN_SHOTS_BY_PHASE).map(phase =>
  [phase, screenshotRows.filter(shot => shot.phase === phase).length]))
const screenshotsOk = screenshots.length > 0 && screenshots.every(shot => shot.exists && shot.hashMatches)
  && screenshotRows.length >= MIN_SHOTS_TOTAL
  && Object.entries(MIN_SHOTS_BY_PHASE).every(([phase, minimum]) => phaseShotCounts[phase] >= minimum)
  && Object.keys(MIN_SHOTS_BY_PHASE).every(phase => {
    const byViewport = shotsByPhaseViewport(phase)
    return byViewport.desktop && byViewport.mobile
  })

// ---------------------------------------------------------------- 发布门禁 checks
const bool = value => value === true
const requiredChecks = {
  launch: launch.launchable && launch.status === 'playable' && lobby.visible === true
    && lobby.earlyAccess === false && Array.isArray(lobby.scenarios) && lobby.scenarios.length === chapters.length,
  chapters: chaptersVerified,
  releaseDesktop: bool(checks.release?.desktop) && shotsByPhaseViewport('release').desktop,
  releaseMobile: bool(checks.release?.mobile) && shotsByPhaseViewport('release').mobile,
  onlineDesktop: bool(checks.online?.desktop) && shotsByPhaseViewport('online').desktop,
  onlineMobile: bool(checks.online?.mobile) && shotsByPhaseViewport('online').mobile,
  progressionDesktop: bool(checks.progression?.desktop) && shotsByPhaseViewport('progression').desktop,
  progressionMobile: bool(checks.progression?.mobile) && shotsByPhaseViewport('progression').mobile,
  privacyDesktop: bool(checks.privacy?.desktop),
  privacyMobile: bool(checks.privacy?.mobile),
  permissionBoundary: bool(checks.permission),
  disconnectRecovery: bool(checks.disconnect),
}
const missing = REQUIRED_KEYS.filter(key => requiredChecks[key] !== true)
const status = missing.length === 0 && ledgerOk && screenshotsOk ? 'passed' : 'failed'

const report = {
  schemaVersion: 1,
  campaignId: CAMPAIGN_ID,
  milestone: 'P8',
  generatedBy: 'node tools/audit-tic-release.mjs --write',
  status,
  evidence: {
    command: ledger.evidenceCommand || null,
    browserLedger: BROWSER_LEDGER,
    scenarioLedger: SCENARIO_LEDGER,
    acceptanceLedger: 'audit/tic-release-acceptance.json',
    screenshotRoot: 'artifacts/migration/tic/p8/screenshots/',
  },
  campaign: {
    launchable: launch.launchable,
    status: launch.status,
    launchError: launch.error,
    lobbyVisible: lobby.visible === true,
    earlyAccess: lobby.earlyAccess ?? null,
    scenarios: Array.isArray(lobby.scenarios) ? lobby.scenarios : [],
    scenarioCount: Array.isArray(lobby.scenarios) ? lobby.scenarios.length : 0,
    chapterCount: chapters.length,
    rulebookEntries: TIC_RULE_IDS.length,
  },
  chapters: chapterRows,
  checks: requiredChecks,
  missing,
  browser: {
    ledger: BROWSER_LEDGER,
    status: ledger.status ?? null,
    complete: ledger.complete === true,
    sourceStableDuringRun: ledger.sourceStableDuringRun === true,
    specs,
    expectedSpecs,
    tests: ledgerTests.length,
    testsPassed: ledgerTests.filter(test => test.status === 'passed').length,
    testsBySpec: Object.fromEntries(specs.map(spec =>
      [spec, ledgerTests.filter(test => test.spec === spec).length])),
    sourceFiles: Array.isArray(ledger.sourceFiles) ? ledger.sourceFiles.length : 0,
    sourceFilesSha256: sha(json(ledger.sourceFiles || [])),
  },
  screenshots: {
    total: screenshots.length,
    verified: screenshotRows.length,
    base: 'repo-root',
    byPhase: phaseShotCounts,
    byPhaseViewport: Object.fromEntries(Object.keys(MIN_SHOTS_BY_PHASE).map(phase =>
      [phase, shotsByPhaseViewport(phase)])),
    existing: screenshots.filter(shot => shot.exists).length,
    missing: screenshots.filter(shot => !shot.exists).map(shot => shot.path),
    mismatched: screenshots.filter(shot => shot.exists && !shot.hashMatches).map(shot => shot.path),
  },
  deferred: [
    { id: 'victoryEpilogue', reason: '浏览器证据覆盖第一章→幕间升级→第二章→最终章失败结局（campaignResult）；胜利尾声逐段叙事由 Node 战役验收（tic-p8-campaign/tic-interludes）覆盖。' },
    { id: 'manualUpgradePurchase', reason: '关间升级窗验证了真实 hubAutoUpgrade（自动购买一次合法升级）；hubPurchase 手动选择由 Node 与 TCU/TDE 既有浏览器证据覆盖。' },
    { id: 'relayReconnect', reason: '联机断线恢复验证到页面重开 + 真实会话版本号/手牌隐私一致；中转服务级断线重连由大厅通用联机回归覆盖。' },
  ],
  sourceFiles: Array.isArray(ledger.sourceFiles) ? ledger.sourceFiles.length : 0,
  gate: { pass: status === 'passed' },
}
report.missing = missing

// ---------------------------------------------------------------- 写入 / 校验
const args = process.argv.slice(2)
const print = data => console.log(json(data))
if (args.includes('--write')) {
  writeJson(REPORT, report)
  writeJson(join(RUN, 'release-acceptance.json'), report)
  console.log(`tic release acceptance: 已写入 audit/tic-release-acceptance.json · ${status}`)
  console.log(`  checks ${REQUIRED_KEYS.filter(key => requiredChecks[key]).length}/${REQUIRED_KEYS.length}`
    + ` · 截图 ${screenshotRows.length}/${screenshots.length}（${Object.entries(phaseShotCounts).map(([phase, count]) => `${phase}=${count}`).join(' ')}）`
    + ` · 章节 ${chapterRows.filter(row => row.verified).length}/${chapters.length}`)
  if (missing.length) console.log(`  未通过：${missing.join(', ')}`)
} else if (args.includes('--check')) {
  const expected = json(report)
  const current = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : ''
  if (current !== expected) throw new Error('audit/tic-release-acceptance.json 漂移；复核证据/源码变化后显式 --write')
  console.log(`tic release acceptance: 复算一致 · ${status}`)
} else {
  print(report)
}
if (status !== 'passed') {
  console.error(`tic release acceptance 未通过：${missing.join(', ') || 'evidence/ledger/screenshot 校验失败'}`)
  process.exitCode = 1
}
