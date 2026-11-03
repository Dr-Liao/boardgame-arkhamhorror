// Main only: copy into Mod/tests, review and execute against real entry readers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, asset } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { randomValue } from '../src/engine/rules-state.js'
import road from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07198.js'
import fog from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07231.js'

const cancel = { code: 'testTicMovingCancel', abilities: [{ kind: 'forced', trigger: 'chaosTokenRevealed', cost: { exhaust: true },
  criteria: ({ context }) => context.token === 'elderthing',
  resolve: ({ context, api }) => api.chaosTokens.treat({ index: context.tokenIndex, cancel: true }) }] }
registerCardAbilities([road, fog, cancel].filter(entry => !registeredEntry(entry.code)))
const difficulties = ['easy', 'standard', 'hard', 'expert']
const hard = difficulty => ['hard', 'expert'].includes(difficulty)

function fixture(difficulty = 'standard', count = 4) {
  const s = chapterFixture('horrorInHighGear', count)
  s.difficulty = difficulty
  s.enemies = []
  for (const inv of s.investigators) Object.assign(inv, {
    willpower: 20, assets: [], threat: [], engaged: [], hand: [], damage: 0, horror: 0,
    maxHealth: 99, maxSanity: 99, clues: 4, resources: 5,
  })
  s.agendas[s.agendaIndex].doomThreshold = 99
  s.scenarioFlags.mechanics.road.deck = s.scenarioFlags.mechanics.road.deck.slice(0, 7)
  return s
}
function run(s, face, difficulty = 0, select = () => null, onResult = () => {}) {
  s.chaosBag = Array.isArray(face) ? [...face] : [face]
  if (Array.isArray(face)) {
    for (let seed = 0; seed < 100000; seed++) {
      const rng = { rngState: seed }, bag = [...face], observed = []
      while (bag.length) observed.push(bag.splice(Math.floor(randomValue(rng) * bag.length), 1)[0])
      if (face.every((token, index) => token === observed[index])) { s.rngState = seed; break }
    }
  }
  const execute = d => scenarioRuntime(d, []).test(0, 'willpower', difficulty, result => onResult(d, result))
  resolveTransaction(s, 0, { action: 'testMovingReference' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 100, 'Moving reference choice loop')
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const choice = s.pendingChoice
    const optionId = select(choice, s) ?? choice.options.find(o => ['skip', 'done', 'self'].includes(o.id))?.id ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  return s.lastTestResult
}
const delta = (difficulty, face, short = false) => ({
  skull: short ? hard(difficulty) ? -4 : -3 : hard(difficulty) ? -2 : -1,
  cultist: hard(difficulty) ? -2 : -1, tablet: hard(difficulty) ? -3 : -2, elderthing: -4,
})[face]

for (const difficulty of difficulties) for (const face of ['skull', 'cultist', 'tablet', 'elderthing']) for (const fail of [false, true]) {
  test(`07198 ${difficulty} ${face} ${fail ? 'failure3' : 'success'} actual token, passengers and Hunter with JSON`, () => {
    const s = fixture(difficulty), api = createMechanicsApi(s), here = s.investigators[0].location
    const carId = api.vehicles.of(0), passengers = [...s.scenarioFlags.mechanics.vehicles[carId].passengers]
    assert.equal(passengers.length, 2)
    const otherPassengers = s.investigators.filter(inv => !passengers.includes(inv.seat)).map(inv => inv.seat)
    const rear = Object.keys(s.scenarioFlags.mechanics.road.columns).find(id => s.scenarioFlags.mechanics.road.columns[id] === 1)
    const middle = Object.keys(s.scenarioFlags.mechanics.road.columns).find(id => s.scenarioFlags.mechanics.road.columns[id] === 2)
    const foe = enemy(s, { location: rear, hunter: true, engagedSeat: null, exhausted: false })
    const beforeClues = s.locations.find(loc => loc.id === here).clues || 0
    const expected = delta(difficulty, face)
    const result = run(s, face, fail ? 20 + expected + 3 : 0)
    assert.equal(result.value, 20 + expected)
    assert.equal(result.success, !fail)
    if (fail) assert.equal(result.failedBy, 3)
    const carriedClues = passengers.reduce((n, seat) => n + s.investigators[seat].clues, 0)
    const resources = passengers.reduce((n, seat) => n + s.investigators[seat].resources, 0)
    assert.equal(carriedClues, 8 - Number(face === 'cultist' && fail) * 3)
    assert.equal(resources, 10 - Number(face === 'tablet' && fail) * 3)
    assert.equal(s.locations.find(loc => loc.id === here).clues, beforeClues + Number(face === 'cultist' && fail) * 3)
    for (const seat of otherPassengers) {
      assert.equal(s.investigators[seat].clues, 4)
      assert.equal(s.investigators[seat].resources, 5)
    }
    const moved = face === 'elderthing' && (hard(difficulty) || fail)
    const actual = s.enemies.find(e => e.id === foe.id)
    assert.equal(actual.location, moved ? middle : rear)
    assert.equal(actual.exhausted, false)
    assert.equal(Boolean(actual.lastHunterMove), moved)
    assert.ok(s.investigators.every(inv => inv.damage === 0 && inv.horror === 0))
  })
}
for (const difficulty of difficulties) test(`07198 ${difficulty} skull actual Road deck threshold6 vs7`, () => {
  const s = fixture(difficulty)
  assert.equal(run(s, 'skull').value, 20 + delta(difficulty, 'skull'))
  s.scenarioFlags.mechanics.road.deck = s.scenarioFlags.mechanics.road.deck.slice(0, 6)
  assert.equal(run(s, 'skull').value, 20 + delta(difficulty, 'skull', true))
})
for (const face of ['cultist', 'tablet']) test(`07198 ${face} actor allocates failure margin across same car and cannot choose another car`, () => {
  const s = fixture(), api = createMechanicsApi(s), car = s.scenarioFlags.mechanics.vehicles[api.vehicles.of(0)]
  const teammate = car.passengers.find(seat => seat !== 0), selected = []
  run(s, face, 20 + delta(s.difficulty, face) + 3, choice => {
    if (choice.source !== '07198') return null
    assert.deepEqual(choice.options.map(o => Number(o.id)).sort(), [...car.passengers].sort())
    assert.equal(choice.seat, 0)
    selected.push(teammate)
    return String(teammate)
  })
  assert.equal(selected.length, 3)
  assert.equal(s.investigators[0][face === 'cultist' ? 'clues' : 'resources'], face === 'cultist' ? 4 : 5)
  assert.equal(s.investigators[teammate][face === 'cultist' ? 'clues' : 'resources'], face === 'cultist' ? 1 : 2)
})
for (const face of ['cultist', 'tablet']) test(`07198 ${face} no vehicle and insufficient passenger holdings bound actual loss`, () => {
  const s = fixture(), api = createMechanicsApi(s), id = api.vehicles.of(0)
  api.vehicles.leave(0, id, { forced: true })
  run(s, face, 99)
  assert.equal(s.investigators[0].clues, 4)
  assert.equal(s.investigators[0].resources, 5)
  const t = fixture(), mechanic = createMechanicsApi(t), car = t.scenarioFlags.mechanics.vehicles[mechanic.vehicles.of(0)]
  for (const seat of car.passengers) t.investigators[seat][face === 'cultist' ? 'clues' : 'resources'] = 1
  run(t, face, 99)
  for (const seat of car.passengers) assert.equal(t.investigators[seat][face === 'cultist' ? 'clues' : 'resources'], 0)
})
test('07198 canceled elderthing does not move Hunters or fabricate provenance', () => {
  const s = fixture('hard'), rear = Object.keys(s.scenarioFlags.mechanics.road.columns).find(id => s.scenarioFlags.mechanics.road.columns[id] === 1)
  const foe = enemy(s, { location: rear, hunter: true, engagedSeat: null, exhausted: false })
  asset(s, 'testTicMovingCancel')
  s.chaosBag = ['elderthing', '0']
  for (let seed = 0; seed < 100000; seed++) if (randomValue({ rngState: seed }) < 0.5) { s.rngState = seed; break }
  // Forced cancel leaves no token; the real pipeline draws the remaining0.
  const execute = d => scenarioRuntime(d, []).test(0, 'willpower', 0, () => {})
  resolveTransaction(s, 0, { action: 'testCanceledMovingReference' }, execute)
  while (s.pendingChoice) {
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const c = s.pendingChoice
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: c.options.find(o => ['skip', 'done', 'self'].includes(o.id))?.id ?? c.options[0].id }, execute)
  }
  assert.equal(s.enemies.find(e => e.id === foe.id).location, rear)
  assert.equal(s.enemies.find(e => e.id === foe.id).lastHunterMove, undefined)
})

