import test from 'node:test'
import assert from 'node:assert/strict'
import arkham from '../index.js'
import { createGameState } from '../src/engine/engine.js'
import { isCardAvailable } from '../src/deck/availability.js'
import {
  CONTENT_SCHEMA_VERSION, CONTENT_STATUSES, UI_STATES,
  assertPackManifest, assertCampaignManifest, assertScenarioManifest,
  assertContentBundle, assertLaunchableCampaign,
} from '../content/schema.js'

const bundle = () => ({
  packs: [{
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'core', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', dependencies: [],
    cardRanges: [{ from: '01000', to: '01999' }],
    cards: [{ code: '01016', type: 'player', cataloged: true, imageAvailable: false,
      rulesImplemented: true, deckbuilding: true }],
    encounterGroupIds: ['rats'], behaviorIds: [],
  }],
  campaigns: [{
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'example', name: 'Example', contentVersion: '1.0.0',
    minRulesVersion: 'n4.2', status: 'playable', requiredPackIds: ['core'],
    scenarioIds: ['first'], unlock: { first: [] }, chaosBags: { standard: ['0', '-1'] },
    recordSchema: { outcome: 'string' }, interludeHandlerId: 'defaultInterlude', resolutionIds: ['won'],
  }],
  scenarios: [{
    schemaVersion: CONTENT_SCHEMA_VERSION, id: 'first', campaignId: 'example', name: 'First',
    contentVersion: '1.0.0', minRulesVersion: 'n4.2', status: 'playable',
    requiredPackIds: [], requiredEncounterGroupIds: ['rats'],
    requiredInvestigatorIds: [], requiredMechanicIds: [],
    locations: [
      { id: 'study', frontCode: '01111', backCode: '01111b', connections: ['hall'] },
      { id: 'hall', frontCode: '01112', backCode: '01112b', connections: ['study'] },
    ],
    startLocationId: 'study',
    zones: { encounterDeck: [{ cardCode: '01120', count: 2 }], setAside: [], removed: [], victory: [] },
    acts: [{ id: 'actOne' }], agendas: [{ id: 'agendaOne' }], resolutionIds: ['won'],
    recordReads: [], recordWrites: ['outcome'], behaviorIds: [],
    layout: { locations: { study: { x: 0, y: 0 } }, edges: [{ from: 'study', to: 'hall' }] },
  }],
})

test('P0 契约：卡包、战役、关卡和可选地点坐标通过运行时校验', () => {
  const sample = bundle()
  assert.deepEqual(CONTENT_STATUSES, ['catalog-only', 'development', 'playable', 'verified'])
  assert.deepEqual(UI_STATES, ['campaignHub', 'scenarioSetup', 'inScenario', 'scenarioResult', 'interlude', 'campaignResult'])
  assert.equal(assertPackManifest(sample.packs[0]), sample.packs[0])
  assert.equal(assertCampaignManifest(sample.campaigns[0]), sample.campaigns[0])
  assert.equal(assertScenarioManifest(sample.scenarios[0]), sample.scenarios[0])
  assert.equal(assertLaunchableCampaign(sample, 'example', 'n4.2'), sample.campaigns[0])
  sample.scenarios[0].layout.locations = {}
  assert.doesNotThrow(() => assertContentBundle(sample, 'n4.2'), '缺坐标应交给稳定自动布局')
})

test('P0 契约：发布状态、规则版本和依赖阻止未准备内容启动', () => {
  const catalog = bundle()
  catalog.packs[0].status = 'catalog-only'
  assert.throws(() => assertLaunchableCampaign(catalog, 'example', 'n4.2'), /不可启动/)
  const noRules = bundle()
  noRules.packs[0].cards[0].rulesImplemented = false
  assert.throws(() => assertPackManifest(noRules.packs[0]), /构筑开放需要/)
  const outOfRange = bundle()
  outOfRange.packs[0].cards[0].code = '02001'
  assert.throws(() => assertPackManifest(outOfRange.packs[0]), /不在声明范围/)
  const future = bundle()
  future.scenarios[0].minRulesVersion = 'n5.0'
  assert.throws(() => assertLaunchableCampaign(future, 'example', 'n4.2'), /需要规则版本/)
  const missing = bundle()
  missing.scenarios[0].requiredEncounterGroupIds = ['missing']
  assert.throws(() => assertContentBundle(missing, 'n4.2'), /缺少遭遇组/)
  const cycle = bundle()
  cycle.packs.push({ ...cycle.packs[0], id: 'extra', dependencies: ['core'] })
  cycle.packs[0].dependencies = ['extra']
  assert.throws(() => assertContentBundle(cycle, 'n4.2'), /存在环/)
})

test('P0 契约：地点身份、规则连接、展示布局和战役记录保持边界', () => {
  const badLocation = bundle()
  badLocation.scenarios[0].locations[0].connections = ['missing']
  assert.throws(() => assertScenarioManifest(badLocation.scenarios[0]), /无效地点/)
  const badLayout = bundle()
  badLayout.scenarios[0].layout.edges = [{ from: 'hall', to: 'hall' }]
  assert.throws(() => assertScenarioManifest(badLayout.scenarios[0]), /不得创建规则连接/)
  const badRecord = bundle()
  badRecord.scenarios[0].recordWrites = ['unknown']
  assert.throws(() => assertContentBundle(badRecord, 'n4.2'), /未声明战役记录/)
  const badZone = bundle()
  badZone.scenarios[0].zones.encounterDeck[0].count = 0
  assert.throws(() => assertScenarioManifest(badZone.scenarios[0]), /正整数/)
  const badVersion = bundle()
  badVersion.campaigns[0].schemaVersion = 99
  assert.throws(() => assertContentBundle(badVersion, 'n4.2'), /schemaVersion/)
})

test('P0 规则模式：新游戏不展示 strict，旧快照仍可读取 strict', () => {
  assert.equal(arkham.settingsSpec.some(setting => setting.key === 'rulesMode'), false)
  assert.equal(arkham.defaults.rulesMode, 'simplified')
  const players = [{ seat: 0, role: 'human', name: '你' }]
  assert.equal(createGameState({}, players).rulesMode, 'simplified')
  assert.equal(createGameState({ rulesMode: 'strict' }, players).rulesMode, 'strict')
  assert.equal(isCardAvailable('02001'), false, '图鉴卡不能因此进入运行时')
})
