// 八循环《绯红密钥》（TSK）P5 调查员浏览器验收配置。
// 由 tools/run-tsk-investigators-browser.mjs 在进程内自起大厅服务器后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tsk-p5.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<临时端口>；webServer 必须关闭。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 90_000,
  testMatch: ['**/tsk-investigators.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/p5/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-p5-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
