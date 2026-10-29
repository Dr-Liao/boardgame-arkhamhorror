// 食梦者（TDE）专用浏览器验收配置。
//
// 与 playwright.config.mjs 完全同源（同一个 server、同一套 Edge 通道、同一视口默认），只额外挂
// tools/playwright-tde-reporter.mjs，把 TDE 浏览器用例的结果写成 audit/tde-browser-acceptance.json。
// 其他循环的浏览器回归仍用 playwright.config.mjs，不受影响。
//
// P4 证据命令（本 spec 必须一次跑齐；报告器在 onEnd 一次写文件）：
//   node node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs tde-rules.browser.mjs
// 注意本机 npm 可能被执行策略禁用：用 node <仓库根>/node_modules/@playwright/test/cli.js 或 npx.cmd。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tde-reporter.mjs', import.meta.url))

export default {
  ...base,
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P4', campaignId: 'theDreamEaters' },
}
