// 《万象无终 · 恶罪报应》（theWagesOfSin 05161）章节测试。
//
// 钩子级测试：直接 import 本章 `scenarios/theWagesOfSin/` 的 definition/index/behavior，
// 手工搭假 state + 确定性 api。覆盖：身份/区域/双面地点、双遭遇牌库与 encounterDeckFor 路由、
// 异端者多面/翻面/未了之事/放逐、地点规则与 hauntedScript、混乱标记、结局记录、存档往返。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as wages from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/index.js'
import {
  HERETIC_ENEMY_CODES, HERETIC_FACES, IMMEDIATE_UNFINISHED_BUSINESS, SPECTRAL_DECK_CODES,
  STANDARD_DECK_CODES, UNFINISHED_BUSINESS_CODES, UNFINISHED_BUSINESS_RULES,
  scenario as definition,
} from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/definition.js'
import { resolveChaosToken, chaosAfterTest, unfinishedBusinessInVictory }
  from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const clone = value => structuredClone(value)
const behavior = wages.behavior

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
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'hangmansBrook',
      willpower: 3, intellect: 3, combat: 3, agility: 3,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    victory: 0,
    encounterDeck: [],
    encounterDiscard: [],
    extraEncounterDecks: {},
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

// 引擎 placeLocation 的等价物：地点入场（本章全部已揭示，线索按印刷值）。
function placed(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    state.locations.push({
      ...clone(base), id, revealed: true, doom: 0,
      clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
      maxClues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

function setup(state, seed = 1) {
  const ids = behavior.setupLocations(state, [], setupApi(seed))
  placed(state, ids)
  behavior.afterChaosBagSetup(state, [])
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const byBaseCode = (state, codes) => state.locations.filter(location => codes.includes(location.originalCode))

// 记录型 api：flipEnemy/flipSpectral 用与引擎一致的简化语义（翻面 + 威胁区卡）。
function stubApi(overrides = {}) {
  const calls = []
  const record = name => (...args) => { calls.push({ name, args }); return null }
  const api = {
    calls,
    info: record('info'),
    random: () => 0.5,
    shuffle: list => [...list],
    choose: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    damage: record('damage'),
    horror: record('horror'),
    haunted: (seat, options) => calls.push({ name: 'haunted', args: [seat, options] }),
    directDamage: record('directDamage'),
    directHorror: record('directHorror'),
    damageEnemy: record('damageEnemy'),
    doomOn: record('doomOn'),
    gainClues: record('gainClues'),
    giveAsset: record('giveAsset'),
    spawn: (code, location, seat) => { calls.push({ name: 'spawn', args: [code, location, seat] }); return null },
    spawnEngaged: (code, location, seat) => { calls.push({ name: 'spawnEngaged', args: [code, location, seat] }); return null },
    spawnStoryEnemy: (code, location, stats, extra) =>
      calls.push({ name: 'spawnStoryEnemy', args: [code, location, stats, extra] }),
    moveEnemy: record('moveEnemy'),
    moveInvestigator: record('moveInvestigator'),
    attack: record('attack'),
    advanceAct: record('advanceAct'),
    advanceAgenda: record('advanceAgenda'),
    resign: record('resign'),
    finish: key => calls.push({ name: 'finish', args: [key] }),
    shuffleDiscard: record('shuffleDiscard'),
    threat: (seat, code) => calls.push({ name: 'threat', args: [seat, code] }),
    cardFlip: record('cardFlip'),
    discardRandom: (seat, n) => calls.push({ name: 'discardRandom', args: [seat, n] }),
    discardChosen: (seat, n) => calls.push({ name: 'discardChosen', args: [seat, n] }),
    drawEncounter: record('drawEncounter'),
    drawExtra: record('drawExtra'),
    stepToward: (from, to) => (overrides.stepToward ? overrides.stepToward(from, to) : null),
    flipSpectral: (id) => { calls.push({ name: 'flipSpectral', args: [id] }); return true },
    flipEnemy: (enemy, code) => { calls.push({ name: 'flipEnemy', args: [enemy?.code, code] }); return null },
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty, bonus, source] })
      if (overrides.testResolve) resolve({ success: overrides.testResolve === 'success', value: 6, difficulty, drawn: [] })
    },
  }
  for (const [name, fn] of Object.entries(overrides)) {
    if (name.endsWith('Return')) continue
    if (typeof fn === 'function' && !(name in api)) api[name] = fn
    else if (typeof fn === 'function') api[name] = fn
  }
  return api
}

// 让 stubApi 里的 flipSpectral / flipEnemy 用与引擎一致的简化语义（需要 state）。
function apiFor(state, overrides = {}) {
  const api = stubApi(overrides)
  api.threat = (seat, code) => {
    api.calls.push({ name: 'threat', args: [seat, code] })
    state.investigators[seat].threat.push({ id: `threat:${code}:${api.calls.length}`, code })
  }
  api.flipSpectral = id => {
    api.calls.push({ name: 'flipSpectral', args: [id] })
    const location = state.locations.find(entry => entry.id === id)
    if (location) {
      const back = location.back
      location.spectral = true
      location.spectralFace = 'spectral'
      if (back?.code) {
        location.code = back.code
        location.originalCode = back.code
        location.name = back.name || location.name
      }
      api.calls.push({ name: 'flipSpectralApplied', args: [id, location.originalCode] })
    }
    return true
  }
  api.flipEnemy = (enemy, code) => {
    api.calls.push({ name: 'flipEnemy', args: [enemy?.code, code] })
    const face = (enemy.faces || []).find(entry => entry.code === code)
    const side = face?.side === 'unfinishedBusiness' ? 'unfinishedBusiness' : 'enemy'
    if (side === 'unfinishedBusiness') {
      const holder = state.investigators.find(inv => (inv.engaged || []).includes(enemy.id))
        || state.investigators.find(inv => !inv.defeated && !inv.resigned)
      for (const inv of state.investigators) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
      if (holder) holder.threat.push({ id: `threat:${code}`, code })
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      enemy.side = side
      return { side, code, changed: true, threatHolder: holder?.seat ?? null }
    }
    for (const inv of state.investigators) {
      inv.threat = inv.threat.filter(card => card.code !== code && card.code !== enemy.hereticStory)
    }
    enemy.code = code
    enemy.originalCode = code
    enemy.side = 'enemy'
    if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
    return { side, code, changed: true }
  }
  return api
}

