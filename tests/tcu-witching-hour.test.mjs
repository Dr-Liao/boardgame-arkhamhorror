// 巫异时刻（theWitchingHour · 05050）章节测试（P8 worker w-witch）。
//
// 两层证据：
//   1. 章节钩子（behavior）——setup/区域、面前地点的移动限制、幕/议程流程、混乱标记、结局/记录、存档往返；
//   2. 单卡条目（encounter-entries）——逐卡 actRule/agendaRule/locationRule/enemyRule 的规则行为。
//      （索引由 Lead 合并后重建，因此条目逻辑直接 import 单卡文件验证，不依赖 implementedFor。）
import test from 'node:test'
import assert from 'node:assert/strict'
// 引擎装配点注册能力层（修正读点等）。
import '../src/engine/engine.js'
import * as witchingHour from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/index.js'
import {
  scenario as definition, WOODS, ARKHAM_WOODS, ANETTE_MASON, WITCHES_CIRCLE,
  DAEMONIC_PIPING, GOAT_SPAWN, RELENTLESS_DARK_YOUNG,
} from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/definition.js'
import { CAMPAIGN_CARDS } from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/behavior.js'
import mine from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05058.js'
import cairnStones from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05059.js'
import lonelyTree from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05060.js'
import treeHouse from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05061.js'
import hermitHouse from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05063.js'
import witchCircleLocation from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05055b.js'
import lostInTheWoodsAct from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05053.js'
import witchHauntingsAct from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05054.js'
import pathsAct from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05055.js'
import circleUnbrokenAct from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05056.js'
import temperance from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05051.js'
import nightHowls from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05052.js'
import anetteEntry from '../src/cards/encounter-entries/theCircleUndone/_shared/the_witching_hour/05057.js'
// 核心包 agents_of_shub 组的条目由归属算法放在 shared/（Lead 已移动，内容不变）。
import goatSpawnEntry from '../src/cards/encounter-entries/shared/agents_of_shub/01180.js'
import darkYoungEntry from '../src/cards/encounter-entries/shared/agents_of_shub/01179.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(randomValue() * (index + 1))
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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'abandonedMine',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', '-1', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

// 与引擎 placeLocation 相同的语义：把 definition 里的地点复制入场。
function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(inv => inv.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
}

