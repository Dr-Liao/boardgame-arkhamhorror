// Main only;07215 remains proposal until authoritative criterion helper is ready.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy } from './core-fixture.mjs'
import { scenarioRuntime, disengageEnemy } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import assassin from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07215.js'
registerCardAbilities([assassin].filter(entry => !registeredEntry(entry.code)))

function fixture(actor = 'e') {
  const s = chapterFixture('horrorInHighGear')
  s.locations = ['a', 'b', 'c', 'd', 'e'].map((id, index, all) => ({ id, name: id, revealed: true, traits: [], clues: 0,
    connections: [all[index - 1], all[index + 1]].filter(Boolean) }))
  s.scenarioFlags.mechanics.vehicles = {}
  s.investigators[0].location = actor
  s.investigators[0].assets = []
  s.investigators[0].threat = []
  s.investigators[0].engaged = []
  s.enemies = []
  const foe = enemy(s, { code: '07215', location: 'a', hunter: true, exhausted: false, engagedSeat: null })
  return { s, id: foe.id }
}
function resolve(s, id, kind = 'hunter') {
  const execute = d => {
    const runtime = scenarioRuntime(d, []), foe = d.enemies.find(e => e.id === id)
    if (kind === 'effect') return runtime.moveEnemyToward(foe, 'e')
    return runtime.resolveHunterMove(foe)
  }
  resolveTransaction(s, 0, { action: 'testHybridMovement', id, kind }, execute)
  while (s.pendingChoice) {
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const c = s.pendingChoice, option = c.options.find(o => ['skip', 'done', 'self'].includes(o.id)) || c.options[0]
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: option.id }, execute)
  }
}
test('07215 actual Hunter first step triggers one extra step, no third and JSON retains once/round', () => {
  const { s, id } = fixture()
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'c')
  assert.equal(s.enemies.find(e => e.id === id).exhausted, false)
  const loaded = JSON.parse(JSON.stringify(s))
  resolve(loaded, id)
  assert.equal(loaded.enemies.find(e => e.id === id).location, 'd')
  loaded.round++
  scenarioRuntime(loaded, []).moveEnemy(loaded.enemies.find(e => e.id === id), 'a')
  resolve(loaded, id)
  assert.equal(loaded.enemies.find(e => e.id === id).location, 'c')
})
test('07215 effect move does not consume limit; subsequent Hunter move still triggers extra', () => {
  const { s, id } = fixture()
  resolve(s, id, 'effect')
  assert.equal(s.enemies.find(e => e.id === id).location, 'b')
  assert.equal(s.enemies.find(e => e.id === id).lastHunterMove, undefined)
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'd')
})
test('07215 engaging after first step does not consume limit; later unengaged move may trigger', () => {
  const { s, id } = fixture('b')
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'b')
  assert.equal(s.enemies.find(e => e.id === id).engagedSeat, 0)
  disengageEnemy(s, s.enemies.find(e => e.id === id))
  scenarioRuntime(s, []).moveInvestigator(0, 'e')
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'd')
})
test('07215 zero-displacement/exhausted attempts do not consume once-per-round limit', () => {
  const { s, id } = fixture()
  const foe = s.enemies.find(e => e.id === id)
  foe.exhausted = true
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'a')
  s.enemies.find(e => e.id === id).exhausted = false
  resolve(s, id)
  assert.equal(s.enemies.find(e => e.id === id).location, 'c')
})
test('07215 two physical copies each retain their own printed once-per-round limit', () => {
  const { s, id } = fixture()
  const second = enemy(s, { code: '07215', location: 'a', hunter: true, exhausted: false, engagedSeat: null })
  resolve(s, id)
  resolve(s, second.id)
  assert.deepEqual(s.enemies.map(e => e.location), ['c', 'c'])
})
