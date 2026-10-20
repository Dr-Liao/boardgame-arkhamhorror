import test from 'node:test'
import assert from 'node:assert/strict'
// 引擎是唯一装配点：import 它之前不会注册能力条目、注入修正读点
// （setModifierRegistry / setModifierHooks），下面的 entityModifierTotal 会恒为 0。
import '../src/engine/engine.js'
import * as wilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'
import { scenario as definition } from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/definition.js'
import { EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES } from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/definition.js'
// Phase 3（D1）：敌人/地点的常驻修正已迁到能力层，验收改为断言引擎的统一读点。
import { entityModifierTotal } from '../src/engine/modifiers.js'

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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'expeditionCamp',
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
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placed(state) {
  state.locations = Object.values(state.scenario.locations)
    .filter(location => ['expeditionCamp', ...EXPLORATION_LOCATIONS, 'ruinsOfEztli']
      .includes(location.id))
    .map(location => ({ ...clone(location), id: location.id, revealed: true,
      clues: location.cluesPerInvestigator * state.numInvestigators }))
  return state
}

test('荒莽密林 M5：章节已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(wilds.manifest.status, 'playable')
  assert.equal(wilds.manifest.catalogReferenceOnly, undefined)
  assert.equal(wilds.manifest.referenceCode, undefined)
  assert.equal(wilds.scenario.originalCode, '04043')
  assert.equal(wilds.manifest.locations.length, 9)
  assert.equal(wilds.manifest.acts.map(act => act.id).join(','), 'act1,act2,act3,act4')
  assert.deepEqual(wilds.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(wilds.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
})

test('符号地图按印刷符号连线', () => {
  const locations = Object.fromEntries(wilds.manifest.locations.map(location =>
    [location.id, location]))
  assert.deepEqual([...locations.expeditionCamp.connections].sort(),
    ['pathOfThorns', 'riverCanyon', 'ropeBridge'])
  assert.ok(locations.pathOfThorns.connections.includes('expeditionCamp'))
  assert.ok(locations.serpentsHaven.connections.includes('ruinsOfEztli'))
  assert.equal(locations.templeOfTheFang.connections.includes('overgrownRuins'), false,
    '毒牙神庙与杂草丛生的遗迹通过「＝」符号相连，未印刷即不成立')
})

test('布置是确定性的：同样种子给出同一探索牌库，且不重复', () => {
  const build = seed => {
    const state = stateFor()
    wilds.behavior.setupLocations(state, [], setupApi(seed))
    return state.explorationDeck
  }
  const first = build(17)
  assert.deepEqual(first, build(17))
  assert.notDeepEqual(first, build(18))
  assert.equal(first.length, 10)
  assert.deepEqual([...first].sort(), [
    ...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERIES),
  ].sort())
})

test('布置把伊格的使徒、伊塔卡、亚历山卓与 4 张中毒放在一边', () => {
  const state = stateFor()
  const ids = wilds.behavior.setupLocations(state, [], setupApi(3))
  assert.deepEqual(ids, ['expeditionCamp'])
  const names = state.scenarioZones.setAside
  assert.equal(names.filter(code => code === '04102').length, 4)
  assert.ok(names.includes('04051'), '亚历山卓·维拉')
  assert.ok(names.includes('04052'), '伊塔卡')
  assert.deepEqual(['04083', '04084', '04085'].filter(code => names.includes(code)), ['04083', '04084', '04085'])
  assert.equal(state.scenario.locations?.expeditionCamp === undefined, false)
})

test('探索会把雨林地点接到出发地点并同步符号连线', () => {
  const state = placed(stateFor())
  wilds.behavior.setupLocations(state, [], setupApi(5))
  state.explorationDeck = ['pathOfThorns', 'riverCanyon']
  const api = {
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    choose: () => '0',
  }
  const inv = state.investigators[0]
  // 模拟引擎：放置地点并移动。
  state.locations.push({ ...clone(state.scenario.locations.pathOfThorns), id: 'pathOfThorns',
    revealed: true, clues: 1 })
  inv.location = 'pathOfThorns'
  state.explorationDeck.pop()
  const placedLocation = state.locations.find(location => location.id === 'pathOfThorns')
  const from = state.locations.find(location => location.id === 'expeditionCamp')
  placedLocation.connections = [from.id]
  from.connections.push('pathOfThorns')
  wilds.behavior.afterExplore(state, inv, { code: 'pathOfThorns', kind: 'location', runtime: api })
  assert.ok(placedLocation.connections.includes('riverCanyon'), '符号连线补上了河流峡谷')
  assert.ok(state.locations.find(location => location.id === 'riverCanyon').connections.includes('pathOfThorns'))
  assert.equal(inv.tfaExploredThisTurn, true)
})

