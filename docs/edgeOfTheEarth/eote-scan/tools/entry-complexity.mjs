import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const scope = JSON.parse(readFileSync(join(SCAN, 'scope/cards.json'), 'utf8'))
const cardByCode = new Map(scope.cards.map(c => [c.code, c]))
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (/^\d{5}[ab]?\.js$/.test(e.name)) out.push(f)
  }
  return out
}
const files = [...walk(join(MODS, 'src/cards/entries')), ...walk(join(MODS, 'src/cards/encounter-entries/edgeOfTheEarth'))]
const rows = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const code = f.split(/[\\/]/).pop().replace('.js', '')
  const card = cardByCode.get(code)
  if (!card) continue
  const lines = src.split('\n').length
  const apiCalls = (src.match(/api\.\w+/g) || []).length
  const resolveBodies = (src.match(/\bresolve\s*:\s*(?:\(|\{)/g) || []).length + (src.match(/^\s*resolve\s*\(/gm) || []).length + (src.match(/encounterResolve\s*\(/g) || []).length
  const stateReads = (src.match(/(?:state|inv|location|enemy|act|agenda|asset|target|card)\.[A-Za-z_$][\w$]*/g) || []).length
  const calls = (src.match(/\b(api\.choice|api\.info)\b/g) || []).length
  rows.push({ code, name: card.nameZh || card.name, type: card.type, chapter: card.chapter, group: card.group, status: card.status, lines, apiCalls, resolveBodies, stateReads, uiCalls: calls })
}
rows.sort((a, b) => b.lines - a.lines)
const out = {
  generatedAt: new Date().toISOString(),
  summary: {
    entries: rows.length,
    linesTotal: rows.reduce((n, r) => n + r.lines, 0),
    entriesWithResolve: rows.filter(r => r.resolveBodies > 0).length,
    entriesOver100Lines: rows.filter(r => r.lines > 100).length,
    entriesOver200Lines: rows.filter(r => r.lines > 200).length,
    entriesNoUiFeedback: rows.filter(r => r.resolveBodies > 0 && r.uiCalls === 0).length,
    entriesNoStateRead: rows.filter(r => r.stateReads === 0).length,
  },
  topLines: rows.slice(0, 40),
  topStateReads: [...rows].sort((a, b) => b.stateReads - a.stateReads).slice(0, 30),
  noUiFeedback: rows.filter(r => r.resolveBodies > 0 && r.uiCalls === 0).slice(0, 120),
}
import { writeFileSync } from 'node:fs'
writeFileSync(join(SCAN, 'primitives', 'entry-complexity.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.summary, null, 1))
console.log('top lines:', rows.slice(0, 12).map(r => `${r.code}:${r.lines}L api=${r.apiCalls}`).join(' | '))
