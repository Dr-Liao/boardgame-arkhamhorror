// 七循环《地球边缘》（EotE）P5 调查员浏览器验收账本 writer。
//
// 唯一产物：audit/eote-investigators-browser.json（确定性：无时间戳、无绝对路径；
// tests 按 (file, title) 排序、screenshots 去重排序；重复运行只有 durationMs 变化）。
// 由 tests/playwright/playwright.eote-p5.config.mjs 的 reporter 调用。
//
// checks 口径：
//   · desktop / mobile：该视口下 5 位调查员（08001/08004/08007/08010/08016）的
//     「P5 <viewport> <code> 真实选人构筑与开局」用例全部 passed；
//   · byCode[code]：该调查员在桌面与移动两个视口都 passed；
//   · 截图：至少一张且每个路径真实存在；
//   · status=passed 需要 Playwright 整体 passed + 所有用例 passed + desktop/mobile/byCode 全真 + 截图存在；
//     任一失败都写 status=failed（失败也写账本，不伪造完成）。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/eote-investigators-browser.json')
export const INVESTIGATOR_CODES = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
const VIEWPORTS = Object.freeze(['desktop', 'mobile'])
const SPEC_SUFFIX = 'eote-investigators.browser.mjs'

const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')

export default class EoteP5Reporter {
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
    const eote = this.entries.filter(entry => entry.file.endsWith(SPEC_SUFFIX))
    const passedCase = (viewport, code) => eote.some(entry => entry.status === 'passed'
      && entry.title.startsWith(`P5 ${viewport} ${code} `))
    const desktop = INVESTIGATOR_CODES.every(code => passedCase('desktop', code))
    const mobile = INVESTIGATOR_CODES.every(code => passedCase('mobile', code))
    const byCode = Object.fromEntries(INVESTIGATOR_CODES.map(code => [code,
      VIEWPORTS.every(viewport => passedCase(viewport, code))]))
    const tests = [...this.entries]
      .sort((left, right) => byCodePoint(left.file, right.file) || byCodePoint(left.title, right.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsOk = screenshots.length > 0
      && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const allPassed = this.entries.length > 0 && this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && desktop && mobile
      && Object.values(byCode).every(Boolean) && screenshotsOk ? 'passed' : 'failed'
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-eote-p5-reporter.mjs',
      status,
      specs,
      tests,
      screenshots,
      checks: { desktop, mobile, byCode },
    }, null, 2) + '\n')
    console.log(`eote P5 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => entry.title)
      console.log(`  checks=${JSON.stringify({ desktop, mobile, byCode })} screenshotsOk=${screenshotsOk} failures=${JSON.stringify(failures)}`)
    }
  }
}
