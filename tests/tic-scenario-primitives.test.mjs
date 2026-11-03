import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle, asset } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { legalMoves, validateMove, scenarioRuntime, canDamageEnemy, damageEnemy, checkAct, revealLocation } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { beginAirTurn, endAirTurn } from '../src/engine/flood.js'
import { locationLookCandidates } from '../src/engine/location-look.js'
import { enumerateTargets } from '../src/engine/targets.js'
import { validateInvestigatorMechanics } from '../src/engine/investigator-mechanics.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { viewState } from '../src/integration/observation.js'

registerCardAbilities([
  { code: 'testTicFreeLocation', scope: 'location', abilities: [{ kind: 'free', actionKind: 'activate',
    cost: { resources: 1, exhaust: true }, label: '本地点免费能力', criteria: ({ source }) => !source.exhausted,
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 3) }] },
  { code: 'testTicActionLocation', scope: 'location', abilities: [{ kind: 'action', actionKind: 'activate',
    label: '本地点普通行动', resolve: ({ inv, api }) => api.gainResources(inv.seat, 1) }] },
  { code: 'testTicRemoteLocation', scope: 'location', abilities: [{ kind: 'free', actionKind: 'activate', range: 'connecting',
    cost: { resources: 1 }, label: '连接地点免费能力', resolve: ({ inv, api }) => api.gainResources(inv.seat, 2) }] },
  { code: 'testTicNoBarrier', scope: 'location', locationRule: { cannotPlaceBarriers: true } },
  { code: 'testTicFloodCap', scope: 'location', locationRule: { floodBounds: { max: 1 } } },
  { code: 'testTicGroupClues', abilities: [{ kind: 'action', cost: { groupClues: 3, resources: 1 }, label: '本地点共同支付三线索',
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 2) }] },
  { code: 'testTicGlobalClues', abilities: [{ kind: 'action', groupClueScope: 'anywhere', cost: { groupClues: 3 }, label: '全图共同支付三线索',
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 2) }] },
  { code: 'testTicAllDrawBlock', scope: 'treachery', modifiers: [{ target: 'capability:drawCards' }, { target: 'capability:gainResources' }] },
  { code: 'testTicActionDrawBlock', scope: 'treachery', modifiers: [{ target: 'capability:draw' }] },
  { code: 'testTicImmuneEnemy', scope: 'enemy', modifiers: [{ target: 'cannot:beDamaged' }] },
  { code: 'testTicObjectiveLocation', scope: 'location', locationRule: { objective: state => state.enemies.length === 0 } },
  { code: 'testTicFailedObserver', abilities: [{ kind: 'forced', trigger: 'skillTestFailed',
    criteria: ({ inv, context }) => inv.seat === context.seat && context.result.success === false,
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1) }] },
  { code: 'testTicTestInitiator', abilities: [{ kind: 'action', label: '进行真实检定',
    resolve: ({ inv, api }) => api.scenario.test(inv.seat, 'willpower', 5, () => {}) }] },
  { code: 'testTicLeads', abilities: [{ kind: 'action', label: '从线索牌库选择并真实抽取',
    resolve: ({ inv, api }) => api.scenarioDecks.revealChooseDraw('leads', inv.seat, 2, { mixEncounterTop: true }) }] },
  { code: 'testTicTypedTarget', assetRule: { trackTestTarget: true } },
  { code: 'testTicLocationLook', abilities: [{ kind: 'action', label: '查看本行地点',
    resolve: ({ inv, api }) => api.scenario.lookAtLocation(inv.seat, { rowOf: inv.location, unrevealedNames: ['Tidal Tunnel'] }) }] },
  { code: 'testTicAheadLook', abilities: [{ kind: 'action', label: '查看前方道路',
    resolve: ({ inv, api }) => api.scenario.lookAtLocation(inv.seat, { aheadOf: inv.location, includeRevealed: true }) }] },
  { code: 'testTicRemoteInvestigation', abilities: [{ kind: 'action', label: '远处调查',
    resolve: ({ inv, api }) => api.investigate(inv.seat, { locationId: 'remote-investigation', noSpend: true }) }] },
])
test('P7 movement target query shares legal movement checks and barrier restrictions', () => {
  const s = fixture(), inv = s.investigators[0], here = s.locations.find(l => l.id === inv.location)
  here.connections = ['open', 'blocked']
  s.locations.push(...['open', 'blocked'].map(id => ({ id, code: '01112', revealed: true, connections: [here.id] })))
  createMechanicsApi(s).barriers.set(here.id, 'blocked', 1)
  const query = { kind: 'location', query: ({ candidate, canMoveTo, helpers }) => canMoveTo(candidate.id) && helpers.canMoveTo(0, candidate.id) }
  assert.deepEqual(enumerateTargets(s, inv, query).map(x => x.id), ['open'])
  assert.equal(validateMove(s, 0, { action: 'move', locationId: 'blocked' }) != null, true)
})
function setLocation(state, code) {
  Object.assign(state.locations.find(loc => loc.id === state.investigators[0].location), { code, originalCode: code, revealed: true })
}

