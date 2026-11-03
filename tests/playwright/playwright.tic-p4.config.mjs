import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'
export default {
  ...base, workers: 1, timeout: 90_000,
  testMatch: ['**/tic-scenario-interactions.browser.mjs', '**/tic-player.browser.mjs', '**/tic-interactions.browser.mjs', '**/tic-investigators.browser.mjs', '**/script-actions-tfa.browser.mjs', '**/scenario-guides.browser.mjs', '**/tic-rules.browser.mjs'],
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tic/p4/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${process.env.BOARDGAME_PORT}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tic-p4-reporter.mjs', import.meta.url))], [fileURLToPath(new URL('../../tools/playwright-tic-reporter.mjs', import.meta.url))]],
  webServer: undefined,
}
