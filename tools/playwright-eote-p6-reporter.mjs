// 七循环《地球边缘》（EotE）P6 一般玩家卡浏览器验收账本 writer。
//
// 唯一产物：audit/eote-player-browser.json（确定性：无时间戳、无绝对路径；
// tests 按 (file,title) 排序、screenshots 去重排序；重复运行只有 durationMs 变化）。
// 由 tests/playwright/playwright.eote-p6.config.mjs 的 reporter 调用。
//
// checks 口径：desktop/mobile 各自要求该视口下全部 `P6 <viewport> …` 用例 passed；
// status=passed 需要 Playwright 整体 passed + 全部用例 passed + 两视口全真 + 截图存在。
// 任一失败都写 status=failed（失败也写账本，不伪造完成）。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/eote-player-browser.json')
const SPEC_SUFFIX = 'eote-player.browser.mjs'

const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')

export default class EoteP6Reporter {
  onBegin() {
    this.entries = []
  }

  onTestEnd(test, result) {
    this.entries.push({
      file: specOf(test.location.file),
      title: test.title,
      status: result.status,
      durationMs: Math.round(result.duration || 0),
      screenshots: (test.annotations || []).filter(item => item.type === 'screenshot' && item.description)
        .map(item => relativePath(item.description)).sort(byCodePoint),
    })
  }

  onEnd(result) {
    const specEntries = this.entries.filter(entry => entry.file.endsWith(SPEC_SUFFIX))
    const viewportPassed = viewport => specEntries.length > 0
      && specEntries.filter(entry => entry.title.startsWith(`P6 ${viewport} `)).length > 0
      && specEntries.filter(entry => entry.title.startsWith(`P6 ${viewport} `)).every(entry => entry.status === 'passed')
    const checks = { desktop: viewportPassed('desktop'), mobile: viewportPassed('mobile') }
    const tests = [...this.entries]
      .sort((left, right) => byCodePoint(left.file, right.file) || byCodePoint(left.title, right.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsOk = screenshots.length > 0
      && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const allPassed = this.entries.length > 0 && this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && checks.desktop && checks.mobile && screenshotsOk
      ? 'passed' : 'failed'
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-eote-p6-reporter.mjs',
      status,
      specs,
      tests,
      screenshots,
      checks,
    }, null, 2) + '\n')
    console.log(`eote P6 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => entry.title)
      console.log(`  checks=${JSON.stringify(checks)} screenshotsOk=${screenshotsOk} failures=${JSON.stringify(failures)}`)
    }
  }
}
