import test from 'node:test'
import assert from 'node:assert/strict'
import * as chapter from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/index.js'
import {
  scenario as definition, PRESENT_LOCATIONS, ANCIENT_LOCATIONS,
} from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/definition.js'
import { implementedEncounterCodes } from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js'
import { symbolConnections } from '../content/campaigns/theForgottenAge/card-data.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const { behavior } = chapter
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

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'zocalo',
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
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
      supplies: {},
    },
    chaosBag: [],
    difficulty: 'standard',
    doom: 0,
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function syncConnections(state) {
  const wanted = symbolConnections(state.locations)
  for (const location of state.locations) location.connections = [...(wanted[location.id] || [])]
}

function placeAll(state) {
  state.locations = Object.keys(PRESENT_LOCATIONS).map(id => {
    const card = state.scenario.locations[id]
    const clues = card.cluesFixed ?? (card.cluesPerInvestigator || 0) * state.numInvestigators
    return { ...clone(card), id, revealed: true, clues, maxClues: clues }
  })
  syncConnections(state)
  return state
}

// 与行为钩子等价的「换面」：把古代卡面盖到格位上，并把现代卡面压进 underneath。
function forceShift(state, slotId, ancientId) {
  const index = state.locations.findIndex(location => location.id === slotId)
  const current = state.locations[index]
  const ancient = state.scenario.locations[ancientId]
  const clues = (ancient.cluesPerInvestigator || 0) * state.numInvestigators
  state.locations[index] = {
    ...clone(ancient),
    id: slotId,
    revealed: true,
    clues,
    maxClues: clues,
    doom: current.doom || 0,
    underneath: [{ ...clone(current), underneath: [] }],
  }
  syncConnections(state)
}

function chapterState(count = 2, seed = 7) {
  const state = stateFor(count)
  behavior.setupLocations(state, [], setupApi(seed))
  placeAll(state)
  return state
}

function makeApi(state, options = {}) {
  const calls = {
    info: [], tests: [], spawns: [], choices: [], encounters: [], madness: [], frozen: false,
  }
  let value = (options.seed || 3) >>> 0
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  const api = {
    calls,
    info: text => calls.info.push(text),
    random,
    choose(request) {
      calls.choices.push(request)
      if (!request?.options?.length) throw new Error('选择没有选项')
      if (options.choose) {
        const picked = options.choose(request)
        if (picked !== undefined && request.options.some(option => option.id === picked)) return picked
      }
      return request.options[options.lastOption ? request.options.length - 1 : 0].id
    },
    spawn(code, location) {
      const card = ALL_CARDS[code] || {}
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.nameZh || card.name || code, traits: [...(card.traits || [])],
        location, health: card.health ?? 1, damageTaken: 0, exhausted: false, doom: 0, vengeance: 0,
      }
      state.enemies.push(enemy)
      calls.spawns.push({ code, location })
      return enemy
    },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directDamage: (seat, n) => { state.investigators[seat].damage += n; calls.direct = (calls.direct || 0) + n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n; calls.direct = (calls.direct || 0) + n },
    gainClues: (seat, n) => { state.investigators[seat].clues = (state.investigators[seat].clues || 0) + n },
    discardRandom: (seat, n) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < n && inv.hand.length; index++) {
        const at = Math.floor(random() * inv.hand.length)
        inv.discard.push(inv.hand.splice(at, 1)[0])
      }
    },
    discardTop: (seat, n) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < n && inv.deck.length; index++) inv.discard.push(inv.deck.pop())
    },
    loseActions: (seat, n) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - n) },
    doomOn: (card, amount = 1) => {
      if (!card) return 0
      card.doom = (card.doom || 0) + amount
      return amount
    },
    addDoom: n => { state.doom = (state.doom || 0) + n },
    drawCards: (seat, n) => { calls.drawn = (calls.drawn || 0) + n },
    drawEncounter: seat => {
      const code = state.encounterDeck.pop()
      if (!code) return
      state.encounterDiscard.push(code)
      calls.encounters.push({ seat, code })
    },
    test(seat, skill, difficulty, resolve) {
      calls.tests.push({ seat, skill, difficulty })
      const success = options.testSuccess !== false
      resolve({ success, value: difficulty + (success ? 1 : -2), difficulty, skill, drawn: [] })
    },
    poison: seat => {
      state.investigators[seat].threat.push({ id: `poison-${seat}`, code: '04102' })
      calls.poisoned = (calls.poisoned || 0) + 1
    },
    crossOffSupply: (seat, name) => {
      const list = state.campaign.supplies?.[seat] || []
      const index = list.indexOf(name)
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    moveRelicOfAges: payload => { state.relicOfAges = { ...payload } },
    drawMadnessWeakness: seat => calls.madness.push(seat),
    // 04165 现在走「从收藏随机获得基础弱点」的引擎 api。
    addBasicWeakness: (seat, traits) => calls.madness.push(seat),
    advanceAct: () => {
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      behavior.actReveal(state, act, api)
    },
    advanceAgenda: () => {
      const agenda = state.agendas[state.agendaIndex]
      state.agendaIndex += 1
      behavior.agendaReveal(state, agenda, api)
    },
    finish: key => { calls.finish = key },
  }
  return api
}

const locationOf = (state, id) => state.locations.find(location => location.id === id)

// ---------------------------------------------------------------------------

test('界限彼端 M5：章节已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.catalogReferenceOnly, undefined)
  assert.equal(chapter.manifest.referenceCode, undefined)
  assert.equal(chapter.scenario.originalCode, '04161')
  assert.equal(chapter.manifest.locations.length, 18, '6 张现代 + 12 张古代地点各一个 id')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
  assert.deepEqual(chapter.manifest.requiredMechanicIds, ['tfaSupplies', 'tfaVengeance', 'tfaRelicOfAges'])
  // 同一个 code 只登记一次地点
  const codes = Object.values(definition.locations).map(card => card.originalCode)
  assert.equal(new Set(codes).size, codes.length)
})

test('符号地图：现代与古代各自按印刷符号连线', () => {
  const card = id => definition.locations[id]
  const sorted = list => [...list].sort()
  // 现代：索卡洛广场（菱形）与其它四个符号相连，但不与三角形相连。
  assert.deepEqual(sorted(card('zocalo').connections),
    sorted(['templeRuins', 'metropolitanCathedral', 'xochimilco', 'coyoacan']))
  assert.deepEqual(card('metropolitanCathedral').connections, ['zocalo'])
  assert.equal(card('templeRuins').connections.includes('metropolitanCathedral'), false)
  // 古代：大神庙（圆形）连到两张神庙与两张山丘，但两张大神庙彼此不相连。
  assert.deepEqual(sorted(card('temploMayor174').connections), sorted([
    'templesOfTenochtitlan176', 'templesOfTenochtitlan177', 'chapultepecHill178', 'chapultepecHill179',
  ]))
  assert.equal(card('temploMayor174').connections.includes('temploMayor175'), false)
  // 两张同符号的古代地点符号相同、连线相同（只是卡面数值不同）。
  assert.equal(card('temploMayor174').symbols.front.symbol, card('temploMayor175').symbols.front.symbol)
  assert.equal(chapter.layout.locations.temploMayor174.x, chapter.layout.locations.templeRuins.x)
})

