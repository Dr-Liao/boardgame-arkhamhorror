// 七循环《地球边缘》（EotE）P7 战役浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-eote-scenarios-browser.mjs
//
// 与 P6 同款：进程内大厅（createServer + loadMods）+ 真实 HTTP + 真实 web/ 界面；
// 不做任何内容注册/状态注入（P7 要求真实大厅战役路线，不允许章内定向夹具替代）。
// 端口 0 由系统分配经 BOARDGAME_PORT 传给 Playwright；启动前清空浏览器运行目录，
// 避免历史缓存/存档污染大厅开局（与 P5/P6 一致）。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/eote')
const HOME = join(RUN, 'browser-home')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'p7'), { recursive: true })

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 EotE P7 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.eote-p7.config.mjs', ...process.argv.slice(2),
  ], {
    cwd: MOD,
    env: {
      ...process.env,
      BOARDGAME_EXTERNAL_SERVER: '1',
      BOARDGAME_PORT: String(server.address().port),
      DSH_HOME: HOME,
    },
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
