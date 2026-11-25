// 验收测试：04-a 失落时代 · 战役与剩余卡 · 分片 3（tdoy 27 + hote 26）
// 规程见 docs/test/ACCEPTANCE-ORDER.md。每个用例标题含卡号，逐卡给出真实断言：
// 只调用内容层行为钩子、单卡条目、遭遇条目与内容层数据（不写空断言、不重复只断言「条目存在」）。
import test from 'node:test'
import assert from 'node:assert/strict'

// 引擎是唯一装配点：import 它之前不会注册能力条目、注入修正读点。
import '../src/engine/engine.js'
import { nonPlayerEntryFor } from '../src/cards/encounter-abilities.js'
import { locationRuleFor } from '../src/cards/card-rules.js'
import * as part1 from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/index.js'
import { scenario as def1 } from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/definition.js'
import * as part2 from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/index.js'
import {
  scenario as def2, EXPLORATION_LOCATIONS as P2_LOCATIONS,
} from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/definition.js'
import * as yoth from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/index.js'
import { scenario as defY } from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/definition.js'
import { placePursuitEnemies } from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js'
import relicOfAges from '../src/cards/entries/04303.js'

const clone = value => structuredClone(value)
const original = card => card?.originalCode || card?.code

function seededRandom(seed = 1) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function setupApi(seed = 1) {
  const randomValue = seededRandom(seed)
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

function baseState(definition, count, startLocation) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: startLocation,
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
    explorationDiscard: [],
    removedFromGame: [],
    campaign: {
      leadSeat: 0,
      records: {},
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
    doom: 0,
  }
}

function addLocation(state, definition, id, extra = {}) {
  if (state.locations.some(location => location.id === id)) return state.locations.find(location => location.id === id)
  const location = {
    id, ...clone(definition.locations[id]), revealed: true, clues: 0, connections: [], doom: 0, ...extra,
  }
  state.locations.push(location)
  return location
}

const agendaOf = (state, code) => state.agendas.find(agenda => original(agenda) === code)

function supplyApi(state) {
  const has = (seat, name) => ((state.campaign.supplies || {})[seat] || []).includes(name)
  return {
    hasSupply: has,
    checkSupplies: (seat, name) => has(seat, name),
  }
}

// ---------------------------------------------------------------------------
// 久远腹地（上）fixture：只桩行为钩子真正用到的 api。
// ---------------------------------------------------------------------------

function p1State(count = 2) {
  return baseState(def1, count, 'mouthOfKnyan')
}

function p1Api(state, options = {}) {
  const calls = {
    info: [], spawned: [], damage: [], horror: [], tests: [], lostActions: [], endedTurns: [],
    discardedHand: [], discardedAssets: [], paidClues: [], finished: [], poisoned: [], attacks: [],
  }
  const api = {
    calls,
    ...supplyApi(state),
    info: text => calls.info.push(text),
    random: options.random || seededRandom(3),
    shuffleDiscard: () => { calls.shuffledDiscard = true },
    choose: request => (options.choose ? options.choose(request) : (request.options?.[0]?.id ?? 'skip')),
    cardName: code => code,
    test: (seat, skill, difficulty, resolve) => {
      calls.tests.push({ seat, skill, difficulty })
      const success = options.test ? options.test({ seat, skill, difficulty }) : true
      resolve({
        success, value: success ? difficulty + 1 : (options.value ?? 0), difficulty, skill,
        drawn: options.drawn || [], cancelledTokens: [],
      })
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push([seat, amount]) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push([seat, amount]) },
    loseActions: (seat, amount) => {
      state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount)
      calls.lostActions.push([seat, amount])
    },
    endTurn: seat => { state.investigators[seat].turnEnded = true; calls.endedTurns.push(seat) },
    resign: seat => { state.investigators[seat].resigned = true },
    spawn: (code, location) => {
      const enemy = { id: `e${state.enemies.length + 1}`, code, originalCode: code, location, damageTaken: 0, engagedSeat: null }
      state.enemies.push(enemy)
      calls.spawned.push({ code, location })
      return enemy
    },
    discardUntilEnemy: () => options.enemyCode ?? null,
    discardRandom: seat => {
      const inv = state.investigators[seat]
      if (inv.hand.length) inv.hand.pop()
      calls.discardedHand.push(seat)
    },
    discardAsset: (seat, id) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== id)
      calls.discardedAssets.push(id)
    },
    canDiscardAsset: () => true,
    payClues: (count, locationId) => {
      let remaining = count
      for (const inv of state.investigators.filter(entry => !entry.defeated && !entry.resigned
        && (!locationId || entry.location === locationId))) {
        const pay = Math.min(remaining, inv.clues)
        inv.clues -= pay
        remaining -= pay
      }
      if (remaining > 0) throw new Error('线索不足')
      calls.paidClues.push(count)
    },
    advanceAct: () => { calls.advanced = (calls.advanced || 0) + 1; options.advanceAct?.(api) },
    finish: key => calls.finished.push(key),
    poison: seat => {
      const inv = state.investigators[seat]
      if ((inv.threat || []).some(card => original(card) === '04102')) return false
      inv.threat.push({ id: `poison-${seat}`, code: '04102', originalCode: '04102' })
      calls.poisoned.push(seat)
      return true
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    remove: id => { state.locations = state.locations.filter(location => location.id !== id) },
    place: id => {
      if (!state.locations.some(location => location.id === id)) {
        state.locations.push({ id, ...clone(def1.locations[id]), revealed: true, clues: 0, connections: [] })
      }
    },
    reveal: () => {},
  }
  return api
}

