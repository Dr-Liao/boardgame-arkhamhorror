// 通用 grep：node grep-multi.mjs <out.json> <pattern1> <pattern2> ...
// 或从默认列表跑
import fs from 'node:fs'
import path from 'node:path'
const pats = process.argv.slice(2)
const roots = ['src/engine', 'src/cards', 'src/campaign', 'content/campaigns/edgeOfTheEarth']
function walk(d, acc) {
  if (!fs.existsSync(d)) return acc
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (['node_modules', '.git'].includes(e.name)) continue; walk(p, acc) }
    else if (/\.(js|mjs)$/.test(e.name)) acc.push(p)
  }
  return acc
}
const files = roots.flatMap(r => walk(r, []))
for (const pat of pats) {
  const hits = []
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8')
    const lines = txt.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pat)) hits.push(`${f.replace(/\\/g, '/')}:${i + 1}: ${lines[i].trim().slice(0, 170)}`)
    }
  }
  console.log('### PATTERN:', pat, ' hits:', hits.length)
  for (const h of hits.slice(0, 14)) console.log('  ' + h)
}
