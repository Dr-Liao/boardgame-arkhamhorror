// 验收 04-a 分片 2（sha / tbb / tcoa，含 turnBackTime 的 04 段卡）逐卡证据。
//
// 每个用例标题含卡号；断言读取的是真实实现读点（条目规则 / 章节 behavior 钩子 /
// 引擎数据规则），不是「条目存在」。本文件由验收审计产出，主进程合并时需登记进
// tests/suites.mjs（fast tier）与 tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as shaModule from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/index.js'
import * as tbbModule from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/index.js'
import * as tcoaModule from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import * as tbtModule from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/index.js'
import entry04315 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04315.js'
import entry04316 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04316.js'
import entry04317 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04317.js'
import entry04319 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04319.js'
import entry04328 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04328.js'
import entry04334 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04334.js'
import entry04335 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04335.js'
import entry04337 from '../src/cards/encounter-entries/theForgottenAge/shatteredAeons/04337.js'
import entry04164 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04164.js'
import entry04166 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04166.js'
import entry04169 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04169.js'
import entry04170 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04170.js'
import entry04176 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04176.js'
import entry04180 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04180.js'
import entry04183 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04183.js'
import entry04185 from '../src/cards/encounter-entries/theForgottenAge/theBoundaryBeyond/04185.js'
import entry04261 from '../src/cards/encounter-entries/theForgottenAge/theCityOfArchives/04261.js'

const clone = value => structuredClone(value)

function makeInvestigator(seat = 0, location = null) {
  return {
    seat, code: '01001', name: `调查员${seat + 1}`, location,
    damage: 0, horror: 0, clues: 0, resources: 5,
    hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
    actionsLeft: 3, maxHealth: 7, maxSanity: 7, enemyPassiveTraits: [],
  }
}

function baseState(mod, overrides = {}) {
  const scenario = clone(mod.scenario)
  const state = {
    scenario,
    acts: clone(scenario.acts || []),
    agendas: clone(scenario.agendas || []),
    actIndex: 0,
    agendaIndex: 0,
    investigators: [makeInvestigator(0)],
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [...(scenario.encounterDeck || [])],
    encounterDiscard: [],
    explorationDeck: [],
    explorationDiscard: [],
    chaosBag: [],
    campaign: { leadSeat: 0, records: {}, investigators: { 0: { id: 'inv-0', deck: [], purchases: [] } }, chaosBag: [], supplies: {} },
    difficulty: 'standard',
    numInvestigators: 1,
    round: 1,
    phase: 'investigation',
    doom: 0,
    clues: 0,
    status: 'playing',
    currentSeat: 0,
    skillTest: null,
  }
  Object.assign(state, overrides)
  return state
}

function locationInstance(state, id, code, overrides = {}) {
  const card = ALL_CARDS[code] || {}
  return {
    id, code, originalCode: code, name: card.nameZh || code,
    traits: [...(card.traits || [])], clues: 0, doom: 0, connections: [], attachments: [],
    ...overrides,
  }
}

function makeApi(state, options = {}) {
  const calls = {}
  const rec = name => (calls[name] ||= [])
  const testResults = options.testResults ? [...options.testResults] : []
  const choices = options.choices ? [...options.choices] : []
  const base = {
    calls,
    info(text) { rec('info').push(String(text)) },
    random() { return options.random ?? 0.5 },
    test(seat, skill, difficulty, resolve, extra) {
      rec('test').push({ seat, skill, difficulty, extra })
      const override = testResults.length ? testResults.shift() : {}
      const result = { success: true, value: difficulty, difficulty, skill, drawn: [], cancelledTokens: [], ...override }
      if (override.success === undefined) result.success = true
      resolve(result)
      return result
    },
    choose(request) {
      rec('choose').push(request)
      if (choices.length) return choices.shift()
      return request.options?.[0]?.id
    },
    spawn(code, location) {
      const card = ALL_CARDS[code] || {}
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.nameZh || code, location, doom: 0, clues: 0,
        exhausted: false, engagedSeat: null, health: card.health || 3,
        damageTaken: 0, traits: [...(card.traits || [])],
      }
      state.enemies.push(enemy)
      rec('spawn').push({ code, location })
      return enemy
    },
    place(id) {
      const definition = state.scenario.locations?.[id]
      if (!definition) return null
      const instance = {
        ...clone(definition), id, revealed: true,
        clues: definition.cluesFixed ?? (definition.cluesPerInvestigator || 0) * state.numInvestigators,
        doom: 0, attachments: [],
      }
      state.locations.push(instance)
      rec('place').push(id)
      return instance
    },
    remove(id) {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
      rec('remove').push(id)
    },
    moveInvestigator(seat, destination) {
      const inv = state.investigators[seat]
      if (inv) inv.location = destination
      rec('moveInvestigator').push([seat, destination])
    },
    moveEnemy(enemy, destination) {
      enemy.location = destination
      rec('moveEnemy').push([enemy?.id, destination])
    },
    damage(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.damage += amount
      rec('damage').push([seat, amount])
    },
    horror(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.horror += amount
      rec('horror').push([seat, amount])
    },
    directDamage(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.damage += amount
      rec('directDamage').push([seat, amount])
    },
    directHorror(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.horror += amount
      rec('directHorror').push([seat, amount])
    },
    healDamage(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.damage = Math.max(0, inv.damage - amount)
      rec('healDamage').push([seat, amount])
    },
    healHorror(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.horror = Math.max(0, inv.horror - amount)
      rec('healHorror').push([seat, amount])
    },
    drawCards(seat, amount) {
      const inv = state.investigators[seat]
      if (options.applyDraws && inv) for (let i = 0; i < amount; i++) inv.hand.push('01001')
      rec('drawCards').push([seat, amount])
    },
    drawEncounter(seat) { rec('drawEncounter').push(seat) },
    gainClues(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.clues += amount
      rec('gainClues').push([seat, amount])
    },
    spendClues(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.clues = Math.max(0, inv.clues - amount)
      rec('spendClues').push([seat, amount])
    },
    payClues(amount, locationId) {
      rec('payClues').push([amount, locationId])
      return { paid: amount }
    },
    advanceAct() { state.actIndex += 1; rec('advanceAct').push(true) },
    advanceAgenda() { state.agendaIndex += 1; rec('advanceAgenda').push(true) },
    finish(key) { rec('finish').push(key) },
    addDoom(amount) { state.doom += amount; rec('addDoom').push(amount) },
    removeDoom(amount) { rec('removeDoom').push(amount); return 0 },
    doom() { return state.doom },
    placeDoomOnCard(card, amount) { card.doom = (card.doom || 0) + amount },
    discardChosen(seat, amount, source) { rec('discardChosen').push([seat, amount, source]) },
    threat(seat, code) {
      const inv = state.investigators[seat]
      const card = { id: `threat-${code}-${inv.threat.length}`, code, originalCode: code, doom: 0 }
      inv.threat.push(card)
      rec('threat').push([seat, code])
      return card
    },
    defeat(inv, cause) {
      inv.defeated = true
      inv.defeatCause = cause
      rec('defeat').push([inv.seat, cause])
    },
    defeatEnemy(enemy) {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      rec('defeatEnemy').push(enemy?.code)
    },
    giveAsset(seat, code) {
      const asset = { id: `asset-${code}`, code, originalCode: code }
      state.investigators[seat].assets.push(asset)
      rec('giveAsset').push([seat, code])
      return asset
    },
    addToExplorationDeck(ids = []) {
      state.explorationDeck = [...(state.explorationDeck || []), ...ids]
      rec('addToExplorationDeck').push([...ids])
      return true
    },
    moveRelicOfAges({ code = null, location = null, seat = null } = {}) {
      state.relicOfAges = { code: code ?? state.relicOfAges?.code ?? null, location, seat }
      rec('moveRelicOfAges').push({ code, location, seat })
    },
    cardReveal(code) { rec('cardReveal').push(code) },
    isPoisoned(seat) { return (state.investigators[seat].threat || []).some(card => card.code === '04102') },
    poison(seat) {
      state.investigators[seat].threat.push({ id: `poison-${seat}`, code: '04102', originalCode: '04102' })
      rec('poison').push(seat)
    },
    hasSupply(seat, name) { return (state.campaign.supplies?.[seat] || []).includes(name) },
    checkSupplies(seat, name) { return (state.campaign.supplies?.[seat] || []).includes(name) },
    shuffleDiscard() { rec('shuffleDiscard').push(true) },
    shuffleEncounterDeck() { rec('shuffleEncounterDeck').push(true) },
    discardRandom(seat, amount) { rec('discardRandom').push([seat, amount]) },
    discardTop(seat, amount) { rec('discardTop').push([seat, amount]) },
    loseActions(seat, amount) {
      const inv = state.investigators[seat]
      if (inv) inv.actionsLeft = Math.max(0, inv.actionsLeft - amount)
      rec('loseActions').push([seat, amount])
    },
    doomOn(enemy, amount = 1) {
      enemy.doom = (enemy.doom || 0) + amount
      rec('doomOn').push([enemy?.id, amount])
      return enemy.doom
    },
    explore(seat) { rec('explore').push(seat) },
  }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol') return undefined
      return (...args) => { rec(prop).push(args); return undefined }
    },
  })
}