function fogFixture(difficulty = 'standard') {
  const s = chapterFixture('aLightInTheFog')
  s.difficulty = difficulty
  s.enemies = []
  s.locations = ['a', 'b', 'c', 'x'].map(id => ({ id, name: id, revealed: true, traits: [], clues: 0,
    connections: { a: ['b'], b: ['a', 'c'], c: ['b'], x: [] }[id] }))
  for (const inv of s.investigators) Object.assign(inv, { location: 'c', willpower: 20,
    assets: [], threat: [], engaged: [], hand: [], damage: 0, horror: 0, maxHealth: 99, maxSanity: 99 })
  const api = createMechanicsApi(s)
  for (const loc of s.locations) api.water.set(loc.id, 0, { ignoreRestrictions: true })
  s.agendas[s.agendaIndex].doomThreshold = 99
  return s
}
for (const difficulty of difficulties) for (const face of ['skull', 'cultist', 'tablet', 'elderthing']) for (const fail of [false, true]) {
  test(`07231 ${difficulty} ${face} ${fail ? 'failure' : 'success'} actual test and effect with JSON`, () => {
    const s = fogFixture(difficulty), api = createMechanicsApi(s)
    api.water.set('c', 1)
    const foe = enemy(s, { location: 'b', engagedSeat: null, exhausted: false, aloof: true, printedAloof: true })
    api.barriers.set('b', 'c', 1)
    const expected = { skull: hard(difficulty) ? -2 : -1, cultist: -2, tablet: -3, elderthing: -4 }[face]
    const draws = face === 'skull' ? ['skull', '0'] : [face]
    const result = run(s, draws, fail ? 99 : 0)
    assert.equal(result.value, 20 + expected)
    assert.equal(result.success, !fail)
    assert.deepEqual(result.drawn, draws)
    assert.equal(s.investigators[0].damage, face === 'tablet' && fail ? hard(difficulty) ? 2 : 1 : 0)
    assert.equal(api.water.level('c'), face === 'cultist' && fail ? 2 : 1)
    const actual = s.enemies.find(e => e.id === foe.id)
    const moved = face === 'elderthing' && (hard(difficulty) || fail)
    assert.equal(actual.location, moved ? 'c' : 'b')
    assert.equal(actual.engagedSeat, moved ? 0 : null)
    assert.equal(actual.exhausted, false)
    assert.equal(actual.aloof, true)
    assert.equal(actual.lastHunterMove, undefined)
  })
}
for (const difficulty of difficulties) test(`07231 ${difficulty} cultist ST8 uses location after original result callback`, () => {
  const s = fogFixture(difficulty)
  run(s, 'cultist', 99, () => null, draft => scenarioRuntime(draft, []).moveInvestigator(0, 'b'))
  assert.equal(s.investigators[0].location, 'b')
  assert.equal(createMechanicsApi(s).water.level('b'), 1)
  assert.equal(createMechanicsApi(s).water.level('c'), 0)
})
for (const difficulty of difficulties) test(`07231 ${difficulty} full flood cannot increase; fallback horror only Hard/Expert`, () => {
  const s = fogFixture(difficulty)
  createMechanicsApi(s).water.set('c', 2)
  run(s, 'cultist', 99)
  assert.equal(createMechanicsApi(s).water.level('c'), 2)
  assert.equal(s.investigators[0].horror, Number(hard(difficulty)))
})
for (const difficulty of difficulties) test(`07231 ${difficulty} exhausted nearest enemy eligible only on Hard/Expert`, () => {
  const s = fogFixture(difficulty)
  const exhausted = enemy(s, { location: 'b', engagedSeat: null, exhausted: true, aloof: true, printedAloof: true })
  const ready = enemy(s, { location: 'a', engagedSeat: null, exhausted: false, aloof: true, printedAloof: true })
  run(s, 'elderthing', 99)
  assert.equal(s.enemies.find(e => e.id === exhausted.id).location, hard(difficulty) ? 'c' : 'b')
  assert.equal(s.enemies.find(e => e.id === exhausted.id).exhausted, true)
  assert.equal(s.enemies.find(e => e.id === ready.id).location, hard(difficulty) ? 'a' : 'b')
})
for (const difficulty of difficulties) test(`07231 ${difficulty} unflooded skull reveals no additional token; unflooded tablet no damage`, () => {
  const s = fogFixture(difficulty)
  assert.deepEqual(run(s, 'skull').drawn, ['skull'])
  run(s, 'tablet', 99)
  assert.equal(s.investigators[0].damage, 0)
})
for (const difficulty of difficulties) test(`07231 ${difficulty} canceled elderthing cannot move enemy or ignore Aloof`, () => {
  const s = fogFixture(difficulty)
  const foe = enemy(s, { location: 'b', engagedSeat: null, exhausted: false, aloof: true, printedAloof: true })
  asset(s, 'testTicMovingCancel')
  run(s, ['elderthing', '0'], 99)
  const actual = s.enemies.find(e => e.id === foe.id)
  assert.equal(actual.location, 'b')
  assert.equal(actual.engagedSeat, null)
  assert.equal(actual.aloof, true)
})
test('07231 actor chooses nearest tied enemy, excluding Massive engagement and unreachable fallback', () => {
  const s = fogFixture()
  const first = enemy(s, { location: 'b', engagedSeat: null, exhausted: false })
  const second = enemy(s, { location: 'b', engagedSeat: null, exhausted: false })
  const massive = enemy(s, { location: 'c', massive: true, engagedSeat: null, exhausted: false })
  run(s, 'elderthing', 99, choice => {
    if (choice.source !== '07231') return null
    assert.equal(choice.seat, 0)
    assert.deepEqual(choice.options.map(o => o.id).sort(), [first.id, second.id].sort())
    return second.id
  })
  assert.equal(s.enemies.find(e => e.id === first.id).location, 'b')
  assert.equal(s.enemies.find(e => e.id === second.id).location, 'c')
  assert.equal(s.enemies.find(e => e.id === massive.id).location, 'c')
  const isolated = fogFixture(), foe = enemy(isolated, { location: 'x', engagedSeat: null, exhausted: false })
  run(isolated, 'elderthing', 99)
  assert.equal(isolated.enemies.find(e => e.id === foe.id).location, 'x')
})