test('布置：6 个现代格位、16 张探索牌库、放在一边的牌与当前牌库', () => {
  const state = stateFor()
  const ids = behavior.setupLocations(state, [], setupApi(11))
  assert.deepEqual(ids, Object.keys(PRESENT_LOCATIONS))
  assert.equal(state.explorationDeck.length, 16)
  const ancients = state.explorationDeck.filter(entry => Object.hasOwn(ANCIENT_LOCATIONS, entry))
  assert.equal(ancients.length, 12)
  assert.deepEqual([...ancients].sort(), Object.keys(ANCIENT_LOCATIONS).sort())
  assert.deepEqual(state.explorationDeck.filter(entry => !Object.hasOwn(ANCIENT_LOCATIONS, entry)).sort(),
    ['04090', '04091', '04189', '04190'])
  assert.equal(state.acts.length, 2, '场景 3a 放在一边')
  assert.equal(state.agendas.length, 2, '密谋 3a 放在一边')
  assert.equal(state.scenarioZones.setAside.filter(code => code === '04102').length, 4)
  for (const code of ['04186', '04167', '04164']) assert.ok(state.scenarioZones.setAside.includes(code), code)
  assert.equal(state.scenarioZones.setAside.includes('04062'), false, '预示者还活着时才放在一边')
  // 同样种子得到同样的探索牌库；不同种子不同。
  const again = stateFor()
  behavior.setupLocations(again, [], setupApi(11))
  const other = stateFor()
  behavior.setupLocations(other, [], setupApi(12))
  assert.deepEqual(state.explorationDeck, again.explorationDeck)
  assert.notDeepEqual(state.explorationDeck, other.explorationDeck)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  assert.deepEqual(restored.scenarioZones.setAside, state.scenarioZones.setAside)
})

test('探索：符号不符的地点先放一旁，抽到同符号的古代地点后覆盖格位', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  inv.hand = ['01016', '01006'] // 费用 4 + 3，用于支付索卡洛广场的探索代价
  state.explorationDeck = ['canalsOfTenochtitlan180', 'lakeXochimilco182']
  const api = makeApi(state)
  const moves = behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule), ['exploreHere'])
  behavior.performAction(state, inv, moves[0], api)
  const slot = locationOf(state, 'zocalo')
  assert.equal(slot.originalCode, '04180')
  assert.equal(slot.name, '特诺奇蒂特兰运河')
  assert.equal(slot.clues, 1 * state.numInvestigators)
  assert.equal(slot.underneath.length, 1)
  assert.equal(slot.underneath[0].originalCode, '04171', '现代卡面被压在下层')
  // 古代地点的连接规则：运河（菱形）只印了心形与方形，所以不再和三角形相连，
  // 但对方若印了菱形仍算相连（符号连线双向包含任一即可）。
  assert.deepEqual([...slot.connections].sort(),
    ['coyoacan', 'metropolitanCathedral', 'templeRuins', 'xochimilco'])
  assert.equal(slot.connections.includes('chapultepecPark'), false, '三角形与菱形没有共同的印刷符号')
  // 放一旁的霍奇米尔科湖洗回探索牌库；抽到的那张已离场。
  assert.equal(state.explorationDeck.length, 1)
  assert.ok(state.explorationDeck.includes('lakeXochimilco182'))
  assert.equal(state.explorationDeck.includes('canalsOfTenochtitlan180'), false)
  assert.equal(inv.hand.length, 0, '索卡洛广场弃掉了费用合计 5 的手牌')
  assert.deepEqual(inv.discard.sort(), ['01006', '01016'])
  assert.equal(inv.tfaExploredThisTurn, true)
})

test('探索抽到诡计：按遭遇牌结算，不算成功的探索', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  inv.hand = ['01016', '01006']
  state.explorationDeck = ['04190']
  const api = makeApi(state)
  behavior.performAction(state, inv, { rule: 'exploreHere' }, api)
  assert.deepEqual(api.calls.encounters, [{ seat: 0, code: '04190' }])
  assert.equal(state.explorationDeck.length, 0)
  assert.equal(locationOf(state, 'zocalo').originalCode, '04171', '格位仍是现代地点')
  assert.equal(locationOf(state, 'zocalo').underneath, undefined)
  assert.equal(state.scenarioFlags.ancientPlacerSeat, undefined)
})

test('地点行动：神庙遗迹要 2 个行动，大教堂要先有 6 张手牌，科约阿坎要受伤', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  inv.location = 'templeRuins'
  assert.equal(behavior.actions(state, inv)[0].actions, 2)
  inv.location = 'metropolitanCathedral'
  inv.hand = ['01006', '01006', '01006', '01006', '01006']
  const available = () => behavior.actions(state, inv).filter(move => !move.reason).map(move => move.rule)
  assert.deepEqual(available(), ['studyCathedral'])
  assert.equal(behavior.actions(state, inv).find(move => move.rule === 'exploreHere')?.reason,
    '需要至少 6 张手牌（当前 5 张）', '手牌不足时给出缺口')
  inv.hand.push('01006')
  assert.deepEqual(available(), ['exploreHere', 'studyCathedral'])
  const study = behavior.actions(state, inv).find(move => move.rule === 'studyCathedral')
  const api = makeApi(state)
  behavior.performAction(state, inv, study, api)
  assert.equal(inv.horror, 1)
  assert.equal(api.calls.drawn, 2)
  // 科约阿坎区：受到 1 点伤害或 1 点恐惧后探索。
  inv.location = 'coyoacan'
  state.explorationDeck = ['04174']
  behavior.performAction(state, inv, { rule: 'exploreHere' }, makeApi(state, { choose: () => 'horror' }))
  assert.equal(inv.horror, 2)
  // 霍奇米尔科不能获得资源。
  inv.location = 'xochimilco'
  assert.equal(behavior.canGainResources(state, inv), false)
})

