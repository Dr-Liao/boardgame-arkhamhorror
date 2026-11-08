import { readFileSync, existsSync } from 'node:fs'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const ledger = JSON.parse(readFileSync(`${MODS}/audit/eote-all-card-acceptance.json`, 'utf8'))
const testCache = new Map()
const testText = f => { if (!testCache.has(f)) testCache.set(f, existsSync(`${MODS}/${f}`) ? readFileSync(`${MODS}/${f}`, 'utf8') : ''); return testCache.get(f) }
const rows = []
for (const r of ledger.records) {
  for (const e of r.evidence || []) {
    if (!e.file) continue
    const t = testText(e.file)
    const mentions = t.includes(r.code)
    rows.push({ code: r.code, partition: r.partition, kind: e.kind, file: e.file, chapter: e.chapter || null, ledgerMatched: e.ledgerMatched, titleMatched: e.titleMatched, codeExistsInFile: mentions })
  }
}
const bad = rows.filter(r => !r.codeExistsInFile)
const byFile = {}
for (const r of bad) byFile[r.file] = (byFile[r.file] || 0) + 1
const totalByKind = {}
for (const r of rows) totalByKind[r.kind] = (totalByKind[r.kind] || 0) + 1
const out = {
  generatedAt: new Date().toISOString(),
  summary: { evidenceRows: rows.length, evidenceFilesWithoutCode: bad.length, byKind: totalByKind, byFile },
  samples: bad.slice(0, 40),
}
import { writeFileSync } from 'node:fs'
writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/ledger-evidence-check.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify({ evidenceRows: rows.length, bad: bad.length, byKind: totalByKind, byFile }, null, 1))
