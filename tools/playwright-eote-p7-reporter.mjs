// 七循环《地球边缘》（EotE）P7 战役浏览器验收账本 writer。
//
// 唯一产物：audit/eote-scenarios-browser.json（确定性：无时间戳、无绝对路径；
// tests 按 (spec, title, scenario) 排序、screenshots 去重排序；重复运行只有 durationMs 变化）。
// 由 tests/playwright/playwright.eote-p7.config.mjs 的 reporter 调用。
//
// 口径：
//   · tests[]：每条 Playwright 用例一行；带 `scenario` annotation 的用例按章节拆成多行
//     （scenario 字段 = 章节 id，供逐章审计消费）；
//   · checks.desktop / checks.mobile：该视口有用例通过且至少一张截图真实存在；
//   · checks.scenarios[chapterId]：该章在桌面/移动都有 passed 用例 + 真实截图；
//   · status=passed 需要 Playwright 整体 passed + 全部执行用例 passed + 两视口 checks 全真；
//     有 skipped（未开放）或 failed 一律 status=failed，并在 blocked[] 记录跳过原因。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/eote-scenarios-browser.json')
const SPEC_SUFFIX = 'eote-scenarios.browser.mjs'
const VIEWPORTS = ['desktop', 'mobile']

const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')
const scenarioOf = test => (test.annotations || []).filter(annotation => annotation.type === 'scenario' && annotation.description)
  .map(annotation => annotation.description)
const viewportOf = title => (/mobile/i.test(title) ? 'mobile' : 'desktop')

export default class EoteP7Reporter {
  onBegin() {
    this.entries = []
    this.screenshots = []
  }

  onTestEnd(test, result) {
    const file = specOf(test.location.file)
    if (!file.endsWith(SPEC_SUFFIX)) return
    const viewport = viewportOf(test.title)
    const scenarios = scenarioOf(test)
    this.entries.push({ file, title: test.title, status: result.status, durationMs: Math.round(result.duration || 0),
      viewport, scenarios })
    const annotationShots = (test.annotations || []).filter(annotation => annotation.type === 'screenshot' && annotation.description)
    for (const annotation of annotationShots) this.screenshots.push({ path: relativePath(annotation.description), viewport,
      scenarios })
    if (result.status === 'skipped') this.blocked = [...(this.blocked || []), test.title]
  }

  onEnd(result) {
    const executed = this.entries
    const rows = []
    for (const entry of executed) {
      const base = { file: entry.file, title: entry.title, status: entry.status, durationMs: entry.durationMs,
        viewport: entry.viewport }
      if (entry.scenarios.length) for (const scenario of entry.scenarios) rows.push({ ...base, scenario })
      else rows.push(base)
    }
    const tests = rows.sort((left, right) => byCodePoint(left.file, right.file)
      || byCodePoint(left.title, right.title) || byCodePoint(left.scenario || '', right.scenario || ''))
    const screenshots = [...new Set(this.screenshots.map(item => item.path))].sort(byCodePoint)
    const screenshotsOk = screenshots.length > 0 && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const passed = executed.length > 0 && executed.every(entry => entry.status === 'passed')
    const viewportPassed = viewport => executed.some(entry => entry.viewport === viewport && entry.status === 'passed')
    const viewportShots = viewport => this.screenshots.some(item => item.viewport === viewport && existsSync(join(WORKSPACE, item.path)))
    const scenarioIds = [...new Set(this.screenshots.flatMap(item => item.scenarios))].sort(byCodePoint)
    const checks = {
      desktop: passed && viewportPassed('desktop') && viewportShots('desktop'),
      mobile: passed && viewportPassed('mobile') && viewportShots('mobile'),
      scenarios: Object.fromEntries(scenarioIds.map(scenario => [scenario, {
        desktop: executed.some(entry => entry.viewport === 'desktop' && entry.status === 'passed'
          && entry.scenarios.includes(scenario)) && this.screenshots.some(item => item.viewport === 'desktop'
          && item.scenarios.includes(scenario) && existsSync(join(WORKSPACE, item.path))),
        mobile: executed.some(entry => entry.viewport === 'mobile' && entry.status === 'passed'
          && entry.scenarios.includes(scenario)) && this.screenshots.some(item => item.viewport === 'mobile'
          && item.scenarios.includes(scenario) && existsSync(join(WORKSPACE, item.path))),
      }])),
    }
    const status = result.status === 'passed' && passed && checks.desktop && checks.mobile && screenshotsOk
      ? 'passed' : 'failed'
    const specs = [...new Set(executed.map(entry => entry.file))].sort(byCodePoint)
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-eote-p7-reporter.mjs',
      milestone: 'P7',
      campaignId: 'edgeOfTheEarth',
      status,
      specs,
      tests,
      screenshots,
      checks,
      ...(this.blocked?.length ? { blocked: [...new Set(this.blocked)].sort(byCodePoint) } : {}),
    }, null, 2) + '\n')
    console.log(`eote P7 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} rows, `
      + `${screenshots.length} screenshots, scenarios=${scenarioIds.length}) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = executed.filter(entry => entry.status !== 'passed').map(entry => `${entry.viewport}:${entry.title}:${entry.status}`)
      console.log(`  checks=${JSON.stringify({ desktop: checks.desktop, mobile: checks.mobile })} screenshotsOk=${screenshotsOk} `
        + `failures=${JSON.stringify(failures)}${this.blocked?.length ? ` blocked=${JSON.stringify(this.blocked)}` : ''}`)
    }
  }
}
