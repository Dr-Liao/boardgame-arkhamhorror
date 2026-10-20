import test from 'node:test'
import assert from 'node:assert/strict'
import * as chapter from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/index.js'
import {
  scenario as definition, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
  RUINS_LOCATIONS,
} from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/definition.js'
import { implementedEncounterCodes } from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/behavior.js'

const clone = value => structuredClone(value)
const behavior = chapter.behavior

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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'entryway',
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

function runtimeApi(state, overrides = {}) {
  const drawn = []
  const trauma = []
  const ids = { count: 0 }
  const nextId = kind => `${kind}-${++ids.count}`
  const locationFor = id => state.locations.find(location => location.id === id)
  const api = {
    info: () => {},
    random: () => 0.5,
    choose: () => '0',
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill }),
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directDamage: (seat, n) => { state.investigators[seat].damage += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    healDamage: () => {},
    checkSupplies: () => false,
    loseActions: () => {},
    endTurn: () => {},
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    resign: seat => { state.investigators[seat].resigned = true },
    defeat: (inv) => {
      const target = typeof inv === 'number' ? state.investigators[inv] : inv
      if (target) target.defeated = true
    },
    finish: key => { state.finished = key },
    spawn: (code, location) => {
      const def = state.scenario.enemies[code]
      if (!def) throw new Error(`未知敌人 ${code}`)
      const enemy = {
        id: nextId('enemy'), code, originalCode: code, name: def.name, location,
        damageTaken: 0, exhausted: false, engagedSeat: null, resources: 0,
        fight: def.fight, evade: def.evade, health: def.health, traits: def.traits || [],
      }
      state.enemies.push(enemy)
      return enemy
    },
    giveAsset: (seat, code) => {
      const def = state.scenario.storyAssets[code] || {}
      const asset = { id: nextId('asset'), code, originalCode: code, name: def.name || code }
      state.investigators[seat].assets.push(asset)
      return asset
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== assetId)
    },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(entry => entry.id === enemyId)
      if (enemy) enemy.damageTaken += amount
    },
    checkEnemyDefeat: () => false,
    addToExplorationDeck: codes => { state.explorationDeck = [...(state.explorationDeck || []), ...codes] },
    moveRelicOfAges: payload => {
      state.relicOfAges = { code: '04061', location: null, seat: null, ...payload }
      if (state.relicOfAges.seat != null) {
        state.relicOfAges.location = state.investigators[state.relicOfAges.seat]?.location ?? null
      }
    },
    drawEncounter: seat => { drawn.push(seat) },
    addTrauma: (target, seat, kind, n) => { trauma.push({ seat, kind, n }) },
    yigsFury: () => Number(state.campaign.records.yigsFury || 0),
    locationFor,
  }
  return Object.assign(api, { drawn, trauma }, overrides)
}

// 手搭场地：遗迹入口 + 可指定已入场地点。
function placed(state, ids = ['entryway']) {
  state.locations = ids.map(id => {
    const base = state.scenario.locations[id]
    assert.ok(base, `未知地点 ${id}`)
    return {
      ...clone(base), id, revealed: true,
      clues: base.cluesPerInvestigator * state.numInvestigators,
      doom: 0,
    }
  })
  for (const inv of state.investigators) {
    if (!ids.includes(inv.location)) inv.location = ids[0]
  }
  return state
}

function setup(state, api = setupApi(3)) {
  const ids = behavior.setupLocations(state, [], api)
  for (const id of ids) {
    const base = state.scenario.locations[id]
    state.locations.push({ ...clone(base), id, revealed: true, clues: 0, doom: 0 })
  }
  return state
}

