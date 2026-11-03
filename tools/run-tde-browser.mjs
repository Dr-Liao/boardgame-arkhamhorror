process.env.DSH_HOME = fileURLToPath(new URL('../../../artifacts/tde-browser-home/', import.meta.url))
process.env.ARKHAM_BROWSER_DEMO = 'dualHub'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))
const specs = process.argv.slice(2).length ? process.argv.slice(2) : [
  'tde-rules.browser.mjs','tde-interactions.browser.mjs','tde-scenarios.browser.mjs',
  'tde-dual.browser.mjs','tde-dual-real.browser.mjs','tde-release.browser.mjs','tde-media.browser.mjs','tde-online.browser.mjs',
]
const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

try {
  const child = spawn(process.execPath,
    [playwrightCli, 'test', '--config', 'tests/playwright/playwright.tde.config.mjs', ...specs],
    { cwd: packageRoot, env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1',
      BOARDGAME_PORT: String(server.address().port) }, stdio: 'inherit' })
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
} finally {
  server.stopRelay?.()
  server.online?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
