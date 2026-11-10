// 八循环《绯红密钥》（TSK）P3 规则书浏览器验收配置（端口 8830）。
// 证据命令：node tools/run-tsk-browser.mjs（自起大厅 server.js 后以本配置跑 Playwright；
// 此时设置 BOARDGAME_EXTERNAL_SERVER=1，配置里的 webServer 关闭）。
// 单独跑本配置时，webServer 由 tests/playwright/tic-browser-server.mjs 提供：它按 boardgame-mod.json
// 固定加载当前工作树的 arkhamhorror Mod（不让大厅扫描选中旧 id 的旧快照）。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

const port = 8830
const modRoot = fileURLToPath(new URL('../..', import.meta.url))

export default {
  ...base,
  testMatch: ['**/tsk-rules.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-reporter.mjs', import.meta.url))]],
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
      DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/tsk/browser-home', import.meta.url)),
    },
  },
}
