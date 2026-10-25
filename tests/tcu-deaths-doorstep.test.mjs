// 《万象无终 · 死亡门前》（atDeathsDoorstep 05065）章节测试。
//
// 钩子级测试（同 TFA 的 theDoomOfEztli 样板）：不注册进全局 registry，直接 import 本章
// `scenarios/atDeathsDoorstep/` 下的 definition/index/behavior，手工搭假 state + 确定性 api。
// 覆盖：身份/区域/符号连线、布置与线索、幕与议程推进、幽灵地点翻面与 haunted、
// 幽灵敌人目标限制、混乱标记四难度、Josef 谈判、结局记录、存档往返与确定性。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as doorstep from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/index.js'
import {
  scenario as definition, SPECTRAL_HAUNTED, SPECTRAL_LOCATION_CODES, JOSEF,
} from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/definition.js'
import { resolveChaosToken, chaosAfterTest, isAttackOrEvadeTest }
  from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const clone = value => structuredClone(value)
const behavior = doorstep.behavior

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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'entryHall',
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
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active',
        trauma: { physical: 0, mental: 0 },
      })),
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

// 把 definition 的地点放上场（引擎 placeLocation 的等价物：未揭示地点线索为 0，maxClues 保留）。
function placed(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    state.locations.push({
      ...clone(base), id, revealed: false, doom: 0, clues: 0,
      maxClues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

function setup(state, seed = 1) {
  behavior.setupLocations(state, [], setupApi(seed))
  placed(state, Object.keys(state.scenario.locations))
  behavior.afterChaosBagSetup(state, [])
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

// 记录型 api：把调用记到 calls 里，供断言；未实现的方法给安全默认值。
function stubApi(overrides = {}) {
  const calls = []
  const record = name => (...args) => { calls.push({ name, args }); return overrides[`${name}Return`] }
  const api = {
    calls,
    info: text => calls.push({ name: 'info', args: [text] }),
    choose: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    damage: (seat, n) => calls.push({ name: 'damage', args: [seat, n] }),
    horror: (seat, n) => calls.push({ name: 'horror', args: [seat, n] }),
    damageEnemy: (enemyId, n, seat, source) => calls.push({ name: 'damageEnemy', args: [enemyId, n, seat, source] }),
    haunted: (seat, options) => calls.push({ name: 'haunted', args: [seat, options] }),
    doomOn: (card, n) => calls.push({ name: 'doomOn', args: [card, n] }),
    addDoom: n => calls.push({ name: 'addDoom', args: [n] }),
    gainClues: (seat, n) => calls.push({ name: 'gainClues', args: [seat, n] }),
    spawn: (code, location) => { calls.push({ name: 'spawn', args: [code, location] }); return null },
    reveal: id => calls.push({ name: 'reveal', args: [id] }),
    moveInvestigator: (seat, destination) => calls.push({ name: 'moveInvestigator', args: [seat, destination] }),
    moveEnemy: (enemy, destination) => calls.push({ name: 'moveEnemy', args: [enemy, destination] }),
    advanceAct: () => calls.push({ name: 'advanceAct', args: [] }),
    advanceAgenda: () => calls.push({ name: 'advanceAgenda', args: [] }),
    resign: seat => calls.push({ name: 'resign', args: [seat] }),
    defeat: (inv, cause) => calls.push({ name: 'defeat', args: [inv, cause] }),
    trauma: (seat, kind, n) => calls.push({ name: 'trauma', args: [seat, kind, n] }),
    attack: (enemy, inv) => calls.push({ name: 'attack', args: [enemy, inv] }),
    finish: key => calls.push({ name: 'finish', args: [key] }),
    shuffleDiscard: () => calls.push({ name: 'shuffleDiscard', args: [] }),
    stepToward: (from, to) => (overrides.stepToward ? overrides.stepToward(from, to) : null),
    flipSpectral: id => {
      calls.push({ name: 'flipSpectral', args: [id] })
      return true
    },
    isSpectral: id => false,
    flipEnemy: (enemy, code) => {
      calls.push({ name: 'flipEnemy', args: [enemy, code] })
      if (code === '05085b') enemy.side = 'unfinishedBusiness'
      else enemy.side = 'enemy'
      return { changed: true, code }
    },
    test: (seat, skill, difficulty, resolve, skillBonus, source) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty, source] })
      if (overrides.testResolve) resolve({ success: overrides.testResolve === 'success', value: 6, difficulty, drawn: [] })
    },
    addVictory: () => {},
  }
  for (const [name, fn] of Object.entries(overrides)) {
    if (name.endsWith('Return')) continue
    if (typeof fn === 'function') api[name] = fn
  }
  return api
}

// ---------------------------------------------------------------------------
// 身份 / 数据
// ---------------------------------------------------------------------------
test('死亡门前：章节为 playable，保留原卡身份与 7 处地点', () => {
  assert.equal(doorstep.manifest.status, 'playable')
  assert.equal(doorstep.manifest.catalogReferenceOnly, undefined)
  assert.equal(doorstep.manifest.campaignId, 'theCircleUndone')
  assert.equal(doorstep.manifest.contentVersion, '1.0.0')
  assert.equal(doorstep.scenario.originalCode, '05065')
  assert.equal(behavior.id, 'atDeathsDoorstep')
  assert.equal(doorstep.manifest.locations.length, 7)
  assert.deepEqual(doorstep.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(doorstep.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(doorstep.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3'])
  assert.deepEqual(doorstep.manifest.requiredEncounterGroupIds, [
    'atDeathsDoorstep', 'silverTwilightLodge', 'spectralPredators', 'trappedSpirits',
    'inexorableFate', 'realmOfDeath', 'theWatcher', 'chillingCold',
  ])
  assert.deepEqual(doorstep.manifest.requiredMechanicIds,
    ['tcuHaunted', 'tcuSpectral', 'tcuWatcher', 'tcuChaos'])
})

test('7 个普通地点各带幽灵面 back 数据（独立卡号，不覆盖线索）', () => {
  const expected = {
    entryHall: '05078', victorianHalls: '05079', trophyRoom: '05080', billiardsRoom: '05081',
    masterBedroom: '05082', balcony: '05083', office: '05084',
  }
  for (const [id, code] of Object.entries(expected)) {
    const location = definition.locations[id]
    assert.equal(location.back.code, SPECTRAL_LOCATION_CODES[id])
    assert.equal(location.back.code, code)
    assert.equal(location.back.name, location.name)
    assert.equal(location.back.clues, undefined, 'back 不写 clues：翻面保留线索')
  }
  assert.equal(SPECTRAL_HAUNTED.office.length, 1)
  assert.equal(SPECTRAL_HAUNTED.office[0].effect[0].kind, 'discardChosen')
})

test('符号地图按印刷连线：入口大厅只连维多利亚式宴会厅', () => {
  const locations = Object.fromEntries(doorstep.manifest.locations.map(entry => [entry.id, entry]))
  assert.deepEqual([...locations.entryHall.connections].sort(), ['victorianHalls'])
  assert.deepEqual([...locations.office.connections].sort(), ['victorianHalls'])
  assert.deepEqual([...locations.billiardsRoom.connections].sort(), ['trophyRoom'])
  assert.deepEqual([...locations.balcony.connections].sort(), ['masterBedroom'])
  assert.deepEqual([...locations.victorianHalls.connections].sort(),
    ['entryHall', 'masterBedroom', 'office', 'trophyRoom'])
  // 双向一致：每个邻接都在对方列表里。
  for (const entry of doorstep.manifest.locations) {
    for (const other of entry.connections) {
      assert.ok(locations[other].connections.includes(entry.id), `${entry.id} ↔ ${other} 应双向`)
    }
  }
})

test('layout 覆盖 7 地点与 12 条有向边', () => {
  assert.equal(Object.keys(doorstep.manifest.layout.locations).length, 7)
  assert.equal(doorstep.manifest.layout.edges.length, 12)
  assert.deepEqual(doorstep.manifest.layout.locations.entryHall, { x: 4, y: 6 })
})

test('布置：7 地点入场、15 张放一边、初始标志齐全、从入口大厅开始', () => {
  const state = stateFor()
  const ids = behavior.setupLocations(state, [], setupApi(7))
  assert.deepEqual(ids, ['entryHall', 'victorianHalls', 'trophyRoom', 'billiardsRoom', 'masterBedroom', 'balcony', 'office'])
  assert.equal(state.scenarioZones.setAside.length, 15)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '05087').length, 2)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '05105').length, 2)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '05106').length, 2)
  assert.ok(state.scenarioZones.setAside.includes(JOSEF))
  assert.ok(state.scenarioZones.setAside.includes('05078'))
  assert.deepEqual(state.scenarioFlags.monsterSetAside, [])
  assert.deepEqual(state.scenarioFlags.beneathEntryHall, [])
  assert.equal(state.scenarioFlags.josefPlanResolved, false)
  assert.equal(definition.startLocation, 'entryHall')
})