// ---------------------------------------------------------------------------
// 身份 / 数据
// ---------------------------------------------------------------------------
test('恶罪报应：章节为 playable，保留 11 处双面地点与双层遭遇牌库', () => {
  assert.equal(wages.manifest.status, 'playable')
  assert.equal(wages.manifest.catalogReferenceOnly, undefined)
  assert.equal(wages.manifest.campaignId, 'theCircleUndone')
  assert.equal(wages.manifest.contentVersion, '1.0.0')
  assert.equal(wages.scenario.originalCode, '05161')
  assert.equal(behavior.id, 'theWagesOfSin')
  assert.equal(Object.keys(wages.scenario.locations).length, 11)
  assert.deepEqual(wages.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(wages.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(wages.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3'])
  assert.deepEqual(wages.manifest.requiredEncounterGroupIds, [
    'theWagesOfSin', 'anettesCoven', 'cityOfSins', 'inexorableFate', 'realmOfDeath',
    'theWatcher', 'trappedSpirits', 'witchcraft',
  ])
  assert.deepEqual(wages.manifest.requiredMechanicIds,
    ['tcuSpectral', 'tcuHaunted', 'tcuHeretics', 'tcuWatcher', 'tcuChaos', 'tcuMemento'])
  assert.equal(wages.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0), 24,
    '基础遭遇牌库 24 张')
  assert.equal(SPECTRAL_DECK_CODES.length, 20, '幽灵遭遇牌库 20 张')
  assert.equal(STANDARD_DECK_CODES.length, 24)
})

test('11 对双面地点：正面/幽灵面卡号一一对应，幽灵面是 back 数据', () => {
  const expected = {
    hangmansBrook: ['05166', '05166b'],
    hauntedFields: ['05167', '05167b'],
    abandonedChapel: ['05168', '05168b'],
    theGallows169: ['05169', '05169b'],
    theGallows170: ['05170', '05170b'],
    hereticsGraves171: ['05171', '05171b'],
    hereticsGraves172: ['05172', '05172b'],
    chapelCrypt173: ['05173', '05173b'],
    chapelCrypt174: ['05174', '05174b'],
    chapelAttic175: ['05175', '05175b'],
    chapelAttic176: ['05176', '05176b'],
  }
  for (const [id, [front, back]] of Object.entries(expected)) {
    const location = definition.locations[id]
    assert.equal(location.originalCode, front, `${id} 正面`)
    assert.equal(location.back.code, back, `${id} 幽灵面`)
  }
  // 05170 的隐藏值 X 由 behavior 给出，definition 归零。
  assert.equal(definition.locations.theGallows170.shroud, 0)
  assert.equal(definition.locations.theGallows170.back.shroud, 0)
})

test('异端者 6 张 ×2 面：faces 数据与 +2×人数生命值进入定义', () => {
  assert.equal(HERETIC_FACES.length, 6)
  assert.equal(HERETIC_ENEMY_CODES.length, 6)
  assert.equal(UNFINISHED_BUSINESS_CODES.length, 6)
  for (const face of HERETIC_FACES) {
    const enemy = definition.enemies[face.enemy]
    assert.deepEqual(enemy.faces, [
      { code: face.enemy, side: 'enemy' },
      { code: face.story, side: 'unfinishedBusiness' },
    ])
    assert.equal(enemy.healthPerPlayerBonus, 2)
    assert.equal(definition.storyAssets[face.story].code, face.story)
  }
  assert.deepEqual(IMMEDIATE_UNFINISHED_BUSINESS, ['05178j', '05178l'])
  assert.equal(definition.storyAssets['05177'].code, '05177')
})

test('符号连线：绞刑者河只连闹鬼农田与废弃教堂，变体之间互不相连', () => {
  const locations = Object.fromEntries(wages.manifest.locations.map(entry => [entry.id, entry]))
  assert.deepEqual([...locations.hangmansBrook.connections].sort().filter(id => !id.includes('1')),
    ['abandonedChapel', 'hauntedFields'])
  // 变体对内部不互联。
  assert.equal(locations.theGallows169.connections.includes('theGallows170'), false)
  assert.equal(locations.chapelAttic175.connections.includes('chapelAttic176'), false)
  // 每条连接都指向存在的地点 id，且双向一致。
  for (const entry of wages.manifest.locations) {
    for (const other of entry.connections) {
      assert.ok(locations[other], `${entry.id} → ${other} 必须存在`)
      assert.ok(locations[other].connections.includes(entry.id), `${entry.id} ↔ ${other} 应双向`)
    }
  }
})

test('layout 覆盖全部 11 个地点，变体共享坐标', () => {
  assert.equal(Object.keys(wages.manifest.layout.locations).length, 11)
  assert.deepEqual(wages.manifest.layout.locations.theGallows169, wages.manifest.layout.locations.theGallows170)
  assert.deepEqual(wages.manifest.layout.locations.hangmansBrook, { x: 4, y: 4 })
  assert.equal(wages.manifest.layout.edges.length, 38)
})

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
test('布置：每组地点随机选 1 张入场（共 7 处），其余记入 removed，异端者选 4 留 2', () => {
  const state = stateFor()
  const ids = behavior.setupLocations(state, [], setupApi(5))
  assert.equal(ids.length, 7)
  assert.equal(new Set(ids).size, 7)
  assert.ok(ids.includes('hangmansBrook'))
  assert.ok(ids.includes('hauntedFields'))
  assert.ok(ids.includes('abandonedChapel'))
  // 变体组各选 1 个。
  for (const group of [['theGallows169', 'theGallows170'], ['hereticsGraves171', 'hereticsGraves172'],
    ['chapelCrypt173', 'chapelCrypt174'], ['chapelAttic175', 'chapelAttic176']]) {
    assert.equal(group.filter(id => ids.includes(id)).length, 1)
  }
  assert.equal(state.scenarioZones.removed.length, 4)
  assert.equal(state.scenarioFlags.hereticPool.length, 4)
  assert.equal(state.scenarioFlags.hereticsRemoved.length, 2)
  assert.equal(state.scenarioZones.setAside.length, 11, '4 异端者 + 4 幽灵迷网 + 看守人组 3 张')
  assert.equal(state.scenarioZones.setAside.filter(code => code === '05177').length, 4)
  assert.ok(state.scenarioZones.setAside.includes('05086'))
  assert.deepEqual(state.scenarioFlags.unfinishedBusiness, [])
})

test('布置：同种子选点与牌库一致，不同种子选点不同；幽灵牌库 20 张已洗', () => {
  const build = seed => {
    const state = stateFor()
    const ids = behavior.setupLocations(state, [], setupApi(seed))
    return { ids, spectral: state.extraEncounterDecks.spectral }
  }
  const first = build(11)
  const second = build(11)
  assert.deepEqual(first, second)
  assert.deepEqual([...first.spectral.deck].sort(), [...SPECTRAL_DECK_CODES].sort(),
    '幽灵牌库按印刷张数保留重复（20 张）')
  assert.equal(first.spectral.deck.length, 20)
  assert.deepEqual(first.spectral.discard, [])
})

test('布置后的地点连接已裁剪：不会留下未入场变体的悬空连接', () => {
  const state = stateFor()
  const ids = behavior.setupLocations(state, [], setupApi(9))
  for (const id of ids) {
    const location = state.scenario.locations[id]
    for (const connection of location.connections) {
      assert.ok(ids.includes(connection), `${id} 不应连到未入场的 ${connection}`)
    }
  }
})

test('幽灵遭遇牌库路由：位于幽灵地点时用 spectral，否则用基础牌库', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  assert.equal(behavior.encounterDeckFor(state, inv), null, '非幽灵地点 → 基础牌库')
  loc(state, 'hangmansBrook').spectral = true
  loc(state, 'hangmansBrook').spectralFace = 'spectral'
  assert.equal(behavior.encounterDeckFor(state, inv), 'spectral')
  const other = state.investigators[1]
  other.location = 'hauntedFields'
  assert.equal(behavior.encounterDeckFor(state, other), null)
})

// ---------------------------------------------------------------------------
// 地点规则
// ---------------------------------------------------------------------------
test('翻到幽灵面：写入对应 haunted 数据，翻回清空；幽灵面卡号同步', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const attic = state.locations.find(location =>
    ['chapelAttic175', 'chapelAttic176'].includes(location.id))
  for (const id of ['hauntedFields', 'abandonedChapel', 'hangmansBrook', attic.id]) {
    const location = loc(state, id)
    api.flipSpectral(id)
    behavior.locationFlipped(state, location, api)
    assert.ok(location.haunted?.length >= 1, `${id} 幽灵面应有闹鬼能力`)
    assert.match(location.originalCode, /b$/, '幽灵面卡号以 b 结尾')
  }
  // 翻回正常面：清除 haunted（引擎会同时把 spectral 置 false）。
  attic.spectral = false
  attic.spectralFace = 'normal'
  attic.code = attic.front?.code || attic.code.replace(/b$/, '')
  attic.originalCode = attic.code
  behavior.locationFlipped(state, attic, api)
  assert.equal(attic.haunted, undefined)
})

