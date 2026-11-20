import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { bindScenarioIdentities } from '../content/identities.js'
import { layoutFor, scenarioManifest, scenarioZoneReport } from '../content/scenario-manifest.js'
import { createGameState, removeThreat, scenarioRuntime, startScenario } from '../src/engine/engine.js'
import { createScenarioDeckApi, scenarioDeckPiles } from '../src/engine/scenario-decks.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import { asset, fixture, legalMoves, move, settle } from './core-fixture.mjs'

function rehearsal(mechanics) {
  const campaignId = 'signalStationRehearsal'
  const id = 'stationCalibration'
  const location = (id, name) => ({ id, name, shroud: 0, cluesPerInvestigator: 0, connections: [] })
  const scenario = {
    id, name: '信号站校准演练', startLocation: 'desk',
    setup: '把巡检队放在控制桌旁。', setupNote: '从中层平台沿检修通道抵达校准架。',
    locations: {
      desk: location('desk', '控制桌'), workshop: location('workshop', '维修台'),
      landing: location('landing', '中层平台'), upper: location('upper', '校准架'),
    },
    acts: [{ id: 'calibrate', stage: '1a', name: '校准信号', objective: { type: 'manual' } }],
    agendas: [{ id: 'survey', stage: '1a', name: '日照观察', doomThreshold: 12 }],
    encounterDeck: [], enemies: {}, treacheries: {}, storyAssets: {},
    resolutions: { r1: '信号灯恢复运行。' },
    mechanics,
  }
  const identities = {
    locations: {
      desk: { originalCode: '01113' }, workshop: { originalCode: '01114' },
      landing: { originalCode: '01115' }, upper: { originalCode: '01116' },
    },
  }
  bindScenarioIdentities(scenario, identities)
  const positions = { desk: { x: 2, y: 0 }, workshop: { x: 4, y: 0 },
    landing: { x: 8, y: 1 }, upper: { x: 3, y: 2 } }
  const behavior = {
    id,
    setupLocations: () => Object.keys(positions),
    afterDeckSetup(state, events, { api }) {
      api.mechanics.map.configure({ adjacency: 'rows' })
      for (const [locationId, { x, y }] of Object.entries(positions)) api.mechanics.map.place(locationId, x, y)
      api.mechanics.scenarioDecks.initialize('relaySupply', ['cryptChill', 'ancientEvils'], { shuffle: false })
    },
  }
  const manifest = scenarioManifest(scenario, identities, {
    campaignId, layout: layoutFor(scenario, positions), behaviorIds: [behavior.id],
  })
  const template = contentRegistry.getCampaign('nightOfTheZealot')
  const campaign = {
    id: campaignId, name: '信号站维护演练', schemaVersion: template.schemaVersion,
    contentVersion: template.contentVersion, minRulesVersion: template.minRulesVersion,
    requiredPackIds: [...template.requiredPackIds], chaosBags: structuredClone(template.chaosBags), status: 'playable',
    scenarioIds: [id], unlock: { [id]: [] }, recordSchema: {},
    interludeHandlerId: campaignId, resolutionIds: ['calibrationComplete'],
    flow: { start: 'calibrate', nodes: {
      calibrate: { type: 'scenario', scenarioId: id, next: 'complete' },
      complete: { type: 'end' },
    } },
  }
  return { campaign, entry: { manifest, scenario, behavior } }
}

const options = () => ({
  tasks: [{ id: 'measure', label: '校正测量仪' }, { id: 'inventory', label: '清点器材' }],
  routes: [{ id: 'service', label: '检修通道' }],
  regions: [{ id: 'landing', label: '中层平台', route: 'service' }],
  glyphs: { A: '信标校准完成' },
})

const launchTestName = '原创剧本通过真实登记和建局，注册阶段拒绝重复候选、未定义路线和非法字形'