test('布置线索：失踪人口对应地点 +6，按“留下的证据”尽量平均移除', () => {
  const state = stateFor()
  state.campaign.records.missingPersons = ['05046', '05047', '05048', '05049']
  state.campaign.records.piecesOfEvidenceWereLeftBehind = 8
  behavior.setupLocations(state, [], setupApi(1))
  placed(state, Object.keys(state.scenario.locations))
  behavior.afterChaosBagSetup(state, [])
  // 4 个地点各先放 6 个线索（办公室另有印刷线索 1×人数），再按 8 个「留下的证据」移除。
  const targets = ['entryHall', 'office', 'billiardsRoom', 'balcony']
    .map(id => state.locations.find(location => location.id === id))
    .map(location => ({ id: location.id, remaining: location.maxClues || 0 }))
  const bases = { entryHall: 0, office: 2, billiardsRoom: 0, balcony: 0 }
  const totalBefore = targets.reduce((sum, entry) => sum + bases[entry.id] + 6, 0)
  const totalRemaining = targets.reduce((sum, entry) => sum + entry.remaining, 0)
  assert.equal(totalBefore, 26, '印刷线索 + 每处 6 个')
  assert.equal(totalRemaining, 26 - 8, '共移除 8 个线索')
  const values = targets.map(entry => entry.remaining)
  assert.ok(Math.max(...values) - Math.min(...values) <= 1, '线索移除尽量平均')
  // 没有“留下的证据”时线索为 6。
  const plain = stateFor()
  plain.campaign.records.missingPersons = ['05046']
  behavior.setupLocations(plain, [], setupApi(1))
  placed(plain, Object.keys(plain.scenario.locations))
  behavior.afterChaosBagSetup(plain, [])
  assert.equal(plain.locations.find(location => location.id === 'entryHall').maxClues, 6)
})

test('混乱袋按参考实现追加石板与古神标记', () => {
  assert.deepEqual(definition.chaosBagExtra, ['tablet', 'elderthing'])
})

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
test('混乱标记 skull：地点闹鬼 -3/-4，否则 -1/-2', () => {
  const state = stateFor()
  const inv = state.investigators[0]
  placed(state, ['entryHall'])
  const plain = loc(state, 'entryHall')
  assert.equal(resolveChaosToken({ ...state, locations: [plain] }, inv, 'skull', {}).delta, -1)
  plain.haunted = [{ text: '闹鬼 - 失去 1 个行动。', effect: [{ kind: 'loseAction', amount: 1 }] }]
  assert.equal(resolveChaosToken({ ...state, locations: [plain] }, inv, 'skull', {}).delta, -3)
  assert.equal(resolveChaosToken({ ...state, difficulty: 'hard', locations: [plain] }, inv, 'skull', {}).delta, -4)
})

test('混乱标记 elderthing：所在地点有幽灵敌人时造成伤害，困难再加恐惧', () => {
  const state = stateFor()
  placed(state, ['entryHall'])
  state.enemies.push({ id: 'e1', code: '05100', name: '冥府之雾', location: 'entryHall', traits: ['Monster', 'Spectral'] })
  const api = stubApi()
  const easy = resolveChaosToken(state, state.investigators[0], 'elderthing', api)
  assert.equal(easy.delta, -2)
  assert.deepEqual(api.calls.filter(call => call.name === 'damage'), [{ name: 'damage', args: [0, 1] }])
  assert.equal(api.calls.some(call => call.name === 'horror'), false)
  const hardApi = stubApi()
  const hard = resolveChaosToken({ ...state, difficulty: 'hard' }, state.investigators[0], 'elderthing', hardApi)
  assert.equal(hard.delta, -4)
  assert.equal(hardApi.calls.some(call => call.name === 'horror'), true)
})

test('tablet 检定后：简单需失败且为攻击/躲避，困难只要攻击/躲避', () => {
  const state = stateFor()
  const inv = state.investigators[0]
  const hauntedApi = stubApi()
  const failAttack = { success: false, drawn: ['tablet'], source: { label: '攻击' } }
  assert.equal(chaosAfterTest(state, inv, failAttack, hauntedApi), true)
  assert.equal(hauntedApi.calls.filter(call => call.name === 'haunted').length, 1)
  // 简单/普通：成功不触发。
  const successApi = stubApi()
  assert.equal(chaosAfterTest(state, inv, { ...failAttack, success: true }, successApi), false)
  // 困难：成功也触发。
  const hardApi = stubApi()
  assert.equal(chaosAfterTest({ ...state, difficulty: 'hard' }, inv, { ...failAttack, success: true }, hardApi), true)
  // 非攻击/躲避不触发。
  const investigateApi = stubApi()
  assert.equal(chaosAfterTest(state, inv, { success: false, drawn: ['tablet'], source: { label: '调查' } }, investigateApi), false)
  assert.equal(isAttackOrEvadeTest({ source: { label: '躲避' } }), true)
})

