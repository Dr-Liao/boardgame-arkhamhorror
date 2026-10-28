import test from 'node:test'
import assert from 'node:assert/strict'
import * as yoth from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/index.js'
import {
  scenario as definition, DEPTH_LOCATIONS, STEPS_OF_YOTH, agendaCodesFor,
} from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/definition.js'
import { placePursuitEnemies, totalVengeance } from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
// P2-6（2026-10-28）：04289 的检定链改用引擎「检定后继续同一次探索」原语，
// 这里补真实引擎（performTest / doExplore / resumeExplore）的验收。
import { applyMove, createGameState, legalMoves, placeLocation, startScenario } from '../src/engine/engine.js'
import { contentRegistry } from '../content/registered.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'cityOfTheSerpents',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    explorationDeck: [],
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
      supplies: Object.fromEntries(Array.from({ length: count }, (_, seat) => [seat, []])),
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function locationInstance(state, id) {
  const def = state.scenario.locations[id]
  const clues = (def.cluesPerInvestigator || 0) * state.numInvestigators
  return { ...clone(def), id, revealed: false, clues: 0, maxClues: clues, doom: 0 }
}

function putIntoPlay(state, id) {
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  const location = locationInstance(state, id)
  location.revealed = true
  location.clues = location.maxClues
  state.locations.push(location)
  return location
}

// 手搭一个足以跑行为钩子的剧本运行时（与引擎同名同签名）。
function apiFor(state, options = {}) {
  const calls = {
    spawned: [], drawn: [], finished: [], placed: [], removed: [], moved: [], defeated: [],
    damage: [], horror: [], trauma: [], tests: [], info: [], crossedOff: [], clues: [], attacked: [],
    resumed: [],
  }
  const outcomes = [...(options.outcomes || [])]
  const supplies = new Set(options.supplies || [])
  const api = {
    calls,
    info: text => calls.info.push(text),
    random: () => (options.random ? options.random() : 0.37),
    choose: request => (options.choose ? options.choose(request) : request.options?.[request.options.length - 1]?.id ?? 'skip'),
    checkSupplies: (seat, name) => supplies.has(name),
    crossOffSupply: (seat, name) => { calls.crossedOff.push({ seat, name }); supplies.delete(name) },
    place: id => {
      calls.placed.push(id)
      if (state.locations.some(location => location.id === id)) return
      state.locations.push(locationInstance(state, id))
    },
    reveal: id => {
      const location = state.locations.find(entry => entry.id === id)
      if (!location || location.revealed) return
      location.revealed = true
      location.clues = location.maxClues ?? 0
      if (id === 'cavernsOfYoth') yoth.behavior.locationRevealed(state, location, api)
    },
    remove: id => { calls.removed.push(id); state.locations = state.locations.filter(entry => entry.id !== id) },
    spawn: (code, location) => {
      const def = state.scenario.enemies?.[code] || {}
      const enemy = {
        id: `enemy-${(state.enemySeq = (state.enemySeq || 0) + 1)}`,
        code, originalCode: code, name: def.name || code, location,
        damageTaken: def.damageTaken || 0, exhausted: false, engagedSeat: null,
        fight: def.fight || 0, evade: def.evade || 0,
        health: def.healthPerInvestigator
          ? def.healthPerInvestigator * state.numInvestigators
          : (def.health || 1) + (def.healthPerPlayerBonus || 0) * state.numInvestigators,
        damage: def.damage || 0, horror: def.horror || 0,
        victory: def.victory || 0, vengeance: def.vengeance || 0,
        traits: [...(def.traits || [])],
      }
      state.enemies.push(enemy)
      calls.spawned.push({ code, location })
      yoth.behavior.enemySpawned(state, enemy, api)
      return enemy
    },
    engage: (enemy, seat) => {
      enemy.engagedSeat = seat
      const inv = state.investigators[seat]
      if (inv && !inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
    },
    attack: (enemy, inv) => calls.attacked.push({ enemyId: enemy.id, seat: inv.seat }),
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push({ seat, amount }) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push({ seat, amount }) },
    trauma: (seat, kind, amount) => calls.trauma.push({ seat, kind, amount }),
    defeat: (inv, cause) => {
      inv.defeated = true
      inv.defeatCause = cause ?? null
      calls.defeated.push(inv.seat)
      // 与真实引擎一致：killed 时同步战役记录状态。
      if (cause === 'killed') {
        const record = state.campaign?.investigators?.[inv.seat]
        if (record) record.status = 'killed'
      }
    },
    // 04289：检定链成功后引擎回到同一次探索。
    resumeExplore: seat => calls.resumed.push(seat),
    moveInvestigator: (seat, destination) => { calls.moved.push({ seat, destination }); state.investigators[seat].location = destination },
    drawEncounter: seat => calls.drawn.push(seat),
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount; calls.clues.push({ seat, amount }) },
    finish: key => calls.finished.push(key),
    test: (seat, skill, difficulty, resolve) => {
      calls.tests.push({ seat, skill, difficulty })
      const success = outcomes.length ? outcomes.shift() : true
      resolve({ success, value: success ? difficulty + 1 : Math.max(0, difficulty - 1), difficulty, skill, drawn: [], cancelledTokens: [] })
    },
  }
  return api
}

function prepared(seed = 1, count = 2, records = {}) {
  const state = stateFor(count, records)
  const helper = setupApi(seed)
  const placed = yoth.behavior.setupLocations(state, [], helper)
  yoth.behavior.setupEnemies(state, [], { ...helper, info: () => {}, locName: id => id })
  yoth.behavior.afterDeckSetup(state, [], { info: () => {} })
  for (const id of placed) putIntoPlay(state, id)
  return state
}

test('幽嘶深渊 M5：章节已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(yoth.manifest.status, 'playable')
  assert.equal(yoth.manifest.catalogReferenceOnly, undefined)
  assert.equal(yoth.manifest.referenceCode, undefined)
  assert.equal(yoth.scenario.originalCode, '04277')
  assert.equal(yoth.manifest.locations.length, 10)
  assert.deepEqual(yoth.manifest.acts.map(act => act.id), ['act1'])
  assert.equal(yoth.manifest.agendas.length, 7)
  assert.deepEqual(yoth.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
  assert.equal(yoth.behavior.id, 'theDepthsOfYoth')
  assert.ok(yoth.behavior.implementedEncounterCodes.includes('04299'))
  assert.equal(yoth.manifest.requiredMechanicIds.includes('tfaYigsFury'), true)
  assert.equal(yoth.manifest.requiredEncounterGroupIds.includes('theDepthsOfYoth'), true)
})

