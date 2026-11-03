// Main only: actual encounter draw, real Hunter execution and physical deck.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, asset } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import catching from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07219.js'
import assassin from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07215.js'
const returnEnemy = { code: 'testTicReturnHunter', abilities: [{ kind: 'forced', trigger: 'enemyMoved',
  limit: { scope: 'perWindow', owner: 'instance' }, criteria: ({ context }) => context.cause === 'hunter',
  resolve: ({ context, api }) => api.scenario.moveEnemy(context.enemy, context.from) }] }
registerCardAbilities([catching, assassin, returnEnemy].filter(entry => !registeredEntry(entry.code)))
function fixture() {
  const s = chapterFixture('horrorInHighGear')
  s.enemies = []
  s.encounterDiscard = []
  s.investigators[0].assets = []
  s.investigators[0].threat = []
  s.investigators[0].engaged = []
  return s
}
function rear(s) {
  const columns = s.scenarioFlags.mechanics.road.columns
  return s.locations.filter(l => Number.isFinite(columns[l.id])).sort((a, b) => columns[a.id] - columns[b.id])[0].id
}
function draw(s, deck) {
  s.encounterDeck = [...deck, '07219']
  const execute = d => scenarioRuntime(d, []).drawEncounter(0)
  resolveTransaction(s, 0, { action: 'testDrawCatchingUp' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 100, 'Catching Up choice loop')
    Object.assign(s, JSON.parse(JSON.stringify(s)))
    const c = s.pendingChoice, option = c.options.find(o => ['skip', 'done', 'self'].includes(o.id)) || c.options[0]
    resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: option.id }, execute)
  }
}
test('07219 actual successful Hunter movement prevents fallback search and never attacks/exhausts', () => {
  const s = fixture(), e = enemy(s, { location: rear(s), hunter: true, exhausted: false, engagedSeat: null })
  draw(s, ['07215', 'dissonantVoices'])
  assert.deepEqual(s.encounterDeck, ['07215', 'dissonantVoices'])
  assert.equal(s.enemies.length, 1)
  assert.notEqual(s.enemies.find(row => row.id === e.id).location, rear(s))
  assert.equal(s.enemies.find(row => row.id === e.id).exhausted, false)
  assert.equal(s.investigators[0].damage, 0)
})
for (const code of ['07213', '07214', '07215']) test(`07219 no actual move finds first Vehicle ${code} at physical rearmost location`, () => {
  const s = fixture(), location = rear(s)
  draw(s, ['07213', code, 'dissonantVoices'])
  assert.deepEqual(s.encounterDeck, ['07213'])
  assert.equal(s.enemies.length, 1)
  assert.equal(s.enemies[0].originalCode || s.enemies[0].code, code)
  assert.equal(s.enemies[0].location, location)
  assert.equal(s.encounterDiscard.filter(c => c === 'dissonantVoices').length, 1)
  assert.equal(s.encounterDiscard.filter(c => c === '07219').length, 1)
  assert.equal(s.encounterDiscard.includes(code), false)
})
test('07219 exhausted Hunter does not count as moving; fallback does not move/exhaust it', () => {
  const s = fixture(), e = enemy(s, { location: rear(s), hunter: true, exhausted: true, engagedSeat: null })
  draw(s, ['07215'])
  assert.equal(s.enemies.length, 2)
  assert.equal(s.enemies.find(row => row.id === e.id).location, rear(s))
  assert.equal(s.enemies.find(row => row.id === e.id).lastHunterMove, undefined)
})
test('07219 missing matching Vehicle terminates on empty deck without fabricated enemy', () => {
  const s = fixture()
  draw(s, ['dissonantVoices', 'rottingRemains'])
  assert.deepEqual(s.encounterDeck, [])
  assert.equal(s.enemies.length, 0)
  assert.deepEqual([...s.encounterDiscard].sort(), ['dissonantVoices', 'rottingRemains', '07219'].sort())
})
test('07219 actual Hunter displacement later reversed by another effect still suppresses fallback', () => {
  const s = fixture(), origin = rear(s)
  const e = enemy(s, { location: origin, hunter: true, exhausted: false, engagedSeat: null })
  asset(s, 'testTicReturnHunter')
  draw(s, ['07215'])
  assert.equal(s.enemies.find(row => row.id === e.id).location, origin)
  assert.deepEqual(s.encounterDeck, ['07215'])
  assert.equal(s.enemies.length, 1)
  assert.ok(s.enemies[0].lastHunterMove)
})