function setup(state, seed = 1) {
  witchingHour.behavior.setupLocations(state, [], setupApi(seed))
  placeLocations(state, Object.keys(state.scenario.locations).filter(id => id !== 'witchesCircle'
    && !ARKHAM_WOODS.some(entry => entry.id === id) && state.scenarioFlags.frontOf?.[id] != null))
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

function ensureWoodInPlay(state, code) {
  const existing = state.locations.find(location => location.code === code)
  if (existing) {
    state.investigators[0].location = existing.id
    return existing
  }
  const entry = Object.entries(state.scenario.locations).find(([, value]) => value.code === code)
  const definition = state.scenario.locations[entry[0]]
  const location = { ...clone(definition), id: entry[0], revealed: true,
    clues: definition.cluesPerInvestigator || 0, maxClues: definition.cluesPerInvestigator || 0, doom: 0 }
  state.locations.push(location)
  state.investigators[0].location = location.id
  return location
}
const woodIds = () => WOODS.map(entry => entry.id)

function apiStub(state, overrides = {}) {
  return {
    info: () => {},
    choose: () => 'skip',
    random: () => 0.5,
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    defeat: (inv) => { inv.defeated = true },
    trauma: (seat, kind, amount) => { state.campaign.records.trauma = { seat, kind, amount } },
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    healEnemy: (enemy, amount = 1) => {
      const before = enemy.damageTaken || 0
      enemy.damageTaken = Math.max(0, before - amount)
      return before - enemy.damageTaken
    },
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      state.scenarioFlags[key] = value
    },
    place: (id) => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const location = { ...clone(base), id, revealed: false, clues: 0, maxClues: base.cluesPerInvestigator || 0, doom: 0 }
      state.locations.push(location)
      return location
    },
    reveal: (id) => {
      const location = loc(state, id)
      if (location) { location.revealed = true; location.clues = location.maxClues }
    },
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty + 1, difficulty, skill }),
    evadeEnemy: (enemy) => { enemy.exhausted = true; enemy.engagedSeat = null },
    drawCards: (seat, n) => { state.investigators[seat].hand.push(...Array(n).fill('01001')) },
    discardRandom: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    advanceAct: () => { state.actIndex += 1 },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    finish: key => { state.resolutionKey = key },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    payClues: (n) => { let left = n; for (const inv of state.investigators) { const spend = Math.min(inv.clues, left); inv.clues -= spend; left -= spend } },
    addBasicWeakness: (seat) => `weakness-${seat}`,
    shuffleEncounterDeck: () => {},
    locName: id => loc(state, id)?.name || id,
    stepToward: (from, to) => to,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('05050 章节清单：playable、原卡、地点/幕/议程/结局数量', () => {
  assert.equal(witchingHour.manifest.status, 'playable')
  assert.equal(witchingHour.manifest.campaignId, 'theCircleUndone')
  assert.equal(witchingHour.manifest.catalogReferenceOnly, undefined)
  assert.equal(witchingHour.scenario.originalCode, '05050')
  assert.equal(witchingHour.manifest.locations.length, 14, '7 森林 + 女巫圆环 + 6 阿卡姆密林')
  assert.deepEqual(witchingHour.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(witchingHour.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(witchingHour.manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
  assert.equal(witchingHour.manifest.startLocationId, 'abandonedMine')
})

test('身份登记：每个地点/幕/议程/敌人都有原卡身份且 mapped', () => {
  const categories = witchingHour.identities
  for (const category of ['locations', 'acts', 'agendas', 'enemies']) {
    for (const [id, identity] of Object.entries(categories[category])) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(categories.locations.witchesCircle.originalCode, WITCHES_CIRCLE)
  assert.equal(categories.enemies[ANETTE_MASON].originalCode, ANETTE_MASON)
})

// ---------------------------------------------------------------------------
// 2. setup / 区域 / 面前地点
// ---------------------------------------------------------------------------
test('setup 是确定性的：同种子同一分配，不同种子不同，5 张入场 2 张移出', () => {
  const build = seed => {
    const state = stateFor(3)
    const ids = witchingHour.behavior.setupLocations(state, [], setupApi(seed))
    return { ids, flags: clone(state.scenarioFlags), zones: clone(state.scenarioZones) }
  }
  const first = build(7)
  const second = build(7)
  assert.deepEqual(first.ids, second.ids)
  assert.deepEqual(first.flags.frontOf, second.flags.frontOf)
  assert.equal(first.ids.length, 5)
  assert.deepEqual([...first.ids].sort(), [...first.ids].sort())
  assert.equal(first.zones.removed.length, 2)
  assert.notDeepEqual(build(8).ids, first.ids)
  assert.deepEqual([...first.ids, ...first.zones.removed.map(code => WOODS.find(entry => entry.code === code).id)].sort(),
    [...woodIds()].sort())
})

test('setup 把使徒组、安妮特、6 张阿卡姆密林与圆环放在一边', () => {
  const state = setup(stateFor(2), 3)
  const aside = state.scenarioZones.setAside
  assert.equal(aside.filter(code => code === DAEMONIC_PIPING).length, 3)
  assert.equal(aside.filter(code => code === GOAT_SPAWN).length, 3)
  assert.equal(aside.filter(code => code === RELENTLESS_DARK_YOUNG).length, 1)
  assert.equal(aside.filter(code => code === ANETTE_MASON).length, 1)
  assert.equal(aside.filter(code => code === WITCHES_CIRCLE).length, 1)
  for (const entry of ARKHAM_WOODS) assert.ok(aside.includes(entry.code), entry.code)
})

test('setup 按玩家顺序分配面前地点：2 人 = 队长 3 / 另一位 2；每人从自己面前开始', () => {
  const state = stateFor(2)
  witchingHour.behavior.setupLocations(state, [], setupApi(5))
  const fronts = state.scenarioFlags.frontOf
  const bySeat = [0, 1].map(seat => Object.values(fronts).filter(owner => owner === seat).length)
  assert.deepEqual(bySeat, [3, 2])
  for (const inv of state.investigators) {
    assert.equal(fronts[inv.location], inv.seat, '起始地点必须是自己面前的地点')
  }
})

test('面前地点限制：act1/act2 不能进入别人的地点，act3 起解锁', () => {
  const state = setup(stateFor(2), 11)
  const fronts = state.scenarioFlags.frontOf
  const othersFront = Object.keys(fronts).find(id => fronts[id] === 1)
  const inv = state.investigators[0]
  const blocked = witchingHour.behavior.moveError(state, inv, loc(state, othersFront), othersFront)
  assert.equal(typeof blocked, 'string')
  state.actIndex = 1
  assert.equal(typeof witchingHour.behavior.moveError(state, inv, loc(state, othersFront), othersFront), 'string')
  state.actIndex = 2
  assert.equal(witchingHour.behavior.moveError(state, inv, loc(state, othersFront), othersFront), undefined)
  // 自己的地点永远可进。
  const ownFront = Object.keys(fronts).find(id => fronts[id] === 0)
  assert.equal(witchingHour.behavior.moveError(state, inv, loc(state, ownFront), ownFront), undefined)
})

test('05053/05054 面前地点限制：movementError 读点覆盖效果移动与所有阶段，act2 背面解锁', () => {
  const state = setup(stateFor(2), 17)
  const fronts = state.scenarioFlags.frontOf
  const othersFront = Object.keys(fronts).find(id => fronts[id] === 1)
  const inv = state.investigators[0]
  // 引擎 movementError 现在传目标地点并在所有阶段询问章节：效果移动（relocateInvestigator 等）同样被拦。
  assert.equal(typeof witchingHour.behavior.movementError(state, inv, loc(state, othersFront)), 'string',
    '调查阶段的效果移动被拒')
  state.phase = 'mythos'
  assert.equal(typeof witchingHour.behavior.movementError(state, inv, loc(state, othersFront)), 'string',
    '神话阶段的效果移动同样被拒')
  state.phase = 'investigation'
  const ownFront = Object.keys(fronts).find(id => fronts[id] === 0)
  assert.equal(witchingHour.behavior.movementError(state, inv, loc(state, ownFront)), undefined, '自己的地点可进')
  // 没有「面前」归属的地点不拦（例如非森林/女巫圆环）。
  const ownerless = ensureWoodInPlay(state, '05058')
  assert.equal(witchingHour.behavior.movementError(state, state.investigators[1], ownerless), undefined,
    '无主地点可进')
  assert.equal(witchingHour.behavior.movementError(state, inv, undefined), undefined, '无目标地点不拦')
  state.actIndex = 2
  assert.equal(witchingHour.behavior.movementError(state, inv, loc(state, othersFront)), undefined, 'act2 背面解锁')
})

test('印刷符号图：森林彼此相连，女巫圆环连到所有森林', () => {
  const mineLoc = definition.locations.abandonedMine
  assert.ok(mineLoc.connections.includes('cairnStones'))
  assert.ok(mineLoc.connections.includes('hermitsHouse'))
  assert.deepEqual([...definition.locations.witchesCircle.connections].sort(), [...woodIds()].sort())
  // 6 张阿卡姆密林静态接线非空（运行时按面前组重接）。
  for (const entry of ARKHAM_WOODS) assert.ok(definition.locations[entry.id].connections.length > 0, entry.id)
})

// ---------------------------------------------------------------------------
// 3. 介绍 / 混乱袋
// ---------------------------------------------------------------------------
test('介绍 2「避免命运」：记录接受命运、+2 tablet、队长获得高塔/权杖王牌', () => {
  const state = stateFor(2)
  const choices = ['avoidFate', 'takeCards']
  const api = apiStub(state, { choose: () => choices.shift() })
  witchingHour.behavior.preScenarioSetup(state, [], api)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 0, '混乱袋重建前不直接加（会被 setupChaosBag 覆盖）')
  assert.equal(state.scenarioFlags.fateChaosToken, 'tablet')
  witchingHour.behavior.afterChaosBagSetup(state, [])
  assert.equal(state.campaign.records.youHaveAcceptedYourFate, true)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
  assert.ok(state.campaign.investigators[0].deck.includes(CAMPAIGN_CARDS.towerXVI))
  assert.ok(state.campaign.investigators[0].deck.includes(CAMPAIGN_CARDS.aceOfRods))
  assert.equal(state.scenarioFlags.introResolved, true)
})

test('介绍 3「一派胡言」：记录拒绝命运、+2 elderthing、不拿战役卡', () => {
  const state = stateFor(1)
  const api = apiStub(state, { choose: () => 'bullshit' })
  witchingHour.behavior.preScenarioSetup(state, [], api)
  witchingHour.behavior.afterChaosBagSetup(state, [])
  assert.equal(state.campaign.records.youHaveRejectedYourFate, true)
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length, 2)
  assert.equal(state.campaign.investigators[0].deck.length, 0)
})

test('介绍 2 后可进行 8 张固定战役占卜（只读 tarot.js 数据）', () => {
  const state = stateFor(1)
  const choices = ['avoidFate', 'performTarotReading']
  const api = apiStub(state, { choose: () => choices.shift() })
  witchingHour.behavior.preScenarioSetup(state, [], api)
  assert.equal(state.scenarioFlags.campaignReading.length, 8)
  assert.equal(state.scenarioFlags.campaignReading[0].scenarioId, 'theWitchingHour')
  assert.equal(state.scenarioFlags.campaignReading[7].arcana, 10)
})

// ---------------------------------------------------------------------------
// 4. 幕 / 议程
// ---------------------------------------------------------------------------
test('act1 背面：放阿卡姆密林到面前、生成黑山羊、成功检定横置、笛声 1 洗入 + 2 弃', () => {
  const state = setup(stateFor(2), 13)
  const placed = []
  const api = apiStub(state, {
    place: id => {
      const base = state.scenario.locations[id]
      const location = { ...clone(base), id, revealed: false, clues: 0, maxClues: 0, doom: 0 }
      state.locations.push(location)
      placed.push(id)
      return location
    },
  })
  const act = state.acts[0]
  witchingHour.behavior.actReveal(state, act, api)
  assert.equal(placed.length, 2, '每位调查员放 1 张阿卡姆密林')
  for (const inv of state.investigators) {
    assert.ok(ARKHAM_WOODS.some(entry => entry.id === inv.location), '移动到自己面前的阿卡姆密林')
    assert.equal(state.scenarioFlags.frontOf[inv.location], inv.seat)
  }
  assert.equal(state.enemies.length, 2, '每人生成 1 只黑山羊眷族')
  assert.ok(state.enemies.every(enemy => enemy.exhausted === false || enemy.exhausted === true))
  assert.equal(state.encounterDiscard.filter(code => code === DAEMONIC_PIPING).length, 2, '另外 2 张魔鬼的笛声进遭遇弃牌堆')
  assert.equal(state.encounterDeck.filter(code => code === DAEMONIC_PIPING).length, 1, '1 张魔鬼的笛声洗入遭遇牌库')
  assert.equal(state.scenarioZones.setAside.includes(DAEMONIC_PIPING), false, '3 张笛声全部离开放一边')
})

test('act2 背面：解锁进入其他调查员面前的地点', () => {
  const state = setup(stateFor(2), 17)
  witchHauntingsAct.actRule.onReveal(state, state.acts[1], apiStub(state))
  assert.equal(state.scenarioFlags.frontsUnlocked, true)
})

test('act3 背面：放置女巫圆环；圆环显现生成 set aside 的安妮特', () => {
  const state = setup(stateFor(2), 19)
  const placed = []
  const api = apiStub(state, {
    place: id => {
      const location = { ...clone(state.scenario.locations[id]), id, revealed: false, clues: 3, maxClues: 3, doom: 0 }
      state.locations.push(location)
      placed.push(id)
      return location
    },
    reveal: id => { const location = loc(state, id); if (location) location.revealed = true },
  })
  pathsAct.actRule.onReveal(state, state.acts[2], api)
  assert.deepEqual(placed, ['witchesCircle'])
  assert.ok(state.scenarioZones.setAside.includes(ANETTE_MASON))
  witchCircleLocation.locationRule.onReveal(state, loc(state, 'witchesCircle'), api)
  assert.equal(state.scenarioZones.setAside.includes(ANETTE_MASON), false)
  assert.ok(state.enemies.some(enemy => enemy.code === ANETTE_MASON && enemy.location === 'witchesCircle'))
})

test('act4 目标：击败安妮特或清空女巫圆环线索后推进', () => {
  const defeated = setup(stateFor(1), 23)
  defeated.actIndex = 3
  defeated.scenarioFlags.anetteDefeated = true
  let advanced = 0
  witchingHour.behavior.checkObjectives(defeated, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 1)
  assert.equal(defeated.scenarioFlags.actFourOutcome, 'defeatedAnette')

  const cleared = setup(stateFor(1), 29)
  cleared.actIndex = 3
  cleared.locations.push({ ...clone(cleared.scenario.locations.witchesCircle), id: 'witchesCircle', revealed: true, clues: 0, maxClues: 3 })
  witchingHour.behavior.checkObjectives(cleared, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 2)
  assert.equal(cleared.scenarioFlags.actFourOutcome, 'brokeTheCircle')
})

test('act4 背面按来源结算结局 1 / 结局 2', () => {
  const first = setup(stateFor(1), 31)
  first.scenarioFlags.actFourOutcome = 'defeatedAnette'
  circleUnbrokenAct.actRule.onReveal(first, first.acts[3], apiStub(first))
  assert.equal(first.resolutionKey, 'resolution1')
  const second = setup(stateFor(1), 31)
  second.scenarioFlags.actFourOutcome = 'brokeTheCircle'
  circleUnbrokenAct.actRule.onReveal(second, second.acts[3], apiStub(second))
  assert.equal(second.resolutionKey, 'resolution2')
})

test('agenda1 背面：遭遇牌库弃到剩 5 张，并从弃牌堆顶部抽出女巫敌人', () => {
  const state = setup(stateFor(2), 37)
  state.encounterDeck = Array.from({ length: 8 }, () => '05092')
  state.encounterDiscard = ['01166', '05090']
  const spawned = []
  const api = apiStub(state, { spawn: (code, location) => { spawned.push({ code, location }); return null } })
  temperance.agendaRule.onReveal(state, state.agendas[0], api)
  assert.equal(state.encounterDeck.length, 5)
  assert.equal(state.encounterDiscard.length, 4, '弃掉 3 张 + 原有 2 张 - 抽走 1 张女巫敌人')
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].code, '05090', '女巫集会的女巫敌人')
})

