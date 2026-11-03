// Proposed integration cases for main review/execution. Worker performs syntax checks only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, move, settle } from '../tests/core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'

registerCardAbilities([
  { code: 'testEarlyAtomicSpawnObserver', abilities: [{
    kind: 'forced', trigger: 'enemySpawn', label: 'Observe exhausted state before any engagement',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ context }) => context.enemy?.code === 'ghoulMinion',
    resolve: ({ context, api, inv }) => {
      assert.equal(context.enemy.exhausted, true, 'spawn listener must already see exhausted state')
      assert.equal(context.enemy.engagedSeat, null, 'exhausted enemy must never engage during spawn')
      api.gainResources(inv.seat, 1)
    },
  }] },
  { code: 'testEarlyAtomicSpawnSave', abilities: [{
    kind: 'reaction', trigger: 'enemySpawn', label: 'Optional spawn observer creates a real pending window',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ context }) => context.enemy?.code === 'ghoulMinion',
    resolve: ({ context, api, inv }) => {
      assert.equal(context.enemy.exhausted, true)
      assert.equal(context.enemy.engagedSeat, null)
      api.gainResources(inv.seat, 2)
    },
  }] },
])
function board() {
  const s = fixture(); s.humanSeats = [0]
  const here = s.investigators[0].location
  s.locations.find(l => l.id === here).connections = ['earlySpawnRemote']
  s.locations.push({ id: 'earlySpawnRemote', code: 'plain', name: 'remote', revealed: true, connections: [here], clues: 0, shroud: 0 })
  return s
}
function start(s, options) {
  const location = s.investigators[0].location
  const exec = d => scenarioRuntime(d, []).spawn('ghoulMinion', location, options)
  resolveTransaction(s, 0, { action: 'earlyAtomicSpawnDraft' }, exec)
  return exec
}
function answer(s, exec, optionId) {
  const c = s.pendingChoice
  const m = { action: 'choose', choiceId: c.id, optionId }
  assert.equal(choiceError(s, c.seat, m), null)
  resolveTransaction(s, c.seat, m, exec)
}
function finish(s, exec, chooseReaction = false) {
  for (let n = 0; s.pendingChoice; n++) {
    assert.ok(n < 50, JSON.stringify(s.pendingChoice))
    const c = s.pendingChoice
    const chosen = chooseReaction && c.kind === 'reaction'
      ? c.options.find(o => !['skip', 'done'].includes(o.id)) : null
    answer(s, exec, chosen?.id ?? c.options.find(o => ['skip', 'done', 'self'].includes(o.id))?.id ?? c.options[0].id)
  }
}

test('atomic exhausted spawn: actual enemySpawn listener observes exhausted/unengaged before entry auto-engagement', () => {
  const s = board(); asset(s, 'testEarlyAtomicSpawnObserver')
  const resources = s.investigators[0].resources
  finish(s, start(s, { exhausted: true }))
  const e = s.enemies.find(x => x.code === 'ghoulMinion')
  assert.ok(e); assert.equal(e.exhausted, true); assert.equal(e.engagedSeat, null)
  assert.deepEqual(s.investigators[0].engaged, [])
  assert.equal(s.investigators[0].resources, resources + 1, 'real listener must resolve exactly once')
})

test('atomic exhausted spawn: pending spawn reaction survives JSON with identical enemy instance and limits', () => {
  const s = board(); asset(s, 'testEarlyAtomicSpawnSave')
  const resources = s.investigators[0].resources
  const exec = start(s, { exhausted: true })
  assert.ok(s.pendingChoice, 'must exercise an actual pending enemySpawn reaction')
  const saved = JSON.parse(JSON.stringify(s))
  finish(s, exec, true); finish(saved, exec, true)
  assert.equal(s.investigators[0].resources, resources + 2)
  assert.equal(s.enemies.filter(e => e.code === 'ghoulMinion').length, 1)
  assert.equal(s.enemies.find(e => e.code === 'ghoulMinion').exhausted, true)
  assert.equal(s.enemies.find(e => e.code === 'ghoulMinion').engagedSeat, null)
  assert.deepEqual(saved, s)
})

test('atomic exhausted spawn: omitted options preserve ready default and ordinary entry can still engage', () => {
  const s = board(); const location = s.investigators[0].location
  finish(s, start(s))
  const e = s.enemies.find(x => x.code === 'ghoulMinion')
  assert.ok(e); assert.equal(e.exhausted, false)
  // runtime.spawn historically passes engagedSeat:null. Test the actual subsequent
  // movement/auto-engagement pipeline, rather than inventing a new spawn timing.
  move(s, { action: 'move', locationId: 'earlySpawnRemote' }); settle(s)
  move(s, { action: 'move', locationId: location }); settle(s)
  assert.equal(s.enemies.find(x => x.id === e.id).engagedSeat, 0)
  assert.ok(s.investigators[0].engaged.includes(e.id))
})
