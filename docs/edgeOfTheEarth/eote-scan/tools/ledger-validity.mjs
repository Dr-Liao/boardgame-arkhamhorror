import { readFileSync, existsSync } from 'node:fs'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror/'
const ledger = JSON.parse(readFileSync(`${MODS}audit/eote-all-card-acceptance.json`, 'utf8'))
const testCache = new Map()
const readT = f => { if (!testCache.has(f)) testCache.set(f, existsSync(`${MODS}${f}`) ? readFileSync(`${MODS}${f}`, 'utf8') : ''); return testCache.get(f) }
let withValid = 0
const onlyBad = []
const noEvidence = []
const byPart = {}
for (const r of ledger.records) {
  const ev = r.evidence || []
  if (!ev.length) { noEvidence.push(r.code); continue }
  let valid = false
  for (const e of ev) {
    if (e.file && readT(e.file).includes(r.code)) valid = true
    if (e.kind === 'strong' && e.test && e.test.includes(r.code) && e.titleMatched) valid = true
  }
  if (valid) withValid += 1
  else { onlyBad.push({ code: r.code, partition: r.partition, status: r.status, evidence: ev.map(e => ({ kind: e.kind, file: e.file || null, title: e.test ? e.test.slice(0, 60) : null, titleMatched: e.titleMatched })) }); byPart[r.partition] = (byPart[r.partition] || 0) + 1 }
}
const out = { summary: { records: ledger.records.length, withValid, onlyBad: onlyBad.length, noEvidence: noEvidence.length, onlyBadByPartition: byPart }, onlyBad, noEvidence }
writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/ledger-validity.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.summary, null, 1))
console.log('onlyBad sample:', onlyBad.slice(0, 20).map(x => x.code).join(','))
import { writeFileSync } from 'node:fs'