test('地点常驻规则：绞刑架 169/170 隐藏值、教堂地下室 -3、异端者墓地调查加成', () => {
  const state = setup(stateFor())
  const gallows = state.locations.find(location =>
    ['theGallows169', 'theGallows170'].includes(location.id))
  const crypt = state.locations.find(location =>
    ['chapelCrypt173', 'chapelCrypt174'].includes(location.id))
  const graves = state.locations.find(location =>
    ['hereticsGraves171', 'hereticsGraves172'].includes(location.id))
  state.enemies.push({ id: 'w1', code: '05090', traits: ['Witch'], location: 'hauntedFields' })
  state.enemies.push({ id: 'g1', code: '05180', traits: ['Geist', 'Spectral'], location: 'hangmansBrook' })
  assert.equal(behavior.locationShroudModifier(state, gallows), 1)
  if (crypt) assert.equal(behavior.locationShroudModifier(state, crypt), -3)
  state.enemies.push({ id: 'ready', code: '05179', traits: ['Witch'], location: crypt?.id || 'hangmansBrook', exhausted: false })
  if (crypt) assert.equal(behavior.locationShroudModifier(state, crypt), 0)
  // 异端者墓地 171 面：调查时把意志值加入技能值（beforeInvestigate 登记后 statModifier 生效）。
  const inv = state.investigators[0]
  inv.location = graves.id
  behavior.beforeInvestigate(state, inv, graves)
  if (graves.originalCode === '05171') {
    assert.equal(behavior.statModifier(state, inv, 'intellect'), inv.willpower)
  } else {
    assert.equal(behavior.statModifier(state, inv, 'intellect'), 0, '172 面没有调查加成')
  }
  behavior.afterTest(state, inv, { drawn: [], success: true }, stubApi())
  assert.equal(behavior.statModifier(state, inv, 'intellect'), 0)
})

test('废弃教堂：神话阶段位于此地的调查员每项技能 -1', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  inv.location = 'abandonedChapel'
  state.phase = 'mythos'
  assert.equal(behavior.statModifier(state, inv, 'willpower'), -1)
  state.phase = 'investigation'
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 0)
})

test('教堂阁楼：抽到非弱点卡放在阁楼底下，成功调查后返还；幽灵面闹鬼随机弃掉底下卡', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const attic = state.locations.find(location =>
    ['chapelAttic175', 'chapelAttic176'].includes(location.id))
  const inv = state.investigators[0]
  inv.location = attic.id
  // 175 面有「放在底下」；176 面没有。按实际入场变体断言。
  inv.hand = ['01020']
  behavior.cardDrawn(state, inv, '01020', api)
  if (attic.originalCode === '05175') {
    assert.equal(inv.hand.length, 0)
    assert.deepEqual(attic.beneath, [{ code: '01020', ownerSeat: 0 }])
    behavior.investigateResult(state, inv, attic, { success: true }, api)
    assert.equal(inv.hand.includes('01020'), true)
    assert.deepEqual(attic.beneath, [])
  } else {
    assert.equal(inv.hand.length, 1)
  }
  // 闹鬼：随机弃掉底下一张（幽灵面能力独立于变体）。
  attic.spectralFace = 'spectral'
  attic.beneath = [{ code: '01026', ownerSeat: 1 }]
  behavior.hauntedScript(state, { scriptId: 'discardBeneathAttic', seat: 0 }, api)
  assert.deepEqual(attic.beneath, [])
})

