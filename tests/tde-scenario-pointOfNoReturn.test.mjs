// 《无归之地》（Point of No Return · 06247）章节测试（P8 worker w-p8-d）。
//
// 两层证据：
//   1. 章节钩子（behavior）——setup/区域、幕/议程流程、Veiled 翻面（读正文+洗回）、混乱标记后果、
//      故事面结算、结局/记录、存档往返；
//   2. 单卡条目（encounter-entries）——地点/故事/敌人/诡计条目的规则函数直接 import 验证
//      （索引由 Lead 合并后重建，因此不依赖 implementedFor）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/index.js'
import {
  ACT_ONE_VARIANTS, CODES, INITIAL_LOCATIONS, INTRO_VARIANTS, LOCATION_IDS, SEA_OF_PITCH_IDS,
  SET_ASIDE_GROUP_DECKS, STORY_RULES, scenario as definition,
} from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/definition.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/behavior.js'
import { markerCountOf, referenceDamage, resolveChaosToken } from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/chaos.js'

import cityOfGugs from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06255.js'
import towerOfKoth from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06256.js'
import peaksOfThok from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06260.js'
import plainOfTheGhouls from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06257.js'
import seaOfBones from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06259.js'
import seaOfPitch262 from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06262.js'
import gugSentinel from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06267.js'
import tasteOfLifeblood from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06268.js'
import litByDeathFire from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06269.js'
import unexpectedAmbush from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06270.js'
import falseAwakening from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06275.js'
import pickman from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06266.js'
import ghastlyTunnels from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06254b.js'
import anotherPathStory from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06256b.js'
import aStrangeGhoulStory from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06257b.js'

const clone = value => structuredClone(value)

function stateFor(count = 2) {
  const state = {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '06001', name: `调查员${seat + 1}`, location: 'vaultsOfZin',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: ['01001', '01002'], assets: [], threat: [],
      engaged: [], deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [],
    scenarioFlags: {}, scenarioZones: {}, markerCounts: {},
    victoryDisplay: [], victory: 0,
    encounterDeck: [...definition.encounterDeck], encounterDiscard: [], doom: 0,
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation',
    status: 'playing', currentSeat: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({
        deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 }, xp: 0,
      })),
      chaosBag: [],
    },
    chaosBag: [],
  }
  return state
}

// 与引擎 placeLocation 同语义：已揭示面入场并按线索值放线索。
function placeStarter(state, ids = INITIAL_LOCATIONS) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    state.locations.push({ ...clone(base), id, revealed: true, clues, maxClues: clues, doom: 0 })
  }
}

function locationOf(state, id) {
  return state.locations.find(location => location.id === id) || null
}

