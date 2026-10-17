import fs from 'node:fs'
const zh = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json', 'utf8'))
const byCode = new Map(zh.map((z) => [z.code, z]))
const codes = [
  '01025','01039','01053','01067','01081','01089','01090','01091','01092','01093',
  '01026','01027','01028','01029','01040','01041','01042','01043','01054','01055','01056','01057',
  '01068','01069','01070','01071','01082','01083','01084','01085','01094','01095',
]
for (const code of codes) {
  const z = byCode.get(code)
  if (!z) { console.log(code, 'NOT FOUND'); continue }
  const text = (z.text || '').replace(/<[^>]*>/g, ' ').replace(/\[/g, '[').replace(/\s+/g, ' ').trim()
  console.log(`### ${code} ${z.name} (${z.type_code} xp${z.xp ?? 0} cost${z.cost ?? 0} slot${z.real_slot || z.slot || '-'})`)
  console.log('  ' + text)
  console.log('  icons: ' + JSON.stringify({ willpower: z.skill_willpower, intellect: z.skill_intellect, combat: z.skill_combat, agility: z.skill_agility, wild: z.skill_wild }))
  if (z.type_code === 'asset') console.log('  health/horror/sanity: ' + JSON.stringify({ health: z.health, sanity: z.sanity }))
}