// ---------------------------------------------------------------------------
// sha：破碎永世（36 张）
// ---------------------------------------------------------------------------

test('04315 时间之线：翻面时无形之子在联结点生成，密谋进胜利区并获得复仇 1', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324')]
  const api = makeApi(state)
  const hooks = {
    formlessSpawn: () => '04337',
    nexus: () => 'nexusOfNKai',
    byId: id => state.locations.find(location => location.id === id),
    removeFromSetAside: () => {},
    addToVictory: (card, extra = {}) => { state.victoryDisplay.push({ id: card.id, code: card.code, ...extra }) },
  }
  entry04315.agendaRule.onReveal(state, { id: 'agenda1', code: '04315' }, api, hooks)
  assert.deepEqual(api.calls.spawn.at(-1), { code: '04337', location: 'nexusOfNKai' })
  assert.equal(state.victoryDisplay[0].code, '04315')
  assert.equal(state.victoryDisplay[0].vengeance, 1)
})

test('04316 垂摆之线：无形之子在场时联结点放 2 毁灭，在胜利区时洗回遭遇牌库', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324', { doom: 1 })]
  state.enemies = [{ id: 'e-formation', code: '04337', originalCode: '04337', location: 'nexusOfNKai', doom: 0 }]
  state.victoryDisplay = []
  state.encounterDeck = []
  const api = makeApi(state)
  const hooks = {
    formlessSpawn: () => '04337',
    nexus: () => 'nexusOfNKai',
    byId: id => state.locations.find(location => location.id === id),
    addToVictory: () => {},
  }
  entry04316.agendaRule.onReveal(state, { id: 'agenda2', code: '04316' }, api, hooks)
  assert.equal(state.locations[0].doom, 3)

  state.enemies = []
  state.victoryDisplay = [{ id: 'f', code: '04337', originalCode: '04337', victory: 1 }]
  entry04316.agendaRule.onReveal(state, { id: 'agenda2', code: '04316' }, api, hooks)
  assert.equal(state.victoryDisplay.length, 0)
  assert.ok(state.encounterDeck.includes('04337'))
  assert.ok(api.calls.shuffleEncounterDeck.length >= 1)
})

test('04317 断了的线：翻面直接进入结局 4（时间之布被拆解）', () => {
  const state = baseState(shaModule)
  const api = makeApi(state)
  entry04317.agendaRule.onReveal(state, { id: 'agenda3', code: '04317' }, api)
  assert.deepEqual(api.calls.finish, ['r4'])
})

test('04319 搜寻兄弟会：背面把破碎地点与弃牌堆巫术洗入探索牌库，遗物丢失时取时光涌流', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'aPocketInTime', '04330')]
  state.investigators[0].location = 'aPocketInTime'
  state.scenarioFlags = { foundHexFromDiscard: [] }
  state.campaign.records = { theRelicIsMissing: true }
  state.encounterDiscard = ['04339']
  state.explorationDeck = []
  const api = makeApi(state)
  const hooks = {
    flags: () => state.scenarioFlags,
    records: () => state.campaign.records,
    active: () => state.investigators.filter(inv => !inv.defeated && !inv.resigned),
    byId: id => state.locations.find(location => location.id === id),
    removeSetAsideLocation: () => {},
    removeFromSetAside: () => {},
    shuffleInPlace: () => {},
    shatteredLocations: () => ['ruinsOfNewYork', 'mu'],
    relicAgesUnleash: () => '04343',
    pocket: () => 'aPocketInTime',
  }
  entry04319.actRule.onReveal(state, { id: 'act2', code: '04319' }, api, hooks)
  assert.ok(state.explorationDeck.includes('ruinsOfNewYork'))
  assert.ok(state.explorationDeck.includes('mu'))
  assert.ok(state.explorationDeck.includes('04339'))
  assert.equal(state.encounterDiscard.length, 0)
  assert.deepEqual(state.scenarioFlags.foundHexFromDiscard, ['04339'])
  assert.equal(state.relicOfAges.code, '04343')
  assert.equal(state.relicOfAges.location, 'aPocketInTime')
})

test('04321 修补裂痕：检定成功把破碎地点附属到遗物，凑够人数+1 后推进幕 4a', () => {
  const state = baseState(shaModule)
  state.actIndex = 3
  state.acts[3] = clone(state.scenario.acts[3])
  state.locations = [
    locationInstance(state, 'ruinsOfNewYork', '04331', { traits: ['Shattered', 'Future', 'Ruins'] }),
    locationInstance(state, 'mu', '04332', { traits: ['Shattered', 'Ancient'] }),
    locationInstance(state, 'aPocketInTime', '04330', { traits: ['Extradimensional'] }),
  ]
  state.relicOfAges = { code: '04191', location: null, seat: 0 }
  state.investigators[0].location = 'ruinsOfNewYork'
  const api = makeApi(state)
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'attachLocation' }, api)
  assert.equal(state.scenarioFlags.relicUnderneath.length, 1)
  assert.equal(state.investigators[0].location, 'aPocketInTime')
  assert.ok(!state.locations.some(location => location.id === 'ruinsOfNewYork'))

  state.investigators[0].location = 'mu'
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'attachLocation' }, api)
  assert.equal(state.scenarioFlags.relicUnderneath.length, 2)
  shaModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)
})