function apiStub(state, overrides = {}) {
  const calls = []
  const record = (name, args) => calls.push({ name, args })
  const api = {
    calls,
    info: (text, presentation) => record('info', [text, presentation]),
    present: (text, presentation) => record('present', [text, presentation]),
    random: () => 0.5,
    choose: (request) => {
      record('choose', [request])
      return request?.options?.[0]?.id ?? 'skip'
    },
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      record('test', [seat, skill, difficulty])
      return resolve({ success: true, value: difficulty + 1, difficulty, skill, drawn: [], source: source || {} })
    },
    damage: (seat, amount) => { record('damage', [seat, amount]); state.investigators[seat].damage += amount },
    horror: (seat, amount) => { record('horror', [seat, amount]); state.investigators[seat].horror += amount },
    gainClues: (seat, amount) => { record('gainClues', [seat, amount]); state.investigators[seat].clues += amount },
    spendClues: (seat, amount) => { record('spendClues', [seat, amount]); state.investigators[seat].clues -= amount },
    placeClues: (seat, amount = 1) => {
      record('placeClues', [seat, amount])
      const inv = state.investigators[seat]
      const location = locationOf(state, inv.location)
      inv.clues -= amount
      if (location) location.clues += amount
    },
    moveClueToEnemy: (enemy, options) => {
      record('moveClueToEnemy', [enemy, options])
      state.investigators[options.seat].clues -= 1
      enemy.clues = (enemy.clues || 0) + 1
    },
    place: (id) => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
      const location = { ...clone(base), id, revealed: true, clues, maxClues: clues, doom: 0 }
      state.locations.push(location)
      record('place', [id])
      return location
    },
    reveal: (id) => {
      const location = locationOf(state, id)
      if (location) location.revealed = true
      record('reveal', [id])
    },
    flipLocation: (id, seat) => {
      record('flipLocation', [id, seat])
      const location = locationOf(state, id)
      if (location) location.veiledRevealed = true
      behavior.locationFlipped?.(state, location, api, seat ?? null)
      return true
    },
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value === undefined || value === null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
      return state.scenarioFlags[key] ?? null
    },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setLocationFlag: (id, flag, value = true) => {
      const location = locationOf(state, id)
      if (location) {
        location.flags ||= {}
        location.flags[flag] = value
      }
      record('setLocationFlag', [id, flag, value])
    },
    setCampaignRecord: (key, value) => {
      state.campaign.records[key] = value
      record('setCampaignRecord', [key, value])
      return value
    },
    campaignRecord: key => state.campaign.records[key] ?? null,
    markers: {
      get: id => markerCountOf(state, id),
      add: (id, delta = 1) => {
        state.markerCounts ||= {}
        state.markerCounts[id] = Math.max(0, Number(state.markerCounts[id] || 0) + delta)
        record('markers.add', [id, delta])
        return state.markerCounts[id]
      },
      set: (id, value) => { state.markerCounts[id] = value; return value },
      reset: id => { delete state.markerCounts[id] },
    },
    encounterDeckTop: null,
    discardEncounterTop: (count, options) => {
      const discarded = []
      for (let index = 0; index < count; index += 1) {
        if (!state.encounterDeck.length) break
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      record('discardEncounterTop', [count, options, discarded])
      return discarded
    },
    discardEncounterCard: (code, options) => {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index >= 0) {
        state.encounterDeck.splice(index, 1)
        state.encounterDiscard.push(code)
        record('discardEncounterCard', [code])
        return true
      }
      if (options?.includeDiscard) {
        const discardIndex = state.encounterDiscard.lastIndexOf(code)
        if (discardIndex >= 0) { state.encounterDiscard.splice(discardIndex, 1); return true }
      }
      return false
    },
    takeEncounterDiscard: (code, options) => {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      if (options?.toDeck) state.encounterDeck.push(code)
      record('takeEncounterDiscard', [code])
      return true
    },
    discardUntilEnemy: (seat, predicate) => {
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        const found = predicate?.({ code, traits: [] }, code)
        if (found) return code
      }
      return null
    },
    shuffleIntoEncounterDeck: (codes) => {
      state.encounterDeck.push(...codes)
      record('shuffleIntoEncounterDeck', [codes])
      return state.encounterDeck.length
    },
    shuffleDiscard: () => {
      state.encounterDeck.push(...state.encounterDiscard)
      state.encounterDiscard = []
      record('shuffleDiscard', [])
    },
    shuffleEncounterDeck: () => { record('shuffleEncounterDeck', []) },
    takeFromSetAside: (code) => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      record('takeFromSetAside', [code])
      return true
    },
    spawn: (code, location) => {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, clues: 0,
        traits: [],
      }
      state.enemies.push(enemy)
      record('spawn', [code, location])
      return enemy
    },
    spawnEngaged: (code, location, seat) => {
      const enemy = api.spawn(code, location)
      enemy.engagedSeat = seat
      return enemy
    },
    exhaustEnemy: enemy => { if (enemy) enemy.exhausted = true; record('exhaustEnemy', [enemy?.code]) },
    readyEnemy: enemy => { if (enemy) enemy.exhausted = false },
    engage: (enemy, seat) => { if (enemy) enemy.engagedSeat = seat; record('engage', [enemy?.code, seat]) },
    attack: (enemy, inv) => { record('attack', [enemy?.code, inv?.seat]) },
    moveEnemy: (enemy, destination) => { if (enemy) enemy.location = destination; record('moveEnemy', [enemy?.code, destination]) },
    removeEnemyFromGame: (enemy) => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      record('removeEnemyFromGame', [enemy?.code])
    },
    damageEnemy: (enemyId, amount, seat) => {
      const enemy = state.enemies.find(entry => entry.id === enemyId)
      if (enemy) enemy.damageTaken = (enemy.damageTaken || 0) + amount
      record('damageEnemy', [enemyId, amount, seat])
    },
    addCluesToEnemy: (enemy, amount) => { if (enemy) enemy.clues = (enemy.clues || 0) + amount; record('addCluesToEnemy', [enemy?.code, amount]) },
    giveAsset: (seat, code) => {
      const asset = { id: `asset-${code}`, code, originalCode: code, exhausted: false }
      state.storyAssets.push(asset)
      record('giveAsset', [seat, code])
      return asset
    },
    clearCluesOnEnemy: enemy => { const n = enemy.clues || 0; enemy.clues = 0; return n },
    clearDoom: () => { state.doom = 0; record('clearDoom', []) },
    drawCards: (seat, n) => { state.investigators[seat].hand.push(...Array(n).fill('01001')); record('drawCards', [seat, n]) },
    drawEncounter: seat => { record('drawEncounter', [seat]) },
    discardRandom: (seat, n) => { state.investigators[seat].hand.splice(0, n); record('discardRandom', [seat, n]) },
    loseResources: (seat, n) => { state.investigators[seat].resources -= n; record('loseResources', [seat, n]) },
    loseActions: (seat, n) => { state.investigators[seat].actionsLeft -= n; record('loseActions', [seat, n]) },
    discardChosen: (seat, n) => { state.investigators[seat].hand.splice(0, n); record('discardChosen', [seat, n]) },
    attachEncounterToLocation: (code, locationId) => {
      const location = locationOf(state, locationId)
      if (location) {
        location.attachments ||= []
        location.attachments.push({ id: `att-${code}`, code, originalCode: code })
      }
      record('attachEncounterToLocation', [code, locationId])
    },
    removeLocationClues: (id, amount) => {
      const location = locationOf(state, id)
      const removed = Math.min(amount, location?.clues || 0)
      if (location) location.clues -= removed
      return removed
    },
    addCluesToLocation: (id, amount) => {
      const location = locationOf(state, id)
      if (location) location.clues += amount
      record('addCluesToLocation', [id, amount])
    },
    advanceAct: () => { state.actIndex += 1; record('advanceAct', []) },
    finish: key => { state.resolutionKey = key; record('finish', [key]) },
    stepToward: (from, to) => to,
    veiled: {
      shuffleBack: (id, deckKey = 'encounter') => {
        record('veiled.shuffleBack', [id, deckKey])
        const index = state.locations.findIndex(location => location.id === id)
        if (index >= 0) state.locations.splice(index, 1)
      },
      flip: (id, options) => ({ changed: true, storyCode: null, reason: null }),
    },
    ...overrides,
  }
  return api
}

