// N2/N3 浏览器回归：展示资源与待决选择，不代表完整战役验收。
// 配置和测试产物位于插件目录；使用系统 Edge，不下载额外浏览器。
import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const port = Number(process.env.BOARDGAME_PORT) || 8799
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  testDir: fileURLToPath(new URL('./tests', import.meta.url)),
  outputDir: fileURLToPath(new URL('./test-results', import.meta.url)),
  testMatch: '**/*.browser.mjs',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: 'msedge',
    viewport: { width: 1400, height: 950 },
  },
  webServer: process.env.BOARDGAME_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node server.js',
    cwd: repoRoot,
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { BOARDGAME_PORT: String(port), BOARDGAME_HOST: '127.0.0.1', BOARDGAME_NO_OPEN: '1', DSH_HOME: path.join(repoRoot, 'games/arkhamhorror/test-results/browser-home') },
  },
})
