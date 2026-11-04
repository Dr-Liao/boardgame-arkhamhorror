import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'
const port = 8827
const modRoot = fileURLToPath(new URL('../..', import.meta.url))
export default {
  ...base,
  // 证据命令一次跑齐两个 spec：
  //   · tic-rules.browser.mjs            → 规则书/卡文直达（coverage 四象限 + links 的唯一来源）；
  //   · tic-chapters-acceptance.browser.mjs → 八章实机路径（逐章 desktop/mobile + 指南/语言/重试/键盘）。
  testMatch: ['**/tic-rules.browser.mjs', '**/tic-chapters-acceptance.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tic/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tic-reporter.mjs', import.meta.url))]],
  // 不用大厅默认的 `node server.js`（会按目录扫描选中同 id/同版本的 games/arkhamhorror-merge 快照）：
  // 用固定加载当前工作树 Mod 的专用服务，保证浏览器验收测的是这份源码。
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node tests/playwright/tic-browser-server.mjs',
    cwd: modRoot,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...base.webServer?.env, BOARDGAME_PORT: String(port), BOARDGAME_HOST: '127.0.0.1', BOARDGAME_NO_OPEN: '1',
      DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/tic/browser-home', import.meta.url)) },
  },
}
