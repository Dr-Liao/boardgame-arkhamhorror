import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Each file owns its card-registry test doubles. Keep the same process
// isolation as the fast/slow runners instead of importing every test at once.
const root = fileURLToPath(new URL('../', import.meta.url))
const files = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => /^tcu-.*\.test\.mjs$/.test(name)).sort()
  .map(name => `tests/${name}`)
const env = { ...process.env }
delete env.NODE_TEST_CONTEXT
delete env.NODE_TEST_WORKER_ID
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], {
  cwd: root, env, stdio: 'inherit',
})
if (result.error) console.error(result.error)
process.exitCode = result.status ?? 1
