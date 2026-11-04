// TIC 浏览器验收专用大厅服务器：**固定加载本目录的 arkhamhorror Mod**。
//
// 为什么要单独起服务：大厅的 `loadMods()` 会扫描 `games/` 下所有带 index.js 的目录，并按
// (version, source) 排序去重；工作区里存在一个同 id、同版本（0.3.7）的 `games/arkhamhorror-merge`
// 副本时，tie-break 会加载到那份快照而不是当前工作树，导致浏览器看到旧的 web/ 资源
// （例如缺失 TIC 提示卡映射的 `web/ui-cards.js`）。本脚本按 tde/tcu 浏览器验收同样口径，
// 用 `loadModFrom()` 显式指定当前工作树目录，保证「测的就是这份源码」。
//
// 只由 `tests/playwright/playwright.tic.config.mjs` 的 webServer 调用；不注册任何内容、不改状态。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadModFrom } from '../../../../lib/mods.js'
import { createServer } from '../../../../lib/server.js'

const MOD_DIR = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../../boardgame-mod.json', import.meta.url), 'utf8'))
const port = Number(process.env.BOARDGAME_PORT) || 8827
const mod = await loadModFrom({
  id: manifest.id,
  version: manifest.version,
  hallApi: manifest.hallApi,
  source: 'builtin',
  dir: MOD_DIR,
})
const server = createServer({ mods: [mod], persist: false })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(port, '127.0.0.1', resolve)
})
console.log(`[tic-browser-server] ${manifest.id}@${manifest.version} (${MOD_DIR}) listening on http://127.0.0.1:${port}`)
const shutdown = () => {
  server.closeAllConnections?.()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1000).unref?.()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
