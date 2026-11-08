// 七循环《地球边缘》（EotE）P6 一般玩家卡浏览器验收配置。
//
// 由 tools/run-eote-player-browser.mjs 在进程内自起大厅服务器后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.eote-p6.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<临时端口>；webServer: undefined。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 90_000,
  testMatch: ['**/eote-player.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/eote/p6/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-eote-p6-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
