// 万象无终（TCU）专用浏览器验收配置。
//
// 与 playwright.config.mjs 完全同源（同一台 server、同一套 Edge 通道、同一视口缺省），只额外挂上
// tools/playwright-tcu-reporter.mjs，把 TCU 浏览器用例的结果写成 audit/tcu-browser-acceptance.json。
// 其他循环的浏览器回归仍用 playwright.config.mjs，不受影响。
//
// P10 证据命令（5 个 spec 必须一次跑齐；报告器在 onEnd 一次写文件，分 spec 跑会互相覆盖）：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs \
//     tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs
// 只跑规则书回归时仍可单跑：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs
// 注意本机 npm 被执行策略禁用：用 npx.cmd 或 node node_modules/@playwright/test/cli.js test --config ...
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tcu-reporter.mjs', import.meta.url))

export default {
  ...base,
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P10', campaignId: 'theCircleUndone' },
}
