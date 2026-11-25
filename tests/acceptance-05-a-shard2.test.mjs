// 05-a 万象无终 · 分片 2（TCU 核心段 05055b–05108）独立验收证据。
//
// 为「既有章节测试未在用例标题中出现卡号」的 24 张卡补逐卡真实断言：
//   05055b 05056 05057 05058 05059 05060 05061 05063 05064 05065
//   05066 05067 05068 05069 05070 05071 05073 05074 05075 05076 05077 05079 05082 05085
// 断言对象是当前 HEAD 的单卡条目 / 章节 behavior / 章节 chaos 的真实读点，
// 不是「条目存在」这类空断言。测试只写本地 state 与确定性 api，不触碰共享写者文件。
import test from 'node:test'
import assert from 'node:assert/strict'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  scenario as whDefinition, WOODS, WITCHES_CIRCLE, ANETTE_MASON,
} from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/definition.js'
import { behavior as whBehavior } from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/behavior.js'
import {
  scenario as ddDefinition, SPECTRAL_HAUNTED, SPECTRAL_LOCATION_CODES, JOSEF,
} from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/definition.js'
import { behavior as ddBehavior } from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/behavior.js'
import { resolveChaosToken as ddChaosToken } from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/chaos.js'

import e05055b from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05055b.js'
import e05056 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05056.js'
import e05057 from '../src/cards/encounter-entries/theCircleUndone/_shared/the_witching_hour/05057.js'
import e05058 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05058.js'
import e05059 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05059.js'
import e05060 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05060.js'
import e05061 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05061.js'
import e05063 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05063.js'

const clone = value => structuredClone(value)
const loc = (state, id) => state.locations.find(location => location.id === id)
const byCode = (state, code) => state.locations.find(location => (location.originalCode || location.code) === code)
const woodId = code => WOODS.find(entry => entry.code === code)?.id

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
function invFor(seat, location, overrides = {}) {
  return {
    seat, code: '01001', name: `调查员${seat + 1}`, location,
    damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
    deck: [], discard: [], actionsLeft: 3, ...overrides,
  }
}

function baseState(definition, count, startLocation) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => invFor(seat, startLocation)),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({
        deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: [], difficulty: 'standard', numInvestigators: count,
    round: 1, phase: 'investigation', currentSeat: 0, status: 'playing',
  }
}