test('hauntedScript 覆盖全部幽灵面脚本（含遭遇牌库弃牌与牌库顶生成）', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const inv = state.investigators[0]
  inv.location = 'hangmansBrook'
  assert.equal(behavior.hauntedScript(state, { scriptId: 'lockResignThisRound', seat: 0 }, api), true)
  assert.equal(inv.wosResignLockedRound, 1)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'roundSkillPenalty', seat: 0 }, api), true)
  assert.equal(inv.wosRoundSkillPenalty, 1)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'baseWillpowerOne', seat: 0 }, api), true)
  assert.equal(inv.wosBaseWillpower.round, 1)
  // baseWillpower 的修正 = 1 - 基础意志；此处还叠加了本轮 -1（roundSkillPenalty）。
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 1 - inv.willpower - 1)
  state.enemies.push({ id: 's', code: '05180', traits: ['Geist', 'Spectral'], location: 'hauntedFields' })
  assert.equal(behavior.hauntedScript(state, { scriptId: 'healHereticsAndWitches', seat: 0 }, api), true)
  // 弃标准遭遇牌库顶 3 张：女巫敌人改为抽出交战。
  state.encounterDeck = ['01020', '05090']
  state.encounterDiscard = []
  behavior.hauntedScript(state, { scriptId: 'discardStandardForWitch', seat: 0 }, api)
  assert.ok(api.calls.some(call => call.name === 'spawnEngaged' && call.args[0] === '05090'))
  // 牌库顶生成苏生亡者。
  inv.deck = ['01026']
  behavior.hauntedScript(state, { scriptId: 'spawnReanimatedDead', seat: 0 }, api)
  assert.ok(api.calls.some(call => call.name === 'spawnStoryEnemy' && call.args[0] === 'xreanimated'))
  // 巫术诡计从遭遇弃牌堆进入威胁区。
  state.encounterDiscard = ['01020', '05093']
  behavior.hauntedScript(state, { scriptId: 'hexFromDiscardToThreat', seat: 0 }, api)
  assert.ok(api.calls.some(call => call.name === 'threat' && call.args[1] === '05093'))
})

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
test('议程 1b：所有地点翻到幽灵面、看守人生成在绞刑者河、幽灵弃牌堆洗回', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  state.extraEncounterDecks.spectral.discard = ['05182']
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.ok(state.locations.every(location => location.spectralFace === 'spectral'))
  const spawn = api.calls.find(call => call.name === 'spawn')
  assert.deepEqual(spawn.args.slice(0, 2), ['05086', 'hangmansBrook'])
  const piles = state.extraEncounterDecks.spectral
  assert.ok(piles.deck.includes('05182'), '幽灵弃牌堆洗回牌库')
  assert.deepEqual(piles.discard, [])
  assert.equal(state.scenarioZones.setAside.includes('05087'), false, '05087 已从放一边移入幽灵牌库')
  assert.ok(piles.deck.includes('05087'), '看守人的攫噬 ×2 洗入幽灵牌库')
})

test('议程 2b → 结局 2', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.deepEqual(api.calls.filter(call => call.name === 'finish'), [{ name: 'finish', args: ['r2'] }])
})

test('幕 1b：4 处地点各生成 1 个异端者并加线索；Memento≥3 时每人获得幽灵迷网', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  state.campaign.records.mementosDiscovered = ['cornHuskDoll', 'wispOfSpectralMist', 'bloodyRibbon']
  behavior.actReveal(state, state.acts[0], api)
  const spawns = api.calls.filter(call => call.name === 'spawn')
  assert.equal(spawns.length, 4, '4 处地点各生成 1 个异端者')
  const spawnedCodes = spawns.map(call => call.args[0])
  assert.deepEqual(spawnedCodes, state.scenarioFlags.hereticPool)
  assert.equal(state.scenarioFlags.hereticsSpawned, true)
  // 四个指定地点线索 +2×人数；其他地点 +1×人数（在印刷线索基础上叠加）。
  const hereticLocations = spawns.map(call => call.args[1])
  for (const location of state.locations) {
    const printedClues = (state.scenario.locations[location.id]?.cluesPerInvestigator || 0) * state.numInvestigators
    const added = hereticLocations.includes(location.id) ? 2 * state.numInvestigators : state.numInvestigators
    assert.equal(location.maxClues, printedClues + added, `${location.name} 线索 ${printedClues}+${added}`)
  }
  // Memento ≥ 3 → 每人拿 1 张幽灵迷网。
  const webs = api.calls.filter(call => call.name === 'giveAsset')
  assert.equal(webs.length, state.numInvestigators)
  assert.ok(webs.every(call => call.args[1] === '05177'))
})

test('幕 2b：记录玉米皮娃娃并进入结局 1', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  behavior.actReveal(state, state.acts[1], api)
  assert.deepEqual(state.campaign.records.mementosDiscovered, ['cornHuskDoll'])
  assert.deepEqual(api.calls.filter(call => call.name === 'finish'), [{ name: 'finish', args: ['r1'] }])
})

test('幕 2 目标：胜利区 4 张未了之事 → 推进幕', () => {
  const state = setup(stateFor())
  state.actIndex = 1
  const api = apiFor(state)
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.some(call => call.name === 'advanceAct'), false)
  for (const code of ['05178b', '05178d', '05178f', '05178h']) {
    state.victoryDisplay.push({ id: code, code, originalCode: code, victory: 1 })
  }
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.filter(call => call.name === 'advanceAct').length, 1)
  assert.equal(unfinishedBusinessInVictory(state), 4)
})