test('符号地图按印刷符号连线：10 处地点各 5 条连线', () => {
  const locations = Object.fromEntries(yoth.manifest.locations.map(entry => [entry.id, entry]))
  for (const entry of Object.values(locations)) {
    assert.equal(entry.connections.length, 5, `${entry.id} 应有 5 条符号连线`)
  }
  assert.deepEqual([...locations.stepsOfYoth.connections].sort(), [
    'abandonedSite', 'bridgeOverNKai', 'cityOfTheSerpents', 'crumblingPrecipice', 'hallOfHeresy',
  ])
  assert.ok(locations.cavernsOfYoth.connections.includes('bridgeOverNKai'), '水滴与心形相连')
  assert.equal(locations.cityOfTheSerpents.connections.includes('brightCanyon'), false)
})

test('布置是确定性的：同种子同起点同探索牌库，不同种子会变', () => {
  const build = seed => {
    const state = prepared(seed)
    return { plan: setupPlanOf(seed), deck: state.explorationDeck, start: state.scenarioFlags.depthStartLocation }
  }
  const first = build(17)
  assert.deepEqual(first.deck, build(17).deck)
  assert.notDeepEqual(first.deck, build(18).deck)
  assert.equal(first.deck.length, 5, '探索牌库 = 幽嘶的阶梯 + 4 处地点')
  assert.ok(first.deck.includes(STEPS_OF_YOTH))
  assert.ok(DEPTH_LOCATIONS.includes(first.start))
})

function setupPlanOf(seed) {
  const state = stateFor()
  return yoth.behavior.setupPlan(state, setupApi(seed))
}

test('布置：深度等级从 1 开始，起始地点与一边的地点互不重复', () => {
  const state = prepared(5)
  assert.equal(state.scenarioFlags.depthLevel, 1)
  const start = state.scenarioFlags.depthStartLocation
  assert.equal(state.locations.length, 1)
  assert.equal(state.locations[0].id, start)
  assert.equal(state.investigators.every(inv => inv.location === start), true)
  const pool = state.scenarioZones.locationPool
  assert.equal(pool.length, 4)
  const all = [start, ...state.explorationDeck, ...pool]
  assert.equal(new Set(all).size, 10, '10 张地点卡各在其位')
})

test('布置：怒气决定密谋起点，也为 0 时把伊格与深坑守卫移出游戏', () => {
  assert.deepEqual(agendaCodesFor(0), ['04278', '04279', '04280', '04281', '04282', '04283', '04284'])
  assert.deepEqual(agendaCodesFor(17), ['04281', '04282', '04283', '04284'])
  assert.deepEqual(agendaCodesFor(18), ['04282', '04283', '04284'])
  assert.deepEqual(agendaCodesFor(21), ['04283', '04284'])
  const zero = prepared(3, 2, { yigsFury: 0 })
  assert.equal(zero.agendas.length, 7)
  assert.deepEqual(zero.scenarioZones.removed.filter(code => code === '04297').length, 3)
  assert.ok(zero.scenarioZones.removed.includes('04296'))
  assert.equal(zero.encounterDeck.includes('04296'), false)
  assert.equal(zero.encounterDeck.includes('04297'), false)
  const high = prepared(3, 2, { yigsFury: 21 })
  assert.deepEqual(high.agendas.map(agenda => agenda.originalCode), ['04283', '04284'])
  assert.deepEqual(high.scenarioZones.pursuit.map(entry => entry.code), ['04296'])
})

test('布置：放在一边的内容（遗物、中毒、伊格）与预示者的初始伤害', () => {
  const state = prepared(7, 2, { yigsFury: 9, theHarbingerIsStillAlive: 3 })
  assert.ok(state.scenarioZones.setAside.includes('04303'), '古代遗物')
  assert.equal(state.scenarioZones.setAside.filter(code => code === '04102').length, 4)
  assert.ok(state.scenarioZones.setAside.includes('04296'), '怒气 9 时伊格放在一边')
  assert.deepEqual(state.scenarioZones.harbingerAside,
    { code: '04062', damageTaken: 3, resources: 0 })
  assert.deepEqual(state.scenarioZones.pursuit, [])
  // 牌库里已经有 2 张中毒 → 只再放 2 张在一边。
  const poisoned = stateFor(2, {})
  poisoned.campaign.investigators[0].deck.push('04102')
  poisoned.campaign.investigators[1].deck.push('04102')
  yoth.behavior.setupLocations(poisoned, [], setupApi(7))
  assert.equal(poisoned.scenarioZones.setAside.filter(code => code === '04102').length, 2)
  // 怒气 ≥18 时预示者直接进追击区域。
  const hot = prepared(7, 2, { yigsFury: 18, theHarbingerIsStillAlive: 2 })
  assert.deepEqual(hot.scenarioZones.pursuit.map(entry => entry.code), ['04062'])
  assert.equal(hot.scenarioZones.harbingerAside, undefined)
})

test('混乱标记表按深度等级取 X，困难难度骷髅失败额外 1 点恐惧', () => {
  const state = prepared(11, 1)
  state.scenarioFlags.depthLevel = 3
  const api = apiFor(state)
  const inv = state.investigators[0]
  assert.equal(yoth.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -3)
  assert.equal(yoth.behavior.resolveChaosToken(state, inv, 'cultist', api).drawAnother, true)
  state.victoryDisplay.push({ id: 'v1', vengeance: 5 })
  assert.equal(yoth.behavior.resolveChaosToken(state, inv, 'elderthing', api).autoFail, true)
  assert.equal(yoth.behavior.resolveChaosToken(state, inv, 'tablet', api).drawAnother, true)
  state.difficulty = 'hard'
  yoth.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 3, skill: 'wilpower', drawn: ['skull'], cancelledTokens: [] }, api)
  assert.equal(inv.horror, 1)
  state.difficulty = 'standard'
  yoth.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 3, skill: 'willpower', drawn: ['skull'], cancelledTokens: [] }, api)
  assert.equal(inv.horror, 1, '普通难度不吃额外恐惧')
})

