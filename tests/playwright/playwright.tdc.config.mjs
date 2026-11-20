import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.BOARDGAME_PORT) || 8834
const output = new URL('../../../../artifacts/migration/tdc/', import.meta.url)
const url = `http://127.0.0.1:${port}`

export default {
  ...base,
  testMatch: '**/tdc-rules.browser.mjs',
  outputDir: fileURLToPath(new URL('playwright-results/', output)),
  use: { ...base.use, baseURL: url },
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('reports/p3-browser.json', output)) }]],
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node tests/playwright/tic-browser-server.mjs',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: `${url}/index.html`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...base.webServer?.env, BOARDGAME_PORT: String(port),
      DSH_HOME: fileURLToPath(new URL('browser-home', output)) },
  },
}