test('场景 1 推进：刚换上古代地点的调查员检定意志 4，失败则抽一张基础弱点', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  state.scenarioFlags.ancientPlacerSeat = 1
  const api = makeApi(state, { testSuccess: false })
  behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 1)
  assert.deepEqual(api.calls.tests, [{ seat: 1, skill: 'willpower', difficulty: 4 }])
  assert.deepEqual(api.calls.madness, [1])
  assert.equal(state.scenarioFlags.firstAncientPlaced, true)
})

test('场景 2 推进：特诺奇蒂特兰地点进胜利区、换图、生成帕德玛并换上密谋 3', () => {
  const state = chapterState()
  const first = ['temploMayor174', 'templesOfTenochtitlan176', 'chapultepecHill178',
    'canalsOfTenochtitlan180', 'lakeXochimilco182', 'sacredWoods184']
  const second = ['temploMayor175', 'templesOfTenochtitlan177', 'chapultepecHill179',
    'canalsOfTenochtitlan181', 'lakeXochimilco183', 'sacredWoods185']
  const slots = Object.keys(PRESENT_LOCATIONS)
  slots.forEach((slotId, index) => forceShift(state, slotId, first[index]))
  for (const location of state.locations) location.clues = 0
  state.explorationDeck = [...second]
  state.actIndex = 1
  const api = makeApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2)
  assert.equal(state.acts[2].originalCode, '04167')
  assert.equal(state.victoryDisplay.filter(card => card.traits.includes('Tenochtitlán')).length, 6)
  // 现代地点回来了，又被探索牌库里剩下的 6 张古代地点覆盖。
  assert.deepEqual(state.locations.map(location => location.originalCode).sort(), [...second].map(id =>
    definition.locations[id].originalCode).sort())
  assert.equal(state.locations.every(location => location.underneath.length === 1), true)
  // 场景 2b 的背面同时把密谋 3a 换成当前密谋。
  assert.equal(state.agendaIndex, 2)
  assert.equal(state.agendas[2].originalCode, '04164')
  const padma = state.enemies.find(enemy => enemy.originalCode === '04186')
  assert.ok(padma, '帕德玛在大神庙生成')
  assert.equal(padma.health, 3 * state.numInvestigators)
  assert.equal(padma.location, 'templeRuins', '圆形格位就是大神庙')
  assert.equal(state.investigators.every(inv => inv.clues === 0), true, '每位调查员失去所有线索')
})

test('场景 3：击败帕德玛后推进；结局 1 与记录写入', () => {
  const state = chapterState()
  state.acts = [...state.acts.slice(0, 2), clone(definition.acts[2])]
  state.actIndex = 2
  state.scenarioFlags.padmaSpawned = true
  const api = makeApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.finish, 'r1')
  assert.equal(state.acts[2].objective.perInvestigator, 2)
  assert.equal(state.acts[2].objective.atLocation, 'templeRuins')
})

test('密谋 1 背面：预示者还活着时在离所有调查员最远的地点生成并带上记录伤害', () => {
  const state = chapterState()
  state.campaign.records.theHarbingerIsStillAlive = 3
  state.campaign.records.yigsFury = 0
  const api = makeApi(state)
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.deepEqual(api.calls.spawns, [{ code: '04062', location: 'chapultepecPark' }])
  const harbinger = state.enemies[0]
  assert.equal(harbinger.damageTaken, 3)
  assert.equal(state.scenarioFlags.harbingerEnteredPlay, true)
  // 没有记录时这一面没有效果。
  const quiet = chapterState()
  const quietApi = makeApi(quiet)
  behavior.agendaReveal(quiet, quiet.agendas[0], quietApi)
  assert.deepEqual(quietApi.calls.spawns, [])
})

test('密谋 2 背面：只有没有线索的古代地点进胜利区，场景 3 进入场', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  forceShift(state, 'coyoacan', 'sacredWoods184')
  forceShift(state, 'templeRuins', 'temploMayor174')
  for (const slot of ['zocalo', 'coyoacan']) locationOf(state, slot).clues = 0
  locationOf(state, 'templeRuins').clues = 1
  state.explorationDeck = ['temploMayor175', 'canalsOfTenochtitlan181', 'sacredWoods185',
    'templesOfTenochtitlan176', 'templesOfTenochtitlan177', 'chapultepecHill178',
    'chapultepecHill179', 'lakeXochimilco182', 'lakeXochimilco183']
  state.agendaIndex = 1
  const api = makeApi(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.victoryDisplay.length, 2, '带线索的大神庙留在场上')
  assert.equal(state.agendaIndex, 1, '引擎负责把 agendaIndex 加到 2')
  assert.equal(state.agendas[2].originalCode, '04164')
  // 密谋 2b 的背面同时把场景 3a 变成当前场景。
  assert.equal(state.actIndex, 2)
  assert.equal(state.acts[2].originalCode, '04167')
  assert.equal(state.locations.every(location => location.underneath.length === 1), true)
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '04186'))
})

test('密谋 3 背面 → 结局 2', () => {
  const state = chapterState()
  state.agendas = [...state.agendas.slice(0, 2), clone(definition.agendas[2])]
  state.agendaIndex = 2
  const api = makeApi(state)
  behavior.agendaReveal(state, state.agendas[2], api)
  assert.equal(api.calls.finish, 'r2')
})

test('异时空之窗：把古代地点洗回探索牌库，现代地点重新就位', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  const api = makeApi(state, { choose: request => request.options.find(option => option.id === 'zocalo')?.id })
  const placed = behavior.resolveEncounter(state, state.investigators[0], state.scenario.treacheries['04189'], api)
  assert.equal(placed, false)
  assert.equal(locationOf(state, 'zocalo').originalCode, '04171')
  assert.ok(state.explorationDeck.includes('canalsOfTenochtitlan180'))
  assert.equal(state.doom, 0)
  // 另一选项：在密谋上放置 1 点毁灭。
  const doomed = chapterState()
  const doomApi = makeApi(doomed, { choose: () => 'doom' })
  behavior.resolveEncounter(doomed, doomed.investigators[0], doomed.scenario.treacheries['04189'], doomApi)
  assert.equal(doomed.doom, 1)
})

test('时间线失稳：难度 = 1 + 古代地点数，失败受到 1 伤害 1 恐惧并洗回探索牌库', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  forceShift(state, 'coyoacan', 'sacredWoods184')
  const inv = state.investigators[0]
  const api = makeApi(state, { testSuccess: false })
  const handled = behavior.resolveEncounter(state, inv, state.scenario.treacheries['04190'], api)
  assert.equal(handled, true, '洗回探索牌库的诡计不进遭遇弃牌堆')
  assert.deepEqual(api.calls.tests, [{ seat: 0, skill: 'willpower', difficulty: 3 }])
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  assert.ok(state.explorationDeck.includes('04190'))
})

