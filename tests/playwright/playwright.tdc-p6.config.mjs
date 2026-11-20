import base from './playwright.tdc.config.mjs'
import { fileURLToPath } from 'node:url'

const output = new URL('../../../../artifacts/migration/tdc/p6/', import.meta.url)

export default {
  ...base,
  testMatch: '**/tdc-player.browser.mjs',
  workers: 2,
  outputDir: fileURLToPath(new URL('results/', output)),
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('browser.json', output)) }]],
}