test('时间倒流 M5：章节升级为 playable 并保留真实卡号', () => {
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.catalogReferenceOnly, undefined)
  assert.equal(chapter.manifest.referenceCode, '04344')
  assert.equal(chapter.scenario.originalCode, '04344')
  assert.equal(chapter.manifest.locations.length, 7)
  assert.equal(chapter.manifest.startLocationId, 'entryway')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'r1'])
  assert.equal(chapter.manifest.recordWrites.includes('theFabricOfTimeIsUnwoven'), true)
  assert.equal(chapter.manifest.recordWrites.includes('theInvestigatorsSealedTheRelicOfAgesForever'), true)
})

test('七处遗迹地点复用《埃兹特里的覆灭》原卡并按印刷符号连线', () => {
  const locations = Object.fromEntries(chapter.manifest.locations.map(location => [location.id, location]))
  assert.deepEqual(Object.keys(locations).sort(), ['entryway', ...RUINS_LOCATIONS, 'chamberOfTime'].sort())
  assert.deepEqual([...locations.entryway.connections].sort(), ['ancientHall', 'grandChamber'])
  assert.deepEqual([...locations.chamberOfTime.connections].sort(), ['secretPassage'])
  assert.deepEqual([...locations.undergroundRuins.connections].sort(),
    ['ancientHall', 'burialPit', 'secretPassage'])
  assert.deepEqual([...locations.secretPassage.connections].sort(),
    ['burialPit', 'chamberOfTime', 'undergroundRuins'])
  const codes = definition.locations
  assert.equal(codes.entryway.originalCode, '04060')
  assert.equal(codes.chamberOfTime.originalCode, '04068')
  assert.equal(codes.undergroundRuins.vengeance, 1)
  assert.equal(codes.chamberOfTime.vengeance, 2)
  const aside = chapter.manifest.zones.setAside
  assert.equal(aside.find(entry => entry.cardCode === '04102').count, 4)
  assert.equal(aside.find(entry => entry.cardCode === '04068').count, 1)
})

test('布置是确定性的：同一颗种子给出同一探索牌库', () => {
  const build = seed => behavior.setupPlan(stateFor(), setupApi(seed)).explorationDeck
  const first = build(17)
  assert.deepEqual(first, build(17))
  assert.notDeepEqual(first, build(18))
  assert.equal(first.length, 10)
  assert.deepEqual([...first].sort(), [
    ...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERIES),
  ].sort())
})

test('布置把古代遗物、预示者、伊格和时间石室放在一边，并修正密谋阈值', () => {
  const state = setup(stateFor(2))
  const zones = state.scenarioZones
  assert.deepEqual(zones.setAside.filter(code => code === '04102').length, 4)
  assert.ok(zones.setAside.includes('04061'), '古代遗物')
  assert.ok(zones.setAside.includes('04062'), '瓦卢西亚的预示者')
  assert.ok(zones.setAside.includes('04296'), '伊格')
  assert.deepEqual(zones.setAsideLocations, ['chamberOfTime'])
  assert.equal(state.explorationDeck.length, 10)
  assert.deepEqual(state.scenario.locations.chamberOfTime.connections.includes('secretPassage'), true)
  assert.equal(state.agendas[0].doomThreshold, 6 + 2)
  assert.equal(state.agendas[1].doomThreshold, 12 + 2)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
})

test('混乱袋额外加入 1 个旧神标记（只在本次冒险生效）', () => {
  const state = stateFor(1)
  state.chaosBag = ['0', 'skull', 'elderthing']
  state.campaign.chaosBag = ['0', 'skull', 'elderthing']
  behavior.afterChaosBagSetup(state, [])
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length, 2)
  assert.equal(state.campaign.chaosBag.filter(token => token === 'elderthing').length, 1)
})

test('第一幕推进：时间石室洗入探索牌库，本幕进胜利区并获得复仇 2', () => {
  const state = setup(stateFor(2))
  const api = runtimeApi(state)
  const act = state.acts[0]
  state.actIndex = 1
  behavior.actReveal(state, act, api)
  assert.ok(state.explorationDeck.includes('chamberOfTime'))
  assert.equal(state.scenarioFlags.chamberOfTimeInDeck, true)
  assert.deepEqual(state.scenarioZones.setAsideLocations, [])
  const entry = state.victoryDisplay.find(card => card.id === 'act1')
  assert.equal(entry.vengeance, 2)
  assert.equal(entry.originalCode, '04345')
})

