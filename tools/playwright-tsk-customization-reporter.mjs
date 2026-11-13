// Playwright 报告器：八循环《绯红密钥》P8「大厅定制升级卡」浏览器证据的唯一写者。
//
// 账本：audit/tsk-customization-browser.json（schemaVersion 1，确定性：无时间戳/无耗时/无绝对路径）
//   · 唯一 spec：tests/tsk-customization.browser.mjs（desktop / mobile 各 1 行）：
//       phase=customization 真实大厅 → 绯红密钥 → 首章前构筑（初始 0 勾选）→ 首章 →
//       host-only「结束这关」→ 真实 hubContinue → 幕间（给 3 XP）→ 真实 hubCustomize 点一格 →
//       整页刷新后勾选与剩余 XP 仍在。
//   · checks（4 组，嵌套 { desktop, mobile }）：
//       customization    两视口都真实跑过定制面板（用例 passed + 该视口 ≥4 张截图）
//       initialSelection 首章前面板可见 + 0 勾选 + 无候选（check annotation 'initial' + 截图）
//       interludeUpgrade 幕间按钮真实提交一格 + 投影/XP 变化（check 'upgrade' + 截图）
//       refreshRecovery  真实刷新（GET /api/session）后勾选/XP 保留（check 'refresh' + 截图）
//   · screenshots[]：{ path(repo 根相对), base:'repo-root', viewport, phase, bytes, sha256 }；
//     逐张 stat + sha256（只信磁盘），两视口各 ≥4 张、全局 ≥8 张。
//   · sourceFiles[]：本链交付文件 + 读点源码的 sha256 快照（16 个）；运行中变化
//     → sourceStableDuringRun=false、status=failed（附 sourceDrift 诊断）。
//   · status=passed 仅当：Playwright 整体 passed + 2/2 用例 passed + complete + 4 组 checks 全真
//     + 截图 ≥8 张且逐张哈希一致 + sourceStableDuringRun + 无缺失截图。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node tools/run-tsk-customization-browser.mjs
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const TARGET = join(MOD, 'audit/tsk-customization-browser.json')
const EVIDENCE_COMMAND = 'node tools/run-tsk-customization-browser.mjs'

// 显式声明（不读 config 正则）：本链只有一个 spec 文件，2 个视口用例 = 2 行。
const SPEC = 'tests/tsk-customization.browser.mjs'
export const EXPECTED_SPECS = Object.freeze([SPEC])
const EXPECTED_TESTS = 2
const VIEWPORTS = Object.freeze(['desktop', 'mobile'])
const SHOTS_PER_VIEWPORT_MIN = 4
const SHOTS_TOTAL_MIN = 8

// 本链交付文件 + 定制勾选/观察投影/大厅动作的读点源码（sourceStableDuringRun 的哈希对象；
// 运行期间不得被并发修改）。
const SOURCE_FILES = Object.freeze([
  'tests/tsk-customization.browser.mjs',
  'tests/tsk-browser-helpers.mjs',
  'tests/playwright/playwright.tsk-customization.config.mjs',
  'tests/tsk-p8-customization.test.mjs',
  'tools/playwright-tsk-customization-reporter.mjs',
  'tools/run-tsk-customization-browser.mjs',
  'src/engine/hub.js',
  'src/engine/dispatch.js',
  'src/engine/tsk-customizable.js',
  'src/engine/table-decisions.js',
  'src/campaign/campaign.js',
  'src/integration/mechanic-view.js',
  'web/hub.js',
  'web/campaign-experience.css',
  'web/locales/zh-CN.core.js',
  'web/locales/en.core.js',
])

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const toRepoPath = absolute => relative(WORKSPACE, absolute).replace(/\\/g, '/')
const toModPath = absolute => relative(MOD, absolute).replace(/\\/g, '/')
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const annotationValues = (annotations, type) => (annotations || [])
  .filter(annotation => annotation.type === type && annotation.description)
  .map(annotation => String(annotation.description))
const annotationValue = (annotations, type) => annotationValues(annotations, type)[0] || null

