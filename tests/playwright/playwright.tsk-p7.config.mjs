// 七循环《绯红密钥》（EotE）P7 战役浏览器验收配置。
//
// 由 tools/run-tsk-scenarios-browser.mjs 在进程内自起大厅后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tsk-p7.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<临时端口>；webServer: undefined。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 180_000,
  testMatch: ['**/tsk-scenarios.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/p7/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-p7-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P7', campaignId: 'theScarletKeys' },
  webServer: undefined,
}