const callsOf = (api, name) => api.calls.filter(entry => entry.name === name)
const lastInfo = api => api.calls.filter(entry => entry.name === 'present' || entry.name === 'info').at(-1)?.args?.[0] || ''

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('06247 章节清单：development、参考卡、地点/幕/议程/结局数量', () => {
  assert.equal(chapter.manifest.id, 'pointOfNoReturn')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.referenceCode, '06247')
  assert.equal(chapter.scenario.originalCode, '06247')
  assert.equal(chapter.manifest.locations.length, 13, '4 初始 + 8 放一边 + 魔幻森林')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.manifest.startLocationId, 'vaultsOfZin')
  assert.equal(chapter.behavior.id, 'pointOfNoReturn')
})

test('身份登记：地点/幕/议程/敌人/诡计/剧情支援都有原卡身份且 mapped', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets', 'storyFaces']) {
    const entries = chapter.identities[category] || {}
    assert.ok(Object.keys(entries).length > 0, `${category} 身份为空`)
    for (const [id, identity] of Object.entries(entries)) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(chapter.identities.locations.vaultsOfZin.originalCode, '06254')
  assert.equal(chapter.identities.storyFaces['06254b'].originalCode, '06254b')
})

test('遭遇组：30 张初始遭遇牌 / 28 张放在一边 / 四张漆黑之海', () => {
  assert.equal(definition.encounterDeck.length, 30)
  assert.equal(definition.encounterDeck.filter(code => code === '06268').length, 2)
  assert.equal(definition.encounterDeck.includes('06267'), false, '古革哨兵放在一边')
  assert.equal(chapter.manifest.zones.setAside.reduce((sum, entry) => sum + entry.count, 0), 28)
  assert.equal(SEA_OF_PITCH_IDS.length, 4)
  for (const id of SEA_OF_PITCH_IDS) assert.equal(definition.locations[id].shroud, 0, 'X 帷幕占位归零')
  assert.equal(Object.keys(definition.storyFaces).length, 12)
})

// ---------------------------------------------------------------------------
// 2. setup / 区域 / intro
// ---------------------------------------------------------------------------
test('setupLocations：返回 4 张初始地点、写区域账本、移出未使用的 act1 版本', () => {
  const state = stateFor()
  state.scenarioFlags.actOneVariant = 'v2'
  const placed = behavior.setupLocations(state, [], { info: () => {} })
  assert.deepEqual(placed, [...INITIAL_LOCATIONS])
  assert.deepEqual(state.scenarioZones.removed, ['06250'], '使用 v.II 时把 v.I 移出游戏')
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06273').length, 2)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06272').length, 3)
  assert.ok(state.scenarioZones.setAside.includes('06267'))
  assert.ok(state.scenarioZones.setAside.includes('06266'))
  assert.ok(state.scenarioZones.setAside.includes('06275'))
  assert.ok(state.scenarioZones.setAside.includes('06053'))
})

test('preScenarioSetup：按 Randolph 记录选 act1 版本并朗读对应 intro', () => {
  const died = stateFor()
  died.campaign.records.randolphDidNotSurviveTheDescent = true
  const diedApi = apiStub(died)
  behavior.preScenarioSetup(died, [], diedApi)
  assert.equal(died.scenarioFlags.actOneVariant, 'v1')
  assert.equal(died.acts[0].originalCode, '06250')
  assert.match(lastInfo(diedApi), /Intro 1/)

  const survived = stateFor()
  survived.campaign.records.randolphDidNotSurviveTheDescent = false
  const survivedApi = apiStub(survived)
  behavior.preScenarioSetup(survived, [], survivedApi)
  assert.equal(survived.scenarioFlags.actOneVariant, 'v2')
  assert.equal(survived.acts[0].originalCode, '06251')
  assert.match(lastInfo(survivedApi), /Intro 2/)
  assert.ok(INTRO_VARIANTS.intro2.paragraphs.length >= 3)
})

test('preScenarioSetup：桥梁进度 0/1–4/≥5 决定参考卡伤害（Distortion）', () => {
  for (const [steps, expected] of [[0, 0], [3, 1], [5, 2], [8, 2]]) {
    const state = stateFor()
    state.campaign.records.stepsOfTheBridge = steps
    const api = apiStub(state)
    behavior.preScenarioSetup(state, [], api)
    assert.equal(referenceDamage(state), expected, `steps=${steps}`)
  }
})