test(launchTestName, () => {
  const bundle = tdcspec => {
    const { campaign, entry } = rehearsal({ tdc: tdcspec, noEncounterDeck: true })
    return { packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [entry] }
  }
  for (const [spec, expected] of [
    [{ ...options(), tasks: [options().tasks[0], options().tasks[0]] }, /重复/],
    [{ ...options(), regions: [{ ...options().regions[0], route: 'missing' }] }, /未知路线/],
    [{ ...options(), glyphs: { 'AA': '无效' } }, /未知机制字段/],
  ]) {
    assert.throws(() => createContentRegistry(bundle(spec)), expected)
  }

  const { campaign, entry } = rehearsal({ tdc: options(), noEncounterDeck: true })
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [entry],
  })
  assert.equal(registry.assertLaunchable(campaign.id).id, campaign.id)
  assert.equal(scenarioZoneReport(entry.scenario, entry.manifest).locationCount, 4)
  if (process.env.ARKHAM_TDC_LIFECYCLE_CHILD !== '1') {
    // The registration table is shared by every test in the bundled suite.
    const env = { ...process.env, ARKHAM_TDC_LIFECYCLE_CHILD: '1' }
    delete env.NODE_TEST_CONTEXT
    const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', launchTestName, fileURLToPath(import.meta.url)], {
      env, encoding: 'utf8',
    })
    assert.ifError(child.error)
    assert.equal(child.status, 0, `${child.stdout}${child.stderr}`)
    assert.ok(child.stdout.includes(`ok 1 - ${launchTestName}`), child.stdout)
    return
  }
  registerContentBundle({ campaigns: [campaign], scenarios: [entry] })
  const state = createGameState({ campaignId: campaign.id, playerInvestigator: '01001', seed: 'calibration-replay' }, [{ seat: 0 }])
  settle(state)
  const available = legalMoves(state).filter(option => option.action === 'move')
  assert.deepEqual(available.map(row => row.to ?? row.locationId), ['landing'])
  assert.equal(state.investigators[0].location, 'desk')
  const view = viewState(state, 0)
  assert.equal(view.mechanics.scenarioDecks.relaySupply.count, 2)
  assert.equal(view.scenario.setup, entry.scenario.setup)
  assert.equal(view.scenario.setupNote, entry.scenario.setupNote)
  assert.deepEqual(scenarioRuntime(state, []).mechanics.map.paths('desk', 'upper'), [['desk', 'landing', 'upper']])
})

test('零张窥视不打开选择窗，预先检查的失效抽牌不改变任一牌堆', () => {
  const state = fixture()
  const deck = createScenarioDeckApi(state)
  deck.initialize('relaySupply', ['cryptChill', 'ancientEvils'], { shuffle: false })
  const before = JSON.stringify(state)
  assert.equal(deck.peek('relaySupply', 0, 0), false)
  assert.throws(() => deck.revealChooseDraw('relaySupply', 0, 1, { mixEncounterTop: true }), /real encounter pipeline/)
  const invalid = createScenarioDeckApi(state, {
    choice: () => 'out-of-range',
    drawCard: () => assert.fail('无效选择不得抽牌'),
  })
  assert.throws(() => invalid.revealChooseDraw('relaySupply', 0, 1, { mixEncounterTop: true }), /Invalid scenario draw selection/)
  assert.equal(JSON.stringify(state), before)
})

test('独立牌库可选完整结算并保存去向，旧式选择抽取仍结算到主牌堆', () => {
  for (const [discardTo, expected] of [['scenario', 'sideDiscard'], [undefined, 'encounterDiscard']]) {
    const state = fixture()
    const api = scenarioRuntime(state, [])
    const deck = api.mechanics.scenarioDecks
    state.encounterDeck = ['cryptChill']
    deck.initialize('relaySupply', ['ancientEvils'], { shuffle: false })
    const execute = (draft, seat, move, events) => {
      const decks = scenarioRuntime(draft, events).mechanics.scenarioDecks
      assert.equal(decks.revealChooseDraw('relaySupply', seat, 1, { discardTo }), 'ancientEvils')
    }
    resolveTransaction(state, 0, { action: 'fixture-supply' }, execute)
    assert.deepEqual(state.pendingChoice.options.map(option => option.cardCode), ['ancientEvils'])
    resolveTransaction(state, 0, { action: 'choose', optionId: '0' }, execute)
    const saved = JSON.parse(JSON.stringify(state))
    migrateState(saved)
    assert.deepEqual(saved.encounterDeck, ['cryptChill'])
    const side = scenarioDeckPiles(saved, 'relaySupply')
    assert.deepEqual(side.deck, [])
    assert.deepEqual(side.discard, expected === 'sideDiscard' ? ['ancientEvils'] : [])
    assert.deepEqual(saved.encounterDiscard, expected === 'encounterDiscard' ? ['ancientEvils'] : [])
  }
})