test('P7 location look: actual private choice exposes only the chosen seat and leaves the map unrevealed', () => {
  const s = fixture('01001', 2), here = s.investigators[0].location
  s.humanSeats = [0, 1]
  s.locations.push({ id: 'opaque-tunnel', code: '07102', originalCode: '07102', name: '水下洞穴',
    unrevealedName: '潮水通道', hiddenIdentity: true, revealed: false, connections: [here], maxClues: 1, clues: 0 })
  const api = createMechanicsApi(s)
  api.map.place(here, 0, 0); api.map.place('opaque-tunnel', 1, 0)
  const a = asset(s, 'testTicLocationLook')
  move(s, legalMoves(s).find(m => m.assetId === a.id))
  assert.equal(s.pendingChoice.kind, 'location')
  move(s, { action: 'choose', choiceId: s.pendingChoice.id, optionId: 'opaque-tunnel' })
  assert.equal(viewState(s, 0).pendingChoice.options[0].cardCode, '07102')
  assert.deepEqual(viewState(s, 1).pendingChoice.options, [])
  assert.equal(s.locations.find(l => l.id === 'opaque-tunnel').revealed, false)
  settle(s)
  assert.equal(s.locations.find(l => l.id === 'opaque-tunnel').clues, 0)
  const global = enumerateTargets(s, s.investigators[0], { kind: 'location', range: 'anywhere' })
  assert.ok(global.some(t => t.id === 'opaque-tunnel'))
})

test('P7 air: lowering water in place does not replace actually entering a breathable location', () => {
  const s = fixture(), here = s.investigators[0].location, api = createMechanicsApi(s)
  api.water.set(here, 2); beginAirTurn(s, 0)
  api.water.set(here, 1)
  const hits = []
  assert.equal(endAirTurn(s, 0, (seat, amount) => hits.push([seat, amount])), 5)
  assert.deepEqual(hits, [[0, 5]])
})

test('P7 all-draw prohibition blocks card effects and resource gains; action-only prohibition preserves card effects', () => {
  const s = fixture(), inv = s.investigators[0], api = scenarioRuntime(s, [])
  const initial = inv.resources
  inv.threat.push({ id: 'allDrawBlock', code: 'testTicAllDrawBlock' })
  api.drawCards(0, 2); api.gainResources(0, 3)
  assert.equal(inv.hand.length, 0); assert.equal(inv.resources, initial)
  inv.threat = [{ id: 'actionDrawBlock', code: 'testTicActionDrawBlock' }]
  api.drawCards(0, 2); api.gainResources(0, 3)
  assert.equal(inv.hand.length, 2); assert.equal(inv.resources, initial + 3)
})