// ---------------------------------------------------------------------------
// 幽灵界
// ---------------------------------------------------------------------------
test('幽灵敌人目标限制：非幽灵地点不能攻击/交战，翻到幽灵面后可以', () => {
  const state = stateFor()
  placed(state, ['entryHall'])
  const inv = state.investigators[0]
  const spectral = { id: 'e2', code: '05101', name: '暗影猎犬', location: 'entryHall', traits: ['Monster', 'Spectral'] }
  assert.equal(behavior.canFightEnemy(state, inv, spectral), false)
  assert.equal(behavior.canEvadeEnemy(state, inv, spectral), false)
  const entryHall = loc(state, 'entryHall')
  entryHall.spectral = true
  entryHall.spectralFace = 'spectral'
  assert.equal(behavior.canFightEnemy(state, inv, spectral), true)
  assert.equal(behavior.canEvadeEnemy(state, inv, spectral), true)
  // 非幽灵敌人不受限制。
  const monster = { id: 'e3', code: '05095', name: '秘社新信徒', location: 'entryHall', traits: ['Humanoid', 'Silver Twilight'] }
  entryHall.spectral = false
  entryHall.spectralFace = 'normal'
  assert.equal(behavior.canFightEnemy(state, inv, monster), true)
})

test('翻到幽灵面：写入幽灵面的 haunted，翻回时清除；胜利点留到幕末口径', () => {
  const state = stateFor()
  placed(state, ['entryHall', 'office'])
  const office = loc(state, 'office')
  office.revealed = true
  office.clues = 0
  const api = stubApi()
  office.spectralFace = 'spectral'
  office.code = '05084'
  office.originalCode = '05084'
  behavior.locationFlipped(state, office, api)
  assert.equal(office.haunted.length, 1)
  assert.equal(office.haunted[0].effect[0].kind, 'discardChosen')
  // 05084 幽灵面印刷胜利 2：只写到实例上供幕末 campaign-flow 口径结算，不再翻面即计分。
  assert.equal(office.victory, 2, '05084 幽灵面胜利点写入实例')
  assert.equal(state.victory || 0, 0, '翻面不再立即计分（幕末「揭示且无线索」才计）')
  assert.equal(state.victoryDisplay.length, 0, '不提前进入胜利区')
  office.spectralFace = 'normal'
  office.code = '05077'
  office.originalCode = '05077'
  behavior.locationFlipped(state, office, api)
  assert.equal(office.haunted, undefined)
})

test('幽灵面的入口大厅：揭示前不能进入，揭示后放行（独立封印 flag 不依赖 revealed）', () => {
  const state = stateFor()
  placed(state, ['entryHall'])
  const entryHall = loc(state, 'entryHall')
  entryHall.code = '05078'
  entryHall.originalCode = '05078'
  entryHall.revealed = false
  assert.match(behavior.investigatorEntryError(state, entryHall), /封锁/)
  entryHall.revealed = true
  assert.equal(behavior.investigatorEntryError(state, entryHall), null)
  // 引擎翻面不重置 revealed：用独立封印 flag，即使 revealed=true 也应封锁。
  state.scenarioFlags.entryHallSealed = true
  assert.match(behavior.investigatorEntryError(state, entryHall), /封锁/)
  state.scenarioFlags.entryHallSealed = false
  assert.equal(behavior.investigatorEntryError(state, entryHall), null)
  // 普通面入口大厅不封锁。
  assert.equal(behavior.investigatorEntryError(state, { id: 'entryHall', code: '05071', revealed: false }), null)
})

// ---------------------------------------------------------------------------
// 议程 1：银暮秘社无敌 + 怪物放一边
// ---------------------------------------------------------------------------
test('议程 1 在场时：银暮秘社敌人不能受伤/被击败，其他敌人不受影响', () => {
  const state = stateFor()
  const rst = { id: 'e1', name: '秘社新信徒', code: '05095', traits: ['Humanoid', 'Cultist', 'Silver Twilight'] }
  const monster = { id: 'e2', name: '暗影猎犬', code: '05101', traits: ['Monster', 'Spectral'] }
  assert.equal(behavior.enemyDamageAllowed(state, rst), false)
  assert.equal(behavior.enemyCanBeDefeated(state, rst), false)
  assert.equal(behavior.enemyDamageAllowed(state, monster), true)
  state.agendaIndex = 1
  assert.equal(behavior.enemyDamageAllowed(state, rst), true)
})

test('议程 1 强制：抽到怪物敌人时改放一边，并在议程上放 1 毁灭；非抽牌生成不受影响', () => {
  const state = stateFor()
  const fallback = 'entryHall'
  // 引擎在 drawEncounter 里先调 encounterDrawn（:134）再 spawnEnemy（:177）：只有「本次抽到的怪物」
  // 会打上 pendingDrawEnemy 标记，spawnLocation 仅在该标记命中时拦截。
  behavior.encounterDrawn(state, state.investigators[0], '05101', stubApi())
  assert.equal(behavior.spawnLocation(state, '05101', fallback), '__setAside__')
  assert.deepEqual(state.scenarioFlags.monsterSetAside, ['05101'])
  assert.ok(state.scenarioZones.setAside.includes('05101'))
  // 引擎在生成失败时已把卡放进遭遇弃牌堆 → spawnFailed 取回并放毁灭。
  state.encounterDiscard.push('05101')
  const api = stubApi()
  behavior.spawnFailed(state, '05101', null, api)
  assert.equal(state.encounterDiscard.includes('05101'), false)
  assert.deepEqual(api.calls.filter(call => call.name === 'addDoom'), [{ name: 'addDoom', args: [1] }])
  // 非怪物抽牌照常生成。
  behavior.encounterDrawn(state, state.investigators[0], '05095', stubApi())
  assert.equal(behavior.spawnLocation(state, '05095', fallback), fallback)
  // 效果/弱点等「非抽牌」路径的怪物生成不经过标记 → 照常生成（不再按触发面更宽的代理拦截）。
  behavior.encounterDrawn(state, state.investigators[0], '05090', stubApi())
  assert.equal(behavior.spawnLocation(state, '05101', fallback), fallback, '非本次抽到的怪物生成不受议程 1 强制影响')
  // 真实抽到的怪物即使被取消/重抽后同回合的其它生成也不误伤：标记已被消费。
  assert.equal(behavior.spawnLocation(state, '05101', fallback), fallback, '标记消费后同卡效果生成放行')
  // 银暮秘社敌人不能生成在「幽灵面入口大厅」（05078 背面）；普通面入口大厅不限制。
  placed(state, ['entryHall'])
  const hall = state.locations.find(location => location.id === 'entryHall')
  hall.code = '05071'
  hall.originalCode = '05071'
  hall.spectralFace = 'normal'
  assert.equal(behavior.spawnLocation(state, '05095', 'entryHall'), 'entryHall')
  hall.code = '05078'
  hall.originalCode = '05078'
  hall.spectralFace = 'spectral'
  state.scenarioFlags.entryHallSealed = true
  assert.equal(behavior.spawnLocation(state, '05095', 'entryHall'), '__nowhere__')
  state.scenarioFlags.entryHallSealed = false
  assert.equal(behavior.spawnLocation(state, '05095', 'entryHall'), 'entryHall')
})

