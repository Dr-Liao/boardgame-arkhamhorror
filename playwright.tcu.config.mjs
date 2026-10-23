// 万象无终（TCU）专用浏览器验收配置。
//
// 与 playwright.config.mjs 完全同源（同一台 server、同一套 Edge 通道、同一视口缺省），只额外挂上
// tools/playwright-tcu-reporter.mjs，把规则书用例的结果写成 audit/tcu-browser-acceptance.json。
// 其他循环的浏览器回归仍用 playwright.config.mjs，不受影响。
//
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs
//   npm run test:tcu:rules:browser
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tcu-reporter.mjs', import.meta.url))

export default {
  ...base,
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P4', campaignId: 'theCircleUndone' },
}
