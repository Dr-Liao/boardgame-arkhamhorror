// 七循环《地球边缘》（EotE）P5 调查员浏览器验收启动器。
//
// 证据命令（在 games/arkhamhorror 执行）：node tools/run-eote-investigators-browser.mjs
// 做法与 tools/run-tic-browser.mjs 一致：自起只服务本次验收的大厅进程（独立端口 8829 /
// 独立 DSH_HOME），等 /index.html 就绪后用 BOARDGAME_EXTERNAL_SERVER=1 跑 Playwright，
// 最后结束服务进程并透传退出码。P5 验收走真实大厅选人/开局，不使用测试夹具。
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// 本文件在 games/arkhamhorror/tools/：向上三级到大厅根目录。
const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/eote')
const PORT = 8829

// 每次验收从**干净**的 DSH_HOME 启动：大厅会校验历史存档的选人/构筑设置，
// 上一次中断的 P5 尝试可能留下「调查员依赖尚未就绪」的会话缓存，污染后续大厅加载。
// 这里只清理本次验收专用运行目录（截图/账本/报告均在 RUN 其它位置，不受影响）。
const HOME = join(RUN, 'browser-home')
rmSync(HOME, { recursive: true, force: true })
mkdirSync(HOME, { recursive: true })
mkdirSync(join(RUN, 'reports'), { recursive: true })
const logPath = join(RUN, 'reports/browser-server-p5.log')
const log = openSync(logPath, 'w')
const env = {
  ...process.env,
  BOARDGAME_PORT: String(PORT),
  BOARDGAME_HOST: '127.0.0.1',
  BOARDGAME_NO_OPEN: '1',
  DSH_HOME: HOME,
}
const server = spawn(process.execPath, ['server.js'], {
  cwd: WORKSPACE,
  env,
  windowsHide: true,
  stdio: ['ignore', log, log],
})

try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode != null) throw new Error('浏览器验收服务器提前退出')
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/index.html`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) { ready = true; break }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  if (!ready) throw new Error(`浏览器验收服务器启动超时（日志：${logPath}）`)

  const child = spawn(process.execPath, [
    join(WORKSPACE, 'node_modules/@playwright/test/cli.js'),
    'test', '--config', 'tests/playwright/playwright.eote-p5.config.mjs', ...process.argv.slice(2),
  ], {
    cwd: MOD,
    env: { ...env, BOARDGAME_EXTERNAL_SERVER: '1' },
    windowsHide: true,
    stdio: 'inherit',
  })
  console.log(`eote P5 browser: hall on http://127.0.0.1:${PORT}`)
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
} finally {
  server.kill()
  closeSync(log)
}