test('取消明确选择的遭遇卡后，从原独立牌堆顶重抽且不复制原卡', () => {
  const state = fixture()
  state.encounterDeck = ['cryptChill']
  state.investigators[0].clues = 1
  asset(state, '02302')
  scenarioRuntime(state, []).mechanics.scenarioDecks.initialize('relaySupply', ['ghoulMinion', 'ancientEvils'], { shuffle: false })
  const execute = (draft, seat, move, events) => {
    scenarioRuntime(draft, events).mechanics.scenarioDecks.revealChooseDraw('relaySupply', seat, 1, { discardTo: 'scenario' })
  }
  resolveTransaction(state, 0, { action: 'fixture-supply' }, execute)
  resolveTransaction(state, 0, { action: 'choose', optionId: '0' }, execute)
  assert.equal(state.pendingChoice.source, 'maleson')
  resolveTransaction(state, 0, { action: 'choose', optionId: 'trigger' }, execute)
  assert.equal(state.pendingChoice, null)
  assert.deepEqual(state.encounterDeck, ['cryptChill'])
  assert.deepEqual(state.encounterDiscard, [])
  const side = scenarioDeckPiles(state, 'relaySupply')
  assert.equal(side.deck.length, 1)
  const inPlay = state.enemies.filter(enemy => enemy.code === 'ghoulMinion').map(enemy => enemy.code)
  assert.deepEqual([...side.deck, ...side.discard, ...inPlay].sort(), ['ancientEvils', 'ghoulMinion'])
})

test('独立牌库的威胁区诡计读档后仍弃回原牌库', () => {
  const state = fixture()
  const deck = scenarioRuntime(state, []).mechanics.scenarioDecks
  deck.initialize('relaySupply', ['dissonantVoices'], { shuffle: false })
  deck.draw('relaySupply', 0)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  const inv = saved.investigators[0]
  const threat = inv.threat.find(card => card.code === 'dissonantVoices')
  assert.ok(threat)
  assert.deepEqual(scenarioDeckPiles(saved, 'relaySupply').discard, [])
  assert.equal(removeThreat(saved, inv, threat, [], { seat: 0 }), true)
  assert.deepEqual(scenarioDeckPiles(saved, 'relaySupply').discard, ['dissonantVoices'])
  assert.ok(!saved.encounterDiscard.includes('dissonantVoices'))
})

test('分层地图移动走合法动作，读档保存地点与任务回执，换场清除临时牌堆', () => {
  const state = fixture('01001', 2)
  state.encounterDeck = ['ancientEvils']
  const origin = state.investigators[0].location
  state.locations.push(
    { id: 'relayLower', name: '检修平台', connections: [], revealed: true, clues: 0, shroud: 0 },
    { id: 'relayUpper', name: '指示平台', connections: [], revealed: true, clues: 0, shroud: 0 },
  )
  const { map, progress, scenarioDecks } = scenarioRuntime(state, []).mechanics
  map.configure({ adjacency: 'rows' })
  map.place(origin, 0, 0)
  map.place('relayLower', 2, 1)
  map.place('relayUpper', 5, 2)
  scenarioDecks.initialize('relaySupply', ['cryptChill', 'dissonantVoices'], { shuffle: false })
  assert.equal(progress.claim('calibrationTrack', 0, 'measure'), true)
  assert.equal(progress.claim('calibrationTrack', 1, 'measure'), false)
  assert.equal(progress.change('calibrationTrack', 0, 2, 'firstPhase'), 2)
  const destination = legalMoves(state).find(option => option.action === 'move' && (option.to ?? option.locationId) === 'relayLower')
  assert.ok(destination)
  move(state, destination)
  settle(state)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  validateMechanicState(saved)
  const savedApi = scenarioRuntime(saved, [])
  assert.equal(saved.investigators[0].location, 'relayLower')
  assert.equal(savedApi.mechanics.progress.change('calibrationTrack', 0, 2, 'firstPhase'), false)
  assert.deepEqual(savedApi.mechanics.progress.forSeat('calibrationTrack', 0), { option: 'measure', value: 2 })
  assert.deepEqual(viewState(saved, 1).mechanics.scenarioDecks, { relaySupply: { count: 2 } })
  assert.equal(viewState(saved, 1).campaign.progressTracks, undefined)
  resolveTransaction(saved, 0, { action: 'fixture-transition' }, (draft, seat, move, events) => startScenario(draft, 1, events))
  assert.equal(viewState(saved, 1).mechanics?.scenarioDecks?.relaySupply, undefined)
  assert.deepEqual(scenarioRuntime(saved, []).mechanics.progress.forSeat('calibrationTrack', 0), { option: 'measure', value: 2 })
})