test('办公室：银暮秘社敌人失去冷漠，离开后恢复', () => {
  const state = stateFor()
  placed(state, ['office', 'entryHall'])
  const enemy = { id: 'e1', code: '05095', name: '秘社新信徒', location: 'office', aloof: true, printedAloof: true }
  state.enemies.push(enemy)
  behavior.enemySpawned(state, enemy, stubApi())
  assert.equal(enemy.aloof, false)
  enemy.location = 'entryHall'
  behavior.enemyMoved(state, enemy)
  assert.equal(enemy.aloof, true)
})

// ---------------------------------------------------------------------------
// 幕 / 议程结算
// ---------------------------------------------------------------------------
test('幕 1b：全员移到维多利亚式宴会厅、7 地点翻到幽灵面、按在场重算揭示、生成看守人并洗回两组', () => {
  const state = setup(stateFor())
  state.locations.forEach(location => { location.revealed = true })
  state.scenarioFlags.monsterSetAside = ['05101']
  state.encounterDiscard.push('01167')
  const api = stubApi({
    isSpectral: () => false,
    locate: null,
    // 模拟引擎 api.moveInvestigator：真的把调查员移到目标地点。
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      api.calls.push({ name: 'moveInvestigator', args: [seat, destination] })
    },
    // 模拟引擎 flipSpectral：真的把地点换成幽灵面卡号。
    flipSpectral: id => {
      const location = state.locations.find(entry => entry.id === id)
      location.code = SPECTRAL_LOCATION_CODES[id]
      location.originalCode = SPECTRAL_LOCATION_CODES[id]
      location.spectralFace = 'spectral'
      api.calls.push({ name: 'flipSpectral', args: [id] })
      return true
    },
  })
  behavior.actReveal(state, state.acts[0], api)
  const flips = api.calls.filter(call => call.name === 'flipSpectral').map(call => call.args[0])
  assert.deepEqual(flips.sort(), Object.keys(SPECTRAL_LOCATION_CODES).sort())
  const moves = api.calls.filter(call => call.name === 'moveInvestigator')
  assert.equal(moves.length, 2)
  assert.ok(moves.every(call => call.args[1] === 'victorianHalls'))
  // 换面后按「有调查员则揭示」重算：调查员已到维多利亚式宴会厅 → 该地点揭示、入口大厅不揭示。
  const entryHall = loc(state, 'entryHall')
  const victorianHalls = loc(state, 'victorianHalls')
  assert.equal(entryHall.revealed, false, '入口大厅无调查员 → 未揭示（鬼灵迷雾封锁生效）')
  assert.equal(state.scenarioFlags.entryHallSealed, true, '独立封印 flag：换面时大厅无人 → 封锁')
  assert.equal(victorianHalls.revealed, true, '有调查员的地点换面后揭示')
  // 7 张幽灵地点已从放一边区移出。
  for (const code of Object.values(SPECTRAL_LOCATION_CODES)) {
    assert.equal(state.scenarioZones.setAside.includes(code), false, `${code} 应从放一边区移出`)
  }
  const spawns = api.calls.filter(call => call.name === 'spawn').map(call => call.args[0])
  assert.ok(spawns.includes('05101'), '放一边的怪物要在玩家地点生成')
  assert.ok(spawns.includes('05086'), '幽灵看守人生成在入口大厅')
  assert.equal(spawns.at(-1), '05086')
  assert.equal(api.calls.some(call => call.name === 'shuffleDiscard'), true)
  // 看守人/冥界剩下的卡已从 setAside 移入遭遇牌库。
  for (const code of ['05087', '05105', '05106']) {
    assert.ok(state.encounterDeck.includes(code), `${code} 应洗入遭遇牌库`)
  }
  assert.equal(state.scenarioFlags.monsterSetAside.length, 0)
})

test('幕 1b：每位调查员从放一边怪物中自选 1 个生成在自己地点（按玩家顺序循环到全部生成）', () => {
  const state = setup(stateFor(2))
  state.locations.forEach(location => { location.revealed = true })
  state.scenarioFlags.monsterSetAside = ['05101', '05105', '05106']
  const picks = []
  const api = stubApi({
    isSpectral: () => false,
    locate: null,
    choose: request => {
      if (request.kind === 'spawn') picks.push({ seat: request.seat, ids: request.options.map(option => option.id) })
      return request.options[request.options.length - 1].id
    },
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      api.calls.push({ name: 'moveInvestigator', args: [seat, destination] })
    },
    flipSpectral: id => {
      const location = state.locations.find(entry => entry.id === id)
      location.code = SPECTRAL_LOCATION_CODES[id]
      location.originalCode = SPECTRAL_LOCATION_CODES[id]
      location.spectralFace = 'spectral'
      api.calls.push({ name: 'flipSpectral', args: [id] })
      return true
    },
  })
  behavior.actReveal(state, state.acts[0], api)
  const monsterSpawns = api.calls.filter(call => call.name === 'spawn'
    && ['05101', '05105', '05106'].includes(call.args[0]))
  assert.deepEqual(monsterSpawns.map(call => call.args[0]), ['05106', '05105', '05101'],
    '每位调查员分别自选（自选顺序＝玩家顺序），剩余的最后 1 张直接生成')
  assert.ok(monsterSpawns.every(call => call.args[1] === 'victorianHalls'), '生成在各自调查员的地点')
  assert.deepEqual(picks.map(pick => pick.seat), [0, 1], '第一轮按玩家顺序各询问一次；只剩 1 张时不再询问')
  assert.deepEqual(picks[0].ids, ['05101', '05105', '05106'])
  assert.deepEqual(picks[1].ids, ['05101', '05105'], '已被选走的怪物不再出现在选择里')
  assert.equal(state.scenarioFlags.monsterSetAside.length, 0, '放一边怪物全部生成')
})