test('afterDeckSetup：卡达斯从牌组取出、放在议程牌库旁并加 1 点毁灭', () => {
  const state = stateFor()
  state.investigators[0].deck = ['01001', '06275']
  const infos = []
  behavior.afterDeckSetup(state, [], { info: text => infos.push(text) })
  assert.deepEqual(state.investigators[0].deck, ['01001'])
  assert.equal(state.scenarioFlags.falseAwakeningInPlay, true)
  assert.equal(state.doom, 1)
  assert.equal(infos.length, 1)
})

// ---------------------------------------------------------------------------
// 3. 幕 / 议程流程
// ---------------------------------------------------------------------------
test('act 1（v.I）背面：放[[山谷]]地点、移出 Ghouls/Striking Fear、洗入两组遭遇牌', () => {
  const state = stateFor()
  placeStarter(state)
  state.scenarioFlags.actOneVariant = 'v1'
  behavior.setupLocations(state, [], { info: () => {} })
  const api = apiStub(state)
  behavior.actLeftPlay(state, state.acts[0], api)
  for (const id of ['cragOfTheGhouls', 'seaOfBones', 'peaksOfThok', 'valeOfPnath']) {
    assert.ok(locationOf(state, id), `${id} 应入场`)
  }
  assert.equal(callsOf(api, 'place').length, 4)
  const shuffled = callsOf(api, 'shuffleIntoEncounterDeck').flatMap(entry => entry.args[0])
  assert.ok(shuffled.includes('01172') && shuffled.includes('06271'))
  assert.ok(callsOf(api, 'shuffleDiscard').length >= 1)
  for (const code of ['01160', '01162', '01163']) {
    assert.equal(state.encounterDeck.includes(code), false, `${code} 应移出游戏`)
  }
  assert.ok(state.scenarioZones.removed.includes('01160'))
})

test('act 1（v.II）背面：额外把皮克曼交给队长', () => {
  const state = stateFor()
  placeStarter(state)
  state.scenarioFlags.actOneVariant = 'v2'
  state.acts[0] = clone(ACT_ONE_VARIANTS.v2)
  behavior.setupLocations(state, [], { info: () => {} })
  const api = apiStub(state)
  behavior.actLeftPlay(state, state.acts[0], api)
  assert.equal(callsOf(api, 'giveAsset').length, 1)
  assert.equal(callsOf(api, 'giveAsset')[0].args[1], '06266')
  assert.equal(state.scenarioFlags.pickmanSeat, 0)
})

test('act 2 背面：放 4 张漆黑之海并洗入 Descent into the Pitch / Agents of Atlach-Nacha', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state)
  behavior.actLeftPlay(state, state.acts[1], api)
  for (const id of SEA_OF_PITCH_IDS) assert.ok(locationOf(state, id), `${id} 应入场`)
  const shuffled = callsOf(api, 'shuffleIntoEncounterDeck').flatMap(entry => entry.args[0])
  assert.ok(shuffled.includes('06273') && shuffled.includes('06084'))
})

test('act 3 背面：推进即结算结局 1', () => {
  const state = stateFor()
  const api = apiStub(state)
  behavior.actLeftPlay(state, state.acts[2], api)
  assert.equal(state.resolutionKey, 'resolution1')
})

test('议程 1 背面：洗回遭遇弃牌堆 + 参考卡 1 点伤害', () => {
  const state = stateFor()
  state.encounterDiscard = ['01166']
  const api = apiStub(state)
  behavior.agendaAdvancing(state, state.agendas[0], api)
  assert.equal(referenceDamage(state), 1)
  assert.equal(state.encounterDeck.includes('01166'), true)
})

test('议程 2「怪物围困」：<5 时清空毁灭翻回正面；≥5 时进入结局 2', () => {
  const low = stateFor()
  low.agendaIndex = 1
  low.markerCounts.reference = 2
  const lowApi = apiStub(low)
  const cancelled = behavior.agendaWouldAdvance(low, lowApi)
  assert.equal(cancelled, true)
  assert.equal(referenceDamage(low), 3)
  assert.equal(callsOf(lowApi, 'clearDoom').length, 1)
  assert.equal(callsOf(lowApi, 'finish').length, 0)

  const high = stateFor()
  high.agendaIndex = 1
  high.markerCounts.reference = 4
  const highApi = apiStub(high)
  assert.equal(behavior.agendaWouldAdvance(high, highApi), true)
  assert.equal(referenceDamage(high), 5)
  assert.equal(high.resolutionKey, 'resolution2')
})

// ---------------------------------------------------------------------------
// 4. 结局与记录
// ---------------------------------------------------------------------------
test('结局 1：按参考卡伤害累加「桥梁进度」记号', () => {
  const state = stateFor()
  state.markerCounts.reference = 3
  state.campaign.records.stepsOfTheBridge = 2
  const api = apiStub(state)
  behavior.resolution(state, 'resolution1', [], api)
  assert.equal(state.campaign.records.stepsOfTheBridge, 5)
  assert.equal(state.markerCounts.reference, 3, '参考卡伤害不被结局清空')
})

