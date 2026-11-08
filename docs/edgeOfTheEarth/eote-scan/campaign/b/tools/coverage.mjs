import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/data.json', 'utf8'))
const t = d.screen.tests
const codes = new Set(d.scope.codes)
const none = t.summary.none.filter(entry => codes.has(entry.split(':')[0]))
console.log('our codes with NO test:', none.length)
console.log(none.join('\n'))
const cardsMine = t.cards.filter(c => codes.has(c.code))
const level = {}
for (const c of cardsMine) { const k = c.level || c.status || JSON.stringify(c); level[k] = (level[k] || 0) + 1 }
console.log('coverage levels for our cards:', JSON.stringify(level))
console.log('sample non-none:', JSON.stringify(cardsMine.slice(0, 10), null, 1))
console.log('--- suspicious titles involving our codes/name ---')
for (const s of t.suspiciousTitles) { if (codes.has(String(s.code))) console.log(JSON.stringify(s)) }
