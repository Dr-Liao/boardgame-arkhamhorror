// Playwright 报告器：把《万象无终》规则书浏览器用例的结果写成 audit/tcu-browser-acceptance.json。
//
// 为什么要有它（路线图 §8.3 第 4 条）：TFA 的 audit/tfa-browser-acceptance.json 是手工提交的
// JSON，无法复现；TCU 要求浏览器证据**由 runner 生成**。审计工具（tools/audit-tcu.mjs）只读本文件，
// 缺失即 desktopBrowser/mobileBrowser 为 false，不允许手写补上。
//
// 用法（只挂在 playwright.tcu.config.mjs 上，不影响其他循环的浏览器回归）：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs
//
// 约定：
// - 用例把截图路径写进 annotation（type: 'screenshot'），路径相对**仓库根目录**（artifacts/tcu-migration/…）；
// - 输出刻意不含耗时、时间戳与宿主信息：同一个干净检出跑同一命令应当得到逐字节相同的结论；
// - 只有「该视口有用例通过 + 有截图存在」才把 desktopBrowser / mobileBrowser 记为 true。

import { mkdirSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// tools/ → games/arkhamhorror/；再上两层是仓库根目录（artifacts/ 在这里）。
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const TARGET = fileURLToPath(new URL('../audit/tcu-browser-acceptance.json', import.meta.url))
const SPEC = 'tests/tcu-rules.browser.mjs'
const TCU_SPEC = /tcu-.*\.browser\.mjs$/

const toPackagePath = absolute => relative(PACKAGE_ROOT, absolute).replace(/\\/g, '/')
const toRepoPath = absolute => relative(REPO_ROOT, absolute).replace(/\\/g, '/')
const viewportOf = title => (/mobile/.test(title) ? 'mobile' : 'desktop')

export default class TcuBrowserReporter {
  constructor() {
    this.tests = []
    this.screenshots = []
  }

  onTestEnd(test, result) {
    const file = String(test.location?.file || '').replace(/\\/g, '/')
    if (!TCU_SPEC.test(file)) return
    const viewport = viewportOf(test.title)
    this.tests.push({
      title: test.title,
      spec: toPackagePath(test.location.file),
      file: toPackagePath(test.location.file),
      viewport,
      expectedStatus: test.expectedStatus,
      status: result.status,
      retry: result.retry,
    })
    for (const annotation of test.annotations || []) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      this.screenshots.push({
        name: `${toPackagePath(test.location.file).replace(/^tests\//, '').replace(/\.browser\.mjs$/, '')}-${viewport}`,
        // 截图在仓库根的 artifacts/ 下：账本记仓库相对路径，审计按 repo-root 解析。
        path: toRepoPath(annotation.description),
        base: 'repo-root',
        viewport,
        spec: toPackagePath(test.location.file),
      })
    }
  }

  onEnd(result) {
    const tests = [...this.tests].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
    const screenshots = [...this.screenshots].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    const specs = [...new Set(tests.map(item => item.spec))].sort()
    const ofViewport = viewport => tests.filter(item => item.viewport === viewport)
    const shotsOf = viewport => screenshots.filter(item => item.viewport === viewport)
    const passed = tests.length > 0 && tests.every(item => item.status === 'passed')
    const report = {
      schemaVersion: 1,
      generatedBy: 'playwright + tools/playwright-tcu-reporter.mjs',
      spec: SPEC,
      specs,
      milestone: 'P4/P5',
      campaignId: 'theCircleUndone',
      status: passed && result.status === 'passed' ? 'passed' : 'failed',
      screenshotBase: 'repo-root',
      checks: {
        // 每个视口至少一条用例通过、且留下截图，才算该视口有证据。
        desktopBrowser: passed && ofViewport('desktop').length > 0 && shotsOf('desktop').length > 0,
        mobileBrowser: passed && ofViewport('mobile').length > 0 && shotsOf('mobile').length > 0,
      },
      tests,
      screenshots,
    }
    mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
    writeFileSync(TARGET, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`tcu browser acceptance: audit/tcu-browser-acceptance.json · ${report.status} · `
      + `${tests.length} 条用例 / ${specs.length} 个 spec · 截图 ${screenshots.length} 张（desktop ${report.checks.desktopBrowser} / mobile ${report.checks.mobileBrowser}）`)
  }
}
