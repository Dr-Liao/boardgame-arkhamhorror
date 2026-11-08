// scratch probe (auditor A) — location printed stats vs definition
const root = 'file:///G:/boardgame-hall-ai/games/arkhamhorror/'
const p1 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js')
const p2 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js')
const p3 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js')
const { ALL_CARDS } = await import(root + 'src/cards/cards-data.js')
for (const [name, m] of [['P1', p1], ['P2', p2], ['P3', p3]]) {
  console.log('=====', name)
  for (const id of Object.keys(m.LOCATIONS)) {
    const l = m.LOCATIONS[id]
    const card = ALL_CARDS[l.code] || {}
    console.log([id, l.code, 'shroud=' + l.shroud, 'cardShroud=' + card.shroud, 'cluesFI=' + l.cluesFixed,
      'cluesPI=' + l.cluesPerInvestigator, 'cardClues=' + card.clues, 'shelter=' + l.shelter].join(' | '))
  }
}
