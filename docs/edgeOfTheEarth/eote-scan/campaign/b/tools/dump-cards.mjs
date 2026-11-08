// 生成 75 条战役卡的逐卡摘要 markdown（供人工核对）。
import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/data.json', 'utf8'))
const outDir = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b'
const lines = []
for (const record of data.cards) {
  const c = record.card || {}
  lines.push(`\n## ${record.code} · ${c.nameZh || c.name || '?'} / ${c.name || '?'}`)
  lines.push(`- type=${c.type || '?'} subType=${c.subType || '-'} encounterCode=${c.encounterCode || '-'} doubleSided=${c.doubleSided} pack=${c.pack || '-'} quantity=${c.quantity || '-'}`)
  if (c.traits) lines.push(`- traits=${JSON.stringify(c.traits)}`)
  const stats = ['health', 'fight', 'evade', 'damage', 'horror', 'clues', 'shroud', 'cluesPerInvestigator', 'stage', 'doomThreshold', 'victory', 'vengeance', 'uses', 'usesType', 'xp']
    .filter(key => c[key] !== undefined).map(key => `${key}=${JSON.stringify(c[key])}`).join(' ')
  if (stats) lines.push(`- stats: ${stats}`)
  lines.push('### text')
  lines.push('```')
  lines.push((c.text || '').trim())
  lines.push('```')
  if (c.backText) {
    lines.push('### backText')
    lines.push('```')
    lines.push(c.backText.trim())
    lines.push('```')
  }
  lines.push('### textZh')
  lines.push('```')
  lines.push((c.textZh || '').trim())
  lines.push('```')
  if (c.backTextZh) {
    lines.push('### backTextZh')
    lines.push('```')
    lines.push(c.backTextZh.trim())
    lines.push('```')
  }
  lines.push('### entry')
  lines.push('```js')
  lines.push((record.entrySource || '<MISSING>').trim())
  lines.push('```')
}
fs.writeFileSync(outDir + '/cards-dump.md', lines.join('\n'))
console.log('wrote cards-dump.md', lines.length, 'lines')