test('幕 1b：翻到幽灵面后按幽灵面印刷线索值重算（05080/81/83/84 与正面的差异），携带线索保留', () => {
  const state = stateFor()
  state.campaign.records.missingPersons = ['05046'] // 入口大厅 +6
  state.campaign.records.piecesOfEvidenceWereLeftBehind = 0
  behavior.setupLocations(state, [], setupApi(1))
  placed(state, Object.keys(state.scenario.locations))
  behavior.afterChaosBagSetup(state, [])
  // 真实开局：入口大厅因全员在场而揭示并有 6 个线索 token。
  const entryHallInit = loc(state, 'entryHall')
  entryHallInit.revealed = true
  entryHallInit.clues = 6
  // 模拟一个「已揭示且有剩余线索」的普通地点（露台），验证 token 携带。
  const balconyInit = loc(state, 'balcony')
  balconyInit.revealed = true
  balconyInit.clues = 2
  const api = stubApi({
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    reveal: id => { // 模拟引擎 revealLocation：按 maxClues 放置线索。
      const location = loc(state, id)
      location.revealed = true
      location.clues = location.maxClues || 0
    },
    flipSpectral: id => {
      const location = loc(state, id)
      location.code = SPECTRAL_LOCATION_CODES[id]
      location.originalCode = SPECTRAL_LOCATION_CODES[id]
      location.spectralFace = 'spectral'
      return true
    },
  })
  behavior.actReveal(state, state.acts[0], api)
  // 幽灵面印刷线索值（每人）：05080=1、05081=1、05083=1、05084=2；05079/05082 与正面相同（0/1）。
  assert.equal(loc(state, 'trophyRoom').maxClues, 1 * 2, '05080 幽灵面 1/人')
  assert.equal(loc(state, 'billiardsRoom').maxClues, 1 * 2, '05081 幽灵面 1/人')
  assert.equal(loc(state, 'balcony').maxClues, 1 * 2, '05083 幽灵面 1/人')
  assert.equal(loc(state, 'office').maxClues, 2 * 2, '05084 幽灵面 2/人')
  assert.equal(loc(state, 'victorianHalls').maxClues, 0, '05079 幽灵面 0/人')
  // 入口大厅：6 个携带 token 的加成仍保留（幽灵面 0/人 + 6）。
  assert.equal(loc(state, 'entryHall').maxClues, 6, '入口大厅 05078 幽灵面 0/人 + 携带的 6')
  // 已揭示过且当时无人的露台：之后再次揭示时保留携带的 2 个 token，不重复按新卡面放置。
  assert.equal(loc(state, 'balcony').preservedClues, 2, '携带 token 记录在 preservedClues')
  assert.equal(behavior.cluesOnReveal(state, loc(state, 'balcony')), 2, '再次揭示按携带 token 数放置')
  assert.equal(loc(state, 'balcony').preservedClues, undefined, '用后清除')
})

test('幕 2b：揭示入口大厅并把遭遇弃牌堆洗回牌库（同时解除封印 flag）', () => {
  const state = setup(stateFor())
  state.scenarioFlags.entryHallSealed = true
  const api = stubApi()
  behavior.actReveal(state, state.acts[1], api)
  assert.deepEqual(api.calls.filter(call => call.name === 'reveal'), [{ name: 'reveal', args: ['entryHall'] }])
  assert.equal(state.scenarioFlags.entryHallSealed, false, '幕 2b 解除鬼灵迷雾封印')
  assert.equal(api.calls.some(call => call.name === 'shuffleDiscard'), true)
})

test('幕 3b → 结局 1', () => {
  const state = setup(stateFor())
  const api = stubApi()
  behavior.actReveal(state, state.acts[2], api)
  assert.deepEqual(api.calls.filter(call => call.name === 'finish'), [{ name: 'finish', args: ['r1'] }])
})

test('议程 1b：团队线索足够时花费并生成 Josef 于最远地点，写 trail 记录并移除所有线索', () => {
  const state = stateFor()
  state.campaign.records.missingPersons = ['05046', '05047']
  behavior.setupLocations(state, [], setupApi(1))
  placed(state, Object.keys(state.scenario.locations))
  for (const inv of state.investigators) inv.clues = 4 // 2 人 × 3 = 6
  const office = state.locations.find(location => location.id === 'office')
  // 未揭示地点的线索只在 maxClues；要模拟「已无线索」必须两处都清 0。
  office.clues = 0
  office.maxClues = 0
  const entryHall = state.locations.find(location => location.id === 'entryHall')
  entryHall.clues = 0
  entryHall.maxClues = 0
  const api = stubApi()
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.clues, 0), 2, '6 个线索被花掉')
  const spawn = api.calls.find(call => call.name === 'spawn')
  assert.equal(spawn.args[0], JOSEF)
  assert.notEqual(spawn.args[1], 'entryHall', 'Josef 不生成在入口大厅')
  assert.equal(state.victoryDisplay.length, 0)
  assert.equal(state.campaign.records.theInvestigatorsAreOnJeromesTrail, true, '办公室无线索 → 追查杰罗姆')
  assert.equal(state.campaign.records.theInvestigatorsAreOnGavriellasTrail, true, '入口大厅无线索 → 追查加弗瑞拉')
  assert.ok(state.locations.every(location => (location.clues || 0) === 0), '所有地点的线索被移除')
  assert.ok(state.locations.every(location => (location.maxClues || 0) === 0), '未揭示地点的 maxClues 也被清空')
  assert.equal(api.calls.some(call => call.name === 'advanceAct'), true)
})

test('议程 1b：未揭示地点的 maxClues 视为「仍有线索」→ 不写 trail 记录；Valentino/Penny 记录不互换', () => {
  const state = stateFor()
  state.campaign.records.missingPersons = ['05048', '05049']
  behavior.setupLocations(state, [], setupApi(1))
  placed(state, Object.keys(state.scenario.locations))
  for (const inv of state.investigators) inv.clues = 4
  // 模拟 distributeClues：未揭示地点把线索放在 maxClues（而非 clues）。
  for (const id of ['billiardsRoom', 'balcony']) {
    const location = state.locations.find(entry => entry.id === id)
    location.clues = 0
    location.maxClues = 6
  }
  const api = stubApi()
  behavior.agendaReveal(state, state.agendas[0], api)
  // 05048=Valentino（台球室）、05049=Penny（露台）：地点未揭示且 maxClues>0 → 两条都不应写成「无线索」。
  assert.equal(state.campaign.records.theInvestigatorsAreOnValentinosTrail, undefined)
  assert.equal(state.campaign.records.theInvestigatorsAreOnPennysTrail, undefined)
  // 清空后：Valentino → ValentinosTrail、Penny → PennysTrail（不互换）。
  const state2 = stateFor()
  state2.campaign.records.missingPersons = ['05048', '05049']
  behavior.setupLocations(state2, [], setupApi(1))
  placed(state2, Object.keys(state2.scenario.locations))
  for (const inv of state2.investigators) inv.clues = 4
  for (const location of state2.locations) { location.clues = 0; location.maxClues = 0 }
  behavior.agendaReveal(state2, state2.agendas[0], stubApi())
  assert.equal(state2.campaign.records.theInvestigatorsAreOnValentinosTrail, true)
  assert.equal(state2.campaign.records.theInvestigatorsAreOnPennysTrail, true)
  assert.equal(state2.campaign.records.theInvestigatorsAreOnGavriellasTrail, undefined)
})

