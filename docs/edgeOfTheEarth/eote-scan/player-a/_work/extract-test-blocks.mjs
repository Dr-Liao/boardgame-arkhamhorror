import fs from 'node:fs'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work'
const codes = Array.from({ length: 60 }, (_, i) => String(8019 + i).padStart(5, '0'))
const files = ['tests/eote-player-m2-1.test.mjs', 'tests/eote-player-m2-2.test.mjs']
const buf = []
for (const f of files) {
  const lines = fs.readFileSync(MOD + '/' + f, 'utf8').split('\n')
  for (const code of codes) {
    const start = lines.findIndex(line => /^test\('/.test(line) && line.includes(code))
    if (start < 0) continue
    // 往上收注释
    let from = start
    while (from > 0 && /^\/\//.test(lines[from - 1].trim())) from--
    let end = start
    while (end < lines.length - 1 && !/^\}\)/.test(lines[end + 1])) end++
    buf.push(`\n${'='.repeat(80)}\n## ${code}  [${f}:${start + 1}]\n` + lines.slice(from, Math.min(end + 2, lines.length)).join('\n'))
  }
}
fs.writeFileSync(OUT + '/test-blocks.md', buf.join('\n'), 'utf8')
console.log('wrote test-blocks.md lines', buf.length)