test('04285 背面：深度 +1，留下没跟上的人，敌人进追击区，换一层楼继续下降', () => {
  const state = prepared(23, 2)
  const start = state.scenarioFlags.depthStartLocation
  const inv0 = state.investigators[0]
  const inv1 = state.investigators[1]
  // 队伍已经找到幽嘶的阶梯：把阶梯从探索牌库放到场上。
  state.explorationDeck = state.explorationDeck.filter(id => id !== STEPS_OF_YOTH)
  putIntoPlay(state, STEPS_OF_YOTH)
  inv0.location = STEPS_OF_YOTH
  inv1.location = start
  inv0.clues = 4
  inv1.clues = 2
  state.enemies.push({ id: 'e1', code: '04297', originalCode: '04297', name: '深坑守卫',
    location: STEPS_OF_YOTH, damageTaken: 2, traits: ['Humanoid', 'Monster', 'Serpent'], exhausted: false, engagedSeat: null })
  const api = apiFor(state)
  yoth.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.scenarioFlags.depthLevel, 2)
  assert.deepEqual(api.calls.defeated, [1], '不在幽嘶的阶梯的调查员被留在身后')
  assert.equal(inv0.clues, 0, '幸存者失去所有线索')
  assert.deepEqual(state.scenarioZones.pursuit,
    [{ code: '04297', damageTaken: 2, resources: 0 }])
  assert.equal(state.enemies.length, 0)
  assert.equal(state.locations.length, 1)
  assert.equal(state.locations[0].revealed, true)
  assert.equal(state.locations[0].id, state.scenarioFlags.depthStartLocation)
  assert.notEqual(state.locations[0].id, start)
  assert.equal(inv0.location, state.locations[0].id)
  assert.equal(state.explorationDeck.length, 5)
  assert.ok(state.explorationDeck.includes(STEPS_OF_YOTH))
  assert.equal(state.actIndex, -1, '幕翻回正面，引擎 +1 后仍是同一张')
})

test('深度等级到 5 时直接进入结局 2（联结点近在眼前）', () => {
  const state = prepared(29, 1)
  state.scenarioFlags.depthLevel = 4
  const api = apiFor(state)
  yoth.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.scenarioFlags.depthLevel, 5)
  assert.deepEqual(api.calls.finished, ['r2'])
  assert.equal(api.calls.defeated.length, 0, '到达联结点时不再留下任何人')
})

test('幽嘶的阶梯：深度增加时可用绳索再 +1（每场游戏一次）', () => {
  const state = prepared(31, 1)
  putIntoPlay(state, STEPS_OF_YOTH)
  const inv = state.investigators[0]
  inv.location = STEPS_OF_YOTH
  inv.clues = 5
  const api = apiFor(state, { supplies: ['rope'], choose: () => 'use' })
  assert.equal(yoth.behavior.incrementDepth(state, api), 3, '基础 +1，绳索再 +1')
  assert.deepEqual(api.calls.crossedOff, [{ seat: 0, name: 'rope' }])
  assert.equal(state.scenarioFlags.stepsOfYothRopeUsed, true)
  // 每场游戏一次：下一次只 +1。
  assert.equal(yoth.behavior.incrementDepth(state, api), 4)
  // 线索不够（需要 5×人数）时也不触发。
  const poor = prepared(31, 1)
  putIntoPlay(poor, STEPS_OF_YOTH)
  poor.investigators[0].location = STEPS_OF_YOTH
  poor.investigators[0].clues = 4
  assert.equal(yoth.behavior.incrementDepth(poor, apiFor(poor, { supplies: ['rope'] })), 2)
})

test('追击区域：密谋推进时把躲避值最高的追击敌人放到本层起点', () => {
  const state = prepared(37, 2)
  state.scenarioFlags.depthStartLocation = 'cavernsOfYoth'
  putIntoPlay(state, 'cavernsOfYoth')
  state.scenarioZones.pursuit = [
    { code: '04297', damageTaken: 1, resources: 0 },
    { code: '04298', damageTaken: 0, resources: 0 },
  ]
  const api = apiFor(state)
  yoth.behavior.agendaReveal(state, state.agendas[0], api)
  // 深渊吞噬者躲避值 = 深度（1 + 1 = 2）> 深坑守卫 1。
  assert.deepEqual(api.calls.spawned, [{ code: '04298', location: 'cavernsOfYoth' }])
  assert.equal(state.scenarioZones.pursuit.length, 1)
  assert.equal(state.scenarioZones.pursuit[0].code, '04297')
  const placed = placePursuitEnemies(state, api)
  assert.equal(placed.code, '04297')
  assert.equal(placed.damageTaken, 1, '追击区域保留伤害')
  assert.equal(state.scenarioZones.pursuit.length, 0)
})

test('密谋背面：血色城市把放在一边的预示者移进追击区域，撼地之怒放出伊格', () => {
  const state = prepared(41, 2, { yigsFury: 6, theHarbingerIsStillAlive: 4 })
  assert.deepEqual(state.scenarioZones.harbingerAside, { code: '04062', damageTaken: 4, resources: 0 })
  const api = apiFor(state)
  const cityOfBlood = state.agendas.find(agenda => agenda.originalCode === '04281')
  yoth.behavior.agendaReveal(state, cityOfBlood, api)
  assert.equal(state.scenarioZones.harbingerAside, undefined)
  assert.deepEqual(api.calls.spawned, [{ code: '04062', location: state.scenarioFlags.depthStartLocation }])
  const spawned = state.enemies.find(enemy => enemy.code === '04062')
  assert.equal(spawned.damageTaken, 4, '预示者带着记录里的伤害入场')
  // 撼地之怒：放在一边的伊格在起点现身。
  const fury = state.agendas.find(agenda => agenda.originalCode === '04282')
  assert.ok(state.scenarioZones.setAside.includes('04296'), '怒气 6 时伊格在一边')
  yoth.behavior.agendaReveal(state, fury, api)
  assert.equal(state.scenarioZones.setAside.includes('04296'), false)
  assert.ok(state.enemies.some(enemy => enemy.code === '04296'))
})

test('密谋背面：恐惧渐生的水壶决定把「奇怪的液体」记进剧本日志', () => {
  const state = prepared(43, 1, { yigsFury: 9 })
  const api = apiFor(state, { supplies: ['canteen'], choose: () => 'collect' })
  const agenda = state.agendas.find(entry => entry.originalCode === '04279')
  yoth.behavior.agendaReveal(state, agenda, api)
  assert.equal(state.scenarioFlags.collectedAStrangeLiquid, true)
  const refused = prepared(43, 1, { yigsFury: 9 })
  yoth.behavior.agendaReveal(refused, refused.agendas.find(entry => entry.originalCode === '04279'),
    apiFor(refused, { choose: () => 'leave' }))
  assert.equal(refused.scenarioFlags.collectedAStrangeLiquid, false)
})

