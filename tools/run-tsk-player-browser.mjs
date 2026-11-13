// 八循环《绯红密钥》（TSK）P6 一般玩家卡浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-tsk-player-browser.mjs
// 进程内大厅（createServer + loadMods），端口 0 由系统分配经 BOARDGAME_PORT 传给 Playwright。
// 测试夹具 tests/tsk-player-fixture.mjs 只在验收进程内通过 createState 包装注入（仅当开局设置带
// `tskPlayerFixture: true`）；其余设置走生产 createState。不写生产注册、不加 HTTP 调试端点。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/tsk')
const HOME = join(RUN, 'browser-home')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'p6'), { recursive: true })

// 夹具为可选：分片尚未全部落盘时浏览器证据只做生产大厅的构筑池检查。
let fixtureModule = null
try {
  fixtureModule = await import('../tests/tsk-player-fixture.mjs')
} catch {
  fixtureModule = null
}
const prefetchedEntries = fixtureModule?.loadPlayerEntries ? await fixtureModule.loadPlayerEntries() : []

const mods = (await loadMods({ userDir: null }))
  .filter(mod => mod.id === 'arkhamhorror')
  .map(mod => ({
    ...mod,
    createState: (settings, players) => settings?.tskPlayerFixture === true && fixtureModule?.tskPlayerFixture
      ? fixtureModule.tskPlayerFixture(prefetchedEntries)
      : mod.createState(settings, players),
  }))
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 TSK P6 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.tsk-p6.config.mjs', ...process.argv.slice(2),
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