test('agenda2 正面强制：圆环内每个女巫敌人放 1 毁灭', () => {
  const state = setup(stateFor(2), 41)
  state.locations.push({ ...clone(state.scenario.locations.witchesCircle), id: 'witchesCircle', revealed: true, clues: 3, maxClues: 3 })
  state.enemies.push(
    { id: 'w1', code: '05090', name: '女巫', location: 'witchesCircle', traits: ['Witch'], engagedSeat: null },
    { id: 'w2', code: '05091', name: '女祭司', location: 'witchesCircle', traits: ['Witch'], engagedSeat: null },
    { id: 'w3', code: '05090', name: '别处女巫', location: state.investigators[0].location, traits: ['Witch'], engagedSeat: null },
  )
  state.agendaIndex = 1
  nightHowls.agendaRule.forced.roundEnd(state, state.agendas[1], apiStub(state))
  assert.equal(state.agendas[1].doom, 2)
})

test('agenda2 背面：存活调查员被击败，能找到弱点的加入牌库，否则 1 精神创伤', () => {
  const state = setup(stateFor(2), 43)
  state.agendaIndex = 1
  const added = []
  const traumas = []
  const api = apiStub(state, {
    addBasicWeakness: (seat, traits) => { added.push({ seat, traits }); return seat === 0 ? 'weakness' : null },
    trauma: (seat, kind, amount) => traumas.push({ seat, kind, amount }),
  })
  nightHowls.agendaRule.onReveal(state, state.agendas[1], api)
  assert.ok(state.investigators.every(inv => inv.defeated))
  assert.deepEqual(added.map(entry => entry.seat), [0, 1])
  assert.deepEqual(traumas, [{ seat: 1, kind: 'mental', amount: 1 }])
})