test('P7 damage target preflight and the damage pipeline agree on immunity', () => {
  const s = fixture(), normal = enemy(s), immune = enemy(s, { code: 'testTicImmuneEnemy' })
  assert.equal(canDamageEnemy(s, normal, 0), true)
  assert.equal(canDamageEnemy(s, immune, 0), false)
  const candidates = enumerateTargets(s, s.investigators[0], { kind: 'enemy', query: ({ candidate, canDamageEnemy }) => canDamageEnemy(candidate.entity) })
  assert.deepEqual(candidates.map(t => t.id), [normal.id])
  assert.equal(damageEnemy(s, immune, 2, 0, []), false); assert.equal(immune.damageTaken, 0)
  assert.equal(damageEnemy(s, normal, 2, 0, []), true); assert.equal(normal.damageTaken, 2)
})

test('P7 location objectives use current revealed physical locations and advance the actual act', () => {
  const s = fixture(); setLocation(s, 'testTicObjectiveLocation')
  s.acts = [{ id: 'actTest1', code: 'testAct1', name: '阶段1' }, { id: 'actTest2', code: 'testAct2', name: '阶段2' }]
  enemy(s); checkAct(s, []); assert.equal(s.actIndex, 0)
  s.enemies = []; s.investigators[0].engaged = []
  s.locations[0].revealed = false; checkAct(s, []); assert.equal(s.actIndex, 0)
  s.locations[0].revealed = true; checkAct(s, []); assert.equal(s.actIndex, 1)
})

test('P7 global group-clue costs accept distant contributors while spending each real clue exactly once', () => {
  const s = fixture('01001', 2), inv = s.investigators[0]
  s.locations.push({ id: 'remote-contributor', code: '01112', revealed: true, connections: [], clues: 0 })
  s.investigators[1].location = 'remote-contributor'
  inv.clues = 1; s.investigators[1].clues = 2; s.clues = 3
  const a = asset(s, 'testTicGlobalClues'), before = inv.resources
  move(s, legalMoves(s).find(m => m.assetId === a.id)); settle(s)
  assert.deepEqual(s.investigators.map(i => i.clues), [0, 0]); assert.equal(s.clues, 0)
  assert.equal(s.investigators[0].resources, before + 2)
})

for (const token of ['autofail', '-8', '0']) test(`P7 failed-test result window is once for the performer with ${token}, including another investigator's commitment`, () => {
  const s = fixture('01001', 2); s.humanSeats = [0, 1]
  s.investigators[0].willpower = token === '0' ? 20 : 1
  s.investigators[1].hand = ['01089']; s.chaosBag = [token]
  for (let seat = 0; seat < 2; seat++) asset(s, 'testTicFailedObserver', {}, seat)
  const before = s.investigators.map(i => i.resources), a = asset(s, 'testTicTestInitiator')
  move(s, legalMoves(s).find(m => m.assetId === a.id))
  let asked = false
  settle(s, c => {
    if (c.kind === 'commit' && c.seat === 0 && !asked && c.options.some(o => o.id === 'help')) { asked = true; return 'help' }
    if (c.kind === 'commit' && c.seat === 1 && c.options.some(o => o.id === '0')) return '0'
    return null
  })
  assert.ok(s.investigators[1].discard.includes('01089'), 'the other investigator really committed a physical card')
  assert.deepEqual(s.investigators.map((i, seat) => i.resources - before[seat]), [Number(token !== '0'), 0])
})

test('P7 reveal water policy replaces its predecessor, respects permanent flood locks and survives JSON', () => {
  const s = fixture(), api = createMechanicsApi(s)
  for (const id of ['policyFirst', 'policySecond', 'policyLocked']) {
    s.scenario.locations[id] = { id, code: '01112', originalCode: '01112', name: id, clues: 0, connections: [] }
    scenarioRuntime(s, []).place(id)
  }
  api.water.setRevealPolicy({ mode: 'increase', amount: 1 })
  revealLocation(s, 'policyFirst', []); assert.equal(api.water.level('policyFirst'), 1)
  api.water.setRevealPolicy({ mode: 'set', amount: 2 })
  revealLocation(s, 'policySecond', []); assert.equal(api.water.level('policySecond'), 2)
  api.water.lock('policyLocked'); revealLocation(s, 'policyLocked', [])
  assert.equal(api.water.level('policyLocked'), 0); assert.equal(api.water.canChange('policyLocked', 1), false)
  assert.equal(api.water.set('policyLocked', 1), false)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})