test('时间石室入场：古代遗物附属于此并放置 1 个毁灭', () => {
  const state = setup(stateFor(2))
  const api = runtimeApi(state)
  state.locations.push({
    ...clone(state.scenario.locations.chamberOfTime), id: 'chamberOfTime',
    revealed: false, clues: 2 * state.numInvestigators, doom: 0,
  })
  state.investigators[0].location = 'secretPassage'
  const chamber = state.locations.find(location => location.id === 'chamberOfTime')
  behavior.locationRevealed(state, chamber, api)
  assert.deepEqual(state.relicOfAges, { code: '04061', location: 'chamberOfTime', seat: null })
  assert.equal(chamber.doom, 1)
  assert.equal(state.scenarioZones.setAside.includes('04061'), false)
  behavior.locationRevealed(state, chamber, api)
  assert.equal(chamber.doom, 1, '只结算一次')
})

test('第二幕推进：时间石室中的调查员取得古代遗物，伊格现身', () => {
  const state = setup(stateFor(2))
  const api = runtimeApi(state)
  state.actIndex = 2
  state.locations.push({
    ...clone(state.scenario.locations.chamberOfTime), id: 'chamberOfTime',
    revealed: true, clues: 0, doom: 1,
  })
  state.investigators[0].location = 'chamberOfTime'
  state.investigators[1].location = 'chamberOfTime'
  behavior.actReveal(state, state.acts[1], api)
  assert.equal(state.investigators[0].assets.some(asset => asset.code === '04061'), true)
  assert.deepEqual(state.relicOfAges, { code: '04061', location: 'chamberOfTime', seat: 0 })
  const yig = state.enemies.find(enemy => enemy.code === '04296')
  assert.equal(yig.location, 'chamberOfTime')
  assert.equal(state.victoryDisplay.find(card => card.id === 'act2').vengeance, 2)
  assert.equal(state.scenarioZones.setAside.includes('04296'), false)
})

test('古代遗物与伊格：第三幕行动检定成功后翻线索为毁灭并造成 3 点伤害', () => {
  const state = placed(stateFor(1), ['chamberOfTime'])
  setup(state)
  state.actIndex = 2
  const api = runtimeApi(state)
  api.choose = request => (request.kind === 'skill' ? 'intellect' : '0')
  const inv = state.investigators[0]
  inv.location = 'chamberOfTime'
  inv.clues = 1
  api.giveAsset(0, '04061')
  const yig = api.spawn('04296', 'chamberOfTime')
  const moves = behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule), ['relicOfAgesStrike'])
  behavior.performAction(state, inv, moves[0], api)
  assert.equal(inv.clues, 0)
  assert.equal(state.locations.find(location => location.id === 'chamberOfTime').doom, 1)
  assert.equal(yig.damageTaken, 3)
})

test('伊格：所在地点有另一个处于重整状态的蛇族敌人时不能受到伤害', () => {
  const state = placed(stateFor(2))
  const yig = { id: 'yig', code: '04296', originalCode: '04296', location: 'entryway',
    traits: ['Ancient One', 'Serpent', 'Elite'], exhausted: false }
  const snake = { id: 'snake', code: '04083', originalCode: '04083', location: 'entryway',
    traits: ['Humanoid', 'Monster', 'Serpent'], exhausted: false }
  state.enemies.push(yig, snake)
  assert.equal(behavior.enemyDamageAllowed(state, yig, null, 0), false)
  snake.exhausted = true
  assert.equal(behavior.enemyDamageAllowed(state, yig, null, 0), true)
  // 伊格会让所在地点的其他蛇族获得警戒与反击。
  behavior.enemyPhaseStart(state, runtimeApi(state))
  assert.equal(snake.alert, true)
  assert.equal(snake.retaliate, true)
})

