import base from './playwright.tdc.config.mjs'
import { fileURLToPath } from 'node:url'

const output = new URL('../../../../artifacts/migration/tdc/p5/', import.meta.url)

export default {
  ...base,
  testMatch: '**/tdc-investigators.browser.mjs',
  workers: 2,
  outputDir: fileURLToPath(new URL('results/', output)),
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('browser.json', output)) }]],
}