test('结局 2 / 无结局：把卡达斯加入队长牌组（不计张数）并结算桥梁进度', () => {
  const state = stateFor()
  state.markerCounts.reference = 2
  state.scenarioZones.setAside = ['06275']
  const api = apiStub(state)
  behavior.resolution(state, 'resolution2', [], api)
  assert.equal(state.campaign.records.stepsOfTheBridge, 2)
  assert.deepEqual(state.campaign.investigators[0].deck, ['06275'])
  assert.equal(state.scenarioZones.setAside.includes('06275'), false)

  const routed = stateFor()
  const routedApi = apiStub(routed)
  assert.equal(behavior.storyResolutionKey(routed, 'noResolution'), 'resolution2')
  behavior.resolution(routed, 'noResolution', [], routedApi)
  assert.equal(routed.campaign.records.stepsOfTheBridge, 0)
  assert.ok(routed.campaign.investigators[0].deck.includes('06275'))
})

// ---------------------------------------------------------------------------
// 5. 混乱标记（剧本参考卡伤害 X）
// ---------------------------------------------------------------------------
test('混乱标记数值：skull=-X（困难 -X-1）、cultist 再抽、tablet +1/0、elderthing -3/-4', () => {
  const state = stateFor()
  state.markerCounts.reference = 3
  assert.equal(resolveChaosToken(state, state.investigators[0], 'skull').delta, -3)
  state.difficulty = 'hard'
  assert.equal(resolveChaosToken(state, state.investigators[0], 'skull').delta, -4)
  assert.equal(resolveChaosToken(state, state.investigators[0], 'cultist').drawAnother, true)
  assert.equal(resolveChaosToken(state, state.investigators[0], 'elderthing').delta, -4)
  state.difficulty = 'standard'
  assert.equal(resolveChaosToken(state, state.investigators[0], 'tablet').delta, 1)
  assert.equal(markerCountOf(state), 3)
})

test('检定后：cultist 失败抽遭遇牌 / tablet 调查成功抽牌 / elderthing 失败≥2 敌人攻击', () => {
  const state = stateFor()
  placeStarter(state)
  state.enemies.push({ id: 'e1', code: '06091', originalCode: '06091', name: 'Hunting Ghast',
    location: LOCATION_IDS.cityOfGugs, exhausted: false, defeated: false, damageTaken: 0 })
  const api = apiStub(state)

  behavior.afterTest(state, state.investigators[0], { success: false, drawn: ['cultist'], difficulty: 3, value: 1 }, api)
  assert.equal(callsOf(api, 'drawEncounter').length, 1)

  behavior.afterTest(state, state.investigators[0],
    { success: true, drawn: ['tablet'], difficulty: 3, value: 4, source: { label: '调查' } }, api)
  assert.equal(callsOf(api, 'drawCards').length, 1)

  behavior.afterTest(state, state.investigators[0],
    { success: false, drawn: ['elderthing'], difficulty: 3, value: 1 }, api)
  assert.equal(callsOf(api, 'moveEnemy').length, 1)
  assert.equal(callsOf(api, 'engage').length, 1)
  assert.equal(callsOf(api, 'attack').length, 1)
  // 幂等：同一 result 再调一次不重复结算。
  behavior.afterTest(state, state.investigators[0], { success: false, drawn: ['cultist'], difficulty: 3, value: 1, pnrChaosHandled: true }, api)
  assert.equal(callsOf(api, 'drawEncounter').length, 1)
})

// ---------------------------------------------------------------------------
// 6. Veiled 翻面（读正文 + 洗回）与故事面
// ---------------------------------------------------------------------------
test('veiledFlipped：读背面故事正文并结算故事（另一条路 → 放入魔幻森林 + 战役记录）', () => {
  const state = stateFor()
  placeStarter(state)
  state.scenarioZones.setAside = ['06053']
  const api = apiStub(state)
  const location = locationOf(state, 'vaultsOfZin')
  location.veiled = true
  location.shuffleBack = true
  behavior.veiledFlipped(state, state.investigators[0], location.id,
    { changed: true, storyCode: '06256b', reason: null }, api)
  const logged = api.calls
    .filter(entry => entry.name === 'present' || entry.name === 'info')
    .map(entry => String(entry.args?.[0] ?? ''))
    .join('\n')
  assert.match(logged, /魔幻森林/, '应朗读 06256b 的卡面正文')
  assert.equal(callsOf(api, 'place').length, 1)
  assert.equal(state.campaign.records.theInvestigatorsFoundAWayOutOfTheUnderworld, true)
  assert.equal(callsOf(api, 'veiled.shuffleBack').length, 1, '声明 shuffleBack 的地点翻面后洗回')
  // 同一地点只洗一次。
  behavior.veiledFlipped(state, state.investigators[0], location.id,
    { changed: true, storyCode: '06256b', reason: null }, api)
  assert.equal(callsOf(api, 'veiled.shuffleBack').length, 1)
})

