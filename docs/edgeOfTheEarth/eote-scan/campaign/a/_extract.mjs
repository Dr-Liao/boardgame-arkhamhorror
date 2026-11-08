// scratch extract (auditor A) — screen files filtered to my 48 codes / 3 chapters
import fs from 'node:fs'
const dir = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/'
const codes = new Set(('08501 08502 08503 08504 08505 08506 08507 08508 08509 08510 08511 08512 08513 08514 08515 08516 08517 08518 08519 08520 08521 08522 08523 08524 08525 08526 08527 08528 08529 08530 08531 08532 08533 08534 08535 08536 08537 08538 08539 08540 08541 08542 08543 08544 08545 08546 08547 08548').split(' '))
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'))
const lines = []
const out = s => lines.push(s)

const integ = read('integrity.json')
out('## integrity.summary ' + JSON.stringify(integ.summary))
const integCards = (integ.cards || []).filter(c => codes.has(c.code))
out('## integrity cards(' + integCards.length + ')')
for (const c of integCards) out(JSON.stringify(c))

const known = read('known-deviations.json')
out('\n## known-deviations.summary ' + JSON.stringify(known.summary))
for (const [bucket, list] of Object.entries(known)) {
  if (!Array.isArray(list)) continue
  const hit = list.filter(x => { const t = JSON.stringify(x); return [...codes].some(code => t.includes(code)) })
  if (!hit.length) continue
  out(`\n### known-deviations.${bucket} (${hit.length})`)
  for (const h of hit) out(JSON.stringify(h))
}

const kw = read('keyword-coverage.json')
const kwCards = (kw.cards || []).filter(c => codes.has(c.code))
out('\n## keyword-coverage cards(' + kwCards.length + ')')
for (const c of kwCards) out(JSON.stringify(c))

const tc = read('tests-coverage.json')
const tcCards = (tc.cards || []).filter(c => codes.has(c.code))
out('\n## tests-coverage cards(' + tcCards.length + ')')
for (const c of tcCards) out(JSON.stringify(c))

const pc = read('primitive-compliance.json')
out('\n## primitive-compliance.summary ' + JSON.stringify(pc.summary))
for (const [k, list] of Object.entries(pc)) {
  if (!Array.isArray(list)) continue
  const hit = list.filter(x => {
    const t = JSON.stringify(x)
    return [...codes].some(code => t.includes(code)) || t.includes('iceAndDeathPart')
  })
  if (hit.length) { out(`### primitive-compliance.${k} (${hit.length})`); for (const h of hit) out(JSON.stringify(h).slice(0, 400)) }
}

const perc = read('perceivability.json')
const percCards = (perc.cards || []).filter(c => codes.has(c.code))
out('\n## perceivability cards(' + percCards.length + ')')
for (const c of percCards) out(JSON.stringify(c).slice(0, 400))

const si = read('scenario-integrity.json')
out('\n## scenario-integrity summary ' + JSON.stringify(si.summary))
for (const [k, v] of Object.entries(si)) {
  if (Array.isArray(v)) {
    const hit = v.filter(x => JSON.stringify(x).includes('iceAndDeath'))
    if (hit.length) { out(`### scenario-integrity.${k}`); for (const h of hit) out(JSON.stringify(h).slice(0, 600)) }
  } else if (v && typeof v === 'object' && !['summary'].includes(k)) {
    const keys = Object.keys(v).filter(id => id.startsWith('iceAndDeath'))
    for (const id of keys) out(`### scenario-integrity.${k}.${id} ` + JSON.stringify(v[id]).slice(0, 900))
  }
}

const dup = read('duplication.json')
out('\n## duplication.summary ' + JSON.stringify(dup.summary))
for (const [k, list] of Object.entries(dup)) {
  if (!Array.isArray(list)) continue
  const hit = list.filter(x => {
    const t = JSON.stringify(x)
    return t.includes('085') && (t.includes('iceAndDeath') || [...codes].some(code => t.includes(code)))
  })
  if (hit.length) { out(`### duplication.${k} (${hit.length})`); for (const h of hit) out(JSON.stringify(h).slice(0, 500)) }
}

fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_screen_extract.txt', lines.join('\n'))
console.log('written', lines.length, 'lines')