// ---------------------------------------------------------------------------
// 异端者
// ---------------------------------------------------------------------------
test('异端者生成：挂上 faces/side，在非幽灵地点受限（不能攻击/受伤）', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const enemy = {
    id: 'heretic', code: '05178a', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Geist', 'Witch', 'Spectral', 'Elite'], health: 6, damageTaken: 0,
    engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(enemy)
  behavior.enemySpawned(state, enemy, api)
  assert.equal(enemy.hereticFace, '05178a')
  assert.equal(enemy.hereticStory, '05178b')
  assert.equal(enemy.hereticRestricted, true, '非幽灵地点受限')
  assert.equal(behavior.canFightEnemy(state, state.investigators[0], enemy), false)
  assert.equal(behavior.enemyDamageAllowed(state, enemy), false)
  // 翻到幽灵面后解除限制。
  apiFor(state).flipSpectral('hauntedFields')
  loc(state, 'hauntedFields').spectralFace = 'spectral'
  behavior.turnBegins(state, state.investigators[0], api)
  assert.equal(behavior.enemyDamageAllowed(state, enemy), true)
})

test('异端者被击败 → 翻到未了之事面并进入威胁区；轮末可翻回敌人面', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const enemy = {
    id: 'heretic', code: '05178g', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Spectral', 'Elite'], health: 6, damageTaken: 6, engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(enemy)
  state.investigators[0].engaged.push(enemy.id)
  behavior.enemySpawned(state, enemy, api)
  // 翻面需要幽灵地点 / 允许受伤；这里直接调用被击败钩子（引擎已把敌人移出场）。
  state.enemies.splice(state.enemies.indexOf(enemy), 1)
  const handled = behavior.enemyDefeated(state, enemy, api)
  assert.equal(handled, true)
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 1)
  assert.equal(state.scenarioFlags.unfinishedBusiness[0].storyCode, '05178h')
  assert.equal(state.investigators[0].threat.some(card => card.code === '05178h'), true)
  // 轮末：选择「翻回敌人面」。
  const endRoundApi = apiFor(state, { choose: request => request.options.find(option => option.id === 'flip').id })
  behavior.roundEnded(state, endRoundApi)
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 0)
  assert.ok(state.enemies.some(candidate => candidate.code === '05178g'), '敌人回到战场')
  assert.equal(state.investigators[0].threat.length, 0)
})

test('未了之事的强制：选择伤害分支（往昔重担/石板标记共用同一函数）', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { choose: request => request.options.find(option => option.id === 'harm').id })
  const inv = state.investigators[0]
  inv.threat.push({ id: 'threat', code: '05178b' })
  state.scenarioFlags.unfinishedBusiness = [{
    storyCode: '05178b', enemyCode: '05178a', holderSeat: 0, locationId: inv.location, enemySnapshot: {},
  }]
  behavior.roundEnded(state, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'horror'), [{ name: 'horror', args: [0, 1] }])
  // D 面：受到 1 点伤害。
  const state2 = setup(stateFor())
  const api2 = apiFor(state2, { choose: request => request.options.find(option => option.id === 'harm').id })
  state2.investigators[0].threat.push({ id: 't2', code: '05178d' })
  behavior.roundEnded(state2, api2)
  assert.deepEqual(api2.calls.filter(call => call.name === 'damage'), [{ name: 'damage', args: [0, 1] }])
})

test('驱除未了之事：[action] 在对应地点无线索时检定成功 → 进入胜利区', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { testResolve: 'success' })
  const inv = state.investigators[0]
  const crypt = loc(state, 'chapelCrypt173')
  inv.location = crypt.id
  crypt.clues = 0
  inv.threat.push({ id: 'threat', code: '05178b' })
  state.scenarioFlags.unfinishedBusiness = [{
    storyCode: '05178b', enemyCode: '05178a', holderSeat: 0, locationId: crypt.id, enemySnapshot: {},
  }]
  const moves = behavior.actions(state, inv).filter(move => move.rule === 'banishUnfinishedBusiness')
  assert.equal(moves.length, 2, '两种技能各一条行动')
  behavior.performAction(state, inv, moves[0], api)
  assert.equal(state.victoryDisplay.some(card => card.code === '05178b'), true)
  assert.equal(state.victory, 1)
  assert.equal(inv.threat.length, 0)
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 0)
})

test('异端者 I（J 面）：被击败后立即翻回并攻击，且本场不能以任何方式被击败', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  loc(state, 'hauntedFields').spectral = true
  loc(state, 'hauntedFields').spectralFace = 'spectral'
  const enemy = {
    id: 'hereticI', code: '05178i', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Spectral', 'Elite'], health: 6, damageTaken: 6, engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(enemy)
  state.investigators[0].engaged.push(enemy.id)
  behavior.enemySpawned(state, enemy, api)
  state.enemies.splice(state.enemies.indexOf(enemy), 1)
  behavior.enemyDefeated(state, enemy, api)
  const back = state.enemies.find(candidate => candidate.code === '05178i')
  assert.ok(back, '翻回敌人面并重新进入战场')
  assert.equal(back.cannotBeDefeated, true)
  assert.equal(back.hereticJResolved, true)
  assert.equal(behavior.enemyCanBeDefeated(state, back), false)
  assert.ok(api.calls.some(call => call.name === 'attack'))
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 0, 'J 不等在威胁区')
  // 再次谈判（J 已结算）→ 驱除：胜利区加入 J 面。
  state.investigators[0].clues = 5
  state.investigators[0].location = loc(state, 'hauntedFields').id
  const parleyApi = apiFor(state)
  const moves = behavior.actions(state, state.investigators[0]).filter(move => move.rule === 'hereticParley')
  assert.equal(moves.length, 1)
  behavior.performAction(state, state.investigators[0], moves[0], parleyApi)
  assert.equal(state.victoryDisplay.some(card => card.code === '05178j'), true)
})

test('异端者 K（L 面）：被击败后翻回攻击，下次击败即驱除', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  loc(state, 'hauntedFields').spectral = true
  loc(state, 'hauntedFields').spectralFace = 'spectral'
  const enemy = {
    id: 'hereticK', code: '05178k', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Spectral', 'Elite'], health: 6, damageTaken: 6, engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(enemy)
  state.investigators[0].engaged.push(enemy.id)
  behavior.enemySpawned(state, enemy, api)
  state.enemies.splice(state.enemies.indexOf(enemy), 1)
  behavior.enemyDefeated(state, enemy, api)
  const back = state.enemies.find(candidate => candidate.code === '05178k')
  assert.equal(back.hereticBanishNext, true)
  assert.equal(behavior.enemyCanBeDefeated(state, back), true)
  // 第二次击败 → 驱除（进入胜利区的是 L 面）。
  state.enemies.splice(state.enemies.indexOf(back), 1)
  behavior.enemyDefeated(state, back, api)
  assert.equal(state.victoryDisplay.some(card => card.code === '05178l'), true)
  assert.equal(state.enemies.some(candidate => candidate.hereticFace === '05178k'), false)
})

