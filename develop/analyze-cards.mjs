// Phase 0.1 临时脚本：盘点 cards.json（参考资源）的卡牌构成。
// 输出纯文本统计，供 docs/architecture-refactor-roadmap.md 与图鉴统计引用。可重跑，只读参考资源。
import fs from 'node:fs'

const src = '参考资源/ArkhamHorror-main/backend/arkham-api/data/cards.json'
const cards = JSON.parse(fs.readFileSync(src, 'utf8'))

const countBy = (arr, keyFn) => {
  const m = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

console.log('=== 总量 ===')
console.log('cards.json 卡牌总数:', cards.length)
console.log('不同 code 数:', new Set(cards.map((c) => c.code)).size)

console.log('\n=== 按 type_code 分类 ===')
for (const [t, n] of countBy(cards, (c) => c.type_code)) console.log(`  ${t}: ${n}`)

console.log('\n=== 按 faction_code 分类 ===')
for (const [f, n] of countBy(cards, (c) => c.faction_code)) console.log(`  ${f}: ${n}`)

console.log('\n=== 按 pack_code 分类 ===')
for (const [p, n] of countBy(cards, (c) => c.pack_code)) console.log(`  ${p}: ${n}`)

console.log('\n=== 按 subtype_code 分类（弱点等） ===')
for (const [s, n] of countBy(cards, (c) => c.subtype_code || '(none)')) console.log(`  ${s}: ${n}`)

console.log('\n=== 按 slot 分类（仅资产，含 null） ===')
const assets = cards.filter((c) => c.type_code === 'asset')
for (const [s, n] of countBy(assets, (c) => c.slot || '(none)')) console.log(`  ${s}: ${n}`)

console.log('\n=== 按 xp 分布（玩家卡，xp 存在） ===')
for (const [x, n] of countBy(cards.filter((c) => c.xp != null), (c) => c.xp)) console.log(`  xp=${x}: ${n}`)

console.log('\n=== 关键词标志统计 ===')
console.log('  is_unique:', cards.filter((c) => c.is_unique).length)
console.log('  permanent:', cards.filter((c) => c.permanent).length)
console.log('  exceptional:', cards.filter((c) => c.exceptional).length)
console.log('  exile:', cards.filter((c) => c.exile).length)
console.log('  double_sided:', cards.filter((c) => c.double_sided).length)
console.log('  hidden:', cards.filter((c) => c.hidden).length)
console.log('  health_per_investigator:', cards.filter((c) => c.health_per_investigator).length)

console.log('\n=== 调查员（type=investigator） ===')
for (const c of cards.filter((c) => c.type_code === 'investigator')) {
  console.log(`  ${c.code} | ${c.name} | ${c.faction_code} | wp${c.skill_willpower} int${c.skill_intellect} com${c.skill_combat} agi${c.skill_agility} | hp${c.health} san${c.sanity} | pack=${c.pack_code}`)
}

console.log('\n=== 核心包（pack=core）玩家卡（asset/event/skill）code + name ===')
for (const c of cards.filter((c) => c.pack_code === 'core' && ['asset', 'event', 'skill'].includes(c.type_code))) {
  console.log(`  ${c.code} | ${c.type_code.padEnd(5)} | ${c.faction_code.padEnd(8)} | ${c.name}${c.slot ? ' | slot=' + c.slot : ''}${c.xp ? ' | xp=' + c.xp : ''}`)
}

console.log('\n=== 核心包弱点（subtype=weakness/basicweakness） ===')
for (const c of cards.filter((c) => c.pack_code === 'core' && (c.subtype_code === 'weakness' || c.subtype_code === 'basicweakness'))) {
  console.log(`  ${c.code} | ${c.subtype_code.padEnd(13)} | ${c.faction_code.padEnd(8)} | ${c.name}`)
}
