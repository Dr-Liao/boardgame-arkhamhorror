// 测试耗时测量工具：跑一个 tier，按文件输出实测耗时（慢→快）。
//
// 用法：
//   node tools/test-timings.mjs [fast|slow|assets|all] [--json=out.json] [--check] [--top=N] [--serial]
//
// - 默认跑 `fast`。所有档都先把守卫 suite-manifest.test.mjs 一起跑进去（与 run-tests.mjs 一致）。
// - `--json=<path>` 同时写机器可读 JSON（wall、每文件秒数、失败文件），便于跨时间/跨机器对比。
// - `--check`：有用例失败时退出 1（适合 nightly/发布门禁）。
// - `--serial`：串行跑文件（--test-concurrency=1），每文件耗时接近「单文件净耗时」。
//   不加时是并行跑，文件耗时含排队等待：看墙钟用默认模式，看单文件成本用 --serial。
// - `--top=N`：只打印前 N 个最慢文件。
//
// 文件耗时来自 tools/test-timing-reporter.mjs（node:test 的 reporter 事件流）；
// 内置 tap/spec reporter 会拍平文件分组，不能直接用。suites.mjs 已不写死逐文件秒数，
// 重新分层前用本工具重测。
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { FAST_TESTS, SLOW_TESTS, ASSET_TESTS } from '../tests/suites.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const GUARD = 'tests/suite-manifest.test.mjs'
const REPORTER = './tools/test-timing-reporter.mjs'
const TIERS = { fast: FAST_TESTS, slow: SLOW_TESTS, assets: ASSET_TESTS, all: [...FAST_TESTS, ...SLOW_TESTS, ...ASSET_TESTS] }

const argv = process.argv.slice(2)
const tier = argv.find(arg => !arg.startsWith('--') && TIERS[arg]) || 'fast'
const jsonOut = (argv.find(arg => arg.startsWith('--json=')) || '').slice('--json='.length)
const check = argv.includes('--check')
const serial = argv.includes('--serial')
const topArg = argv.find(arg => arg.startsWith('--top='))
const top = topArg ? Number(topArg.slice('--top='.length)) : 0

const files = TIERS[tier].map(file => `tests/${file}`)
const args = ['--test', `--test-reporter=${REPORTER}`, '--test-reporter-destination=stdout']
if (serial) args.push('--test-concurrency=1')
args.push(GUARD, ...files)

const started = Date.now()
const child = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const wallSeconds = (Date.now() - started) / 1000
const stderr = child.stderr || ''
const exit = child.status ?? 1

// 每行形如：FILE_TIMING {"file":"...","durationMs":1234.5,"tests":10,"success":true}
const measured = []
const failed = []
for (const line of (child.stdout || '').split(/\r?\n/)) {
  const match = /^FILE_TIMING (\{.*\})$/.exec(line)
  if (!match) continue
  let record
  try { record = JSON.parse(match[1]) } catch { continue }
  if (!record.file) continue
  const file = record.file.replace(/\\/g, '/').replace(/^.*\/tests\//, '')
  measured.push({ file, seconds: Number((record.durationMs / 1000).toFixed(2)), tests: record.tests })
  if (record.success === false) failed.push(file)
}

const summary = {
  tier,
  serial,
  generatedAt: new Date().toISOString(),
  wallSeconds: Number(wallSeconds.toFixed(2)),
  exit,
  tests: measured.reduce((sum, file) => sum + file.tests, 0),
  failFiles: failed.length,
  files: measured.sort((left, right) => right.seconds - left.seconds),
}
summary.sumFileSeconds = Number(summary.files.reduce((sum, file) => sum + file.seconds, 0).toFixed(2))
summary.parallelism = summary.wallSeconds > 0 ? Number((summary.sumFileSeconds / summary.wallSeconds).toFixed(1)) : null

const rows = top > 0 ? summary.files.slice(0, top) : summary.files
console.log(`\ntier=${tier}${serial ? '（串行）' : ''}  wall=${summary.wallSeconds}s  tests=${summary.tests} failFiles=${summary.failFiles}  exit=${exit}`)
console.log(`文件合计=${summary.sumFileSeconds}s  平均并行度≈${summary.parallelism}x（${summary.files.length} 个文件）\n`)
console.log('   文件                                     实测(s)')
for (const row of rows) console.log(`  ${row.file.padEnd(40)} ${String(row.seconds).padStart(8)}`)
if (failed.length) console.log(`\n失败文件：\n${failed.map(file => '  - ' + file).join('\n')}`)
if (top > 0 && summary.files.length > top) console.log(`\n（只显示前 ${top} 个文件；去掉 --top 看完整列表）`)

if (jsonOut) {
  writeFileSync(path.resolve(root, jsonOut), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nJSON: ${path.resolve(root, jsonOut)}`)
}

if (stderr.trim()) console.error(stderr.trim().split(/\r?\n/).slice(-5).join('\n'))
process.exit(check && (exit !== 0 || summary.failFiles > 0) ? 1 : 0)