test('帕德玛与兄弟会之手：重整时封锁古代地点的线索与所在地点的行动', () => {
  const state = chapterState()
  forceShift(state, 'coyoacan', 'sacredWoods184')
  const inv = state.investigators[0]
  const padma = makeApi(state).spawn('04186', 'coyoacan')
  inv.location = 'coyoacan'
  assert.equal(behavior.canDiscoverClues(state, inv), false)
  padma.exhausted = true
  assert.equal(behavior.canDiscoverClues(state, inv), true)
  // 不是古代地点时不受帕德玛限制。
  inv.location = 'zocalo'
  padma.exhausted = false
  assert.equal(behavior.canDiscoverClues(state, inv), true)
  // 兄弟会之手：所在地点与连接地点的行动能力不能触发。
  const hand = makeApi(state).spawn('04188', 'zocalo')
  inv.location = 'zocalo'
  inv.hand = ['01016', '01006']
  assert.deepEqual(behavior.actions(state, inv), [])
  hand.exhausted = true
  assert.deepEqual(behavior.actions(state, inv).map(move => move.rule), ['exploreHere'])
  // 古代地点的最后一个线索被发现后，重整的兄弟会之手放置 1 点毁灭。
  hand.exhausted = false
  locationOf(state, 'coyoacan').clues = 0
  behavior.cluesRemoved(state, locationOf(state, 'coyoacan'), 1, makeApi(state))
  assert.equal(hand.doom, 1)
})

test('特诺奇蒂特兰恶蛇：古代地点有线索时获得反击与警戒，否则获得猎手', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  const enemy = makeApi(state).spawn('04187', 'zocalo')
  behavior.enemySpawned(state, enemy, makeApi(state))
  assert.deepEqual([enemy.retaliate, enemy.alert, enemy.hunter], [true, true, false])
  locationOf(state, 'zocalo').clues = 0
  behavior.cluesRemoved(state, locationOf(state, 'zocalo'), 1, makeApi(state))
  assert.deepEqual([enemy.retaliate, enemy.alert, enemy.hunter], [false, false, true])
})

test('混乱标记表与四档难度一致', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  state.difficulty = 'standard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3, '古代地点 -3')
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -4)
  const cultist = behavior.resolveChaosToken(state, inv, 'cultist', {})
  assert.equal(cultist.delta, 0)
  assert.equal(cultist.drawAnother, true)
  assert.equal(cultist.doomOnFail, 'cultist')
  const tablet = behavior.resolveChaosToken(state, inv, 'tablet', {})
  assert.equal(tablet.drawAnother, true)
  assert.equal(tablet.serpentAttackOnFail, true)
  const elderThing = behavior.resolveChaosToken(state, inv, 'elderthing', {})
  assert.equal(elderThing.delta, -4)
  assert.equal(elderThing.clueOnNearestAncientOnFail, true)
})

test('结局写入战役记录，并保持存档往返一致', () => {
  const state = chapterState()
  forceShift(state, 'zocalo', 'canalsOfTenochtitlan180')
  forceShift(state, 'coyoacan', 'sacredWoods184')
  forceShift(state, 'templeRuins', 'temploMayor174')
  for (const slot of ['zocalo', 'coyoacan', 'templeRuins']) {
    const location = locationOf(state, slot)
    state.victoryDisplay.push({ id: location.id, code: location.originalCode, originalCode: location.originalCode,
      name: location.name, victory: 0, vengeance: 0, traits: [...location.traits] })
  }
  state.victoryDisplay.push({ id: 'v1', code: '04187', originalCode: '04187', victory: 1, vengeance: 1 })
  state.scenarioFlags.harbingerEnteredPlay = true
  state.enemies.push({ id: 'h1', code: '04062', originalCode: '04062', name: '瓦卢西亚的预示者',
    location: 'zocalo', health: 10, damageTaken: 4, exhausted: false, vengeance: 0, traits: ['Monster'] })
  const result = behavior.resolution(state, 'r1', [], {})
  assert.deepEqual(result, { award: true, bonus: 3 })
  assert.equal(state.campaign.records.pathsAreKnownToYou, 3)
  assert.equal(state.campaign.records.ichtacaHasConfidenceInYou, true)
  assert.equal(state.campaign.records.yigsFury, 1)
  assert.equal(state.campaign.records.theHarbingerIsStillAlive, 4)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  assert.deepEqual(restored.victoryDisplay, state.victoryDisplay)
  // 结局 2 不记录伊塔卡有信心。
  const other = chapterState()
  const second = behavior.resolution(other, 'r2', [], {})
  assert.equal(second.bonus, 0)
  assert.equal(other.campaign.records.ichtacaHasConfidenceInYou, undefined)
  assert.throws(() => behavior.resolution(other, 'r9', [], {}))
})

test('布置时的战役记录：划掉汽油、亚历山卓的额外资源、古代遗物换版本', () => {
  const state = stateFor()
  state.campaign.supplies = { 0: ['gasoline', 'rope'], 1: ['medicine'] }
  state.campaign.records.theInvestigatorsRescuedAlejandro = true
  state.campaign.records.theInvestigatorsFoundTheMissingRelic = true
  state.investigators[1].deck = ['04061', '01020']
  const api = makeApi(state)
  const result = behavior.preScenarioSetup(state, [], api)
  assert.equal(result.outOfGas, false)
  assert.deepEqual(state.campaign.supplies[0], ['rope'])
  assert.equal(state.investigators[0].resources, 7)
  assert.deepEqual(state.investigators[1].deck, ['04191', '01020'])
  assert.equal(state.relicOfAges.code, '04191')
  // 一张汽油都没有时记下「燃料耗尽」（不能重抽起始手牌）。
  const dry = stateFor()
  dry.campaign.supplies = { 0: ['rope'], 1: [] }
  const dryApi = makeApi(dry)
  behavior.preScenarioSetup(dry, [], dryApi)
  assert.equal(dry.scenarioFlags.outOfGas, true)
  assert.equal(dry.investigators.every(inv => inv.resources === 5), true)
})

