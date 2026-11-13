// 八循环《绯红密钥》（The Scarlet Keys）P8 尾声/通古斯卡终章浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：
//   node tools/run-tsk-epilogue-browser.mjs                    # 2 个 spec（desktop/mobile）一次跑齐
//   node tools/run-tsk-epilogue-browser.mjs -g "desktop"       # 调试：只跑匹配用例
//
// 与 P8 发布启动器同款：进程内真实大厅（createServer + loadMods）+ 真实 HTTP + 真实 web/ 界面；
// 不做任何内容注册/状态注入，全部走生产组合根 content/registered.js 与真实大厅接口。
// DSH_HOME 指向 artifacts/migration/tsk/p8/browser-home-epilogue（没有 boardgame.config.json →
// 无模型密钥 → AI 席位走大厅既有的合法动作兜底，结果确定且不产生模型调用）。
// 端口 0 由系统分配经 BOARDGAME_PORT 传给 Playwright；启动前清空本链自己的浏览器运行目录，
// 避免历史缓存/存档污染大厅开局（与发布链分开，互不覆盖对方的 browser-home）。
// 跑完读 audit/tsk-epilogue-browser.json 并打印摘要；退出码 = Playwright 退出码，
// 但账本不是 passed 时也返回非 0（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/tsk/p8')
const HOME = join(RUN, 'browser-home-epilogue')
const LEDGER = join(MOD, 'audit/tsk-epilogue-browser.json')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'screenshots'), { recursive: true })
mkdirSync(join(RUN, 'playwright-results-epilogue'), { recursive: true })

// 必须在动态 import lib/server.js 之前设置：大厅配置按 DSH_HOME 解析。
process.env.DSH_HOME = HOME

const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 TSK P8 尾声浏览器验收')

const server = createServer({ mods, persist: false })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
console.log(`[run-tsk-epilogue-browser] hall ${port} · spec tests/tsk-epilogue.browser.mjs`)

function readLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function printLedgerSummary(ledger) {
  if (!ledger) {
    console.log('[run-tsk-epilogue-browser] 未生成 audit/tsk-epilogue-browser.json（Playwright 可能未跑完）')
    return
  }
  const tests = Array.isArray(ledger.tests) ? ledger.tests : []
  const screenshots = Array.isArray(ledger.screenshots) ? ledger.screenshots : []
  const checks = ledger.checks || {}
  console.log(`[run-tsk-epilogue-browser] ledger: audit/tsk-epilogue-browser.json · status=${ledger.status} · `
    + `tests=${tests.filter(test => test.status === 'passed').length}/${tests.length} passed · `
    + `screenshots=${screenshots.length} · complete=${ledger.complete} · sourceStable=${ledger.sourceStableDuringRun}`)
  console.log(`[run-tsk-epilogue-browser] checks=${JSON.stringify(checks)}`)
  if (ledger.status !== 'passed') {
    console.log(`[run-tsk-epilogue-browser] failed/skipped tests=${JSON.stringify(tests
      .filter(test => test.status !== 'passed')
      .map(test => `${test.viewport}:${test.title}:${test.status}`))}`)
    console.log(`[run-tsk-epilogue-browser] screenshotsMissing=${JSON.stringify(ledger.screenshotsMissing || [])}`)
    console.log(`[run-tsk-epilogue-browser] sourceDrift=${JSON.stringify(ledger.sourceDrift || [])}`)
  }
}

try {
  const child = spawn(process.execPath, [
    playwrightCli, 'test', '--config', 'tests/playwright/playwright.tsk-epilogue.config.mjs', ...process.argv.slice(2),
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
  console.log(`[run-tsk-epilogue-browser] playwright exit code = ${childCode}`)
  const ledger = readLedger()
  printLedgerSummary(ledger)
  // 退出码：Playwright 失败优先；否则账本必须 passed（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
  process.exitCode = childCode !== 0 ? childCode : (ledger?.status === 'passed' ? 0 : 1)
} catch (error) {
  console.error('[run-tsk-epilogue-browser] 启动/运行失败：', error?.stack || error)
  process.exitCode = 1
} finally {
  try {
    server.stopRelay?.()
    server.online?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  } catch (error) {
    console.error('[run-tsk-epilogue-browser] 清理大厅失败：', error?.stack || error)
    process.exitCode = 1
  }
}
