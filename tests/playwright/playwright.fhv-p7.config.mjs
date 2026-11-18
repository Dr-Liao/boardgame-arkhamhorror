// 九循环《铁杉谷盛宴》（FHV）P7 战役浏览器验收配置。
// 由 tools/run-fhv-scenarios-browser.mjs 在进程内自起大厅服务器后调用；webServer 必须关闭。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 180_000,
  testMatch: ['**/fhv-scenarios.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/fhv/p7/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-fhv-p7-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