test('veiledFlipped：翻面失败只提示原因，不结算故事', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state)
  behavior.veiledFlipped(state, state.investigators[0], 'vaultsOfZin',
    { changed: false, storyCode: null, reason: '地点上还有线索' }, api)
  assert.match(lastInfo(api), /地点上还有线索/)
  assert.equal(callsOf(api, 'veiled.shuffleBack').length, 0)
})

test('故事「诡异食尸鬼」：线索不足时翻回可再翻；足够时共同花费并推进当前幕', () => {
  const low = stateFor()
  placeStarter(low)
  low.investigators[0].clues = 2
  low.investigators[1].clues = 2
  const lowApi = apiStub(low)
  const lowLocation = locationOf(low, LOCATION_IDS.plainOfTheGhouls)
  lowLocation.veiled = true

  behavior.veiledFlipped(low, low.investigators[0], lowLocation.id,
    { changed: true, storyCode: '06257b' }, lowApi)
  assert.equal(lowLocation.veiledRevealed, false, '线索不足 → 翻回，可再次翻面')
  assert.equal(callsOf(lowApi, 'spendClues').length, 0)

  const high = stateFor()
  placeStarter(high)
  high.investigators[0].clues = 4
  high.investigators[1].clues = 4
  const highApi = apiStub(high)
  const highLocation = locationOf(high, LOCATION_IDS.plainOfTheGhouls)
  highLocation.veiled = true
  behavior.veiledFlipped(high, high.investigators[0], highLocation.id,
    { changed: true, storyCode: '06257b' }, highApi)
  assert.equal(callsOf(highApi, 'spendClues').length, 2)
  assert.equal(callsOf(highApi, 'advanceAct').length, 1)
})

test('故事「阴森隧道」：从遭遇牌库找[[噩妖]]敌人并横置生成（带 1 线索）', () => {
  const state = stateFor()
  placeStarter(state)
  state.encounterDeck = ['06091', '01166']
  const api = apiStub(state, {
    discardUntilEnemy: (seat, predicate) => {
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        if (predicate({ type: 'enemy', traits: ['Ghast'] }, code)) return code
        state.encounterDiscard.push(code)
      }
      return null
    },
  })
  const location = locationOf(state, 'vaultsOfZin')
  behavior.veiledFlipped(state, state.investigators[0], location.id, { changed: true, storyCode: '06254b' }, api)
  assert.equal(callsOf(api, 'spawn').length, 1)
  assert.equal(state.enemies[0].exhausted, true)
  assert.equal(state.enemies[0].clues, 1)
})

test('食尸鬼峭壁：神话阶段第一张诡计获得涌动（每调查员一局一次）', () => {
  const state = stateFor()
  placeStarter(state)
  state.phase = 'mythos'
  state.investigators[0].location = LOCATION_IDS.cragOfTheGhouls
  state.locations.push({ ...clone(state.scenario.locations.cragOfTheGhouls), id: LOCATION_IDS.cragOfTheGhouls,
    revealed: true, clues: 0, maxClues: 0 })
  const api = apiStub(state)
  assert.equal(behavior.encounterGainsSurge(state, '01166', state.investigators[0]), true)
  assert.equal(behavior.encounterGainsSurge(state, '01167', state.investigators[0]), undefined)
  void api
})

test('食尸鬼平原：古革巨人敌人生成改到古革巨人之城、移动后改道', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state)
  const fallback = behavior.spawnLocation(state, '06092', LOCATION_IDS.plainOfTheGhouls, null, api)
  assert.equal(fallback, LOCATION_IDS.cityOfGugs)
  const nonGug = behavior.spawnLocation(state, '06091', LOCATION_IDS.plainOfTheGhouls, null, api)
  assert.equal(nonGug, undefined)
  const gug = { id: 'g1', code: '06092', originalCode: '06092', name: 'Lumbering Gug',
    location: LOCATION_IDS.plainOfTheGhouls, exhausted: false, defeated: false }
  state.enemies.push(gug)
  behavior.enemyMoved(state, gug, LOCATION_IDS.plainOfTheGhouls, api, null)
  assert.equal(gug.location, LOCATION_IDS.cityOfGugs)
})

test('漆黑之海：帷幕 X = 参考卡伤害数；潘斯山谷仍有线索时禁止打出/投入', () => {
  const state = stateFor()
  placeStarter(state)
  state.markerCounts.reference = 2
  const sea = { ...clone(state.scenario.locations[LOCATION_IDS.seaOfPitch262]), id: LOCATION_IDS.seaOfPitch262,
    revealed: true, clues: 0, maxClues: 4, veiled: true }
  state.locations.push(sea)
  assert.equal(behavior.locationShroudModifier(state, sea), 2)

  const vale = { ...clone(state.scenario.locations[LOCATION_IDS.valeOfPnath]), id: LOCATION_IDS.valeOfPnath,
    revealed: true, clues: 3, maxClues: 4, veiled: true }
  state.locations.push(vale)
  state.investigators[0].location = LOCATION_IDS.valeOfPnath
  assert.equal(behavior.canPlayCard(state, state.investigators[0], { code: '01001' }), false)
  assert.equal(behavior.canCommitCard(state, state.investigators[0], '01001'), false)
  vale.clues = 0
  assert.equal(behavior.canPlayCard(state, state.investigators[0], { code: '01001' }), undefined)
})