// ---------------------------------------------------------------------------
// 久远腹地（下）fixture
// ---------------------------------------------------------------------------

const P2_PLACED = ['mouthOfKnYan', ...P2_LOCATIONS]

function p2State(count = 2) {
  return baseState(def2, count, 'mouthOfKnYan')
}

function p2Placed(state, ids = P2_PLACED) {
  state.locations = ids.map(id => {
    const clues = (state.scenario.locations[id].cluesPerInvestigator || 0) * state.numInvestigators
    return { ...clone(state.scenario.locations[id]), id, revealed: true, clues, maxClues: clues, attachments: [] }
  })
  return state
}

function p2Api(state, options = {}) {
  const calls = {
    info: [], damage: [], horror: [], draws: [], spawned: [], moved: [], poisoned: [],
    tests: [], finished: [], removed: [],
  }
  const api = {
    calls,
    ...supplyApi(state),
    info: text => calls.info.push(text),
    random: options.random || seededRandom(7),
    choose: request => (options.choose ? options.choose(request) : (request.options?.[0]?.id ?? '0')),
    drawEncounter: seat => calls.draws.push(seat),
    spawn: (code, location) => {
      const enemy = { id: `e${state.enemies.length + 1}`, code, originalCode: code, location, damageTaken: 0, engagedSeat: null }
      state.enemies.push(enemy)
      calls.spawned.push({ code, location })
      return enemy
    },
    damage: (seat, amount) => {
      state.investigators[seat].damage += amount
      calls.damage.push([seat, amount])
    },
    horror: (seat, amount) => {
      state.investigators[seat].horror += amount
      calls.horror.push([seat, amount])
    },
    poison: seat => {
      const inv = state.investigators[seat]
      inv.threat.push({ id: `poison-${seat}`, code: '04102', originalCode: '04102' })
      calls.poisoned.push(seat)
      return true
    },
    remove: id => {
      calls.removed.push(id)
      state.locations = state.locations.filter(location => location.id !== id)
    },
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      calls.moved.push(['inv', seat, destination])
    },
    moveEnemy: (enemy, destination) => {
      enemy.location = destination
      calls.moved.push(['enemy', enemy.id, destination])
    },
    trauma: (seat, kind, amount) => { calls.trauma = [...(calls.trauma || []), [seat, kind, amount]] },
    defeat: (inv, cause) => { inv.defeated = true; inv.defeatCause = cause ?? null },
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      calls.tests.push({ seat, skill, difficulty, source })
      const success = options.test ? options.test({ seat, skill, difficulty }) : true
      resolve({ success, value: success ? difficulty + 1 : (options.value ?? 0), difficulty, skill, drawn: [] })
    },
    finish: key => calls.finished.push(key),
    advanceAct: () => { options.advanceAct?.() },
    play: code => calls.played = [...(calls.played || []), code],
  }
  return api
}

// ---------------------------------------------------------------------------
// 幽嘶深渊 fixture
// ---------------------------------------------------------------------------

function yState(count = 2, records = {}) {
  const state = baseState(defY, count, 'cityOfTheSerpents')
  state.campaign.records = { ...records }
  state.campaign.supplies = Object.fromEntries(Array.from({ length: count }, (_, seat) => [seat, []]))
  delete state.doom
  return state
}

function yLocationInstance(state, id) {
  const definition = state.scenario.locations[id]
  const clues = (definition.cluesPerInvestigator || 0) * state.numInvestigators
  return { ...clone(definition), id, revealed: false, clues: 0, maxClues: clues, doom: 0, connections: [] }
}

function yPutIntoPlay(state, id) {
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  const location = yLocationInstance(state, id)
  location.revealed = true
  location.clues = location.maxClues
  state.locations.push(location)
  return location
}

