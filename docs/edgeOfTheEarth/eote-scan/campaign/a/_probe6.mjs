// scratch probe (auditor A) — Part3 gather/deck composition vs Haskell
const root = 'file:///G:/boardgame-hall-ai/games/arkhamhorror/'
const p3 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js')
const p2 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js')
const p1 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js')
const { ALL_CARDS } = await import(root + 'src/cards/cards-data.js')
const report = m => {
  const by = {}
  for (const code of m.scenario.encounterDeck) {
    const c = ALL_CARDS[code] || {}
    by[c.encounterCode || '?'] = (by[c.encounterCode || '?'] || 0) + 1
  }
  return by
}
for (const [name, m] of [['P1', p1], ['P2', p2], ['P3', p3]]) {
  console.log('=====', name, 'deckLen=', m.scenario.encounterDeck.length)
  console.log(JSON.stringify(report(m)))
  if (m.GATHER_GROUPS) console.log('gather:', [...m.GATHER_GROUPS].join(','))
  if (m.SET_ASIDE_ALIASES) console.log('setAsideAliases len=', m.SET_ASIDE_ALIASES.length, m.SET_ASIDE_ALIASES.join(','))
}
// 08547 traits + eidolons in P3 deck
console.log('08547 traits=', ALL_CARDS['08547'].traits, 'type=', ALL_CARDS['08547'].type)
console.log('08515 traits=', ALL_CARDS['08515'].traits)
const eidolonEnemies = Object.entries(ALL_CARDS).filter(([, c]) => c.type === 'enemy' && (c.traits || []).map(t => String(t).toLowerCase()).includes('eidolon')).map(([code, c]) => code + ':' + c.encounterCode + ':' + (c.traits || []).join('/'))
console.log('eidolon enemies in cards-data:', eidolonEnemies.join(' | '))