function placeWh(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(inv => inv.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
  return state
}

function whState(count = 2, startLocation = woodId('05058')) {
  const state = baseState(whDefinition, count, startLocation)
  state.chaosBag = ['+1', '0', '-1']
  // 5 张森林入场（等价 setup 的 frontOf 结果），其余地点表不必入场。
  for (const entry of WOODS.slice(0, 5)) {
    state.scenarioFlags.frontOf = { ...(state.scenarioFlags.frontOf || {}), [entry.id]: 0 }
  }
  placeWh(state, WOODS.map(entry => entry.id))
  return state
}

function ddState(count = 2) {
  const state = baseState(ddDefinition, count, 'entryHall')
  state.chaosBag = ['+1', '0', '-1', 'skull', 'tablet', 'elderthing']
  for (const id of Object.keys(ddDefinition.locations)) {
    const base = ddDefinition.locations[id]
    state.locations.push({
      ...clone(base), id, revealed: true, doom: 0, clues: 0,
      maxClues: (base.cluesPerInvestigator || 0) * count,
    })
  }
  return state
}

function woodAt(state, code) {
  const id = woodId(code)
  const location = loc(state, id)
  assert.ok(location, `缺少森林地点 ${id}`)
  return location
}

// 记录型 api：未显式实现的方法返回安全默认；`record` 收集调用。
function makeApi(state, overrides = {}) {
  const calls = []
  const record = (name, fn = () => undefined) => (...args) => {
    calls.push({ name, args })
    return fn(...args)
  }
  const api = {
    calls,
    info: record('info'),
    choose: request => overrides.choose ? overrides.choose(request) : request.options?.[0]?.id,
    random: () => 0.5,
    damage: record('damage', (seat, amount) => { state.investigators[seat].damage += amount }),
    horror: record('horror', (seat, amount) => { state.investigators[seat].horror += amount }),
    directDamage: record('directDamage', (seat, amount) => { state.investigators[seat].damage += amount }),
    damageEnemy: record('damageEnemy'),
    damageAsset: record('damageAsset'),
    spawn: record('spawn', (code, location) => {
      const enemy = {
        id: `enemy-${(state.enemies?.length || 0) + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, traits: [],
      }
      ;(state.enemies ||= []).push(enemy)
      return enemy
    }),
    spawnEngaged: record('spawnEngaged', (code, location, seat) => {
      const enemy = {
        id: `enemy-${(state.enemies?.length || 0) + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: seat ?? null, damageTaken: 0, exhausted: false, traits: [],
      }
      ;(state.enemies ||= []).push(enemy)
      return enemy
    }),
    moveEnemy: record('moveEnemy', (enemy, destination) => { enemy.location = destination }),
    moveInvestigator: record('moveInvestigator', (seat, destination) => { state.investigators[seat].location = destination }),
    reveal: record('reveal', id => { const l = loc(state, id); if (l) l.revealed = true }),
    place: record('place', () => null),
    advanceAct: record('advanceAct', () => { state.actIndex = (state.actIndex || 0) + 1 }),
    advanceAgenda: record('advanceAgenda'),
    finish: record('finish'),
    resign: record('resign'),
    defeat: record('defeat'),
    trauma: record('trauma'),
    attack: record('attack'),
    readyEnemy: record('readyEnemy', enemy => { enemy.exhausted = false }),
    exhaustEnemy: record('exhaustEnemy', enemy => { enemy.exhausted = true }),
    healEnemy: record('healEnemy', (enemy, amount = 1) => {
      const before = enemy.damageTaken || 0
      enemy.damageTaken = Math.max(0, before - amount)
      return before - enemy.damageTaken
    }),
    doomOn: record('doomOn', (card, amount = 1) => { card.doom = (card.doom || 0) + amount }),
    addDoom: record('addDoom'),
    addCluesToLocation: record('addCluesToLocation', (id, amount) => { const l = loc(state, id); if (l) l.clues = (l.clues || 0) + amount }),
    gainClues: record('gainClues', (seat, amount) => { state.investigators[seat].clues += amount }),
    loseClues: record('loseClues', (seat, amount) => { state.investigators[seat].clues -= amount }),
    spendClues: record('spendClues', (seat, amount) => { state.investigators[seat].clues -= amount }),
    payClues: record('payClues'),
    loseResources: record('loseResources', (seat, amount) => { state.investigators[seat].resources -= amount }),
    gainResources: record('gainResources', (seat, amount) => { state.investigators[seat].resources += amount }),
    drawCards: record('drawCards', (seat, amount) => { state.investigators[seat].hand.push(...Array(amount).fill('01001')) }),
    discardRandom: record('discardRandom', (seat, amount) => { state.investigators[seat].hand.splice(0, amount) }),
    discardChosen: record('discardChosen', (seat, amount) => { state.investigators[seat].hand.splice(0, amount) }),
    discardAsset: record('discardAsset'),
    setScenarioFlag: record('setScenarioFlag', (key, value = true) => { state.scenarioFlags[key] = value }),
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setEnemyPreySeat: record('setEnemyPreySeat', (enemy, seat) => { enemy.preySeat = seat }),
    preyTarget: record('preyTarget', () => null),
    hunterStep: record('hunterStep', () => null),
    stepToward: record('stepToward', (from, to) => overrides.stepToward ? overrides.stepToward(from, to) : to),
    discardEncounterTop: record('discardEncounterTop', (count = 1) => {
      const discarded = []
      for (let index = 0; index < count; index += 1) {
        if (!state.encounterDeck.length) break
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    }),
    encounterDiscardCards: () => [...state.encounterDiscard],
    encounterDeckCards: () => [...state.encounterDeck],
    takeEncounterDiscard: record('takeEncounterDiscard', code => {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index >= 0) { state.encounterDiscard.splice(index, 1); return code }
      return null
    }),
    takeEncounterDeckCard: record('takeEncounterDeckCard', code => {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index >= 0) { state.encounterDeck.splice(index, 1); return code }
      return null
    }),
    discardEncounterCards: record('discardEncounterCards', codes => {
      const list = String(codes).split?.() || []
      for (const code of (Array.isArray(codes) ? codes : [codes])) state.encounterDiscard.push(code)
      return list
    }),
    shuffleEncounterDeck: record('shuffleEncounterDeck'),
    shuffleDiscard: record('shuffleDiscard', () => { state.encounterDiscard = [] }),
    flipSpectral: record('flipSpectral', id => {
      const location = loc(state, id)
      if (!location?.back?.code) return false
      location.originalCode = location.back.code
      location.code = location.back.code
      location.spectralFace = 'spectral'
      location.name = location.back.name || location.name
      return true
    }),
    giveAsset: record('giveAsset'),
    takeFromSetAside: record('takeFromSetAside', code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      return true
    }),
    takeDiscardCard: record('takeDiscardCard', () => true),
    putInHand: record('putInHand'),
    flipEnemy: record('flipEnemy', (enemy, code) => { enemy.code = code; enemy.originalCode = code }),
    test: (seat, skill, difficulty, resolve) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty] })
      const result = overrides.testResult ? overrides.testResult({ seat, skill, difficulty }) : { success: true, value: difficulty + 1, difficulty, skill }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    locName: id => loc(state, id)?.name || id,
    ...overrides.custom,
  }
  return api
}

// ---------------------------------------------------------------------------
// theWitchingHour（05055b–05064）
// ---------------------------------------------------------------------------
test('05055b 女巫圆环：揭示时把放在一边的安妮特·梅森生成在圆环', () => {
  const state = whState(2)
  state.scenarioZones.setAside = [ANETTE_MASON, '01150']
  const location = { id: 'witchesCircle', code: WITCHES_CIRCLE, originalCode: WITCHES_CIRCLE, name: '女巫圆环' }
  state.locations.push(location)
  const api = makeApi(state)
  assert.equal(e05055b.locationRule.onReveal(state, location, api), true)
  const spawned = api.calls.find(call => call.name === 'spawn')
  assert.deepEqual(spawned.args, [ANETTE_MASON, 'witchesCircle'])
  assert.equal(state.scenarioZones.setAside.includes(ANETTE_MASON), false)
})