function yApi(state, options = {}) {
  const calls = {
    spawned: [], drawn: [], finished: [], placed: [], removed: [], moved: [], defeated: [],
    damage: [], horror: [], trauma: [], tests: [], info: [], crossedOff: [], attacked: [], resumed: [],
  }
  const supplies = new Set(options.supplies || [])
  const outcomes = [...(options.outcomes || [])]
  const api = {
    calls,
    info: text => calls.info.push(text),
    random: options.random || (() => 0.37),
    choose: request => (options.choose ? options.choose(request) : (request.options?.[0]?.id ?? 'skip')),
    hasSupply: (seat, name) => supplies.has(name) || ((state.campaign.supplies || {})[seat] || []).includes(name),
    checkSupplies: (seat, name) => supplies.has(name) || ((state.campaign.supplies || {})[seat] || []).includes(name),
    crossOffSupply: (seat, name) => { calls.crossedOff.push({ seat, name }); supplies.delete(name) },
    place: id => {
      calls.placed.push(id)
      if (!state.locations.some(location => location.id === id)) state.locations.push(yLocationInstance(state, id))
    },
    reveal: id => {
      const location = state.locations.find(entry => entry.id === id)
      if (!location || location.revealed) return
      location.revealed = true
      location.clues = location.maxClues ?? 0
      yoth.behavior.locationRevealed(state, location, api)
    },
    remove: id => { calls.removed.push(id); state.locations = state.locations.filter(location => location.id !== id) },
    spawn: (code, location) => {
      const definition = state.scenario.enemies?.[code] || {}
      const enemy = {
        id: `enemy-${(state.enemySeq = (state.enemySeq || 0) + 1)}`,
        code, originalCode: code, name: definition.name || code, location,
        damageTaken: 0, exhausted: false, engagedSeat: null,
        fight: definition.fight || 0, evade: definition.evade || 0,
        health: definition.health || 1, damage: definition.damage || 0, horror: definition.horror || 0,
        traits: [...(definition.traits || [])],
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
    },
    resumeExplore: seat => calls.resumed.push(seat),
    moveInvestigator: (seat, destination) => {
      calls.moved.push({ seat, destination })
      state.investigators[seat].location = destination
    },
    drawEncounter: seat => calls.drawn.push(seat),
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    finish: key => calls.finished.push(key),
    test: (seat, skill, difficulty, resolve) => {
      calls.tests.push({ seat, skill, difficulty })
      const success = outcomes.length ? outcomes.shift() : true
      resolve({
        success, value: success ? difficulty + 1 : Math.max(0, difficulty - 1),
        difficulty, skill, drawn: [], cancelledTokens: [],
      })
    },
  }
  return api
}

function yPrepared(seed = 1, count = 2, records = {}) {
  const state = yState(count, records)
  const helper = setupApi(seed)
  const placed = yoth.behavior.setupLocations(state, [], helper)
  yoth.behavior.setupEnemies(state, [], { ...helper, info: () => {}, locName: id => id })
  yoth.behavior.afterDeckSetup(state, [], { info: () => {} })
  for (const id of placed) yPutIntoPlay(state, id)
  return state
}

// ===========================================================================
// 久远腹地（上）：04207 / 04208 / 04210 / 04215 / 04216 / 04217 / 04219 / 04220 / 04221
// ===========================================================================

test('04207 丛林之心：没有双筒望远镜的瞭望员弃牌直到敌人并生成在其所在地点', () => {
  const state = p1State(2)
  addLocation(state, def1, 'mouthOfKnyan')
  addLocation(state, def1, 'pathOfThorns')
  state.investigators[0].location = 'pathOfThorns'
  state.investigators[1].location = 'mouthOfKnyan'
  state.encounterDeck = ['04081', '04078']
  const api = p1Api(state, { enemyCode: '04078', choose: () => '0' })
  part1.behavior.agendaReveal(state, agendaOf(state, '04207'), api)
  assert.equal(api.calls.shuffledDiscard, true, '先把遭遇弃牌堆洗回遭遇牌库')
  assert.deepEqual(api.calls.spawned, [{ code: '04078', location: 'pathOfThorns' }])
  // 瞭望员带双筒望远镜时不受影响。
  const safe = p1State(2)
  addLocation(safe, def1, 'mouthOfKnyan')
  addLocation(safe, def1, 'pathOfThorns')
  safe.investigators[0].location = 'pathOfThorns'
  safe.campaign.supplies[0] = ['binoculars']
  const safeApi = p1Api(safe, { enemyCode: '04078', choose: () => '0' })
  part1.behavior.agendaReveal(safe, agendaOf(safe, '04207'), safeApi)
  assert.equal(safeApi.calls.spawned.length, 0)
})

test('04208 夕阳：背面让每位幸存调查员立即撤退', () => {
  const state = p1State(2)
  state.investigators[1].defeated = true
  const api = p1Api(state)
  part1.behavior.agendaReveal(state, agendaOf(state, '04208'), api)
  assert.equal(state.investigators[0].resigned, true)
  assert.equal(state.investigators[1].resigned, undefined, '已阵亡的调查员不再撤退')
})

test('04210 张开巨口：共同花费 1×人数线索放置石柱标记，第 6 个后推进到结局 1', () => {
  const state = p1State(2)
  state.actIndex = 1
  const mouth = addLocation(state, def1, 'mouthOfKnyan')
  for (const inv of state.investigators) { inv.location = 'mouthOfKnyan'; inv.clues = 1 }
  state.scenarioFlags.pillars = 5
  let api
  api = p1Api(state, {
    advanceAct: () => part1.behavior.actReveal(state, state.acts[state.actIndex], api),
  })
  part1.behavior.performAction(state, state.investigators[0], { rule: 'solvePillar' }, api)
  assert.equal(state.scenarioFlags.pillars, 6, '第 6 个石柱标记')
  assert.equal(mouth.resources, 1, '标记以「资源」形式放在昆扬之口上')
  assert.equal(state.investigators[0].clues, 0, '线索由队伍共同支付')
  assert.equal(state.investigators[1].clues, 0)
  part1.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanced, 1)
  assert.deepEqual(api.calls.finished, ['r1'], '04210 背面 → 结局 1')
})

test('04215 落入陷阱：可从遭遇牌库洗回探索牌库，从探索牌库抽出时只能检定敏捷(3)', () => {
  const state = p1State(1)
  addLocation(state, def1, 'mouthOfKnyan')
  const inv = state.investigators[0]
  inv.location = 'mouthOfKnyan'
  const api = p1Api(state, { choose: () => 'shuffle' })
  const handled = part1.behavior.resolveEncounter(state, inv, { code: '04215', originalCode: '04215' }, api)
  assert.equal(handled.placed, true)
  assert.equal(state.explorationDeck.includes('04215'), true, '洗回探索牌库')
  assert.equal(api.calls.tests.length, 0, '选择洗回时不检定')
  // 从探索牌库抽出：不能选择洗回，必须检定，失败每低于难度 1 点受 1 点伤害。
  const drawn = p1State(1)
  addLocation(drawn, def1, 'mouthOfKnyan')
  drawn.scenarioFlags.exploreDrawPending = true
  const drawnApi = p1Api(drawn, { choose: () => 'shuffle', test: () => false, value: 1 })
  part1.behavior.resolveEncounter(drawn, drawn.investigators[0], { code: '04215', originalCode: '04215' }, drawnApi)
  assert.deepEqual(drawnApi.calls.tests, [{ seat: 0, skill: 'agility', difficulty: 3 }])
  assert.equal(drawn.investigators[0].damage, 2, '失败 2 点差额 = 2 点伤害')
})

