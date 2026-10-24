import base from './playwright.config.mjs'
import { defineConfig } from '@playwright/test'
const port = Number(process.env.BOARDGAME_PORT) || 18853
export default defineConfig({
  ...base,
  testMatch: ['music-library.browser.mjs', 'music-autoplay.browser.mjs', 'scenario-music.browser.mjs'],
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: { ...base.webServer, command: 'node games/arkhamhorror/tests/music-server.mjs', url: `http://127.0.0.1:${port}/index.html`, env: { ...base.webServer?.env, BOARDGAME_PORT: String(port) } },
})