test('05056 未毁之环：结局分支由剧本结果决定，圆环无线索/安妮特被击败推进幕', () => {
  const state = whState(2)
  state.victoryDisplay = [{ id: 'enemy:1', code: ANETTE_MASON, originalCode: ANETTE_MASON }]
  const api = makeApi(state)
  e05056.actRule.onReveal(state, { originalCode: '05056' }, api)
  assert.deepEqual(api.calls.find(call => call.name === 'finish').args, ['resolution1'])
  // 另一分支：打破圆环（无线索）。
  const state2 = whState(2)
  state2.locations = state2.locations.filter(location => location.id !== 'witchesCircle')
  state2.locations.push({ id: 'witchesCircle', code: WITCHES_CIRCLE, originalCode: WITCHES_CIRCLE, clues: 0 })
  const api2 = makeApi(state2)
  e05056.actRule.onReveal(state2, { originalCode: '05056' }, api2)
  assert.deepEqual(api2.calls.find(call => call.name === 'finish').args, ['resolution2'])
  // 幕 4 数据声明 objectiveRule，由 behavior.checkObjectives 读取。
  const act4 = whDefinition.acts[3]
  assert.equal(act4.originalCode, '05056')
  assert.equal(act4.objectiveRule, 'aCircleUnbroken')
  state2.actIndex = 3
  whBehavior.checkObjectives(state2, api2)
  assert.ok(api2.calls.some(call => call.name === 'advanceAct'))
})

test('05057 安妮特·梅森：敌军阶段开始弃遭遇牌顶 3 张，弃出女巫则生成，否则重整', () => {
  const state = whState(2)
  const anette = { id: 'e-anette', code: ANETTE_MASON, originalCode: ANETTE_MASON, location: woodId('05058'), exhausted: true }
  state.enemies.push(anette)
  state.encounterDeck = ['01001', '01002', '05090']
  const api = makeApi(state)
  e05057.enemyScript.onEnemyPhaseStart(state, anette, api)
  const spawned = api.calls.filter(call => call.name === 'spawn')
  assert.deepEqual(spawned.map(call => call.args[0]), ['05090'])
  assert.equal(api.calls.some(call => call.name === 'readyEnemy'), false)

  const state2 = whState(2)
  const anette2 = { id: 'e-anette-2', code: ANETTE_MASON, originalCode: ANETTE_MASON, location: woodId('05058'), exhausted: true }
  state2.enemies.push(anette2)
  state2.encounterDeck = ['01001', '01002', '01003']
  const api2 = makeApi(state2)
  e05057.enemyScript.onEnemyPhaseStart(state2, anette2, api2)
  assert.deepEqual(api2.calls.find(call => call.name === 'readyEnemy').args, [anette2])
  assert.equal(api2.calls.some(call => call.name === 'spawn'), false)
})

test('05058 废弃矿山：3–10 资源不能调查；[free] 与另一处森林调查员互移最多 3 资源（团队每轮一次）', () => {
  const state = whState(2)
  const mine = woodAt(state, '05058')
  const other = woodAt(state, '05059')
  state.investigators[0].location = mine.id
  state.investigators[1].location = other.id
  state.investigators[0].resources = 5
  const rule = e05058.locationRule
  assert.ok(rule.investigationError(state, mine, state.investigators[0]), '5 资源应禁止调查')
  state.investigators[0].resources = 2
  assert.equal(rule.investigationError(state, mine, state.investigators[0]), undefined)
  state.investigators[0].resources = 4
  const moves = []
  rule.actions({ moves, state, inv: state.investigators[0], location: mine })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].rule, 'mineSwapResources')
  assert.equal(moves[0].actions, 0)
  const api = makeApi(state, { choose: request => request.kind === 'investigator' ? '1' : request.kind === 'story' ? 'toThem' : '2' })
  rule.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(state.investigators[0].resources, 2)
  assert.equal(state.investigators[1].resources, 7)
  assert.equal(state.scenarioFlags.mineSwapRound, state.round)
})

test('05059 巨石堆：每次发现线索后本地调查员失去等量资源', () => {
  const state = whState(2)
  const cairn = woodAt(state, '05059')
  state.investigators[0].location = cairn.id
  state.investigators[1].location = cairn.id
  const api = makeApi(state)
  e05059.locationRule.cluesRemoved(state, cairn, 2, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'loseResources').map(call => call.args), [[0, 2], [1, 2]])
})

test('05060 独木：3–5 张手牌不能调查；[free] 交换 1 张手牌（每轮一次）', () => {
  const state = whState(2)
  const tree = woodAt(state, '05060')
  state.investigators[0].location = tree.id
  state.investigators[1].location = woodAt(state, '05059').id
  state.investigators[0].hand = ['01001']
  state.investigators[1].hand = ['01002']
  const rule = e05060.locationRule
  state.investigators[0].hand = ['01001', '01002', '01003', '01004']
  assert.ok(rule.investigationError(state, tree, state.investigators[0]))
  state.investigators[0].hand = ['01001']
  state.investigators[1].hand = ['01002']
  const moves = []
  rule.actions({ moves, state, inv: state.investigators[0], location: tree })
  assert.equal(moves[0].rule, 'lonelyTreeSwap')
  const api = makeApi(state, { choose: request => request.kind === 'investigator' ? '1' : 'youDiscardTheyDraw' })
  rule.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(state.investigators[0].hand.length, 0, '发起者弃 1 张')
  assert.equal(state.investigators[1].hand.length, 2, '对方抽 1 张')
  assert.equal(state.scenarioFlags.lonelyTreeRoundBySeat[0], state.round)
})

