// 生成精简 chunk：卡面 EN 全保留；ZH 若已逐字出现在条目注释中则省略（记 DUP 标记）；去掉测试命中行
import fs from 'node:fs'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work'
const brief = JSON.parse(fs.readFileSync(OUT + '/cards-brief.json', 'utf8'))
const codes = Object.keys(brief).sort()
const norm = s => (s || '').replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '')
const chunks = []
for (let start = 0; start < codes.length; start += 10) chunks.push(codes.slice(start, start + 10))
let chunkNo = 0
for (const part of chunks) {
  chunkNo++
  const buf = []
  for (const code of part) {
    const c = brief[code]
    const src = fs.readFileSync(`G:/boardgame-hall-ai/games/arkhamhorror/src/cards/entries/${code}.js`, 'utf8')
    const srcNorm = norm(src.replace(/\/\/.*$/gm, ''))
    const srcAll = norm(src)
    const zhNorm = norm(c.textZh)
    const zhInEntry = zhNorm.length > 20 && (srcAll.includes(zhNorm.slice(0, Math.min(zhNorm.length, 40))) || jaccard(zhNorm, srcAll) > 0.8)
    const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(3) + '| ' + l).join('\n')
    const meta = `## ${code} ${c.name} / ${c.nameZh} [${c.type}|${c.klass}|xp:${c.xp}${c.exceptional ? '|EXC' : ''}${c.myriad ? '|MYRIAD' : ''}${c.deckLimit != null ? '|deckLimit:' + c.deckLimit : ''}${c.cost != null ? '|cost:' + c.cost : ''}] traits:${(c.traits || []).join(',') || '-'}${c.subtype ? ' subtype:' + c.subtype : ''}`
    buf.push(`\n${'='.repeat(88)}\n${meta}\nEN: ${c.text || '(none)'}\n`)
    if (!zhInEntry) buf.push(`ZH: ${c.textZh || '(none)'}\n`)
    else buf.push(`ZH: (与条目注释重复，已省略)\n`)
    buf.push(`--- entries/${code}.js ---\n${numbered}\n`)
  }
  fs.writeFileSync(`${OUT}/lean-${String(chunkNo).padStart(2, '0')}.md`, buf.join(''), 'utf8')
}
function jaccard(a, b) {
  if (!a) return 0
  const set = new Set()
  for (let i = 0; i < b.length - 1; i++) set.add(b.slice(i, i + 2))
  let hit = 0, tot = 0
  for (let i = 0; i < a.length - 1; i++) { tot++; if (set.has(a.slice(i, i + 2))) hit++ }
  return tot ? hit / tot : 0
}
console.log('lean chunks:', chunkNo)