test('议程 1b：线索不足时全队失去所有线索且不生成 Josef', () => {
  const state = setup(stateFor())
  for (const inv of state.investigators) inv.clues = 2 // 共 4 < 6
  const api = stubApi()
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.investigators.every(inv => inv.clues === 0), true)
  assert.equal(api.calls.some(call => call.name === 'spawn'), false)
  assert.equal(api.calls.some(call => call.name === 'advanceAct'), true)
})

test('议程 2 正面：银暮秘社敌人被击败后带胜利 0 进入胜利区（幕间 II 分支可数）', () => {
  const state = stateFor()
  state.agendaIndex = 1
  const enemy = { id: 'rst1', code: '05095', name: '秘社新信徒', location: 'entryHall',
    traits: ['Humanoid', 'Silver Twilight'], victory: undefined }
  state.enemies.push(enemy)
  const api = stubApi()
  // 必须返回 true：引擎 defeatEnemy 的 `!replaced && addVictory(...)` 才会跳过默认结算，
  // 否则同一敌人会再被 addVictory 压进遭遇弃牌堆（R4 交叉复核 dispute / Lead 裁决）。
  const replaced = behavior.enemyDefeated(state, enemy, api)
  assert.equal(replaced, true, '返回 true 让引擎跳过 addVictory')
  const entry = state.victoryDisplay.find(card => card.id === 'enemy:rst1')
  assert.ok(entry, '进入胜利区')
  assert.equal(entry.victory, 0, '胜利 0 不改变比分')
  assert.equal(state.encounterDiscard.includes('05095'), false, '不再同时进入遭遇弃牌堆')
  // 后续「洗回遭遇弃牌堆」也不会把它洗回（它不在 discard 里）。
  state.encounterDeck.push(...state.encounterDiscard)
  assert.equal(state.encounterDeck.includes('05095'), false)
  const found = state.victoryDisplay.filter(card => card.originalCode === '05095').length
  // 之后再被同一个敌人触发也不会重复入区（仍返回 true 保持引擎跳过）。
  assert.equal(behavior.enemyDefeated(state, enemy, api), true)
  assert.equal(state.victoryDisplay.filter(card => card.originalCode === '05095').length, found)
  assert.equal(state.encounterDiscard.includes('05095'), false)
})

test('议程 2 正面：非银暮秘社敌人仍交回引擎默认（不返回 true）', () => {
  const state = stateFor()
  state.agendaIndex = 1
  const monster = { id: 'mon1', code: '05101', name: '暗影猎犬', location: 'entryHall',
    traits: ['Monster', 'Spectral'], victory: 1 }
  state.enemies.push(monster)
  assert.notEqual(behavior.enemyDefeated(state, monster, stubApi()), true, '非银暮秘社敌人不接管')
  assert.equal(state.victoryDisplay.some(card => card.id === 'enemy:mon1'), false)
})

test('05085b 背面：本局毁灭不能放在银暮秘社敌人上；约瑟夫获得冷漠', () => {
  const state = stateFor()
  const josef = { id: 'josef1', code: JOSEF, originalCode: JOSEF, name: '约瑟夫·梅吉尔',
    location: 'entryHall', aloof: false, printedAloof: false, doom: 0, traits: ['Humanoid', 'Silver Twilight'] }
  state.enemies.push(josef)
  // 通过行为入口翻面（stubApi 的 flipEnemy 只记录）：直接调用 behavior.enemySpawned 验证冷漠同步。
  state.scenarioFlags.josefPlanResolved = true
  behavior.enemySpawned(state, josef, stubApi())
  assert.equal(josef.aloof, true, '约瑟夫获得冷漠')
  // 引擎 placeDoomOnCard 在写入前询问 behavior.canPlaceDoomOn：结算后银暮秘社敌人返回 false（不写入）。
  const other = { id: 'cultist1', code: '05095', originalCode: '05095', name: '秘社新信徒',
    location: 'entryHall', doom: 0, traits: ['Humanoid', 'Silver Twilight'] }
  const monster = { id: 'monster1', code: '05101', originalCode: '05101', name: '暗影猎犬',
    location: 'entryHall', doom: 0, traits: ['Monster'] }
  state.enemies.push(other, monster)
  assert.equal(behavior.canPlaceDoomOn(state, other), false, '05085b 生效后银暮秘社敌人不能再被放置毁灭')
  assert.equal(behavior.canPlaceDoomOn(state, josef), false, '约瑟夫本人同样被拦截')
  assert.equal(behavior.canPlaceDoomOn(state, monster), true, '非银暮秘社敌人不受限')
  // 结算前不限制。
  state.scenarioFlags.josefPlanResolved = false
  assert.equal(behavior.canPlaceDoomOn(state, other), true, '05085b 未结算前可以放置毁灭')
})

test('议程 2b：幕 2 → 结局 3；幕 3 → 未撤退者被击败并承受 1 点肉体创伤', () => {
  const state = setup(stateFor())
  const act2Api = stubApi()
  state.actIndex = 1
  behavior.agendaReveal(state, state.agendas[1], act2Api)
  assert.deepEqual(act2Api.calls.filter(call => call.name === 'finish'), [{ name: 'finish', args: ['r3'] }])
  const act3Api = stubApi()
  state.actIndex = 2
  state.investigators[1].resigned = true
  behavior.agendaReveal(state, state.agendas[1], act3Api)
  const defeated = act3Api.calls.filter(call => call.name === 'defeat')
  assert.equal(defeated.length, 1, '只有未撤退者被击败')
  const trauma = act3Api.calls.filter(call => call.name === 'trauma')
  assert.deepEqual(trauma[0].args, [0, 'physical', 1])
})

test('幕 3 目标与全员撤退：未击败者全部撤退 → 推进幕', () => {
  const state = setup(stateFor())
  state.actIndex = 2
  const api = stubApi()
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.some(call => call.name === 'advanceAct'), false)
  for (const inv of state.investigators) inv.resigned = true
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.filter(call => call.name === 'advanceAct').length, 1)
  behavior.allResigned(state, api)
  assert.equal(api.calls.filter(call => call.name === 'advanceAct').length, 2)
})

