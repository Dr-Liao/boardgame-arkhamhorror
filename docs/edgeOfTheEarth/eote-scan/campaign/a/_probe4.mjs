// scratch probe (auditor A) — 08522 health modifier & 08515 defeat forced ability (engine path)
import { loadEoteWorld, createHubGame, hubSetup, settleChoices }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...p) => out.push(p.join(' '))

const state = createHubGame(world, { seats: 2, seed: 'audit-a-probe4', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
log('scenario=', state.scenario.id)
log('scenarioZones keys=', Object.keys(state.scenarioZones || {}).join(','))
log('tekeli=', JSON.stringify(state.scenarioZones?.tekelili || state.scenarioZones?.tekeliliDeck || null).slice(0, 300))

// --- 08522 health
const tos = { id: 'tos-1', code: '08522', originalCode: '08522', name: 'Terror of the Stars', location: 'crashSite', exhausted: false, damage: 0, horror: 0, traits: ['Monster', 'Eidolon', 'Elite'] }
state.enemies.push(tos)
try {
  log('08522 enemyHealth(engine) =', world.engine.enemyHealth(state, tos), '(expected 3 + 3*2 = 9)')
} catch (e) { log('enemyHealth THREW', e.message) }
// canDiscoverClues: ready vs exhausted
const locCrash = state.locations.find(l => l.id === 'crashSite')
log('canDiscoverCrash while ready =', state.scenario.canDiscoverClues ? state.scenario.canDiscoverClues(state, state.investigators[0], locCrash) : 'n/a')
tos.exhausted = true
log('canDiscoverCrash while exhausted =', state.scenario.canDiscoverClues ? state.scenario.canDiscoverClues(state, state.investigators[0], locCrash) : 'n/a')
state.enemies = state.enemies.filter(e => e !== tos)

// --- 08515 defeat forced (engine path: scenarioBehavior.enemyDefeated + entry ability window)
const runtime = world.engine.scenarioRuntime(state, [])
try { runtime.mechanics.tekeli.initialize({ cards: ['08723', '08724', '08725', '08726', '08727', '08728', '08729'], copies: [3, 3, 2, 2, 2, 2, 2] }) } catch (e) { log('tekeli init fail', e.message) }
const deckBefore = state.investigators[0].deck.length
const horrorBefore = state.investigators[0].horror
const skit = { id: 'skit-1', code: '08515', originalCode: '08515', name: 'Skittering Nonsense', location: state.investigators[0].location, engagedSeat: 0, exhausted: false, damage: 0, horror: 0, health: 2, traits: ['Monster', 'Eidolon'] }
state.enemies.push(skit)
try {
  runtime.damageEnemy(skit.id, 2, 0, null)
  settleChoices(world, state)
  log('08515 defeated: enemies left=', state.enemies.filter(e => e.code === '08515').length,
    '| deck', deckBefore, '->', state.investigators[0].deck.length,
    '| horror', horrorBefore, '->', state.investigators[0].horror,
    '| discard=', state.encounterDiscard.length)
} catch (e) { log('08515 damageEnemy THREW', e.message) }
console.log(out.join('\n'))
