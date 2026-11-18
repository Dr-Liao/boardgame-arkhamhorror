// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P8 发布浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：
//   node tools/run-fhv-release-browser.mjs                     # 3 个 phase × 桌面/移动一次跑齐
//   node tools/run-fhv-release-browser.mjs -g "P8 release"     # 调试：只跑匹配用例
//
// 与 TSK P8 同款：进程内大厅（createServer + loadMods）+ 真实 HTTP + 真实 web/ 界面；
// 不做任何内容注册/状态注入，全部走生产组合根 content/registered.js 与真实大厅接口。
// 与 TSK P8 的差别：本链允许**真实持久存档**（persist: true，落在 DSH_HOME 下、每次启动清空）。
// 原因是战役（hubFlow）对局的 `lifecycle.manualLoad=true`：大厅刷新后不会自动续玩，玩家必须
// 从「调查准备设置 → 存档管理」读回存档。P8 的断线恢复用例要验证的正是这条真实读档路径。
// DSH_HOME 指向 artifacts/migration/fhv/p8/browser-home（没有 boardgame.config.json →
// 无模型密钥 → AI 席位走大厅既有的合法动作兜底，结果确定且不产生模型调用）。
// 端口 0 由系统分配经 BOARDGAME_PORT 传给 Playwright；启动前清空浏览器运行目录，
// 避免历史缓存/存档污染大厅开局（与 P5/P6/P7 一致）。
// 跑完读 audit/fhv-release-browser.json 并打印摘要；退出码 = Playwright 退出码，
// 但账本不是 passed 时也返回非 0（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/fhv/p8')
const HOME = join(RUN, 'browser-home')
const LEDGER = join(MOD, 'audit/fhv-release-browser.json')

rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'screenshots'), { recursive: true })
mkdirSync(join(RUN, 'playwright-results'), { recursive: true })

// 必须在动态 import lib/server.js 之前设置：大厅配置按 DSH_HOME 解析。
process.env.DSH_HOME = HOME

const { createServer } = await import('../../../lib/server.js')
const { loadMods } = await import('../../../lib/mods.js')

const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url))

// 大厅收尾阶段可能还有后台 AI/中转任务：迟到的 Promise 拒绝只记录，不改变证据结论。
// （证据结论由 Playwright 退出码 + audit/fhv-release-browser.json 的 status 决定。）
process.on('unhandledRejection', reason => {
  console.error('[run-fhv-release-browser] 未处理的 Promise 拒绝（不影响账本判定）：', reason?.stack || reason)
})

const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
if (!mods.length) throw new Error('大厅未加载 arkhamhorror Mod，无法进行 FHV P8 浏览器验收')

const server = createServer({ mods, persist: true })
await server.ready
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const port = server.address().port
console.log(`[run-fhv-release-browser] hall ${port} · spec tests/fhv-release.browser.mjs`)

function readLedger() {
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function printLedgerSummary(ledger) {
  if (!ledger) {
    console.log('[run-fhv-release-browser] 未生成 audit/fhv-release-browser.json（Playwright 可能未跑完）')
    return
  }
  const tests = Array.isArray(ledger.tests) ? ledger.tests : []
  const screenshots = Array.isArray(ledger.screenshots) ? ledger.screenshots : []
  const checks = ledger.checks || {}
  console.log(`[run-fhv-release-browser] ledger: audit/fhv-release-browser.json · status=${ledger.status} · `
    + `tests=${tests.filter(test => test.status === 'passed').length}/${tests.length} passed · `
    + `screenshots=${screenshots.length} · complete=${ledger.complete} · sourceStable=${ledger.sourceStableDuringRun}`)
  console.log(`[run-fhv-release-browser] checks=${JSON.stringify(checks)}`)
  if (ledger.status !== 'passed') {
    console.log(`[run-fhv-release-browser] failed/skipped tests=${JSON.stringify(tests
      .filter(test => test.status !== 'passed')
      .map(test => `${test.viewport}:${test.title}:${test.status}`))}`)
    const blocked = tests.flatMap(test => (test.annotations || [])
      .filter(annotation => annotation.type === 'blocked')
      .map(annotation => `${test.viewport}:${annotation.description}`))
    if (blocked.length) console.log(`[run-fhv-release-browser] blocked=${JSON.stringify(blocked.slice(0, 8))}`)
  }
}

try {
  const child = spawn(process.execPath, [
    playwrightCli, 'test', '--config', 'tests/playwright/playwright.fhv-release.config.mjs', ...process.argv.slice(2),
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
  console.log(`[run-fhv-release-browser] playwright exit code = ${childCode}`)
  const ledger = readLedger()
  printLedgerSummary(ledger)
  // 退出码：Playwright 失败优先；否则账本必须 passed（截图/源码漂移/checks 不全会让 Playwright 仍 0 退出）。
  process.exitCode = childCode !== 0 ? childCode : (ledger?.status === 'passed' ? 0 : 1)
} catch (error) {
  console.error('[run-fhv-release-browser] 启动/运行失败：', error?.stack || error)
  process.exitCode = 1
} finally {
  // 清理失败只记警告：证据结论由 Playwright 退出码 + 账本 status 决定，服务端 socket 清理异常
  // （例如 relay 已随页面关闭）不应把已通过的验收改成失败退出。
  try { server.stopRelay?.() } catch (error) { console.warn('[run-fhv-release-browser] 关闭 relay 警告：', error?.message || error) }
  try { server.online?.close() } catch (error) { console.warn('[run-fhv-release-browser] 关闭联机服务警告：', error?.message || error) }
  try { server.closeAllConnections?.() } catch (error) { console.warn('[run-fhv-release-browser] 断开连接警告：', error?.message || error) }
  try { await new Promise(resolve => server.close(resolve)) } catch (error) {
    console.warn('[run-fhv-release-browser] 清理大厅警告：', error?.message || error)
  }
}