test('05061 孩童的树屋：最后一个线索被发现时把遭遇弃牌堆顶敌人（或弃牌直到敌人）生成在此', () => {
  const state = whState(2)
  const house = woodAt(state, '05061')
  state.investigators[0].location = house.id
  state.encounterDiscard = ['01001', '05095']
  const api = makeApi(state)
  e05061.locationRule.cluesRemoved(state, house, 1, api)
  assert.deepEqual(api.calls.find(call => call.name === 'spawn').args, ['05095', house.id])
  // 弃牌堆没有敌人：弃遭遇牌库直到弃出敌人。
  const state2 = whState(2)
  const house2 = woodAt(state2, '05061')
  state2.encounterDeck = ['01001', '05095']
  const api2 = makeApi(state2)
  e05061.locationRule.cluesRemoved(state2, house2, 1, api2)
  assert.deepEqual(api2.calls.find(call => call.name === 'spawn').args, ['05095', house2.id])
})

test('05063 隐士之家：每次发现线索后本地调查员随机弃等量手牌', () => {
  const state = whState(2)
  const house = woodAt(state, '05063')
  state.investigators[0].location = house.id
  state.investigators[0].hand = ['01001', '01002', '01003']
  const api = makeApi(state)
  e05063.locationRule.cluesRemoved(state, house, 2, api)
  assert.deepEqual(api.calls.find(call => call.name === 'discardRandom').args, [0, 2])
})

test('05064 杂草丛生的谷仓：敌人将生成在另一处森林时改为生成在谷仓并立即攻击本地每位调查员', () => {
  const state = whState(2)
  const barn = woodAt(state, '05064')
  const target = woodAt(state, '05058')
  state.investigators[0].location = barn.id
  state.investigators[1].location = barn.id
  const api = makeApi(state, { choose: () => 'trigger' })
  const redirected = whBehavior.spawnLocation(state, '05090', target.id, null, api)
  assert.equal(redirected, barn.id)
  const enemy = { id: 'e-rats', code: '05090', originalCode: '05090', name: '女巫集会学徒', location: barn.id }
  state.enemies.push(enemy)
  whBehavior.enemySpawned(state, enemy, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'attack').map(call => call.args[1].seat), [0, 1])
})

// ---------------------------------------------------------------------------
// atDeathsDoorstep（05065–05085）
// ---------------------------------------------------------------------------
test('05065 死亡门前：混乱标记数值与闹鬼/幽灵敌人后果', () => {
  const state = ddState(2)
  state.investigators[0].location = 'entryHall'
  const location = loc(state, 'entryHall')
  location.haunted = [{ text: '闹鬼 - 失去 1 个行动。', effect: [{ kind: 'loseAction', amount: 1 }] }]
  const apiNormal = makeApi(state, { custom: { hauntedIs: id => Boolean(loc(state, id)?.haunted) } })
  assert.equal(ddChaosToken(state, state.investigators[0], 'skull', apiNormal).delta, -3, '闹鬼地点 skull 简单面 -3')
  assert.equal(ddChaosToken(state, state.investigators[0], 'tablet', apiNormal).delta, -2)
  state.difficulty = 'hard'
  assert.equal(ddChaosToken(state, state.investigators[0], 'skull', apiNormal).delta, -4, '困难面 -4')
  assert.equal(ddChaosToken(state, state.investigators[0], 'tablet', apiNormal).delta, -3)
  // elderthing：所在地点有幽灵敌人 → 受 1 点伤害（困难面再 +1 恐惧）。
  state.difficulty = 'standard'
  state.enemies.push({ id: 'e-watcher', code: '05086', originalCode: '05086', location: 'entryHall', traits: ['Spectral'] })
  const apiElder = makeApi(state)
  assert.equal(ddChaosToken(state, state.investigators[0], 'elderthing', apiElder).delta, -2)
  assert.deepEqual(apiElder.calls.filter(call => call.name === 'damage').map(call => call.args), [[0, 1]])
})

test('05066 正义·XI：银暮秘社敌人不能受伤/被击败；抽到怪物放一边并放毁灭；背面结算线索与约瑟夫', () => {
  const state = ddState(2)
  state.agendaIndex = 0
  const silver = { id: 'e-silver', code: '05095', originalCode: '05095', location: 'entryHall', traits: ['Humanoid', 'Cultist', 'Silver Twilight'] }
  state.enemies.push(silver)
  assert.equal(ddBehavior.enemyDamageAllowed(state, silver), false)
  assert.equal(ddBehavior.enemyCanBeDefeated(state, silver), false)
  // 抽到怪物：encounterDrawn 打标记，spawnLocation 拦截为放一边，spawnFailed 放毁灭。
  ddBehavior.encounterDrawn(state, state.investigators[0], '05088', makeApi(state))
  assert.equal(ddBehavior.spawnLocation(state, '05088', 'entryHall'), '__setAside__')
  const api = makeApi(state)
  state.encounterDiscard.push('05088')
  ddBehavior.spawnFailed(state, '05088', null, api)
  assert.ok(state.scenarioZones.setAside.includes('05088'), '抽到的怪物进入放一边')
  assert.ok(api.calls.some(call => call.name === 'addDoom'))
  // 背面：线索不足 → 失去所有线索并推进幕；线索足够 → 花费并生成约瑟夫。
  const poor = ddState(2)
  poor.agendaIndex = 0
  poor.investigators.forEach(inv => { inv.clues = 1 })
  const poorApi = makeApi(poor)
  ddBehavior.agendaReveal(poor, { originalCode: '05066' }, poorApi)
  assert.equal(poor.investigators.reduce((sum, inv) => sum + inv.clues, 0), 0)
  assert.ok(poorApi.calls.some(call => call.name === 'advanceAct'))
  const rich = ddState(2)
  rich.agendaIndex = 0
  rich.investigators.forEach(inv => { inv.clues = 3 })
  const richApi = makeApi(rich)
  ddBehavior.agendaReveal(rich, { originalCode: '05066' }, richApi)
  const spawnCall = richApi.calls.find(call => call.name === 'spawn')
  assert.equal(spawnCall.args[0], JOSEF, '约瑟夫在最远地点生成')
  assert.notEqual(spawnCall.args[1], 'entryHall')
})