/** 截图名 → 证据类别（spec 里的 custom-* 前缀；其它名字归 other）。 */
function shotKind(path) {
  if (/custom-initial-/.test(path)) return 'initial'
  if (/custom-interlude-upgraded-/.test(path)) return 'upgrade'
  if (/custom-interlude-/.test(path)) return 'upgrade'
  if (/custom-refresh-/.test(path)) return 'refresh'
  return 'other'
}

function sourceSnapshot() {
  const files = []
  const missing = []
  for (const path of SOURCE_FILES) {
    const absolute = join(MOD, path)
    if (!existsSync(absolute)) { missing.push(path); continue }
    const buffer = readFileSync(absolute)
    files.push({ path, sha256: sha256(buffer), bytes: statSync(absolute).size })
  }
  files.sort((left, right) => byText(left.path, right.path))
  return { files, missing }
}

export default class TskCustomizationBrowserReporter {
  onBegin() {
    this.tests = []
    this.screenshots = []
    this.before = sourceSnapshot()
  }

  onTestEnd(test, result) {
    const spec = toModPath(String(test.location?.file || ''))
    if (!EXPECTED_SPECS.includes(spec)) return
    const viewport = annotationValue(test.annotations, 'viewport')
      || (/mobile/.test(test.title) ? 'mobile' : 'desktop')
    const phase = annotationValue(test.annotations, 'phase') || 'unknown'
    const shotAnnotations = annotationValues(test.annotations, 'screenshot')
    this.tests.push({
      file: spec,
      title: test.title,
      status: result.status,
      viewport,
      // 完整 annotation（phase / investigator / card / debugJump / evidence / check / screenshot …）
      // 原样进账本。
      annotations: (test.annotations || []).map(annotation => ({
        type: annotation.type,
        ...(annotation.description === undefined ? {} : { description: String(annotation.description) }),
      })),
      phase,
      checks: annotationValues(test.annotations, 'check'),
    })
    for (const absolute of shotAnnotations) {
      this.screenshots.push({ path: toRepoPath(absolute), base: 'repo-root', viewport, phase })
    }
  }