test('P7 local held keys include the local living group and exclude unclaimed, remote and eliminated holders', () => {
  const s = fixture('01001', 3), api = createMechanicsApi(s), here = s.investigators[0].location
  s.locations.push({ id: 'keyRemote', code: '01112', name: '远处', revealed: true, connections: [] })
  s.investigators[2].location = 'keyRemote'
  api.keys.initialize([{ color: 'blue', holder: 'investigator:0', revealed: true },
    { color: 'green', holder: 'investigator:1', revealed: true }, { color: 'red', holder: 'investigator:2', revealed: true },
    { color: 'purple', holder: `location:${here}`, revealed: true }])
  assert.deepEqual(api.keys.heldAtLocation(here).sort(), ['blue', 'green'])
  s.investigators[1].resigned = true
  assert.deepEqual(api.keys.heldAtLocation(here), ['blue'])
})

test('P7 road look: only actual forward columns qualify, including revealed cards without revealing hidden ones', () => {
  const s = fixture(), here = s.investigators[0].location
  for (const [id, revealed] of [['behind', true], ['ahead-revealed', true], ['ahead-hidden', false]]) {
    s.locations.push({ id, code: '07204a', originalCode: '07204a', name: id, revealed, connections: [], clues: 0 })
  }
  createMechanicsApi(s).map.initializeRoad({ deck: [], columns: { behind: 1, [here]: 2, 'ahead-revealed': 3, 'ahead-hidden': 4 } })
  const opts = { aheadOf: here, includeRevealed: true }
  assert.deepEqual(locationLookCandidates(s, opts).map(l => l.id), ['ahead-revealed', 'ahead-hidden'])
  assert.deepEqual(locationLookCandidates(s, { aheadOf: 'missing', includeRevealed: true }), [])
  const a = asset(s, 'testTicAheadLook')
  move(s, legalMoves(s).find(m => m.assetId === a.id))
  assert.deepEqual(s.pendingChoice.options.map(o => o.id), ['ahead-revealed', 'ahead-hidden'])
  move(s, { action: 'choose', choiceId: s.pendingChoice.id, optionId: 'ahead-hidden' }); settle(s)
  assert.equal(s.locations.find(l => l.id === 'ahead-hidden').revealed, false)
})

test('P7 printed encounter location placement reuses one physical instance and runs actual revelation', () => {
  const s = fixture()
  s.scenario.locations.onlyPhysical = { id: 'onlyPhysical', code: '07070', originalCode: '07070', name: '遭遇地点',
    cluesPerInvestigator: 2, shroud: 3, connections: [] }
  const execute = draft => scenarioRuntime(draft, []).placePrintedLocation('07070', { seat: 0 })
  resolveTransaction(s, 0, { action: 'testPrintedPlace' }, execute); settle(s)
  assert.equal(s.locations.filter(l => l.originalCode === '07070').length, 1)
  assert.equal(s.locations.find(l => l.id === 'onlyPhysical').clues, 2)
  resolveTransaction(s, 0, { action: 'testPrintedPlaceAgain' }, execute); settle(s)
  assert.equal(s.locations.filter(l => l.originalCode === '07070').length, 1)
})
test('P7 nonplayer: a real location free ability pays resources, uses no action and provokes no attack', () => {
  const s = fixture(); setLocation(s, 'testTicFreeLocation'); enemy(s, { damage: 3 })
  const before = s.investigators[0].resources, actions = s.investigators[0].actionsLeft
  const command = legalMoves(s).find(m => m.action === 'entityAbility')
  assert.ok(command); assert.equal(validateMove(s, 0, command), null)
  move(s, command); settle(s)
  assert.equal(s.investigators[0].resources, before + 2)
  assert.equal(s.investigators[0].actionsLeft, actions); assert.equal(s.investigators[0].damage, 0)
  assert.equal(legalMoves(s).some(m => m.action === 'entityAbility'), false)
})

