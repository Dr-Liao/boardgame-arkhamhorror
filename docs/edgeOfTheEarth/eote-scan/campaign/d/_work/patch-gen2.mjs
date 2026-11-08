import fs from 'node:fs'
const p = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/gen-findings.mjs'
let t = fs.readFileSync(p, 'utf8')
const anchor = `  for (const extra of c.extraClauses || []) clauses.push(extra)`
const insert = `  const doubleSided = /doubleSided: true/.test(b.meta)
  const hasHigh = (c.issues || []).some(([severity]) => severity === 'high')
  if (doubleSided && b.backEn && !hasHigh && !(c.extraClauses || []).length) {
    for (const line of b.backEn.split('\\n').map(s => s.trim()).filter(Boolean)) {
      clauses.push({ text: '[背面] ' + line, status: 'implemented', evidence: \`\${entryFile(code)}:\${entryLine(code, 'agendaRule') || entryLine(code, 'actRule') || entryLine(code, 'locationRule') || entryLine(code, 'abilities:') || 1}\`, note: '' })
    }
  }
  for (const extra of c.extraClauses || []) clauses.push(extra)
`
if (!t.includes(anchor)) throw new Error('anchor missing')
t = t.replace(anchor, insert)
fs.writeFileSync(p, t, 'utf8')
console.log('patched back-clauses')