test('04322 失乐园：瓦卢西亚被附属到遗物时推进幕 4a', () => {
  const state = baseState(shaModule)
  state.actIndex = 3
  state.acts[3] = { id: 'act4-paradiseLost', code: '04322', originalCode: '04322' }
  state.locations = [
    locationInstance(state, 'valusia', '04335', { traits: ['Shattered', 'Ancient'] }),
    locationInstance(state, 'aPocketInTime', '04330', { traits: ['Extradimensional'] }),
  ]
  state.investigators[0].location = 'valusia'
  const api = makeApi(state)
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'attachLocation' }, api)
  assert.equal(state.scenarioFlags.relicUnderneath[0].id, 'valusia')
  shaModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)
})

test('04323 锁定时间：纳克特被附属到遗物时推进幕 4a', () => {
  const state = baseState(shaModule)
  state.actIndex = 3
  state.acts[3] = { id: 'act4-timelock', code: '04323', originalCode: '04323' }
  state.locations = [
    locationInstance(state, 'pnakotus', '04334', { traits: ['Shattered', 'Ancient'] }),
    locationInstance(state, 'aPocketInTime', '04330', { traits: ['Extradimensional'] }),
  ]
  state.investigators[0].location = 'pnakotus'
  const api = makeApi(state)
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'attachLocation' }, api)
  assert.equal(state.scenarioFlags.relicUnderneath[0].id, 'pnakotus')
  shaModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)
})

test('04325 伊塔卡：同地点可谈判，拒绝条件后横置并禁止再谈判', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324')]
  state.investigators[0].location = 'nexusOfNKai'
  state.enemies = [{ id: 'ichtaca', code: '04325', originalCode: '04325', name: '伊塔卡', location: 'nexusOfNKai', exhausted: false, engagedSeat: 0, doom: 0 }]
  const api = makeApi(state, { choices: ['reject'] })
  const moves = shaModule.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'parleyEnemy' && move.enemyId === 'ichtaca'))
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'parleyEnemy', enemyId: 'ichtaca' }, api)
  assert.equal(state.enemies[0].exhausted, true)
  assert.equal(state.enemies[0].engagedSeat, null)
  assert.equal(state.scenarioFlags.noParleyIchtaca, true)
  assert.deepEqual(api.calls.cardReveal, ['04325b'])
})

test('04325b 伊格的宽恕：接受条件换成失乐园并放过蛇族；伊格之怒 16 时拒绝', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324')]
  state.investigators[0].location = 'nexusOfNKai'
  state.enemies = [{ id: 'ichtaca', code: '04325', originalCode: '04325', name: '伊塔卡', location: 'nexusOfNKai', exhausted: false, engagedSeat: 0, doom: 0 }]
  state.acts[3] = clone(state.scenario.acts[3])
  const api = makeApi(state, { choices: ['accept'] })
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'parleyEnemy', enemyId: 'ichtaca' }, api)
  assert.equal(state.enemies.length, 0)
  assert.equal(state.acts[3].originalCode, '04322')
  assert.equal(state.scenarioFlags.noParleyAlejandro, true)
  assert.ok(state.investigators[0].enemyPassiveTraits.includes('Serpent'))

  const refused = baseState(shaModule)
  refused.locations = [locationInstance(refused, 'nexusOfNKai', '04324')]
  refused.investigators[0].location = 'nexusOfNKai'
  refused.enemies = [{ id: 'ichtaca', code: '04325', originalCode: '04325', name: '伊塔卡', location: 'nexusOfNKai', exhausted: false, engagedSeat: 0, doom: 0 }]
  refused.campaign.records = { yigsFury: 16 }
  const refusedApi = makeApi(refused, { choices: ['accept'] })
  shaModule.behavior.performAction(refused, refused.investigators[0], { rule: 'parleyEnemy', enemyId: 'ichtaca' }, refusedApi)
  assert.equal(refused.enemies.length, 1)
  assert.equal(refused.scenarioFlags.noParleyAlejandro, undefined)
})

test('04326 亚历山卓·维拉：同地点可谈判，揭示石板标记时自动成功并翻面', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'aPocketInTime', '04330')]
  state.investigators[0].location = 'aPocketInTime'
  state.enemies = [{ id: 'alejandro', code: '04326', originalCode: '04326', name: '亚历山卓', location: 'aPocketInTime', exhausted: false, engagedSeat: 0, doom: 0 }]
  state.acts[3] = clone(state.scenario.acts[3])
  const api = makeApi(state, { testResults: [{ success: false, value: 0, drawn: ['tablet'] }], choices: ['accept'] })
  const moves = shaModule.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'parleyEnemy' && move.enemyId === 'alejandro'))
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'parleyEnemy', enemyId: 'alejandro' }, api)
  assert.equal(state.enemies.length, 0)
  assert.equal(state.acts[3].originalCode, '04323')
  assert.equal(state.scenarioFlags.noParleyIchtaca, true)
  assert.deepEqual(api.calls.cardReveal, ['04326b'])
})

test('04326b 另有他法：拒绝条件后翻回正面并禁止再与亚历山卓谈判', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'aPocketInTime', '04330')]
  state.investigators[0].location = 'aPocketInTime'
  state.enemies = [{ id: 'alejandro', code: '04326', originalCode: '04326', name: '亚历山卓', location: 'aPocketInTime', exhausted: false, engagedSeat: 0, doom: 0 }]
  const api = makeApi(state, { choices: ['reject'] })
  shaModule.behavior.performAction(state, state.investigators[0], { rule: 'parleyEnemy', enemyId: 'alejandro' }, api)
  assert.equal(state.enemies.length, 1)
  assert.equal(state.enemies[0].exhausted, true)
  assert.equal(state.scenarioFlags.noParleyAlejandro, true)
})

test('04328 拉莱耶海岸：入场放 1 毁灭，隐藏值按本地点每张卡（含自身）的毁灭 +1', () => {
  const state = baseState(shaModule)
  const shores = locationInstance(state, 'shoresOfRlyeh', '04328', { doom: 1, attachments: [{ id: 'a', doom: 2 }] })
  state.locations = [shores]
  state.investigators[0].location = 'shoresOfRlyeh'
  const amount = entry04328.modifiers[0].amount({ state, entity: shores })
  assert.equal(amount, 3)

  const fresh = locationInstance(state, 'shoresOfRlyeh', '04328')
  state.locations = [fresh]
  state.investigators[0].location = 'shoresOfRlyeh'
  shaModule.behavior.locationEntered(state, state.investigators[0], fresh, makeApi(state))
  assert.equal(fresh.doom, 1)
})

test('04332 姆大陆：每次检定的第一个符号标记获得「再揭示一个标记」', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'mu', '04332')]
  state.investigators[0].location = 'mu'
  state.skillTest = {}
  const api = makeApi(state)
  const first = shaModule.behavior.resolveChaosToken(state, state.investigators[0], 'skull', api)
  assert.equal(first.drawAnother, true)
  assert.equal(first.delta, -2)
  const second = shaModule.behavior.resolveChaosToken(state, state.investigators[0], 'cultist', api)
  assert.notEqual(second.drawAnother, true)
})