test('议程 2：猎手把银暮秘社敌人视作调查员（同地点不移动/更近则转向/更远交回引擎/并列 lead 选路）', () => {
  const state = setup(stateFor())
  state.agendaIndex = 1
  state.investigators.forEach(inv => { inv.location = 'office' })
  const enemy = { id: 'hunter', name: '幽灵猎手', code: '05101', location: 'billiardsRoom', traits: ['Monster', 'Spectral'], hunter: true, exhausted: false }
  state.enemies.push(enemy)
  state.enemies.push({ id: 'rst', name: '秘社新信徒', code: '05095', location: 'trophyRoom', traits: ['Humanoid', 'Silver Twilight'] })
  const api = stubApi({ stepToward: () => 'trophyRoom' })
  assert.equal(behavior.hunterMove(state, enemy, api), true)
  const moves = api.calls.filter(call => call.name === 'moveEnemy')
  assert.deepEqual(moves[0].args, [enemy, 'trophyRoom'], '银暮秘社敌人严格更近 → 向它移动')
  // 同地点已有「视作调查员」的银暮秘社敌人 → 本猎手不移动（返回 true 阻止引擎默认 hunterStep）。
  const same = { id: 'hunter2', name: '幽灵猎手', code: '05101', location: 'trophyRoom', traits: ['Monster', 'Spectral'], hunter: true, exhausted: false }
  state.enemies.push(same)
  const sameApi = stubApi({ stepToward: () => 'entryHall' })
  assert.equal(behavior.hunterMove(state, same, sameApi), true)
  assert.equal(sameApi.calls.filter(call => call.name === 'moveEnemy').length, 0, '同地点有视作调查员的敌人时不移动')
  assert.ok(sameApi.calls.some(call => call.name === 'info' && /不移动/.test(call.args[0])))
  // 调查员更近 → 本章不接管，交回引擎默认 hunterStep（保留 PREY_RANK）。
  const farSilver = state.enemies.find(target => target.id === 'rst')
  farSilver.location = 'balcony'
  state.investigators.forEach(inv => { inv.location = 'victorianHalls' })
  const defApi = stubApi()
  assert.equal(behavior.hunterMove(state, enemy, defApi), false, '调查员更近 → 返回 false 交回引擎')
  assert.equal(defApi.calls.filter(call => call.name === 'moveEnemy').length, 0)
  // 并列：调查员侧用引擎 hunterStep 的下一步与额外目标路线合并，由 lead 选。
  state.investigators.forEach(inv => { inv.location = 'trophyRoom' })
  const tied = { id: 'hunter3', name: '幽灵猎手', code: '05101', location: 'victorianHalls', traits: ['Monster', 'Spectral'], hunter: true, exhausted: false }
  state.enemies.push(tied)
  farSilver.location = 'masterBedroom' // 距 victorianHalls 1
  // 调查员在 trophyRoom 也距 1 → 并列；stepToward 按目标返回真实下一格。
  const routeChoices = []
  const routeApi = stubApi({
    stepToward: (from, to) => to,
    hunterStep: () => 'trophyRoom',
    choose: request => { routeChoices.push(request); return request.options?.[0]?.id },
  })
  assert.equal(behavior.hunterMove(state, tied, routeApi), true)
  const routeMoves = routeApi.calls.filter(call => call.name === 'moveEnemy')
  assert.deepEqual(routeMoves[0].args, [tied, 'trophyRoom'], '并列时默认选引擎给出的调查员路线（lead 可改）')
  assert.ok(routeChoices.some(request => request.kind === 'hunter'), '并列路线由 lead 选择')
  // 议程 1 时不用本章路由。
  state.agendaIndex = 0
  assert.equal(behavior.hunterMove(state, enemy, stubApi()), false)
})

test('议程 2 强制：重整幽灵敌人对同地点类人敌人造成伤害', () => {
  const state = setup(stateFor())
  state.agendaIndex = 1
  const spectral = { id: 's', name: '冥府之雾', code: '05100', location: 'entryHall', traits: ['Monster', 'Spectral'], damage: 1, exhausted: false }
  const humanoid = { id: 'h', name: '秘社新信徒', code: '05095', location: 'entryHall', traits: ['Humanoid', 'Silver Twilight'] }
  state.enemies.push(spectral, humanoid)
  const api = stubApi()
  behavior.enemyPhaseAfterHunters(state, api)
  const hits = api.calls.filter(call => call.name === 'damageEnemy')
  assert.equal(hits.length, 1)
  assert.deepEqual(hits[0].args, ['h', 1, null, 'encounter'])
})

test('轮末：主卧强制放毁灭；幕 3 时入口大厅的银暮秘社敌人逃到大厅底下', () => {
  const state = setup(stateFor())
  state.investigators[0].location = 'masterBedroom'
  const rst = { id: 'rst', name: '秘社新信徒', code: '05095', location: 'victorianHalls', traits: ['Humanoid', 'Silver Twilight'] }
  state.enemies.push(rst)
  const api = stubApi()
  behavior.roundEnded(state, api)
  assert.equal(api.calls.filter(call => call.name === 'doomOn').length, 1, '主卧强制给最近的银暮秘社敌人放毁灭')
  // 幕 3：入口大厅的银暮秘社敌人放一边到大厅底下。
  state.actIndex = 2
  state.investigators[0].location = 'victorianHalls'
  rst.location = 'entryHall'
  rst.aloof = true
  behavior.roundEnded(state, api)
  assert.equal(state.enemies.includes(rst), false)
  assert.deepEqual(state.scenarioFlags.beneathEntryHall, ['05095'])
})

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
test('入口大厅与幽灵入口大厅：[action] 撤退', () => {
  const state = setup(stateFor())
  let moves = behavior.actions(state, state.investigators[0])
  assert.equal(moves.some(move => move.rule === 'resignEntryHall'), true)
  const api = stubApi()
  behavior.performAction(state, state.investigators[0], { rule: 'resignEntryHall' }, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'resign'), [{ name: 'resign', args: [0] }])
  // 幽灵面入口大厅。
  const spectralEntry = loc(state, 'entryHall')
  spectralEntry.code = '05078'
  spectralEntry.originalCode = '05078'
  spectralEntry.spectralFace = 'spectral'
  moves = behavior.actions(state, state.investigators[0])
  assert.equal(moves.some(move => move.rule === 'resignSpectralEntryHall'), true)
})

test('约瑟夫·梅吉尔谈判：成功翻面结算 05085b 并记录本局限制，失败他攻击你', () => {
  const state = setup(stateFor())
  const josef = {
    id: 'josef', code: JOSEF, originalCode: JOSEF, name: '约瑟夫·梅吉尔', location: 'entryHall',
    traits: ['Humanoid', 'Cultist', 'Silver Twilight', 'Elite'], doom: 1, engagedSeat: 0,
  }
  state.enemies.push(josef)
  state.investigators[0].engaged.push(josef.id)
  const moves = behavior.actions(state, state.investigators[0])
  assert.equal(moves.some(move => move.rule === 'josefParley'), true)
  assert.equal(moves.find(move => move.rule === 'josefParley').actionKind, 'parley',
    '谈判行动不引发趁乱攻击（05085）')
  const api = stubApi({ testResolve: 'success' })
  behavior.performAction(state, state.investigators[0], { rule: 'josefParley' }, api)
  assert.equal(state.scenarioFlags.josefPlanResolved, true)
  assert.equal(josef.doom, 0, '移除他身上的毁灭')
  assert.equal(josef.engagedSeat, null)
  assert.equal(state.investigators[0].engaged.includes(josef.id), false)
  assert.equal(api.calls.filter(call => call.name === 'flipEnemy').length, 2, '翻到 05085b 再翻回敌人面')
  // 其他银暮秘社敌人身上有毁灭时，谈判不可用。
  const blocked = setup(stateFor())
  blocked.enemies.push({ ...josef, id: 'j2', location: 'entryHall' })
  blocked.enemies.push({ id: 'rst', name: '秘社新信徒', code: '05095', location: 'entryHall', traits: ['Silver Twilight'], doom: 1 })
  assert.equal(behavior.actions(blocked, blocked.investigators[0]).some(move => move.rule === 'josefParley'), false)
  // 失败：他攻击你。
  const failState = setup(stateFor())
  failState.enemies.push({ ...josef })
  const failApi = stubApi({ testResolve: 'failure' })
  behavior.performAction(failState, failState.investigators[0], { rule: 'josefParley' }, failApi)
  assert.equal(failApi.calls.some(call => call.name === 'attack'), true)
})

