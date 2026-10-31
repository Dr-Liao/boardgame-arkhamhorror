// 《食梦者》规则书浏览器用例。报告器写 audit/tde-browser-acceptance.json。
// 用法见 tools/playwright-tde-reporter.mjs。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tde-reporter.mjs', import.meta.url))

export default {
  ...base,
  testMatch: '**/tde-rules.browser.mjs',
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P4' },
}