  onEnd(result) {
    const tests = [...this.tests].sort((left, right) => byText(left.file, right.file)
      || byText(left.viewport, right.viewport) || byText(left.title, right.title))
    // 统一在 onEnd 读磁盘：所有页面/截图已经结束，sha256/bytes 必须与最终文件一致。
    const claimed = [...this.screenshots]
      .sort((left, right) => byText(left.path, right.path))
      .filter((item, index, list) => index === 0 || item.path !== list[index - 1].path)
    const missingScreenshots = []
    const screenshots = []
    for (const item of claimed) {
      const absolute = join(WORKSPACE, item.path)
      if (!existsSync(absolute)) { missingScreenshots.push(item.path); continue }
      screenshots.push({
        path: item.path,
        base: 'repo-root',
        viewport: item.viewport,
        phase: item.phase,
        bytes: statSync(absolute).size,
        sha256: sha256(readFileSync(absolute)),
      })
    }
    const after = sourceSnapshot()
    const sourceStableDuringRun = JSON.stringify(after.files) === JSON.stringify(this.before.files)
      && JSON.stringify(after.missing) === JSON.stringify(this.before.missing)
    const beforeByPath = new Map(this.before.files.map(file => [file.path, file]))
    const sourceDrift = after.files
      .filter(file => beforeByPath.get(file.path)?.sha256 !== file.sha256)
      .map(file => file.path)

    const specs = [...new Set(tests.map(item => item.file))].sort(byText)
    const complete = EXPECTED_SPECS.every(spec => specs.includes(spec))
      && specs.length === 1 && tests.length === EXPECTED_TESTS

    const passed = tests.filter(item => item.status === 'passed')
    const passedViewport = viewport => passed.some(item => item.viewport === viewport)
    const checksFor = (viewport, check) => passed.some(item => item.viewport === viewport
      && (item.checks || []).includes(check))
    const shotsFor = (viewport, kind) => screenshots.filter(item =>
      item.viewport === viewport && shotKind(item.path) === kind)

    // 4 组 checks：面板全链（用例 + 截图）/ 初始勾选 / 幕间升级 / 刷新保留。
    const viewportShots = viewport => screenshots.filter(item => item.viewport === viewport).length
    const checks = {
      customization: {
        desktop: passedViewport('desktop') && viewportShots('desktop') >= SHOTS_PER_VIEWPORT_MIN,
        mobile: passedViewport('mobile') && viewportShots('mobile') >= SHOTS_PER_VIEWPORT_MIN,
      },
      initialSelection: {
        desktop: checksFor('desktop', 'initial') && shotsFor('desktop', 'initial').length > 0,
        mobile: checksFor('mobile', 'initial') && shotsFor('mobile', 'initial').length > 0,
      },
      interludeUpgrade: {
        desktop: checksFor('desktop', 'upgrade') && shotsFor('desktop', 'upgrade').length > 0,
        mobile: checksFor('mobile', 'upgrade') && shotsFor('mobile', 'upgrade').length > 0,
      },
      refreshRecovery: {
        desktop: checksFor('desktop', 'refresh') && shotsFor('desktop', 'refresh').length > 0,
        mobile: checksFor('mobile', 'refresh') && shotsFor('mobile', 'refresh').length > 0,
      },
    }
    const flatten = value => Object.values(value).flatMap(item =>
      (item && typeof item === 'object' ? Object.values(item) : [item]))
    const checksPassed = flatten(checks).every(value => value === true)
    const shotsOk = screenshots.length >= SHOTS_TOTAL_MIN
      && VIEWPORTS.every(viewport => screenshots.filter(item => item.viewport === viewport).length
        >= SHOTS_PER_VIEWPORT_MIN)
      && missingScreenshots.length === 0
    const allPassed = tests.length === EXPECTED_TESTS && passed.length === EXPECTED_TESTS
    const status = result.status === 'passed' && complete && allPassed && checksPassed
      && shotsOk && sourceStableDuringRun ? 'passed' : 'failed'

    const report = {
      schemaVersion: 1,
      generatedBy: 'tools/playwright-tsk-customization-reporter.mjs',
      evidenceCommand: EVIDENCE_COMMAND,
      milestone: 'P8',
      campaignId: 'theScarletKeys',
      status,
      complete,
      sourceStableDuringRun,
      sourceDrift,
      expectedSpecs: [...EXPECTED_SPECS],
      expectedTests: EXPECTED_TESTS,
      specs,
      tests,
      checks,
      screenshots,
      screenshotsMissing: missingScreenshots,
      sourceFiles: after.files,
      sourceFilesMissing: after.missing,
    }
    mkdirSync(join(MOD, 'audit'), { recursive: true })
    writeFileSync(TARGET, JSON.stringify(report, null, 2) + '\n')

    const shotCounts = Object.fromEntries(VIEWPORTS.map(viewport => [viewport,
      screenshots.filter(item => item.viewport === viewport).length]))
    console.log(`tsk P8 customization browser evidence: ${status} · ${tests.length}/${EXPECTED_TESTS} tests / `
      + `${specs.length} spec · screenshots ${screenshots.length}`
      + `${missingScreenshots.length ? `（缺失 ${missingScreenshots.length}）` : ''}`)
    console.log(`  checks=${JSON.stringify(checks)}`)
    console.log(`  viewport shots=${JSON.stringify(shotCounts)} complete=${complete} `
      + `sourceStable=${sourceStableDuringRun} missing=${JSON.stringify(after.missing)}`)
    if (!sourceStableDuringRun) {
      console.log(`  ⚠ 运行期间证据源被并发写入（${sourceDrift.length} 个文件），账本 status=failed；`
        + `请静默窗口后重跑：${sourceDrift.slice(0, 8).join(', ')}${sourceDrift.length > 8 ? ' …' : ''}`)
    }
    if (status !== 'passed') {
      const failures = tests.filter(item => item.status !== 'passed')
        .map(item => `${item.viewport}:${item.title}:${item.status}`)
      console.log(`  failures=${JSON.stringify(failures)} shotsOk=${shotsOk} checksPassed=${checksPassed}`)
    }
  }
}
