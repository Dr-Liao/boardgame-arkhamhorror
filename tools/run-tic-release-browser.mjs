// TIC P8 发布浏览器证据的独立 runner：按当前工作树 Mod 起大厅，再跑 3 个 P8 spec。
//
// 与 tests/playwright/playwright.tic-release.config.mjs 的 webServer 模式等价，区别是这里
// 显式 loadMods({ userDir: null }) 并固定加载 games/arkhamhorror（当前工作树），DSH_HOME 指向
// artifacts/migration/tic/p8/browser-home（没有 boardgame.config.json → 无模型密钥 → AI 席位走
// 大厅既有的合法动作兜底，结果确定）。服务端口用临时端口，通过 BOARDGAME_EXTERNAL_SERVER=1 +
// BOARDGAME_PORT 传给 Playwright，避免与 P7 的 8827 或别的聊天进程抢端口。
//
// 用法（在 games/arkhamhorror 下）：
//   node tools/run-tic-release-browser.mjs                      # 3 个 spec 一次跑齐（写 canonical 账本）
//   node tools/run-tic-release-browser.mjs tic-release.browser.mjs   # 调试：只跑一个 spec（写 debug 账本）
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 必须在动态 import lib/server.js 之前设置：大厅配置按 DSH_HOME 解析，这里给一个空的证据目录。
process.env.DSH_HOME = fileURLToPath(new URL('../../../artifacts/migration/tic/p8/browser-home/', import.meta.url))

const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))
const defaultSpecs = ['tic-release.browser.mjs', 'tic-progression.browser.mjs', 'tic-online.browser.mjs']
const specs = process.argv.slice(2).length ? process.argv.slice(2) : defaultSpecs

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('当前工作树没有可加载的 arkhamhorror Mod')
const server = createServer({ mods, persist: false })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
console.log(`[run-tic-release-browser] hall ${port} · specs: ${specs.join(', ')}`)

try {
  const child = spawn(process.execPath,
    [playwrightCli, 'test', '--config', 'tests/playwright/playwright.tic-release.config.mjs', ...specs],
    {
      cwd: packageRoot,
      env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(port) },
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
