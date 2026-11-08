// player-auditor-a 数据装配脚本（只写 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work）
import fs from 'node:fs'
import path from 'node:path'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work'
fs.mkdirSync(OUT, { recursive: true })

const codes = Array.from({ length: 60 }, (_, i) => String(8019 + i).padStart(5, '0'))

// cards-data: 直接读取整文件并 eval 出 ALL_CARDS（ESM 生成的数据模块）
const dataSrc = fs.readFileSync(path.join(MOD, 'src/cards/cards-data.js'), 'utf8')
const m = dataSrc.match(/export const ALL_CARDS = (\{[\s\S]*?\})\nconst select = /)
if (!m) throw new Error('ALL_CARDS parse failed')
const ALL_CARDS = JSON.parse(m[1])

// 测试文件里的卡号命中行
const testDir = path.join(MOD, 'tests')
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.mjs') && f.startsWith('eote-'))
const testHits = {}
for (const code of codes) testHits[code] = []
for (const f of testFiles) {
  const lines = fs.readFileSync(path.join(testDir, f), 'utf8').split('\n')
  lines.forEach((line, idx) => {
    for (const code of codes) {
      if (line.includes(code)) testHits[code].push(`${f}:${idx + 1}: ${line.trim().slice(0, 220)}`)
    }
  })
}

const strings = j => JSON.stringify(j, null, 0).slice(0, 500)
const chunkSize = 10
let chunk = 0
for (let start = 0; start < codes.length; start += chunkSize) {
  chunk++
  const part = codes.slice(start, start + chunkSize)
  const buf = []
  for (const code of part) {
    const card = ALL_CARDS[code] || {}
    const entryPath = path.join(MOD, 'src/cards/entries', `${code}.js`)
    const entrySrc = fs.existsSync(entryPath) ? fs.readFileSync(entryPath, 'utf8') : '<<< MISSING ENTRY FILE >>>'
    const numbered = entrySrc.split('\n').map((l, i) => String(i + 1).padStart(3) + '| ' + l).join('\n')
    buf.push(`\n${'='.repeat(90)}\n## ${code} ${card.name || '?'} / ${card.nameZh || '?'}  [${card.type || '?'}|${card.klass || '?'}|xp:${card.xp ?? 0}${card.exceptional ? '|EXCEPTIONAL' : ''}${card.myriad ? '|MYRIAD' : ''}${card.deckLimit != null ? '|deckLimit:' + card.deckLimit : ''}${card.cost != null ? '|cost:' + card.cost : ''}] traits:${(card.traits || []).join(',') || '-'}\n`)
    buf.push(`EN: ${card.text || '(none)'}\n`)
    buf.push(`ZH: ${card.textZh || '(none)'}\n`)
    if (card.backText) buf.push(`EN-back: ${card.backText}\n`)
    if (card.backTextZh) buf.push(`ZH-back: ${card.backTextZh}\n`)
    if (card.subtype) buf.push(`subtype: ${card.subtype} | slot: ${card.slot || '-'} | uses: ${card.uses || '-'}\n`)
    buf.push(`--- src/cards/entries/${code}.js (${entrySrc.split('\n').length} lines) ---\n${numbered}\n`)
    buf.push(`--- test hits (${testHits[code].length}) ---\n${testHits[code].slice(0, 8).join('\n') || '(none)'}\n`)
  }
  fs.writeFileSync(path.join(OUT, `chunk-${String(chunk).padStart(2, '0')}.md`), buf.join(''), 'utf8')
}
fs.writeFileSync(path.join(OUT, 'test-hits.json'), JSON.stringify(testHits, null, 1), 'utf8')

// 供后续脚本使用的精简卡面数据
const brief = {}
for (const code of codes) {
  const c = ALL_CARDS[code] || {}
  brief[code] = {
    name: c.name, nameZh: c.nameZh, type: c.type, klass: c.klass,
    xp: c.xp ?? 0, exceptional: !!c.exceptional, myriad: !!c.myriad, deckLimit: c.deckLimit,
    cost: c.cost, traits: c.traits, text: c.text, textZh: c.textZh, subtype: c.subtype,
  }
}
fs.writeFileSync(path.join(OUT, 'cards-brief.json'), JSON.stringify(brief, null, 1), 'utf8')
console.log('chunks:', chunk, 'codes:', codes.length)
