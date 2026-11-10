// 八循环《绯红密钥》（TSK）P5 浏览器验收启动器：进程内大厅 + Playwright。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-tsk-investigators-browser.mjs
// 与 TIC/EotE P5 同一做法：不经过 npm、不写生产注册、不新增夹具端点；6 位调查员在 P5 已开放，
// 因此直接走生产 createState（无夹具注入）。
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const mods = await loadMods({ userDir: null })
if (!mods.some(mod => mod.id === 'arkhamhorror')) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 TSK P5 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.tsk-p5.config.mjs', ...process.argv.slice(2),
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
