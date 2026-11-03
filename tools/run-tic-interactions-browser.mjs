// A real hall/HTTP/engine path with test-only state seeding. No fixture endpoint or production registration.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { interactionFixture, dexterFixture } from '../tests/tic-interaction-fixture.mjs'
import { playerFixture } from '../tests/tic-player-fixture.mjs'
import { scenarioInteractionFixture } from '../tests/tic-scenario-fixture.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror').map(mod => ({
  ...mod, createState: (settings, players) => settings.ticInteractionFixture === true ? interactionFixture()
    : settings.ticDexterFixture === true ? dexterFixture()
    : settings.ticPlayerFixture ? playerFixture(settings.ticPlayerFixture)
    : settings.ticScenarioFixture ? scenarioInteractionFixture() : mod.createState(settings, players),
}))
const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.tic-p4.config.mjs', ...process.argv.slice(2)], {
    cwd: root, env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(server.address().port) }, windowsHide: true, stdio: 'inherit',
  })
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)) })
} finally {
  server.stopRelay?.(); server.online?.close(); server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
