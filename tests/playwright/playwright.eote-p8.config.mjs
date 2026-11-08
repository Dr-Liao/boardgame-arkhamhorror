// 《地球边缘》（EotE）P8 发布/推进/联机浏览器验收配置（独立证据链）。
//
// 与 P7 的 tests/playwright/playwright.eote-p7.config.mjs 分开的原因：
//   P7 配置 + tools/playwright-eote-p7-reporter.mjs + tools/run-eote-scenarios-browser.mjs
//   是战役章节验收链；P8 发布门禁新增 3 个 spec（真实大厅 release / 逐章推进 progression /
//   双真人中转联机 online），单独一条链，账本 audit/eote-release-browser.json。
//
// 证据命令（在 games/arkhamhorror 下，一条命令跑齐 3 个 spec）：
//   node tools/run-eote-release-browser.mjs
// runner 在进程内起大厅（真实 HTTP + 真实 web/ 界面），把临时端口经 BOARDGAME_PORT +
// BOARDGAME_EXTERNAL_SERVER=1 传给 Playwright；本配置因此 webServer: undefined。
// 单跑某 spec 调试可追加参数（例如 node tools/run-eote-release-browser.mjs eote-release.browser.mjs），
// 但 canonical 账本只认一次跑齐 3 个 spec 的完整结果（报告器 all-or-nothing 判定 complete）。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const DEFAULT_PORT = 8831
const port = Number(process.env.BOARDGAME_PORT) || DEFAULT_PORT

// 3 个 spec 显式列出（不用通配）：账本只记录这一条发布链自己的证据。
export const EOTE_RELEASE_SPECS = Object.freeze([
  'tests/eote-release.browser.mjs',
  'tests/eote-progression.browser.mjs',
  'tests/eote-online.browser.mjs',
])

export default {
  ...base,
  testMatch: EOTE_RELEASE_SPECS.map(file => `**/${file.split('/').at(-1)}`),
  workers: 1,
  timeout: 300_000,
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/eote/p8/playwright-results/', import.meta.url)),
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-eote-release-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P8', campaignId: 'edgeOfTheEarth' },
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: undefined,
}
