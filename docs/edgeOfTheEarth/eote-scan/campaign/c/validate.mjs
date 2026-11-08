import fs from 'node:fs'
const f = JSON.parse(fs.readFileSync('findings.json', 'utf8'))
console.log('cards', f.cards.length, 'unique', new Set(f.cards.map(c => c.code)).size)
const bad = []
for (const c of f.cards) {
  if (!c.verdict || !c.clauses?.length) bad.push(c.code + ':missing clauses')
  for (const cl of c.clauses) if (!/:\d+/.test(cl.evidence)) bad.push(c.code + ':clause no line ' + cl.evidence)
  for (const i of c.issues) if (!/:\d+/.test(i.evidence)) bad.push(c.code + ':issue no line ' + i.evidence.slice(0, 80))
  const s = JSON.stringify(c)
  for (const marker of ['${', 'undefined', 'NaN', '�']) if (s.includes(marker)) bad.push(c.code + ' marker ' + marker)
}
for (const sc of f.scenarios) for (const i of sc.issues) if (!/:\d+/.test(i.evidence)) bad.push(sc.id + ':scenario issue no line ' + i.evidence.slice(0, 80))
console.log('BAD:', bad.length)
for (const b of bad.slice(0, 30)) console.log(' -', b)
console.log('codes:', f.cards.map(c => c.code).join(','))
