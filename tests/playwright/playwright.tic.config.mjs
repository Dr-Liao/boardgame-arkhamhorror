import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'
const port = 8827
export default {
  ...base,
  // 证据命令一次跑齐两个 spec：
  //   · tic-rules.browser.mjs            → 规则书/卡文直达（coverage 四象限 + links 的唯一来源）；
  //   · tic-chapters-acceptance.browser.mjs → 八章实机路径（逐章 desktop/mobile + 指南/语言/重试/键盘）。
  testMatch: ['**/tic-rules.browser.mjs', '**/tic-chapters-acceptance.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tic/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tic-reporter.mjs', import.meta.url))]],
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : { ...base.webServer, url: `http://127.0.0.1:${port}/index.html`,
    env: { ...base.webServer?.env, BOARDGAME_PORT: String(port), DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/tic/browser-home', import.meta.url)) } },
}
