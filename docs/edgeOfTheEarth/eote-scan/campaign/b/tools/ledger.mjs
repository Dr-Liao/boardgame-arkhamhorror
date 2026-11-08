import fs from 'node:fs'
const root = 'G:/boardgame-hall-ai/games/arkhamhorror'
const acc = JSON.parse(fs.readFileSync(root + '/audit/eote-all-card-acceptance.json', 'utf8'))
const codes = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scope/shards.json', 'utf8'))['campaign-auditor-b'].codes
const mine = acc.records.filter(r => codes.includes(r.code))
const kinds = {}
let fileOnly = 0
for (const r of mine) {
  for (const e of r.evidence || []) kinds[e.kind] = (kinds[e.kind] || 0) + 1
  const strong = (r.evidence || []).some(e => e.titleMatched && e.ledgerMatched)
  const file = (r.evidence || []).some(e => e.kind === 'file')
  if (!strong && file) fileOnly++
  if (!r.evidence?.length) console.log('NO EVIDENCE', r.code)
}
console.log('evidence kinds', JSON.stringify(kinds))
console.log('file-only evidence cards', fileOnly, 'of', mine.length)
console.log('statuses', JSON.stringify(mine.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m }, {})))
console.log('--- any evidence titleMatched only ---')
for (const r of mine) {
  const t = (r.evidence || []).some(e => e.titleMatched)
  if (t) console.log(r.code, r.status, JSON.stringify(r.evidence))
}
console.log('--- suspicious: evidence files outside fatalMirage test ---')
for (const r of mine) {
  for (const e of r.evidence || []) {
    if (e.file && !e.file.includes('fatalMirage') && !e.file.includes('migration') && !e.file.includes('campaign-flow')) console.log(r.code, JSON.stringify(e))
  }
}
