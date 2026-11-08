// 七循环《地球边缘》（EotE）P3 规则书浏览器验收配置（端口 8828）。
//
// 证据命令：node tools/run-eote-browser.mjs（自起大厅 server.js 后用本配置跑 Playwright；
// 此时设置 BOARDGAME_EXTERNAL_SERVER=1，配置里的 webServer 关闭）。
// 单独跑本配置时，webServer 用 tests/playwright/tic-browser-server.mjs：它按 boardgame-mod.json
// 固定加载当前工作树的 arkhamhorror Mod（不让大厅扫描选中同 id 的旧快照），对 TIC/EotE 同样适用。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

const port = 8828
const modRoot = fileURLToPath(new URL('../..', import.meta.url))

export default {
  ...base,
  testMatch: ['**/eote-rules.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/eote/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-eote-reporter.mjs', import.meta.url))]],
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node tests/playwright/tic-browser-server.mjs',
    cwd: modRoot,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...base.webServer?.env,
      BOARDGAME_PORT: String(port),
      BOARDGAME_HOST: '127.0.0.1',
      BOARDGAME_NO_OPEN: '1',
      DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/eote/browser-home', import.meta.url)),
    },
  },
}
