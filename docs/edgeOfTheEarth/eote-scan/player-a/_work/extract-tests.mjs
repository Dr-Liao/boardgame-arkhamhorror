// 抽取 m2-1/m2-2 测试文件中每个 080xx 卡号所在的 test(...) 块（含上下文），输出到 area
import fs from 'node:fs'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work'
const codes = Array.from({ length: 60 }, (_, i) => String(8019 + i).padStart(5, '0'))
const files = ['tests/eote-player-m2-1.test.mjs', 'tests/eote-player-m2-2.test.mjs', 'tests/eote-player-fixture.mjs', 'tests/eote-player.browser.mjs', 'tests/eote-interactions.test.mjs', 'tests/eote-primitives-travel.test.mjs', 'tests/eote-player-m2-4.test.mjs']
const hits = {}
for (const code of codes) hits[code] = []
for (const f of files) {
  const p = MOD + '/' + f
  if (!fs.existsSync(p)) continue
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const code of codes) {
      if (line.includes(code)) hits[code].push({ file: f, line: i + 1, text: line.trim() })
    }
  })
}
// 输出：每个卡号命中行 + 前后 3 行
const buf = []
for (const code of codes) {
  buf.push(`\n## ${code} (${hits[code].length} hits)`)
  for (const h of hits[code]) {
    buf.push(`  ${h.file}:${h.line}: ${h.text.slice(0, 240)}`)
  }
}
fs.writeFileSync(OUT + '/test-hits.txt', buf.join('\n'), 'utf8')
console.log('wrote test-hits.txt')
