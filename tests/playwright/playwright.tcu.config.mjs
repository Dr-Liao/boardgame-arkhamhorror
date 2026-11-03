import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.BOARDGAME_PORT) || 8796

export default defineConfig({
  testDir: fileURLToPath(new URL('../../tests', import.meta.url)),
  outputDir: fileURLToPath(new URL('../../test-results/tcu-browser', import.meta.url)),
  testMatch: '**/tcu-*.browser.mjs',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['../../tools/playwright-tcu-reporter.mjs']],
  timeout: 120_000,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'msedge', viewport: { width: 1440, height: 950 } },
  // tools/run-tcu-browser.mjs owns the server lifecycle. Playwright's Windows
  // webServer process-tree shutdown can hang after all tests have completed.
})