test('条件遭遇组按混乱袋里的 cultist / tablet 标记数决定', () => {
  const withCultists = chapterState()
  withCultists.encounterDeck = [...withCultists.encounterDeck]
  withCultists.chaosBag = ['skull', 'cultist', 'cultist', '0', '-2']
  const before = withCultists.encounterDeck.length
  behavior.afterChaosBagSetup(withCultists)
  assert.deepEqual(withCultists.scenarioZones.conditionalGroups, ['brotherhood'])
  assert.equal(withCultists.encounterDeck.length, before + 6)
  assert.ok(withCultists.encounterDeck.includes('04095'))
  assert.equal(withCultists.encounterDeck.includes('04086'), false)
  const withTablets = chapterState()
  withTablets.encounterDeck = []
  withTablets.chaosBag = ['skull', 'tablet', 'tablet']
  behavior.afterChaosBagSetup(withTablets)
  assert.deepEqual(withTablets.scenarioZones.conditionalGroups, ['time'])
  assert.ok(withTablets.encounterDeck.includes('04086'))
  assert.ok(withTablets.encounterDeck.includes('04098'))
  const neither = chapterState()
  neither.encounterDeck = []
  neither.chaosBag = ['skull', '0', '-2']
  behavior.afterChaosBagSetup(neither)
  assert.deepEqual(neither.scenarioZones.conditionalGroups, ['fallback'])
  assert.ok(neither.encounterDeck.includes('04095'))
  assert.ok(neither.encounterDeck.includes('04086'))
})

test('帕德玛攻击后：有线索则把 1 个线索翻到毁灭面，无线索则受到 3 点恐惧', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  const api = makeApi(state)
  const padma = api.spawn('04186', 'zocalo')
  const location = state.locations.find(entry => entry.id === 'zocalo')
  const beforeDoom = location.doom || 0
  inv.clues = 2
  behavior.enemyAttackResolved(state, padma, inv, api)
  assert.equal(inv.clues, 1)
  assert.equal(location.doom, beforeDoom + 1, '翻到毁灭面后放在所在地点（玩家可见）')
  inv.clues = 0
  behavior.enemyAttackResolved(state, padma, inv, api)
  assert.equal(inv.horror, 3)
})

test('特诺奇蒂特兰恶蛇造成伤害后让未中毒的调查员中毒', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  const api = makeApi(state)
  const serpent = api.spawn('04187', 'zocalo')
  // 没有实际伤害（例如被取消/完全吸收）时不会中毒。
  behavior.enemyAttackResolved(state, serpent, inv, api, { damage: 0, horror: 1 })
  assert.equal(api.calls.poisoned, undefined)
  behavior.enemyAttackResolved(state, serpent, inv, api, { damage: 1, horror: 1 })
  assert.equal(api.calls.poisoned, 1)
  assert.equal(state.investigators[0].threat.some(card => card.code === '04102'), true)
  // 已中毒时不会再次中毒。
  behavior.enemyAttackResolved(state, serpent, inv, api, { damage: 2, horror: 1 })
  assert.equal(api.calls.poisoned, 1)
})

test('特诺奇蒂特兰恶蛇：关键词随「古代地点是否有线索」动态变化', () => {
  const state = chapterState()
  const inv = state.investigators[0]
  const api = makeApi(state)
  const serpent = api.spawn('04187', 'zocalo')
  const ancient = state.locations.find(entry => entry.id === 'zocalo')
  ancient.originalCode = '04174'
  ancient.code = '04174'
  ancient.traits = ['Ancient', 'Tenochtitlán']
  ancient.clues = 2
  behavior.actions(state, inv)
  assert.equal(serpent.retaliate, true)
  assert.equal(serpent.alert, true)
  assert.equal(serpent.hunter, false)
  // 线索被拿光后（同一轮内），下一次生成行动时改为猎手。
  ancient.clues = 0
  behavior.actions(state, inv)
  assert.equal(serpent.retaliate, false)
  assert.equal(serpent.alert, false)
  assert.equal(serpent.hunter, true)
})

test('本章遭遇卡逐条实现清单只列真正实现的卡号', () => {
  assert.deepEqual([...implementedEncounterCodes].sort(), ['04186', '04187', '04188', '04189', '04190'])
  for (const code of implementedEncounterCodes) {
    const card = stateFor().scenario
    assert.ok(card.enemies[code] || card.treacheries[code], `${code} 属于本章遭遇卡`)
    assert.equal((card.enemies[code] || card.treacheries[code]).rulesPending, false)
  }
  // 帕德玛的每位调查员生命、胜利点与复仇点写在定义里。
  const padma = stateFor().scenario.enemies['04186']
  assert.equal(padma.healthPerInvestigator, 3)
  assert.equal(padma.vengeance, 2)
  assert.equal(padma.victory, 2)
})

// ---------------------------------------------------------------------------
// P2：12 张古代地点的印刷效果
// ---------------------------------------------------------------------------

// 让调查员站在指定格位、把探索牌库顶放成指定古代地点，然后走真实的探索行动，
// 这样 shiftSlot 的入场强制会真的结算。
function exploreInto(state, slotId, ancientId, options = {}) {
  const inv = state.investigators[0]
  inv.location = slotId
  if (options.cards) inv.hand = [...options.cards]
  else if (options.hand != null) inv.hand = Array(options.hand).fill('01001')
  state.explorationDeck = [ancientId]
  const api = makeApi(state, options)
  behavior.performAction(state, inv, { action: 'scenarioAction', rule: 'exploreHere' }, api)
  return { api, inv, location: locationOf(state, slotId) }
}

const weaknessCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code]?.subtype === 'basicweakness')
const hexCode = Object.keys(ALL_CARDS).find(code => (ALL_CARDS[code]?.traits || []).includes('Hex'))

test('古代地点入场：大神庙 04174 从遭遇牌库弃出蛇族敌人并生成在此', () => {
  const state = chapterState(1)
  state.encounterDeck = []
  state.encounterDiscard = ['04087', '04187']
  const { api, location } = exploreInto(state, 'templeRuins', 'temploMayor174')
  assert.equal(location.originalCode, '04174')
  assert.deepEqual(api.calls.spawns.map(spawn => spawn.code), ['04187'])
  assert.equal(api.calls.spawns[0].location, 'templeRuins')
})

test('古代地点入场：04175 洗回弃牌堆、弃到弱点并抽到它', () => {
  const state = chapterState(1)
  const inv = state.investigators[0]
  inv.deck = ['01001', '01002']
  inv.discard = [weaknessCode]
  const { api } = exploreInto(state, 'templeRuins', 'temploMayor175')
  assert.equal(api.calls.drawn, 1, '抽到弱点')
  assert.ok(inv.deck.includes(weaknessCode), '弱点被放回牌库顶并被抽走')
  assert.equal(inv.deck.length, 1, '其余牌被弃掉')
})