test('04216 有毒孢子：附属地点，轮末中毒者受 2 恐惧、未中毒者放进中毒弱点并弃掉本卡', () => {
  const state = p1State(2)
  const location = addLocation(state, def1, 'pathOfThorns')
  state.investigators[0].threat.push({ id: 'poison-0', code: '04102', originalCode: '04102' })
  for (const inv of state.investigators) inv.location = 'pathOfThorns'
  const api = p1Api(state)
  part1.behavior.resolveEncounter(state, state.investigators[0], { code: '04216', originalCode: '04216' }, api)
  assert.equal(location.attachments.length, 1)
  assert.equal(original(location.attachments[0]), '04216')
  part1.behavior.roundEnded(state, api)
  assert.equal(state.investigators[0].horror, 2, '中毒者受到 2 点恐惧')
  assert.equal(state.investigators[1].threat.some(card => original(card) === '04102'), true, '未中毒者获得中毒弱点')
  assert.equal(location.attachments.length, 0, '结算后弃掉有毒孢子')
  assert.equal(state.encounterDiscard.includes('04216'), true)
})

test('04217 错时林地：花 2 个行动把胜利区带复仇的非精英卡放进遭遇弃牌堆（每场游戏一次）', () => {
  const state = p1State(1)
  addLocation(state, def1, 'timeWrackedWoods')
  const inv = state.investigators[0]
  inv.location = 'timeWrackedWoods'
  const moves = part1.behavior.actions(state, inv)
  const expel = moves.find(move => move.rule === 'expelVengeance')
  assert.ok(expel, '地点提供行动')
  assert.equal(expel.actions, 2)
  state.victoryDisplay = [{ id: 'v1', code: '04220', originalCode: '04220', vengeance: 2 }]
  const api = p1Api(state, { choose: () => 'v1' })
  part1.behavior.performAction(state, inv, { rule: 'expelVengeance' }, api)
  assert.equal(state.victoryDisplay.length, 0)
  assert.equal(state.encounterDiscard.includes('04220'), true)
  assert.equal(state.scenarioFlags.timeWrackedWoodsUsed, true)
  assert.throws(() => part1.behavior.performAction(state, inv, { rule: 'expelVengeance' }, api), /每场游戏仅限一次/)
})

test('04219 绝命噬藤：借机攻击后没有折叠小刀就失去所有行动并结束回合', () => {
  const state = p1State(1)
  const inv = state.investigators[0]
  const api = p1Api(state)
  part1.behavior.enemyAttackResolved(state, { code: '04219', originalCode: '04219' }, inv, api, { kind: 'opportunity' })
  assert.equal(inv.actionsLeft, 0)
  assert.deepEqual(api.calls.endedTurns, [0])
  // 有折叠小刀时不触发。
  const armed = p1State(1)
  armed.campaign.supplies[0] = ['pocketknife']
  const armedApi = p1Api(armed)
  part1.behavior.enemyAttackResolved(armed, { code: '04219', originalCode: '04219' }, armed.investigators[0], armedApi, { kind: 'opportunity' })
  assert.equal(armed.investigators[0].actionsLeft, 3)
  assert.deepEqual(armedApi.calls.endedTurns, [])
  // 普通（非借机）攻击不触发。
  const normal = p1State(1)
  const normalApi = p1Api(normal)
  part1.behavior.enemyAttackResolved(normal, { code: '04219', originalCode: '04219' }, normal.investigators[0], normalApi, { kind: 'enemy' })
  assert.deepEqual(normalApi.calls.endedTurns, [])
})

test('04220 蛇怪：石柱标记放到昆扬之口后把一张蛇怪洗入遭遇牌库（每轮最多一次）', () => {
  const state = p1State(2)
  state.actIndex = 1
  addLocation(state, def1, 'mouthOfKnyan')
  for (const inv of state.investigators) { inv.location = 'mouthOfKnyan'; inv.clues = 1 }
  state.enemies.push({ id: 'b1', code: '04220', originalCode: '04220', location: 'mouthOfKnyan', traits: ['Serpent'] })
  state.encounterDiscard = ['04220']
  const api = p1Api(state)
  part1.behavior.performAction(state, state.investigators[0], { rule: 'solvePillar' }, api)
  assert.equal(state.encounterDeck.filter(code => code === '04220').length, 1, '洗回一张蛇怪')
  assert.equal(state.encounterDiscard.includes('04220'), false, '从遭遇弃牌堆取走')
  assert.equal(state.scenarioFlags.basiliskRound, state.round)
  // 同一轮第二个石柱标记不再触发。
  for (const inv of state.investigators) inv.clues = 1
  part1.behavior.performAction(state, state.investigators[0], { rule: 'solvePillar' }, api)
  assert.equal(state.encounterDeck.filter(code => code === '04220').length, 1, '每轮最多一次')
})