test('密谋背面：无尽洞窟让没有绳索的侦查员检定战斗(5)，失败 1 点肉体创伤', () => {
  const state = prepared(47, 1, { yigsFury: 11 })
  const api = apiFor(state, { outcomes: [false] })
  const agenda = state.agendas.find(entry => entry.originalCode === '04280')
  yoth.behavior.agendaReveal(state, agenda, api)
  assert.deepEqual(api.calls.tests.map(entry => [entry.difficulty]), [[5]])
  assert.ok(['combat', 'agility'].includes(api.calls.tests[0].skill), '战斗或敏捷由侦查员选择')
  assert.deepEqual(api.calls.trauma, [{ seat: 0, kind: 'physical', amount: 1 }])
  const rope = prepared(47, 1, { yigsFury: 11 })
  const ropeApi = apiFor(rope, { supplies: ['rope'] })
  yoth.behavior.agendaReveal(rope, rope.agendas.find(entry => entry.originalCode === '04280'), ropeApi)
  assert.equal(ropeApi.calls.tests.length, 0)
})

test('本章诡计：无光之影 / 深渊恐惧症按深度设难度', () => {
  const state = prepared(53, 1)
  state.scenarioFlags.depthLevel = 2
  const inv = state.investigators[0]
  const shadow = apiFor(state, { outcomes: [false] })
  yoth.behavior.resolveEncounter(state, inv, { code: '04300', originalCode: '04300' }, shadow)
  assert.deepEqual(shadow.calls.tests.map(entry => [entry.skill, entry.difficulty]), [['agility', 3]])
  assert.equal(inv.damage, 2)
  const batho = apiFor(state, { outcomes: [false] })
  yoth.behavior.resolveEncounter(state, inv, { code: '04301', originalCode: '04301' }, batho)
  assert.deepEqual(batho.calls.tests.map(entry => [entry.skill, entry.difficulty]), [['willpower', 3]])
  assert.equal(inv.horror, 2)
})

test('本章诡计：蛇族的愤怒没有蛇族在追击时涌动，否则拽出攻击值最高的蛇族', () => {
  const state = prepared(59, 1)
  const inv = state.investigators[0]
  const surge = apiFor(state)
  const surgeResult = yoth.behavior.resolveEncounter(state, inv, { code: '04302', originalCode: '04302' }, surge)
  assert.deepEqual(surge.calls.drawn, [0], '有涌动时直接抽下一张遭遇')
  assert.deepEqual(surgeResult, { placed: false, surgeHandled: true }, '涌动由本章结算，交给引擎不要再抽一次')
  state.scenarioZones.pursuit = [
    { code: '04083', damageTaken: 0, resources: 0 },
    { code: '04297', damageTaken: 0, resources: 0 },
  ]
  const ire = apiFor(state, { outcomes: [false] })
  yoth.behavior.resolveEncounter(state, inv, { code: '04302', originalCode: '04302' }, ire)
  assert.equal(ire.calls.spawned[0].code, '04297', '深坑守卫的攻击值最高')
  assert.equal(state.enemies.find(enemy => enemy.code === '04297').engagedSeat, 0)
  assert.deepEqual(ire.calls.tests.map(entry => [entry.skill, entry.difficulty]), [['agility', 4]])
  assert.equal(ire.calls.attacked.length, 1, '敏捷检定失败后敌人立刻攻击')
})

test('本章诡计：瓦卢西亚之子给每个蛇族 +1 攻击/躲避，轮末弃掉 1 张', () => {
  const state = prepared(61, 2)
  const inv = state.investigators[0]
  yoth.behavior.resolveEncounter(state, inv, { code: '04299', originalCode: '04299' }, apiFor(state))
  assert.equal(state.scenarioZones.childrenOfValusia.length, 1)
  const serpent = { id: 's1', code: '04297', originalCode: '04297', traits: ['Serpent'], fight: 4, evade: 1 }
  assert.equal(yoth.behavior.enemyStatModifier(state, serpent, 'fight'), 1)
  assert.equal(yoth.behavior.enemyStatModifier(state, serpent, 'evade'), 1)
  const spider = { id: 's2', code: '04298', originalCode: '04298', traits: ['Monster'], fight: 5, evade: 0 }
  assert.equal(yoth.behavior.enemyStatModifier(state, spider, 'evade'), 1, '深渊吞噬者的躲避值是深度')
  const api = apiFor(state)
  yoth.behavior.roundEnded(state, api)
  assert.equal(state.scenarioZones.childrenOfValusia.length, 0)
  assert.ok(state.encounterDiscard.includes('04299'))
})

test('地点效果：帷幕随深度/复仇变化，幽嘶洞群按深度放线索', () => {
  const state = prepared(67, 2)
  state.scenarioFlags.depthLevel = 3
  const abandoned = putIntoPlay(state, 'abandonedSite')
  assert.equal(abandoned.shroud + yoth.behavior.locationShroudModifier(state, abandoned), 3)
  const bridge = putIntoPlay(state, 'bridgeOverNKai')
  state.victoryDisplay.push({ id: 'v', vengeance: 2 })
  // 04292 每点复仇 +1 帷幕，且要把 04287/04288 的「视同胜利区」算进去。
  assert.equal(bridge.shroud + yoth.behavior.locationShroudModifier(state, bridge),
    bridge.shroud + totalVengeance(state))
  // 引擎在揭示时先把印刷线索放满，再回调 locationRevealed。
  const caverns = putIntoPlay(state, 'cavernsOfYoth')
  caverns.revealed = false
  caverns.clues = 0
  const api = apiFor(state)
  api.reveal('cavernsOfYoth')
  assert.equal(caverns.clues, 1 * state.numInvestigators + 3, '印刷线索（每位 1 个）+ 深度')
})