test('探索失败在荆棘之路与万蛇据点按卡面造成伤害', () => {
  const state = placed(stateFor())
  wilds.behavior.setupLocations(state, [], setupApi(7))
  const api = { damage: (seat, amount) => { state.investigators[seat].damage += amount }, choose: () => '0' }
  const inv = state.investigators[0]
  inv.location = 'pathOfThorns'
  wilds.behavior.afterExplore(state, inv, { kind: 'encounter', runtime: api })
  assert.equal(inv.damage, 1)
  inv.location = 'serpentsHaven'
  inv.threat.push({ id: 'poison', code: '04102', permanent: true })
  wilds.behavior.afterExplore(state, inv, { kind: 'encounter', runtime: api })
  assert.equal(inv.damage, 2)
})

test('索桥要求探索前检定敏捷，失败则取消探索、受伤并结束回合', () => {
  const fail = () => {
    const state = placed(stateFor(1))
    wilds.behavior.setupLocations(state, [], setupApi(11))
    state.explorationDeck = ['riverCanyon']
    const inv = state.investigators[0]
    inv.location = 'ropeBridge'
    state.locations.push({ ...clone(state.scenario.locations.ropeBridge), id: 'ropeBridge',
      revealed: true, clues: 1 })
    const ended = []
    const api = {
      test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
      damage: (seat, amount) => { state.investigators[seat].damage += amount },
      loseActions: () => {},
      endTurn: seat => ended.push(seat),
      moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
      place: () => {},
      checkSupplies: () => false,
      info: () => {},
    }
    const result = wilds.behavior.beforeExplore(state, inv, api)
    return { state, result, ended }
  }
  const first = fail()
  const second = fail()
  assert.equal(first.result, false)
  assert.equal(first.state.investigators[0].damage, 2)
  assert.deepEqual(first.ended, [0])
  assert.equal(first.state.investigators[0].location, 'riverCanyon')
  assert.equal(JSON.stringify(first.state), JSON.stringify(second.state), '同一路线结果一致')
})

test('曲折小道没有指南针时必须额外花费 3 资源', () => {
  const make = () => {
    const state = placed(stateFor(1))
    wilds.behavior.setupLocations(state, [], setupApi(13))
    const inv = state.investigators[0]
    inv.location = 'circuitousTrail'
    inv.resources = 3
    const api = { checkSupplies: () => false, info: () => {} }
    const allowed = wilds.behavior.beforeExplore(state, inv, api)
    return { state, inv, allowed }
  }
  const first = make()
  assert.equal(first.allowed, true)
  assert.equal(first.inv.resources, 0)
  const broke = make()
  broke.state.investigators[0].resources = 2
  const rerun = wilds.behavior.beforeExplore(broke.state, broke.inv, { checkSupplies: () => false, info: () => {} })
  assert.equal(rerun, false)
})

test('探索丛林：非营地调查员在轮末共同支付 3×人数线索后推进并放置伊塔卡', () => {
  const state = placed(stateFor(2))
  wilds.behavior.setupLocations(state, [], setupApi(19))
  const spawned = []
  const api = {
    choose: () => 'advance',
    advanceAct: () => {
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      wilds.behavior.actReveal(state, act, {
        spawn: (code, location) => spawned.push({ code, location }),
        shuffleDiscard: () => {},
      })
    },
  }
  state.investigators[0].location = 'pathOfThorns'
  state.investigators[0].clues = 7
  state.investigators[1].location = 'expeditionCamp'
  state.investigators[1].clues = 4
  wilds.behavior.roundEnded(state, api)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[1].clues, 4, '营地调查员的线索不参与支付')
  assert.equal(state.actIndex, 1)
  assert.deepEqual(spawned, [{ code: '04052', location: 'pathOfThorns' }])
})

