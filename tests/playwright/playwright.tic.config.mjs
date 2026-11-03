import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'
const port = 8827
export default {
  ...base, testMatch: '**/tic-rules.browser.mjs',
  outputDir: fileURLToPath(new URL('../../../../artifacts/migration/tic/playwright-results/', import.meta.url)),
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  reporter: [['list'], [fileURLToPath(new URL('../../tools/playwright-tic-reporter.mjs', import.meta.url))]],
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : { ...base.webServer, url: `http://127.0.0.1:${port}/index.html`,
    env: { ...base.webServer?.env, BOARDGAME_PORT: String(port), DSH_HOME: fileURLToPath(new URL('../../../../artifacts/migration/tic/browser-home', import.meta.url)) } },
}
