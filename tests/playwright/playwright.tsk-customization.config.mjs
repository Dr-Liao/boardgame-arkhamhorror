// 八循环《绯红密钥》（The Scarlet Keys）P8 大厅定制升级卡浏览器验收配置（独立证据链）。
//
// 与 D 的发布链（tests/playwright/playwright.tsk-p8.config.mjs + audit/tsk-release-browser.json）
// 分开：本链只跑 tests/tsk-customization.browser.mjs（2 个视口 = 2 行），账本
// audit/tsk-customization-browser.json（tools/playwright-tsk-customization-reporter.mjs）。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node tools/run-tsk-customization-browser.mjs
//   node tools/run-tsk-customization-browser.mjs -g "desktop"     # 调试：只跑匹配用例
// 大厅由启动器在进程内起好（真实 HTTP + 真实 web/ 界面），因此本配置 webServer: undefined；
// 已有外部大厅时设 BOARDGAME_EXTERNAL_SERVER=1 并给 BOARDGAME_PORT。
//
// 浏览器：沿用 tests/playwright/playwright.config.mjs（channel: 'msedge'，系统 Edge，不下载浏览器）。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

// 本链只跑一个 spec 文件（desktop / mobile 两个用例）。
export const TSK_CUSTOMIZATION_SPECS = Object.freeze([
  'tests/tsk-customization.browser.mjs',
])

export default {
  ...base,
  workers: 1,
  timeout: 480_000,
  testMatch: TSK_CUSTOMIZATION_SPECS.map(file => `**/${file.split('/').at(-1)}`),
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/p8/playwright-results-customization/', import.meta.url)),
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-customization-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P8', campaignId: 'theScarletKeys', phase: 'customization' },
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  // 外部大厅模式：tools/run-tsk-customization-browser.mjs 已按当前工作树起好服务并给出端口。
  webServer: undefined,
}