test('露台谈判：智识图标合计不足 3 个时无效，达标后弃牌换 2 线索', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  inv.location = 'balcony'
  // 从真实卡表挑：3 张带智识图标的手牌 + 1 张无图标。
  const hand = Object.values(ALL_CARDS)
    .filter(card => (card.icons?.intellect || 0) >= 1 && /^01\d{3}$/.test(card.code))
    .slice(0, 3)
    .map(card => card.code)
  assert.equal(hand.length, 3, '卡表里应有带智识图标的玩家卡')
  inv.hand = [...hand]
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'balconyParley'), true)
  const api = stubApi()
  behavior.performAction(state, inv, { rule: 'balconyParley' }, api)
  assert.equal(state.scenarioFlags.balconyParleyUsed, true)
  assert.equal(api.calls.filter(call => call.name === 'gainClues').length, 1)
  assert.ok(inv.hand.length < 3, '至少弃掉一张手牌换到 2 个线索')
  // 图标不足：无效且不获得线索。
  const weak = setup(stateFor())
  weak.investigators[0].location = 'balcony'
  weak.investigators[0].hand = []
  const weakApi = stubApi()
  behavior.performAction(weak, weak.investigators[0], { rule: 'balconyParley' }, weakApi)
  assert.equal(weakApi.calls.some(call => call.name === 'gainClues'), false)
})

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
test('结局记录：r1/r2/r3 写对应战役记录，未知 key 抛错', () => {
  const state = setup(stateFor())
  const api = stubApi()
  assert.deepEqual(behavior.resolution(state, 'r1', [], api), { award: true, bonus: 0 })
  assert.equal(state.campaign.records.theInvestigatorsEscapedTheSpectralRealm, true)
  assert.match(state.scenarioFlags.interludeKey, /^ThePriceOfProgress[456]$/)
  const state2 = setup(stateFor())
  behavior.resolution(state2, 'r2', [], stubApi())
  assert.equal(state2.campaign.records.theInvestigatorsLearnedNothingOfTheLodgesSchemes, true)
  const state3 = setup(stateFor())
  behavior.resolution(state3, 'r3', [], stubApi())
  assert.equal(state3.campaign.records.theInvestigatorsAreNeverSeenOrHeardFromAgain, true)
  assert.equal(state3.campaign.investigators[0].status, 'killed')
  assert.equal(state3.campaign.investigators[1].status, 'killed')
  assert.throws(() => behavior.resolution(state, 'r9', [], stubApi()), /未知死亡门前结局/)
})

test('无结局按当前幕映射：幕 1→r2、幕 2→r3、幕 3→r1，正文键同步', () => {
  for (const [actIndex, expected] of [[0, 'r2'], [1, 'r3'], [2, 'r1']]) {
    const state = setup(stateFor())
    state.actIndex = actIndex
    assert.equal(behavior.storyResolutionKey(state, 'noResolution'), expected)
    const api = stubApi()
    behavior.resolution(state, 'noResolution', [], api)
    const records = state.campaign.records
    if (expected === 'r2') assert.equal(records.theInvestigatorsLearnedNothingOfTheLodgesSchemes, true)
    if (expected === 'r3') assert.equal(records.theInvestigatorsAreNeverSeenOrHeardFromAgain, true)
    if (expected === 'r1') assert.equal(records.theInvestigatorsEscapedTheSpectralRealm, true)
  }
})

test('结局 1 的幕间分支：Josef 在胜利区 → 4，在大厅底下 → 5，否则比银暮秘社数量', () => {
  const state = setup(stateFor())
  state.victoryDisplay.push({ id: 'e', code: JOSEF, originalCode: JOSEF, victory: 2 })
  behavior.resolution(state, 'r1', [], stubApi())
  assert.equal(state.scenarioFlags.interludeKey, 'ThePriceOfProgress4')
  const beneath = setup(stateFor())
  beneath.scenarioFlags.beneathEntryHall = [JOSEF]
  behavior.resolution(beneath, 'r1', [], stubApi())
  assert.equal(beneath.scenarioFlags.interludeKey, 'ThePriceOfProgress5')
  const sixth = setup(stateFor())
  sixth.scenarioFlags.beneathEntryHall = ['05095']
  behavior.resolution(sixth, 'r1', [], stubApi())
  assert.equal(sixth.scenarioFlags.interludeKey, 'ThePriceOfProgress6')
})

// ---------------------------------------------------------------------------
// 存档往返与确定性（saveReplay 证据：字面 JSON.stringify + deepEqual + 章节路径）
// ---------------------------------------------------------------------------
test('同一路线确定性：同种子两次布置与两幕推进后的 JSON 完全一致', () => {
  const build = () => {
    const state = setup(stateFor(), 41)
    state.campaign.records.missingPersons = ['05046', '05049']
    behavior.afterChaosBagSetup(state, [])
    const api = stubApi()
    behavior.agendaReveal(state, state.agendas[0], api)
    behavior.actReveal(state, state.acts[0], api)
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('存档往返：scenarios/atDeathsDoorstep/ 的状态经 JSON 序列化后一致，且能继续结算', () => {
  const state = setup(stateFor(), 7)
  state.campaign.records.missingPersons = ['05046', '05047']
  state.scenarioFlags.monsterSetAside = ['05101']
  state.enemies.push({ id: 'josef', code: JOSEF, originalCode: JOSEF, name: '约瑟夫·梅吉尔', location: 'entryHall', traits: ['Silver Twilight'], doom: 1 })
  const before = JSON.parse(JSON.stringify(state))
  assert.deepEqual(before.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(before.scenarioZones, state.scenarioZones)
  assert.deepEqual(before.locations.map(location => location.maxClues),
    state.locations.map(location => location.maxClues))
  // 往返后继续跑一次胜利结局：记录仍能写入（状态键都是纯 JSON）。
  behavior.resolution(before, 'r1', [], stubApi())
  assert.equal(before.campaign.records.theInvestigatorsEscapedTheSpectralRealm, true)
  assert.deepEqual(JSON.parse(JSON.stringify(before)).scenarioFlags, before.scenarioFlags)
})