test('地点效果：坍塌的通道放毁灭、光耀峡谷的中毒伤害与望远镜行动', () => {
  const state = prepared(71, 1)
  const inv = state.investigators[0]
  const broken = putIntoPlay(state, 'brokenPassage')
  inv.location = 'brokenPassage'
  yoth.behavior.beforeExplore(state, inv, apiFor(state, {}))
  assert.equal(broken.doom, 1, '没有鹤嘴锄就放 1 点毁灭')
  const withPickaxe = prepared(71, 1)
  const broken2 = putIntoPlay(withPickaxe, 'brokenPassage')
  withPickaxe.investigators[0].location = 'brokenPassage'
  yoth.behavior.beforeExplore(withPickaxe, withPickaxe.investigators[0], apiFor(withPickaxe, { supplies: ['pickaxe'] }))
  assert.equal(broken2.doom, 0)
  // 光耀峡谷：中毒入场伤害 + 双筒望远镜行动。
  const canyon = prepared(71, 1)
  const cInv = canyon.investigators[0]
  const bright = putIntoPlay(canyon, 'brightCanyon')
  cInv.location = 'brightCanyon'
  cInv.threat.push({ id: 'poison', code: '04102' })
  yoth.behavior.locationEntered(canyon, cInv, bright, apiFor(canyon))
  assert.equal(cInv.damage, 1)
  canyon.campaign.supplies = { 0: ['binoculars'] }
  const moves = yoth.behavior.actions(canyon, cInv)
  assert.ok(moves.some(move => move.rule === 'brightCanyonClues'))
  const lensApi = apiFor(canyon, { supplies: ['binoculars'] })
  yoth.behavior.performAction(canyon, cInv, moves.find(move => move.rule === 'brightCanyonClues'), lensApi)
  assert.equal(cInv.clues, 2)
  assert.equal(bright.clues, 2 * canyon.numInvestigators - 2)
  assert.equal(yoth.behavior.actions(canyon, cInv).some(move => move.rule === 'brightCanyonClues'), false,
    '团队每深度等级一次')
})

test('地点效果：岌岌可危的悬崖三级检定，全失败则坠崖身亡', () => {
  const state = prepared(73, 1)
  const inv = state.investigators[0]
  putIntoPlay(state, 'crumblingPrecipice')
  inv.location = 'crumblingPrecipice'
  const died = apiFor(state, { outcomes: [false, false, false] })
  const allowed = yoth.behavior.beforeExplore(state, inv, died)
  assert.deepEqual(died.calls.tests.map(entry => [entry.skill, entry.difficulty]),
    [['willpower', 4], ['agility', 3], ['combat', 2]])
  assert.equal(inv.defeated, true)
  assert.equal(allowed, false)
  assert.deepEqual(died.calls.resumed, [], '全失败不恢复探索')
  const survived = prepared(73, 1)
  const lucky = survived.investigators[0]
  putIntoPlay(survived, 'crumblingPrecipice')
  lucky.location = 'crumblingPrecipice'
  const second = apiFor(survived, { outcomes: [false, true] })
  assert.equal(yoth.behavior.beforeExplore(survived, lucky, second), false, '检定链交给引擎恢复同一次探索')
  assert.deepEqual(second.calls.tests.map(entry => entry.skill), ['willpower', 'agility'], '首项失败后继续第二项')
  assert.deepEqual(second.calls.resumed, [0], '任一次检定成功就能照常探索')
  assert.notEqual(lucky.defeated, true)
})

test('敌人：伊格带 +6×人数生命且被另一个重整蛇族保护，深坑守卫按在场与否找位置', () => {
  const state = prepared(79, 2)
  // 卡面关键词：伊格只有「猎手。庞大。」，警戒/反击是给身边其他蛇族的。
  assert.equal(state.scenario.enemies['04296'].hunter, true)
  assert.equal(state.scenario.enemies['04296'].massive, true)
  assert.equal(state.scenario.enemies['04296'].alert, false)
  assert.equal(state.scenario.enemies['04296'].retaliate, false)
  const yigApi = apiFor(state)
  const yig = yigApi.spawn('04296', 'cavernsOfYoth')
  assert.equal(yig.health, 6 + 6 * 2)
  const guard = yigApi.spawn('04297', 'cavernsOfYoth')
  assert.equal(guard.alert, true, '伊格所在地点的其他蛇族获得警戒与反击')
  assert.equal(guard.retaliate, true)
  assert.equal(yoth.behavior.enemyDamageAllowed(state, yig, null, 0), false)
  guard.exhausted = true
  assert.equal(yoth.behavior.enemyDamageAllowed(state, yig, null, 0), true, '蛇族横置后伊格可以被伤害')
  // 深坑守卫：伊格不在场时进入追击区域。
  const lonely = prepared(79, 1)
  const lonelyApi = apiFor(lonely)
  assert.equal(yoth.behavior.spawnLocation(lonely, '04297', 'cavernsOfYoth', null, lonelyApi), null)
  yoth.behavior.spawnFailed(lonely, '04297', null, lonelyApi)
  assert.deepEqual(lonely.scenarioZones.pursuit, [{ code: '04297', damageTaken: 0, resources: 0 }])
  assert.equal(lonely.encounterDiscard.includes('04297'), false, '被放进追击区域而不是弃牌堆')
})

test('敌人：深渊吞噬者在随机一处放在一边的地点生成', () => {
  const state = prepared(83, 1)
  assert.equal(state.scenarioZones.locationPool.length, 4)
  const api = apiFor(state)
  const spawnAt = yoth.behavior.spawnLocation(state, '04298', 'cityOfTheSerpents', null, api)
  assert.ok(state.scenarioZones.locationPool.length === 3)
  assert.notEqual(spawnAt, 'cityOfTheSerpents')
  assert.equal(state.scenarioFlags.depthStartLocation === undefined, false)
})

test('结局：r2 写入联结点并累加复仇，r1 按深度给创伤，noResolution 走结局 1', () => {
  const state = prepared(89, 2, { yigsFury: 5 })
  state.scenarioFlags.depthLevel = 2
  state.locations = []
  state.victoryDisplay.push({ id: 'v1', vengeance: 3 })
  const city = putIntoPlay(state, 'cityOfTheSerpents')
  city.clues = 0
  const api = { addTrauma: () => {} }
  const award = yoth.behavior.resolution(state, 'r2', [], api)
  assert.equal(state.campaign.records.theNexusIsNear, true)
  assert.equal(state.campaign.records.yigsFury, 10, '怒气 5 + 胜利区复仇 3 + 万蛇之城 2')
  assert.equal(award.bonus, 2, '额外 XP = 当前深度等级')
  assert.equal(award.award, true)
  const fallen = prepared(89, 2, { yigsFury: 5 })
  fallen.scenarioFlags.depthLevel = 2
  fallen.locations = []
  const trauma = []
  yoth.behavior.resolution(fallen, 'r1', [], {
    addTrauma: (target, seat, kind, amount) => trauma.push({ seat, kind, amount }),
  })
  assert.equal(fallen.campaign.records.theInvestigatorsFellIntoTheDepths, true)
  assert.deepEqual(trauma, [{ seat: 0, kind: 'physical', amount: 2 }, { seat: 1, kind: 'physical', amount: 2 }])
  const noResolution = prepared(89, 1)
  noResolution.locations = []
  yoth.behavior.resolution(noResolution, 'noResolution', [], {})
  assert.equal(noResolution.campaign.records.theInvestigatorsFellIntoTheDepths, true)
  assert.equal(yoth.behavior.storyResolutionKey(noResolution, 'noResolution'), 'r1')
  assert.throws(() => yoth.behavior.resolution(state, 'r9', [], api))
})

