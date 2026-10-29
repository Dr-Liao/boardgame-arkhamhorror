// Playwright 报告器：把《食梦者》浏览器用例的结果写成 audit/tde-browser-acceptance.json。
//
// 为什么要有它：账本里的 desktopBrowser / mobileBrowser 必须是**跑出来的**，不能手写；
// 审计工具（tools/audit-tde-rules.mjs）只读本文件，缺失即把两项记 false。
//
// 用法（只挂在 playwright.tde.config.mjs 上，不影响其他循环的浏览器回归）：
//   node node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs tde-rules.browser.mjs
//
// 约定：
// - 用例把截图路径写进 annotation（type: 'screenshot'），路径相对**仓库根目录**
//   （artifacts/tde-migration/…）；
// - 输出刻意不含耗时、时间戳与宿主信息：同一个干净检出跑同一命令应当得到逐字节相同的结论；
// - 只有「该视口有用例通过 + 有截图存在」才把 desktopBrowser / mobileBrowser 记为 true。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const TARGET = fileURLToPath(new URL('../audit/tde-browser-acceptance.json', import.meta.url))

const TDE_SPEC = /tde-.*\.browser\.mjs$/
const EVIDENCE_COMMAND = 'node node_modules/@playwright/test/cli.js test '
  + '--config playwright.tde.config.mjs tde-rules.browser.mjs'

const toPackagePath = absolute => relative(PACKAGE_ROOT, absolute).replace(/\\/g, '/')
const toRepoPath = absolute => relative(REPO_ROOT, absolute).replace(/\\/g, '/')
const viewportOf = title => (/mobile/.test(title) ? 'mobile' : 'desktop')
const specOf = test => toPackagePath(test.location.file)
const sorted = (items, key) => [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))

export default class TdeBrowserReporter {
  constructor() {
    this.tests = []
    this.screenshots = []
  }

  onTestEnd(test, result) {
    const file = String(test.location?.file || '').replace(/\\/g, '/')
    if (!TDE_SPEC.test(file)) return
    const viewport = viewportOf(test.title)
    const spec = specOf(test)
    this.tests.push({
      title: test.title,
      spec,
      viewport,
      expectedStatus: test.expectedStatus,
      status: result.status,
      retry: result.retry,
    })
    for (const annotation of test.annotations || []) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      const path = toRepoPath(annotation.description)
      this.screenshots.push({
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        spec,
        exists: existsSync(annotation.description),
      })
    }
  }

  onEnd(result) {
    const tests = sorted(this.tests, item => item.title)
    const screenshots = sorted(this.screenshots, item => item.path)
    const specs = [...new Set(tests.map(item => item.spec))].sort()
    const passed = tests.length > 0 && tests.every(item => item.status === 'passed') && result.status === 'passed'
    const passedFor = viewport => tests.some(item => item.viewport === viewport && item.status === 'passed')
    const shotFor = viewport => screenshots.some(item => item.viewport === viewport && item.exists)
    // 复用历史文件里的其他 spec 会破坏可复现性：只写本次命令的结果。
    let previousSpecs = []
    try {
      previousSpecs = JSON.parse(readFileSync(TARGET, 'utf8')).specs || []
    } catch {
      previousSpecs = []
    }
    const clobbered = previousSpecs.filter(spec => !specs.includes(spec))
    const report = {
      schemaVersion: 1,
      generatedBy: 'playwright + tools/playwright-tde-reporter.mjs',
      milestone: 'P4',
      campaignId: 'theDreamEaters',
      status: passed ? 'passed' : 'failed',
      specs,
      screenshotBase: 'repo-root',
      checks: {
        desktopBrowser: passed && passedFor('desktop') && shotFor('desktop'),
        mobileBrowser: passed && passedFor('mobile') && shotFor('mobile'),
      },
      tests,
      screenshots,
    }
    mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
    writeFileSync(TARGET, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`tde browser acceptance: audit/tde-browser-acceptance.json · ${report.status} · `
      + `${tests.length} 条用例 / ${specs.length} 个 spec · 截图 ${screenshots.length} 张`)
    if (clobbered.length) {
      console.log(`⚠ 本次命令没有覆盖这些历史 spec，其证据已从报告移除：${clobbered.join(', ')}`)
      console.log(`  证据命令固定为：${EVIDENCE_COMMAND}`)
    }
  }
}