test('P7 barriers: undirected counts block real movement, respect placement policy and survive JSON', () => {
  const s = fixture(), from = s.investigators[0].location
  s.locations[0].connections = ['next']
  s.locations.push({ id: 'next', code: 'testTicNoBarrier', revealed: true, connections: [from] })
  const api = createMechanicsApi(s)
  assert.equal(api.barriers.set(from, 'next', 1), false)
  assert.equal(api.barriers.set(from, 'next', 2, { setup: true }), 2)
  assert.equal(api.barriers.count('next', from), 2)
  assert.notEqual(validateMove(s, 0, { action: 'move', locationId: 'next' }), null)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
  assert.equal(viewState(s, 0).mechanics.barriers[0].count, 2)
  api.barriers.change('next', from, -2)
  assert.equal(validateMove(s, 0, { action: 'move', locationId: 'next' }), null)
  const bad = structuredClone(s); bad.scenarioFlags.mechanics.barriers = [{ a: from, b: from, count: 1 }]
  assert.throws(() => validateMechanicState(bad))
})

test('P7 flood: declared bounds restrict changes and notify actual changes only', () => {
  const s = fixture(); setLocation(s, 'testTicFloodCap')
  const id = s.investigators[0].location, changes = []
  const api = createMechanicsApi(s, { floodChanged: change => changes.push(change) })
  assert.equal(api.water.canChange(id, 1), true)
  assert.equal(api.water.set(id, 2), 1)
  assert.equal(api.water.canChange(id, 1), false)
  api.water.change(id, 1)
  assert.equal(changes.length, 1)
  assert.deepEqual(changes[0], { location: id, before: 0, after: 1, delta: 1 })
  assert.throws(() => registerCardAbilities([{ code: 'testTicBadFloodCap', scope: 'location', locationRule: { floodBounds: { max: 3 } } }]))
})

test('P7 group clue costs: only local eligible clues pay, and failed preflight preserves all costs', () => {
  const s = fixture('01001', 2); s.humanSeats = [0, 1]
  const tool = asset(s, 'testTicGroupClues')
  s.locations.push({ id: 'remote', connections: [], clues: 0, shroud: 0, revealed: true })
  s.investigators[1].location = 'remote'
  s.investigators[0].clues = 1; s.investigators[1].clues = 2
  const resources = s.investigators[0].resources
  assert.equal(legalMoves(s).some(m => m.assetId === tool.id), false)
  s.investigators[1].location = s.investigators[0].location
  const command = legalMoves(s).find(m => m.assetId === tool.id)
  assert.ok(command); move(s, command); settle(s)
  assert.equal(s.investigators[0].clues + s.investigators[1].clues, 0)
  assert.equal(s.investigators[0].resources, resources + 1)
  assert.equal(legalMoves(s).some(m => m.assetId === tool.id), false)
})

test('P7 private decks: selected leads follow the real encounter pipeline and conserve duplicates and top card', () => {
  const s = fixture(), api = createMechanicsApi(s)
  api.scenarioDecks.initialize('leads', ['dissonantVoices', 'ghoulMinion'], { shuffle: false })
  s.encounterDeck = ['dissonantVoices']
  const host = asset(s, 'testTicLeads')
  move(s, legalMoves(s).find(m => m.assetId === host.id)); settle(s, c => c.source === 'leads' ? '0' : null)
  assert.equal(s.enemies.filter(e => e.code === 'ghoulMinion').length, 1)
  assert.deepEqual(api.scenarioDecks.cards('leads'), ['dissonantVoices', 'dissonantVoices'])
  assert.equal(s.encounterDeck.length, 0)
  const current = createMechanicsApi(s)
  assert.equal(current.scenarioDecks.removeTop('leads'), 1)
  assert.deepEqual(viewState(s, null).mechanics.scenarioDecks, { leads: { count: 1 } })
  assert.equal(JSON.stringify(viewState(s, null)).includes('scenarioDecks\":{\"leads\":{\"deck'), false)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})

