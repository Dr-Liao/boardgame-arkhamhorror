import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { registerCardAbilities } from '../src/engine/ability.js'
import { ALL_TREACHERIES } from '../src/engine/card-lookup.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { scenarioDeckPiles } from '../src/engine/scenario-decks.js'
import { migrateState } from '../src/engine/save-migration.js'
import { asset, fixture, move, settle } from './core-fixture.mjs'

const supply = 'serviceManual'
const cases = [
  ['marker', (api, inv, code) => api.attachToLocation(inv.location, { code })],
  ['warning', (api, inv, code) => api.attachToAgenda(code)],
  ['indicator', (api, inv, code) => api.attachToAsset(inv.seat, inv.assets[0].id, code)],
  ['seal', (api, inv, code) => api.attachEncounterToLocation(code, 'workbenchAnnex')],
  ['twin', (api, inv, code) => {
    const physical = api.attachToLocation(inv.location, { code })
    api.attachToLocation(inv.location, { code })
    return physical
  }],
]
const codeFor = name => `p7-fixture-${name}`
const aliasFor = name => `p7-fixture-physical-${name}`

function registerFixtures() {
  for (const [name, attach] of cases) {
    const code = codeFor(name)
    const alias = aliasFor(name)
    registerCardAbilities({ code, scope: 'treachery', abilities: [],
      ...(name === 'warning' ? { treacheryRule: { discardAtRoundEnd: true } } : {}),
      encounterResolve(_state, inv, _card, api) { return Boolean(attach(api, inv, code)) },
    })
    const display = { name: `检修标记 ${name}`, type: 'treachery', entryRevelation: true }
    ALL_TREACHERIES[code] = { ...display, code }
    ALL_TREACHERIES[alias] = { ...display, code: alias, originalCode: code }
  }
}

function removeFixtureDefinitions() {
  for (const [name] of cases) {
    delete ALL_TREACHERIES[codeFor(name)]
    delete ALL_TREACHERIES[aliasFor(name)]
  }
}

function drawFromSupply(state, name) {
  const api = scenarioRuntime(state, [])
  api.mechanics.scenarioDecks.initialize(supply, [aliasFor(name)], { shuffle: false })
  assert.equal(api.mechanics.scenarioDecks.draw(supply, 0), aliasFor(name))
  assert.deepEqual(scenarioDeckPiles(state, supply).deck, [])
  assert.deepEqual(scenarioDeckPiles(state, supply).discard, [])
}

function assertReturned(state, name) {
  assert.deepEqual(scenarioDeckPiles(state, supply).discard, [aliasFor(name)])
  assert.ok(!state.encounterDiscard.includes(codeFor(name)))
  assert.ok(!state.encounterDiscard.includes(aliasFor(name)))
}

function detachAfterSave() {
  const state = fixture()
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  const main = scenarioRuntime(state, []).attachToLocation(location.id, { code: codeFor('marker') })
  drawFromSupply(state, 'marker')
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  const restored = saved.locations.find(item => item.id === location.id)
  const side = restored.attachments.find(item => item.id !== main.id)
  assert.equal(side.discardToScenarioDeck, supply)
  assert.equal(side.scenarioDeckCode, aliasFor('marker'))
  const api = scenarioRuntime(saved, [])
  assert.equal(api.detachEncounterAttachmentById(side.id), true)
  assert.equal(api.detachEncounterAttachmentById(side.id), false)
  assertReturned(saved, 'marker')
  assert.equal(restored.attachments[0].id, main.id)
  assert.equal(api.detachEncounterAttachment(restored.attachments[0]), true)
  assert.deepEqual(saved.encounterDiscard, [codeFor('marker')])
}

function discardWithHost() {
  const locationState = fixture()
  locationState.locations.push({ id: 'workbenchAnnex', name: '维修台侧室', connections: [], revealed: true })
  drawFromSupply(locationState, 'seal')
  scenarioRuntime(locationState, []).removeLocationFromGame('workbenchAnnex')
  assert.ok(!locationState.locations.some(location => location.id === 'workbenchAnnex'))
  assertReturned(locationState, 'seal')

  const assetState = fixture()
  const host = asset(assetState, '01017')
  drawFromSupply(assetState, 'indicator')
  scenarioRuntime(assetState, []).discardAsset(0, host.id)
  assert.ok(!assetState.investigators[0].assets.some(item => item.id === host.id))
  assertReturned(assetState, 'indicator')
}

function discardAtRoundEnd() {
  const state = fixture()
  state.encounterDeck = []
  drawFromSupply(state, 'warning')
  assert.equal(state.agendas[state.agendaIndex].attachments.length, 1)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.agendas[state.agendaIndex].attachments.length, 0)
  assertReturned(state, 'warning')
}

function transferOnlyThePhysicalCard() {
  const state = fixture()
  const { location } = state.investigators[0]
  drawFromSupply(state, 'twin')
  const api = scenarioRuntime(state, [])
  const [physical, duplicate] = api.locationAttachments(location)
  assert.equal(physical.discardToScenarioDeck, supply)
  assert.equal(duplicate.discardToScenarioDeck, undefined)
  const transferred = api.detachLocationAttachment(location, physical.id)
  assert.deepEqual(state.encounterDiscard, [])
  assert.deepEqual(scenarioDeckPiles(state, supply).discard, [])
  const newHost = api.attachToAct(transferred.code, transferred)
  assert.equal(api.detachEncounterAttachment(newHost), true)
  assertReturned(state, 'twin')
  assert.deepEqual(api.locationAttachments(location), [duplicate])
}

const path = fileURLToPath(import.meta.url)
if (process.argv[1] === path || process.env.ARKHAM_SCENARIO_ATTACHMENTS_CHILD === '1') {
  test.before(registerFixtures)
  test.after(removeFixtureDefinitions)
  test('独立牌库原号随地点附属存档，按实例重新弃回并保留主牌库同名副本', detachAfterSave)
  test('主持地点与受控支援分别离场时将附属送回原牌库', discardWithHost)
  test('轮末密谋附属去向仍是抽出它的独立牌库', discardAtRoundEnd)
  test('只认领本次抽出的实物，取下重挂不触发弃牌', transferOnlyThePhysicalCard)
} else {
  test('独立牌库附属在隔离进程覆盖留场、弃回与转移', () => {
    const env = { ...process.env, ARKHAM_SCENARIO_ATTACHMENTS_CHILD: '1' }
    delete env.NODE_TEST_CONTEXT
    const child = spawnSync(process.execPath, ['--test', path], { env, encoding: 'utf8' })
    assert.ifError(child.error)
    assert.equal(child.status, 0, `${child.stdout}${child.stderr}`)
  })
}
