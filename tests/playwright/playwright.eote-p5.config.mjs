// 七循环《地球边缘》（EotE）P5 调查员浏览器验收配置。
//
// 由 tools/run-eote-investigators-browser.mjs 启动大厅服务后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.eote-p5.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<端口>；配置自身不启服务（webServer: undefined）。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 90_000,
  testMatch: ['**/eote-investigators.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/eote/p5/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-eote-p5-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
