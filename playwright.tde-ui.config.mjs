// 食梦者（TDE）P5 开局模式面板的浏览器验收配置。
//
// 与 playwright.tde.config.mjs 同源（同一个 server / Edge / 视口），差别只有两点：
//   1. webServer 设置 ARKHAM_BROWSER_DEMO=dualHub，注册一份仅测试可见的「双线演示」战役
//      （content/browser-demo/dualHub.js），这样 parts 面板才有可点入口；
//   2. 报告器写 audit/tde-ui-browser.json，不覆盖 P4 规则书账本。
// 证据命令：
//   node node_modules/@playwright/test/cli.js test --config playwright.tde-ui.config.mjs tde-modes.browser.mjs
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tde-ui-reporter.mjs', import.meta.url))

const webServer = base.webServer
  ? { ...base.webServer, env: { ...base.webServer.env, ARKHAM_BROWSER_DEMO: 'dualHub' } }
  : undefined

export default {
  ...base,
  testMatch: '**/tde-modes.browser.mjs',
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P5', campaignId: 'dualHubDemo' },
  webServer,
}