// ---------------------------------------------------------------------------
// 5. 敌人
// ---------------------------------------------------------------------------
test('安妮特：敌军阶段开始弃遭遇牌库顶 3 张，把女巫敌人生成在所在地点', () => {
  const state = setup(stateFor(1), 47)
  state.locations.push({ ...clone(state.scenario.locations.witchesCircle), id: 'witchesCircle', revealed: true, clues: 3, maxClues: 3 })
  state.enemies.push({ id: 'anette', code: ANETTE_MASON, originalCode: ANETTE_MASON, name: '安妮特',
    location: 'witchesCircle', exhausted: true, engagedSeat: null, damageTaken: 0, traits: ['Witch'] })
  state.encounterDeck = ['01166', '05090', '05098']
  const spawned = []
  const api = apiStub(state, { spawn: (code, location) => { spawned.push({ code, location }); return null } })
  witchingHour.behavior.enemyPhaseStart(state, api)
  assert.deepEqual(spawned, [{ code: '05090', location: 'witchesCircle' }])
  assert.equal(state.encounterDeck.length, 0)
  assert.equal(state.enemies.find(enemy => enemy.id === 'anette').exhausted, true, '弃出女巫敌人时不重整')
})

test('安妮特：没有弃出女巫敌人时重整她自己', () => {
  const state = setup(stateFor(1), 53)
  state.enemies.push({ id: 'anette', code: ANETTE_MASON, originalCode: ANETTE_MASON, name: '安妮特',
    location: state.investigators[0].location, exhausted: true, engagedSeat: null, damageTaken: 0, traits: ['Witch'] })
  state.encounterDeck = ['01166', '05098', '05099']
  witchingHour.behavior.enemyPhaseStart(state, apiStub(state))
  assert.equal(state.enemies.find(enemy => enemy.id === 'anette').exhausted, false)
})

test('安妮特：只弃遭遇牌库顶 3 张（第 4 张是女巫也不多弃、不洗回弃牌堆）', () => {
  const state = setup(stateFor(1), 61)
  state.enemies.push({ id: 'anette', code: ANETTE_MASON, originalCode: ANETTE_MASON, name: '安妮特',
    location: state.investigators[0].location, exhausted: true, engagedSeat: null, damageTaken: 0, traits: ['Witch'] })
  // pop 从末端取：顶 3 张 = 05099、05098、01166（都不是女巫），第 4 张 05090 是女巫。
  state.encounterDeck = ['05090', '01166', '05098', '05099']
  state.encounterDiscard = ['05091']
  const spawned = []
  const api = apiStub(state, { spawn: code => { spawned.push(code); return null } })
  witchingHour.behavior.enemyPhaseStart(state, api)
  assert.deepEqual(spawned, [], '顶 3 张没有女巫 → 不生成、不多弃第 4 张')
  assert.deepEqual(state.encounterDeck, ['05090'], '第 4 张（女巫）留在牌库顶')
  assert.deepEqual(state.encounterDiscard.slice(-3), ['05099', '05098', '01166'], '只弃 3 张进弃牌堆')
  assert.equal(state.encounterDiscard[0], '05091', '不把弃牌堆洗回')
  assert.equal(state.enemies.find(enemy => enemy.id === 'anette').exhausted, false, '没有女巫 → 重整')
})

test('安妮特：牌库不足 3 张时只弃现有张数（不洗回）', () => {
  const state = setup(stateFor(1), 67)
  state.enemies.push({ id: 'anette', code: ANETTE_MASON, originalCode: ANETTE_MASON, name: '安妮特',
    location: state.investigators[0].location, exhausted: true, engagedSeat: null, damageTaken: 0, traits: ['Witch'] })
  state.encounterDeck = ['05090']
  state.encounterDiscard = ['05091', '05098']
  const spawned = []
  const api = apiStub(state, { spawn: code => { spawned.push(code); return null } })
  witchingHour.behavior.enemyPhaseStart(state, api)
  assert.deepEqual(spawned, ['05090'], '顶 1 张是女巫 → 生成')
  assert.equal(state.encounterDeck.length, 0)
  assert.equal(state.encounterDiscard.includes('05090'), false, '生成的女巫离开弃牌堆')
  assert.deepEqual(state.encounterDiscard.slice(-2), ['05091', '05098'], '弃牌堆不被洗回牌库')
})