test('结局：预示者进入胜利区就划掉记录，否则写回它的伤害', () => {
  const alive = prepared(97, 1, { theHarbingerIsStillAlive: 4 })
  alive.scenarioFlags.harbingerEnteredPlay = true
  alive.enemies.push({ id: 'h1', code: '04062', originalCode: '04062', damageTaken: 6, traits: ['Serpent'] })
  yoth.behavior.resolution(alive, 'r1', [], {})
  assert.equal(alive.campaign.records.theHarbingerIsStillAlive, 6)
  const beaten = prepared(97, 1, { theHarbingerIsStillAlive: 4 })
  beaten.scenarioFlags.harbingerEnteredPlay = true
  beaten.victoryDisplay.push({ id: 'h1', code: '04062', originalCode: '04062', vengeance: 5 })
  yoth.behavior.resolution(beaten, 'r1', [], {})
  assert.equal(beaten.campaign.records.theHarbingerIsStillAlive, 0, '被击败的预示者不再被记录为存活')
})

test('复仇总计：万蛇之城无线索、异端教堂有调查员时视同进入胜利区', () => {
  const state = prepared(101, 1)
  state.locations = []
  assert.equal(totalVengeance(state), 0)
  const city = putIntoPlay(state, 'cityOfTheSerpents')
  city.clues = 0
  assert.equal(totalVengeance(state), 2)
  city.clues = 1
  assert.equal(totalVengeance(state), 0)
  const hall = putIntoPlay(state, 'hallOfHeresy')
  hall.revealed = true
  state.investigators[0].location = 'cityOfTheSerpents'
  assert.equal(totalVengeance(state), 0, '教堂里没有调查员时不计复仇')
  state.investigators[0].location = 'hallOfHeresy'
  assert.equal(totalVengeance(state), 2)
  assert.equal(hall.vengeance, 2)
})

test('存档一致：同样的决策得到同样的 JSON，且状态可以完整往返', () => {
  const run = () => {
    const state = prepared(103, 2, { yigsFury: 18, theHarbingerIsStillAlive: 1 })
    const api = apiFor(state, { supplies: ['rope', 'canteen'], choose: () => 'collect' })
    state.scenarioFlags.depthLevel = 2
    yoth.behavior.agendaReveal(state, state.agendas[0], api)
    yoth.behavior.agendaReveal(state, state.agendas[1], api)
    yoth.behavior.actReveal(state, state.acts[0], api)
    return state
  }
  const first = run()
  const second = run()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同种子同决策结果一致')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored, first)
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.equal(restored.scenarioFlags.depthLevel, first.scenarioFlags.depthLevel)
  assert.deepEqual(restored.scenarioZones.pursuit, first.scenarioZones.pursuit)
})

test('剧本导入的分支记录：自行其路 → 伊塔卡敌视 + 古神标记；无小刀 → 遗物落入伊塔卡之手', () => {
  const forging = prepared(107, 1, { youAreForgingYourOwnWay: true })
  const forgingApi = apiFor(forging)
  yoth.behavior.preScenarioSetup(forging, [], forgingApi)
  yoth.behavior.afterChaosBagSetup(forging, [])
  assert.equal(forging.campaign.records.ichtacaIsSetAgainstYou, true)
  assert.equal(forging.chaosBag.filter(token => token === 'elderthing').length, 1)
  const withoutKnife = prepared(107, 1, { theInvestigatorsFoundTheMissingRelic: true })
  yoth.behavior.preScenarioSetup(withoutKnife, [], apiFor(withoutKnife))
  assert.equal(withoutKnife.campaign.records.theRelicIsMissing, true)
  assert.equal(withoutKnife.campaign.records.theInvestigatorsFoundTheMissingRelic, false)
  const withKnife = prepared(107, 1, { theInvestigatorsFoundTheMissingRelic: true })
  yoth.behavior.preScenarioSetup(withKnife, [], apiFor(withKnife, { supplies: ['pocketknife'] }))
  assert.equal(withKnife.campaign.records.theRelicIsMissing, undefined)
  const faithful = prepared(107, 1, { ichtacasFaithIsRestored: true })
  yoth.behavior.preScenarioSetup(faithful, [], apiFor(faithful))
  assert.equal(faithful.campaign.records.ichtacaIsSetAgainstYou, undefined)
})

test('探索限制：所在地点还有线索时不能探索（04285 的行动）', () => {
  const state = prepared(109, 1)
  const inv = state.investigators[0]
  const location = state.locations[0]
  location.clues = 1
  inv.location = location.id
  assert.equal(yoth.behavior.canExplore(state, inv), false)
  location.clues = 0
  assert.equal(yoth.behavior.canExplore(state, inv), true)
})

test('04299 瓦卢西亚之子：每张副本各 +1 战斗/躲避，轮末弃 1 张', () => {
  const state = stateFor(1)
  const api = apiFor(state)
  const snake = { id: 's1', code: '04297', originalCode: '04297', name: '蛇',
    location: 'cityOfTheSerpents', traits: ['Serpent'], fight: 2, evade: 2, health: 3 }
  state.enemies.push(snake)
  const card = { code: '04299', originalCode: '04299' }
  yoth.behavior.resolveEncounter(state, state.investigators[0], card, api)
  assert.equal(yoth.behavior.enemyStatModifier(state, snake, 'fight'), 1)
  yoth.behavior.resolveEncounter(state, state.investigators[0], card, api)
  assert.equal(yoth.behavior.enemyStatModifier(state, snake, 'fight'), 2, '两张副本 +2')
  assert.equal(yoth.behavior.enemyStatModifier(state, snake, 'evade'), 2)
  yoth.behavior.roundEnded(state, api)
  assert.equal(yoth.behavior.enemyStatModifier(state, snake, 'fight'), 1, '轮末弃掉 1 张')
})

