// 《印斯茅斯暗潮》（TIC）P8 发布/联机浏览器验收配置（独立证据链）。
//
// 与 P7 的 tests/playwright/playwright.tic.config.mjs 分开的原因：
//   P7 配置 + tools/playwright-tic-reporter.mjs + tools/run-tic-browser.mjs 都在
//   tools/tic-evidence.mjs#sources 的哈希清单里，改动会同时作废 Node / P4 / P7 等多份账本；
//   P8 发布门禁需要新增 tests/tic-release.browser.mjs（真实大厅，零注入）、
//   tests/tic-progression.browser.mjs（第一章结算→幕间升级→第二章→最终章战役结局）与
//   tests/tic-online.browser.mjs（双真人中转联机），因此单独一条链：
//   · 报告器 tools/playwright-tic-release-reporter.mjs → audit/tic-release-browser.json；
//   · 发布审计 tools/audit-tic-release.mjs → audit/tic-release-acceptance.json；
//   · 一次运行必须跑齐 3 个 spec（报告器 all-or-nothing：缺 spec 只写调试账本）。
//
// 大厅服：固定加载当前工作树 Mod 的 tests/playwright/tic-browser-server.mjs（同 P7 口径，避免
// games/ 快照串台）。DSH_HOME 指向 artifacts/migration/tic/p8/browser-home（无 boardgame.config.json
// → 无模型密钥，AI 席位走大厅既有的合法动作兜底，结果确定且不产生模型调用）。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tic-release.config.mjs
// 已有外部大厅（tools/run-tic-release-browser.mjs）时设 BOARDGAME_EXTERNAL_SERVER=1 并给 BOARDGAME_PORT。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

const DEFAULT_PORT = 8828
const port = Number(process.env.BOARDGAME_PORT) || DEFAULT_PORT
const modRoot = fileURLToPath(new URL('../..', import.meta.url))

// 3 个 spec 显式列出（不用通配）：账本只记录这一条发布链自己的证据。
export const TIC_RELEASE_SPECS = Object.freeze([
  'tests/tic-release.browser.mjs',
  'tests/tic-progression.browser.mjs',
  'tests/tic-online.browser.mjs',
])

export default {
  ...base,
  testMatch: TIC_RELEASE_SPECS.map(file => `**/${file.split('/').at(-1)}`),
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tic/p8/playwright-results/', import.meta.url)),
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tic-release-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P8', campaignId: 'theInnsmouthConspiracy' },
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  // 外部大厅模式：tools/run-tic-release-browser.mjs 已按当前工作树起好服务并给出端口。
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
      DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/tic/p8/browser-home/', import.meta.url)),
    },
  },
}