test('复仇女巫被击败：同地点每位调查员受到其伤害与恐惧（直接）', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const inv = state.investigators[0]
  const witch = {
    id: 'witch', code: '05179', name: '复仇女巫', location: inv.location,
    traits: ['Humanoid', 'Witch'], damage: 1, horror: 1, health: 3,
  }
  state.enemies.push(witch)
  behavior.enemyDefeated(state, witch, api)
  assert.equal(api.calls.filter(call => call.name === 'directDamage').length, state.numInvestigators)
  assert.deepEqual(api.calls.filter(call => call.name === 'directDamage')[0].args, [0, 1])
  assert.deepEqual(api.calls.filter(call => call.name === 'directHorror')[0].args, [0, 1])
})

test('恶毒邪灵：非[[法术]]/[[遗物]]伤害致命时改为治愈、横置并移动到幽灵地点', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { stepToward: () => 'hauntedFields' })
  loc(state, 'hauntedFields').spectral = true
  loc(state, 'hauntedFields').spectralFace = 'spectral'
  const spirit = {
    id: 'spirit', code: '05180', name: '恶毒邪灵', location: 'chapelAttic175',
    traits: ['Monster', 'Geist', 'Spectral'], health: 2, damageTaken: 2, engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(spirit)
  state.investigators[0].engaged.push(spirit.id)
  behavior.enemyDamaged(state, spirit, api, 0, 'combat-damage')
  assert.equal(spirit.damageTaken, 0)
  assert.equal(spirit.exhausted, true)
  assert.ok(api.calls.some(call => call.name === 'moveEnemy'))
  // 法术/遗物来源：不取消击败（保留伤害，让引擎正常击败）。
  const second = setup(stateFor())
  const api2 = apiFor(second)
  second.investigators[0].assets.push({ id: 'spell-asset', code: '05177' })
  const spirit2 = {
    id: 'spirit2', code: '05180', name: '恶毒邪灵', location: 'chapelAttic175',
    traits: ['Monster', 'Geist', 'Spectral'], health: 2, damageTaken: 2, engagedSeat: 0, exhausted: false,
  }
  second.enemies.push(spirit2)
  behavior.enemyDamaged(second, spirit2, api2, 0, 'spell-asset')
  assert.equal(spirit2.damageTaken, 2)
})

test('生成地点：复仇女巫去绞刑架/墓地，恶毒邪灵去教堂阁楼/地下室', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const witchLocation = behavior.spawnLocation(state, '05179', 'hangmansBrook', null, api)
  assert.ok(['theGallows169', 'theGallows170', 'hereticsGraves171', 'hereticsGraves172'].includes(witchLocation))
  const spiritLocation = behavior.spawnLocation(state, '05180', 'hangmansBrook', null, api)
  assert.ok(['chapelAttic175', 'chapelAttic176', 'chapelCrypt173', 'chapelCrypt174'].includes(spiritLocation))
  assert.equal(behavior.spawnLocation(state, '05090', 'hangmansBrook', null, api), 'hangmansBrook')
})

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
test('混乱标记 skull：-X（X=胜利区未了之事张数+1，困难面为张数且再抽一个）', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  assert.equal(resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  state.victoryDisplay.push({ id: 'a', code: '05178b' }, { id: 'b', code: '05178d' })
  assert.equal(resolveChaosToken(state, inv, 'skull', {}).delta, -3)
  const hard = resolveChaosToken({ ...state, difficulty: 'hard' }, inv, 'skull', {})
  assert.equal(hard.delta, -2)
  assert.equal(hard.drawAnother, true)
})

test('混乱标记 cultist：本轮异端者 +1 攻击/躲避（实例标记由共享 enemyStatModifier 读取）', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const heretic = {
    id: 'h', code: '05178a', name: '异端者', location: inv.location,
    traits: ['Monster', 'Spectral', 'Elite'], hereticFace: '05178a', roundFightEvadeBonus: null,
  }
  state.enemies.push(heretic)
  assert.equal(resolveChaosToken(state, inv, 'cultist', {}).delta, -3)
  assert.deepEqual(heretic.roundFightEvadeBonus, { round: 1, amount: 1 })
  assert.equal(behavior.enemyStatModifier(state, heretic, 'fight'), 1)
  assert.equal(behavior.enemyStatModifier(state, heretic, 'evade'), 1)
  assert.equal(behavior.enemyStatModifier(state, heretic, 'health'), 0)
  assert.equal(resolveChaosToken({ ...state, difficulty: 'expert' }, inv, 'cultist', {}).delta, -4)
})

test('混乱标记 tablet/elderthing：失败触发未了之事强制，攻击/躲避后结算闹鬼', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  inv.threat.push({ id: 't', code: '05178b' })
  state.scenarioFlags.unfinishedBusiness = [{
    storyCode: '05178b', enemyCode: '05178a', holderSeat: 0, locationId: inv.location, enemySnapshot: {},
  }]
  const api = apiFor(state, { choose: request => request.options.find(option => option.id === 'flip').id })
  const triggered = behavior.afterTest(state, inv, { success: false, drawn: ['tablet'], source: { label: '调查' } }, api)
  assert.equal(triggered, undefined)
  assert.equal(state.investigators[0].threat.length, 0, '未了之事被翻回敌人面')
  // elderthing：简单面失败 + 攻击 → 结算闹鬼。
  const hauntedApi = apiFor(state)
  state.difficulty = 'standard'
  assert.equal(chaosAfterTest(state, inv, { success: false, drawn: ['elderthing'], source: { label: '攻击' } }, hauntedApi), true)
  assert.equal(hauntedApi.calls.some(call => call.name === 'haunted'), true)
  const successApi = apiFor(state)
  assert.equal(chaosAfterTest(state, inv, { success: true, drawn: ['elderthing'], source: { label: '攻击' } }, successApi), false)
})

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
test('幕 2 的 [fast] 翻面：团队每轮每地点一次，方向受幕/议程限制', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const inv = state.investigators[0]
  state.actIndex = 1
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), true)
  behavior.performAction(state, inv, { rule: 'flipMyLocation' }, api)
  assert.deepEqual(state.scenarioFlags.flippedThisRound.ids, [inv.location])
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), false)
  // 幕 1 面：地点不能被翻到幽灵面 → 没有翻面行动。
  state.actIndex = 0
  state.scenarioFlags.flippedThisRound = { round: 0, ids: [] }
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), false)
})