test('女猎手：伊塔卡带够线索时进入「搜索遗迹」并加入异教徒标记', () => {
  const state = placed(stateFor(2))
  wilds.behavior.setupLocations(state, [], setupApi(23))
  state.actIndex = 1
  state.enemies.push({ id: 'e1', code: '04052', originalCode: '04052', name: '伊塔卡',
    location: 'expeditionCamp', clues: 2, fight: 5, evade: 4, health: 4, damageTaken: 0,
    damage: 2, horror: 0, engagedSeat: null })
  state.chaosBag = ['0', 'skull', 'skull', 'elderthing', 'autofail', 'eldersign']
  state.campaign.chaosBag = [...state.chaosBag]
  const advanced = []
  wilds.behavior.checkObjectives(state, {
    advanceAct: () => {
      state.scenarioFlags.actTwoAdvancedWith = 'clues'
      advanced.push(state.actIndex)
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      wilds.behavior.actReveal(state, act, {
        choose: () => '0',
        giveAsset: () => {},
      })
    },
  })
  assert.deepEqual(advanced, [1])
  assert.equal(state.actIndex, 2)
  assert.equal(state.acts[2].originalCode, '04048')
  assert.equal(state.enemies.some(enemy => enemy.code === '04052'), false)
  assert.equal(state.campaign.records.ichtacaHasConfidenceInYou, true)
  assert.equal(state.chaosBag.filter(token => token === 'cultist').length, 1)
  assert.ok(state.explorationDeck.includes('templeOfTheFang'), '遗迹地点洗入探索牌库')
  assert.ok(state.explorationDeck.includes('overgrownRuins'))
  assert.equal(state.explorationDeck.includes('ruinsOfEztli'), false, '已经在场的地点不再洗入')
})

test('女猎手：击败伊塔卡后进入「守备森严的遗迹」并交出亚历山卓', () => {
  const state = placed(stateFor(1))
  wilds.behavior.setupLocations(state, [], setupApi(29))
  state.actIndex = 1
  state.scenarioFlags.ichtacaSpawned = true
  state.chaosBag = ['0']
  state.campaign.chaosBag = [...state.chaosBag]
  const granted = []
  wilds.behavior.checkObjectives(state, {
    advanceAct: () => {
      state.scenarioFlags.actTwoAdvancedWith = 'defeat'
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      wilds.behavior.actReveal(state, act, {
        choose: () => 0,
        giveAsset: (seat, code) => granted.push({ seat, code }),
      })
    },
  })
  assert.equal(state.acts[2].originalCode, '04049')
  assert.deepEqual(granted, [{ seat: 0, code: '04051' }])
  assert.equal(state.campaign.records.theInvestigatorsFoughtWithIchtaca, true)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 1)
})

test('密谋推进按卡面：荒野探险洗入伊格的使徒并让未中毒者中毒', () => {
  const state = placed(stateFor(2))
  wilds.behavior.setupLocations(state, [], setupApi(31))
  const poisoned = []
  const api = {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
    poison: seat => { poisoned.push(seat); return true },
    damage: () => {},
    horror: () => {},
    shuffleDiscard: () => {},
  }
  wilds.behavior.agendaReveal(state, state.agendas[0], api)
  assert.deepEqual(poisoned, [0, 1])
  assert.deepEqual(['04083', '04084', '04085'].every(code => state.encounterDeck.includes(code)), true)
  assert.equal(state.scenarioZones.setAside.includes('04083'), false)
})

test('混乱标记表与四档难度一致', () => {
  const state = placed(stateFor(1))
  state.difficulty = 'standard'
  state.explorationDeck = ['a', 'b']
  state.victoryDisplay = [{ id: 'v', vengeance: 2 }]
  const inv = state.investigators[0]
  const skull = wilds.behavior.resolveChaosToken(state, inv, 'skull', {})
  assert.equal(skull.delta, -2)
  state.difficulty = 'hard'
  assert.equal(wilds.behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3)
  state.difficulty = 'standard'
  assert.equal(wilds.behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -Math.min(5, state.locations.length))
  assert.equal(wilds.behavior.resolveChaosToken(state, inv, 'tablet', {}).delta, -2)
  inv.threat.push({ id: 'p', code: '04102' })
  assert.equal(wilds.behavior.resolveChaosToken(state, inv, 'elderthing', {}).autoFail, true)
})

test('结局写入战役记录并保留存档一致性', () => {
  const state = placed(stateFor(2))
  wilds.behavior.setupLocations(state, [], setupApi(37))
  const api = { giveAsset: () => {} }
  wilds.behavior.resolution(state, 'r1', [], api)
  assert.equal(state.campaign.records.theInvestigatorsClearedAPathToTheEztliRuins, true)
  assert.equal(state.campaign.records.alejandroChoseToRemainAtCamp, true)
  assert.equal(state.campaign.records.theInvestigatorsHaveEarnedIchtacasTrust, true)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  wilds.behavior.resolution(state, 'r2', [], api)
  assert.equal(state.campaign.records.ichtacaIsWaryOfTheInvestigators, true)
  assert.equal(state.campaign.records.alejandroFollowedTheInvestigatorsIntoTheRuins, true)
  assert.throws(() => wilds.behavior.resolution(state, 'r9', [], api))
})

