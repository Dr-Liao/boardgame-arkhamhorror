// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P8 发布/推进/联机浏览器验收配置（独立证据链）。
//
// 与 P7 的 tests/playwright/playwright.fhv-p7.config.mjs 分开的原因：
//   P7 配置 + tools/playwright-fhv-p7-reporter.mjs + tools/run-fhv-scenarios-browser.mjs
//   是战役章节验收链（audit/fhv-scenarios-browser.json）；P8 发布门禁新增
//   tests/fhv-release.browser.mjs（发布 / 逐章推进 / 联机隐私权限断线 3 个 phase × 桌面/移动），
//   单独一条链，账本 audit/fhv-release-browser.json（tools/playwright-fhv-release-reporter.mjs）。
//
// 证据命令（在 games/arkhamhorror 下，3 个 phase 一次跑齐 6 行）：
//   node tools/run-fhv-release-browser.mjs
//   node tools/run-fhv-release-browser.mjs -g "P8 release desktop"   # 调试：只跑匹配用例
// 已有外部大厅（tools/run-fhv-release-browser.mjs）时设 BOARDGAME_EXTERNAL_SERVER=1 并给
// BOARDGAME_PORT，因此本配置 webServer: undefined；大厅由启动器在进程内起好（真实 HTTP + 真实 web/ 界面）。
//
// 浏览器：沿用 tests/playwright/playwright.config.mjs（channel: 'msedge'，系统 Edge，不下载浏览器），
// 只覆盖 workers / timeout / testMatch / reporter / outputDir / baseURL。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

// P8 只需一个 spec 文件（3 个 phase 的用例都在里面，× 2 视口 = 6 行）。
export const FHV_RELEASE_SPECS = Object.freeze([
  'tests/fhv-release.browser.mjs',
])

export default {
  ...base,
  workers: 1,
  timeout: 240_000,
  testMatch: FHV_RELEASE_SPECS.map(file => `**/${file.split('/').at(-1)}`),
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/fhv/p8/playwright-results/', import.meta.url)),
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-fhv-release-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P8', campaignId: 'theFeastOfHemlockVale' },
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  // 外部大厅模式：tools/run-fhv-release-browser.mjs 已按当前工作树起好服务并给出端口。
  webServer: undefined,
}