test('04333 亚特兰蒂斯：自动失败标记放毁灭，满 3 个时地点移出游戏并击败此地所有单位', () => {
  const state = baseState(shaModule)
  const atlantis = locationInstance(state, 'atlantis', '04333', { doom: 0 })
  state.locations = [atlantis]
  state.investigators[0].location = 'atlantis'
  state.enemies = [{ id: 'e1', code: '04083', originalCode: '04083', location: 'atlantis', doom: 0, defeated: false }]
  const api = makeApi(state)
  const result = { success: false, value: 0, difficulty: 2, drawn: ['autofail'], cancelledTokens: [] }
  shaModule.behavior.afterTest(state, state.investigators[0], result, api)
  assert.equal(state.locations[0].doom, 1)
  state.locations[0].doom = 2
  shaModule.behavior.afterTest(state, state.investigators[0], result, api)
  assert.equal(state.locations.length, 0)
  assert.equal(state.enemies.length, 0)
  assert.equal(state.investigators[0].defeated, true)
})

test('04334 纳克特：需 3 个石板标记；发动后拿走本地全部线索并抽等量牌（每场一次）', () => {
  const state = baseState(shaModule)
  const pnakotus = locationInstance(state, 'pnakotus', '04334', { clues: 2 })
  state.locations = [pnakotus]
  state.investigators[0].location = 'pnakotus'
  state.chaosBag = ['tablet', 'tablet', 'tablet', 'skull']
  const moves = []
  entry04334.locationRule.actions({ state, moves })
  assert.equal(moves[0].rule, 'pnakotusInsight')
  assert.equal(moves[0].reason, null)
  const api = makeApi(state)
  shaModule.behavior.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(state.locations[0].clues, 0)
  assert.equal(state.investigators[0].clues, 2)
  assert.deepEqual(api.calls.drawCards.at(-1), [0, 2])
  assert.equal(state.scenarioFlags.pnakotusUsed, true)
  const after = []
  entry04334.locationRule.actions({ state, moves: after })
  assert.equal(after[0].used, true)
  assert.match(after[0].reason, /已使用/)
})

test('04335 瓦卢西亚：需 3 个异教徒标记；发动后治疗 2/2 并令隐藏值归 0（每场一次）', () => {
  const state = baseState(shaModule)
  const valusia = locationInstance(state, 'valusia', '04335', { clues: 2 })
  state.locations = [valusia]
  state.investigators[0].location = 'valusia'
  state.investigators[0].damage = 3
  state.investigators[0].horror = 3
  state.chaosBag = ['cultist', 'cultist', 'cultist']
  const moves = []
  entry04335.locationRule.actions({ state, moves })
  assert.equal(moves[0].reason, null)
  const api = makeApi(state)
  shaModule.behavior.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.scenarioFlags.valusiaShroudZero, true)
  const shroudDelta = entry04335.modifiers[0].amount({ state, entity: { shroud: 4 } })
  assert.equal(shroudDelta, -4)
})

test('04336 冷原：在冷原揭示旧神标记受到 1 点恐惧，其他地点不受影响', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'plateauOfLeng', '04336'), locationInstance(state, 'mu', '04332')]
  state.investigators[0].location = 'plateauOfLeng'
  const api = makeApi(state)
  shaModule.behavior.afterTest(state, state.investigators[0], { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] }, api)
  assert.deepEqual(api.calls.horror, [[0, 1]])
  state.investigators[0].location = 'mu'
  const api2 = makeApi(state)
  shaModule.behavior.afterTest(state, state.investigators[0], { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] }, api2)
  assert.equal((api2.calls.horror || []).length, 0)
})

test('04337 无形之子：生成于联结点、不能移动，攻防按联结点毁灭标记提升', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324', { doom: 2 })]
  state.investigators[0].location = 'nexusOfNKai'
  const enemy = { id: 'formless', code: '04337', originalCode: '04337', location: 'nexusOfNKai', doom: 0 }
  const api = makeApi(state)
  assert.equal(shaModule.behavior.spawnLocation(state, '04337', 'somewhereElse', null, api), 'nexusOfNKai')
  assert.equal(shaModule.behavior.enemyStatModifier(state, enemy, 'fight'), 2)
  assert.equal(shaModule.behavior.enemyStatModifier(state, enemy, 'evade'), 2)
  assert.equal(entry04337.enemyRule.immobile, true)
  assert.equal(shaModule.behavior.hunterMove(state, enemy), true)
})

test('04339 破碎的时代：意志检定失败时除联结点外每处地点各得 1 线索', () => {
  const state = baseState(shaModule)
  state.locations = [
    locationInstance(state, 'nexusOfNKai', '04324'),
    locationInstance(state, 'mu', '04332', { clues: 0 }),
    locationInstance(state, 'atlantis', '04333', { clues: 1 }),
  ]
  state.investigators[0].location = 'mu'
  const api = makeApi(state, { testResults: [{ success: false, value: 1 }] })
  shaModule.behavior.resolveEncounter(state, state.investigators[0], { code: '04339', originalCode: '04339' }, api)
  assert.equal(state.locations.find(location => location.id === 'nexusOfNKai').clues, 0)
  assert.equal(state.locations.find(location => location.id === 'mu').clues, 1)
  assert.equal(state.locations.find(location => location.id === 'atlantis').clues, 2)
})

test('04340 异界之间：显现时作为 3 隐藏值 1 线索的异界地点入场并与联结点相连', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324', { connections: [] })]
  state.investigators[0].location = 'nexusOfNKai'
  const api = makeApi(state)
  const handled = shaModule.behavior.resolveEncounter(state, state.investigators[0], { code: '04340', originalCode: '04340' }, api)
  assert.equal(handled, true)
  assert.equal(state.locations.length, 2)
  const between = state.locations.find(location => location.code === '04340')
  assert.equal(between.shroud, 3)
  assert.equal(between.clues, 1)
  assert.deepEqual(between.connections, ['nexusOfNKai'])
  assert.equal(state.investigators[0].location, between.id)
  assert.ok(state.locations[0].connections.includes(between.id))
})

test('04341 时空撕裂：破碎地点上的调查员额外检定，失败受到 2 点伤害', () => {
  const state = baseState(shaModule)
  state.locations = [
    locationInstance(state, 'mu', '04332', { traits: ['Shattered', 'Ancient'] }),
    locationInstance(state, 'aPocketInTime', '04330', { traits: ['Extradimensional'] }),
  ]
  state.investigators[0].location = 'aPocketInTime'
  state.investigators.push(makeInvestigator(1, 'mu'))
  state.numInvestigators = 2
  const api = makeApi(state, { testResults: [{ success: false, value: 0 }, { success: false, value: 0 }] })
  shaModule.behavior.resolveEncounter(state, state.investigators[0], { code: '04341', originalCode: '04341' }, api)
  assert.equal(api.calls.test.length, 2)
  assert.deepEqual(api.calls.damage.map(entry => entry[1]), [2, 2])
})

test('04343 时光涌流：探索中结算诡计后把它洗回探索牌库而不是弃掉', () => {
  const state = baseState(shaModule)
  state.relicOfAges = { code: '04343', location: 'nexusOfNKai', seat: null }
  state.locations = [locationInstance(state, 'nexusOfNKai', '04324')]
  state.investigators[0].location = 'nexusOfNKai'
  state.encounterDiscard = ['04339']
  state.explorationDeck = []
  state.scenarioFlags = {}
  const api = makeApi(state)
  shaModule.behavior.afterExplore(state, state.investigators[0], { kind: 'treachery', code: '04339', runtime: api })
  assert.equal(state.encounterDiscard.length, 0)
  assert.deepEqual(state.explorationDeck, ['04339'])
})

