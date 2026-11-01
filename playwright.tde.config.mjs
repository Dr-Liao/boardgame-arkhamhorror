// 《食梦者》（TDE）P9 浏览器验收配置。报告器写 audit/tde-browser-acceptance.json。
//
// 与 playwright.config.mjs 完全同源（同一台 server、同一套 Edge 通道、同一视口缺省），只额外：
//   1. testMatch 覆盖 P9 的 6 个 spec（rules/interactions/scenarios/dual/release/media）；P5 的
//      tde-modes.browser.mjs 归 playwright.tde-ui.config.mjs / audit/tde-ui-browser.json，不在此列；
//   2. webServer 设置 ARKHAM_BROWSER_DEMO=dualHub，注册一份仅测试可见的「双线演示」战役
//      （content/browser-demo/dualHub.js），双线 spec（tde-dual.browser.mjs）才有 parts 面板入口。
//      其它 spec 不依赖它：rules / media 直接读真实数据，scenarios / interactions 由各自 spec
//      在测试进程内注册外壳并用 page.route 注入，release 用 shell 战役 + catalog 注入。
//   3. 报告器在 onEnd 一次写文件，所以分 spec 跑会互相覆盖；证据命令必须 6 个 spec 一次跑齐
//      （见 tools/playwright-tde-reporter.mjs 文件头）。
//
// 只跑规则书回归调试时仍可单跑：
//   node ../../node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs tde-rules.browser.mjs
// 注意本机 npm 被执行策略禁用：直接 node ../../node_modules/@playwright/test/cli.js。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const reporter = fileURLToPath(new URL('./tools/playwright-tde-reporter.mjs', import.meta.url))

// 6 个 spec 显式列出（不用 tde-*.browser.mjs 通配）：P5 的 tde-modes 证据属于另一个 config / 账本，
// 混进来会让 P9 账本出现不属于它的 spec 与截图。
const TDE_SPECS = [
  'tde-rules.browser.mjs',
  'tde-interactions.browser.mjs',
  'tde-scenarios.browser.mjs',
  'tde-dual.browser.mjs',
  'tde-dual-real.browser.mjs',
  'tde-release.browser.mjs',
  'tde-media.browser.mjs',
].map(name => `**/${name}`)

// 双线演示战役只在 server 进程里注册；规则书 / 场景 / 媒体 spec 不依赖它。
const webServer = base.webServer
  ? { ...base.webServer, env: { ...base.webServer.env, ARKHAM_BROWSER_DEMO: 'dualHub' } }
  : undefined

export default {
  ...base,
  testMatch: TDE_SPECS,
  reporter: [['list'], [reporter]],
  metadata: { ...(base.metadata || {}), milestone: 'P9', campaignId: 'theDreamEaters' },
  webServer,
}
