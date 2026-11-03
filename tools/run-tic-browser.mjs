// Supervise our own server so the browser runner never shares another chat's test-results or home.
import { spawn } from 'node:child_process'
import { openSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { MOD, WORKSPACE, RUN } from './tic-migration-lib.mjs'
const port = 8827
const log = openSync(join(RUN, 'reports/browser-server.log'), 'w')
const env = { ...process.env, BOARDGAME_PORT: String(port), BOARDGAME_HOST: '127.0.0.1', BOARDGAME_NO_OPEN: '1', DSH_HOME: join(RUN, 'browser-home') }
const server = spawn(process.execPath, ['server.js'], { cwd: WORKSPACE, env, windowsHide: true, stdio: ['ignore', log, log] })
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode != null) throw new Error('浏览器验收服务器提前退出')
    try { const response = await fetch(`http://127.0.0.1:${port}/index.html`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  if (!ready) throw new Error('浏览器验收服务器启动超时')
  const child = spawn(process.execPath, [join(WORKSPACE, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'tests/playwright/playwright.tic.config.mjs'], {
    cwd: MOD, env: { ...env, BOARDGAME_EXTERNAL_SERVER: '1' }, windowsHide: true, stdio: 'inherit',
  })
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
  process.exitCode = code ?? 1
} finally { server.kill(); closeSync(log) }
