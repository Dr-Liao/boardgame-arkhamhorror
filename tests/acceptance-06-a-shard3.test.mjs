// 验收 06-a 分片 3（sfk《寻觅卡达斯》06110–06132）逐卡证据。
//
// 每个用例标题含卡号；断言读真实实现读点（单卡条目规则 / 章节 behavior 钩子 / 引擎原语），
// 不是「条目存在」。本文件由验收审计产出，主进程合并时需登记进 tests/suites.mjs 与
// tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createGameState, legalMoves, performTest, scenarioRuntime, startScenario } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredCodes } from '../src/engine/ability.js'
import { canFlipVeiledLocation } from '../src/engine/veiled.js'
import { swarmCountOf } from '../src/engine/swarm.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import {
  scenario as definition, REGIONS, PORT_LOCATIONS, VIRGIL_GRAY,
  PRIEST_OF_A_THOUSAND_MASKS, PACK_OF_VOONITHS, CATS_OF_ULTHAR, BEINGS_OF_IB,
  CRAWLING_MIST, HORDE_OF_NIGHT, STALKING_MANTICORE, TENEBROUS_NIGHTGAUNT, CORSAIR_OF_LENG,
} from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/definition.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/behavior.js'
import { signsOfTheGods, searchForKadathChaosToken } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/chaos.js'

const here = dirname(fileURLToPath(import.meta.url))
const ENTRY_DIR = resolve(here, '../src/cards/encounter-entries/theDreamEaters/theSearchForKadath')
const ENTRIES = []
for (const name of readdirSync(ENTRY_DIR).filter(name => name.endsWith('.js')).sort()) {
  const module = await import(pathToFileURL(resolve(ENTRY_DIR, name)).href)
  if (module.default) ENTRIES.push(module.default)
}
const alreadyRegistered = new Set(registeredCodes())
const pending = ENTRIES.filter(entry => !alreadyRegistered.has(entry.code))
if (pending.length) registerCardAbilities(pending)
const entryOf = code => ENTRIES.find(entry => entry.code === code) || null

const clone = value => structuredClone(value)
const CREATURE_ENEMY = Object.values(ALL_CARDS)
  .find(card => card.type === 'enemy' && card.pack === 'sfk'
    && (card.traits || []).map(trait => String(trait).toLowerCase()).includes('creature')).code
const NON_ENEMY_CARD = '01001'

function liveKadath(seed) {
  const state = createGameState({ seed, playerInvestigator: '01002' }, [{ seat: 0 }])
  state.campaign.records.theCatsCollectedTheirTributeFromTheZoogs = true
  startScenario(state, 0, [], 'theSearchForKadath')
  state.pendingChoice = null
  state.continuation = null
  state.investigators[0].hand = []
  return state
}

function investigateWithTokens(state, locationId, difficulty, tokens) {
  const location = state.locations.find(item => item.id === locationId)
  state.investigators[0].location = locationId
  state.debugNextTokens = tokens
  let result
  const execute = (draft, seat, move, events) => performTest(draft, seat, 'intellect', difficulty, {
    source: { label: '调查', name: location.name, code: location.originalCode || location.code },
    testTarget: { kind: 'location', id: locationId, actionKind: 'investigate' },
    events,
    resolve: outcome => { result = outcome },
  })
  resolveTransaction(state, 0, { action: 'investigate' }, execute)
  while (state.pendingChoice) {
    const { seat, options } = state.pendingChoice
    const optionId = options.find(option => ['done', 'skip'].includes(option.id))?.id || options[0].id
    resolveTransaction(state, seat, { action: 'choose', optionId }, execute)
  }
  return result
}

function makeState({ numInvestigators = 2, difficulty = 'standard', records = {} } = {}) {
  const scenario = clone(definition)
  const state = {
    scenario,
    difficulty,
    numInvestigators,
    investigators: Array.from({ length: numInvestigators }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, code: `0100${seat + 1}`, location: 'ulthar',
      damage: 0, horror: 0, clues: 0, resources: 5, actionsLeft: 3,
      hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
      defeated: false, resigned: false,
    })),
    campaign: { leadSeat: 0, records: { ...records }, investigators: [] },
    locations: [], enemies: [], storyAssets: [],
    scenarioFlags: {}, scenarioZones: {}, victoryDisplay: [], removedFromGame: [],
    encounterDeck: [...scenario.encounterDeck], encounterDiscard: [],
    doom: 0, round: 1, phase: 'investigation', currentSeat: 0, turnSerial: 0,
    markerCounts: {}, acts: clone(scenario.acts), agendas: clone(scenario.agendas),
    actIndex: 0, agendaIndex: 0, chaosBag: [], status: 'playing',
  }
  return state
}

