// 七循环《地球边缘》（EotE）P6 一般玩家卡浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-eote-player-browser.mjs
//
// 与 P4 交互验收同款：进程内大厅（createServer + loadMods），把 `createState` 包一层——
// 只有开局设置带 `eotePlayerFixture: true` 时返回 tests/eote-player-fixture.mjs 的测试状态，
// 其余设置走生产 createState（「构筑池开放」用例跑生产大厅）。不写生产注册、不加 HTTP 调试端点。
// 端口 0 由系统分配，经 BOARDGAME_PORT 传给 Playwright 配置；同时清空浏览器运行目录，
// 避免历史缓存/存档污染大厅开局（与 P5 的做法一致）。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { eotePlayerFixture, loadPlayerEntries } from '../tests/eote-player-fixture.mjs'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/eote')
const HOME = join(RUN, 'browser-home')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'p6'), { recursive: true })

// 预加载 wave 条目（仅 import，不注册）：createGameState 仍需自行注册完整 index；
// 夹具在 createGameState 之后才把索引里缺失的条目补注册，避免跳过整份 entries/index。
const prefetchedEntries = await loadPlayerEntries()
const mods = (await loadMods({ userDir: null }))
  .filter(mod => mod.id === 'arkhamhorror')
  .map(mod => ({
    ...mod,
    createState: (settings, players) => settings?.eotePlayerFixture === true
      ? eotePlayerFixture(prefetchedEntries)
      : mod.createState(settings, players),
  }))
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 EotE P6 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url)),
    'test', '--config', 'tests/playwright/playwright.eote-p6.config.mjs', ...process.argv.slice(2),
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