test('04221 蚁群缠身：敏捷(4)失败每低于难度 1 点随机弃手牌或选择弃游戏区卡牌', () => {
  const state = p1State(1)
  addLocation(state, def1, 'mouthOfKnyan')
  const inv = state.investigators[0]
  inv.location = 'mouthOfKnyan'
  inv.hand = ['01025', '01026', '01027']
  const api = p1Api(state, { test: () => false, value: 2, choose: () => 'hand' })
  part1.behavior.resolveEncounter(state, inv, { code: '04221', originalCode: '04221' }, api)
  assert.deepEqual(api.calls.tests, [{ seat: 0, skill: 'agility', difficulty: 4 }])
  assert.equal(inv.hand.length, 1, '失败 2 点 = 弃 2 张手牌')
  assert.equal(api.calls.discardedHand.length, 2)
})

// ===========================================================================
// 久远腹地（下）：04206b / 04211 / 04213 / 04223 / 04225 / 04226 / 04228
// ===========================================================================

test('04206b 昆扬之口（深藏其下）：带地图查看探索牌库顶 2 张，弃掉诡计并混洗探索牌库', () => {
  const state = p2Placed(p2State(1))
  const inv = state.investigators[0]
  inv.location = 'mouthOfKnYan'
  state.campaign.supplies[0] = ['map']
  state.explorationDeck = ['vastPassages', '04215']
  const moves = part2.behavior.actions(state, inv)
  assert.equal(moves.some(move => move.rule === 'scoutDepths'), true)
  const api = p2Api(state)
  part2.behavior.performAction(state, inv, { rule: 'scoutDepths' }, api)
  assert.equal(state.encounterDiscard.includes('04215'), true, '顶上的诡计被弃掉')
  assert.equal(state.explorationDeck.includes('04215'), false)
  assert.equal(state.explorationDeck.includes('vastPassages'), true, '地点留在探索牌库')
  // 没有地图时行动不产生效果。
  const noMap = p2Placed(p2State(1))
  noMap.investigators[0].location = 'mouthOfKnYan'
  noMap.explorationDeck = ['vastPassages', '04215']
  part2.behavior.performAction(noMap, noMap.investigators[0], { rule: 'scoutDepths' }, p2Api(noMap))
  assert.equal(noMap.encounterDiscard.includes('04215'), false)
})

test('04211 孤独的洞穴群：推进时不移除地点毁灭，背面让预示者带伤出现在最远地点', () => {
  const state = p2Placed(p2State(2), [...P2_PLACED, 'descentToYoth'])
  part2.behavior.setupLocations(state, [], setupApi(7))
  state.campaign.records.theHarbingerIsStillAlive = 6
  const api = p2Api(state)
  part2.behavior.agendaReveal(state, agendaOf(state, '04211'), api)
  assert.equal(api.calls.spawned.length, 1)
  const harbinger = state.enemies[0]
  assert.equal(original(harbinger), '04062')
  assert.equal(harbinger.location, 'descentToYoth', '距离所有调查员最远的地点')
  assert.equal(harbinger.damageTaken, 6, '按剧本日志括号内的伤害入场')
  // 「推进时不移除地点毁灭」的引擎读点由条目字段声明（src/engine/act-agenda.js clearDoomInPlay）。
  assert.equal(nonPlayerEntryFor('04211').doomKeptOnAgendaAdvance, 'locations')
})

test('04213 失落时代的洞穴（背面）：没带粉笔时每个地点 +1 线索，并把侦查员所在地点洗回探索牌库', () => {
  const state = p2Placed(p2State(2))
  part2.behavior.setupLocations(state, [], setupApi(13))
  for (const inv of state.investigators) inv.location = 'crystalPillars'
  state.enemies.push({ id: 'e1', code: '04083', originalCode: '04083', location: 'crystalPillars', engagedSeat: null })
  const before = new Map(state.locations.map(location => [location.id, location.clues]))
  const api = p2Api(state)
  part2.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.explorationDeck.includes('04227'), true, '深入幽嘶洗入探索牌库')
  assert.equal(state.scenarioZones.setAside.includes('04227'), false)
  for (const location of state.locations) {
    if (location.id === 'mouthOfKnYan' || location.id === 'crystalPillars') continue
    assert.equal(location.clues, before.get(location.id) + 1, `${location.id} 各 +1 线索`)
  }
  assert.equal(state.locations.some(location => location.id === 'crystalPillars'), false, '单面地点被洗回')
  assert.equal(state.explorationDeck.includes('crystalPillars'), true)
  const destination = state.investigators[0].location
  assert.equal(state.investigators[1].location, destination, '队伍一起后退')
  assert.equal(state.enemies[0].location, destination, '敌人一起后退')
  const mouth = state.locations.find(location => location.id === 'mouthOfKnYan')
  assert.equal(mouth.connections.includes(destination), true, '退到与昆扬之口相连的地点')
})

test('04223 崇拜礼堂：探索成功入场后按「伊格之怒」勾数抽 0／1／2 张遭遇', () => {
  const drawFor = fury => {
    const state = p2Placed(p2State(2))
    part2.behavior.setupLocations(state, [], setupApi(3))
    state.campaign.records.yigsFury = fury
    const api = p2Api(state)
    part2.behavior.afterExplore(state, state.investigators[0],
      { code: 'hallOfIdolatry', kind: 'location', runtime: api })
    return api.calls.draws.length
  }
  assert.equal(drawFor(4), 0)
  assert.equal(drawFor(5), 1)
  assert.equal(drawFor(10), 2)
})