test('P7 typed test target: real remote investigation exposes a stable physical target to modifiers and saves', () => {
  const s = fixture(); asset(s, 'testTicTypedTarget')
  const here = s.investigators[0].location
  s.locations.push({ id: 'remote-investigation', code: '01112', originalCode: '01112', revealed: true, shroud: 0,
    clues: 2, name: '远处地点', connections: [here] })
  s.investigators[0].hand = ['01090']
  const tool = asset(s, 'testTicRemoteInvestigation')
  move(s, legalMoves(s).find(m => m.assetId === tool.id))
  assert.deepEqual(s.skillTest.target, { kind: 'location', id: 'remote-investigation' })
  assert.equal(s.skillTest.actionKind, 'investigate')
  assert.equal(validateInvestigatorMechanics(JSON.parse(JSON.stringify(s))), true)
  const bad = structuredClone(s); bad.skillTest.target.kind = 'card'; assert.throws(() => validateInvestigatorMechanics(bad))
})

test('P7 grid: orthogonal expansion conserves physical tiles, excludes isolated cells from rows and rejects collisions', () => {
  const s = fixture(), start = s.investigators[0].location
  const api = createMechanicsApi(s, { placeLocation: id => { s.locations.push({ id, name: id, connections: [] }); return id } })
  api.map.place(start, 0, 0)
  api.scenarioDecks.initialize('tiles', ['tile2', 'tile1'], { shuffle: false })
  assert.deepEqual(api.map.expand(start, [{ x: 1, y: 0 }, { x: 0, y: 1 }], 'tiles'), ['tile1', 'tile2'])
  assert.deepEqual(s.locations[0].connections.sort(), ['tile1', 'tile2'])
  assert.equal(s.locations.find(loc => loc.id === 'tile1').connections.includes('tile2'), false, 'diagonals are not connected')
  assert.equal(api.map.place('collision', 1, 0), false)
  api.map.place('holding', 5, 0, { isolated: true })
  assert.equal(api.map.locations({ row: 0 }).some(loc => loc.id === 'holding'), false)
  assert.equal(validateMechanicState(JSON.parse(JSON.stringify(s))), undefined)
})
test('P7 nonplayer: ordinary entity actions spend an action and provoke opportunity attacks', () => {
  const s = fixture(); setLocation(s, 'testTicActionLocation'); enemy(s, { damage: 3 })
  const actions = s.investigators[0].actionsLeft
  move(s, legalMoves(s).find(m => m.action === 'entityAbility')); settle(s)
  assert.equal(s.investigators[0].actionsLeft, actions - 1)
  assert.equal(s.investigators[0].damage, 3)
})
test('P7 nonplayer: ranges reject forged remote and unrevealed location abilities', () => {
  const s = fixture(); setLocation(s, 'testTicFreeLocation')
  const here = s.investigators[0].location
  s.locations.push({ id: 'far', code: 'testTicFreeLocation', revealed: true, connections: [] })
  assert.notEqual(validateMove(s, 0, { action: 'entityAbility', entityId: 'far', abilityIndex: 0 }), null)
  s.locations[0].revealed = false
  assert.equal(legalMoves(s).some(m => m.action === 'entityAbility'), false)
  s.locations[0].revealed = true; s.locations[0].connections = ['far']
  s.locations[1].code = 'testTicRemoteLocation'
  assert.ok(legalMoves(s).some(m => m.entityId === 'far'))
  assert.equal(s.investigators[0].location, here)
  assert.throws(() => registerCardAbilities([{ code: 'testTicMalformedRange', scope: 'location',
    abilities: [{ kind: 'free', actionKind: 'activate', range: 'universe', resolve() {} }] }]))
})