test('04345 再次进入遗迹：翻面把时间石室洗入探索牌库，本幕进胜利区并获得复仇 2', () => {
  const state = baseState(shaModule)
  state.scenarioZones = { setAsideLocations: ['chamberOfTime'] }
  state.explorationDeck = []
  state.victoryDisplay = []
  state.scenarioFlags = {}
  const act = { id: 'act1', code: '04345', originalCode: '04345' }
  const api = makeApi(state)
  tbtModule.behavior.actReveal(state, act, api)
  assert.ok(state.explorationDeck.includes('chamberOfTime'))
  assert.equal(state.scenarioFlags.chamberOfTimeInDeck, true)
  assert.equal(state.scenarioZones.setAsideLocations.length, 0)
  assert.equal(state.victoryDisplay[0].code, '04345')
  assert.equal(state.victoryDisplay[0].vengeance, 2)
})

test('04346 留存的石室：时间石室调查员取得重拾往昔，伊格在石室生成', () => {
  const state = baseState(shaModule)
  state.locations = [locationInstance(state, 'chamberOfTime', '04068')]
  state.investigators[0].location = 'chamberOfTime'
  state.scenarioZones = { setAside: ['04303', '04296'] }
  state.acts[2] = clone(state.scenario.acts[2])
  state.actIndex = 1
  const act = { id: 'act2', code: '04346', originalCode: '04346' }
  const api = makeApi(state)
  tbtModule.behavior.actReveal(state, act, api)
  assert.equal(state.relicOfAges.code, '04303')
  assert.equal(state.relicOfAges.seat, 0)
  assert.deepEqual(api.calls.spawn.at(-1), { code: '04296', location: 'chamberOfTime' })
  assert.ok(!state.scenarioZones.setAside.includes('04296'))
  assert.equal(state.victoryDisplay[0].code, '04346')
})

test('04347 毁灭之时：翻面进入结局 1；第三幕提供古代遗物打击伊格的场景行动', () => {
  const state = baseState(shaModule)
  state.actIndex = 2
  state.acts[2] = { id: 'act3', code: '04347', originalCode: '04347' }
  const api = makeApi(state)
  tbtModule.behavior.actReveal(state, state.acts[2], api)
  assert.deepEqual(api.calls.finish, ['r1'])

  state.investigators[0].assets.push({ id: 'relic', code: '04303', originalCode: '04303' })
  state.enemies = [{ id: 'yig', code: '04296', originalCode: '04296', location: state.investigators[0].location, doom: 0 }]
  const moves = tbtModule.behavior.actions(state, state.investigators[0])
  const strike = moves.find(move => move.rule === 'relicOfAgesStrike')
  assert.ok(strike)
  assert.equal(strike.reason, null)
})

// ---------------------------------------------------------------------------
// tbb：界限彼端（31 张）
// ---------------------------------------------------------------------------

test('04164 时间坍塌：翻面进入结局 2（被困在时间的另一边）', () => {
  const state = baseState(tbbModule)
  const api = makeApi(state)
  entry04164.agendaRule.onReveal(state, { id: 'agenda3', code: '04164' }, api)
  assert.deepEqual(api.calls.finish, ['r2'])
})

test('04166 过去与现在：背面换图并通过 hooks 放进胜利区；6 处无线索特诺奇蒂特兰地点推进幕', () => {
  const calls = []
  const hooks = {
    sweep: options => calls.push(['sweep', options]),
    shiftPresentDay: source => calls.push(['shiftPresentDay', source]),
    loseAllClues: () => calls.push(['loseAllClues']),
    spawnPadma: () => calls.push(['spawnPadma']),
    enterFinalStage: options => calls.push(['enterFinalStage', options]),
  }
  entry04166.actRule.onReveal({ scenarioZones: {} }, { id: 'act2', code: '04166' }, {}, hooks)
  assert.deepEqual(calls.map(entry => entry[0]), ['sweep', 'shiftPresentDay', 'loseAllClues', 'spawnPadma', 'enterFinalStage'])
  assert.deepEqual(calls[0][1], { onlyCleared: false })
  assert.equal(calls[1][1], '04166')
  assert.deepEqual(calls[4][1], { advanceAct: true })

  const state = baseState(tbbModule)
  state.actIndex = 1
  state.acts[1] = { id: 'act2', code: '04166', originalCode: '04166' }
  state.locations = Array.from({ length: 6 }, (_, index) =>
    locationInstance(state, `ancient-${index}`, '04176', { clues: 0 }))
  const api = makeApi(state)
  tbbModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)
})

test('04167 归家之旅：目标数据限定在大神庙共同付线索；帕德玛被击败即推进', () => {
  const state = baseState(tbbModule)
  const act = state.scenario.acts[2]
  assert.equal(act.originalCode, '04167')
  assert.deepEqual(act.objective, { type: 'clues', perInvestigator: 2, atLocation: 'templeRuins' })
  state.actIndex = 2
  state.acts[2] = clone(act)
  state.scenarioFlags = { padmaSpawned: true }
  state.enemies = []
  const api = makeApi(state)
  tbbModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)
})

test('04168 神庙废墟：两点行动的探索按地点符号替换格位', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'templeRuins', '04168', { symbols: clone(state.scenario.locations.templeRuins.symbols) })]
  state.investigators[0].location = 'templeRuins'
  state.explorationDeck = ['templesOfTenochtitlan176']
  const moves = tbbModule.behavior.actions(state, state.investigators[0])
  const explore = moves.find(move => move.rule === 'exploreHere')
  assert.ok(explore)
  assert.equal(explore.actions, 2)
  assert.equal(explore.reason, null)
})

test('04169 大都会教堂：受 1 恐惧抽 2 张；6 张以上手牌才开放探索', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'metropolitanCathedral', '04169')]
  state.investigators[0].location = 'metropolitanCathedral'
  state.explorationDeck = ['templesOfTenochtitlan176']
  const moves = []
  entry04169.locationRule.actions({ state, inv: state.investigators[0], location: state.locations[0], moves })
  const api = makeApi(state)
  assert.equal(moves[0].rule, 'studyCathedral')
  assert.equal(entry04169.locationRule.performAction(state, state.investigators[0], moves[0], api), true)
  assert.deepEqual(api.calls.horror, [[0, 1]])
  assert.deepEqual(api.calls.drawCards, [[0, 2]])

  state.investigators[0].hand = Array(5).fill('01001')
  assert.match(tbbModule.behavior.actions(state, state.investigators[0]).find(move => move.rule === 'exploreHere').reason, /6 张手牌/)
  state.investigators[0].hand = Array(6).fill('01001')
  assert.equal(tbbModule.behavior.actions(state, state.investigators[0]).find(move => move.rule === 'exploreHere').reason, null)
})

test('04170 查普尔特佩克公园：在此地意志检定失败后受到 1 点恐惧', () => {
  const state = baseState(tbbModule)
  const park = locationInstance(state, 'chapultepecPark', '04170')
  state.locations = [park]
  state.investigators[0].location = 'chapultepecPark'
  const api = makeApi(state)
  entry04170.locationRule.onTestFail(state, park, api, state.investigators[0], { success: false, skill: 'willpower' })
  assert.deepEqual(api.calls.horror, [[0, 1]])
  entry04170.locationRule.onTestFail(state, park, api, state.investigators[0], { success: false, skill: 'intellect' })
  entry04170.locationRule.onTestFail(state, park, api, state.investigators[0], { success: true, skill: 'willpower' })
  assert.equal(api.calls.horror.length, 1)
})