test('04296 伊格光环：其他蛇族获得警戒/反击，离开后还原', () => {
  const state = stateFor(1)
  const api = apiFor(state)
  const yig = { id: 'yig', code: '04296', originalCode: '04296', name: '伊格',
    location: 'cityOfTheSerpents', traits: ['Ancient One', 'Serpent', 'Elite'], health: 20, damageTaken: 0, exhausted: false }
  const snake = { id: 's1', code: '04297', originalCode: '04297', name: '蛇',
    location: 'cityOfTheSerpents', traits: ['Serpent'], alert: false, retaliate: false }
  state.enemies.push(yig, snake)
  yoth.behavior.enemySpawned(state, yig, api)
  assert.equal(snake.alert, true)
  assert.equal(snake.retaliate, true)
  snake.location = 'cavernsOfYoth'
  yoth.behavior.enemyMoved(state, snake, api)
  assert.equal(snake.alert, false, '离开伊格后还原')
  assert.equal(snake.retaliate, false)
})

test('04284 复仇：神话「检查毁灭阈值」后按场上毁灭数追加遭遇', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  const agenda = state.agendas.find(entry => (entry.originalCode || entry.code) === '04284')
  state.agendas = [agenda]
  state.agendaIndex = 0
  state.doom = 2
  state.locations.push({ id: 'l1', code: '04290', originalCode: '04290', doom: 1 })
  yoth.behavior.mythosDoomChecked(state, api)
  assert.equal(api.calls.drawn.length, 3, '密谋 2 + 地点 1 = 3 张')
})

test('04277 结局 1 深度 1：调查员在战役记录里阵亡，战役结束', () => {
  const state = stateFor(2)
  const api = apiFor(state)
  state.scenarioFlags.depthLevel = 1
  yoth.behavior.resolution(state, 'r1', [], api)
  assert.ok(state.investigators.every(inv => inv.defeated))
  for (const record of state.campaign.investigators) assert.equal(record.status, 'killed')
  assert.equal(state.campaign.failed, true)
})

test('04286 幽嘶的阶梯：可选反应，划不掉绳索就不加深度', () => {
  const state = stateFor(1)
  state.scenarioFlags.depthLevel = 2
  state.locations.push({ id: 'stepsOfYoth', code: '04286', originalCode: '04286', revealed: true, clues: 0 })
  state.investigators[0].location = 'stepsOfYoth'
  state.investigators[0].clues = 5
  const skip = apiFor(state, { supplies: ['rope'], choose: () => 'skip' })
  assert.equal(yoth.behavior.incrementDepth(state, skip), 3, '选择不使用只 +1')
  assert.equal(skip.calls.crossedOff.length, 0)

  const fail = apiFor(state, { supplies: ['rope'], choose: () => 'use' })
  fail.crossOffSupply = () => false
  assert.equal(yoth.behavior.incrementDepth(state, fail), 4, '划不掉时也不额外 +1')

  const ok = apiFor(state, { supplies: ['rope'], choose: () => 'use' })
  assert.equal(yoth.behavior.incrementDepth(state, ok), 6, '先 +1 再额外 +1')
  assert.deepEqual(ok.calls.crossedOff, [{ seat: 0, name: 'rope' }])
})

test('04287/04288 视同胜利区：计入 04292 帷幕与旧神标记', () => {
  const state = stateFor(1)
  state.scenarioFlags.depthLevel = 2
  state.locations.push(
    { id: 'cityOfTheSerpents', code: '04287', originalCode: '04287', revealed: true, clues: 0, vengeance: 2 },
    { id: 'hallOfHeresy', code: '04288', originalCode: '04288', revealed: true, clues: 1, vengeance: 2 },
    { id: 'bridge', code: '04292', originalCode: '04292', revealed: true, clues: 0 })
  state.investigators[0].location = 'hallOfHeresy'
  assert.equal(totalVengeance(state), 4)
  const bridge = state.locations.find(entry => entry.id === 'bridge')
  assert.equal(yoth.behavior.locationShroudModifier(state, bridge), 4, '04292 帷幕用视同胜利区合计')
  state.investigators[0].location = 'cityOfTheSerpents'
  state.locations.find(entry => entry.id === 'cityOfTheSerpents').clues = 1
  assert.equal(totalVengeance(state), 0)
})

test('04289 岌岌可危的悬崖：三次失败 = 阵亡并写进战役记录', () => {
  const state = stateFor(1)
  state.locations.push({ id: 'crumblingPrecipice', code: '04289', originalCode: '04289', revealed: true, clues: 1 })
  const inv = state.investigators[0]
  inv.location = 'crumblingPrecipice'
  const api = apiFor(state, { outcomes: [false, false, false] })
  yoth.behavior.beforeExplore(state, inv, api)
  assert.equal(inv.defeated, true)
  assert.equal(inv.defeatCause, 'killed')
  assert.equal(state.campaign.investigators[0].status, 'killed')
  assert.equal(api.calls.trauma.length, 0, '不折算成创伤')
  assert.deepEqual(api.calls.resumed, [], '全失败不恢复探索')
})

// ---------------------------------------------------------------------------
// 04289 真实引擎验收：beforeExplore 的检定链 + api.resumeExplore（P2-6）。
// 手搭 api 的用例只证明“链怎么走”，这里证明真实 performTest/doExplore 里
// “检定 → 回调 → 同一次探索继续”整条链真的能跑完且行动只付一次。
// ---------------------------------------------------------------------------

