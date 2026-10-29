// Playwright 报告器：把 P5「开局模式面板」浏览器用例写成 audit/tde-ui-browser.json。
//
// 与 tools/playwright-tde-reporter.mjs 分开：那份账本固定给 P4 规则书 4 条用例，
// 这里只记 UI 面板的桌面 1440 / 移动 390 证据，互不覆盖。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const TARGET = fileURLToPath(new URL('../audit/tde-ui-browser.json', import.meta.url))
const SPEC = /tde-modes\.browser\.mjs$/

const toPackagePath = absolute => relative(PACKAGE_ROOT, absolute).replace(/\\/g, '/')
const toRepoPath = absolute => relative(REPO_ROOT, absolute).replace(/\\/g, '/')
const viewportOf = title => (/mobile/.test(title) ? 'mobile' : 'desktop')

export default class TdeUiReporter {
  constructor() {
    this.tests = []
    this.screenshots = []
  }

  onTestEnd(test, result) {
    const file = String(test.location?.file || '').replace(/\\/g, '/')
    if (!SPEC.test(file)) return
    const viewport = viewportOf(test.title)
    this.tests.push({
      title: test.title,
      spec: toPackagePath(test.location.file),
      viewport,
      expectedStatus: test.expectedStatus,
      status: result.status,
    })
    for (const annotation of test.annotations || []) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      const path = toRepoPath(annotation.description)
      this.screenshots.push({
        name: basename(path).replace(/\.png$/, ''),
        path,
        base: 'repo-root',
        viewport,
        exists: existsSync(annotation.description),
      })
    }
  }

  onEnd(result) {
    const tests = [...this.tests].sort((a, b) => (a.title < b.title ? -1 : 1))
    const screenshots = [...this.screenshots].sort((a, b) => (a.path < b.path ? -1 : 1))
    const passed = tests.length > 0 && tests.every(item => item.status === 'passed') && result.status === 'passed'
    const passedFor = viewport => tests.some(item => item.viewport === viewport && item.status === 'passed')
    const shotFor = viewport => screenshots.some(item => item.viewport === viewport && item.exists)
    const report = {
      schemaVersion: 1,
      generatedBy: 'playwright + tools/playwright-tde-ui-reporter.mjs',
      milestone: 'P5',
      campaignId: 'dualHubDemo',
      status: passed ? 'passed' : 'failed',
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
    console.log(`tde ui acceptance: audit/tde-ui-browser.json · ${report.status} · ${tests.length} 条用例 · 截图 ${screenshots.length} 张`)
  }
}