test('04172 霍奇米尔科：不能获得资源，探索需花费 3 资源', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'xochimilco', '04172')]
  state.investigators[0].location = 'xochimilco'
  assert.equal(tbbModule.behavior.canGainResources(state, state.investigators[0]), false)
  state.investigators[0].location = 'somewhereElse'
  assert.equal(tbbModule.behavior.canGainResources(state, state.investigators[0]), true)

  state.investigators[0].location = 'xochimilco'
  state.explorationDeck = ['01166']
  state.investigators[0].resources = 2
  assert.match(tbbModule.behavior.actions(state, state.investigators[0]).find(move => move.rule === 'exploreHere').reason, /3 资源/)
})

test('04173 科约阿坎区：探索前选择受到 1 点伤害或 1 点恐惧', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'coyoacan', '04173')]
  state.investigators[0].location = 'coyoacan'
  state.explorationDeck = ['01166']
  const api = makeApi(state, { choices: ['horror'] })
  tbbModule.behavior.performAction(state, state.investigators[0], { rule: 'exploreHere', actions: 1 }, api)
  assert.deepEqual(api.calls.horror, [[0, 1]])
  assert.deepEqual(api.calls.drawEncounter, [0])
})

// 探索一张古代地点：真实走 behavior.performAction → exploreFrom → shiftSlot 的入场读点。
function exploreAncient(slotId, ancientId, options = {}) {
  const state = baseState(tbbModule)
  const slotDefinition = state.scenario.locations[slotId]
  state.locations = [{
    ...clone(slotDefinition), id: slotId, revealed: true,
    clues: 0, doom: 0, connections: [], attachments: [], underneath: [],
  }]
  state.investigators[0].location = slotId
  state.investigators[0].hand = options.hand ?? []
  state.explorationDeck = [ancientId]
  state.scenarioFlags = {}
  const api = makeApi(state, { choices: options.choices ?? [] })
  tbbModule.behavior.performAction(state, state.investigators[0], { rule: 'exploreHere', actions: 1 }, api)
  return { state, api, location: state.locations.find(location => location.id === slotId) }
}

test('04176 特诺奇蒂特兰神庙（直接伤害）：入场时此地的每位调查员受到 1 点直接伤害，低血量时隐藏值 -2', () => {
  const { state, api } = exploreAncient('metropolitanCathedral', 'templesOfTenochtitlan176', { hand: Array(6).fill('01001') })
  assert.deepEqual(api.calls.directDamage, [[0, 1]])
  const location = state.locations.find(entry => entry.id === 'metropolitanCathedral')
  assert.equal(location.originalCode, '04176')
  state.investigators[0].damage = 5
  assert.equal(entry04176.locationRule.shroudModifier(state, location, state.investigators[0]), -2)
  state.investigators[0].damage = 1
  assert.equal(entry04176.locationRule.shroudModifier(state, location, state.investigators[0]), 0)
})

test('04180 特诺奇蒂特兰运河：此地的敌人 +2 躲避，有横置敌人时隐藏值 -3', () => {
  const state = baseState(tbbModule)
  const canals = locationInstance(state, 'canalsOfTenochtitlan180', '04180')
  state.locations = [canals]
  const enemy = { id: 'e1', code: '04187', originalCode: '04187', location: 'canalsOfTenochtitlan180', exhausted: true }
  state.enemies = [enemy]
  assert.equal(tbbModule.behavior.enemyStatModifier(state, enemy, 'evade'), 2)
  assert.equal(entry04180.locationRule.shroudModifier(state, canals), -3)
  enemy.exhausted = false
  assert.equal(entry04180.locationRule.shroudModifier(state, canals), 0)
})

test('04183 霍奇米尔科湖（直接恐惧）：入场直接恐惧 1，低神智时隐藏值 -2', () => {
  const { state, api } = exploreAncient('xochimilco', 'lakeXochimilco183')
  assert.deepEqual(api.calls.directHorror, [[0, 1]])
  const location = state.locations.find(entry => entry.id === 'xochimilco')
  state.investigators[0].horror = 5
  assert.equal(entry04183.locationRule.shroudModifier(state, location, state.investigators[0]), -2)
  state.investigators[0].horror = 1
  assert.equal(entry04183.locationRule.shroudModifier(state, location, state.investigators[0]), 0)
})

test('04185 圣林：在此地打出卡牌费用 +2，调查时每张支援令隐藏值 -1', () => {
  const { state } = exploreAncient('coyoacan', 'sacredWoods185', { choices: ['damage'] })
  const location = state.locations.find(entry => entry.id === 'coyoacan')
  assert.equal(location.originalCode, '04185')
  assert.equal(location.playCostIncrease, 2)
  state.investigators[0].assets = [{ id: 'a1', code: '01020', originalCode: '01020' }, { id: 'a2', code: '01021', originalCode: '01021' }]
  assert.equal(entry04185.locationRule.shroudModifier(state, location, state.investigators[0]), -2)
})

test('04187 特诺奇蒂特兰恶蛇：古代地点有线索时获得反击与警戒，否则获得猎手', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'ancient', '04174', { clues: 1 })]
  const enemy = { id: 'e1', code: '04187', originalCode: '04187', location: 'ancient', exhausted: false }
  state.enemies = [enemy]
  const api = makeApi(state)
  tbbModule.behavior.enemySpawned(state, enemy, api)
  assert.equal(enemy.retaliate, true)
  assert.equal(enemy.alert, true)
  assert.equal(enemy.hunter, false)
  state.locations[0].clues = 0
  tbbModule.behavior.enemyMoved(state, enemy, 'somewhere')
  assert.equal(enemy.retaliate, false)
  assert.equal(enemy.alert, false)
  assert.equal(enemy.hunter, true)
})

test('04188 兄弟会之手：生成在任意无人地点；重整时封锁所在地与连接地点的行动', () => {
  const state = baseState(tbbModule)
  state.locations = [
    locationInstance(state, 'zocalo', '04171', { connections: ['xochimilco'] }),
    locationInstance(state, 'xochimilco', '04172'),
  ]
  state.locations[0].connections = ['xochimilco']
  state.locations[1].connections = ['zocalo']
  state.investigators[0].location = 'xochimilco'
  state.enemies = [{ id: 'hand', code: '04188', originalCode: '04188', location: 'zocalo', exhausted: false }]
  const api = makeApi(state, { choices: ['zocalo'] })
  assert.equal(tbbModule.behavior.spawnLocation(state, '04188', null, 0, api), 'zocalo')
  assert.deepEqual(tbbModule.behavior.actions(state, state.investigators[0]), [])
  state.enemies[0].exhausted = true
  assert.ok(tbbModule.behavior.actions(state, state.investigators[0]).length > 0)
})

test('04189 异时空之窗：险境二选一——把古代地点洗回探索牌库，或在当前密谋放 1 毁灭', () => {
  const state = baseState(tbbModule)
  state.locations = [locationInstance(state, 'templeRuins', '04174', { clues: 0, underneath: [{ id: 'templeRuins', code: '04168' }] })]
  state.investigators[0].location = 'templeRuins'
  const api = makeApi(state, { choices: ['doom'] })
  tbbModule.behavior.resolveEncounter(state, state.investigators[0], { code: '04189', originalCode: '04189' }, api)
  assert.deepEqual(api.calls.addDoom, [1])
  const request = api.calls.choose[0]
  assert.equal(request.peril, true)
  assert.equal(request.options.length, 2)
})