test('04225 危险峡谷：调查检定失败且无人带绳索时放 1 毁灭', () => {
  const state = p2Placed(p2State(1))
  part2.behavior.setupLocations(state, [], setupApi(1))
  const inv = state.investigators[0]
  inv.location = 'perilousGulch'
  const location = state.locations.find(entry => entry.id === 'perilousGulch')
  const result = { success: false, value: 1, difficulty: 4, skill: 'intellect', source: { label: '调查' } }
  part2.behavior.afterTest(state, inv, result, p2Api(state))
  assert.equal(location.doom, 1)
  // 有人带绳索时不放毁灭。
  const roped = p2Placed(p2State(1))
  part2.behavior.setupLocations(roped, [], setupApi(1))
  roped.investigators[0].location = 'perilousGulch'
  roped.campaign.supplies[0] = ['rope']
  const ropedLocation = roped.locations.find(entry => entry.id === 'perilousGulch')
  part2.behavior.afterTest(roped, roped.investigators[0], result, p2Api(roped))
  assert.equal(ropedLocation.doom || 0, 0)
  // 调查成功时不触发。
  const ok = p2Placed(p2State(1))
  part2.behavior.setupLocations(ok, [], setupApi(1))
  ok.investigators[0].location = 'perilousGulch'
  part2.behavior.afterTest(ok, ok.investigators[0], { ...result, success: true }, p2Api(ok))
  assert.equal(ok.locations.find(entry => entry.id === 'perilousGulch').doom || 0, 0)
})

test('04226 晶体柱群：进入后检定意志(1+胜利区复仇)，失败受到 1 伤害和 1 恐惧', () => {
  const state = p2Placed(p2State(1))
  part2.behavior.setupLocations(state, [], setupApi(1))
  state.victoryDisplay = [{ id: 'v1', vengeance: 3 }]
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === 'crystalPillars')
  const api = p2Api(state, { test: () => false })
  part2.behavior.locationEntered(state, inv, location, api)
  assert.deepEqual(api.calls.tests.map(entry => [entry.skill, entry.difficulty]), [['willpower', 4]])
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
})

test('04228 无路可退：附属地点不能进出，检定战斗(3)或带鹤嘴锄可弃掉', () => {
  const state = p2Placed(p2State(1))
  part2.behavior.setupLocations(state, [], setupApi(1))
  const inv = state.investigators[0]
  inv.location = 'vastPassages'
  const api = p2Api(state)
  part2.behavior.resolveEncounter(state, inv, { code: '04228', originalCode: '04228' }, api)
  const location = state.locations.find(entry => entry.id === 'vastPassages')
  assert.equal(location.attachments.length, 1)
  assert.equal(original(location.attachments[0]), '04228')
  assert.match(part2.behavior.movementError(state, inv), /无路可退/)
  assert.match(part2.behavior.investigatorEntryError(state, location, inv), /无路可退/)
  const moves = part2.behavior.encounterActions(state, inv)
  assert.equal(moves.some(move => move.rule === 'clearNoTurningBack'), true)
  // 带鹤嘴锄直接弃掉。
  state.campaign.supplies[0] = ['pickaxe']
  const clearApi = p2Api(state)
  const cleared = part2.behavior.performEncounterAction(state, inv,
    { rule: 'clearNoTurningBack', attachmentId: location.attachments[0].id, locationId: 'vastPassages' }, clearApi)
  assert.equal(cleared, true)
  assert.equal(location.attachments.length, 0)
  assert.equal(state.encounterDiscard.includes('04228'), true)
  assert.equal(part2.behavior.movementError(state, inv), null)
})

// ===========================================================================
// 幽嘶深渊：04278 / 04279 / 04281 / 04283 / 04290 / 04291 / 04293 / 04297 / 04298 / 04300 / 04301 / 04302
// ===========================================================================

test('04278 开始下降：密谋推进时把躲避值最高的追击敌人放到本层起点', () => {
  const state = yPrepared(37, 2)
  state.scenarioFlags.depthStartLocation = 'cavernsOfYoth'
  state.scenarioFlags.depthLevel = 2
  yPutIntoPlay(state, 'cavernsOfYoth')
  state.scenarioZones.pursuit = [
    { code: '04297', damageTaken: 1, resources: 0 },
    { code: '04298', damageTaken: 0, resources: 0 },
  ]
  const api = yApi(state)
  yoth.behavior.agendaReveal(state, agendaOf(state, '04278'), api)
  assert.deepEqual(api.calls.spawned, [{ code: '04298', location: 'cavernsOfYoth' }])
  assert.equal(state.scenarioZones.pursuit.length, 1, '只放出 1 名')
  assert.equal(state.scenarioZones.pursuit[0].code, '04297')
})

test('04279 恐惧渐生：带水壶的调查员决定把「收集了一种奇怪的液体」记进剧本日志', () => {
  const collect = yPrepared(43, 1, { yigsFury: 9 })
  collect.campaign.supplies[0] = ['canteen']
  yoth.behavior.agendaReveal(collect, agendaOf(collect, '04279'), yApi(collect, { choose: () => 'collect' }))
  assert.equal(collect.scenarioFlags.collectedAStrangeLiquid, true)
  const refuse = yPrepared(43, 1, { yigsFury: 9 })
  refuse.campaign.supplies[0] = ['canteen']
  yoth.behavior.agendaReveal(refuse, agendaOf(refuse, '04279'), yApi(refuse, { choose: () => 'leave' }))
  assert.equal(refuse.scenarioFlags.collectedAStrangeLiquid, false)
  // 没人带水壶时不询问、不记录。
  const dry = yPrepared(43, 1, { yigsFury: 9 })
  yoth.behavior.agendaReveal(dry, agendaOf(dry, '04279'), yApi(dry, { choose: () => 'collect' }))
  assert.equal(dry.scenarioFlags.collectedAStrangeLiquid, false)
})