test('探险营地提供撤退与地图补给行动', () => {
  const state = placed(stateFor(1))
  wilds.behavior.setupLocations(state, [], setupApi(41))
  const inv = state.investigators[0]
  // 没有地图时不显示「检查补给」按钮。
  assert.deepEqual(wilds.behavior.actions(state, inv).map(move => move.rule), ['resignCamp'])
  state.campaign.supplies = { 0: ['map'] }
  const moves = wilds.behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule).sort(), ['mapSupplies', 'resignCamp'])
  const resigned = []
  wilds.behavior.performAction(state, inv, moves.find(move => move.rule === 'resignCamp'),
    { resign: seat => resigned.push(seat) })
  assert.deepEqual(resigned, [0])
})

test('04050 地图：1 张放底、其余 2 张按玩家选择顺序放顶', () => {
  const state = placed(stateFor(1))
  wilds.behavior.setupLocations(state, [], setupApi(11))
  const inv = state.investigators[0]
  state.campaign.supplies = { 0: ['map'] }
  state.explorationDeck = ['a', 'b', 'c', 'd']
  const answers = ['0', '1']
  const logs = []
  wilds.behavior.performAction(state, inv, { rule: 'mapSupplies' }, {
    checkSupplies: () => true,
    info: text => logs.push(text),
    choose: () => answers.shift(),
  })
  // 顶 3 张 = ['d','c','b']（end 为顶）；选 '0'(d) 放底，然后 '1'(b) 先放顶。
  assert.deepEqual(state.explorationDeck, ['a', 'c', 'b', 'd'])
  assert.ok(logs.some(text => text.includes('按你选择的顺序')))
})

test('04072/04053/04074 的地点与调查修正（P2）', () => {
  // 04072：探索成功（翻到连接地点）也要结算中毒伤害。
  const state = placed(stateFor())
  wilds.behavior.setupLocations(state, [], setupApi(7))
  const api = { damage: (seat, amount) => { state.investigators[seat].damage += amount } }
  const inv = state.investigators[0]
  inv.location = 'serpentsHaven'
  inv.threat.push({ id: 'poison', code: '04102', permanent: true })
  wilds.behavior.afterExplore(state, inv, { kind: 'location', runtime: api })
  assert.equal(inv.damage, 1, '探索成功也受 1 点伤害')

  // 04072：万蛇据点的蛇族敌人 +1 攻击值（D1：断言 04072 地点条目声明的修正）。
  const serpent = { id: 'e-serpent', code: '04187', name: '蛇', location: 'serpentsHaven',
    traits: ['Serpent'], fight: 2, evade: 2, health: 3 }
  assert.equal(entityModifierTotal(state, serpent, 'enemyFight'), 1)
  assert.equal(entityModifierTotal(state, serpent, 'enemyEvade'), 0)
  serpent.location = 'riverCanyon'
  assert.equal(entityModifierTotal(state, serpent, 'enemyFight'), 0)

  // 04053：在埃兹特里的遗迹调查失败后抽 1 张遭遇卡。
  const ruins = placed(stateFor(1))
  wilds.behavior.setupLocations(ruins, [], setupApi(3))
  const draws = []
  const ruinApi = { drawEncounter: seat => draws.push(seat), damage: () => {} }
  const explorer = ruins.investigators[0]
  explorer.location = 'ruinsOfEztli'
  wilds.behavior.afterTest(ruins, explorer, { success: false, source: { label: '调查' } }, ruinApi)
  assert.deepEqual(draws, [0], '失败后抽遭遇卡')
  wilds.behavior.afterTest(ruins, explorer, { success: true, source: { label: '调查' } }, ruinApi)
  assert.deepEqual(draws, [0], '成功不抽')

  // 04074：胜利区每点复仇 +1 帷幕（D1：断言 04074 地点条目声明的修正）。
  const temple = placed(stateFor(1))
  temple.locations.push({ id: 'templeOfTheFang', originalCode: '04074', name: '毒牙神庙',
    revealed: true, clues: 1, shroud: 2, connections: [] })
  temple.victoryDisplay = [{ id: 'v1', code: '04187', vengeance: 2 }]
  assert.equal(entityModifierTotal(temple, temple.locations.at(-1), 'locationShroud'), 2)
  temple.victoryDisplay = []
  assert.equal(entityModifierTotal(temple, temple.locations.at(-1), 'locationShroud'), 0)
})