test('安妮特条目与黑山羊条目：implemented 声明 + 按 code 的卡面规则', () => {
  assert.equal(anetteEntry.implemented, true)
  assert.equal(anetteEntry.enemyRule.retaliate, true)
  // 强制能力已移入条目（跨章生效），不再由章节 behavior 硬编码。
  assert.equal(typeof anetteEntry.enemyScript?.onEnemyPhaseStart, 'function')
  assert.equal(goatSpawnEntry.implemented, true)
  assert.equal(darkYoungEntry.implemented, true)

  const state = setup(stateFor(1), 59)
  state.enemies.push({ id: 'goat', code: GOAT_SPAWN, originalCode: GOAT_SPAWN, name: '黑山羊眷族',
    location: state.investigators[0].location, damageTaken: 0, engagedSeat: null, traits: ['Creature'] })
  witchingHour.behavior.enemyDefeated(state, state.enemies[0], apiStub(state))
  assert.equal(state.investigators[0].horror, 1, '黑山羊被击败：本地点的调查员受到 1 点恐惧')

  state.enemies.push({ id: 'young', code: RELENTLESS_DARK_YOUNG, originalCode: RELENTLESS_DARK_YOUNG,
    name: '黑山羊幼崽', location: state.investigators[0].location, damageTaken: 4, engagedSeat: null, traits: ['Creature'] })
  witchingHour.behavior.roundEnded(state, apiStub(state))
  assert.equal(state.enemies.find(enemy => enemy.id === 'young').damageTaken, 2, '轮末治愈 2 点伤害')
})

test('杂草丛生的谷仓：可选[reaction]改为生成在此并攻击（可放弃/无人不触发/含 api.spawn 路径）', () => {
  const woodsLocation = code => WOODS.some(entry => entry.code === code)
  const make = choose => {
    const state = setup(stateFor(2), 61)
    const barn = ensureWoodInPlay(state, '05064')
    const other = state.locations.find(location => location.code !== '05064' && woodsLocation(location.code))
    assert.ok(barn && other, '谷仓与另一处森林都必须已入场')
    return { state, barn, other, api: apiStub(state, { choose }) }
  }
  // 触发：改为在谷仓生成，然后攻击谷仓本地点的每位调查员。
  const a = make(() => 'trigger')
  assert.equal(witchingHour.behavior.spawnLocation(a.state, 'enemyWithoutEntry', a.other.id, null, a.api), a.barn.id)
  a.state.investigators[1].location = a.barn.id
  const attacks = []
  const enemyA = { id: 'e1', code: 'enemyWithoutEntry', location: a.barn.id, engagedSeat: null }
  witchingHour.behavior.enemySpawned(a.state, enemyA,
    apiStub(a.state, { attack: (entry, inv) => attacks.push(inv.seat) }))
  assert.deepEqual(attacks.sort(), [0, 1], '谷仓本地每位调查员都被攻击')
  // 放弃：不改道。
  const b = make(() => 'skip')
  assert.equal(witchingHour.behavior.spawnLocation(b.state, 'enemyWithoutEntry', b.other.id, null, b.api), b.other.id)
  // 谷仓没有调查员：没有人能触发反应，不改道。
  const c = make(() => 'trigger')
  c.state.investigators[0].location = c.other.id
  assert.equal(witchingHour.behavior.spawnLocation(c.state, 'enemyWithoutEntry', c.other.id, null, c.api), c.other.id)
  // 生成地点本来就是谷仓：不询问、不追加攻击。
  let asked = 0
  const d = make(() => { asked += 1; return 'trigger' })
  assert.equal(witchingHour.behavior.spawnLocation(d.state, 'enemyWithoutEntry', d.barn.id, null, d.api), d.barn.id)
  assert.equal(asked, 0)
  // 剧本 api.spawn（ignoreSpawn）路径：enemySpawned 里同样先问可选反应再改道+攻击。
  const e = make(() => 'trigger')
  const moved = { id: 'e2', code: 'enemyWithoutEntry2', location: e.other.id, engagedSeat: null }
  const attacks2 = []
  witchingHour.behavior.enemySpawned(e.state, moved,
    apiStub(e.state, { choose: () => 'trigger', attack: (entry, inv) => attacks2.push(inv.seat) }))
  assert.equal(moved.location, e.barn.id, 'ignoreSpawn 生成路径也会被改道到谷仓')
  assert.ok(attacks2.length >= 1, '改道后攻击谷仓本地调查员')
})

// ---------------------------------------------------------------------------
// 6. 地点
// ---------------------------------------------------------------------------
test('废弃矿山：3–10 资源不能调查；[free] 与另一处森林的调查员交换最多 3 资源（团队每轮一次）', () => {
  const state = setup(stateFor(2), 67)
  const location = ensureWoodInPlay(state, '05058')
  const owner = state.investigators.find(inv => inv.location === location.id)
  const other = state.investigators.find(inv => inv.seat !== owner.seat)
  assert.ok(owner && other)
  owner.resources = 5
  assert.equal(typeof mine.locationRule.investigationError(state, location, owner), 'string')
  owner.resources = 2
  assert.equal(mine.locationRule.investigationError(state, location, owner), undefined)

  const moves = []
  mine.locationRule.actions({ moves, state, inv: owner, location })
  assert.deepEqual(moves.map(move => move.rule), ['mineSwapResources'])
  assert.equal(moves[0].actions, 0, '[free] 不花行动')
  assert.equal(moves[0].fast, true, '标记 fast 以便引擎 playerWindow 在任意玩家窗口列出')
  // player-window-fast-actions：behavior.fastActions 提供与任意玩家窗口共用的同一份生成逻辑。
  assert.deepEqual(witchingHour.behavior.fastActions(state, owner).map(move => move.rule), ['mineSwapResources'])
  // 同一地点的调查员不算「另一处女巫作祟之林」。
  const otherLocation = other.location
  other.location = owner.location
  const blocked = []
  mine.locationRule.actions({ moves: blocked, state, inv: owner, location })
  assert.equal(blocked.length, 0, '同一地点不能触发交换')
  other.location = otherLocation
  const answers = ['toThem', '2']
  const api = apiStub(state, { choose: () => answers.shift() })
  assert.equal(mine.locationRule.performAction(state, owner, { rule: 'mineSwapResources' }, api), true)
  assert.equal(owner.resources, 0)
  assert.equal(other.resources, 7)
  assert.equal(state.scenarioFlags.mineSwapRound, state.round, '团队每轮仅限一次（全队共享）')
  // 用过后：行动列表与玩家窗口都不再出现；下一轮恢复。
  const afterUse = []
  mine.locationRule.actions({ moves: afterUse, state, inv: owner, location })
  assert.equal(afterUse.length, 0, '同轮不再出现')
  assert.equal(witchingHour.behavior.fastActions(state, owner).length, 0, '同轮玩家窗口不再出现')
  assert.equal(mine.locationRule.performAction(state, owner, { rule: 'mineSwapResources' }, apiStub(state)), false)
  state.round += 1
  const nextRound = []
  mine.locationRule.actions({ moves: nextRound, state, inv: owner, location })
  assert.equal(nextRound.length, 1, '下一轮恢复')
})

