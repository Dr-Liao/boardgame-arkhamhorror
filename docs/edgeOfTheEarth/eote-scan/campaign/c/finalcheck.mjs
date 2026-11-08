import fs from 'node:fs'
const f = JSON.parse(fs.readFileSync('findings.json','utf8'))
const sev = { high: 0, medium: 0, low: 0 }
for (const c of f.cards) for (const i of c.issues) sev[i.severity]++
const scSev = { high: 0, medium: 0, low: 0 }
for (const s of f.scenarios) for (const i of s.issues) scSev[i.severity]++
const dupSev = { high: 0, medium: 0, low: 0 }
for (const i of f.duplicationIssues) dupSev[i.severity]++
console.log('cards issues', sev)
console.log('scenario issues', scSev)
console.log('duplication issues', dupSev)
console.log('summary', JSON.stringify(f.summary))
console.log('sample card 08629 clauses:', JSON.stringify(f.cards.find(c=>c.code==='08629').clauses, null, 1))