test('幽灵迷网：团队花费线索，检定成功造成 +X 伤害', () => {
  const state = setup(stateFor())
  const api = apiFor(state, {
    choose: request => (request.kind === 'option' ? request.options[0].id : request.options[0].id),
    testResolve: 'success',
  })
  const inv = state.investigators[0]
  inv.assets.push({ id: 'web', code: '05177' })
  inv.clues = 2
  state.investigators[1].clues = 1
  state.enemies.push({
    id: 'geist', code: '05180', name: '恶毒邪灵', location: inv.location,
    traits: ['Monster', 'Geist', 'Spectral'], fight: 2,
  })
  const moves = behavior.actions(state, inv).filter(move => move.rule === 'spectralWebAttack')
  assert.equal(moves.length, 1)
  behavior.performAction(state, inv, moves[0], api)
  assert.equal(api.calls.some(call => call.name === 'damageEnemy'), true)
  // 花费 1 个线索（choose 返回第一项）。
  assert.equal(inv.clues + state.investigators[1].clues, 2)
})

test('绞刑者河撤退与幽灵面闹鬼锁定', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const moves = behavior.actions(state, inv)
  assert.equal(moves.some(move => move.rule === 'resignHangmansBrook'), true)
  const api = apiFor(state)
  behavior.performAction(state, inv, { rule: 'resignHangmansBrook' }, api)
  assert.deepEqual(api.calls.filter(call => call.name === 'resign'), [{ name: 'resign', args: [0] }])
  // 幽灵面闹鬼后本轮不能撤退。
  api.flipSpectral('hangmansBrook')
  behavior.locationFlipped(state, loc(state, 'hangmansBrook'), api)
  behavior.hauntedScript(state, { scriptId: 'lockResignThisRound', seat: 0 }, api)
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'resignHangmansBrook'), false)
})

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
test('结局记录：r1/r2 写异端者数量（number）与看守人存活记录，r3 写艾琳与血染树雕', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  state.actIndex = 1
  state.enemies.push({ id: 'h1', code: '05178a', hereticFace: '05178a', location: 'hauntedFields', traits: ['Spectral'] })
  const result = behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(result, { award: true, bonus: 0 })
  assert.equal(state.campaign.records.hereticsWereUnleashedUntoArkham, 1)
  // 从幕 1 结束：固定记 4 名。
  const state2 = setup(stateFor())
  behavior.resolution(state2, 'r1', [], apiFor(state2))
  assert.equal(state2.campaign.records.hereticsWereUnleashedUntoArkham, 4)
  const state3 = setup(stateFor())
  behavior.resolution(state3, 'r2', [], apiFor(state3))
  assert.equal(state3.campaign.records.theInvestigatorsSurvivedTheWatchersEmbrace, true)
  const state4 = setup(stateFor())
  behavior.resolution(state4, 'r3', [], apiFor(state4))
  assert.equal(state4.campaign.records.erynnJoinedTheInvestigators, true)
  assert.equal(state4.campaign.records.hereticsWereUnleashedUntoArkham, 1)
  assert.ok(state4.campaign.records.mementosDiscovered.includes('bloodyTreeCarvings'))
  assert.throws(() => behavior.resolution(state, 'r9', [], stubApi()), /未知恶罪报应结局/)
})

test('无结局映射：有撤退者 → r1，全员被击败 → r2', () => {
  const resigned = setup(stateFor())
  resigned.investigators[0].resigned = true
  assert.equal(behavior.storyResolutionKey(resigned, 'noResolution'), 'r1')
  const defeated = setup(stateFor())
  for (const inv of defeated.investigators) inv.defeated = true
  assert.equal(behavior.storyResolutionKey(defeated, 'noResolution'), 'r2')
  behavior.resolution(defeated, 'noResolution', [], apiFor(defeated))
  assert.equal(defeated.campaign.records.theInvestigatorsSurvivedTheWatchersEmbrace, true)
})