test('古代地点入场：直接伤害/恐惧、随机弃牌、弃牌库顶 10 张', () => {
  // 04176：每位在此的调查员受到 1 点直接伤害。
  const damage = chapterState(1)
  const { inv: hurt } = exploreInto(damage, 'metropolitanCathedral', 'templesOfTenochtitlan176', { hand: 6 })
  assert.equal(hurt.damage, 1)
  // 04183：每位在此的调查员受到 1 点直接恐惧。
  const horror = chapterState(1)
  const { inv: scared } = exploreInto(horror, 'xochimilco', 'lakeXochimilco183')
  assert.equal(scared.horror, 1)
  // 04178：每位在此的调查员随机弃掉 2 张手牌。
  const discards = chapterState(1)
  const { inv: discarding } = exploreInto(discards, 'chapultepecPark', 'chapultepecHill178', { hand: 4 })
  assert.equal(discarding.hand.length, 2)
  assert.equal(discarding.discard.length, 2)
  // 04184：每位在此的调查员弃掉牌库顶 10 张。
  const mill = chapterState(1)
  mill.investigators[0].deck = Array(12).fill('01001')
  const { inv: milled } = exploreInto(mill, 'coyoacan', 'sacredWoods184')
  assert.equal(milled.deck.length, 2)
  assert.equal(milled.discard.length, 10)
})

test('古代地点入场：04177 在最近敌人上放毁灭、04181 放 4 资源、04182 失去所有行动', () => {
  const doom = chapterState(1)
  const enemy = { id: 'e1', code: '04187', name: '蛇', location: 'zocalo', doom: 0, traits: ['Serpent'] }
  doom.enemies.push(enemy)
  exploreInto(doom, 'metropolitanCathedral', 'templesOfTenochtitlan177', { hand: 6 })
  assert.equal(enemy.doom, 1, '最近敌人获得 1 个毁灭')
  assert.equal(enemy.location, 'zocalo', '毁灭放在当地点最近的敌人上')

  const canals = chapterState(1)
  const { location: canalLocation } = exploreInto(canals, 'zocalo', 'canalsOfTenochtitlan181',
    { cards: ['01020', '01020'] })
  assert.equal(canalLocation.resources, 4, '运河入场放 4 资源')
  behavior.roundEnded(canals, makeApi(canals))
  assert.equal(canalLocation.resources, 3, '轮末弃掉 1 个资源')

  const lake = chapterState(1)
  const { inv: idle } = exploreInto(lake, 'xochimilco', 'lakeXochimilco182')
  assert.equal(idle.actionsLeft, 0, '失去所有剩余行动')
})

test('古代地点动作：04175/04177/04178/04184 发现线索的团队每轮一次', () => {
  // 04175：把弃牌堆的弱点洗回牌库，发现 2 个线索。
  const templo = chapterState(1)
  forceShift(templo, 'templeRuins', 'temploMayor175')
  const inv1 = templo.investigators[0]
  inv1.location = 'templeRuins'
  inv1.discard = [weaknessCode]
  inv1.deck = []
  locationOf(templo, 'templeRuins').clues = 5
  const api1 = makeApi(templo)
  const rule1 = behavior.actions(templo, inv1).find(move => move.rule === 'ancientClue')
  assert.ok(rule1, '04175 的行动应出现')
  behavior.performAction(templo, inv1, rule1, api1)
  assert.equal(inv1.clues, 2)
  assert.equal(locationOf(templo, 'templeRuins').clues, 3)
  assert.throws(() => behavior.performAction(templo, inv1, rule1, makeApi(templo)), /不能结算/, '同一轮不能再触发')

  // 04177：在一个敌人上放毁灭，发现 2 个线索。
  const templo177 = chapterState(1)
  forceShift(templo177, 'metropolitanCathedral', 'templesOfTenochtitlan177')
  const inv2 = templo177.investigators[0]
  inv2.location = 'metropolitanCathedral'
  const target = { id: 'e2', code: '04187', name: '蛇', location: 'zocalo', doom: 0, traits: ['Serpent'] }
  templo177.enemies.push(target)
  locationOf(templo177, 'metropolitanCathedral').clues = 4
  const rule2 = behavior.actions(templo177, inv2).find(move => move.rule === 'ancientClue')
  assert.ok(rule2, '04177 的行动应出现')
  behavior.performAction(templo177, inv2, rule2, makeApi(templo177))
  assert.equal(target.doom, 1)
  assert.equal(inv2.clues, 2)

  // 04178：弃掉所有手牌，发现 2 个线索。
  const hill = chapterState(1)
  forceShift(hill, 'chapultepecPark', 'chapultepecHill178')
  const inv3 = hill.investigators[0]
  inv3.location = 'chapultepecPark'
  inv3.hand = ['01001', '01002', '01003']
  locationOf(hill, 'chapultepecPark').clues = 3
  const rule3 = behavior.actions(hill, inv3).find(move => move.rule === 'ancientClue')
  behavior.performAction(hill, inv3, rule3, makeApi(hill))
  assert.equal(inv3.hand.length, 0)
  assert.equal(inv3.clues, 2)

  // 04184：牌库为空时发现圣林所有的线索。
  const woods = chapterState(1)
  forceShift(woods, 'coyoacan', 'sacredWoods184')
  const inv4 = woods.investigators[0]
  inv4.location = 'coyoacan'
  inv4.deck = []
  locationOf(woods, 'coyoacan').clues = 3
  const rule4 = behavior.actions(woods, inv4).find(move => move.rule === 'ancientClue')
  behavior.performAction(woods, inv4, rule4, makeApi(woods))
  assert.equal(inv4.clues, 3, '发现全部线索')
  assert.equal(locationOf(woods, 'coyoacan').clues, 0)
})

