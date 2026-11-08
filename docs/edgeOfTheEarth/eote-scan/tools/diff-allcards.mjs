import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const readJson = p => JSON.parse(readFileSync(`${MOD}/${p}`, 'utf8'))
const { buildLedger } = await import(pathToFileURL(`${MOD}/tools/audit-eote-all-cards.mjs`).href)
const ledger = readJson('audit/eote-all-card-acceptance.json')
const snapshot = {
  testFiles: ledger.testRun.testFiles,
  totalPasses: ledger.testRun.totalPasses,
  exitCode: ledger.testRun.exitCode,
  passRecords: ledger.testRun.passRecords,
  failRecords: ledger.testRun.failRecords,
  filesWithPasses: new Set(ledger.testRun.passRecords.map(r => r.file)),
}
const built = buildLedger({ testRun: snapshot })
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v
const a = stable(built); const b = stable(ledger)
const diffs = []
function walk(x, y, path, depth) {
  if (diffs.length > 80) return
  if (typeof x !== typeof y) { diffs.push(`${path}: type ${typeof x} vs ${typeof y}`); return }
  if (x === null || y === null || typeof x !== 'object') { if (x !== y) diffs.push(`${path}: ${JSON.stringify(x)?.slice(0,120)} vs ${JSON.stringify(y)?.slice(0,120)}`); return }
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) diffs.push(`${path}: length ${x.length} vs ${y.length}`)
    const n = Math.max(x.length, y.length)
    for (let i = 0; i < n && diffs.length <= 80; i++) walk(x[i], y[i], `${path}[${i}]`, depth + 1)
    return
  }
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  for (const k of keys) { if (diffs.length > 80) return; if (k === 'records' || k === 'evidence') continue; walk(x[k], y[k], `${path}.${k}`, depth + 1) }
}
// 先比较 gates/summary/sources/testRun 顶层，records 按 code 对齐比较
for (const k of Object.keys(a)) if (k !== 'records') walk(a[k], b[k], k, 0)
const ma = new Map(a.records.map(r => [r.code, r])); const mb = new Map(b.records.map(r => [r.code, r]))
for (const code of new Set([...ma.keys(), ...mb.keys()])) {
  if (diffs.length > 80) break
  walk(ma.get(code), mb.get(code), `records[${code}]`, 0)
}
console.log('diff count (capped):', diffs.length)
console.log(diffs.slice(0, 80).join('\n'))
console.log('\n--- summary built vs ledger ---')
console.log(JSON.stringify(a.summary)); console.log(JSON.stringify(b.summary))
