// scratch probe (auditor A) — engine-path wiring evidence via production hub fixture
import { loadEoteWorld, legalFor, decisionSeat, walkCampaign } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...parts) => out.push(parts.join(' '))

log('=== behavior hook keys (production contentRegistry) ===')
for (const id of ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'cityOfTheElderThings', 'toTheForbiddenPeaks']) {
  const keys = Object.keys(world.contentRegistry.getBehavior(id)).sort()
  log(id, '| actions=' + keys.includes('actions'), 'performAction=' + keys.includes('performAction'),
    'actReveal=' + keys.includes('actReveal'), 'agendaReveal=' + keys.includes('agendaReveal'),
    'checkObjectives=' + keys.includes('checkObjectives'), 'agendaWouldAdvance=' + keys.includes('agendaWouldAdvance'))
}

const snapshots = []
const chapterProbe = (state, tag) => {
  log(`\n=== ${tag} engine state === scenario=${state.scenario.id} numInvestigators=${state.numInvestigators}`)
  log('locations:', state.locations.map(l =>
    `${l.id}(shroud=${l.shroud},clues=${l.clues},maxClues=${l.maxClues},revealed=${l.revealed})`).join(' | '))
  log('encounterDeck=', state.encounterDeck.length, 'setAside=', (state.scenarioZones.setAside || []).length)
  log('enemies=', state.enemies.map(e => `${e.code}@${e.location}[beneath=${(e.beneath || []).length}]`).join(' | ') || '(none)')
  const seat = decisionSeat(world, state)
  const moves = legalFor(world, state, seat)
  log('legalMoves actions=', [...new Set(moves.map(m => m.action))].join(','))
  log('scenarioAction?', moves.some(m => m.action === 'scenarioAction'), 'entityAbility?', moves.some(m => m.action === 'entityAbility'))
  // 议程推进：引擎真实路径
  const before = { agendaIndex: state.agendaIndex, enemies: state.enemies.length, deck: state.encounterDeck.length, setAside: (state.scenarioZones.setAside || []).length }
  try {
    world.engine.advanceAgenda(state, [], 'doom')
    log('advanceAgenda OK: agendaIndex', before.agendaIndex, '->', state.agendaIndex,
      '| enemies', before.enemies, '->', state.enemies.length,
      '| encounterDeck', before.deck, '->', state.encounterDeck.length,
      '| setAside', before.setAside, '->', (state.scenarioZones.setAside || []).length)
  } catch (error) {
    log('advanceAgenda THREW:', error.message)
  }
  // 幕推进：引擎真实路径
  if (typeof world.engine.advanceAct === 'function') {
    try {
      world.engine.advanceAct(state, [])
      log('advanceAct OK: actIndex=', state.actIndex)
    } catch (error) {
      log('advanceAct THREW:', error.message)
    }
  } else log('(no exported advanceAct)')
}

const storySelect = (choice, state) => {
  const node = state.campaign?.flow?.nodeId
  const ids = choice.options.map(option => option.id)
  if (node === 'checkpoint2Choice' && ids.includes('stand')) return 'stand'
  if (node === 'interlude1' && ids.includes('ignore')) return 'ignore'
  return null
}

await walkCampaign(world, {
  seats: 2, seed: 'audit-a-probe', maxChapters: 3,
  investigatorCodes: ['08001', '08004'],
  resolutionFor: state => (state.scenario.id === 'iceAndDeathPart3' ? 'defeat' : 'resolution1'),
  storySelect,
  onChapter: (w, state, index) => {
    chapterProbe(state, `CHAPTER ${index + 1}`)
    snapshots.push(state.scenario.id)
    return state.scenario.id === 'iceAndDeathPart3' ? 'defeat' : 'resolution1'
  },
})

log('\nchapters visited:', snapshots.join(' -> '))
console.log(out.join('\n'))