test('05067 横跨界限：银暮秘社敌人胜利 0 进胜利区；猎手移动后幽灵伤害类人；背面按幕结算结局', () => {
  const state = ddState(2)
  state.agendaIndex = 1
  const silver = { id: 'e-silver', code: '05095', originalCode: '05095', location: 'office', traits: ['Humanoid', 'Cultist', 'Silver Twilight'] }
  const spectral = { id: 'e-spectral', code: '05086', originalCode: '05086', location: 'office', traits: ['Ancient One', 'Spectral'], damage: 2, exhausted: false }
  const humanoid = { id: 'e-humanoid', code: '05095', originalCode: '05095', location: 'office', traits: ['Humanoid', 'Cultist', 'Silver Twilight'] }
  state.enemies.push(silver, spectral, humanoid)
  const api = makeApi(state)
  assert.equal(ddBehavior.enemyDefeated(state, silver, api), true)
  state.enemies.splice(state.enemies.indexOf(silver), 1)
  const victory = state.victoryDisplay.find(card => card.id === 'enemy:e-silver')
  assert.ok(victory, '银暮秘社敌人进入胜利区')
  assert.equal(victory.victory, 0)
  // 猎手移动步骤后的强制：重整幽灵敌人对同地点每个类人敌人造成其伤害值。
  ddBehavior.enemyPhaseAfterHunters(state, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'damageEnemy').map(call => call.args[0]), ['e-humanoid'])
  assert.equal(api.calls.find(call => call.name === 'damageEnemy').args[1], 2)
  // 背面：幕 2 → 结局 3；幕 3 → 未撤退者被击败 + 1 点肉体创伤。
  const actTwo = ddState(2)
  actTwo.actIndex = 1
  const apiTwo = makeApi(actTwo)
  ddBehavior.agendaReveal(actTwo, { originalCode: '05067' }, apiTwo)
  assert.deepEqual(apiTwo.calls.find(call => call.name === 'finish').args, ['r3'])
  const actThree = ddState(2)
  actThree.actIndex = 2
  const apiThree = makeApi(actThree)
  ddBehavior.agendaReveal(actThree, { originalCode: '05067' }, apiThree)
  assert.equal(apiThree.calls.filter(call => call.name === 'defeat').length, 2)
  assert.equal(apiThree.calls.filter(call => call.name === 'trauma').length, 2)
})

test('05068 秘密阴谋：背面把 7 个地点换成幽灵面、生成看守人并把两组剩余卡洗回', () => {
  const state = ddState(2)
  ddBehavior.setupLocations(state)
  for (const id of Object.keys(ddDefinition.locations)) {
    const base = ddDefinition.locations[id]
    state.locations.push({ ...clone(base), id, revealed: true, clues: 0, doom: 0, maxClues: 0 })
  }
  state.investigators[0].location = 'entryHall'
  state.investigators[1].location = 'office'
  state.scenarioZones.setAside = ['05086', '05087', '05087', '05105', '05105', '05106', '05106']
  const api = makeApi(state)
  ddBehavior.actReveal(state, { originalCode: '05068' }, api)
  for (const id of Object.keys(SPECTRAL_LOCATION_CODES)) {
    assert.equal(loc(state, id).originalCode, SPECTRAL_LOCATION_CODES[id], `${id} 应换成幽灵面`)
  }
  assert.deepEqual(api.calls.find(call => call.name === 'spawn').args, ['05086', 'entryHall'])
  assert.deepEqual(api.calls.filter(call => call.name === 'moveInvestigator').map(call => call.args), [[0, 'victorianHalls']])
  for (const code of ['05087', '05105', '05106']) {
    assert.ok(state.encounterDeck.filter(entry => entry === code).length >= 1, `${code} 应洗回遭遇牌库`)
  }
  assert.ok(api.calls.some(call => call.name === 'shuffleDiscard'))
})

test('05069 幽灵国度：背面揭示入口大厅、解除迷雾封锁并把弃牌堆洗回', () => {
  const state = ddState(2)
  state.actIndex = 1
  state.scenarioFlags.entryHallSealed = true
  const entry = loc(state, 'entryHall')
  entry.revealed = false
  const api = makeApi(state)
  ddBehavior.actReveal(state, { originalCode: '05069' }, api)
  assert.equal(entry.revealed, true)
  assert.equal(state.scenarioFlags.entryHallSealed, false)
  assert.ok(api.calls.some(call => call.name === 'shuffleDiscard'))
})

