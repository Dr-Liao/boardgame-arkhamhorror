// P0-11 修复证据：R1 直写检测补漏后的逐条命中明细（供 docs/edgeOfTheEarth/eote-scan/verify/audit-fix.md 引用）。
// 只读：imports tools/audit-card-entry-compliance.mjs 的扫描结果，不写账本；--write 只写本目录 JSON 证据。
import fs from 'node:fs'
import { entries, report } from '../../../../tools/audit-card-entry-compliance.mjs'

const before = new Set((process.env.R1_BASELINE || '').split(',').filter(Boolean))
const hits = entries.filter(entry => entry.writes.length > 0)
const newlyDetected = hits.filter(entry => !before.has(entry.code))
const result = {
  summary: report.counts,
  entriesWithWrites: hits.length,
  newlyDetected: newlyDetected.map(entry => ({
    code: entry.code,
    file: entry.file,
    writes: entry.writes,
  })),
}
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('./_r1-detect-probe.json', import.meta.url), JSON.stringify(result, null, 1) + '\n')
}
console.log(JSON.stringify(result, null, 1))