test('04190 时间线失稳：难度按古代地点数增加；失败受到 1 伤害 1 恐惧并洗回探索牌库', () => {
  const state = baseState(tbbModule)
  state.locations = [
    locationInstance(state, 'a1', '04174'),
    locationInstance(state, 'a2', '04176'),
  ]
  state.investigators[0].location = 'a1'
  state.explorationDeck = []
  const api = makeApi(state, { testResults: [{ success: false, value: 0 }] })
  const handled = tbbModule.behavior.resolveEncounter(state, state.investigators[0], { code: '04190', originalCode: '04190' }, api)
  assert.equal(handled, true)
  assert.deepEqual(api.calls.test[0], { seat: 0, skill: 'willpower', difficulty: 3, extra: undefined })
  assert.deepEqual(api.calls.damage, [[0, 1]])
  assert.deepEqual(api.calls.horror, [[0, 1]])
  assert.ok(state.explorationDeck.includes('04190'))
})

// ---------------------------------------------------------------------------
// tcoa：天机之城（28 张）
// ---------------------------------------------------------------------------

test('04238 伟大种族之城：序幕 1 期间不能把道具支援放入场或打出', () => {
  const state = baseState(tcoaModule)
  const inv = state.investigators[0]
  const assets = Object.values(ALL_CARDS).filter(card => card.type === 'asset')
  const item = assets.find(card => (card.traits || []).includes('Item'))
  const nonItem = assets.find(card => !(card.traits || []).includes('Item'))
  assert.ok(item && nonItem)
  assert.equal(tcoaModule.behavior.canPlayCard(state, inv, { code: item.code }), false)
  assert.equal(tcoaModule.behavior.canPlayCard(state, inv, { code: nonItem.code }), true)
  assert.equal(tcoaModule.behavior.canPlaceAsset(state, inv, item.code), false)
  state.agendaIndex = 1
  assert.equal(tcoaModule.behavior.canPlayCard(state, inv, { code: item.code }), true)
})

test('04239 失去的记忆：密谋 2 让每位调查员手牌上限 -2', () => {
  const state = baseState(tcoaModule, { agendaIndex: 1 })
  assert.equal(tcoaModule.behavior.handSizeModifier(state, state.investigators[0]), -2)
})

test('04240 遗忘人类身份：密谋 3 让每位调查员手牌上限 -4', () => {
  const state = baseState(tcoaModule, { agendaIndex: 2 })
  assert.equal(tcoaModule.behavior.handSizeModifier(state, state.investigators[0]), -4)
})

test('04241 探索纳克特：序幕 1 期间每个伊斯观测者获得冷漠', () => {
  const state = baseState(tcoaModule)
  assert.equal(state.scenario.acts[0].originalCode, '04241')
  const observer = { id: 'observer', code: '01177', originalCode: '01177', location: 'interviewRoom1', exhausted: false }
  state.enemies = [observer]
  tcoaModule.behavior.enemySpawned(state, observer, makeApi(state))
  assert.equal(observer.grantedAloof, true)
  assert.equal(observer.aloof, true)
})

test('04242 禁止通行：场景 2b 的六项任务里完成三项即必须推进', () => {
  const state = baseState(tcoaModule)
  state.actIndex = 1
  state.acts[1] = { id: 'act2', code: '04242', originalCode: '04242' }
  state.scenarioFlags = { remembered: { foundTheProcess: true, dissectedAnOrgan: true } }
  const api = makeApi(state)
  tcoaModule.behavior.checkObjectives(state, api)
  assert.equal((api.calls.advanceAct || []).length, 0)
  state.scenarioFlags.remembered.interviewedASubject = true
  tcoaModule.behavior.checkObjectives(state, api)
  assert.equal((api.calls.advanceAct || []).length, 1)
})

test('04243 回归自我：幸存者人手 10 张手牌推进；花 1 线索抽 2（超上限再抽 1）', () => {
  const state = baseState(tcoaModule)
  state.actIndex = 2
  state.acts[2] = { id: 'act3', code: '04243', originalCode: '04243' }
  state.investigators[0].hand = Array(10).fill('01001')
  const api = makeApi(state)
  tcoaModule.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1)

  const inv = state.investigators[0]
  inv.hand = Array(8).fill('01001')
  inv.clues = 1
  state.actIndex = 2
  const drawApi = makeApi(state, { applyDraws: true })
  const moves = tcoaModule.behavior.actions(state, inv)
  const action = moves.find(move => move.rule === 'repossessionDraw')
  assert.ok(action)
  tcoaModule.behavior.performAction(state, inv, action, drawApi)
  assert.deepEqual(drawApi.calls.spendClues, [[0, 1]])
  assert.deepEqual(drawApi.calls.drawCards, [[0, 2], [0, 1]])
})

test('04246 拘束室：谈判可选智识或战斗(4)，成功记住「进行了一次会谈」', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'interviewRoom2', '04246')]
  state.investigators[0].location = 'interviewRoom2'
  const inv = state.investigators[0]
  const moves = tcoaModule.behavior.actions(state, inv)
  const action = moves.find(move => move.rule === 'interrogateSubject')
  assert.ok(action)
  const api = makeApi(state, { choices: ['combat'] })
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.equal(api.calls.test[0].seat, 0)
  assert.equal(api.calls.test[0].skill, 'combat')
  assert.equal(api.calls.test[0].difficulty, 4)
  assert.equal(state.scenarioFlags.remembered.interviewedASubject, true)
})

test('04247 充满脓液的房间：进入后意志(3)检定，按失败差额受到恐惧', () => {
  const state = baseState(tcoaModule)
  const room = locationInstance(state, 'interviewRoom3', '04247')
  state.locations = [room]
  state.investigators[0].location = 'interviewRoom3'
  const api = makeApi(state, { testResults: [{ success: false, value: 1 }] })
  tcoaModule.behavior.locationEntered(state, state.investigators[0], room, api)
  assert.deepEqual(api.calls.horror, [[0, 2]])
})

function hallsState(activeSlot) {
  const state = baseState(tcoaModule)
  const slots = ['hallsNorthern', 'hallsEastern', 'hallsWestern']
  state.locations = slots.map(id => ({
    ...clone(state.scenario.locations[id]), id, revealed: true,
    clues: 1, doom: 0, connections: [], attachments: [],
  }))
  state.investigators[0].location = activeSlot
  state.investigators[0].hand = ['01001']
  return state
}

test('04248 纳克特廊道（北翼）：免费弃 1 张手牌移动到另一处廊道（每回合一次）', () => {
  const state = hallsState('hallsNorthern')
  assert.equal(state.scenario.locations.hallsNorthern.originalCode, '04248')
  const inv = state.investigators[0]
  const moves = tcoaModule.behavior.actions(state, inv)
  const action = moves.find(move => move.rule === 'hallsShortcut')
  assert.ok(action)
  assert.equal(action.actions, 0)
  const api = makeApi(state, { choices: ['hallsEastern'] })
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.equal(inv.location, 'hallsEastern')
  assert.deepEqual(api.calls.discardChosen, [[0, 1, '04248']])
  assert.equal(inv.tfaHallsShortcutRound, state.round)
})