test('巨石堆与隐士之家：线索被发现后本地调查员失资源 / 随机弃手牌', () => {
  const state = setup(stateFor(2), 71)
  const cairn = ensureWoodInPlay(state, '05059')
  const inv = state.investigators.find(entry => entry.location === cairn.id)
  inv.resources = 4
  cairn.clues = 0
  cairnStones.locationRule.cluesRemoved(state, cairn, 2, apiStub(state))
  assert.equal(inv.resources, 2)

  const hermit = ensureWoodInPlay(state, '05063')
  const hermitInv = state.investigators.find(entry => entry.location === hermit.id)
  hermitInv.hand = ['01001', '01002', '01003']
  hermit.clues = 0
  hermitHouse.locationRule.cluesRemoved(state, hermit, 2, apiStub(state))
  assert.equal(hermitInv.hand.length, 1, '随机弃掉 2 张手牌')
})

test('孩童的树屋：最后一个线索被发现时把遭遇弃牌堆顶的敌人生成在此', () => {
  const state = setup(stateFor(1), 73)
  const location = ensureWoodInPlay(state, '05061')
  location.clues = 0
  state.encounterDiscard = ['05098', '05090', '01166']
  const spawned = []
  treeHouse.locationRule.cluesRemoved(state, location, 1, apiStub(state, {
    spawn: (code, locationId) => spawned.push({ code, location: locationId }),
  }))
  assert.deepEqual(spawned, [{ code: '05090', location: location.id }])
  assert.deepEqual(state.encounterDiscard, ['05098', '01166'])
})

test('独木：3–5 张手牌不能调查；[free] 弃牌换抽牌（每名调查员每轮一次、fast 窗口）', () => {
  const state = setup(stateFor(2), 79)
  const location = ensureWoodInPlay(state, '05060')
  const owner = state.investigators.find(inv => inv.location === location.id)
  owner.hand = ['01001', '01002', '01003']
  assert.equal(typeof lonelyTree.locationRule.investigationError(state, location, owner), 'string')
  owner.hand = ['01001']
  assert.equal(lonelyTree.locationRule.investigationError(state, location, owner), undefined)

  const other = state.investigators.find(inv => inv.seat !== owner.seat)
  other.hand = ['01004', '01005']
  const moves = []
  lonelyTree.locationRule.actions({ moves, state, inv: owner, location })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 0, '[free] 不花行动')
  assert.equal(moves[0].fast, true, '标记 fast 以便引擎 playerWindow 在任意玩家窗口列出')
  assert.deepEqual(witchingHour.behavior.fastActions(state, owner).map(move => move.rule), ['lonelyTreeSwap'])
  const answers = ['viceVersa']
  const api = apiStub(state, { choose: () => answers.shift() })
  assert.equal(lonelyTree.locationRule.performAction(state, owner, { rule: 'lonelyTreeSwap' }, api), true)
  assert.equal(state.scenarioFlags.lonelyTreeRoundBySeat[owner.seat], state.round, '每名调查员每轮一次')
  assert.equal(witchingHour.behavior.fastActions(state, owner).length, 0, '同轮玩家窗口不再出现')
  state.round += 1
  assert.equal(witchingHour.behavior.fastActions(state, owner).length, 1, '下一轮恢复')
})

test('独木：两个方向都必须真的弃 1 张手牌——双方都无手牌时不列出/被拒，不白抽', () => {
  const state = setup(stateFor(2), 89)
  const location = ensureWoodInPlay(state, '05060')
  const owner = state.investigators.find(inv => inv.location === location.id)
  const other = state.investigators.find(inv => inv.seat !== owner.seat)
  owner.hand = []
  other.hand = []
  const none = []
  lonelyTree.locationRule.actions({ moves: none, state, inv: owner, location })
  assert.equal(none.length, 0, '双方都无手牌时不列出能力')
  assert.equal(witchingHour.behavior.fastActions(state, owner).length, 0, '玩家窗口同样不出现')
  assert.equal(lonelyTree.locationRule.performAction(state, owner, { rule: 'lonelyTreeSwap' }, apiStub(state, { choose: () => String(other.seat) })), false,
    '直接调用 performAction 也必须被拒（不能无弃牌白抽）')
  // 行动者无手牌、另一处森林调查员有手牌：仍可发动，但方向只剩「对方弃 1 张」。
  owner.hand = []
  other.hand = ['01009']
  const only = []
  lonelyTree.locationRule.actions({ moves: only, state, inv: owner, location })
  assert.equal(only.length, 1, '只要有一个方向可弃牌仍可发动')
  const sideApi = apiStub(state, { choose: () => String(other.seat) })
  assert.equal(lonelyTree.locationRule.performAction(state, owner, { rule: 'lonelyTreeSwap' }, sideApi), true)
  assert.deepEqual(other.hand, [], '对方确实弃掉 1 张手牌')
  assert.equal(owner.hand.length, 1, '行动者获得抽到的那 1 张')
  // 两侧都有手牌时两个方向都可选（行动者选「自己弃」也真的弃自己 1 张）。
  owner.hand = ['01001']
  other.hand = ['01010']
  const bothApi = apiStub(state, { choose: (request) => (request?.kind === 'story' ? 'youDiscardTheyDraw' : String(other.seat)) })
  assert.equal(lonelyTree.locationRule.performAction(state, owner, { rule: 'lonelyTreeSwap' }, bothApi), true)
  assert.deepEqual(owner.hand, [], '选「你弃」时行动者弃掉 1 张')
  assert.equal(other.hand.length, 2, '对方抽到 1 张')
})