// ---------------------------------------------------------------------------
// 7. 单卡条目（地点 / 敌人 / 诡计 / 剧情）
// ---------------------------------------------------------------------------
test('06255 古革巨人之城：进入后强制翻面（只翻一次）', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state)
  const location = locationOf(state, 'cityOfGugs')
  cityOfGugs.locationRule.onEnter.effect(state, location, api, state.investigators[0])
  assert.equal(callsOf(api, 'flipLocation').length, 1)
  cityOfGugs.locationRule.onEnter.effect(state, location, api, state.investigators[0])
  assert.equal(callsOf(api, 'flipLocation').length, 1, '已翻面不再触发')
})

test('06256 卡斯之塔：战斗(5)检定成功翻面；已翻面只给 used 提示', () => {
  const state = stateFor()
  placeStarter(state)
  state.investigators[0].location = 'towerOfKoth'
  const api = apiStub(state)
  const location = locationOf(state, 'towerOfKoth')
  const moves = []
  towerOfKoth.locationRule.actions({ state, inv: state.investigators[0], location, moves })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].action, 'scenarioAction')
  towerOfKoth.locationRule.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(callsOf(api, 'flipLocation').length, 1)
  const movesAfter = []
  towerOfKoth.locationRule.actions({ state, inv: state.investigators[0], location, moves: movesAfter })
  assert.equal(Boolean(movesAfter[0].used), true)
})

test('06260 撒克山峰：离开检定敏捷(2)，失败受到 1 点伤害', () => {
  const state = stateFor()
  placeStarter(state)
  state.investigators[0].location = 'peaksOfThok'
  const api = apiStub(state)
  const location = { ...clone(state.scenario.locations.peaksOfThok), id: 'peaksOfThok', revealed: true }
  assert.deepEqual(peaksOfThok.locationRule.onLeave.test, { skill: 'agility', difficulty: 2 })
  peaksOfThok.locationRule.onLeave.onFail(state, location, api, state.investigators[0])
  assert.equal(state.investigators[0].damage, 1)
  const actionMoves = []
  peaksOfThok.locationRule.actions({ state, inv: state.investigators[0], location, moves: actionMoves })
  assert.equal(actionMoves.length, 1)
})

test('06259 骸骨之海：发现线索后强制翻面', () => {
  const state = stateFor()
  const location = { ...clone(state.scenario.locations.seaOfBones), id: 'seaOfBones', revealed: true, clues: 2 }
  state.locations.push(location)
  const api = apiStub(state)
  behavior.cluesRemoved(state, location, 1, api)
  assert.equal(callsOf(api, 'flipLocation').length, 1)
  behavior.cluesRemoved(state, location, 1, api)
  assert.equal(callsOf(api, 'flipLocation').length, 1, '只翻一次')
})

test('06267 古革哨兵：横置后重整 → 所在地点每位调查员 1 点恐惧；healthPerPlayerBonus 声明', () => {
  const state = stateFor()
  placeStarter(state)
  const enemy = { id: 'gug', code: '06267', originalCode: '06267', name: '古革哨兵',
    location: 'cityOfGugs', exhausted: true, defeated: false }
  state.enemies.push(enemy)
  state.investigators[0].location = 'cityOfGugs'
  state.investigators[1].location = 'cityOfGugs'
  const api = apiStub(state)
  gugSentinel.enemyScript.onRoundEnd(state, enemy, api)
  enemy.exhausted = false
  gugSentinel.enemyScript.onEnemyPhaseStart(state, enemy, api)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].horror, 1)
  assert.equal(gugSentinel.enemyRule.healthPerPlayerBonus, 2)
  // 未横置过的不触发。
  gugSentinel.enemyScript.onEnemyPhaseStart(state, enemy, api)
  assert.equal(state.investigators[0].horror, 1)
})

test('06268 鲜血的滋味：意志(3)失败差值逐点三选一（无线索时只能受伤）', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 1, difficulty, skill }),
  })
  const card = { code: '06268', originalCode: '06268' }
  assert.equal(tasteOfLifeblood.encounterResolve(state, state.investigators[0], card, api), false)
  assert.equal(state.investigators[0].damage, 2, '失败差值 2 → 2 次受伤')
})

test('06269 夺命猛火：每人失 1 资源；山谷/深海弃牌；深海再失 1 行动', () => {
  const state = stateFor()
  placeStarter(state)
  state.investigators[0].location = LOCATION_IDS.cityOfGugs
  state.investigators[1].location = LOCATION_IDS.seaOfPitch262
  state.locations.push({ ...clone(state.scenario.locations[LOCATION_IDS.seaOfPitch262]),
    id: LOCATION_IDS.seaOfPitch262, revealed: true, clues: 0 })
  state.investigators[0].resources = 5
  state.investigators[1].resources = 5
  const api = apiStub(state)
  const card = { code: '06269', originalCode: '06269' }
  assert.equal(litByDeathFire.encounterResolve(state, state.investigators[0], card, api), false)
  assert.equal(state.investigators[0].resources, 4)
  assert.equal(state.investigators[1].resources, 4)
  assert.equal(state.investigators[0].hand.length, 2, '古革巨人之城不是山谷/深海，不弃牌')
  assert.equal(state.investigators[1].hand.length, 1, '深海弃 1 张手牌')
  assert.equal(state.investigators[1].actionsLeft, 2, '深海失去 1 行动')
})

