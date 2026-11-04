// Playwright 报告器：TIC P8 发布/联机浏览器证据的唯一写者。
//
// 账本：audit/tic-release-browser.json（schemaVersion 1）
//   · 只接受 tests/playwright/playwright.tic-release.config.mjs 的 3 个 P8 spec：
//       tests/tic-release.browser.mjs        phase=release（真实大厅，零注入）
//       tests/tic-progression.browser.mjs    phase=progression（第一章结算→幕间升级→第二章→最终章战役结局）
//       tests/tic-online.browser.mjs         phase=online（双真人经中转服务）
//   · 每个视口（desktop/mobile）= 一条 passed 用例 + 至少一张真实存在的截图，才算该视口有证据；
//   · checks（aud/Lead 约定字段名）：
//       desktopBrowser / mobileBrowser
//       release     { desktop, mobile }
//       online      { desktop, mobile }
//       progression { desktop, mobile }
//       privacy     { desktop, mobile }   ← online 用例里 annotation claim=privacy
//       permission                        ← online 用例里 annotation claim=permission
//       disconnect                        ← online 用例里 annotation claim=disconnect
//   · screenshots[]：{ name, path(repo 根相对), base:'repo-root', sha256, bytes, exists, viewport, phase, scenario, title }
//   · sourceFiles[]：tools/tic-evidence.mjs#evidenceHashes（Node 账本同一份源码快照）+ 本链新增文件哈希；
//     运行中源码变化 → sourceStableDuringRun=false，status=failed。
//   · **all-or-nothing**：本次命令没有跑齐 expectedSpecs（显式列表，不从 config 正则推导）时，
//     结果写 audit/tic-release-browser-debug.json，canonical 账本保持上次完整结果不动。
//
// 证据命令（在 games/arkhamhorror 下，3 个 spec 一次跑齐）：
//   node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tic-release.config.mjs
// 单跑某 spec 调试可以，但只会写 debug 账本。
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOD, WORKSPACE, sha, writeJson, sourceLock } from './tic-migration-lib.mjs'
import { evidenceHashes } from './tic-evidence.mjs'

const EVIDENCE_COMMAND = 'node ../../node_modules/@playwright/test/cli.js test '
  + '--config tests/playwright/playwright.tic-release.config.mjs'
const TARGET = join(MOD, 'audit/tic-release-browser.json')
const DEBUG_TARGET = join(MOD, 'audit/tic-release-browser-debug.json')

// 显式声明（不读 config 正则）：audit 与 Lead 都按这份清单核对"一次跑齐"。
export const EXPECTED_SPECS = Object.freeze([
  'tests/tic-release.browser.mjs',
  'tests/tic-progression.browser.mjs',
  'tests/tic-online.browser.mjs',
])
const EXPECTED_TESTS = EXPECTED_SPECS.length * 2 // 每个 spec 桌面 + 移动各一条

// 本链新增、必须纳入 sourceFiles 的文件（旧链的清单由 tools/tic-evidence.mjs 提供，不改它）。
const NEW_SOURCES = [
  'tests/tic-browser-helpers.mjs',
  'tests/tic-release.browser.mjs',
  'tests/tic-progression.browser.mjs',
  'tests/tic-online.browser.mjs',
  'tests/playwright/playwright.tic-release.config.mjs',
  'tools/playwright-tic-release-reporter.mjs',
  'tools/run-tic-release-browser.mjs',
  'tools/audit-tic-release.mjs',
]

const toRepoPath = absolute => relative(WORKSPACE, absolute).replace(/\\/g, '/')
const toModPath = absolute => relative(MOD, absolute).replace(/\\/g, '/')
const annotationValue = (annotations, type) =>
  (annotations || []).find(annotation => annotation.type === type && annotation.description)?.description || null
const annotationValues = (annotations, type) => (annotations || [])
  .filter(annotation => annotation.type === type && annotation.description)
  .map(annotation => String(annotation.description))
const sorted = (items, key) => [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))

