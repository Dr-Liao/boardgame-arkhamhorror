// P0-11 修复证据（阶段 A）：用「账本内已有的实跑快照」复算 all-cards，不改测试、不写账本。
// 目的：验证修好生成器后，现状（未重建、未补测试）账本会如实暴露 missing/blocked 与证据口径变化。
// 用法：node docs/edgeOfTheEarth/eote-scan/verify/_allcards-fix-probe.mjs
import fs from 'node:fs'
import { buildLedger } from '../../../../tools/audit-eote-all-cards.mjs'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const readJson = path => JSON.parse(fs.readFileSync(`${MOD}/${path}`, 'utf8'))
const ledger = readJson('audit/eote-all-card-acceptance.json')
const snapshot = {
  testFiles: ledger.testRun.testFiles,
  totalPasses: ledger.testRun.totalPasses,
  exitCode: ledger.testRun.exitCode,
  passRecords: ledger.testRun.passRecords,
  failRecords: ledger.testRun.failRecords,
  filesWithPasses: new Set(ledger.testRun.passRecords.map(record => record.file)),
}
const built = buildLedger({ testRun: snapshot })
const changes = []
for (const record of built.records) {
  const before = ledger.records.find(item => item.code === record.code)
  if (before?.status !== record.status) {
    changes.push({ code: record.code, partition: record.partition, before: before?.status ?? null, after: record.status,
      beforeKind: before?.evidence?.[0]?.kind ?? null, afterKind: record.evidence[0]?.kind ?? null })
  }
}
const kindCount = built.records.reduce((map, record) => {
  const kind = record.evidence[0]?.kind ?? 'none'
  map[kind] = (map[kind] || 0) + 1
  return map
}, {})
const statusChanges = changes.reduce((map, item) => {
  const key = `${item.before}->${item.after}`
  map[key] = (map[key] || 0) + 1
  return map
}, {})
const result = {
  ledgerSummaryBefore: ledger.summary,
  builtSummary: {
    status: built.status,
    gates: built.gates,
    summary: { ...built.summary, pendingBehaviorRequests: built.summary.pendingBehaviorRequests },
    evidenceKindFirstChoice: kindCount,
  },
  statusChanges,
  changedRecords: changes,
}
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('./_allcards-fix-probe.json', import.meta.url), JSON.stringify(result, null, 1) + '\n')
}
console.log(JSON.stringify(result, null, 1))
