import fs from 'node:fs'
const zh = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json', 'utf8'))
const byCode = new Map(zh.map((z) => [z.code, z]))
const codes = ['01006','01007','01008','01009','01010','01011','01012','01013','01014','01015']
for (const code of codes) {
  const z = byCode.get(code)
  if (!z) { console.log(code, 'NOT FOUND'); continue }
  const text = (z.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  console.log(`### ${code} ${z.name} (${z.type_code} cost${z.cost ?? 0} slot${z.real_slot || '-'})`)
  console.log('  ' + text)
  console.log('  icons: ' + JSON.stringify({ willpower: z.skill_willpower, intellect: z.skill_intellect, combat: z.skill_combat, agility: z.skill_agility, wild: z.skill_wild }))
}