test('04249 纳克特廊道（东侧）：同一份行动实现，可从东翼移到北翼', () => {
  const state = hallsState('hallsEastern')
  assert.equal(state.scenario.locations.hallsEastern.originalCode, '04249')
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'hallsShortcut')
  assert.ok(action)
  const api = makeApi(state, { choices: ['hallsNorthern'] })
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.equal(inv.location, 'hallsNorthern')
  assert.deepEqual(api.calls.discardChosen, [[0, 1, '04248']])
})

test('04250 纳克特廊道（西翼）：同一份行动实现，可从西翼移到东翼', () => {
  const state = hallsState('hallsWestern')
  assert.equal(state.scenario.locations.hallsWestern.originalCode, '04250')
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'hallsShortcut')
  assert.ok(action)
  const api = makeApi(state, { choices: ['hallsEastern'] })
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.equal(inv.location, 'hallsEastern')
  assert.deepEqual(api.calls.discardChosen, [[0, 1, '04248']])
})

test('04251 大图书馆：共同支付每人 1 线索破译归位程式；轮末补足到 4 线索', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'greatLibrary', '04251', { clues: 2 })]
  state.investigators[0].location = 'greatLibrary'
  state.investigators[0].clues = 1
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'decipherProcess')
  assert.equal(action.reason, null)
  const api = makeApi(state)
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.deepEqual(api.calls.payClues, [[1, 'greatLibrary']])
  assert.equal(state.scenarioFlags.remembered.foundTheProcess, true)

  state.locations[0].clues = 1
  tcoaModule.behavior.roundEnded(state, api)
  assert.equal(state.locations[0].clues, 4)
})

test('04252 伊斯的太阳系仪：两行动记住现在年份；身处此地手牌上限 +2', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'yithianOrrery', '04252', { clues: 0 })]
  state.investigators[0].location = 'yithianOrrery'
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'realizeTheYear')
  assert.ok(action)
  assert.equal(action.actions, 2)
  assert.equal(action.reason, null)
  tcoaModule.behavior.performAction(state, inv, action, makeApi(state))
  assert.equal(state.scenarioFlags.remembered.realizedWhatYearItIs, true)
  assert.equal(tcoaModule.behavior.handSizeModifier(state, inv), 2)
})

test('04253 伟大种族的实验室：无线索时检定敏捷(3)，失败给地点加 1 线索、成功记住启动设备', () => {
  const state = baseState(tcoaModule)
  const lab = locationInstance(state, 'laboratory', '04253', { clues: 0 })
  state.locations = [lab]
  state.investigators[0].location = 'laboratory'
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'activateDevice')
  assert.ok(action)
  tcoaModule.behavior.performAction(state, inv, action, makeApi(state, { testResults: [{ success: false, value: 0 }] }))
  assert.equal(state.locations[0].clues, 1)
  state.locations[0].clues = 0
  tcoaModule.behavior.performAction(state, inv, action, makeApi(state))
  assert.equal(state.scenarioFlags.remembered.activatedTheDevice, true)
})

test('04254 解构室：战斗难度随线索数提高；成功记住解剖器官', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'deconstructionRoom', '04254', { clues: 1 })]
  state.investigators[0].location = 'deconstructionRoom'
  const inv = state.investigators[0]
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'dissectOrgan')
  assert.match(action.label, /战斗\(5\)/)
  const api = makeApi(state)
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.equal(api.calls.test[0].seat, 0)
  assert.equal(api.calls.test[0].skill, 'combat')
  assert.equal(api.calls.test[0].difficulty, 5)
  assert.equal(state.scenarioFlags.remembered.dissectedAnOrgan, true)
})

test('04255 纳克特之塔：弃 N 张手牌，把弃牌堆洗回牌库并抽 N+1 张（每回合一次）', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'towersOfPnakotus', '04255', { clues: 2 })]
  state.investigators[0].location = 'towersOfPnakotus'
  const inv = state.investigators[0]
  inv.hand = ['01001', '01002', '01003']
  inv.discard = ['01004']
  inv.deck = ['01005']
  const action = tcoaModule.behavior.actions(state, inv).find(move => move.rule === 'towersOfPnakotus')
  assert.ok(action)
  const api = makeApi(state, { choices: ['2'] })
  tcoaModule.behavior.performAction(state, inv, action, api)
  assert.deepEqual(api.calls.discardChosen, [[0, 2, '04255']])
  assert.deepEqual(api.calls.drawCards, [[0, 3]])
  assert.deepEqual(inv.discard, [])
  assert.equal(inv.tfaTowersRound, state.round)
})

test('04261 残酷拷问：进入威胁区并禁止抽牌；已会谈时受到 1 恐惧并获得涌动', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'interviewRoom1', '04245')]
  state.investigators[0].location = 'interviewRoom1'
  const inv = state.investigators[0]
  const api = makeApi(state)
  assert.equal(tcoaModule.behavior.resolveEncounter(state, inv, { code: '04261', originalCode: '04261' }, api), true)
  assert.deepEqual(api.calls.threat, [[0, '04261']])
  assert.equal(inv.threat[0].code, '04261')
  assert.equal(entry04261.treacheryRule.threat.noDrawAction, true)

  state.scenarioFlags = { remembered: { interviewedASubject: true } }
  const surged = makeApi(state)
  tcoaModule.behavior.resolveEncounter(state, inv, { code: '04261', originalCode: '04261' }, surged)
  assert.deepEqual(surged.calls.horror, [[0, 1]])
  assert.deepEqual(surged.calls.drawEncounter, [0])
  assert.equal(surged.calls.threat.length, 1)
})

test('04262 失去人性：意志(5)失败按差额移除牌库顶，总牌数不足 10 时发疯', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'interviewRoom1', '04245')]
  state.investigators[0].location = 'interviewRoom1'
  const inv = state.investigators[0]
  inv.hand = Array(8).fill('01001')
  inv.deck = ['03001', '03002', '03003']
  inv.discard = ['03004', '03005']
  const api = makeApi(state, { testResults: [{ success: false, value: 3 }] })
  tcoaModule.behavior.resolveEncounter(state, inv, { code: '04262', originalCode: '04262' }, api)
  assert.equal(state.removedFromGame.length, 2)
  assert.equal(inv.defeated, undefined)

  inv.hand = ['01001']
  inv.deck = ['03001']
  inv.discard = []
  const defeatedApi = makeApi(state, { testResults: [{ success: false, value: 0 }] })
  tcoaModule.behavior.resolveEncounter(state, inv, { code: '04262', originalCode: '04262' }, defeatedApi)
  assert.equal(inv.defeated, true)
  assert.deepEqual(defeatedApi.calls.defeat, [[0, 'madness']])
})

test('04263 囚禁意识：意志(0)检定后无论成败把手牌弃到修正后技能值', () => {
  const state = baseState(tcoaModule)
  state.locations = [locationInstance(state, 'interviewRoom1', '04245')]
  state.investigators[0].location = 'interviewRoom1'
  const inv = state.investigators[0]
  inv.hand = Array(5).fill('01001')
  const api = makeApi(state, { testResults: [{ success: false, value: 3 }] })
  tcoaModule.behavior.resolveEncounter(state, inv, { code: '04263', originalCode: '04263' }, api)
  assert.deepEqual(api.calls.discardChosen, [[0, 2, '04263']])
})