test('瓦卢西亚的预示者：攻击成功后累积资源，满 2×人数时带着伤害放在一边', () => {
  const state = placed(stateFor(1))
  const api = runtimeApi(state)
  const enemy = api.spawn('04062', 'entryway')
  enemy.damageTaken = 4
  const inv = state.investigators[0]
  behavior.enemyAttackedSuccessfully(state, inv, enemy, api)
  assert.equal(enemy.resources, 1)
  assert.equal(state.enemies.length, 1)
  behavior.afterEvade(state, inv, enemy, { success: true }, api)
  assert.equal(state.enemies.length, 0, '1 名调查员时 2 点资源即遁去')
  assert.equal(state.scenarioZones.setAside.includes('04062'), true)
  assert.equal(state.scenarioFlags.harbingerDamage, 4)
})

test('密谋推进：预示者在毁灭最多的地点苏醒，并保留此前伤害', () => {
  const state = placed(stateFor(2), ['entryway', 'ancientHall'])
  setup(state)
  state.scenarioFlags.harbingerDamage = 6
  state.locations.find(location => location.id === 'ancientHall').doom = 3
  const api = runtimeApi(state)
  behavior.agendaReveal(state, state.agendas[0], api)
  const harbinger = state.enemies.find(enemy => enemy.code === '04062')
  assert.equal(harbinger.location, 'ancientHall')
  assert.equal(harbinger.damageTaken, 6)
})

test('密谋推进：神庙看守者推进后未撤退的调查员全部被击败，进入无结局', () => {
  const state = setup(stateFor(2))
  const api = runtimeApi(state)
  state.investigators[1].resigned = true
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.investigators[0].defeated, true)
  assert.notEqual(state.investigators[1].defeated, true)
  assert.equal(state.finished, 'noResolution')
})

test('坑葬墓室：探索成功后抽遭遇牌或放置毁灭（可组合）', () => {
  const state = placed(stateFor(1), ['burialPit'])
  setup(state)
  const api = runtimeApi(state)
  const answers = ['draw', 'doom']
  api.choose = () => answers.shift()
  behavior.afterExplore(state, state.investigators[0], { code: 'burialPit', kind: 'location', runtime: api })
  assert.deepEqual(api.drawn, [0])
  assert.equal(state.locations.find(location => location.id === 'burialPit').doom, 1)
})

test('古代石厅：轮末把 1 个线索翻至毁灭，调查员可花 3 资源取消', () => {
  const state = placed(stateFor(1), ['ancientHall'])
  setup(state)
  const hall = state.locations.find(location => location.id === 'ancientHall')
  hall.clues = 2
  state.investigators[0].location = 'ancientHall'
  const api = runtimeApi(state)
  api.choose = () => 'cancel'
  behavior.roundEnded(state, api)
  assert.equal(hall.clues, 2)
  assert.equal(hall.doom, 0)
  assert.equal(state.investigators[0].resources, 2)
  state.investigators[0].resources = 0
  behavior.roundEnded(state, api)
  assert.equal(hall.clues, 1)
  assert.equal(hall.doom, 1)
})

test('华美石室：调查失败或未超过难度 2 点时先把 1 个线索翻至毁灭', () => {
  const state = placed(stateFor(1), ['grandChamber'])
  setup(state)
  const hall = state.locations.find(location => location.id === 'grandChamber')
  hall.clues = 2
  const inv = state.investigators[0]
  inv.location = 'grandChamber'
  const api = runtimeApi(state)
  behavior.afterTest(state, inv, {
    success: true, value: 4, difficulty: 3, skill: 'intellect',
    source: { label: '调查' }, drawn: [],
  }, api)
  assert.equal(hall.clues, 1)
  assert.equal(hall.doom, 1)
  behavior.afterTest(state, inv, {
    success: true, value: 6, difficulty: 3, skill: 'intellect',
    source: { label: '调查' }, drawn: [],
  }, api)
  assert.equal(hall.clues, 1, '超过难度 2 点时不触发')
})