test('古代地点常驻：帷幕/属性/敌人躲避的剧本修正', () => {
  // 04179：-2 意志；抽到巫术卡牌后发现 1 个线索（团队每阶段一次）。
  const hill = chapterState(1)
  forceShift(hill, 'chapultepecPark', 'chapultepecHill179')
  const inv = hill.investigators[0]
  inv.location = 'chapultepecPark'
  assert.equal(behavior.statModifier(hill, inv, 'willpower'), -2)
  assert.equal(behavior.statModifier(hill, inv, 'intellect'), 0)
  locationOf(hill, 'chapultepecPark').clues = 3
  if (hexCode) {
    const api = makeApi(hill)
    behavior.cardDrawn(hill, inv, hexCode, api)
    assert.equal(inv.clues, 1, '抽到巫术卡牌后发现 1 个线索')
    behavior.cardDrawn(hill, inv, hexCode, makeApi(hill))
    assert.equal(inv.clues, 1, '团队每阶段一次')
  }

  // 04180：敌人 +2 躲避；有横置敌人时帷幕 -3。
  const canals = chapterState(1)
  forceShift(canals, 'zocalo', 'canalsOfTenochtitlan180')
  const enemy = { id: 'e3', code: '04187', name: '蛇', location: 'zocalo', exhausted: true, traits: ['Serpent'] }
  canals.enemies.push(enemy)
  assert.equal(behavior.enemyStatModifier(canals, enemy, 'evade'), 2)
  assert.equal(behavior.locationShroudModifier(canals, locationOf(canals, 'zocalo'), canals.investigators[0]), -3)
  enemy.exhausted = false
  assert.equal(behavior.locationShroudModifier(canals, locationOf(canals, 'zocalo'), canals.investigators[0]), 0)

  // 04181：帷幕 + 资源数。
  const canal181 = chapterState(1)
  forceShift(canal181, 'zocalo', 'canalsOfTenochtitlan181')
  const canalLoc = locationOf(canal181, 'zocalo')
  canalLoc.resources = 2
  assert.equal(behavior.locationShroudModifier(canal181, canalLoc, canal181.investigators[0]), 2)

  // 04182：帷幕 + 2×剩余行动。
  const lake = chapterState(1)
  forceShift(lake, 'xochimilco', 'lakeXochimilco182')
  const lakeInv = lake.investigators[0]
  lakeInv.actionsLeft = 2
  assert.equal(behavior.locationShroudModifier(lake, locationOf(lake, 'xochimilco'), lakeInv), 4)

  // 04185：帷幕 - 控制支援数；费用 +2（入场时由 ANCIENT_STATIC 写进地点）。
  const woods = chapterState(1)
  const { location: woodsLocation } = exploreInto(woods, 'coyoacan', 'sacredWoods185')
  const woodsInv = woods.investigators[0]
  woodsInv.assets = [{ id: 'a1', code: '01020' }, { id: 'a2', code: '01021' }]
  assert.equal(behavior.locationShroudModifier(woods, woodsLocation, woodsInv), -2)
  assert.equal(woodsLocation.playCostIncrease, 2)

  // 04176/04183：生命/神智 ≤3 时帷幕 -2。
  const health = chapterState(1)
  forceShift(health, 'metropolitanCathedral', 'templesOfTenochtitlan176')
  const hurt = health.investigators[0]
  hurt.maxHealth = 6; hurt.damage = 3
  assert.equal(behavior.locationShroudModifier(health, locationOf(health, 'metropolitanCathedral'), hurt), -2)
  const sanity = chapterState(1)
  forceShift(sanity, 'xochimilco', 'lakeXochimilco183')
  const scared = sanity.investigators[0]
  scared.maxSanity = 5; scared.horror = 2
  assert.equal(behavior.locationShroudModifier(sanity, locationOf(sanity, 'xochimilco'), scared), -2)
})

test('古代地点反应：04174 击败/躲避蛇族后发现 1 个线索（团队每阶段一次）', () => {
  const state = chapterState(1)
  forceShift(state, 'templeRuins', 'temploMayor174')
  const location = locationOf(state, 'templeRuins')
  location.clues = 3
  const inv = state.investigators[0]
  const serpent = { id: 'e4', code: '04187', name: '蛇', location: 'templeRuins', traits: ['Serpent'], defeatedBy: 0 }
  state.enemies.push(serpent)
  behavior.enemyDefeated(state, serpent, makeApi(state))
  assert.equal(inv.clues, 1)
  assert.equal(location.clues, 2)
  behavior.afterEvade(state, inv, serpent, null, makeApi(state))
  assert.equal(inv.clues, 1, '同一阶段只触发一次')
  state.phase = 'enemy'
  behavior.afterEvade(state, inv, serpent, null, makeApi(state))
  assert.equal(inv.clues, 2, '新阶段可以再触发')
})

test('04062 预示者：本章生成的预示者也累积资源并遁去身影（P2 跨章共享）', () => {
  const state = chapterState(2)
  state.campaign.records.theHarbingerIsStillAlive = 4
  const harbor = { id: 'h1', code: '04062', originalCode: '04062', name: '瓦卢西亚的预示者',
    location: 'zocalo', damageTaken: 4, health: 20, engagedSeat: 0, resources: 0, traits: ['Serpent'] }
  state.enemies.push(harbor)
  state.investigators[0].engaged.push(harbor.id)
  const api = makeApi(state)
  behavior.enemySpawned(state, harbor, api)
  assert.equal(harbor.retaliateWhileExhausted, true, '横置也能反击')
  assert.equal(harbor.damageTaken, 4, '按记录带伤入场')
  for (let index = 0; index < 4; index++) {
    behavior.enemyAttackedSuccessfully(state, state.investigators[0], harbor, api)
  }
  assert.equal(state.enemies.includes(harbor), false, '2×人数资源后遁去身影')
  assert.equal(state.scenarioFlags.harbingerDamage, 4, '保留伤害')
  assert.ok(state.scenarioZones.setAside.includes('04062'))
  assert.equal(state.campaign.records.theHarbingerIsStillAlive, 4)
  assert.deepEqual(state.investigators[0].engaged, [])
})

test('04186 帕德玛攻击：有线索时翻成地点毁灭，无线索受 3 点恐惧', () => {
  const withClue = chapterState(1)
  const inv = withClue.investigators[0]
  inv.clues = 1
  const location = withClue.locations.find(entry => entry.id === inv.location)
  const beforeDoom = location.doom || 0
  const padma = { id: 'padma', code: '04186', originalCode: '04186', name: '帕德玛·阿姆丽塔',
    location: inv.location, fight: 4, evade: 3, health: 3, damage: 2, horror: 2, damageTaken: 0, traits: ['Serpent'] }
  withClue.enemies.push(padma)
  behavior.enemyAttackResolved(withClue, padma, inv, makeApi(withClue))
  assert.equal(inv.clues, 0, '线索被翻走')
  assert.equal(location.doom, beforeDoom + 1, '翻到毁灭面后放在所在地点')

  const noClue = chapterState(1)
  const poor = noClue.investigators[0]
  const padma2 = { ...padma, location: poor.location }
  noClue.enemies.push(padma2)
  behavior.enemyAttackResolved(noClue, padma2, poor, makeApi(noClue))
  assert.equal(poor.horror, 3, '没有线索时受到 3 点恐惧')
})

test('04163 未来幻象：换密谋 3a 时清掉旧密谋的毁灭', () => {
  const state = chapterState(1)
  state.agendaIndex = 1
  state.doom = 4
  const api = makeApi(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.doom, 0, '新密谋从 0 毁灭开始')
  assert.equal(state.agendas[state.agendas.length - 1].originalCode, '04164')
})