function settleChoices(state) {
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

function launchYothPrecipice(seed) {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theDepthsOfYoth'), [])
  settleChoices(state)
  // 用引擎的 placeLocation 入场，实例带上定义里的符号连接（探索连接限制读它）。
  placeLocation(state, 'crumblingPrecipice', [], 0)
  const precipice = state.locations.find(location => location.id === 'crumblingPrecipice')
  precipice.revealed = true
  precipice.clues = 0
  precipice.maxClues = 0
  const inv = state.investigators[0]
  inv.actionsLeft = 3
  inv.location = 'crumblingPrecipice'
  // 悬崖的符号连接里有桥（heart），从悬崖探索不会触发「不相连」拦截。
  state.explorationDeck = ['bridgeOverNKai']
  return state
}

function exploreAtPrecipice(state) {
  const explore = legalMoves(state, 0).find(move => move.action === 'explore')
  assert.ok(explore, '探索应出现在合法行动里')
  applyMove(state, 0, explore)
  settleChoices(state)
}

test('04289 真实引擎：检定通过 → 同一次探索继续，行动只付一次', () => {
  const state = launchYothPrecipice('tfa-precipice-success')
  const before = state.investigators[0]
  before.willpower = 20; before.agility = 20; before.combat = 20; before.intellect = 20
  state.chaosBag = ['0', '0', '0']
  exploreAtPrecipice(state)
  const inv = state.investigators[0]
  assert.equal(inv.location, 'bridgeOverNKai', '检定通过后照常放置并移动')
  assert.equal(state.locations.some(location => location.id === 'bridgeOverNKai'), true)
  assert.equal(state.explorationDeck.length, 0)
  assert.equal(inv.actionsLeft, 2, '整条链只消耗 1 个探索行动')
  assert.notEqual(inv.defeated, true)
})

test('04289 真实引擎：首项失败 → 继续第二项，成功后恢复探索', () => {
  const state = launchYothPrecipice('tfa-precipice-chain')
  const before = state.investigators[0]
  // 意志 0：任何标记都失败；敏捷 20：任何标记都成功。链应停在第二项。
  before.willpower = 0; before.agility = 20; before.combat = 20
  state.chaosBag = ['0', '-8', '0']
  exploreAtPrecipice(state)
  const inv = state.investigators[0]
  assert.notEqual(inv.defeated, true)
  assert.equal(inv.location, 'bridgeOverNKai', '第二项检定成功后继续同一次探索')
  assert.equal(inv.actionsLeft, 2, '多次检定不额外扣行动')
})

test('04289 真实引擎：三次失败 → 坠崖身亡且不放置地点', () => {
  const state = launchYothPrecipice('tfa-precipice-death')
  const before = state.investigators[0]
  before.willpower = 0; before.agility = 0; before.combat = 0
  state.chaosBag = ['0', '0', '0']
  const deckBefore = state.explorationDeck.length
  exploreAtPrecipice(state)
  const inv = state.investigators[0]
  assert.equal(inv.defeated, true)
  assert.equal(inv.defeatCause, 'killed')
  assert.equal(state.campaign.investigators[0].status, 'killed', '引擎统一写战役记录状态')
  assert.equal(state.explorationDeck.length, deckBefore, '未进行探索放置')
  assert.equal(inv.location, 'crumblingPrecipice')
  assert.equal(inv.actionsLeft, 2, '尝试探索仍消耗 1 个行动')
})

test('04285 探索只能放置与当前地点相连的地点', () => {
  const state = stateFor(1)
  const placed = yoth.behavior.exploreConnects(state, 'forkedPath', 'cityOfTheSerpents')
  assert.equal(placed, true, '城市与分岔路相连')
  assert.equal(yoth.behavior.exploreConnects(state, 'forkedPath', 'cavernsOfYoth'), false, '洞群不与分岔路相连')
  assert.equal(yoth.behavior.exploreConnects(state, 'unknown', 'cavernsOfYoth'), true, '未知起点不拦截')
})

test('04277 深度 2：每位幸存调查员获得一张基础伤势弱点', () => {
  const state = prepared(89, 2)
  state.scenarioFlags.depthLevel = 2
  state.locations = []
  state.victoryDisplay = []
  yoth.behavior.resolution(state, 'r1', [], { addTrauma: () => {}, random: () => 0, info: () => {} })
  for (const record of state.campaign.investigators) {
    const injury = record.deck.find(code => (ALL_CARDS[code]?.traits || []).includes('Injury'))
    assert.ok(injury, '获得一张伤势弱点')
  }
})

test('04284 目标是「每位调查员被击败」；04280 侦查员自己选战斗或敏捷', () => {
  const agenda = definition.agendas.find(entry => entry.originalCode === '04284')
  assert.deepEqual(agenda.objective, { type: 'allDefeated' })
  const state = prepared(3, 2)
  const answers = ['1', 'agility']
  const tests = []
  yoth.behavior.agendaReveal(state, { originalCode: '04280', code: '04280' }, {
    info: () => {},
    checkSupplies: () => false,
    choose: () => answers.shift(),
    test: (seat, skill, difficulty) => tests.push({ seat, skill, difficulty }),
    trauma: () => {},
  })
  assert.deepEqual(tests.map(entry => [entry.skill, entry.difficulty]), [['agility', 5]])
})

test('04295 光耀峡谷：没有双筒望远镜不显示行动；04294 帷幕按深度显示', () => {
  const state = prepared(5, 1)
  const inv = state.investigators[0]
  putIntoPlay(state, 'brightCanyon')
  inv.location = 'brightCanyon'
  state.campaign.supplies = { 0: [] }
  assert.equal(yoth.behavior.actions(state, inv).some(move => move.rule === 'brightCanyonClues'), false)
  state.campaign.supplies = { 0: ['binoculars'] }
  assert.equal(yoth.behavior.actions(state, inv).some(move => move.rule === 'brightCanyonClues'), true)
  state.scenarioFlags.depthLevel = 3
  const site = { id: 'abandonedSite', originalCode: '04294', code: '04294', name: '被遗弃的仪式场所', shroud: -2, clues: 1 }
  state.locations.push(site)
  assert.equal(yoth.behavior.locationShroudModifier(state, site), 3)
})

test('粘稠物换钥匙：多人持有时由队长选择', () => {
  const state = prepared(91, 2, { yigsFury: 0 })
  state.scenarioFlags.collectedAStrangeLiquid = true
  state.campaign.supplies = { 0: ['stickyGoop'], 1: ['stickyGoop'] }
  state.locations = []
  const answers = []
  yoth.behavior.resolution(state, 'r2', [], {
    info: () => {},
    choose: request => { answers.push(request.kind); return '1' },
  })
  assert.deepEqual(answers, ['investigator'])
  assert.ok(state.campaign.supplies[1].includes('keyOfEztli'))
  assert.equal(state.campaign.supplies[0].includes('keyOfEztli'), false)
})

test('找回了遗物：幽嘶深渊开局把「重拾往昔」版古代遗物交给领队', () => {
  const state = prepared(93, 1, { theInvestigatorsRecoveredTheRelicOfAges: true })
  const inv = state.investigators[0]
  assert.ok(inv.assets.some(asset => asset.code === '04303'), '遗物作为资产在场')
  assert.equal(state.scenarioZones.setAside.includes('04303'), false)
  assert.equal(state.relicOfAges.code, '04303')
  assert.equal(state.relicOfAges.seat, inv.seat)
  const missing = prepared(93, 1, { theRelicIsMissing: true })
  assert.equal(missing.investigators[0].assets.some(asset => asset.code === '04303'), false)
  assert.ok(missing.scenarioZones.setAside.includes('04303'))
})
