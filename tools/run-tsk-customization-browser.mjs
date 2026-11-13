// 八循环《绯红密钥》（The Scarlet Keys）P8「大厅定制升级卡」浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：
//   node tools/run-tsk-customization-browser.mjs                 # desktop / mobile 两个 spec 一次跑齐
//   node tools/run-tsk-customization-browser.mjs -g "desktop"    # 调试：只跑匹配用例
//
// 与 P8 发布启动器同款：进程内大厅（createServer + loadMods）+ 真实 HTTP + 真实 web/ 界面；
// 不做任何内容注册/状态注入，全部走生产组合根 content/registered.js 与真实大厅接口。
// 独立运行目录/端口（HOME=artifacts/migration/tsk/p8/browser-home-customization）；
// 与 P8 发布链一致关闭落盘存档（persist:false，运行目录每次清空），
// 截图仍写 artifacts/migration/tsk/p8/screenshots/（custom-* 前缀，不覆盖既有发布截图）。
// 跑完读 audit/tsk-customization-browser.json 并打印摘要；退出码 = Playwright 退出码，
// 但账本不是 passed 时也返回非 0（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/tsk/p8')
const HOME = join(RUN, 'browser-home-customization')
const LEDGER = join(MOD, 'audit/tsk-customization-browser.json')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'screenshots'), { recursive: true })
mkdirSync(join(RUN, 'playwright-results-customization'), { recursive: true })

// 必须在动态 import lib/server.js 之前设置：大厅配置按 DSH_HOME 解析。
process.env.DSH_HOME = HOME

const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))

// 大厅收尾阶段可能还有后台任务：迟到的 Promise 拒绝只记录，不改变证据结论。
// （证据结论由 Playwright 退出码 + audit/tsk-customization-browser.json 的 status 决定。）
process.on('unhandledRejection', reason => {
  console.error('[run-tsk-customization-browser] 未处理的 Promise 拒绝（不影响账本判定）：', reason?.stack || reason)
})

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 TSK 定制卡浏览器验收')

// 与 P8 发布链同款：关闭落盘存档（证据只看内存会话 + 真实刷新），运行目录每次清空。
const server = createServer({ mods, persist: false })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
console.log(`[run-tsk-customization-browser] hall ${port} · spec tests/tsk-customization.browser.mjs`)

function readLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function printLedgerSummary(ledger) {
  if (!ledger) {
    console.log('[run-tsk-customization-browser] 未生成 audit/tsk-customization-browser.json（Playwright 可能未跑完）')
    return
  }
  const tests = Array.isArray(ledger.tests) ? ledger.tests : []
  const screenshots = Array.isArray(ledger.screenshots) ? ledger.screenshots : []
  console.log(`[run-tsk-customization-browser] ledger: audit/tsk-customization-browser.json · status=${ledger.status} · `
    + `tests=${tests.filter(test => test.status === 'passed').length}/${tests.length} passed · `
    + `screenshots=${screenshots.length} · complete=${ledger.complete} · sourceStable=${ledger.sourceStableDuringRun}`)
  console.log(`[run-tsk-customization-browser] checks=${JSON.stringify(ledger.checks)}`)
  if (ledger.status !== 'passed') {
    console.log(`[run-tsk-customization-browser] failed/skipped tests=${JSON.stringify(tests
      .filter(test => test.status !== 'passed')
      .map(test => `${test.viewport}:${test.title}:${test.status}`))}`)
  }
}

try {
  const child = spawn(process.execPath, [
    playwrightCli, 'test', '--config', 'tests/playwright/playwright.tsk-customization.config.mjs', ...process.argv.slice(2),
  ], {
    cwd: MOD,
    env: { ...process.env, BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(port), DSH_HOME: HOME },
    stdio: 'inherit',
    windowsHide: true,
  })
  const childCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
  console.log(`[run-tsk-customization-browser] playwright exit code = ${childCode}`)
  const ledger = readLedger()
  printLedgerSummary(ledger)
  // 退出码：Playwright 失败优先；否则账本必须 passed（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
  process.exitCode = childCode !== 0 ? childCode : (ledger?.status === 'passed' ? 0 : 1)
} catch (error) {
  console.error('[run-tsk-customization-browser] 启动/运行失败：', error?.stack || error)
  process.exitCode = 1
} finally {
  try {
    server.stopRelay?.()
    server.online?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  } catch (error) {
    console.error('[run-tsk-customization-browser] 清理大厅失败：', error?.stack || error)
    process.exitCode = 1
  }
}
