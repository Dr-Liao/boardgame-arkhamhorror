// Phase 0.1 补充：厘清 cards.json 里 story/enemy/location 卡的边界（是否遭遇卡）。
import fs from 'node:fs'
const cards = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/backend/arkham-api/data/cards.json', 'utf8'))

for (const t of ['story', 'enemy', 'location']) {
  console.log(`\n===== type=${t} (${cards.filter(c => c.type_code === t).length}) =====`)
  for (const c of cards.filter((c) => c.type_code === t)) {
    console.log(`  ${c.code} | fac=${c.faction_code} | pack=${c.pack_code} | sub=${c.subtype_code || '-'} | ${c.name}`)
  }
}

console.log('\n===== 全部 mythos faction 卡按 type 统计 =====')
for (const c of cards.filter((c) => c.faction_code === 'mythos')) {
  console.log(`  ${c.code} | type=${c.type_code} | pack=${c.pack_code} | ${c.name}`)
}
