#!/usr/bin/env node
// 《食梦者》P9.5「双线开闸」验收账本：路线图 §11.2 的双线额外门禁 10 条 + 真实浏览器证据。
//
//   node tools/audit-tde-parallel.mjs --write   实跑 P9.5 测试并写 audit/tde-parallel-acceptance.json
//   node tools/audit-tde-parallel.mjs [--check] 默认：实跑后逐字节比对账本（不一致即失败）
//
// 证据规则（路线图 §11.2 / §13）：
// - 门禁 1–10 的证据只来自 **实跑的测试**：spawnSync 跑 tests/tde-p95-*.test.mjs，用
//   tools/core-test-reporter.mjs 读 test:pass 事件；用例名必须带 `P9.5 G<n> ` 标签，按标签归集。
//   每条门禁至少 1 条通过用例，否则 gate.pass=false。
// - 浏览器证据只读 runner 产物 audit/tde-browser-acceptance.json，要求 tests/tde-dual-real.browser.mjs
//   的桌面/移动用例各至少 1 条通过 + 对应截图 exists；不手写补。
// - 开闸事实源：content/campaigns/theDreamEaters/manifest.js 的 `dualLineGate === 'open'` 与
//   四模式 `flows` 齐备；内容仍 development、未进 registered.js（P10 才可大厅启动）。
// - 输出确定性：不写时间戳/耗时/宿主信息；同一干净检出复跑应逐字节一致。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