test('秘密通道：进入时受伤或放置毁灭，带绳索则忽略', () => {
  const state = placed(stateFor(1), ['secretPassage'])
  setup(state)
  const inv = state.investigators[0]
  const location = state.locations[0]
  const api = runtimeApi(state)
  api.checkSupplies = (seat, name) => name === 'rope'
  behavior.locationEntered(state, inv, location, api)
  assert.equal(inv.damage, 0)
  assert.equal(inv.horror, 0)
  assert.equal(location.doom, 0)
  const harsh = runtimeApi(state, { checkSupplies: () => false, choose: () => 'harm' })
  behavior.locationEntered(state, inv, location, harsh)
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  const doom = runtimeApi(state, { checkSupplies: () => false, choose: () => 'doom' })
  behavior.locationEntered(state, inv, location, doom)
  assert.equal(location.doom, 1)
})

test('地下遗迹：有敌人离场时在其上放置 1 个毁灭标记', () => {
  const state = placed(stateFor(1), ['undergroundRuins'])
  setup(state)
  const ruins = state.locations.find(location => location.id === 'undergroundRuins')
  const api = runtimeApi(state)
  const enemy = api.spawn('04083', 'undergroundRuins')
  enemy.location = 'secretPassage'
  behavior.enemyMoved(state, enemy, 'undergroundRuins', api)
  assert.equal(ruins.doom, 1)
  enemy.location = 'undergroundRuins'
  behavior.enemyDefeated(state, enemy, api)
  assert.equal(ruins.doom, 2)
})

test('本章遭遇牌：地窖寒风失败弃支援、朦胧之雾附属并 +2 隐藏值', () => {
  const state = placed(stateFor(1))
  setup(state)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'asset-x', code: '01020', originalCode: '01020', name: '手电筒' })
  const failing = runtimeApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
  })
  behavior.resolveEncounter(state, inv, { code: '01167', originalCode: '01167' }, failing)
  assert.equal(inv.assets.length, 0)
  const api = runtimeApi(state)
  behavior.resolveEncounter(state, inv, { code: '01168', originalCode: '01168' }, api)
  assert.equal(inv.location, 'entryway')
  const entry = state.locations.find(location => location.id === 'entryway')
  // 朦胧之雾走引擎的 location.fog / shroudMod 通道：成功后由引擎弃掉并放回遭遇弃牌堆。
  assert.equal(entry.fog, 1)
  assert.equal(entry.shroudMod, 2)
  assert.equal(entry.fogCode, '01168')
  // 同一地点再来一张会叠加（每张 +2 帷幕），不再白送遭遇。
  const draws = []
  behavior.resolveEncounter(state, inv, { code: '01168', originalCode: '01168' },
    runtimeApi(state, { drawEncounter: seat => draws.push(seat) }))
  assert.deepEqual(draws, [])
  assert.equal(entry.fog, 2)
  assert.equal(entry.shroudMod, 4)
})

test('本章遭遇牌：致命错误按所在地点毁灭数提高难度并造成 2 点伤害', () => {
  const state = placed(stateFor(1))
  setup(state)
  const inv = state.investigators[0]
  state.locations[0].doom = 2
  const seen = []
  const api = runtimeApi(state, {
    choose: () => '0',
    test: (seat, skill, difficulty, resolve) => {
      seen.push({ skill, difficulty })
      resolve({ success: false, value: 0, difficulty, skill })
    },
    damage: (seat, n) => { state.investigators[seat].damage += n },
  })
  behavior.resolveEncounter(state, inv, { code: '04088', originalCode: '04088' }, api)
  assert.deepEqual(seen, [{ skill: 'agility', difficulty: 4 }])
  assert.equal(inv.damage, 2)
})

