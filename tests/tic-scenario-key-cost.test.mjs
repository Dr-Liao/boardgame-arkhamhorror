import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { legalMoves, validateMove } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

registerCardAbilities([
  { code: 'testTicSanctumCost', scope: 'location', abilities: [{ kind: 'action', actionKind: 'activate',
    additionalKeyCost: { colors: ['blue'], destination: 'source' }, cost: { groupClues: 2 },
    resolve: ({ source, api }) => { api.water.set(source.id, 0); api.water.lock(source.id) } }] },
  { code: 'testTicGroupKeyCost', scope: 'location', abilities: [{ kind: 'action', actionKind: 'activate',
    additionalKeyCost: { colors: ['blue'], scope: 'here' }, cost: { groupClues: 2 },
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1) }] },
  { code: 'testTicMixedKeyCost', abilities: [{ kind: 'free', cost: { resources: 2, exhaust: true },
    additionalKeyCost: { colors: ['red', 'white'] }, resolve: ({ inv, api }) => api.gainResources(inv.seat, 5) }] },
])
function board(code) {
  const s = fixture('01001', 2), here = s.investigators[0].location
  s.humanSeats = [0, 1]
  Object.assign(s.locations.find(loc => loc.id === here), { code, originalCode: code, revealed: true, clues: 0 })
  s.investigators[0].clues = 1; s.investigators[1].clues = 1; s.clues = 2
  s.locations.push({ id: 'keyCostRemote', code: '01112', revealed: true, connections: [], clues: 0 })
  return s
}

test('P7 key costs: local group clues and actor key pay atomically into the actual physical source', () => {
  const s = board('testTicSanctumCost'), api = createMechanicsApi(s), here = s.investigators[0].location
  api.water.set(here, 2)
  api.keys.initialize([{ color: 'blue', holder: 'investigator:0', revealed: true }])
  const command = legalMoves(s).find(m => m.action === 'entityAbility')
  assert.ok(command); move(s, command)
  const saved = JSON.parse(JSON.stringify(s))
  settle(s); settle(saved)
  assert.deepEqual(saved.scenarioFlags.mechanics, s.scenarioFlags.mechanics)
  assert.deepEqual(s.investigators.map(inv => inv.clues), [0, 0])
  assert.deepEqual(api.keys.at(`location:${here}`), ['blue'])
  assert.equal(api.water.level(here), 0); assert.equal(api.water.change(here, 1), false)
})

test('P7 key costs: missing key or remote clue contribution rejects crafted actions without paying anything', () => {
  for (const reason of ['no-key', 'remote-clue']) {
    const s = board('testTicSanctumCost'), api = createMechanicsApi(s)
    api.keys.initialize([{ color: 'blue', holder: reason === 'no-key' ? 'investigator:1' : 'investigator:0', revealed: true }])
    if (reason === 'remote-clue') s.investigators[1].location = 'keyCostRemote'
    const before = JSON.stringify(s)
    assert.equal(legalMoves(s).some(m => m.action === 'entityAbility'), false)
    assert.notEqual(validateMove(s, 0, { action: 'entityAbility', entityId: s.investigators[0].location, abilityIndex: 0 }), null)
    assert.equal(JSON.stringify(s), before)
  }
})

test('P7 group key costs: a local teammate may pay, a remote teammate may not', () => {
  for (const remote of [false, true]) {
    const s = board('testTicGroupKeyCost'), api = createMechanicsApi(s)
    if (remote) { s.investigators[1].location = 'keyCostRemote'; s.investigators[0].clues = 2 }
    api.keys.initialize([{ color: 'blue', holder: 'investigator:1', revealed: true }])
    const command = legalMoves(s).find(m => m.action === 'entityAbility')
    assert.equal(Boolean(command), !remote)
    if (command) { move(s, command); settle(s); assert.deepEqual(api.keys.at('reference'), ['blue']) }
  }
})

test('P7 alternative key cost reuses the real colored-key selector and survives a pending-choice save', () => {
  const s = fixture(), a = asset(s, 'testTicMixedKeyCost'), api = createMechanicsApi(s)
  api.keys.initialize([{ color: 'red', holder: 'investigator:0', revealed: true }, { color: 'white', holder: 'investigator:0', revealed: true }])
  const before = s.investigators[0].resources
  move(s, legalMoves(s).find(m => m.assetId === a.id))
  assert.equal(s.pendingChoice.kind, 'mechanic'); assert.equal(s.pendingChoice.source.operation, 'spendKey')
  assert.equal(s.pendingChoice.source.stage, 'cost')
  assert.deepEqual(s.pendingChoice.options.map(o => o.keyColor), ['red', 'white'])
  const snapshot = JSON.stringify(s)
  assert.notEqual(validateMove(s, 0, { action: 'choose', choiceId: s.pendingChoice.id, optionId: 'cancel' }), null)
  assert.equal(JSON.stringify(s), snapshot)
  const saved = JSON.parse(snapshot)
  for (const state of [s, saved]) {
    move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'pick:1' })
    settle(state, c => c.kind === 'mechanic' ? 'confirm' : null)
  }
  assert.deepEqual(saved.scenarioFlags.mechanics, s.scenarioFlags.mechanics)
  assert.deepEqual(api.keys.at('reference'), ['white']); assert.deepEqual(api.keys.at('investigator:0'), ['red'])
  assert.equal(s.investigators[0].assets.find(card => card.id === a.id).exhausted, true)
  assert.equal(s.investigators[0].resources, before + 3)
})

test('P7 key cost registration rejects unknown colors and empty alternatives', () => {
  for (const colors of [[], ['orange'], ['red', 'red']]) assert.throws(() => registerCardAbilities([{ code: `testTicBadKey${colors.length}`,
    abilities: [{ kind: 'free', additionalKeyCost: { colors }, resolve() {} }] }]))
})