/** 证据源码快照：Node 账本用的同一份清单 + 本链新增文件（统一为 Mod 根相对路径 + sha256）。 */
function evidenceSnapshot() {
  const rows = new Map()
  for (const file of evidenceHashes()) rows.set(file.path, file)
  for (const path of NEW_SOURCES) {
    if (!existsSync(join(MOD, path))) throw new Error(`P8 证据源文件缺失：${path}`)
    const lock = sourceLock(path, MOD)
    rows.set(lock.path, lock)
  }
  return sorted([...rows.values()], row => row.path)
}

export default class TicReleaseBrowserReporter {
  onBegin() {
    this.tests = []
    this.screenshots = []
    this.before = evidenceSnapshot()
  }

  onTestEnd(test, result) {
    const spec = toModPath(String(test.location?.file || ''))
    if (!EXPECTED_SPECS.includes(spec)) return
    const viewport = annotationValue(test.annotations, 'viewport')
      || (/mobile/.test(test.title) ? 'mobile' : 'desktop')
    const phase = annotationValue(test.annotations, 'phase') || 'unknown'
    const scenario = annotationValue(test.annotations, 'scenario')
    const claims = annotationValues(test.annotations, 'claim')
    const debugJump = annotationValues(test.annotations, 'debugJump')
    const shotAnnotations = (test.annotations || [])
      .filter(annotation => annotation.type === 'screenshot' && annotation.description)
      .map(annotation => String(annotation.description))
    this.tests.push({
      title: test.title,
      spec,
      viewport,
      phase,
      scenario,
      claims,
      debugJump,
      status: result.status,
      expectedStatus: test.expectedStatus,
      retry: result.retry,
      screenshots: shotAnnotations.map(absolute => toRepoPath(absolute)),
    })
    for (const absolute of shotAnnotations) {
      const path = toRepoPath(absolute)
      const exists = existsSync(absolute)
      this.screenshots.push({
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        phase,
        scenario,
        title: test.title,
        exists,
        ...(exists ? { sha256: sha(readFileSync(absolute)), bytes: statSync(absolute).size } : {}),
      })
    }
  }