test('04165 背面：检定失败时从收藏随机获得基础疯狂/损伤弱点', () => {
  const state = chapterState(1)
  state.actIndex = 0
  state.scenarioFlags.ancientPlacerSeat = 0
  assert.equal(state.acts[0].originalCode, '04165')
  const api = makeApi(state)
  const calls = []
  api.test = (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, drawn: [] })
  api.addBasicWeakness = (seat, traits) => { calls.push([seat, traits]) }
  behavior.actReveal(state, state.acts[0], api)
  assert.deepEqual(calls, [[0, ['madness', 'injury']]], '查找收藏而不是搜自己牌库')
})

test('04161 混乱标记：普通难度一个蛇族攻击、困难每个；异教徒毁灭与古代地点线索', () => {
  const build = (difficulty, drawn, success = false) => {
    const state = chapterState(1)
    state.difficulty = difficulty
    const inv = state.investigators[0]
    const location = state.locations.find(entry => entry.id === inv.location)
    location.originalCode = '04174'
    location.code = '04174'
    location.traits = ['Ancient', 'Tenochtitlán']
    const cultistA = { id: 'c1', code: '04095', originalCode: '04095', name: '异教徒甲', location: inv.location, traits: ['Cultist'], doom: 0 }
    const cultistB = { id: 'c2', code: '04095', originalCode: '04095', name: '异教徒乙', location: inv.location, traits: ['Cultist'], doom: 0 }
    const serpentA = { id: 's1', code: '04187', originalCode: '04187', name: '蛇甲', location: inv.location, traits: ['Serpent'], damage: 1, horror: 0 }
    const serpentB = { id: 's2', code: '04187', originalCode: '04187', name: '蛇乙', location: inv.location, traits: ['Serpent'], damage: 1, horror: 0 }
    state.enemies.push(cultistA, cultistB, serpentA, serpentB)
    const calls = { attacks: [] }
    const api = makeApi(state)
    api.attack = (enemy, target) => calls.attacks.push(enemy.id)
    behavior.afterTest(state, inv, { success, drawn, value: 0, difficulty: 1, skill: 'willpower' }, api)
    return { state, location, calls, cultistA, cultistB }
  }

  const easy = build('standard', ['cultist', 'tablet', 'elderthing'])
  assert.deepEqual(easy.calls.attacks, ['s1'], '普通难度只有一个蛇族攻击')
  assert.equal(easy.cultistA.doom, 1, '普通难度只在一个异教徒上放毁灭')
  assert.equal(easy.cultistB.doom, 0)
  assert.equal(easy.location.clues, 1, '失败时最近的古代地点 +1 线索')

  const hard = build('hard', ['cultist', 'tablet', 'elderthing'])
  assert.deepEqual(hard.calls.attacks.sort(), ['s1', 's2'], '困难每个蛇族都攻击')
  assert.equal(hard.cultistA.doom, 1, '困难每个异教徒都放毁灭')
  assert.equal(hard.cultistB.doom, 1)
  assert.equal(hard.location.clues, 1)

  // 困难面 [elderthing] 不要求失败也会放线索。
  const hardPass = build('hard', ['elderthing'], true)
  assert.equal(hardPass.location.clues, 1, '困难面成功也放线索')
})

test('04188 兄弟会之手：生成在无人地点（玩家选择）', () => {
  const state = chapterState(1)
  const inv = state.investigators[0]
  // 只有当前地点有人，其余地点都是「无人地点」。
  const empties = state.locations.filter(location => location.id !== inv.location)
  assert.ok(empties.length >= 2)
  const api = makeApi(state, { choose: () => empties[1].id })
  const target = behavior.spawnLocation(state, '04188', inv.location, 0, api)
  assert.equal(target, empties[1].id, '按玩家选择生成')
  const single = chapterState(1)
  single.locations = single.locations.filter(location => location.id === single.investigators[0].location)
  assert.equal(behavior.spawnLocation(single, '04188', single.investigators[0].location, 0, makeApi(single)), null,
    '没有无人地点时生成失败')
})

test('04171 索卡洛广场：由玩家选择弃哪些手牌，而不是自动按费用降序弃', () => {
  const state = chapterState(1)
  const inv = state.investigators[0]
  const zocalo = state.locations.find(entry => entry.originalCode === '04171') || state.locations[0]
  inv.location = zocalo.id
  inv.hand = ['01022', '01020', '01021']
  state.explorationDeck = ['ancientTemplo174']
  const api = makeApi(state, { choose: () => '0' })
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'exploreHere')
  assert.ok(move)
  behavior.performAction(state, inv, move, api)
  assert.ok(inv.discard.includes('01022'), '玩家先选的那张（费用 1）被弃掉')
  assert.ok(inv.discard.length >= 2)
})

test('04162 预示者进场后从放在一边移除，并按记录带伤', () => {
  const state = chapterState(1)
  state.scenarioZones.setAside = ['04062']
  state.campaign.records.theHarbingerIsStillAlive = 3
  const api = makeApi(state)
  const agenda = state.agendas.find(entry => (entry.originalCode || entry.code) === '04162')
  behavior.agendaReveal(state, agenda, api)
  const enemy = state.enemies.find(entry => (entry.originalCode || entry.code) === '04062')
  assert.ok(enemy)
  assert.equal(enemy.damageTaken, 3)
  assert.equal(state.scenarioZones.setAside.includes('04062'), false)
})

test('起始地点：每位调查员各自选择索卡洛或科约阿坎', () => {
  const state = stateFor(2)
  const api = makeApi(state, { choose: request => request.options[1].id })
  behavior.preScenarioSetup(state, [], api)
  for (const inv of state.investigators) assert.equal(inv.location, 'coyoacan')
  const second = stateFor(2)
  behavior.preScenarioSetup(second, [], makeApi(second, { choose: request => request.options[0].id }))
  for (const inv of second.investigators) assert.equal(inv.location, 'zocalo')
})

test('没有纽带时起始手牌 -2；没有汽油时不能换牌', () => {
  const state = stateFor(1)
  state.campaign.supplies = { 0: [] }
  const inv = state.investigators[0]
  inv.hand = ['01020', '01021', '01022']
  inv.deck = []
  behavior.preScenarioSetup(state, [], makeApi(state))
  assert.equal(inv.hand.length, 1, '抽好的起始手牌减 2')
  assert.deepEqual(inv.deck.slice(0, 2), ['01020', '01021'], '放回牌库底')
  assert.equal(inv.cannotMulligan, true, '没有汽油不能重抽')
})

test('布置时多人都带汽油：由玩家选择划掉谁的汽油', () => {
  const state = stateFor(2)
  state.campaign.supplies = { 0: ['gasoline'], 1: ['gasoline'] }
  const api = makeApi(state, { choose: () => '1' })
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.scenarioFlags.outOfGas, false)
  assert.deepEqual(state.campaign.supplies[0], ['gasoline'])
  assert.deepEqual(state.campaign.supplies[1], [])
})
