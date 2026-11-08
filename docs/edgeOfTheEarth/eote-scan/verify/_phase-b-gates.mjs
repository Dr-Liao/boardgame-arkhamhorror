// 阶段 B 最终门禁清单：逐条执行并把「命令 → exit code → 摘要」写入同目录 JSON（证据）。
// 用法：node docs/edgeOfTheEarth/eote-scan/verify/_phase-b-gates.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const gates = [
  ['audit-card-entry-compliance --check', 'node tools/audit-card-entry-compliance.mjs --check'],
  ['scan-eote-baseline --check', 'node tools/scan-eote-baseline.mjs --check'],
  ['scan-eote-scope --check', 'node tools/scan-eote-scope.mjs --check'],
  ['scan-eote-mechanisms --check', 'node tools/scan-eote-mechanisms.mjs --check'],
  ['audit-eote-primitives --check', 'node tools/audit-eote-primitives.mjs --check'],
  ['audit-eote-rules --check', 'node tools/audit-eote-rules.mjs --check'],
  ['audit-eote-interactions --check', 'node tools/audit-eote-interactions.mjs --check'],
  ['audit-eote-investigators --check', 'node tools/audit-eote-investigators.mjs --check'],
  ['audit-eote-player --check', 'node tools/audit-eote-player.mjs --check'],
  ['audit-eote-scenarios --check', 'node tools/audit-eote-scenarios.mjs --check'],
  ['audit-eote-all-cards --check', 'node tools/audit-eote-all-cards.mjs --check'],
  ['audit-eote-release --check', 'node tools/audit-eote-release.mjs --check'],
  ['audit-eote --check (migration)', 'node tools/audit-eote.mjs --check'],
  ['node --test eote-all-cards + eote-migration-ledger + eote-migration', 'node --test tests/eote-all-cards.test.mjs tests/eote-migration-ledger.test.mjs tests/eote-migration.test.mjs'],
  ['node --test replay-eote-p8', 'node --test tests/replay-eote-p8.test.mjs'],
]
const results = []
for (const [name, command] of gates) {
  const result = spawnSync(process.execPath, ['-e', 'void 0'], { cwd: MOD }) // placeholder unused
  void result
  const args = command.split(' ').slice(1)
  const run = spawnSync(process.execPath, args, { cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = `${run.stdout || ''}${run.stderr || ''}`.replace(/\r/g, '')
  const lines = output.split('\n').map(line => line.trim()).filter(Boolean)
  results.push({
    gate: name,
    command: `node ${command}`,
    exitCode: run.status,
    status: run.status === 0 ? 'pass' : 'nonzero',
    lastLines: lines.slice(-4),
  })
  console.log(`${run.status === 0 ? 'PASS' : 'NONZERO'}  ${name}  (exit=${run.status})`)
  for (const line of lines.slice(-2)) console.log(`        ${line}`)
}
const summary = {
  generatedBy: 'docs/edgeOfTheEarth/eote-scan/verify/_phase-b-gates.mjs',
  note: '阶段 B（P0-11 修复后）最终门禁实测。exit!=0 均为诚实状态：all-cards/release/migration 的账本与生成器逐字节一致（--check 打印「账本一致/复算一致」），仅因重建后的真实缺口 allCards(missing/blocked) 导致 gate/status 非 verified/failed；不得用假证据转绿。',
  results,
  counts: {
    total: results.length,
    pass: results.filter(result => result.exitCode === 0).length,
    nonzero: results.filter(result => result.exitCode !== 0).length,
  },
}
fs.writeFileSync(new URL('./_phase-b-gates.json', import.meta.url), JSON.stringify(summary, null, 1) + '\n')
console.log(JSON.stringify(summary.counts))