test('本章遭遇牌：不祥之兆在所选地点放置毁灭并让调查员受到恐惧', () => {
  const state = placed(stateFor(1))
  setup(state)
  const inv = state.investigators[0]
  const api = runtimeApi(state, {
    choose: request => (request.kind === 'location' ? 'entryway' : '0'),
  })
  behavior.resolveEncounter(state, inv, { code: '04092', originalCode: '04092' }, api)
  assert.equal(state.locations[0].doom, 1)
  assert.equal(inv.horror, 1)
})

test('入口行动：撤退与检查补给品（火把弃掉探索牌库顶的诡计）', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  inv.location = 'entryway'
  const api = runtimeApi(state)
  const moves = behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule), ['resignEntryway', 'inspectSupplies'])
  behavior.performAction(state, inv, moves[0], api)
  assert.equal(inv.resigned, true)
  inv.resigned = false
  state.explorationDeck = ['ancientHall', '04092']
  const withTorches = runtimeApi(state, { checkSupplies: (seat, name) => name === 'torches' })
  behavior.performAction(state, inv, moves[1], withTorches)
  assert.equal(state.explorationDiscard.includes('04092'), true)
  assert.deepEqual(state.explorationDeck, ['ancientHall'])
})

test('结局：无结局写入时间之布被拆解并让调查员疯狂；结局 1 封印遗物', () => {
  const state = setup(stateFor(2))
  const api = runtimeApi(state)
  const first = behavior.resolution(state, 'noResolution', [], api)
  assert.deepEqual(first, { award: false, bonus: 0 })
  assert.equal(state.campaign.records.theFabricOfTimeIsUnwoven, true)
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.deepEqual(api.trauma.map(entry => entry.seat), [0, 1])
  const second = behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(second, { award: true, bonus: 0 })
  assert.equal(state.campaign.records.theInvestigatorsSealedTheRelicOfAgesForever, true)
  assert.throws(() => behavior.resolution(state, 'r9', [], api))
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
})

test('三幕全流程：时间石室 → 古代遗物与伊格 → 结局 1，且同种子结果一致', () => {
  const run = () => {
    const state = setup(stateFor(2), setupApi(41))
    const api = runtimeApi(state)
    api.choose = () => '0'
    const advance = () => {
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      behavior.actReveal(state, act, api)
    }
    // 第一幕：探索牌库里已经有时室，推进后时室洗入牌库。
    advance()
    // 第二幕：手动把时室放好，让调查员在里面。
    state.locations.push({
      ...clone(state.scenario.locations.chamberOfTime), id: 'chamberOfTime',
      revealed: true, clues: 0, doom: 1,
    })
    state.investigators.forEach(inv => { inv.location = 'chamberOfTime' })
    advance()
    // 第三幕：伊格被击败后推进到结局 1。
    advance()
    return state
  }
  const first = run()
  const second = run()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同种子完全可复现')
  assert.equal(first.finished, 'r1')
  assert.equal(first.enemies.some(enemy => enemy.code === '04296'), true)
  assert.deepEqual(first.victoryDisplay.map(card => card.id).sort(), ['act1', 'act2'])
  assert.equal(first.actIndex, 3)
})

test('遭遇牌库与探索牌库按原卡数量拆分', () => {
  const deck = definition.encounterDeck
  assert.equal(deck.length, 29)
  assert.equal(deck.includes('04062'), false, '预示者在一边')
  assert.equal(deck.includes('04102'), false, '中毒弱点在一边')
  assert.equal(deck.includes('04296'), false, '伊格不在遭遇牌库')
  assert.equal(deck.filter(code => code === '04088').length, 2, '探索牌库占用 1 张致命错误')
  assert.equal(deck.filter(code => code === '04089').length, 1)
  assert.equal(deck.filter(code => code === '04092').length, 1)
  assert.equal(deck.filter(code => code === '04094').length, 2)
  assert.equal(deck.filter(code => code === '01167').length, 1)
  assert.equal(deck.filter(code => code === '01168').length, 2)
  assert.equal(deck.filter(code => code === '04083').length, 3)
  assert.equal(deck.filter(code => code === '04098').length, 2)
})

