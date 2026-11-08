// 七循环《地球边缘》（EotE）P3 规则书浏览器验收账本 writer。
//
// 唯一产物：audit/eote-browser-acceptance.json（确定性：无时间戳、无绝对路径；tests 按标题排序）。
// 由 tests/playwright/playwright.eote.config.mjs 的 reporter 调用；证据命令 node tools/run-eote-browser.mjs。
//
// 口径：
//   · 语言/视口覆盖与卡文直达、无横向滚动来自 spec 的 annotation（viewport / language / check），
//     标题兜底与 TIC 报告器一致（标题含 desktop/mobile、zh-CN/en、「卡文直达」）；
//   · status=passed 需要：Playwright 整体 passed + 六项 checks 全真 + 截图文件真实存在；
//   · 任一用例失败或截图缺失都写 status=failed（不伪造完成）。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/eote-browser-acceptance.json')
const SPECS = Object.freeze(['eote-rules.browser.mjs'])
const CHECK_KEYS = Object.freeze(['desktop', 'mobile', 'zh', 'en', 'cardLink', 'noHorizontalScroll'])

const annotationsOf = (annotations, type) =>
  (annotations || []).filter(item => item.type === type && item.description).map(item => item.description)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
// 纯代码点比较，避免 ICU 差异影响账本排序。
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

export default class EoteBrowserReporter {
  onBegin() {
    this.entries = []
  }

  onTestEnd(test, result) {
    this.entries.push({
      title: test.title,
      ok: result.status === 'passed',
      durationMs: Math.round(result.duration || 0),
      viewport: annotationsOf(test.annotations, 'viewport')[0]
        || (/mobile/.test(test.title) ? 'mobile' : 'desktop'),
      language: annotationsOf(test.annotations, 'language')[0]
        || (/zh-CN/.test(test.title) ? 'zh-CN' : /(^|\s)en(\s|$)/.test(test.title) ? 'en' : null),
      checks: annotationsOf(test.annotations, 'check'),
      screenshots: annotationsOf(test.annotations, 'screenshot').map(relativePath).sort(byCodePoint),
    })
  }

  onEnd(result) {
    const passed = this.entries.filter(entry => entry.ok)
    const somePassed = predicate => passed.some(predicate)
    const checks = {
      desktop: somePassed(entry => entry.viewport === 'desktop'),
      mobile: somePassed(entry => entry.viewport === 'mobile'),
      zh: somePassed(entry => entry.language === 'zh-CN'),
      en: somePassed(entry => entry.language === 'en'),
      cardLink: somePassed(entry => entry.checks.includes('cardLink')),
      noHorizontalScroll: somePassed(entry => entry.checks.includes('noHorizontalScroll')),
    }
    // 标题兜底（与 TIC 报告器同一判据口径），保证 annotation 缺失时仍能如实聚合。
    if (!checks.zh) checks.zh = somePassed(entry => entry.title.includes('zh-CN'))
    if (!checks.en) checks.en = somePassed(entry => /(^|\s)en(\s|$)/.test(entry.title))
    if (!checks.cardLink) checks.cardLink = somePassed(entry => entry.title.includes('卡文直达'))

    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsOk = screenshots.length > 0
      && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const orderedChecks = Object.fromEntries(CHECK_KEYS.map(key => [key, checks[key] === true]))
    const allChecks = Object.values(orderedChecks).every(Boolean)
    const status = result.status === 'passed' && allChecks && screenshotsOk ? 'passed' : 'failed'

    const ledger = {
      schemaVersion: 1,
      generatedBy: 'tools/playwright-eote-reporter.mjs',
      status,
      specs: [...SPECS],
      tests: [...this.entries]
        .sort((left, right) => byCodePoint(left.title, right.title))
        .map(({ title, ok, durationMs }) => ({ title, ok, durationMs })),
      screenshots,
      checks: orderedChecks,
    }
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
    console.log(`eote browser acceptance: ${status} -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failed = this.entries.filter(entry => !entry.ok).map(entry => entry.title)
      console.log(`  checks=${JSON.stringify(orderedChecks)} screenshots=${screenshots.length} failures=${JSON.stringify(failed)}`)
    }
  }
}
