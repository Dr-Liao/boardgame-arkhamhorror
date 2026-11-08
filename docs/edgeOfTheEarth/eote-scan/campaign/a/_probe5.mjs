// scratch probe (auditor A) — 08515 double effect, 08522 health, Part3 shelter/clues data
import { loadEoteWorld, createHubGame, hubSetup, settleChoices }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...p) => out.push(p.join(' '))
const root = 'file:///G:/boardgame-hall-ai/games/arkhamhorror/'
const tek = await import(root + 'src/engine/eote-tekeli.js')

const state = createHubGame(world, { seats: 2, seed: 'audit-a-probe5', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })

// --- 08522 health with printed health
const tos = { id: 'tos-1', code: '08522', originalCode: '08522', name: 'Terror of the Stars', location: 'crashSite', exhausted: false, damage: 0, horror: 0, health: 3, traits: ['Monster', 'Eidolon', 'Elite'] }
state.enemies.push(tos)
log('08522 enemyHealth(engine) with printed health 3 =', world.engine.enemyHealth(state, tos), '(expected 3 + 3*2 = 9)')
state.enemies = state.enemies.filter(e => e !== tos)

// --- 08515 double forced effect
log('tekeli deck size after setup =', tek.tekeliDeckSize(state))
const runtime = world.engine.scenarioRuntime(state, [])
const deckBefore = state.investigators[0].deck.length
const tekBefore = tek.tekeliDeckSize(state)
const horrorBefore = state.investigators[0].horror
const skit = { id: 'skit-1', code: '08515', originalCode: '08515', name: 'Skittering Nonsense', location: state.investigators[0].location, engagedSeat: 0, exhausted: false, damage: 0, horror: 0, health: 2, traits: ['Monster', 'Eidolon'] }
state.enemies.push(skit)
runtime.damageEnemy(skit.id, 2, 0, null)
settleChoices(world, state)
log('08515 defeated: deck', deckBefore, '->', state.investigators[0].deck.length,
  '| tekeli', tekBefore, '->', tek.tekeliDeckSize(state),
  '| horror', horrorBefore, '->', state.investigators[0].horror)

// --- Part3 shelter/clues data (definition level; engine part3 state already probed separately)
const p3 = await import(root + 'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js')
log('P3 crashSite shelter=', p3.LOCATIONS.crashSite.shelter, 'cluesPI=', p3.LOCATIONS.crashSite.cluesPerInvestigator)
log('P3 CAMPS=', p3.CAMPS.join(','))
console.log(out.join('\n'))