test('06270 意外伏击：场上无敌人时受到 1 伤害与 1 恐惧', () => {
  const state = stateFor()
  placeStarter(state)
  const api = apiStub(state)
  const card = { code: '06270', originalCode: '06270' }
  unexpectedAmbush.encounterResolve(state, state.investigators[0], card, api)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
})

test('06275 卡达斯：弱点标记（任意技能 2+人数难度、成功移出游戏）', () => {
  assert.equal(falseAwakening.flags.agendaAsideWeakness, true)
  assert.equal(falseAwakening.flags.anySkillTest, true)
  assert.equal(falseAwakening.flags.difficulty, 2)
  assert.equal(falseAwakening.flags.difficultyPerInvestigator, 1)
  assert.equal(falseAwakening.flags.removeFromGameOnSuccess, true)
})

test('06266 皮克曼 / 剧情支援：附属食尸鬼与基础战斗 5 的规则数据', () => {
  assert.equal(pickman.assetRule.fastAttachGhoul.trait, 'Ghoul')
  assert.equal(pickman.assetRule.fightAction.baseCombat, 5)
  assert.equal(pickman.assetRule.fightAction.damageFromAttached, true)
})

test('06266 皮克曼：章节行为提供 [fast] 附属食尸鬼与 [action] 基础战斗攻击', () => {
  const state = stateFor()
  placeStarter(state)
  const asset = { id: 'pickman', code: '06266', originalCode: '06266', exhausted: false }
  state.investigators[0].assets.push(asset)
  state.enemies.push({ id: 'ghoul', code: '01160', originalCode: '01160', name: 'Ghoul Minion',
    location: 'vaultsOfZin', traits: ['Ghoul'], exhausted: false, defeated: false })
  state.enemies.push({ id: 'ghast', code: '06091', originalCode: '06091', name: 'Hunting Ghast',
    location: 'vaultsOfZin', traits: [], exhausted: false, defeated: false })
  const api = apiStub(state)
  const moves = behavior.actions(state, state.investigators[0])
  const attachMove = moves.find(move => move.rule === 'pickmanAttach')
  const fightMove = moves.find(move => move.rule === 'pickmanFight')
  assert.ok(attachMove && attachMove.fast, '提供 [fast] 附属行动')
  assert.ok(fightMove && fightMove.actions === 1, '提供 [action] 攻击行动')
  behavior.performAction(state, state.investigators[0], attachMove, api)
  assert.equal(state.enemies.some(enemy => enemy.id === 'ghoul'), false, '食尸鬼被移出游戏并附属')
  assert.equal(api.scenarioFlag('pnrPickmanAttached:pickman'), 1)
  assert.equal(asset.exhausted, true)
  asset.exhausted = false
  behavior.performAction(state, state.investigators[0], fightMove, api)
  assert.equal(callsOf(api, 'damageEnemy').length, 1)
  assert.equal(callsOf(api, 'damageEnemy')[0].args[1], 1, '伤害 = 附属的正面朝下遭遇卡数')
})

test('剧情卡条目：规则键与 definition 数据表一致（不按卡号写分支）', () => {
  assert.equal(ghastlyTunnels.flags.storyRule, STORY_RULES['06254b'].storyRule)
  assert.equal(anotherPathStory.flags.storyRule, STORY_RULES['06256b'].storyRule)
  assert.equal(aStrangeGhoulStory.flags.storyRule, STORY_RULES['06257b'].storyRule)
  assert.equal(aStrangeGhoulStory.flags.clueThresholdPerInvestigator, 3)
})

// ---------------------------------------------------------------------------
// 8. 存档 / 回放往返
// ---------------------------------------------------------------------------
test('存档往返：setup 后的状态 JSON 序列化两次全等，parse 后各区域守恒', () => {
  const build = () => {
    const state = stateFor()
    state.campaign.records.stepsOfTheBridge = 4
    state.campaign.records.randolphDidNotSurviveTheDescent = false
    const api = apiStub(state)
    behavior.preScenarioSetup(state, [], api)
    placeStarter(state, behavior.setupLocations(state, [], { info: () => {} }))
    behavior.afterDeckSetup(state, [], { info: () => {} })
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同输入两次构建字节一致')
  const roundtrip = JSON.parse(JSON.stringify(first))
  assert.equal(JSON.stringify(roundtrip), JSON.stringify(first), 'parse 后再次序列化一致')
  assert.deepEqual(roundtrip.scenarioZones, first.scenarioZones)
  assert.deepEqual(roundtrip.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(roundtrip.campaign.records, first.campaign.records)
  assert.deepEqual(roundtrip.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.equal(roundtrip.markerCounts.reference, 1, '桥梁进度 4 → 1 点 Distortion')
})
