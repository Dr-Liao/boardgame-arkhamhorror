import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const MODS = join(process.cwd(), 'games', 'arkhamhorror')
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (line, prefix) => prefix + ' '.repeat(Math.max(0, line.length - prefix.length)))
}
function balancedBlock(src, startIndex) {
  let depth = 0
  for (let i = startIndex; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(startIndex, i + 1) }
  }
  return src.slice(startIndex)
}
const src = readFileSync(join(MODS, 'src/cards/entries/08001.js'), 'utf8')
const stripped = stripComments(src)
const RULE_BLOCKS = ['flags', 'locationRule', 'treacheryRule', 'agendaRule', 'actRule', 'enemyRule', 'investigator', 'weaknessRule', 'scenarioRule', 'storyRule', 'setupRule', 'rule']
const declared = []
for (const block of RULE_BLOCKS) {
  const re = new RegExp(`\\b${block}\\s*:\\s*\\{`, 'g')
  let m
  while ((m = re.exec(stripped))) {
    const start = stripped.indexOf('{', m.index)
    const body = balancedBlock(stripped, start)
    declared.push({ block, found: body.slice(0, 80) })
  }
}
console.log('08001 declared:', JSON.stringify(declared, null, 1))
// count all entries with any block
let total = 0
const examples = []
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (/^\d{5}[ab]?\.js$/.test(e.name)) out.push(f)
  }
  return out
}
for (const f of walk(join(MODS, 'src/cards/entries'))) {
  const s = stripComments(readFileSync(f, 'utf8'))
  for (const block of RULE_BLOCKS) {
    if (new RegExp(`\\b${block}\\s*:\\s*\\{`).test(s)) { total += 1; if (examples.length < 5) examples.push([f.split('\\').pop(), block]) }
  }
}
console.log('entry blocks total', total, examples)
