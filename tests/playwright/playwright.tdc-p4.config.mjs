import base from './playwright.config.mjs'
import { fileURLToPath } from 'node:url'

const root = new URL('../../../../artifacts/migration/tdc/p4/', import.meta.url)
export default {
  ...base, testMatch: '**/tdc-interactions.browser.mjs', webServer: undefined,
  use: { ...base.use, actionTimeout: 8000 },
  outputDir: fileURLToPath(new URL('playwright-results/', root)),
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('browser.json', root)) }]],
}
