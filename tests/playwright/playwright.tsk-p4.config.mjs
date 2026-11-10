// 八循环《绯红密钥》（TSK）P4 新增交互浏览器验收配置。
// 由 tools/run-tsk-interactions-browser.mjs 在进程内自起大厅服务器后调用：
//   node node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tsk-p4.config.mjs
// 环境变量 BOARDGAME_EXTERNAL_SERVER=1 + BOARDGAME_PORT=<临时端口>；webServer 必须关闭。
//
// testMatch 同时包含两条通用证据 spec（与 TIC/EotE P4 口径一致）：它们跑在普通大厅状态上，
// 证明新增的 TSK 交互没有破坏既有剧本行动归属（scriptCard）与关卡设置指南；
// TSK 专有交互由 tsk-interactions.browser.mjs 用测试夹具在真实 HTTP/引擎路径上覆盖。
import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

export default {
  ...base,
  workers: 1,
  timeout: 90_000,
  testMatch: ['**/tsk-interactions.browser.mjs', '**/script-actions-tfa.browser.mjs', '**/scenario-guides.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/p4/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-p4-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