test('05070 逃出牢笼：轮末银暮秘社敌人逃进入口大厅底下、冷漠敌人向大厅移动；背面进入结局 1', () => {
  const state = ddState(2)
  state.actIndex = 2
  const inHall = { id: 'e-hall', code: '05095', originalCode: '05095', location: 'entryHall', traits: ['Silver Twilight'] }
  const aloof = { id: 'e-aloof', code: '05095', originalCode: '05095', location: 'balcony', traits: ['Silver Twilight'], aloof: true, exhausted: false }
  state.enemies.push(inHall, aloof)
  const api = makeApi(state)
  ddBehavior.roundEnded(state, api)
  assert.equal(state.enemies.some(enemy => enemy.id === 'e-hall'), false)
  assert.deepEqual(state.scenarioFlags.beneathEntryHall, ['05095'])
  assert.equal(aloof.location, 'entryHall')
  const apiFinish = makeApi(state)
  ddBehavior.actReveal(state, { originalCode: '05070' }, apiFinish)
  assert.deepEqual(apiFinish.calls.find(call => call.name === 'finish').args, ['r1'])
})

test('05071 入口大厅：提供撤退行动并提交 resign', () => {
  const state = ddState(2)
  const moves = ddBehavior.actions(state, state.investigators[0])
  const resign = moves.find(move => move.rule === 'resignEntryHall')
  assert.ok(resign, '入口大厅应有撤退行动')
  const api = makeApi(state)
  ddBehavior.performAction(state, state.investigators[0], resign, api)
  assert.deepEqual(api.calls.find(call => call.name === 'resign').args, [0])
})

test('05073 纪念品陈列室：每轮一次，获得 2 资源或花 2 资源换 1 线索', () => {
  const state = ddState(2)
  state.investigators[0].location = 'trophyRoom'
  const moves = ddBehavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'trophyRoomAction')
  assert.ok(action)
  const gainApi = makeApi(state, { choose: () => 'gain' })
  ddBehavior.performAction(state, state.investigators[0], action, gainApi)
  assert.equal(state.investigators[0].resources, 7)
  assert.equal(state.investigators[0].trophyRoomRound, state.round)
  const spendApi = makeApi(state, { choose: () => 'spend' })
  ddBehavior.performAction(state, state.investigators[0], action, spendApi)
  assert.equal(state.investigators[0].resources, 5)
  assert.equal(state.investigators[0].clues, 1)
})

test('05074 台球室：每轮一次敏捷(3)，成功从供应堆获得 1 线索', () => {
  const state = ddState(2)
  state.investigators[0].location = 'billiardsRoom'
  const moves = ddBehavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'billiardsRoomAction')
  assert.ok(action)
  const api = makeApi(state)
  ddBehavior.performAction(state, state.investigators[0], action, api)
  const testCall = api.calls.find(call => call.name === 'test')
  assert.deepEqual(testCall.args.slice(0, 3), [0, 'agility', 3])
  assert.deepEqual(api.calls.find(call => call.name === 'gainClues').args, [0, 1])
})

test('05075 主卧：轮末有调查员时在最近的银暮秘社敌人上放 1 毁灭', () => {
  const state = ddState(2)
  state.investigators[0].location = 'masterBedroom'
  const silver = { id: 'e-silver', code: '05095', originalCode: '05095', location: 'balcony', traits: ['Silver Twilight'], doom: 0 }
  const farther = { id: 'e-far', code: '05095', originalCode: '05095', location: 'office', traits: ['Silver Twilight'], doom: 0 }
  state.enemies.push(farther, silver)
  const api = makeApi(state)
  ddBehavior.roundEnded(state, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'doomOn').map(call => call.args[0].id), ['e-silver'])
})

test('05076 露台：弃掉合计至少 3 智识图标的手牌谈判，团队每场一次获得 2 线索；不足不消耗次数', () => {
  const state = ddState(2)
  state.investigators[0].location = 'balcony'
  const intellectCards = Object.values(ALL_CARDS)
    .filter(card => card.type !== 'location' && (card.icons?.intellect || 0) === 1
      && !(card.icons?.wild > 0)).slice(0, 3).map(card => card.code)
  assert.equal(intellectCards.length, 3)
  state.investigators[0].hand = [...intellectCards]
  const moves = ddBehavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'balconyParley')
  assert.ok(action)
  assert.equal(action.actionKind, 'parley')
  const api = makeApi(state, { choose: request => request.kind === 'card' ? request.options?.[0]?.id : request.options?.[0]?.id })
  ddBehavior.performAction(state, state.investigators[0], action, api)
  assert.equal(state.investigators[0].hand.length, 0)
  assert.equal(state.investigators[0].discard.length, 3)
  assert.equal(state.investigators[0].clues, 2)
  assert.equal(state.scenarioFlags.balconyParleyUsed, true)
  // 智识图标不足：无效且不消耗团队次数。
  const short = ddState(2)
  short.investigators[0].location = 'balcony'
  short.investigators[0].hand = ['01001']
  const shortAction = ddBehavior.actions(short, short.investigators[0]).find(move => move.rule === 'balconyParley')
  const shortApi = makeApi(short, { choose: () => 'skip' })
  ddBehavior.performAction(short, short.investigators[0], shortAction, shortApi)
  assert.equal(short.scenarioFlags.balconyParleyUsed, undefined)
})