// ---------------------------------------------------------------------------
// 存档往返与确定性
// ---------------------------------------------------------------------------
test('同一路线确定性：同种子布置 + 议程 1b + 幕 1b 后 JSON 完全一致', () => {
  const build = () => {
    const state = setup(stateFor(), 23)
    const api = apiFor(state)
    behavior.agendaReveal(state, state.agendas[0], api)
    behavior.actReveal(state, state.acts[0], api)
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('存档往返：scenarios/theWagesOfSin/ 的幽灵牌库/异端者/未了之事状态随 JSON 往返', () => {
  const state = setup(stateFor(), 3)
  const api = apiFor(state)
  state.enemies.push({
    id: 'heretic', code: '05178g', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Spectral', 'Elite'], health: 6, damageTaken: 6, engagedSeat: 0, exhausted: false,
  })
  behavior.enemySpawned(state, state.enemies[0], api)
  behavior.agendaReveal(state, state.agendas[0], api)
  state.encounterDeck = [...STANDARD_DECK_CODES.slice(0, 5)]
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.extraEncounterDecks, state.extraEncounterDecks)
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.deepEqual(restored.locations.map(location => [location.id, location.originalCode, location.spectralFace]),
    state.locations.map(location => [location.id, location.originalCode, location.spectralFace]))
  // 往返后继续结算一次轮末（状态键都是纯 JSON）。
  behavior.roundEnded(restored, apiFor(restored, { choose: request => request.options[0].id }))
  assert.deepEqual(JSON.parse(JSON.stringify(restored)).scenarioFlags, restored.scenarioFlags)
})

test('已实现遭遇卡号都在本章定义或两个遭遇牌库内', () => {
  const all = new Set([
    ...Object.keys(definition.enemies), ...Object.keys(definition.treacheries),
    ...STANDARD_DECK_CODES, ...SPECTRAL_DECK_CODES,
  ])
  for (const code of behavior.implementedEncounterCodes) {
    assert.ok(all.has(code), `${code} 应在本章定义/牌库内`)
    assert.ok(ALL_CARDS[code], `${code} 应在卡表内`)
  }
})

// ---------------------------------------------------------------------------
// 本章 5 张诡计的 resolveEncounter 分派
// ---------------------------------------------------------------------------
test('05181 惩罚：显现入威胁区；任意敌人被击败后威胁区持有者受 1 伤害', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const inv = state.investigators[0]
  const result = behavior.resolveEncounter(state, inv, { code: '05181', originalCode: '05181' }, api)
  assert.deepEqual(result, { placed: true })
  assert.ok(api.calls.some(call => call.name === 'threat' && call.args[1] === '05181'))
  inv.clues = 0
  // 另一个调查员威胁区里也有惩罚：敌人被击败时两人各受 1 点伤害。
  behavior.resolveEncounter(state, state.investigators[1], { code: '05181', originalCode: '05181' }, api)
  behavior.enemyDefeated(state, { id: 'e', code: '05090', location: inv.location, traits: ['Witch'] }, api)
  const damages = api.calls.filter(call => call.name === 'damage')
  assert.equal(damages.length, 2)
})

test('05182 往昔重担：威胁区无未了之事时涌动；有则逐张触发强制', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { choose: request => request.options[0].id })
  const inv = state.investigators[0]
  assert.equal(behavior.encounterGainsSurge(state, '05182'), true)
  behavior.resolveEncounter(state, inv, { code: '05182', originalCode: '05182' }, api)
  assert.equal(behavior.encounterGainsSurge(state, '05182'), true)
  inv.threat.push({ id: 't', code: '05178b' })
  assert.equal(behavior.encounterGainsSurge(state, '05182'), false)
})

test('05183 凶兆：选择抽幽灵牌库顶时走 drawExtra(spectral)', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { choose: request => request.options.find(option => option.id === 'draw').id })
  behavior.resolveEncounter(state, state.investigators[0], { code: '05183', originalCode: '05183' }, api)
  assert.ok(api.calls.some(call => call.name === 'drawExtra' && call.args[1] === 'spectral'))
})

test('05184 长明灯：从基础牌库抽出 → 洗入幽灵牌库并获得涌动；从幽灵牌库抽出 → 2 伤害并放回基础弃牌堆', () => {
  // 基础牌库分支：encounterDeckFor 记录来源，encounterGainsSurge 把卡移入幽灵牌库。
  const standardState = setup(stateFor(), 4)
  const inv = standardState.investigators[0]
  const standardApi = apiFor(standardState)
  assert.equal(behavior.encounterDeckFor(standardState, inv), null)
  standardState.encounterDiscard.push('05184')
  behavior.resolveEncounter(standardState, inv, { code: '05184', originalCode: '05184' }, standardApi)
  assert.equal(behavior.encounterGainsSurge(standardState, '05184'), true)
  assert.equal(standardState.extraEncounterDecks.spectral.deck.includes('05184'), true)
  // 幽灵牌库分支：2 伤害 + 回基础弃牌堆。
  const spectralState = setup(stateFor(), 4)
  const spectralInv = spectralState.investigators[0]
  loc(spectralState, 'hangmansBrook').spectral = true
  loc(spectralState, 'hangmansBrook').spectralFace = 'spectral'
  const spectralApi = apiFor(spectralState)
  assert.equal(behavior.encounterDeckFor(spectralState, spectralInv), 'spectral')
  spectralState.extraEncounterDecks.spectral.discard.push('05184')
  behavior.resolveEncounter(spectralState, spectralInv, { code: '05184', originalCode: '05184' }, spectralApi)
  assert.ok(spectralApi.calls.some(call => call.name === 'damage' && call.args[1] === 2))
  assert.equal(behavior.encounterGainsSurge(spectralState, '05184'), false)
  assert.equal(spectralState.encounterDiscard.includes('05184'), true)
  assert.equal(spectralState.extraEncounterDecks.spectral.discard.includes('05184'), false)
})

test('05185 祸害生者：从幽灵牌库顶弃到灵怪敌人并生成交战', () => {
  const state = setup(stateFor())
  const api = apiFor(state, { choose: request => request.options.find(option => option.id === 'geist').id })
  const inv = state.investigators[0]
  const piles = state.extraEncounterDecks.spectral
  piles.deck = ['05180', '05183'] // 牌库顶是数组末尾：先抽到 05183，再抽到灵怪敌人 05180
  behavior.resolveEncounter(state, inv, { code: '05185', originalCode: '05185' }, api)
  const spawn = api.calls.find(call => call.name === 'spawnEngaged')
  assert.deepEqual(spawn.args, ['05180', inv.location, 0])
  assert.ok(piles.discard.includes('05183'))
})

test('05185 祸害生者：把未了之事翻回异端者面并放置一半生命的伤害', () => {
  const state = setup(stateFor())
  loc(state, 'hauntedFields').spectral = true
  loc(state, 'hauntedFields').spectralFace = 'spectral'
  const inv = state.investigators[0]
  inv.location = 'hauntedFields'
  const api = apiFor(state, { choose: request => request.options.find(option => option.id === 'flip')?.id || 'flip' })
  const enemy = {
    id: 'heretic', code: '05178a', name: '异端者', location: 'hauntedFields',
    traits: ['Monster', 'Spectral', 'Elite'], health: 6, damageTaken: 0, engagedSeat: 0, exhausted: false,
  }
  state.enemies.push(enemy)
  state.investigators[0].engaged.push(enemy.id)
  behavior.enemySpawned(state, enemy, api)
  state.enemies.splice(state.enemies.indexOf(enemy), 1)
  behavior.enemyDefeated(state, enemy, api)
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 1)
  const flipApi = apiFor(state, { choose: () => 'flip' })
  behavior.resolveEncounter(state, inv, { code: '05185', originalCode: '05185' }, flipApi)
  const restored = state.enemies.find(candidate => candidate.hereticFace === '05178a')
  assert.ok(restored, '未了之事翻回异端者面')
  assert.equal(restored.damageTaken, 3, '放置一半生命的伤害（6/2）')
})
