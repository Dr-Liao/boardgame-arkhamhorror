import { ALL_CARDS, INVESTIGATORS, PLAYER_CARDS, WEAKNESSES, BASIC_WEAKNESSES } from '../games/arkhamhorror/cards-data.js'

const core = Object.values(ALL_CARDS).filter((c) => c.pack === 'core')

const byType = {}
for (const c of core) {
  const key = c.type + (c.subtype ? '/' + c.subtype : '')
  ;(byType[key] ||= []).push(c)
}

console.log('=== CORE PACK CARDS (' + core.length + ') ===')
for (const [key, arr] of Object.entries(byType)) {
  console.log('\n## ' + key + ' (' + arr.length + ')')
  for (const c of arr.sort((a, b) => a.code.localeCompare(b.code))) {
    const parts = [c.code, c.nameZh || c.name]
    if (c.xp != null) parts.push('xp' + c.xp)
    if (c.cost != null) parts.push('cost' + c.cost)
    if (c.slot) parts.push('slot:' + c.slot)
    if (c.type === 'investigator') parts.push(`${c.willpower}/${c.intellect}/${c.combat}/${c.agility}`)
    if (c.type === 'enemy') parts.push(`fight${c.fight}/eva${c.evade}/hp${c.health}`)
    if (c.signatureFor) parts.push('sig:' + c.signatureFor.join(','))
    if (c.icons) parts.push('icons:' + JSON.stringify(c.icons))
    console.log('  ' + parts.join(' | '))
  }
}

console.log('\n=== INVESTIGATOR deckOptions/requirements ===')
for (const code of ['01001', '01002', '01003', '01004', '01005']) {
  const i = INVESTIGATORS[code]
  console.log('\n' + code, i.nameZh)
  console.log('  options:', JSON.stringify(i.deckOptions))
  console.log('  requirements:', JSON.stringify(i.deckRequirements))
  console.log('  textZh:', (i.textZh || '').slice(0, 200))
  console.log('  backTextZh:', (i.backTextZh || '').slice(0, 200))
}
