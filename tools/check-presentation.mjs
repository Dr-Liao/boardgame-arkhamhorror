// Own the HTTP server so Windows webServer process-tree teardown cannot stall.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const home = fileURLToPath(new URL('../../../artifacts/arkham-polish/browser-home', import.meta.url))
mkdirSync(home, { recursive: true })
process.env.DSH_HOME = home
process.env.BOARDGAME_NO_OPEN = '1'
const { loadMods } = await import('../../../lib/mods.js')
const { createServer } = await import('../../../lib/server.js')
const server = createServer({ mods: await loadMods() })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', 'games/arkhamhorror/playwright.config.mjs', ...process.argv.slice(2)]
  const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true, env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(server.address().port) } })
  const [code] = await once(child, 'exit')
  process.exitCode = code ?? 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
