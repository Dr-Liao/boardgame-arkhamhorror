import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { contentRegistry } from '../content/registered.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
process.chdir(root)
const output = path.join(root, 'artifacts/p7')
mkdirSync(output, { recursive: true })
process.env.DSH_HOME = path.join(output, 'home-' + Date.now())
process.env.BOARDGAME_NO_OPEN = '1'
process.env.BOARDGAME_PERSIST = '1'
delete process.env.AI_API_KEY
const results = []
// 浏览器套件实测 > 4 分钟；240s 会把 arkham-browser 直接杀掉。默认 15 分钟，可用环境变量覆盖。
const CHILD_TIMEOUT_MS = Number(process.env.P7_TIMEOUT_MS || 900_000)
async function run(name, args, env = {}) {
  console.log('\n[P7] ' + name)
  const started = Date.now()
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let log = '', timedOut = false
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { log += bytes; process.stdout.write(bytes) })
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, CHILD_TIMEOUT_MS)
  let code
  try { [code] = await once(child, 'exit') } finally { clearTimeout(timer) }
  writeFileSync(path.join(output, name + '.log'), log)
  results.push({ name, command: [process.execPath, ...args], exitCode: code, timedOut, elapsedMs: Date.now() - started, ok: code === 0 && !timedOut })
}
const browserOnly = process.argv.includes('--browser-only')
let server
try {
  if (!browserOnly) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    await run('test-hall', pkg.scripts['test:hall'].replace(/^node /, '').split(' '))
    await run('test-arkham', ['--test', 'games/arkhamhorror/tests/node-suite.mjs'])
    for (const [name, file, arg] of [
      // N0 --check intentionally rejects the later N1 catalog. Preserve that negative
      // assertion in audit-resources.test; check frozen source + current catalog separately.
      ['source-audit', 'audit-resources', '--check-source'],
      ['catalog-check', 'import-cards', '--check'], ['presentation-check', 'build-presentation', '--check'],
      ['p6-evidence-check', 'audit-p6', '--check'],
    ]) await run(name, [`games/arkhamhorror/tools/${file}.mjs`, arg])
    await run('image-integrity', ['games/arkhamhorror/tools/fetch-images.mjs', '--verify', '--scope=manifest'])
  }
  // Own the server in this process: no Windows shell/process-tree teardown race.
  const { loadMods } = await import('../../../lib/mods.js')
  const { createServer } = await import('../../../lib/server.js')
  server = createServer({ mods: await loadMods() })
  await server.ready
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', 'games/arkhamhorror/playwright.config.mjs']
  if (process.argv.includes('--p7-only')) args.push('p7-release.browser.mjs')
  if (process.argv.includes('--update-snapshots')) args.push('--update-snapshots')
  await run('arkham-browser', args, { BOARDGAME_EXTERNAL_SERVER: '1', BOARDGAME_PORT: String(server.address().port) })
  if (!process.argv.includes('--p7-only')) await run('hall-browser', ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/hall/playwright.config.mjs'])
} catch (error) {
  results.push({ name: 'runner', ok: false, error: error.stack })
  console.error(error)
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
const passed = name => results.find(r => r.name === name)?.ok ?? null
const ledger = JSON.parse(readFileSync('games/arkhamhorror/audit/p6-behavior-ledger.json', 'utf8'))
const packs = contentRegistry.listPacks().map(pack => ({
  id: pack.id, name: pack.name, dependencies: pack.dependencies, declaredStatus: pack.status,
  cards: pack.cards.length, rulesImplemented: pack.cards.filter(c => c.rulesImplemented).length,
  deckbuilding: pack.cards.filter(c => c.deckbuilding).length,
  blocked: pack.cards.filter(c => c.blockedReason).map(c => ({ code: c.code, reason: c.blockedReason })),
  rulesRegressionPassed: passed('test-arkham'), uiSmokePassed: passed('arkham-browser'),
  evidence: pack.id === 'dunwichSupport' ? ['tests/p6-content.test.mjs', 'tests/p6-content.browser.mjs']
    : ['tests/node-suite.mjs', 'tests/p5-map.browser.mjs', 'tests/p7-release.browser.mjs'],
  equivalenceCertified: false,
}))
const report = { generatedAt: new Date().toISOString(), mode: browserOnly ? 'browser-only' : 'full',
  automationPassed: results.every(r => r.ok), results, packs,
  releaseReady: false, releaseBlockers: [`P6: ${ledger.summary.needsBehaviorReview} cards still need behavioral review`, 'P6: three-scenario full-victory acceptance remains unverified'],
}
writeFileSync(path.join(output, 'release-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log('\n[P7] report: artifacts/p7/release-report.json; automation=' + report.automationPassed + '; releaseReady=' + report.releaseReady)
process.exitCode = report.automationPassed && (!process.argv.includes('--release') || report.releaseReady) ? 0 : 1