  onEnd(result) {
    const tests = sorted(this.tests, item => item.title)
    const screenshots = sorted(this.screenshots, item => item.path)
    const sourceFiles = evidenceSnapshot()
    const sourceStableDuringRun = JSON.stringify(sourceFiles) === JSON.stringify(this.before)
    // 可复现性诊断：并发 owner 在运行期间改了哪些证据源（只记录，不改变判定）。
    const beforeByPath = new Map(this.before.map(row => [row.path, row]))
    const sourceDrift = sourceFiles
      .filter(row => beforeByPath.get(row.path)?.sha256 !== row.sha256)
      .map(row => row.path)
    const specs = [...new Set(tests.map(item => item.spec))].sort()
    const complete = EXPECTED_SPECS.every(spec => specs.includes(spec))
      && specs.length === EXPECTED_SPECS.length && tests.length === EXPECTED_TESTS

    const passedTests = tests.filter(item => item.status === 'passed')
    const passedOfPhase = phase => passedTests.filter(item => item.phase === phase)
    const liveShot = (phase, viewport) => screenshots
      .some(item => item.phase === phase && item.viewport === viewport && item.exists)
    const phaseEvidence = (phase, viewport) => passedOfPhase(phase).some(item => item.viewport === viewport)
      && liveShot(phase, viewport)
    const claimEvidence = (claim, viewport = null) => passedOfPhase('online')
      .some(item => item.claims.includes(claim) && (!viewport || item.viewport === viewport))
      && (viewport ? liveShot('online', viewport) : true)
    const packageShots = phase => sorted(screenshots
      .filter(item => item.phase === phase && item.exists), item => item.path).map(item => item.path)
    const packageTests = phase => sorted(passedOfPhase(phase), item => item.title)
      .map(item => ({ title: item.title, spec: item.spec, viewport: item.viewport, status: item.status }))

    const checks = {
      desktopBrowser: passedTests.some(item => item.viewport === 'desktop')
        && screenshots.some(item => item.viewport === 'desktop' && item.exists),
      mobileBrowser: passedTests.some(item => item.viewport === 'mobile')
        && screenshots.some(item => item.viewport === 'mobile' && item.exists),
      release: { desktop: phaseEvidence('release', 'desktop'), mobile: phaseEvidence('release', 'mobile') },
      online: { desktop: phaseEvidence('online', 'desktop'), mobile: phaseEvidence('online', 'mobile') },
      progression: { desktop: phaseEvidence('progression', 'desktop'), mobile: phaseEvidence('progression', 'mobile') },
      privacy: {
        desktop: claimEvidence('privacy', 'desktop'),
        mobile: claimEvidence('privacy', 'mobile'),
      },
      permission: claimEvidence('permission'),
      disconnect: claimEvidence('disconnect'),
    }
    const flatten = value => Object.values(value).flatMap(item => (item && typeof item === 'object') ? Object.values(item) : [item])
    const checksPassed = flatten(checks).every(value => value === true)
    const status = result.status === 'passed' && complete && sourceStableDuringRun && checksPassed ? 'passed' : 'failed'

    let previousSpecs = []
    try {
      previousSpecs = JSON.parse(readFileSync(TARGET, 'utf8')).specs || []
    } catch {
      previousSpecs = []
    }
    const clobbered = previousSpecs.filter(spec => !specs.includes(spec))

    const release = {
      desktop: checks.release.desktop,
      mobile: checks.release.mobile,
      screenshots: packageShots('release'),
      tests: packageTests('release'),
    }
    const online = {
      desktop: checks.online.desktop,
      mobile: checks.online.mobile,
      privacy: { ...checks.privacy },
      permission: checks.permission,
      disconnect: checks.disconnect,
      screenshots: packageShots('online'),
      tests: packageTests('online'),
    }
    const progression = {
      desktop: checks.progression.desktop,
      mobile: checks.progression.mobile,
      debugJump: passedOfPhase('progression').some(item => item.debugJump.length > 0),
      screenshots: packageShots('progression'),
      tests: packageTests('progression'),
    }

    const report = {
      schemaVersion: 1,
      generatedBy: 'playwright + tools/playwright-tic-release-reporter.mjs',
      evidenceCommand: EVIDENCE_COMMAND,
      campaignId: 'theInnsmouthConspiracy',
      milestone: 'P8',
      status,
      sourceStableDuringRun,
      sourceDrift,
      complete,
      expectedSpecs: [...EXPECTED_SPECS],
      specs,
      checks,
      release,
      online,
      progression,
      tests,
      screenshots,
      sourceFiles,
    }
    mkdirSync(join(MOD, 'audit'), { recursive: true })
    const destination = complete ? TARGET : DEBUG_TARGET
    writeJson(destination, report)
    if (!complete) {
      const missingSpecs = EXPECTED_SPECS.filter(spec => !specs.includes(spec))
      console.log('⚠ 本次 P8 浏览器证据没有跑齐，结果写 audit/tic-release-browser-debug.json；'
        + 'canonical 账本保持上次完整结果不动。')
      console.log(`  缺少 spec：${missingSpecs.join(', ') || '无'}；用例 ${tests.length}/${EXPECTED_TESTS}；`
        + `证据命令固定为：${EVIDENCE_COMMAND}`)
    }
    console.log(`tic release browser evidence: ${complete ? 'audit/tic-release-browser.json' : 'audit/tic-release-browser-debug.json'}`
      + ` · ${status} · ${tests.length} 条用例 / ${specs.length} 个 spec · 截图 ${screenshots.length} 张（存在 ${screenshots.filter(item => item.exists).length}）`)
    console.log(`  checks: desktopBrowser=${checks.desktopBrowser} mobileBrowser=${checks.mobileBrowser}`
      + ` release=${checks.release.desktop && checks.release.mobile} online=${checks.online.desktop && checks.online.mobile}`
      + ` progression=${checks.progression.desktop && checks.progression.mobile}`
      + ` privacy=${checks.privacy.desktop && checks.privacy.mobile} permission=${checks.permission} disconnect=${checks.disconnect}`)
    if (!sourceStableDuringRun) {
      console.log(`  ⚠ 运行期间证据源被并发写入（${sourceDrift.length} 个文件），账本 status=failed；请静默窗口后重跑：${sourceDrift.slice(0, 8).join(', ')}${sourceDrift.length > 8 ? ' …' : ''}`)
    }
    if (clobbered.length) {
      console.log(`  ⚠ 本次命令未覆盖这些历史 spec，完整验收记录保持不变：${clobbered.join(', ')}`)
    }
  }
}