import { manifest as tdeCampaign } from '../content/campaigns/theDreamEaters/manifest.js'
import { contentRegistry } from '../content/registered.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LEDGER = path.join(root, game, 'audit/tde-parallel-acceptance.json')
const BROWSER_LEDGER = path.join(root, game, 'audit/tde-browser-acceptance.json')
const BROWSER_SPEC = 'tests/tde-dual-real.browser.mjs'
const TEST_FILES = [
  `${game}/tests/tde-p95-flow.test.mjs`,
  `${game}/tests/tde-p95-interludes.test.mjs`,
  `${game}/tests/tde-p95-matrix.test.mjs`,
  `${game}/tests/tde-p95-parallel-full.test.mjs`,
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

// 10 条门禁（路线图 §11.2「双线额外门禁」原文摘要）。id 与测试名标签 `P9.5 G<n>` 对应。
const GATES = [
  { id: 'G1', title: '双线字段只对 TDE 写入；容器只对 parallel 写入；旧 13 局 baseline 不变' },
  { id: 'G2', title: '4 人 2+2 / 2 人 1+1 / 3 人并行置灰 / pick 2+1 / 缺牌组阻塞' },
  { id: 'G3', title: '16 种先手排列 + 两条真实全流程 + 两次幕间换线' },
  { id: 'G4', title: '双线 records/bag/XP/trauma/victory/story 互不串线；跨线只走 recordInPart/inPart' },
  { id: 'G5', title: 'campaignView/viewEvents 按 part/lane+roomSeat 脱敏；AI 不读非本线信息' },
  { id: 'G6', title: 'schema 迁移对非 TDE no-op；TDE 旧档往返一致；旧 baseline 只 compare' },
  { id: 'G7', title: 'roomSeat↔laneSeat 覆盖 currentSeat/pendingChoice/humanSeats/leadSeat/records/事件/checkpoint' },
  { id: 'G8', title: '顶层 revision 每次提交递增、lane revision 独立；跨线重基、同线 stale 拒绝' },
  { id: 'G9', title: '状态替换/事件 seq/屏障/checkpoint/保存全局串行；单文件存档同内容同字节' },
  { id: 'G10', title: '同 pairId 的封盘+幕间+interludeApplied 只结算一次；重放/读档幂等' },
]

// ---------------------------------------------------------------- 实跑 Node 证据
const home = path.join(root, 'artifacts/tde-p95/audit-home')
fs.mkdirSync(home, { recursive: true })
// node --test 内部再 spawn node --test 时，继承的 NODE_TEST_CONTEXT 会让子进程走测试子进程模式；
// 删除后测试文件在同一个普通子进程里跑，事件流完整。
const testEnv = { ...process.env, DSH_HOME: home }
delete testEnv.NODE_TEST_CONTEXT
const existing = TEST_FILES.filter(file => fs.existsSync(path.join(root, file)))
if (existing.length !== TEST_FILES.length) {
  throw new Error(`P9.5 测试文件缺失：${TEST_FILES.filter(file => !existing.includes(file)).join(', ')}`)
}
const run = spawnSync(process.execPath, [
  '--test',
  `--test-reporter=./${game}/tools/core-test-reporter.mjs`,
  ...TEST_FILES,
], {
  cwd: root,
  env: testEnv,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
fs.mkdirSync(path.dirname(path.join(root, 'artifacts/tde-p95/p95-results.json')), { recursive: true })
fs.writeFileSync(path.join(root, 'artifacts/tde-p95/p95-results.json'), `${JSON.stringify(results, null, 2)}\n`)
if (run.status !== 0 || !results.length || results.some(result =>
  result.type !== 'test:pass' || result.skipped || result.todo)) {
  console.error(results.filter(result => result.type !== 'test:pass' || result.skipped || result.todo), run.stderr)
  process.exit(1)
}
const relativeFile = result => path.relative(root, result.file).replaceAll('\\', '/')
const ranFiles = new Set(results.map(relativeFile))
for (const file of TEST_FILES) if (!ranFiles.has(file)) throw new Error(`测试没有产出用例：${file}`)

const tests = results.map(result => ({
  name: result.name,
  file: relativeFile(result),
}))
// 用例名必须带 `P9.5 G<n>` 或 `P9.5 ` 标签；其余标签视为未归集，直接失败（防止悄悄漏门禁）。
const gateTag = /^P9\.5 G(\d+) /
const gates = GATES.map(gate => {
  const matched = tests.filter(test => gateTag.exec(test.name)?.[1] === gate.id.slice(1))
  return {
    ...gate,
    count: matched.length,
    pass: matched.length > 0,
    tests: matched.map(test => test.name).sort(),
  }
})
const untagged = tests.filter(test => !/^P9\.5 /.test(test.name))
if (untagged.length) throw new Error(`有 P9.5 用例没有统一前缀：${untagged.map(test => test.name).join(' | ')}`)

// ---------------------------------------------------------------- 浏览器证据
const browser = JSON.parse(fs.readFileSync(BROWSER_LEDGER, 'utf8'))
const browserTests = (browser.tests || []).filter(test => test.spec === BROWSER_SPEC)
const browserShots = (browser.screenshots || []).filter(shot => shot.spec === BROWSER_SPEC)
const passedFor = viewport => browserTests.some(test => test.viewport === viewport && test.status === 'passed')
const shotFor = viewport => browserShots.some(shot => shot.viewport === viewport && shot.exists !== false && shot.path)
const browserChecks = {
  specPresent: Array.isArray(browser.specs) && browser.specs.includes(BROWSER_SPEC),
  reportPresent: Boolean(browser),
  passed: browser.status === 'passed',
  desktop: passedFor('desktop') && shotFor('desktop'),
  mobile: passedFor('mobile') && shotFor('mobile'),
  tests: browserTests.length,
  screenshots: browserShots.filter(shot => shot.exists !== false).length,
}
if (!browserChecks.specPresent || !browserChecks.desktop || !browserChecks.mobile) {
  throw new Error(`浏览器证据不齐：${JSON.stringify(browserChecks)}`)
}

// ---------------------------------------------------------------- 开闸事实源
const flows = Object.keys(tdeCampaign.flows || {})
const launch = {
  campaignId: 'theDreamEaters',
  dualLineGate: tdeCampaign.dualLineGate ?? null,
  modes: [...(tdeCampaign.modes || [])],
  flows,
  contentStatus: tdeCampaign.status,
  // P10：真实 TDE 已注册进内容组合根，大厅可启动（P9.5 时只开闸、未注册）。
  registeredInProduction: Boolean(contentRegistry.getCampaign('theDreamEaters')),
}
if (launch.dualLineGate !== 'open') throw new Error('真实 TDE 的 dualLineGate 未打开')
for (const mode of ['singleA', 'singleB', 'pick', 'parallel']) {
  if (!flows.includes(mode)) throw new Error(`manifest.flows 缺少 ${mode}`)
}

// ---------------------------------------------------------------- 账本
const fileHashes = Object.fromEntries(TEST_FILES.map(file => {
  const bytes = fs.readFileSync(path.join(root, file))
  return [file, hash(bytes)]
}))
const report = {
  schemaVersion: 1,
  campaignId: 'theDreamEaters',
  stage: 'P9.5',
  generatedBy: 'tools/audit-tde-parallel.mjs --write',
  status: gates.every(gate => gate.pass) ? 'passed' : 'failed',
  launch,
  summary: {
    gates: gates.length,
    gatesCovered: gates.filter(gate => gate.pass).length,
    tests: tests.length,
    testFiles: TEST_FILES.length,
    browserTests: browserChecks.tests,
    browserScreenshots: browserChecks.screenshots,
    desktopBrowser: browserChecks.desktop,
    mobileBrowser: browserChecks.mobile,
  },
  gates,
  browser: {
    spec: BROWSER_SPEC,
    checks: browserChecks,
    tests: browserTests
      .map(test => ({ name: test.title, viewport: test.viewport, status: test.status }))
      .sort((left, right) => (left.name < right.name ? -1 : 1)),
    screenshots: browserShots
      .map(shot => ({ name: shot.name, path: shot.path, viewport: shot.viewport, exists: shot.exists !== false }))
      .sort((left, right) => (left.path < right.path ? -1 : 1)),
  },
  files: fileHashes,
  // P10 已完成注册与发布账本；本账本只负责双线开闸证据，发布口径见 audit/tde-migration.json。
  remaining: [],
}
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (MODE === 'write') {
  fs.writeFileSync(LEDGER, serialized)
  console.log(`P9.5 parallel ledger written: ${report.summary.gatesCovered}/${report.summary.gates} 门禁、`
    + `${report.summary.tests} 例、浏览器 ${report.summary.browserTests} 例 / ${report.summary.browserScreenshots} 图（desktop+mobile）；`
    + `dualLineGate=${launch.dualLineGate}`)
} else if (MODE === 'check') {
  const current = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : ''
  if (current !== serialized) throw new Error('食梦者 P9.5 账本已漂移：重新 --write 并审阅 diff')
  console.log(`P9.5 parallel ledger OK: ${report.summary.gatesCovered}/${report.summary.gates} 门禁、`
    + `${report.summary.tests} 例、浏览器 ${report.summary.browserTests} 例`)
} else {
  console.log(serialized)
}