test('05077 办公室：位于办公室的银暮秘社敌人失去冷漠；调查揭示负面符号时最近银暮秘社敌人 +1 毁灭', () => {
  const state = ddState(2)
  state.investigators[0].location = 'office'
  const atOffice = { id: 'e-office', code: '05095', originalCode: '05095', location: 'office', traits: ['Silver Twilight'], aloof: true, printedAloof: true }
  const farther = { id: 'e-near', code: '05095', originalCode: '05095', location: 'billiardsRoom', traits: ['Silver Twilight'], aloof: true, printedAloof: true, doom: 0 }
  state.enemies.push(atOffice, farther)
  const spawnApi = makeApi(state)
  ddBehavior.enemySpawned(state, atOffice, spawnApi)
  assert.equal(atOffice.aloof, false, '办公室里的银暮秘社敌人失去冷漠')
  const api = makeApi(state)
  ddBehavior.afterTest(state, state.investigators[0], {
    source: { code: '05077' }, drawn: ['skull'], success: false, difficulty: 3, value: 1,
  }, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'doomOn').map(call => call.args[0].id), ['e-office'],
    '最近的银暮秘社敌人是办公室里的那一个')
})

test('05079 维多利亚式宴会厅（幽灵面）：翻面后获得「闹鬼 - 失去 1 个行动」', () => {
  const state = ddState(2)
  const location = loc(state, 'victorianHalls')
  location.originalCode = SPECTRAL_LOCATION_CODES.victorianHalls
  location.spectralFace = 'spectral'
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.victorianHalls)
  assert.equal(location.haunted[0].text, '闹鬼 - 失去 1 个行动。')
})

test('05082 主卧（幽灵面）：翻面后获得「闹鬼 - 将你的 1 个线索放到主卧」', () => {
  const state = ddState(2)
  const location = loc(state, 'masterBedroom')
  location.originalCode = SPECTRAL_LOCATION_CODES.masterBedroom
  location.spectralFace = 'spectral'
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.masterBedroom)
  assert.equal(location.haunted[0].effect[0].kind, 'placeClue')
})

test('05085 约瑟夫·梅吉尔：其他银暮秘社敌人无毁灭时可谈判；成功翻面结算 05085b', () => {
  const state = ddState(2)
  const josef = { id: 'e-josef', code: JOSEF, originalCode: JOSEF, location: 'entryHall', doom: 2, engagedSeat: null }
  state.enemies.push(josef)
  const moves = ddBehavior.actions(state, state.investigators[0])
  const parley = moves.find(move => move.rule === 'josefParley')
  assert.ok(parley, '应提供约瑟夫谈判行动')
  assert.equal(parley.actionKind, 'parley')
  const blocked = ddState(2)
  const josef2 = { id: 'e-josef-2', code: JOSEF, originalCode: JOSEF, location: 'entryHall', doom: 2 }
  const other = { id: 'e-other', code: '05095', originalCode: '05095', location: 'office', traits: ['Silver Twilight'], doom: 1 }
  blocked.enemies.push(josef2, other)
  assert.equal(ddBehavior.actions(blocked, blocked.investigators[0]).some(move => move.rule === 'josefParley'), false,
    '其他银暮秘社敌人有毁灭时不能谈判')
  const api = makeApi(state)
  ddBehavior.performAction(state, state.investigators[0], parley, api)
  const flips = api.calls.filter(call => call.name === 'flipEnemy').map(call => call.args[1])
  assert.deepEqual(flips, ['05085b', JOSEF], '先翻到计划面再翻回敌人面')
  assert.equal(state.scenarioFlags.josefPlanResolved, true)
  assert.equal(josef.doom, 0)
  state.enemies.push(other)
  assert.equal(ddBehavior.canPlaceDoomOn(state, other), false, '本局银暮秘社敌人不能再获得毁灭')
})


// ---------------------------------------------------------------------------
// 幽灵面地点逐卡证据（05078/05080/05081/05083/05084）
// 主进程复核发现这 5 张原先只有「范围串/同形说明」式的标题提及，补专属卡号用例。
// ---------------------------------------------------------------------------
test('05078 入口大厅（幽灵面）：封印/未揭示时不能进入、银暮秘社敌人不能生成、提供幽灵面撤退', () => {
  const state = ddState(2)
  const hall = loc(state, 'entryHall')
  hall.code = SPECTRAL_LOCATION_CODES.entryHall
  hall.originalCode = SPECTRAL_LOCATION_CODES.entryHall
  state.investigators[0].location = 'entryHall'
  // 卡面数据：入口大厅幽灵面 shroud 3、0 线索、[[幽灵]]特性。
  assert.equal(ALL_CARDS[SPECTRAL_LOCATION_CODES.entryHall].shroud, 3)
  assert.equal(ALL_CARDS[SPECTRAL_LOCATION_CODES.entryHall].clues, 0)
  assert.ok(ALL_CARDS[SPECTRAL_LOCATION_CODES.entryHall].traits.includes('Spectral'))
  // 鬼灵迷雾封锁：封印/未揭示时不能进入入口大厅。
  state.scenarioFlags.entryHallSealed = true
  hall.revealed = false
  assert.match(ddBehavior.investigatorEntryError(state, hall), /鬼灵迷雾/)
  // 封锁期间银暮秘社敌人不能生成在幽灵面入口大厅；其它敌人不受影响。
  assert.equal(ddBehavior.spawnLocation(state, '05095', 'entryHall'), '__nowhere__')
  assert.equal(ddBehavior.spawnLocation(state, '05086', 'entryHall'), 'entryHall')
  // 揭示后解除封锁。
  hall.revealed = true
  state.scenarioFlags.entryHallSealed = false
  assert.equal(ddBehavior.investigatorEntryError(state, hall), null)
  // [action] 撤退：幽灵面入口大厅提供独立自撤退行动并可提交。
  const moves = ddBehavior.actions(state, state.investigators[0])
  const resign = moves.find(move => move.rule === 'resignSpectralEntryHall')
  assert.ok(resign, '幽灵面入口大厅应提供撤退行动')
  const api = makeApi(state)
  ddBehavior.performAction(state, state.investigators[0], resign, api)
  assert.deepEqual(api.calls.find(call => call.name === 'resign').args, [0])
})

