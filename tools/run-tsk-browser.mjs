// 八循环《绯红密钥》（TSK）P3 规则书浏览器验收启动器。
// 证据命令：node tools/run-tsk-browser.mjs（在 games/arkhamhorror 执行）。
// 做法与 EotE/TIC 一致：自起一个只服务本次验收的大厅进程（独立端口/独立 DSH_HOME），
// 等 /index.html 就绪后以 BOARDGAME_EXTERNAL_SERVER=1 跑 Playwright，最后统一结束服务并透传退出码。
// 账本由 tools/playwright-tsk-reporter.mjs 在 onEnd 写出。
// 注意：npm.ps1 被 PowerShell 执行策略拦截，本脚本全部用 node 直接 spawn，不经过 npm。
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const RUN = join(WORKSPACE, 'artifacts/migration/tsk')
const PORT = 8830

mkdirSync(join(RUN, 'reports/screenshots'), { recursive: true })
mkdirSync(join(RUN, 'browser-home'), { recursive: true })
const logPath = join(RUN, 'reports/tsk-browser-server.log')
const log = openSync(logPath, 'w')
const env = {
  ...process.env,
  BOARDGAME_PORT: String(PORT),
  BOARDGAME_HOST: '127.0.0.1',
  BOARDGAME_NO_OPEN: '1',
  DSH_HOME: join(RUN, 'browser-home'),
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

  const cli = join(WORKSPACE, 'node_modules/@playwright/test/cli.js')
  const child = spawn(process.execPath, [cli, 'test', '--config', 'tests/playwright/playwright.tsk.config.mjs'], {
    cwd: MOD,
    env: { ...env, BOARDGAME_EXTERNAL_SERVER: '1' },
    windowsHide: true,
    stdio: 'inherit',
  })
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', resolve)
  })
  process.exitCode = code ?? 1
} finally {
  server.kill()
  closeSync(log)
}
