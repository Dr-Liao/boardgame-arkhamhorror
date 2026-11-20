import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadModFrom } from '../../../lib/mods.js'
import { createServer } from '../../../lib/server.js'
import { tdcInteractionFixture } from '../tests/tdc-interaction-fixture.mjs'

const dir = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../boardgame-mod.json', import.meta.url), 'utf8'))
const mod = await loadModFrom({ ...manifest, dir, source: 'builtin' })
const server = createServer({ persist: false, mods: [{
  ...mod, createState: (settings, players) => ['act', 'agenda'].includes(settings?.tdcInteractionFixture)
    ? tdcInteractionFixture({ scriptCard: settings.tdcInteractionFixture }) : mod.createState(settings, players),
}] })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const cli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))
  const child = spawn(process.execPath, [cli, 'test', '--config', 'tests/playwright/playwright.tdc-p4.config.mjs', ...process.argv.slice(2)], {
    cwd: dir, env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(server.address().port) },
    windowsHide: true, stdio: 'inherit',
  })
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
