// 八循环《绯红密钥》（The Scarlet Keys）P8 尾声/通古斯卡终章浏览器验收配置（独立证据链）。
//
// 与 P8 发布门禁的 tests/playwright/playwright.tsk-p8.config.mjs 分开的原因：
//   P8 发布链（发布/逐章推进/联机 3 个 spec）没有走到世界地图时间阈值、被迫启程、终章与尾声；
//   本链只用 tests/tsk-epilogue.browser.mjs（desktop/mobile 2 行）产出
//   audit/tsk-epilogue-browser.json（tools/playwright-tsk-epilogue-reporter.mjs）。
//
// 证据命令（在 games/arkhamhorror 下）：
//   node tools/run-tsk-epilogue-browser.mjs
//   node tools/run-tsk-epilogue-browser.mjs -g "desktop"     # 调试：只跑一个视口
// 已有外部大厅（tools/run-tsk-epilogue-browser.mjs 在进程内起好真实大厅）时设
// BOARDGAME_EXTERNAL_SERVER=1 并给 BOARDGAME_PORT，因此本配置 webServer: undefined。
//
// 浏览器：沿用 tests/playwright/playwright.config.mjs（channel: 'msedge'，系统 Edge，
// 不下载浏览器），只覆盖 workers / timeout / testMatch / reporter / outputDir / baseURL。
import { fileURLToPath } from 'node:url'
import base from './playwright.config.mjs'

// 本链只有一个 spec 文件（2 个视口用例都在里面）。
export const TSK_EPILOGUE_SPECS = Object.freeze([
  'tests/tsk-epilogue.browser.mjs',
])

export default {
  ...base,
  workers: 1,
  timeout: 480_000,
  testMatch: TSK_EPILOGUE_SPECS.map(file => `**/${file.split('/').at(-1)}`),
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tsk/p8/playwright-results-epilogue/', import.meta.url)),
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tsk-epilogue-reporter.mjs', import.meta.url))]],
  metadata: { ...(base.metadata || {}), milestone: 'P8', campaignId: 'theScarletKeys' },
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  // 外部大厅模式：tools/run-tsk-epilogue-browser.mjs 已按当前工作树起好服务并给出端口。
  webServer: undefined,
}
