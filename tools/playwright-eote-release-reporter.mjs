// Playwright 报告器：《地球边缘》（EotE）P8 发布/推进/联机浏览器证据的唯一写者。
//
// 账本：audit/eote-release-browser.json（schemaVersion 1）
//   · 只接受 tests/playwright/playwright.eote-p8.config.mjs 的 3 个 P8 spec：
//       tests/eote-release.browser.mjs        phase=release（真实大厅启动→调查准备→出发→牌桌）
//       tests/eote-progression.browser.mjs    phase=progression（8 章 → 检查点 I–III → 幕间 I–III → 升级 → 尾声）
//       tests/eote-online.browser.mjs         phase=online（双真人经中转服务 + 两个大厅实例）
//   · 每个视口（desktop/mobile）= 一条 passed 用例 + 至少 4 张真实存在的截图，才算该视口有证据；
//   · checks（Lead 约定字段，全部为扁平布尔值）：
//       desktopBrowser / mobileBrowser
//       releaseDesktop / releaseMobile
//       progressionDesktop / progressionMobile
//       onlineDesktop / onlineMobile
//       privacyDesktop / privacyMobile      ← online 用例 annotation claim=privacy
//       permissionBoundary                  ← online 用例 annotation claim=permission
//       disconnectRecovery                  ← online 用例 annotation claim=disconnect
//   · tests[]：一条 Playwright 用例一行，带 phase / viewport / scenario（及 scenarios[]）annotation；
//     debugJump[] 记录 progression 里用到的单机调试通道原语（真实 POST /api/debug，非状态注入）。
//   · screenshots[]：{ name, path(repo 根相对), base:'repo-root', sha256, bytes, exists, viewport,
//     phase, scenario, title }；每 phase×视口 ≥4、总数 ≥20 才算通过。
//   · sourceFiles[]：本链 7 个交付文件的 sha256 快照；运行期间源码变化 → sourceStableDuringRun=false，
//     status=failed（并写出 sourceDrift 诊断）。
//   · **all-or-nothing**：没有跑齐 3 个 spec / 6 条用例时 complete=false、status=failed，
//     但仍写 canonical 账本（保留本次失败证据；完整跑齐的通过结果会覆盖它）。
//
// 证据命令（在 games/arkhamhorror 下，3 个 spec 一次跑齐）：
//   node tools/run-eote-release-browser.mjs
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const TARGET = join(MOD, 'audit/eote-release-browser.json')
const EVIDENCE_COMMAND = 'node tools/run-eote-release-browser.mjs'

// 显式声明（不读 config 正则）：audit 与 Lead 都按这份清单核对「一次跑齐」。
export const EXPECTED_SPECS = Object.freeze([
  'tests/eote-release.browser.mjs',
  'tests/eote-progression.browser.mjs',
  'tests/eote-online.browser.mjs',
])
const EXPECTED_TESTS = EXPECTED_SPECS.length * 2 // 每个 spec 桌面 + 移动各一条
const VIEWPORTS = Object.freeze(['desktop', 'mobile'])
const PHASES = Object.freeze(['release', 'progression', 'online'])
const SHOTS_PER_PHASE_VIEWPORT = 4
const SHOTS_TOTAL_MIN = 20

// 本链交付文件（sourceStableDuringRun 的哈希对象；运行期间不得被并发修改）。
const SOURCE_FILES = Object.freeze([
  'tests/eote-browser-helpers.mjs',
  'tests/eote-release.browser.mjs',
  'tests/eote-progression.browser.mjs',
  'tests/eote-online.browser.mjs',
  'tests/playwright/playwright.eote-p8.config.mjs',
  'tools/playwright-eote-release-reporter.mjs',
  'tools/run-eote-release-browser.mjs',
])

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const toRepoPath = absolute => relative(WORKSPACE, absolute).replace(/\\/g, '/')
const toModPath = absolute => relative(MOD, absolute).replace(/\\/g, '/')
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const annotationValue = (annotations, type) =>
  (annotations || []).find(annotation => annotation.type === type && annotation.description)?.description || null
const annotationValues = (annotations, type) => (annotations || [])
  .filter(annotation => annotation.type === type && annotation.description)
  .map(annotation => String(annotation.description))