// ---------------------------------------------------------------------------
// 7. 混乱标记（四难度）
// ---------------------------------------------------------------------------
test('混乱标记四难度：skull/tablet/elderthing 数值与卡面一致', () => {
  const state = setup(stateFor(1), 83)
  const inv = state.investigators[0]
  const skullEasy = witchingHour.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state))
  const tabletEasy = witchingHour.behavior.resolveChaosToken(state, inv, 'tablet', apiStub(state))
  const elderEasy = witchingHour.behavior.resolveChaosToken(state, inv, 'elderthing', apiStub(state))
  assert.deepEqual([skullEasy.delta, tabletEasy.delta, elderEasy.delta], [-1, -1, -3])
  state.difficulty = 'hard'
  const skullHard = witchingHour.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state))
  const tabletHard = witchingHour.behavior.resolveChaosToken(state, inv, 'tablet', apiStub(state))
  const elderHard = witchingHour.behavior.resolveChaosToken(state, inv, 'elderthing', apiStub(state))
  assert.deepEqual([skullHard.delta, tabletHard.delta, elderHard.delta], [-2, -2, -4])
  assert.equal(witchingHour.behavior.resolveChaosToken(state, inv, 'cultist', apiStub(state)), null)
})

test('混乱标记失败后果：tablet 抽弃牌堆底部诡计；skull 简单失败按失败差额弃牌库顶', () => {
  const state = setup(stateFor(1), 89)
  const inv = state.investigators[0]
  state.encounterDiscard = ['05090', '05098', '01166']
  state.encounterDeck = ['05099', '05092']
  const drawn = []
  const api = apiStub(state, { drawEncounter: seat => drawn.push(seat) })
  witchingHour.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['tablet'], cancelledTokens: [] }, api)
  assert.deepEqual(drawn, [0], '抽最底部的诡计（05098 之前的索引 1）')
  assert.ok(!state.encounterDiscard.includes('05098'))

  state.encounterDeck = ['05099', '05092', '05093', '05094']
  witchingHour.behavior.afterTest(state, inv,
    { success: false, value: 1, difficulty: 4, drawn: ['skull'], cancelledTokens: [] }, api)
  assert.equal(state.encounterDeck.length, 1, '失败差额 3 点 → 弃 3 张')
})

test('混乱标记失败后果：elderthing 简单模式只可选已横置/已受伤女巫、困难模式全部重整治愈', () => {
  const make = () => {
    const state = setup(stateFor(1), 97)
    const here = state.investigators[0].location
    state.enemies.push(
      { id: 'w1', code: '05090', name: '女巫甲', location: here, exhausted: true, damageTaken: 2, traits: ['Witch'], engagedSeat: null },
      { id: 'w2', code: '05091', name: '女巫乙', location: here, exhausted: true, damageTaken: 1, traits: ['Witch'], engagedSeat: null },
      // 已重整且没有任何伤害：卡面简单/普通不可选。
      { id: 'w3', code: '05092', name: '女巫丙', location: here, exhausted: false, damageTaken: 0, traits: ['Witch'], engagedSeat: null },
    )
    return state
  }
  const easy = make()
  const offered = []
  witchingHour.behavior.afterTest(easy, easy.investigators[0],
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] },
    apiStub(easy, { choose: request => { offered.push(...request.options.map(option => option.id)); return 'w1' } }))
  assert.deepEqual(offered.sort(), ['w1', 'w2'], '简单/普通只提供已横置或已受到伤害的女巫')
  assert.equal(easy.enemies.find(enemy => enemy.id === 'w1').exhausted, false, '被选中的女巫被重整')
  assert.equal(easy.enemies.find(enemy => enemy.id === 'w1').damageTaken, 0, '被选中的女巫被治愈')
  assert.equal(easy.enemies.find(enemy => enemy.id === 'w2').exhausted, true, '未选中的候选保持原状')
  assert.equal(easy.enemies.find(enemy => enemy.id === 'w3').exhausted, false)
  assert.equal(easy.enemies.find(enemy => enemy.id === 'w3').damageTaken, 0)
  // 没有合规候选（只剩已重整无伤害者）：不提供选择、不改状态。
  const none = make()
  none.enemies.find(enemy => enemy.id === 'w1').exhausted = false
  none.enemies.find(enemy => enemy.id === 'w1').damageTaken = 0
  none.enemies.find(enemy => enemy.id === 'w2').exhausted = false
  none.enemies.find(enemy => enemy.id === 'w2').damageTaken = 0
  let asked = 0
  witchingHour.behavior.afterTest(none, none.investigators[0],
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] },
    apiStub(none, { choose: () => { asked += 1; return 'w1' } }))
  assert.equal(asked, 0, '没有已横置/已受伤女巫时不开选择窗口')
  const hard = make()
  hard.difficulty = 'hard'
  witchingHour.behavior.afterTest(hard, hard.investigators[0],
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] }, apiStub(hard))
  assert.equal(hard.enemies.every(enemy => enemy.exhausted === false && enemy.damageTaken === 0), true)
})

// ---------------------------------------------------------------------------
// 8. 结局 / 记录
// ---------------------------------------------------------------------------
test('结局 1/2：记录法术被破坏 + 遗留记忆 + 1 奖励经验', () => {
  const first = setup(stateFor(1), 101)
  assert.deepEqual(witchingHour.behavior.resolution(first, 'resolution1', [], apiStub(first)), { award: true, bonus: 1 })
  assert.equal(first.campaign.records.theWitchesSpellWasBroken, true)
  assert.deepEqual(first.campaign.records.mementosDiscovered.sort(), ['mesmerizingFlute', 'ritualComponents'])
  const second = setup(stateFor(1), 103)
  witchingHour.behavior.resolution(second, 'resolution2', [], apiStub(second))
  assert.equal(second.campaign.records.theWitchesSpellWasBroken, true)
  assert.deepEqual(second.campaign.records.mementosDiscovered.sort(), ['mesmerizingFlute', 'scrapOfTornShadow'])
})

