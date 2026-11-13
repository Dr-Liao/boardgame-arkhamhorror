// Playwright 报告器：八循环《绯红密钥》（The Scarlet Keys）P8 尾声/终章浏览器证据的唯一写者。
//
// 账本：audit/tsk-epilogue-browser.json（schemaVersion 1，确定性：无时间戳/无耗时/无绝对路径）
//   · 唯一 spec：tests/tsk-epilogue.browser.mjs（desktop/mobile 2 行）：
//       phase=epilogue  真实大厅启动绯红密钥 → 首章谜雨 → 真实关末结算 → 世界地图真实累积时间
//                       （London↔Bermuda 启程循环 + 幕间确认/分支 + 状况报告）→ 时间 ≥35 唯一
//                       「被迫启程：通古斯卡」→ 钥匙议会终章 → 尾声 → campaignResult。
//   · checks（本链约定字段名，嵌套）：
//       forcedEndgame / congressTerminal / epilogue 各自 { desktop, mobile }：
//       该视口用例 passed + 带对应 claim annotation + 该视口至少 4 张磁盘截图。
//   · screenshots[]：{ path(repo 根相对), base:'repo-root', viewport, phase, bytes, sha256 }；
//     逐张 stat + sha256（只信磁盘），按 path 排序去重；缺失截图单列 screenshotsMissing。
//   · sourceFiles[]：本链交付文件 + 世界地图/终章/尾声读点源码的 sha256 快照（≥16 个）；
//     运行中变化 → sourceStableDuringRun=false、status=failed（附 sourceDrift 诊断）。
//   · status=passed 仅当：Playwright 整体 passed + 2/2 用例 passed + complete + 6 个 checks 全真
//     + 截图 ≥8 张且逐张哈希一致 + sourceStableDuringRun + 无缺失截图。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node tools/run-tsk-epilogue-browser.mjs
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const TARGET = join(MOD, 'audit/tsk-epilogue-browser.json')
const EVIDENCE_COMMAND = 'node tools/run-tsk-epilogue-browser.mjs'

// 显式声明（不读 config 正则）：本链只有一个 spec 文件，2 个视口用例 = 2 行。
const SPEC = 'tests/tsk-epilogue.browser.mjs'
export const EXPECTED_SPECS = Object.freeze([SPEC])
const EXPECTED_TESTS = 2
const VIEWPORTS = Object.freeze(['desktop', 'mobile'])
const PHASE = 'epilogue'
const SHOTS_PER_VIEWPORT = 4
const SHOTS_TOTAL_MIN = 8
const CLAIMS = Object.freeze(['forcedEndgame', 'congressTerminal', 'epilogue'])

// 本链交付文件 + 世界地图/终章/尾声读点源码（sourceStableDuringRun 的哈希对象；运行期间不得被并发修改）。
// 引擎/内容读点也在清单里：账本要证明「同一个应用源码版本」产出了这 2 行真实大厅证据。
const SOURCE_FILES = Object.freeze([
  'tests/tsk-epilogue.browser.mjs',
  'tests/tsk-browser-helpers.mjs',
  'tests/playwright/playwright.tsk-epilogue.config.mjs',
  'tools/playwright-tsk-epilogue-reporter.mjs',
  'tools/run-tsk-epilogue-browser.mjs',
  'src/engine/hub.js',
  'src/engine/dispatch.js',
  'src/engine/tsk-map.js',
  'src/engine/campaign-flow.js',
  'src/campaign/campaign-flow.js',
  'src/campaign/story.js',
  'src/integration/observation.js',
  'src/integration/mechanic-view.js',
  'web/hub.js',
  'web/story-reader.js',
  'content/campaigns/theScarletKeys/flow.js',
  'content/campaigns/theScarletKeys/epilogue.js',
  'content/campaigns/theScarletKeys/interludes.js',
  'content/campaigns/theScarletKeys/manifest.js',
  'content/campaigns/theScarletKeys/parts.js',
  'content/campaigns/theScarletKeys/shared.js',
])

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const toRepoPath = absolute => relative(WORKSPACE, absolute).replace(/\\/g, '/')
const toModPath = absolute => relative(MOD, absolute).replace(/\\/g, '/')
const byText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const annotationValues = (annotations, type) => (annotations || [])
  .filter(annotation => annotation.type === type && annotation.description)
  .map(annotation => String(annotation.description))
const annotationValue = (annotations, type) => annotationValues(annotations, type)[0] || null

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

export default class TskEpilogueBrowserReporter {
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
    this.tests.push({
      file: spec,
      title: test.title,
      status: result.status,
      viewport,
      // 完整 annotation（phase / scenario / claim / debugJump / timeTrace / timeAcceleration /
      // evidence / screenshot …）进账本；截图描述统一转成 repo 根相对路径，账本里不出现本机绝对路径。
      annotations: (test.annotations || []).map(annotation => {
        const description = annotation.description === undefined ? undefined : String(annotation.description)
        const normalized = annotation.type === 'screenshot' && description ? toRepoPath(description) : description
        return { type: annotation.type, ...(normalized === undefined ? {} : { description: normalized }) }
      }),
      phase: annotationValue(test.annotations, 'phase') || PHASE,
      claims: annotationValues(test.annotations, 'claim'),
    })
    for (const absolute of annotationValues(test.annotations, 'screenshot')) {
      this.screenshots.push({
        path: toRepoPath(absolute),
        base: 'repo-root',
        viewport,
        phase: annotationValue(test.annotations, 'phase') || PHASE,
      })
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
    const shotsFor = viewport => screenshots.filter(item => item.viewport === viewport)
    const passedFor = viewport => passed.some(item => item.viewport === viewport)
    const checkFor = (claim, viewport) => passedFor(viewport)
      && passed.some(item => item.viewport === viewport && item.claims.includes(claim))
      && shotsFor(viewport).length >= SHOTS_PER_VIEWPORT

    const checks = Object.fromEntries(CLAIMS.map(claim => [claim,
      Object.fromEntries(VIEWPORTS.map(viewport => [viewport, checkFor(claim, viewport)]))]))
    const checksPassed = Object.values(checks)
      .every(group => Object.values(group).every(value => value === true))
    const shotsOk = screenshots.length >= SHOTS_TOTAL_MIN
      && VIEWPORTS.every(viewport => shotsFor(viewport).length >= SHOTS_PER_VIEWPORT)
      && missingScreenshots.length === 0
    const allPassed = tests.length === EXPECTED_TESTS && passed.length === EXPECTED_TESTS
    const status = result.status === 'passed' && complete && allPassed && checksPassed
      && shotsOk && sourceStableDuringRun ? 'passed' : 'failed'

    const report = {
      schemaVersion: 1,
      generatedBy: 'tools/playwright-tsk-epilogue-reporter.mjs',
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

    const shotCounts = Object.fromEntries(VIEWPORTS.map(viewport => [viewport, shotsFor(viewport).length]))
    console.log(`tsk P8 epilogue browser evidence: ${status} · ${tests.length}/${EXPECTED_TESTS} tests / `
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
