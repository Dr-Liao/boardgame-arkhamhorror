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
  // P10（食梦者 M5）：范围账本 + 发布账本，与既有循环同一条门禁。
  { id: 'tdeScope', script: 'tools/scan-tde-scope.mjs', args: ['--check'] },
  { id: 'tdeMigration', script: 'tools/audit-tde.mjs', args: ['--check'] },
  // P8（印斯茅斯暗潮 M5）：范围账本 + 发布账本 + 真实大厅浏览器发布验收，与既有循环同一条门禁。
  { id: 'ticScope', script: 'tools/scan-tic-scope.mjs', args: ['--check'] },
  { id: 'ticMigration', script: 'tools/audit-tic.mjs', args: ['--check'] },
  { id: 'ticRelease', script: 'tools/audit-tic-release.mjs', args: ['--check'] },
  // 注意：七循环 eote 的 P0 范围账本（node tools/scan-eote-scope.mjs --check）本轮先只注册为
  // npm script 与 tests/eote-migration.test.mjs 门禁；audit/baseline.json 是整套发布门禁快照，
  // 当前检出里已有 TDE/TIC/Carcosa 的既有漂移（见 artifacts/migration/eote/reports/baseline.md），
  // 不属于 P0 修复范围。等这些既有漂移收口、重新生成发布基线时，再把 eoteScope 加进本清单。
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
  if (['--write','--check'].includes(process.argv[2])) console.error(`audit ${audit.id}: ${result.status===0 ? 'pass' : 'FAIL'}`)
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
if (['--write','--check'].includes(process.argv[2])) console.error('audit commands complete; running test:fast')
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
  // P10（2026-11-01）：M5 发布前最后一次重采。基线记录「当前检出」的审计/链接/回放/测试事实，
  // 不把历史跨循环账本的既有失败洗白；详见 notes 与 docs/tde-p10-report.md §5。
  milestone: 'P10',
  purpose: '正式发布基线：全部审计与 test:fast 通过，文档链接有效，重放基线与已审阅规则变更一致。',
  audits,
  docLinks,
  goldenReplay,
  tests,
  notes: [
    'audit-resources 用 --check-source：--check 比较的是「当前目录 vs 冻结的 N0」，N1 接管后按设计非零退出。',
    'TFA 账本由 tools/audit-tfa-scenarios.mjs 生成、aggregator 由 tools/audit-tfa.mjs 生成；改章节文件后按顺序 --write 再 --check。',
    '基线依赖本机 参考资源/（TFA/Carcosa/Dunwich 的来源哈希）；缺失时这些审计会失败，属预期。',
    '跨循环规则回归已修复；当前审计与测试必须全部通过，不允许冻结失败作为通过的发布基线。',
  ],
}

const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]
const gatePass = audits.every(item=>item.status===0) && docLinks.broken===0 && tests.status===0 && tests.fail===0

if (mode === '--write') {
  await writeFile(TARGET, serialized)
  console.log(`baseline: ${audits.filter(item => item.status === 0).length}/${audits.length} audits ok; `
    + `docLinks broken=${docLinks.broken}; golden ${goldenReplay.fixtures} 局 / ${goldenReplay.steps} 步 / ${goldenReplay.hashes} 指纹; `
    + `test:fast ${tests.pass}/${tests.tests}`)
  if (!gatePass) process.exitCode=1
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
  if (!gatePass) throw new Error('基线仍有失败：请修复审计、文档链接或测试后重新生成')
  console.log(`baseline: check ok (${audits.filter(item => item.status === 0).length}/${audits.length} audits; `
    + `docLinks broken=${docLinks.broken}; golden ${goldenReplay.steps} 步)`)
} else if (mode === '--summary' || !mode) {
  console.log(serialized)
} else {
  throw new Error('用法：--write | --check | --summary')
}
