import fs from 'node:fs'
// Phase 4 · 一次性调研脚本：从 cards_zh-cn.json 提取 NOTZ 遭遇牌（剧本/幕/议程/地点/敌人/诡计）完整数据。
const zh = JSON.parse(fs.readFileSync('参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json', 'utf8'))
const byCode = new Map(zh.map((z) => [z.code, z]))

const codes = [
  // The Midnight Masks
  '01120','01121a','01121b','01122','01123',
  '01124','01125','01126','01127','01128','01129','01130','01131','01132','01133','01134',
  '01135','01136','01137','01138','01139','01140','01141',
  '01169','01170','01171','01172','01173','01174',
  // The Devourer Below
  '01142','01143','01144','01145','01146','01147','01148',
  '01149','01150','01151','01152','01153','01154','01155','01156','01157','01158',
  '01175','01177','01178','01179','01180','01181',
  // Return To NOTZ
  '50038','50039','50040','50041','50042','50043',
]

const strip = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

for (const code of codes) {
  const z = byCode.get(code)
  if (!z) { console.log(`\n### ${code} NOT FOUND`); continue }
  console.log(`\n### ${code} | ${z.name}${z.subname ? ' · ' + z.subname : ''} | ${z.real_name}`)
  console.log(`  type=${z.type_code} enc=${z.encounter_code}/${z.encounter_position} qty=${z.quantity} faction=${z.faction_code}`)
  const stats = []
  if (z.skill_willpower != null) stats.push(`wp=${z.skill_willpower}`)
  if (z.skill_intellect != null) stats.push(`int=${z.skill_intellect}`)
  if (z.skill_combat != null) stats.push(`combat=${z.skill_combat}`)
  if (z.skill_agility != null) stats.push(`agi=${z.skill_agility}`)
  if (z.health != null) stats.push(`health=${z.health}`)
  if (z.health_per_investigator) stats.push('healthPerInv=true')
  if (z.sanity != null) stats.push(`sanity=${z.sanity}`)
  if (z.enemy_fight != null) stats.push(`fight=${z.enemy_fight}`)
  if (z.enemy_evade != null) stats.push(`evade=${z.enemy_evade}`)
  if (z.enemy_damage != null) stats.push(`dmg=${z.enemy_damage}`)
  if (z.enemy_horror != null) stats.push(`horror=${z.enemy_horror}`)
  if (z.shroud != null) stats.push(`shroud=${z.shroud}`)
  if (z.clues != null) stats.push(`clues=${z.clues}`)
  if (z.doom != null) stats.push(`doom=${z.doom}`)
  if (z.victory != null) stats.push(`victory=${z.victory}`)
  if (z.xp != null) stats.push(`xp=${z.xp}`)
  if (stats.length) console.log(`  stats: ${stats.join(' ')}`)
  if (z.traits) console.log(`  traits: ${z.traits}  (real: ${z.real_traits})`)
  if (z.text) console.log(`  text: ${strip(z.text)}`)
  if (z.flavor) console.log(`  flavor: ${strip(z.flavor)}`)
  if (z.slot || z.real_slot) console.log(`  slot: ${z.slot || z.real_slot}`)
}
