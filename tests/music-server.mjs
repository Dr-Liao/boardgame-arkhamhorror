// Bind the exact checkout under test; sibling audit copies may share its Mod id/version.
import { fileURLToPath } from 'node:url'
import { loadModFrom } from '../../../lib/mods.js'
import { createServer } from '../../../lib/server.js'
const mod = await loadModFrom({ id: 'arkhamhorror', dir: fileURLToPath(new URL('../', import.meta.url)), version: '0.2.3', source: 'builtin', hallApi: 1 })
const server = createServer({ mods: [mod], persist: false })
server.listen(Number(process.env.BOARDGAME_PORT) || 18853, '127.0.0.1')
const close = () => { server.closeAllConnections(); server.close(() => process.exit(0)) }
process.on('SIGTERM', close)
process.on('SIGINT', close)