test('04281 血色城市：把放在一边的预示者移进追击区域后按卡面放出', () => {
  const state = yPrepared(41, 2, { yigsFury: 6, theHarbingerIsStillAlive: 4 })
  assert.deepEqual(state.scenarioZones.harbingerAside, { code: '04062', damageTaken: 4, resources: 0 })
  const api = yApi(state)
  yoth.behavior.agendaReveal(state, agendaOf(state, '04281'), api)
  assert.equal(state.scenarioZones.harbingerAside, undefined, '离开「放在一边」')
  assert.deepEqual(api.calls.spawned, [{ code: '04062', location: state.scenarioFlags.depthStartLocation }])
  assert.equal(state.enemies.find(enemy => original(enemy) === '04062').damageTaken, 4)
})

test('04283 赤红深渊：背面留下逐次强迫效果，推进后每次放毁灭都放出追击敌人', () => {
  const state = yPrepared(47, 2, { yigsFury: 21 })
  assert.equal(original(state.agendas[state.agendaIndex]), '04283')
  state.scenarioZones.pursuit = []
  const api = yApi(state)
  yoth.behavior.agendaReveal(state, agendaOf(state, '04283'), api)
  assert.equal(state.scenarioFlags.redDepthsOngoing, true)
  assert.deepEqual(state.scenarioZones.pursuitReminders, ['04283'])
  // 推进到 04284 后，每次在当前密谋上放毁灭都放 1 名追击敌人。
  state.agendaIndex = 1
  state.scenarioZones.pursuit = [{ code: '04297', damageTaken: 0, resources: 0 }]
  const doomApi = yApi(state)
  yoth.behavior.doomPlaced(state, { agenda: true, amount: 1 }, doomApi)
  assert.deepEqual(doomApi.calls.spawned, [{ code: '04297', location: state.scenarioFlags.depthStartLocation }])
})

test('04290 幽嘶洞群：入场后按当前深度等级放置线索', () => {
  const state = yState(1)
  state.scenarioFlags.depthLevel = 3
  const location = { id: 'cavernsOfYoth', code: '04290', originalCode: '04290', clues: 0 }
  const api = yApi(state)
  yoth.behavior.locationRevealed(state, location, api)
  assert.equal(location.clues, 3)
  state.scenarioFlags.depthLevel = 5
  yoth.behavior.locationRevealed(state, location, api)
  assert.equal(location.clues, 8, '再次触发按当时深度叠加（强制效果逐次结算）')
})

test('04291 分岔路：带地图探索时继续抽到两处连接地点并选择移动', () => {
  const state = yState(1)
  const inv = state.investigators[0]
  inv.location = 'forkedPath'
  state.scenario.locations.forkedPath.connections = ['cavernsOfYoth', 'abandonedSite']
  state.locations = [{
    id: 'forkedPath', ...clone(state.scenario.locations.forkedPath), revealed: true, clues: 0,
    connections: ['cavernsOfYoth', 'abandonedSite'],
  }]
  inv.tfaExploreFrom = 'forkedPath'
  state.explorationDeck = ['cavernsOfYoth', 'abandonedSite']
  const api = yApi(state, { supplies: ['map'], choose: request => request.options[0].id })
  yoth.behavior.afterExplore(state, inv, { kind: 'blocked', runtime: api })
  const placed = state.locations.filter(location => location.id !== 'forkedPath').map(location => location.id)
  assert.deepEqual(placed.sort(), ['abandonedSite', 'cavernsOfYoth'])
  assert.equal(inv.location, 'abandonedSite', '两处都入场，移动到选择的其中一处')
})

test('04293 坍塌的通道：没有鹤嘴锄时尝试探索在本地点放 1 毁灭', () => {
  const build = supplies => {
    const state = yState(1)
    const inv = state.investigators[0]
    inv.location = 'brokenPassage'
    const location = { ...clone(state.scenario.locations.brokenPassage), id: 'brokenPassage', clues: 0, doom: 0, connections: [] }
    state.locations = [location]
    const api = yApi(state, { supplies })
    const handled = locationRuleFor('04293').beforeExplore(state, inv, api)
    return { location, handled, state }
  }
  const bare = build([])
  assert.equal(bare.handled, true, '仍继续本次探索')
  assert.equal(bare.location.doom, 1)
  const armed = build(['pickaxe'])
  assert.equal(armed.location.doom, 0, '带鹤嘴锄不放毁灭')
})

test('04297 深坑守卫：伊格在场时生成在伊格所在地点，否则放入追击区域', () => {
  const state = yPrepared(3, 2)
  const api = yApi(state)
  state.enemies.push({ id: 'yig', code: '04296', originalCode: '04296', location: 'cityOfTheSerpents', exhausted: true, traits: ['Serpent'] })
  assert.equal(yoth.behavior.spawnLocation(state, '04297', 'bridgeOverNKai', null, api), 'cityOfTheSerpents')
  const lonely = yPrepared(3, 2)
  const lonelyApi = yApi(lonely)
  assert.equal(yoth.behavior.spawnLocation(lonely, '04297', 'bridgeOverNKai', null, lonelyApi), null)
  lonely.encounterDiscard.push('04297')
  yoth.behavior.spawnFailed(lonely, '04297', null, lonelyApi)
  assert.deepEqual(lonely.scenarioZones.pursuit, [{ code: '04297', damageTaken: 0, resources: 0 }])
  assert.equal(lonely.encounterDiscard.includes('04297'), false, '放进追击区域而不是弃牌堆')
})