function sourceSnapshot() {
  return SOURCE_FILES.filter(path => existsSync(join(MOD, path))).map(path => {
    const absolute = join(MOD, path)
    const buffer = readFileSync(absolute)
    return { path, sha256: sha256(buffer), bytes: statSync(absolute).size }
  }).sort((left, right) => byText(left.path, right.path))
}

export default class EoteReleaseBrowserReporter {
  onBegin() {
    this.tests = []
    this.screenshots = []
    this.blocked = []
    this.before = sourceSnapshot()
  }

  onTestEnd(test, result) {
    const spec = toModPath(String(test.location?.file || ''))
    if (!EXPECTED_SPECS.includes(spec)) return
    const viewport = annotationValue(test.annotations, 'viewport')
      || (/mobile/.test(test.title) ? 'mobile' : 'desktop')
    const phase = annotationValue(test.annotations, 'phase') || 'unknown'
    const scenarios = annotationValues(test.annotations, 'scenario')
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
      scenario: scenarios[0] || null,
      scenarios,
      claims,
      debugJump,
      status: result.status,
      durationMs: Math.round(result.duration || 0),
      screenshots: shotAnnotations.map(absolute => toRepoPath(absolute)),
    })
    if (result.status === 'skipped') this.blocked.push(`${viewport}:${test.title}`)
    for (const absolute of shotAnnotations) {
      // 只登记「路径 + 归属」；sha256/bytes 等所有用例结束后统一 stat（截图可能被后续用例覆盖同名文件）。
      const path = toRepoPath(absolute)
      this.screenshots.push({
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        phase,
        scenario: scenarios[0] || null,
        title: test.title,
      })
    }
  }

  onEnd(result) {
    const tests = [...this.tests].sort((left, right) => byText(left.spec, right.spec)
      || byText(left.viewport, right.viewport) || byText(left.title, right.title))
    // 统一在 onEnd 读磁盘：所有页面/截图已经结束，sha256/bytes 必须与最终文件一致。
    const screenshots = [...this.screenshots]
      .sort((left, right) => byText(left.path, right.path))
      .filter((item, index, list) => index === 0 || item.path !== list[index - 1].path)
      .map(item => {
        const absolute = join(WORKSPACE, item.path)
        const exists = existsSync(absolute)
        return {
          ...item,
          exists,
          ...(exists ? { sha256: sha256(readFileSync(absolute)), bytes: statSync(absolute).size } : {}),
        }
      })
    const sourceFiles = sourceSnapshot()
    const sourceStableDuringRun = JSON.stringify(sourceFiles) === JSON.stringify(this.before)
    const sourceDrift = sourceFiles
      .filter(file => this.before.find(previous => previous.path === file.path)?.sha256 !== file.sha256)
      .map(file => file.path)
    const specs = [...new Set(tests.map(item => item.spec))].sort(byText)
    const complete = EXPECTED_SPECS.every(spec => specs.includes(spec))
      && specs.length === EXPECTED_SPECS.length && tests.length === EXPECTED_TESTS

    const passed = tests.filter(item => item.status === 'passed')
    const liveShots = (phase, viewport) => screenshots.filter(item =>
      item.phase === phase && item.viewport === viewport && item.exists)
    const passedPhase = (phase, viewport) => passed.some(item => item.phase === phase && item.viewport === viewport)
    const phaseViewportEvidence = (phase, viewport) => passedPhase(phase, viewport)
      && liveShots(phase, viewport).length >= SHOTS_PER_PHASE_VIEWPORT
    const claimEvidence = (claim, viewport) => passed.some(item => item.phase === 'online'
      && item.claims.includes(claim) && item.viewport === viewport) && liveShots('online', viewport).length > 0
    const claimEvidenceAny = claim => passed.some(item => item.phase === 'online' && item.claims.includes(claim))

    const checks = {
      desktopBrowser: passed.some(item => item.viewport === 'desktop')
        && screenshots.some(item => item.viewport === 'desktop' && item.exists),
      mobileBrowser: passed.some(item => item.viewport === 'mobile')
        && screenshots.some(item => item.viewport === 'mobile' && item.exists),
      releaseDesktop: phaseViewportEvidence('release', 'desktop'),
      releaseMobile: phaseViewportEvidence('release', 'mobile'),
      progressionDesktop: phaseViewportEvidence('progression', 'desktop'),
      progressionMobile: phaseViewportEvidence('progression', 'mobile'),
      onlineDesktop: phaseViewportEvidence('online', 'desktop'),
      onlineMobile: phaseViewportEvidence('online', 'mobile'),
      privacyDesktop: claimEvidence('privacy', 'desktop'),
      privacyMobile: claimEvidence('privacy', 'mobile'),
      permissionBoundary: claimEvidenceAny('permission'),
      disconnectRecovery: claimEvidenceAny('disconnect'),
    }
    const shotsOk = screenshots.length >= SHOTS_TOTAL_MIN
      && PHASES.every(phase => VIEWPORTS.every(viewport => liveShots(phase, viewport).length >= SHOTS_PER_PHASE_VIEWPORT))
    const checksPassed = Object.values(checks).every(value => value === true)
    // 写盘后的一致性复核：重新 stat 每张截图，确认账本里的 sha256/bytes 与磁盘最终文件一致。
    const hashMismatch = screenshots.filter(item => {
      const absolute = join(WORKSPACE, item.path)
      if (!existsSync(absolute)) return item.exists !== false
      const buffer = readFileSync(absolute)
      return item.sha256 !== sha256(buffer) || item.bytes !== statSync(absolute).size
    })
    const screenshotHashesConsistent = hashMismatch.length === 0
    const status = result.status === 'passed' && complete && sourceStableDuringRun && checksPassed && shotsOk
      && screenshotHashesConsistent && this.blocked.length === 0 ? 'passed' : 'failed'

    const report = {
      schemaVersion: 1,
      generatedBy: 'playwright + tools/playwright-eote-release-reporter.mjs',
      evidenceCommand: EVIDENCE_COMMAND,
      campaignId: 'edgeOfTheEarth',
      milestone: 'P8',
      status,
      sourceStableDuringRun,
      sourceDrift,
      complete,
      screenshotHashesConsistent,
      expectedSpecs: [...EXPECTED_SPECS],
      expectedTests: EXPECTED_TESTS,
      specs,
      checks,
      tests,
      screenshots,
      sourceFiles,
      blocked: [...new Set(this.blocked)].sort(byText),
    }
    mkdirSync(join(MOD, 'audit'), { recursive: true })
    // all-or-nothing：只有 3 specs / 6 用例一次跑齐时才写 canonical 账本；
    // 单 spec 调试跑（complete=false）只打印诊断，不用半成品覆盖已通过的发布证据。
    if (complete) {
      writeFileSync(TARGET, JSON.stringify(report, null, 2) + '\n')
    } else {
      const missingSpecs = EXPECTED_SPECS.filter(spec => !specs.includes(spec))
      console.log('⚠ 本次 P8 浏览器证据没有跑齐（调试运行），不写 audit/eote-release-browser.json；'
        + `缺少 spec：${missingSpecs.join(', ') || '无'}；用例 ${tests.length}/${EXPECTED_TESTS}。证据命令：${EVIDENCE_COMMAND}`)
    }
    const shotCounts = Object.fromEntries(PHASES.map(phase => [phase,
      Object.fromEntries(VIEWPORTS.map(viewport => [viewport, liveShots(phase, viewport).length]))]))
    console.log(`eote P8 release browser evidence: ${status} · ${tests.length}/${EXPECTED_TESTS} tests / ${specs.length} specs · `
      + `screenshots ${screenshots.length}（存在 ${screenshots.filter(item => item.exists).length}）`)
    console.log(`  checks=${JSON.stringify(checks)}`)
    console.log(`  phase×viewport shots=${JSON.stringify(shotCounts)} complete=${complete} sourceStable=${sourceStableDuringRun} `
      + `screenshotHashesConsistent=${screenshotHashesConsistent} blocked=${JSON.stringify(report.blocked)}`)
    if (!screenshotHashesConsistent) console.log(`  ⚠ 截图哈希与磁盘不一致：${JSON.stringify(hashMismatch.map(item => item.path))}`)
    if (status !== 'passed') {
      const failures = tests.filter(item => item.status !== 'passed')
        .map(item => `${item.phase}/${item.viewport}:${item.title}:${item.status}`)
      console.log(`  failures=${JSON.stringify(failures)} shotsOk=${shotsOk} drift=${JSON.stringify(sourceDrift)}`)
    }
  }
}
