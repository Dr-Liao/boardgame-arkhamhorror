import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))
const specs = process.argv.slice(2).length ? process.argv.slice(2)
  : ['tfa-rules.browser.mjs', 'tfa-scenarios.browser.mjs', 'tfa-agenda-aside.browser.mjs',
    'tfa-relic-attachments.browser.mjs',
    'tfa-release.browser.mjs', 'tfa-online.browser.mjs', 'tfa-supplies.browser.mjs']
const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

try {
  const child = spawn(process.execPath,
    [playwrightCli, 'test', '--config', 'tests/playwright/playwright.tfa.config.mjs', ...specs],
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
