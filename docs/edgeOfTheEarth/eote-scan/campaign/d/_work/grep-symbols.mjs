// D 审计辅助：统计关键符号的读点
import fs from 'node:fs'
import path from 'node:path'
const pats = ['context.when', 'lastClue', 'clueDiscovered', 'entryResolve', 'encounterResolve', 'failedBy',
  'pylonPowers', 'towerHealth', 'damageTower', 'recoverSeal', 'nearestSealHolder', 'hunter', 'Hunter',
  'enterCost', 'spendClueAutoSucceed', 'attachEncounterToEnemy', 'revealChaosTokens', 'replacementToken',
  'memorial', 'partner', 'uses', 'usesType', 'weakness', 'entryFlags', 'lastDiscovered']
function walk(d, acc) {
  if (!fs.existsSync(d)) return acc
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (['node_modules', '.git'].includes(e.name)) continue; walk(p, acc) }
    else if (/\.(js|mjs)$/.test(e.name)) acc.push(p)
  }
  return acc
}
const files = walk('src', []).concat(walk('content', []))
const out = {}
for (const p of pats) out[p] = []
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8')
  for (const p of pats) {
    const count = txt.split(p).length - 1
    if (count) out[p].push(`${f.replace(/\\/g, '/')}:${count}`)
  }
}
for (const p of pats) console.log(p, '=>', out[p].slice(0, 15).join('  '))
