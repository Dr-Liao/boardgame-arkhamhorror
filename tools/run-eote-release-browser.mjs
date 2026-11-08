// 七循环《地球边缘》（EotE）P8 发布浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：
//   node tools/run-eote-release-browser.mjs
//   node tools/run-eote-release-browser.mjs eote-release.browser.mjs   # 调试：单跑一个 spec
//
// 与 TIC P8 同款：进程内大厅（createServer + loadMods）+ 真实 HTTP + 真实 web/ 界面；
// 不做任何内容注册/状态注入，全部走生产组合根 content/registered.js 与真实大厅接口。
// DSH_HOME 指向 artifacts/migration/eote/p8/browser-home（没有 boardgame.config.json →
// 无模型密钥 → AI 席位走大厅既有的合法动作兜底，结果确定且不产生模型调用）。
// 端口 0 由系统分配经 BOARDGAME_PORT 传给 Playwright；启动前清空浏览器运行目录，
// 避免历史缓存/存档污染大厅开局（与 P5/P6/P7 一致）。
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/eote/p8')
const HOME = join(RUN, 'browser-home')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'screenshots'), { recursive: true })
mkdirSync(join(RUN, 'playwright-results'), { recursive: true })

// 必须在动态 import lib/server.js 之前设置：大厅配置按 DSH_HOME 解析。
process.env.DSH_HOME = HOME

const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))
const defaultSpecs = ['eote-release.browser.mjs', 'eote-progression.browser.mjs', 'eote-online.browser.mjs']
const specs = process.argv.slice(2).length ? process.argv.slice(2) : defaultSpecs

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 EotE P8 浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
console.log(`[run-eote-release-browser] hall ${port} · specs: ${specs.join(', ')}`)

try {
  const child = spawn(process.execPath, [
    playwrightCli, 'test', '--config', 'tests/playwright/playwright.eote-p8.config.mjs', ...specs,
  ], {
    cwd: MOD,
    env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(port), DSH_HOME: HOME },
    stdio: 'inherit',
    windowsHide: true,
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
