// Phase 0.4 辅助：按英文名在 cards.json 中查找 code，用于对照现有 44 张卡。
import fs from 'node:fs'
const cards = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/backend/arkham-api/data/cards.json', 'utf8'))
const names = process.argv.slice(2)
for (const n of names) {
  const hits = cards.filter((c) => c.name.toLowerCase() === n.toLowerCase())
  if (hits.length) {
    for (const c of hits) console.log(`  ${c.code} | ${c.type_code} | ${c.faction_code} | ${c.name} | pack=${c.pack_code}${c.slot ? ' | slot=' + c.slot : ''}${c.xp ? ' | xp=' + c.xp : ''}`)
  } else {
    const fuzzy = cards.filter((c) => c.name.toLowerCase().includes(n.toLowerCase()))
    console.log(`"${n}" 精确未命中；模糊匹配 ${fuzzy.length} 条：`)
    for (const c of fuzzy.slice(0, 8)) console.log(`    ${c.code} | ${c.type_code} | ${c.faction_code} | ${c.name} | pack=${c.pack_code}`)
  }
}
