// 九循环《铁杉谷盛宴》（FHV）P5 调查员浏览器验收配置。
// 由 tools/run-fhv-investigators-browser.mjs 在进程内自起大厅服务器后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.fhv-p5.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<临时端口>；webServer 必须关闭。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 90_000,
  testMatch: ['**/fhv-investigators.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/fhv/p5/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-fhv-p5-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
