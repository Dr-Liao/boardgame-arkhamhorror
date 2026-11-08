// 七循环《地球边缘》（EotE）P4 浏览器验收启动器：进程内大厅 + 测试夹具 + Playwright。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-eote-interactions-browser.mjs
//
// 与 TIC P4 同一做法：不经过 npm、不写生产注册、不新增夹具 HTTP 端点；只在本次验收进程内
// 用 `loadMods()` 加载大厅 Mod，并把 `createState` 包一层——当开局设置带
// `eoteInteractionFixture: true` 时返回 tests/eote-interaction-fixture.mjs 的测试状态，
// 其余设置一律走生产 createState（两条通用证据 spec 用的就是生产状态）。
// 服务器监听端口 0（系统分配），通过 BOARDGAME_PORT 传给 Playwright 配置。
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { eoteInteractionFixture } from '../tests/eote-interaction-fixture.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const mods = (await loadMods({ userDir: null }))
  .filter(mod => mod.id === 'arkhamhorror')
  .map(mod => ({
    ...mod,
    createState: (settings, players) => settings?.eoteInteractionFixture === true
      ? eoteInteractionFixture()
      : mod.createState(settings, players),
  }))
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 EotE P4 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.eote-p4.config.mjs', ...process.argv.slice(2),
  ], {
    cwd: root,
    env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(server.address().port) },
    windowsHide: true,
    stdio: 'inherit',
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