test('05080 纪念品陈列室（幽灵面）：翻面获得「闹鬼-失去 2 资源，无法失去的改为 1 恐惧」，幽灵面 1 线索/人', () => {
  const state = ddState(2)
  const location = loc(state, 'trophyRoom')
  location.code = SPECTRAL_LOCATION_CODES.trophyRoom
  location.originalCode = SPECTRAL_LOCATION_CODES.trophyRoom
  location.spectralFace = 'spectral'
  assert.equal(SPECTRAL_LOCATION_CODES.trophyRoom, '05080')
  assert.equal(ALL_CARDS['05080'].shroud, 2)
  assert.equal(ALL_CARDS['05080'].clues, 1)
  assert.ok(ALL_CARDS['05080'].traits.includes('Spectral'))
  assert.equal(ddDefinition.locations.trophyRoom.back.code, '05080')
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.trophyRoom)
  const clause = location.haunted[0].effect[0]
  assert.equal(clause.kind, 'loseResource')
  assert.equal(clause.amount, 2)
  assert.equal(clause.overflowHorror, true, '无法失去的资源改为 1 点恐惧')
})

test('05081 台球室（幽灵面）：翻面写入胜利 1 与「闹鬼-弃支援或受 1 伤害」二选一，幽灵面 1 线索/人', () => {
  const state = ddState(2)
  const location = loc(state, 'billiardsRoom')
  location.code = SPECTRAL_LOCATION_CODES.billiardsRoom
  location.originalCode = SPECTRAL_LOCATION_CODES.billiardsRoom
  location.spectralFace = 'spectral'
  assert.equal(SPECTRAL_LOCATION_CODES.billiardsRoom, '05081')
  assert.equal(ALL_CARDS['05081'].victory, 1)
  assert.equal(ALL_CARDS['05081'].clues, 1)
  assert.equal(ALL_CARDS['05081'].shroud, 3)
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.equal(location.victory, 1, '幽灵面胜利点写入实例（幕末按已揭示且无线索计分）')
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.billiardsRoom)
  const choice = location.haunted[0].effect[0]
  assert.equal(choice.kind, 'choice')
  assert.deepEqual(choice.options.map(option => option.id).sort(), ['asset', 'damage'])
})

test('05083 露台（幽灵面）：翻面获得「闹鬼-你每张带生命值的卡牌受 1 直接伤害」，幽灵面 1 线索/人', () => {
  const state = ddState(2)
  const location = loc(state, 'balcony')
  location.code = SPECTRAL_LOCATION_CODES.balcony
  location.originalCode = SPECTRAL_LOCATION_CODES.balcony
  location.spectralFace = 'spectral'
  assert.equal(SPECTRAL_LOCATION_CODES.balcony, '05083')
  assert.equal(ALL_CARDS['05083'].shroud, 1)
  assert.equal(ALL_CARDS['05083'].clues, 1)
  assert.ok(ALL_CARDS['05083'].traits.includes('Spectral'))
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.balcony)
  assert.equal(location.haunted[0].effect[0].kind, 'damageAssets')
  assert.equal(location.haunted[0].effect[0].amount, 1)
})

test('05084 办公室（幽灵面）：翻面写入胜利 2 与「闹鬼-选择并弃掉 1 张手牌」，幽灵面 2 线索/人', () => {
  const state = ddState(2)
  const location = loc(state, 'office')
  location.code = SPECTRAL_LOCATION_CODES.office
  location.originalCode = SPECTRAL_LOCATION_CODES.office
  location.spectralFace = 'spectral'
  assert.equal(SPECTRAL_LOCATION_CODES.office, '05084')
  assert.equal(ALL_CARDS['05084'].victory, 2)
  assert.equal(ALL_CARDS['05084'].clues, 2)
  assert.equal(ALL_CARDS['05084'].shroud, 4)
  ddBehavior.locationFlipped(state, location, makeApi(state))
  assert.equal(location.victory, 2, '幽灵面胜利点写入实例（幕末按已揭示且无线索计分）')
  assert.deepEqual(location.haunted, SPECTRAL_HAUNTED.office)
  assert.equal(location.haunted[0].effect[0].kind, 'discardChosen')
  assert.equal(location.haunted[0].effect[0].amount, 1)
})