test('04298 深渊吞噬者：随机一处放在一边的地点入场并在那里生成，躲避值按深度', () => {
  const state = yPrepared(7, 2)
  state.scenarioFlags.depthLevel = 3
  const pool = [...state.scenarioZones.locationPool]
  const api = yApi(state)
  const spawnAt = yoth.behavior.spawnLocation(state, '04298', 'cityOfTheSerpents', null, api)
  assert.equal(pool.includes(spawnAt), true, '从「放在一边」的地点中随机取一处')
  assert.equal(state.locations.some(location => location.id === spawnAt), true, '该地点被放入场')
  assert.equal(state.scenarioZones.locationPool.includes(spawnAt), false, '离开放在一边区')
  const eater = { id: 'eater', code: '04298', originalCode: '04298', traits: ['Serpent'] }
  assert.equal(yoth.behavior.enemyStatModifier(state, eater, 'evade'), 3, '躲避值 = 印刷值 0 + 当前深度 3')
})

test('04300 无光之影：显现检定敏捷(1+深度)，失败受到 2 点伤害', () => {
  const state = yState(1)
  state.scenarioFlags.depthLevel = 4
  const inv = state.investigators[0]
  const api = yApi(state, { outcomes: [false] })
  const entry = nonPlayerEntryFor('04300')
  entry.encounterResolve(state, inv, { code: '04300' }, api)
  assert.deepEqual(api.calls.tests, [{ seat: 0, skill: 'agility', difficulty: 5 }])
  assert.equal(inv.damage, 2)
  assert.equal(inv.horror, 0)
})

test('04301 深渊恐惧症：显现检定意志(1+深度)，失败受到 2 点恐惧', () => {
  const state = yState(1)
  state.scenarioFlags.depthLevel = 4
  const inv = state.investigators[0]
  const api = yApi(state, { outcomes: [false] })
  const entry = nonPlayerEntryFor('04301')
  entry.encounterResolve(state, inv, { code: '04301' }, api)
  assert.deepEqual(api.calls.tests, [{ seat: 0, skill: 'willpower', difficulty: 5 }])
  assert.equal(inv.horror, 2)
  assert.equal(inv.damage, 0)
})

test('04302 蛇族的愤怒：追击区无蛇族时涌动；否则拉出攻击值最高的蛇族交战并检定敏捷', () => {
  const base = yPrepared(11, 2)
  const surgeApi = yApi(base)
  base.scenarioZones.pursuit = []
  nonPlayerEntryFor('04302').encounterResolve(base, base.investigators[0], { code: '04302' }, surgeApi)
  assert.deepEqual(surgeApi.calls.drawn, [0], '没有蛇族在追击：获得涌动（抽 1 张遭遇）')
  // 有蛇族在追击：拽出攻击值最高者并交战。
  const state = yPrepared(11, 2)
  state.scenarioZones.pursuit = [
    { code: '04297', damageTaken: 1, resources: 0 },
    { code: '04078', damageTaken: 0, resources: 0 },
  ]
  const api = yApi(state, { outcomes: [false] })
  nonPlayerEntryFor('04302').encounterResolve(state, state.investigators[0], { code: '04302' }, api)
  const spawned = state.enemies[0]
  const definition = state.scenario.enemies[spawned.code]
  assert.equal(spawned.engagedSeat, 0, '与抽到它的调查员交战')
  assert.equal(state.scenarioZones.pursuit.length, 1, '追击区少一张')
  assert.equal(api.calls.tests.at(-1).skill, 'agility')
  assert.equal(api.calls.tests.at(-1).difficulty, definition.fight, '难度 = 该敌人攻击值')
  assert.equal(api.calls.attacked.length, 1, '失败后该敌人立即攻击你')
})

test('04303 古代遗物：横置检定意志/智识(4)，成功移除 1 个毁灭，每场游戏最多成功一次', () => {
  const state = {
    doom: 1,
    scenarioFlags: {},
    investigators: [{ seat: 0, name: '调查员', assets: [] }],
    locations: [{ id: 'l1', name: '地点', doom: 2 }],
    enemies: [],
  }
  const calls = { tests: [], removedDoom: 0 }
  const api = {
    choice: request => request.options[0].id,
    startTest: ({ seat, skill, difficulty, resolve }) => {
      calls.tests.push({ seat, skill, difficulty })
      resolve({ success: true, value: difficulty + 1 })
    },
    info: () => {},
    cardName: code => code,
    removeDoom: n => { calls.removedDoom += n; state.doom -= n },
    removeDoomFromCard: (card, n) => { card.doom -= n },
  }
  relicOfAges.abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.deepEqual(calls.tests, [{ seat: 0, skill: 'willpower', difficulty: 4 }])
  assert.equal(calls.removedDoom, 1, '选择密谋上的毁灭标记并移除 1 个')
  assert.equal(state.doom, 0)
  assert.equal(state.scenarioFlags.relicOfAgesDoomSucceeded, true)
  // 每场游戏最多成功一次：再次结算不再开检定。
  relicOfAges.abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.equal(calls.tests.length, 1)
  assert.equal(relicOfAges.scenarioPlayable, true, '剧情资产可在战役牌组中打出')
})