function makeApi(state, options = {}) {
  const calls = {
    info: [], finish: [], advanceAct: 0, defeatedAll: 0, damage: [], horror: [], discoverClue: [],
    drawCards: [], searchTop: [], loseResources: [], drawEncounter: 0, doom: [], spawns: [],
    spawnedEngaged: [], moves: [], removedEnemies: [], removedLocations: [], loseActions: [],
    endTurn: [], discardedAssets: [], swarmPlaced: [], shuffles: [], setHere: [],
  }
  const choices = options.choices ? [...options.choices] : []
  const api = {
    calls,
    info: text => calls.info.push(String(text)),
    present: text => calls.info.push(String(text)),
    random: () => 0.5,
    shuffle: list => [...list],
    choose: request => {
      calls.choosePrompts = [...(calls.choosePrompts || []), request?.prompt || '']
      if (choices.length) return choices.shift()
      return request?.options?.[0]?.id
    },
    choice: request => api.choose(request),
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    campaignRecord: key => state.campaign?.records?.[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    markers: {
      get: (id = 'reference') => Number(state.markerCounts?.[id]) || 0,
      add: (id = 'reference', delta = 1) => {
        state.markerCounts ||= {}
        state.markerCounts[id] = Math.max(0, (Number(state.markerCounts[id]) || 0) + delta)
        return state.markerCounts[id]
      },
      set: (id, value) => { state.markerCounts ||= {}; state.markerCounts[id] = value; return value },
    },
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || `卡${code}`,
    cardTraits: code => (ALL_CARDS[code]?.traits || []).slice(),
    cardType: code => ALL_CARDS[code]?.type || null,
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside
      if (!Array.isArray(list)) return false
      const index = list.indexOf(String(code))
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: (codes) => {
      const list = Array.isArray(codes) ? codes : [codes]
      calls.shuffles.push(list)
      state.encounterDeck.push(...list)
    },
    shuffleEncounterDeck: () => {},
    shuffleDiscard: () => {
      state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]
      state.encounterDiscard = []
    },
    discardEncounterCard: (code, opts = {}) => {
      const index = state.encounterDeck.lastIndexOf(String(code))
      if (index >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0]); return true }
      if (opts.includeDiscard !== true) return false
      const discardIndex = state.encounterDiscard.lastIndexOf(String(code))
      if (discardIndex < 0) return false
      state.encounterDiscard.splice(discardIndex, 1)
      return true
    },
    takeEncounterDeckCard: code => {
      const index = state.encounterDeck.lastIndexOf(code)
      return index >= 0 ? state.encounterDeck.splice(index, 1)[0] : null
    },
    removeFromGameCards: code => {
      if (!state.removedFromGame.includes(code)) state.removedFromGame.push(code)
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.lastIndexOf(String(code))
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      return true
    },
    discardEncounterTop: (count = 1) => {
      const codes = []
      for (let i = 0; i < count && state.encounterDeck.length; i += 1) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        codes.push(code)
      }
      calls.topDiscarded = [...(calls.topDiscarded || []), ...codes]
      return codes
    },
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${calls.spawns.length + 1}`, code, originalCode: code,
        name: ALL_CARDS[code]?.name || code, location: locationId, engagedSeat: null, damageTaken: 0, doom: 0 }
      state.enemies.push(enemy)
      calls.spawns.push({ code, locationId })
      return enemy
    },
    spawnEngaged: (code, locationId, seat) => {
      const enemy = api.spawn(code, locationId)
      enemy.engagedSeat = seat
      calls.spawnedEngaged.push({ code, locationId, seat })
      return enemy
    },
    removeEnemyFromGame: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      calls.removedEnemies.push(enemy.originalCode || enemy.code)
      return true
    },
    place: id => {
      const locDef = state.scenario.locations?.[id]
      if (!locDef) return null
      if (state.locations.some(location => location.id === id)) return null
      const victory = Number(locDef.victory) || 0
      const location = { ...clone(locDef), id, revealed: true,
        clues: (Number(locDef.cluesPerInvestigator) || 0) * state.numInvestigators }
      state.locations.push(location)
      return { location, victory }
    },
    removeLocationFromGame: (id, opts = {}) => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index < 0) return null
      const [removed] = state.locations.splice(index, 1)
      calls.removedLocations.push(id)
      if (opts.discardEnemies !== false) {
        for (const enemy of [...state.enemies]) if (enemy.location === id) state.enemies.splice(state.enemies.indexOf(enemy), 1)
      }
      return removed
    },
    moveInvestigator: (seat, locationId) => { state.investigators[seat].location = locationId; calls.moves.push({ seat, locationId }) },
    loseResources: (seat, amount) => { const inv = state.investigators[seat]; inv.resources -= amount; calls.loseResources.push({ seat, amount }) },
    drawCards: (seat, count) => { calls.drawCards.push({ seat, count }) },
    searchTop: (seat, opts) => { calls.searchTop.push({ seat, ...opts }) },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push({ seat, amount }) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push({ seat, amount }) },
    discoverClue: (seat, amount) => { state.investigators[seat].clues += amount; calls.discoverClue.push({ seat, amount }) },
    addDoom: amount => { state.doom += amount; calls.doom.push(amount) },
    setShroudMod: (location, amount) => { calls.setHere.push({ id: location.id, amount }) },
    spendClues: (seat, amount) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - amount) },
    defeatAll: () => { calls.defeatedAll += 1; for (const inv of state.investigators) inv.defeated = true },
    finish: key => calls.finish.push(key),
    advanceAct: () => { calls.advanceAct += 1 },
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount); calls.loseActions.push({ seat, amount }) },
    endTurn: seat => { calls.endTurn.push(seat) },
    canDiscardAsset: () => true,
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      const index = inv.assets.findIndex(card => card.id === assetId)
      if (index < 0) return false
      inv.assets.splice(index, 1)
      calls.discardedAssets.push({ seat, assetId })
      return true
    },
    swarm: {
      place: (host, count, options) => {
        calls.swarmPlaced.push({ host: host?.id, count, options })
        const added = Array.from({ length: count }, (_, index) => ({ id: `${host.id}-swarm-${index}`, code: 'x', source: options?.source }))
        host.swarmCards = [...(host.swarmCards || []), ...added]
        return added
      },
      countOf: host => swarmCountOf(host),
    },
    setEnemyAside: enemy => { calls.setAside = [...(calls.setAside || []), enemy.id]; return enemy.id },
    restoreEnemyFromAside: (id, locationId) => ({ id, location: locationId }),
    ignoreLocationTrigger: () => false,
    flipLocation: (id) => {
      const location = state.locations.find(item => item.id === id)
      if (location) behavior.locationFlipped(state, location, api, state.currentSeat)
    },
    given: {},
  }
  return api
}

function placeLocation(state, id) {
  const api = makeApi(state)
  return api.place(id)
}

function setupStart(state) {
  for (const id of ['ulthar', 'skaiRiver', 'dylathLeen']) {
    const locDef = state.scenario.locations[id]
    state.locations.push({ ...clone(locDef), id, revealed: true,
      clues: (Number(locDef.cluesPerInvestigator) || 0) * state.numInvestigators })
  }
  for (const inv of state.investigators) inv.location = 'ulthar'
}

// ---------------------------------------------------------------------------
// 06119 剧本参考卡（场景卡；无单卡条目，实现 = definition + chaos + behavior）
// ---------------------------------------------------------------------------

test('06119 寻觅卡达斯：参考卡场景数据、混乱标记公式与神迹目标接线', () => {
  assert.equal(chapter.REFERENCE_CODE, '06119')
  assert.equal(chapter.manifest.referenceCode, '06119')
  assert.equal(chapter.manifest.status, 'playable')
  assert.ok(chapter.manifest.requiredMechanicIds.includes('tdeSignsOfTheGods'))
  assert.equal(Object.keys(definition.locations).length, 17)
  assert.equal(Object.values(definition.locations).filter(location => location.veiled === true).length, 15)
  assert.equal(definition.setAsideLocations.length, 14)
  assert.equal(definition.locations.dylathLeen.resign, true)
  assert.equal(definition.locations.kadatheron.resign, true)
  for (const port of PORT_LOCATIONS) assert.equal(definition.locations[port].resign, true, `${port} 应为港口并提供撤退`)

  const state = makeState()
  state.markerCounts = { reference: 3 }
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'skull'), { delta: -3 })
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'cultist'), { delta: 0, drawAnother: true })
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'tablet'), { delta: -2 })
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'elderthing'), { delta: 2 })
  state.difficulty = 'hard'
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'skull'), { delta: -4 })
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'tablet'), { delta: -3 })
  assert.deepEqual(searchForKadathChaosToken(state, state.investigators[0], 'elderthing'), { delta: 1 })
  assert.equal(signsOfTheGods(state), 3)

  const api = makeApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.finish.length, 0, '3 个神迹不应进入结局 1')
  state.markerCounts.reference = 10
  behavior.checkObjectives(state, api)
  assert.deepEqual(api.calls.finish, ['resolution1'])
})

test('06119 寻觅卡达斯：setupEnemies 按卡面生成一群乌尼斯（3–4 人局再加 1 张）', () => {
  const state = makeState({ numInvestigators: 3 })
  const api = makeApi(state)
  behavior.setupEnemies(state, [], { spawnEnemy: (state2, code, locationId) => api.spawn(code, locationId) })
  assert.deepEqual(api.calls.spawns, [
    { code: PACK_OF_VOONITHS, locationId: 'skaiRiver' },
    { code: PACK_OF_VOONITHS, locationId: 'dylathLeen' },
  ])
  assert.equal(state.scenarioFlags.deferSwarmPlacement, false)
})

test('06119 寻觅卡达斯：结局分流写入卡达斯的证据/被俘记录', () => {
  const state = makeState({ records: {} })
  state.markerCounts = { reference: 3 }
  state.investigators[0].defeated = true
  state.investigators[0].name = '被俘者'
  state.investigators[0].resigned = true
  const api = makeApi(state)
  const result = behavior.resolution(state, 'noResolution', [], api)
  assert.equal(result.award, true)
  assert.deepEqual(state.campaign.records.wasCaptured, ['被俘者'])
  assert.equal(state.campaign.records.evidenceOfKadath, 3)
  assert.equal(state.campaign.records.randolphEludedCapture, true)
})

test('06119 寻觅卡达斯：混乱标记后果（cultist 隐藏值/tablet 二选一/elder_thing 额外线索）', () => {
  const state = makeState()
  state.locations = [{ id: 'ulthar', code: '06127', originalCode: '06127', name: '乌撒', revealed: true, shroud: 1, shroudMod: 0 }]
  const inv = state.investigators[0]
  inv.location = 'ulthar'
  const investigate = { label: '调查', code: '06127', name: '乌撒' }

  // [cultist]：调查失败 → 该地点隐藏值 +1，直到本轮结束（roundEnded 清除）。
  const cultistApi = makeApi(state)
  behavior.afterTest(state, inv, { success: false, token: 'cultist', drawn: ['cultist'], cancelledTokens: [], source: investigate }, cultistApi, {})
  assert.deepEqual(cultistApi.calls.setHere.at(-1), { id: 'ulthar', amount: 1 })
  behavior.roundEnded(state, cultistApi)
  assert.deepEqual(cultistApi.calls.setHere.at(-1), { id: 'ulthar', amount: 0 })

  // [tablet]：失败时二选一 → 选 doom 在当前密谋放 1 毁灭。
  const tabletApi = makeApi(state, { choices: ['doom'] })
  behavior.afterTest(state, inv, { success: false, token: 'tablet', drawn: ['tablet'], cancelledTokens: [], source: investigate }, tabletApi, {})
  assert.deepEqual(tabletApi.calls.doom, [1])

  // [elder_thing]：调查成功 → 额外发现 1 个线索。
  const elderApi = makeApi(state)
  behavior.afterTest(state, inv, { success: true, token: 'elderthing', drawn: ['elderthing'], cancelledTokens: [], source: investigate }, elderApi, {})
  assert.deepEqual(elderApi.calls.discoverClue, [{ seat: 0, amount: 1 }])
})

// ---------------------------------------------------------------------------
// 06120 / 06121 议程
// ---------------------------------------------------------------------------

test('06120 穿过幻梦境的旅程：背面把 2 张冷原海盗与遭遇弃牌堆洗入遭遇牌库；港口正面可撤退', () => {
  const state = makeState()
  state.scenarioZones.setAside = [CORSAIR_OF_LENG, CORSAIR_OF_LENG, '05001']
  state.encounterDeck = ['04001']
  state.encounterDiscard = ['04002', '04003']
  const api = makeApi(state)
  behavior.agendaReveal(state, { code: '06120', originalCode: '06120' }, api)
  assert.equal(state.encounterDeck.filter(code => code === CORSAIR_OF_LENG).length, 2)
  assert.equal(state.encounterDiscard.length, 0)
  assert.deepEqual(state.encounterDeck.filter(code => code === '04002'), ['04002'])
  assert.equal(state.scenarioZones.setAside.includes(CORSAIR_OF_LENG), false)
  for (const port of PORT_LOCATIONS) assert.equal(definition.locations[port].resign, true)
})

test('06120 06121 正面：真实合法行动仅在港口提供撤退', () => {
  const state = liveKadath('06120-06121-port')
  for (const agendaIndex of [0, 1]) {
    state.agendaIndex = agendaIndex
    state.investigators[0].location = 'ulthar'
    assert.ok(!legalMoves(state, 0).some(move => move.action === 'resign'))
    state.investigators[0].location = 'dylathLeen'
    assert.ok(legalMoves(state, 0).some(move => move.action === 'resign'))
  }
})

test('06121 外神的使徒：背面每位存活调查员被击败；正面同为港口撤退', () => {
  const state = makeState({ numInvestigators: 3 })
  const api = makeApi(state)
  behavior.agendaReveal(state, { code: '06121', originalCode: '06121' }, api)
  assert.equal(api.calls.defeatedAll, 1)
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  for (const port of PORT_LOCATIONS) assert.equal(definition.locations[port].resign, true)
})

// ---------------------------------------------------------------------------
// 06122–06126 幕
// ---------------------------------------------------------------------------

function travelState() {
  const state = makeState()
  setupStart(state)
  state.scenarioZones.setAside = [...(definition.setAsideAliases || [])]
  state.scenarioZones.setAside = ['06145', '06151', '06149', '06149', '06149', '06148', '06147', '06146', '06086', '06150', '06150']
  return state
}

test('06122 斯凯王国：背面移出乌撒之猫/一群乌尼斯/祖格鼠、洗回千面祭司并选择下一区域', () => {
  const state = travelState()
  state.encounterDeck = ['06106', '06107', '04001']
  state.encounterDiscard = ['06108', '06109']
  state.enemies = [
    { id: 'cats', code: CATS_OF_ULTHAR, originalCode: CATS_OF_ULTHAR, location: 'ulthar' },
    { id: 'voonith', code: PACK_OF_VOONITHS, originalCode: PACK_OF_VOONITHS, location: 'skaiRiver' },
  ]
  const api = makeApi(state, { choices: ['mnar'] })
  behavior.actReveal(state, { code: '06122', originalCode: '06122' }, api)
  assert.equal(state.enemies.some(enemy => enemy.code === CATS_OF_ULTHAR), false)
  assert.equal(state.enemies.some(enemy => enemy.code === PACK_OF_VOONITHS), false)
  assert.equal(state.encounterDeck.includes('06106'), false)
  assert.equal(state.encounterDeck.includes('06107'), false)
  assert.equal(state.encounterDiscard.includes('06108'), false)
  assert.ok(['06106', '06107', '06108', '06109'].every(code => state.removedFromGame.includes(code)))
  assert.equal(state.scenarioZones.setAside.filter(code => code === PRIEST_OF_A_THOUSAND_MASKS).length, 0)
  assert.equal(state.encounterDeck.filter(code => code === PRIEST_OF_A_THOUSAND_MASKS).length, 3)
  // actReveal 在同一调用内结算区域设置。
  assert.deepEqual(state.investigators.map(inv => inv.location), ['kadatheron', 'kadatheron'])
  for (const id of ['kadatheron', 'sarnath', 'ruinsOfIb']) assert.ok(state.locations.some(location => location.id === id), `${id} 应入场`)
  assert.ok(state.enemies.some(enemy => enemy.code === BEINGS_OF_IB && enemy.location === 'ruinsOfIb'))
  assert.equal(state.scenarioFlags.regionsVisited.includes('mnar'), true)
  assert.equal(state.scenarioFlags.nextActIndex, 2)
})

test('06123 奥瑞巴岛：背面排除已造访区域；全部造访后进入结局 1', () => {
  const state = travelState()
  state.scenarioFlags.regionsVisited = ['oriab']
  const api = makeApi(state, { choices: ['forbiddenLands'] })
  behavior.actReveal(state, { code: '06123', originalCode: '06123' }, api)
  assert.equal(state.scenarioFlags.regionsVisited.includes('forbiddenLands'), true)
  assert.ok(state.locations.some(location => location.id === 'ilekVad'))
  assert.ok(state.locations.some(location => location.id === 'forbiddenLands'))

  const state2 = travelState()
  state2.scenarioFlags.regionsVisited = REGIONS.map(region => region.id)
  const api2 = makeApi(state2)
  behavior.actReveal(state2, { code: '06123', originalCode: '06123' }, api2)
  assert.deepEqual(api2.calls.finish, ['resolution1'])
})

test('06124 往事之祸：背面把伊伯生物移出游戏并选择未造访区域', () => {
  const state = travelState()
  state.encounterDeck = ['06148', '04001']
  state.enemies = [{ id: 'ib', code: BEINGS_OF_IB, originalCode: BEINGS_OF_IB, location: 'ruinsOfIb' }]
  state.scenarioFlags.regionsVisited = ['oriab']
  const api = makeApi(state, { choices: ['forbiddenLands'] })
  behavior.actReveal(state, { code: '06124', originalCode: '06124' }, api)
  assert.equal(state.encounterDeck.includes(BEINGS_OF_IB), false)
  assert.equal(state.enemies.some(enemy => enemy.id === 'ib'), false)
  assert.equal(state.scenarioFlags.regionsVisited.includes('forbiddenLands'), true)
})

test('06125 探寻夜色：背面把夜色怪群与跟踪的蝎狮移出游戏', () => {
  const state = travelState()
  state.encounterDeck = [HORDE_OF_NIGHT, STALKING_MANTICORE, '04001']
  state.enemies = [
    { id: 'horde', code: HORDE_OF_NIGHT, originalCode: HORDE_OF_NIGHT, location: 'zulanThek' },
    { id: 'manticore', code: STALKING_MANTICORE, originalCode: STALKING_MANTICORE, location: 'forbiddenLands' },
  ]
  state.scenarioFlags.regionsVisited = ['oriab', 'mnar']
  const api = makeApi(state, { choices: ['timelessRealm'] })
  behavior.actReveal(state, { code: '06125', originalCode: '06125' }, api)
  assert.equal(state.encounterDeck.includes(HORDE_OF_NIGHT), false)
  assert.equal(state.encounterDeck.includes(STALKING_MANTICORE), false)
  assert.equal(state.enemies.some(enemy => ['horde', 'manticore'].includes(enemy.id)), false)
  assert.equal(state.scenarioFlags.regionsVisited.includes('timelessRealm'), true)
  assert.ok(state.locations.some(location => location.id === 'celephais'))
})

test('06126 国王的敕令：背面把蠕行之雾移出游戏', () => {
  const state = travelState()
  state.encounterDeck = [CRAWLING_MIST, '04001']
  state.enemies = [{ id: 'mist', code: CRAWLING_MIST, originalCode: CRAWLING_MIST, location: 'hazuthKleg' }]
  state.scenarioFlags.regionsVisited = ['oriab']
  const api = makeApi(state, { choices: ['forbiddenLands'] })
  behavior.actReveal(state, { code: '06126', originalCode: '06126' }, api)
  assert.equal(state.encounterDeck.includes(CRAWLING_MIST), false)
  assert.equal(state.enemies.some(enemy => enemy.id === 'mist'), false)
  assert.equal(state.scenarioFlags.regionsVisited.includes('forbiddenLands'), true)
})

// ---------------------------------------------------------------------------
// 06127–06132 地点与背面故事卡
// ---------------------------------------------------------------------------

test('06127 乌撒：掩藏地点、翻面门槛为「无线索」、读过故事后不能再翻', () => {
  const state = makeState()
  const placed = placeLocation(state, 'ulthar')
  const location = placed.location
  assert.equal(location.veiled, true)
  assert.equal(canFlipVeiledLocation(location, 1), false)
  assert.equal(canFlipVeiledLocation(location, 0), true)
  state.scenarioFlags['storyRead:ulthar'] = true
  assert.match(behavior.actionBlocked(state, state.investigators[0], { action: 'flipVeiled', locationId: 'ulthar' }), /已经翻面/)
  assert.equal(definition.locations.ulthar.backCode, '06127b')
})

test('06127b 神秘生物：检查剧本日志——猫群贡品失去行动并结束回合；强行入庙生成乌撒之猫', () => {
  const state = makeState({
    records: { theCatsCollectedTheirTributeFromTheZoogs: true, theInvestigatorsForcedTheirWayIntoTheTemple: true },
  })
  state.investigators[0].actionsLeft = 2
  state.scenarioZones.setAside = [CATS_OF_ULTHAR]
  state.locations = [{ id: 'ulthar', name: '乌撒', revealed: true }]
  const api = makeApi(state)
  entryOf('06127b').assetRule.resolve(state, api, { inv: state.investigators[0], location: state.locations[0] })
  assert.deepEqual(api.calls.loseActions, [{ seat: 0, amount: 2 }])
  assert.deepEqual(api.calls.endTurn, [0])
  assert.equal(api.calls.spawnedEngaged.at(-1).code, CATS_OF_ULTHAR)
  assert.equal(api.calls.spawnedEngaged.at(-1).seat, 0)
  assert.ok(!state.scenarioZones.setAside.includes(CATS_OF_ULTHAR))
})

test('06127b 强行入庙：真实场景中的乌撒之猫只从放在一边生成一次', () => {
  const state = liveKadath('06127b-set-aside')
  delete state.campaign.records.theCatsCollectedTheirTributeFromTheZoogs
  state.campaign.records.theInvestigatorsForcedTheirWayIntoTheTemple = true
  const inv = state.investigators[0]
  const location = state.locations.find(item => item.id === inv.location)
  assert.ok(state.scenarioZones.setAside.includes(CATS_OF_ULTHAR))
  const api = scenarioRuntime(state, [])
  for (let attempt = 0; attempt < 2; attempt++) {
    entryOf('06127b').assetRule.resolve(state, api, { inv, location })
  }
  const cats = state.enemies.filter(enemy => enemy.code === CATS_OF_ULTHAR && !enemy.hostId)
  assert.equal(cats.length, 1)
  assert.equal(cats[0].engagedSeat, 0)
  assert.ok(!state.scenarioZones.setAside.includes(CATS_OF_ULTHAR))
})

test('06128 斯凯河：未翻面时离开检定（意志/敏捷二选一），失败翻面并结算背面', () => {
  const state = makeState()
  setupStart(state)
  const api = makeApi(state)
  state.scenarioFlags.skaiLeaveSkill = 'agility'
  const rule = entryOf('06128').locationRule.onLeave
  assert.deepEqual(rule.forcedTest.skillChoice, ['willpower', 'agility'])
  assert.equal(rule.forcedTest.difficulty, 2)
  assert.deepEqual(behavior.locationLeaveTest(state, state.investigators[0], state.locations.find(location => location.id === 'skaiRiver')),
    { skill: 'agility', difficulty: 2 })
  state.scenarioFlags['storyRead:skaiRiver'] = true
  assert.equal(behavior.locationLeaveTest(state, state.investigators[0], state.locations.find(location => location.id === 'skaiRiver')), null)
  behavior.locationLeaveFailed(state, state.investigators[0], state.locations.find(location => location.id === 'skaiRiver'), api)
  assert.ok(api.calls.info.some(line => /斯凯河/.test(line)))
})

test('06128b 如梦恐惧：斯凯河无生物敌人时弃遭遇牌库顶直到生物敌人并交战', () => {
  const state = makeState()
  state.locations = [{ id: 'skaiRiver', name: '斯凯河', revealed: true }]
  state.investigators[0].location = 'skaiRiver'
  state.encounterDeck = [CREATURE_ENEMY, NON_ENEMY_CARD]
  const api = makeApi(state)
  entryOf('06128b').assetRule.resolve(state, api, { inv: state.investigators[0], location: state.locations[0] })
  assert.ok(state.encounterDeck.includes(NON_ENEMY_CARD) === false, '非生物卡应被弃掉')
  assert.equal(state.encounterDiscard.includes(NON_ENEMY_CARD), true)
  assert.ok(!state.encounterDiscard.includes(CREATURE_ENEMY))
  assert.deepEqual(api.calls.spawnedEngaged.at(-1), { code: CREATURE_ENEMY, locationId: 'skaiRiver', seat: 0 })
  assert.equal(api.calls.swarmPlaced.length, 0)
})

test('06128b 如梦恐惧：实战弃牌后仅将选中的物理副本从弃牌堆生成', () => {
  const state = liveKadath('06128b-encounter-discard')
  const inv = state.investigators[0]
  inv.location = 'skaiRiver'
  state.enemies = state.enemies.filter(enemy => enemy.location !== inv.location)
  const api = scenarioRuntime(state, [])
  assert.ok(api.takeFromSetAside('06146'))
  state.encounterDeck = ['06146', '06097']
  state.encounterDiscard = ['06146']
  const location = state.locations.find(item => item.id === inv.location)
  entryOf('06128b').assetRule.resolve(state, api, { inv, location })
  assert.deepEqual(state.encounterDeck, [])
  assert.deepEqual(state.encounterDiscard, ['06146', '06097'])
  const spawned = state.enemies.filter(enemy => enemy.code === '06146')
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].engagedSeat, 0)
  assert.equal(spawned[0].location, 'skaiRiver')
})

test('06128b 如梦恐惧：斯凯河已有生物敌人时改为加 1 张蜂拥卡', () => {
  const state = makeState()
  state.locations = [{ id: 'skaiRiver', name: '斯凯河', revealed: true }]
  state.investigators[0].location = 'skaiRiver'
  state.enemies = [{ id: 'creature', code: CREATURE_ENEMY, originalCode: CREATURE_ENEMY,
    name: '生物', location: 'skaiRiver', swarmCards: [], damageTaken: 0 }]
  const api = makeApi(state)
  entryOf('06128b').assetRule.resolve(state, api, { inv: state.investigators[0], location: state.locations[0] })
  assert.equal(api.calls.swarmPlaced.length, 1)
  assert.equal(api.calls.swarmPlaced[0].host, 'creature')
  assert.equal(api.calls.spawnedEngaged.length, 0)
  assert.equal(state.enemies[0].swarmCards.length, 1)
})

test('06129 狄拉斯-利恩：花 1 资源检索牌库顶 6 张找道具支援并抽取', () => {
  const state = makeState()
  const placed = placeLocation(state, 'dylathLeen')
  const inv = state.investigators[0]
  inv.location = 'dylathLeen'
  inv.deck = ['01002']
  const moves = []
  entryOf('06129').locationRule.actions({ moves, state, inv, location: placed.location })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 1)
  const api = makeApi(state)
  entryOf('06129').locationRule.performAction(state, inv, { rule: 'dylathLeenSearchItems' }, api)
  assert.deepEqual(api.calls.loseResources, [{ seat: 0, amount: 1 }])
  assert.equal(api.calls.searchTop[0].amount, 6)
  assert.equal(api.calls.searchTop[0].typeFilter, 'asset')
  assert.deepEqual(api.calls.searchTop[0].traits, ['Item'])
})

test('06129b 无穷秘密：发现 1 个神迹（参考卡资源 +1）', () => {
  const state = makeState()
  state.markerCounts = { reference: 2 }
  const api = makeApi(state)
  entryOf('06129b').assetRule.resolve(state, api, {})
  assert.equal(state.markerCounts.reference, 3)
  assert.equal(api.calls.info.length >= 1, true)
})

test('06130 卡达瑟隆：三个行动的 [action] 抽取 5 张卡牌', () => {
  const state = makeState()
  const placed = placeLocation(state, 'kadatheron')
  const inv = state.investigators[0]
  inv.location = 'kadatheron'
  const moves = []
  entryOf('06130').locationRule.actions({ moves, state, inv, location: placed.location })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 3)
  const api = makeApi(state)
  entryOf('06130').locationRule.performAction(state, inv, { rule: 'kadatheronDrawFive' }, api)
  assert.deepEqual(api.calls.drawCards, [{ seat: 0, count: 5 }])
})

test('06130b 卡达瑟隆之柱：神迹 +1 并把 1 张放在一边的黑暗夜魇洗入遭遇牌库', () => {
  const state = makeState()
  state.scenarioZones.setAside = [TENEBROUS_NIGHTGAUNT]
  const api = makeApi(state)
  entryOf('06130b').assetRule.resolve(state, api, {})
  assert.equal(state.markerCounts.reference, 1)
  assert.equal(state.encounterDeck.includes(TENEBROUS_NIGHTGAUNT), true)
  assert.equal(state.scenarioZones.setAside.includes(TENEBROUS_NIGHTGAUNT), false)
})

test('06131 萨尔纳斯：不知道伊伯的事情不能翻面；成功调查萨尔纳斯受到 1 点恐惧', () => {
  const state = makeState()
  state.locations = [{ id: 'sarnath', code: '06131', originalCode: '06131', name: '萨尔纳斯', revealed: true, veiled: false }]
  state.investigators[0].location = 'sarnath'
  assert.match(behavior.actionBlocked(state, state.investigators[0], { action: 'flipVeiled', locationId: 'sarnath' }), /伊伯/)
  state.scenarioFlags.knowWhatHappenedToIb = true
  assert.equal(behavior.actionBlocked(state, state.investigators[0], { action: 'flipVeiled', locationId: 'sarnath' }), undefined)

  const api = makeApi(state)
  const result = { success: true, successBy: 0, token: 'skull', source: { label: '调查', code: '06131', name: '萨尔纳斯' } }
  behavior.afterTest(state, state.investigators[0], result, api, {})
  assert.deepEqual(api.calls.horror, [{ seat: 0, amount: 1 }])
})

test('06131 萨尔纳斯：用实际调查检定的价值和难度结算成功差值', () => {
  const state = liveKadath('06131-success-margin')
  const api = scenarioRuntime(state, [])
  api.place('sarnath', 0)
  state.investigators[0].assets = []
  const wide = investigateWithTokens(state, 'sarnath', 3, ['0'])
  assert.equal(wide.value - wide.difficulty, 2)
  assert.equal(state.investigators[0].horror, 0)
  const narrow = investigateWithTokens(state, 'sarnath', 4, ['0'])
  assert.equal(narrow.value - narrow.difficulty, 1)
  assert.equal(state.investigators[0].horror, 1)
})

test('06131b 萨尔纳斯的覆灭：发现 1 个神迹（参考卡资源 +1）', () => {
  const state = makeState()
  const api = makeApi(state)
  entryOf('06131b').assetRule.resolve(state, api, {})
  assert.equal(state.markerCounts.reference, 1)
})

test('06132 伊伯遗迹：调查时揭示 skull/cultist 标记后弃掉一个你控制的支援', () => {
  const state = makeState()
  state.locations = [{ id: 'ruinsOfIb', code: '06132', originalCode: '06132', name: '伊伯遗迹', revealed: true }]
  const inv = state.investigators[0]
  inv.location = 'ruinsOfIb'
  inv.assets = [{ id: 'asset-a', code: '01001', name: '支援甲' }]
  const api = makeApi(state, { choices: ['asset-a'] })
  const result = { success: true, token: 'skull', source: { label: '调查', code: '06132', name: '伊伯遗迹' } }
  behavior.afterTest(state, inv, result, api, {})
  assert.deepEqual(api.calls.discardedAssets, [{ seat: 0, assetId: 'asset-a' }])
  assert.equal(inv.assets.length, 0)
})

test('06132 伊伯遗迹：真实检定首揭异教徒、最后揭数字仍弃掉玩家支援', () => {
  const state = liveKadath('06132-reveal-cultist')
  const api = scenarioRuntime(state, [])
  api.place('ruinsOfIb', 0)
  state.investigators[0].assets = []
  api.giveAsset(0, '01018')
  const result = investigateWithTokens(state, 'ruinsOfIb', 1, ['cultist', '0'])
  assert.deepEqual(result.drawn, ['cultist', '0'])
  assert.equal(result.token, '0')
  assert.equal(state.investigators[0].assets.length, 0)
  assert.ok(state.investigators[0].discard.includes('01018'))
})

test('06132b 亡者之魂：记住调查员「知道伊伯发生的事情」', () => {
  const state = makeState()
  const api = makeApi(state)
  entryOf('06132b').assetRule.resolve(state, api, {})
  assert.equal(state.scenarioFlags.knowWhatHappenedToIb, true)
})

