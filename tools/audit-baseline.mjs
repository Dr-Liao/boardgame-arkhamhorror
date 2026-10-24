#!/usr/bin/env node
// P0 基线：把「审计命令全绿 + 文档链接无 404 + golden replay 计数」固化成一份可复算的快照。
//
// 用法：
//   node tools/audit-baseline.mjs --write              重写 audit/baseline.json（含 test:fast）
//   node tools/audit-baseline.mjs --check              重跑全部命令并逐字节比较（P0 门禁）
//   node tools/audit-baseline.mjs --summary            不写文件，打印当前结果
//
// 口径：
// - 只记录可复算的事实：各审计命令的退出码与最后一行、文档链接计数、golden replay 的局数/步数/指纹数；
// - 不写时间戳、Node 版本等易变字段，--check 才能跨天逐字节比较；
// - `--check` 只有在所有命令退出 0、链接无失效、golden 计数与研究基线一致时才通过。

import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const TARGET = new URL('../audit/baseline.json', import.meta.url)

// P0 门禁命令。resources 用 --check-source：--check 是「当前目录 vs 冻结的 N0」，N1 接管后按设计会报警。
const AUDITS = [
  { id: 'tfa', script: 'tools/audit-tfa.mjs', args: ['--check'] },
  { id: 'tfaScenarios', script: 'tools/audit-tfa-scenarios.mjs', args: ['--check'] },
  { id: 'carcosa', script: 'tools/audit-carcosa.mjs', args: ['--check'] },
  { id: 'carcosaScenarios', script: 'tools/audit-carcosa-scenarios.mjs', args: ['--check'] },
  { id: 'carcosaPlayer', script: 'tools/audit-carcosa-player.mjs', args: [] },
  { id: 'carcosaAllCards', script: 'tools/audit-carcosa-all-cards.mjs', args: [] },
  { id: 'dunwich', script: 'tools/audit-dunwich.mjs', args: ['--check'] },
  { id: 'dunwichAcceptance', script: 'tools/audit-dunwich-acceptance.mjs', args: [] },
  { id: 'coreAcceptance', script: 'tools/audit-core-acceptance.mjs', args: ['--check'] },
  { id: 'p6', script: 'tools/audit-p6.mjs', args: ['--check'] },
  { id: 'abilities', script: 'tools/audit-abilities.mjs', args: ['--check'] },
  { id: 'workorder', script: 'tools/audit-workorder.mjs', args: ['--check'] },
  { id: 'deadPrimitives', script: 'tools/audit-dead-primitives.mjs', args: ['--check'] },
  { id: 'resourcesSource', script: 'tools/audit-resources.mjs', args: ['--check-source'] },
  // P1（万象无终 M0）：范围账本 + 迁移账本，与三循环审计同一条门禁。
  { id: 'tcuScope', script: 'tools/scan-tcu-scope.mjs', args: ['--check'] },
  { id: 'tcuMigration', script: 'tools/audit-tcu.mjs', args: ['--check'] },
]

const run = (command, args, { timeout = 600_000 } = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout, shell: false })
  const stdout = (result.stdout || '').trim()
  const stderr = (result.stderr || '').trim()
  const lastLine = (stdout || stderr).split(/\r?\n/).filter(Boolean).pop() || ''
  return { status: result.status, signal: result.signal || null, lastLine: lastLine.slice(0, 400), stdout, stderr }
}

const node = process.execPath
const audits = AUDITS.map(audit => {
  const result = run(node, [audit.script, ...audit.args])
  return {
    id: audit.id,
    command: `node ${audit.script}${audit.args.length ? ` ${audit.args.join(' ')}` : ''}`,
    status: result.status,
    lastLine: result.lastLine,
  }
})

const docResult = run(node, ['tools/check-doc-links.mjs', '--json'])
let docLinks
try {
  const parsed = JSON.parse(docResult.stdout)
  docLinks = { files: parsed.files, links: parsed.links, broken: parsed.broken.length }
} catch {
  docLinks = { files: 0, links: 0, broken: -1, error: docResult.lastLine }
}

const golden = JSON.parse(await readFile(new URL('../tests/fixtures/replay/golden-replays.json', import.meta.url), 'utf8'))
const goldenReplay = {
  fixtures: golden.fixtures.length,
  steps: golden.fixtures.reduce((sum, fixture) => sum + Number(fixture.log?.meta?.moveCount ?? fixture.hashes.length), 0),
  hashes: golden.fixtures.reduce((sum, fixture) => sum + fixture.hashes.length, 0),
  rulesVersion: golden.rulesVersion || null,
  hashVersion: golden.hashVersion || null,
}

// 与 npm run test:fast 同一条命令；直接跑 node 入口，避免 Windows 下 spawn npm.cmd 需要 shell。
// Node 的 node --test 在管道下用 TAP reporter（`# tests N`），在 TTY 下用 spec reporter（`ℹ tests N`）；
// 这里两种都接受，保证 spawnSync 捕获输出时仍能记录真实用例数（否则会记成 -1）。
const testsResult = run(node, ['tools/run-tests.mjs', 'fast'])
const testNumber = label => Number((testsResult.stdout.match(new RegExp(`(?:ℹ|#)\\s*${label}\\s+(\\d+)`)) || [])[1] ?? -1)
const tests = {
  command: 'node tools/run-tests.mjs fast',
  status: testsResult.status,
  tests: testNumber('tests'),
  pass: testNumber('pass'),
  fail: testNumber('fail'),
}

const report = {
  schemaVersion: 1,
  milestone: 'P0',
  purpose: '修基线：TFA/各循环审计命令全绿、文档链接无 404、golden replay 计数与冻结基线一致。',
  audits,
  docLinks,
  goldenReplay,
  tests,
  notes: [
    'audit-resources 用 --check-source：--check 比较的是「当前目录 vs 冻结的 N0」，N1 接管后按设计非零退出。',
    'TFA 账本由 tools/audit-tfa-scenarios.mjs 生成、aggregator 由 tools/audit-tfa.mjs 生成；改章节文件后按顺序 --write 再 --check。',
    '基线依赖本机 参考资源/（TFA/Carcosa/Dunwich 的来源哈希）；缺失时这些审计会失败，属预期。',
  ],
}

const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]

if (mode === '--write') {
  await writeFile(TARGET, serialized)
  console.log(`baseline: ${audits.filter(item => item.status === 0).length}/${audits.length} audits ok; `
    + `docLinks broken=${docLinks.broken}; golden ${goldenReplay.fixtures} 局 / ${goldenReplay.steps} 步 / ${goldenReplay.hashes} 指纹; `
    + `test:fast ${tests.pass}/${tests.tests}`)
} else if (mode === '--check') {
  const current = await readFile(TARGET, 'utf8')
  if (current !== serialized) {
    const previous = JSON.parse(current)
    const diffs = []
    for (const key of ['audits', 'docLinks', 'goldenReplay', 'tests']) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(report[key])) diffs.push(key)
    }
    throw new Error(`P0 基线漂移：${diffs.join(', ') || '未知字段'}；请审阅后 --write`)
  }
  console.log(`baseline: check ok (${audits.filter(item => item.status === 0).length}/${audits.length} audits; `
    + `docLinks broken=${docLinks.broken}; golden ${goldenReplay.steps} 步)`)
} else if (mode === '--summary' || !mode) {
  console.log(serialized)
} else {
  throw new Error('用法：--write | --check | --summary')
}