test('混乱标记沿用本章表：颅骨按毁灭地点数、旧神标记在困难 -6', () => {
  const state = placed(stateFor(1), ['entryway', 'ancientHall'])
  const inv = state.investigators[0]
  state.locations[1].doom = 2
  state.difficulty = 'standard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -2)
  state.difficulty = 'standard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, 0)
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing', {}).delta, -4)
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing', {}).delta, -6)
  state.difficulty = 'standard'
  inv.location = 'entryway'
  const entry = state.locations.find(location => location.id === 'entryway')
  behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 3, skill: 'willpower',
    source: { label: '遭遇' }, drawn: ['elderthing'],
  }, runtimeApi(state))
  assert.equal(entry.doom, 1, '普通/简单：旧神标记检定失败时在所在地点放置毁灭')
})

test('导入阶段保留最上面三条记录，其余划掉（划掉的记录不再被读取）', () => {
  const state = stateFor(2)
  state.campaign.records = {
    theInvestigatorsWereForcedToWaitForAdditionalSupplies: true,
    theInvestigatorsTurnedBackTime: true,
    theBraziersAreLit: true,
    yigsFury: 3,
  }
  const messages = []
  behavior.preScenarioSetup(state, [], { info: text => messages.push(text) })
  assert.ok(messages.some(text => text.includes('等待额外补给')))
  assert.ok(messages.some(text => text.includes('改写了命运')))
  assert.ok(messages.some(text => text.includes('火盆')))
  assert.equal(messages.some(text => text.includes('伊格之怒累计 3 点')), false,
    '被划掉的记录对后续逻辑等同于不存在')
  assert.deepEqual(Object.keys(state.campaign.records).sort(),
    ['theBraziersAreLit', 'theInvestigatorsTurnedBackTime',
      'theInvestigatorsWereForcedToWaitForAdditionalSupplies'])
  assert.deepEqual(state.campaign.crossedRecords, ['yigsFury'])
  assert.deepEqual(state.campaign.crossedRecordEntries, [{ key: 'yigsFury', value: 3 }])
})

test('本章实现的遭遇卡原卡号清单不包含近似实现', () => {
  assert.deepEqual(behavior.implementedEncounterCodes, implementedEncounterCodes)
  for (const code of ['01167', '01168', '04083', '04084', '04085', '04088', '04089', '04090',
    '04091', '04092', '04093', '04094', '04098', '04099', '04100', '04101', '04102', '04296']) {
    assert.ok(implementedEncounterCodes.includes(code), code)
  }
  assert.equal(implementedEncounterCodes.includes('04062'), true, '预示者的「横置也能反击」已由引擎钩子接上')
  for (const code of Object.keys(definition.enemies)) {
    assert.ok(implementedEncounterCodes.includes(code), `缺少 ${code}`)
  }
  for (const code of Object.keys(definition.treacheries)) {
    assert.ok(implementedEncounterCodes.includes(code), `缺少 ${code}`)
  }
})

test('导入：等待额外补给时只保留最上面三条记录，其余记入 crossedRecords', () => {
  const state = placed(stateFor(1))
  state.campaign.records = {
    a: true, b: true, c: true, d: true, e: true,
    theInvestigatorsWereForcedToWaitForAdditionalSupplies: true,
  }
  const logs = []
  behavior.preScenarioSetup(state, [], { info: text => logs.push(text) })
  assert.deepEqual(state.campaign.crossedRecords,
    ['d', 'e', 'theInvestigatorsWereForcedToWaitForAdditionalSupplies'])
  assert.ok(logs.some(text => text.includes('只保留最上面三条记录')))
})