test('结局 3/4/5 与 noResolution 的幕数分流', () => {
  const third = setup(stateFor(1), 107)
  third.actIndex = 2
  assert.deepEqual(witchingHour.behavior.resolution(third, 'resolution3', [], apiStub(third)), { award: true, bonus: 1 })
  assert.equal(third.campaign.records.theWitchesSpellWasCast, true)
  assert.ok(third.campaign.records.mementosDiscovered.includes('mesmerizingFlute'))

  const fourth = setup(stateFor(1), 109)
  witchingHour.behavior.resolution(fourth, 'resolution4', [], apiStub(fourth))
  assert.equal(fourth.campaign.records.theWitchesSpellWasCast, true)

  const fifth = setup(stateFor(1), 113)
  assert.deepEqual(witchingHour.behavior.resolution(fifth, 'resolution5', [], apiStub(fifth)), { award: true, bonus: 3 })
  assert.equal(fifth.campaign.records.erynnWantsToMeet, true)
  assert.deepEqual(fifth.campaign.records.mementosDiscovered.sort(), ['mesmerizingFlute', 'strangeIncantation'])

  const noResolution = setup(stateFor(1), 127)
  noResolution.actIndex = 3
  witchingHour.behavior.resolution(noResolution, 'noResolution', [], apiStub(noResolution))
  assert.equal(noResolution.campaign.records.theWitchesSpellWasCast, true, 'noResolution 在 act4 → 结局 4')
  assert.throws(() => witchingHour.behavior.resolution(noResolution, 'resolution9', [], apiStub(noResolution)))
})

// ---------------------------------------------------------------------------
// 9. 存档往返 / 确定性
// ---------------------------------------------------------------------------
test('同一路线的开始状态在 JSON 往返后完全一致（存档/重放）', () => {
  const build = seed => {
    const state = setup(stateFor(2), seed)
    const choices = ['avoidFate', 'takeCards']
    witchingHour.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => choices.shift() }))
    witchingHour.behavior.actReveal(state, state.acts[0], apiStub(state, {
      place: id => {
        const location = { ...clone(state.scenario.locations[id]), id, revealed: false, clues: 0, maxClues: 0, doom: 0 }
        state.locations.push(location)
        return location
      },
    }))
    return state
  }
  const first = build(131)
  const second = build(131)
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同一路线必须完全一致')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.encounterDeck, first.encounterDeck)
  assert.deepEqual(restored.encounterDiscard, first.encounterDiscard)
  assert.deepEqual(restored.campaign.records, first.campaign.records)
  assert.deepEqual(restored.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.equal(JSON.parse(JSON.stringify(first)).scenario.id, 'theWitchingHour', '路径 scenarios/theWitchingHour/ 的存档')
})

test('剧本数据：scriptCards 只把 [fast] 推进挂在 act2 上，tokenMeanings 与 chaos 表一致', () => {
  assert.deepEqual(witchingHour.scenario.scriptCards.rules.advanceWitchHauntings,
    { card: 'act', codes: ['05054'] })
  assert.equal(witchingHour.behavior.tokenMeanings.standard.skull.delta, -1)
  assert.equal(witchingHour.behavior.tokenMeanings.hard.elderthing.delta, -4)
  assert.deepEqual(lostInTheWoodsAct.actRule, { chapterFlow: 'resolveLostInTheWoods' })
})

// 05062 被污染的井：跨地点投入（引擎 tests.js 的 crossLocationCommit 钩子）。
test('05062 被污染的井：仅「本地点↔其他森林」双向可跨地点投入（其他森林之间/非森林/不在场不可）', () => {
  const state = {
    locations: [
      { id: 'abandonedMine', code: '05058', connections: ['taintedWell'] },
      { id: 'taintedWell', code: '05062', connections: ['abandonedMine', 'cairnStones'] },
      { id: 'cairnStones', code: '05059', connections: ['taintedWell'] },
      { id: 'entryHall', code: '05071', connections: [] },
    ],
    investigators: [
      { seat: 0, location: 'taintedWell' },
      { seat: 1, location: 'abandonedMine' },
      { seat: 2, location: 'entryHall' },
      { seat: 3, location: 'cairnStones' },
    ],
    skillTest: { skill: 'intellect' },
  }
  // 本地点（被污染的井）上的检定 ← 其他森林的投入者。
  assert.equal(witchingHour.behavior.crossLocationCommit(state, state.investigators[1], state.investigators[0], ['intellect']), true,
    '另一处森林的调查员可对本地点的检定跨地点投入')
  // 反过来：本地点上的调查员可对另一处森林的检定投入。
  assert.equal(witchingHour.behavior.crossLocationCommit(state, state.investigators[0], state.investigators[1], ['intellect']), true,
    '本地点的调查员可对其他森林的检定跨地点投入（反之亦然）')
  // 两处其他森林之间（不含被污染的井）：不开放。
  assert.equal(witchingHour.behavior.crossLocationCommit(state, state.investigators[3], state.investigators[1], ['intellect']), false,
    '两处其他女巫作祟之林之间不可跨地点投入')
  assert.equal(witchingHour.behavior.crossLocationCommit(state, state.investigators[2], state.investigators[0], ['intellect']), false,
    '非森林地点不可跨地点投入')
  state.investigators[1].location = 'taintedWell'
  assert.equal(witchingHour.behavior.crossLocationCommit(state, state.investigators[1], state.investigators[0], ['intellect']), false,
    '同一地点不触发跨地点投入（走普通协助通道）')
  // 被污染的井不在场：卡面能力不生效。
  const withoutWell = {
    ...state,
    locations: state.locations.filter(location => location.id !== 'taintedWell'),
    investigators: state.investigators.map(inv => inv.seat === 0 ? { ...inv, location: 'abandonedMine' } : inv),
  }
  assert.equal(witchingHour.behavior.crossLocationCommit(withoutWell, withoutWell.investigators[3], withoutWell.investigators[1], ['intellect']), false,
    '被污染的井不在场时不能跨地点投入')
})
