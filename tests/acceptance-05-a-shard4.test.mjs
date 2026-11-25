// 验收 05-a 万象无终 · 分片 4（wos《恶罪报应》05151–05185）逐卡标题级证据补齐。
//
// 背景：`tests/tcu-wages-of-sin.test.mjs` / `tests/tcu-p0-regressions.test.mjs` 已覆盖本章行为，
// 但以下卡片的测试标题不含卡号（ACCEPTANCE-ORDER §3 维度 4 要求「标题含卡号的真实执行用例」）：
//   05161、05162、05163、05164、05165（场景/密谋/幕）、
//   05167、05167b、05168、05168b、05172、05172b、05173、05173b、05174、05174b、05175b（地点正/幽灵面）、
//   05179、05178a/c/d/e/f/g/h/i/k/l（敌人面/未了之事面）。
// 本文件用与既有章节测试相同的「生产代码行为钩子 + 确定性 api」方式补真实断言：调用
// content/campaigns/theCircleUndone/scenarios/theWagesOfSin/behavior.js 的钩子与单卡条目，
// 断言可观察状态（翻面/生成/线索/威胁区/伤害/资源/胜利区/牌库去向），不写「条目存在」式空断言。
//
// 只读验收：本文件不修改 src/**、content/**、audit/**。
import test from 'node:test'
import assert from 'node:assert/strict'

// 加载引擎装配点：单卡条目的 flags 通过 entryFlags 读点生效（与线上路径一致）。
import '../src/engine/engine.js'
import * as wages from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/index.js'
import {
  HERETIC_FACES, LOCATION_ID_BY_FRONT_CODE, SPECTRAL_WATCHER, UNFINISHED_BUSINESS_RULES,
  scenario as definition,
} from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/definition.js'
import { resolveChaosToken } from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/chaos.js'
import {
  canFlipHere, locationGroupOf, unfinishedBusinessForced,
} from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/behavior.js'

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
    turnSerial: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

// 引擎 placeLocation 的等价物：地点入场（本章全部已揭示，线索按印刷值）。
function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    assert.ok(base, `缺少地点定义 ${id}`)
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
  placeLocations(state, ids)
  behavior.afterChaosBagSetup(state, [])
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

// 确保某个变体地点实例在场（setup 每组只随机放 1 张；验收需要指定卡号时手动补一张）。
function ensureLocation(state, id) {
  const existing = loc(state, id)
  if (existing) return existing
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const instance = {
    ...clone(base), id, revealed: true, doom: 0,
    clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    maxClues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
  }
  state.locations.push(instance)
  return instance
}

// 确保指定变体面在场：同组另一张变体若已入场则替换掉（两张同名地点只在 setup 二选一）。
function forceLocation(state, group, frontCode) {
  const id = LOCATION_ID_BY_FRONT_CODE[frontCode]
  const existing = loc(state, id)
  if (existing) return existing
  const index = state.locations.findIndex(location => locationGroupOf(state, location.id) === group)
  if (index >= 0) state.locations.splice(index, 1)
  return ensureLocation(state, id)
}

// 记录型 api：与既有章节测试同一形状（flipSpectral/flipEnemy 用与引擎一致的简化语义）。
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
    spawn: (code, location, seat) => {
      calls.push({ name: 'spawn', args: [code, location, seat] })
      return { id: `spawn:${code}`, code, location }
    },
    engage: (enemy, seat) => calls.push({ name: 'engage', args: [enemy?.id || enemy, seat] }),
    spawnEngaged: (code, location, seat) => { calls.push({ name: 'spawnEngaged', args: [code, location, seat] }); return null },
    spawnStoryEnemy: (code, location, stats, extra) => {
      const enemy = { id: `spawn:${code}`, code, location }
      calls.push({ name: 'spawnStoryEnemy', args: [code, location, stats, extra], enemy })
      return enemy
    },
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
    flipSpectral: id => { calls.push({ name: 'flipSpectral', args: [id] }); return true },
    flipEnemy: (enemy, code) => { calls.push({ name: 'flipEnemy', args: [enemy?.code, code] }); return null },
    test: (seat, skill, difficulty, resolve, bonus, source) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty, bonus, source] })
      if (overrides.testResolve) resolve({ success: overrides.testResolve === 'success', value: 6, difficulty, drawn: [] })
    },
  }
  for (const [name, fn] of Object.entries(overrides)) {
    if (typeof fn === 'function') api[name] = fn
  }
  return api
}

// 让 stubApi 的 flipSpectral / flipEnemy / threat 用与引擎一致的简化语义（需要 state）。
function apiFor(state, overrides = {}) {
  const api = stubApi(overrides)
  api.threat = (seat, code) => {
    api.calls.push({ name: 'threat', args: [seat, code] })
    state.investigators[seat].threat.push({ id: `threat:${code}:${api.calls.length}`, code })
  }
  api.payClues = (amount, locationId) => {
    api.calls.push({ name: 'payClues', args: [amount, locationId] })
    let remaining = amount
    for (const payer of state.investigators) {
      if (remaining <= 0) break
      if (payer.defeated || payer.resigned || payer.location !== locationId) continue
      const paid = Math.min(remaining, payer.clues || 0)
      payer.clues -= paid
      remaining -= paid
    }
    return amount - remaining
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

// 建立一个「在幽灵地点」的异端者实例并跑入场钩子。
function hereticInPlay(enemyCode, { locationId = 'hauntedFields' } = {}) {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const location = ensureLocation(state, locationId)
  location.spectral = true
  location.spectralFace = 'spectral'
  inv.location = location.id
  const enemy = {
    id: 'heretic-1', code: enemyCode, originalCode: enemyCode, name: '异端者',
    location: location.id, health: 6, damageTaken: 0, engagedSeat: inv.seat, exhausted: false,
  }
  state.enemies.push(enemy)
  inv.engaged.push(enemy.id)
  const api = apiFor(state)
  behavior.enemySpawned(state, enemy, api)
  return { state, inv, enemy, api, location }
}

// ---------------------------------------------------------------------------
// 场景参考卡 05161 + 密谋/幕 05162–05165
// ---------------------------------------------------------------------------

test('05161 恶罪报应：skull=X（胜利区未了之事+1）、cultist 本轮异端者+1、tablet 触发未了之事、elderthing 攻击失败结算闹鬼', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const inv = state.investigators[0]
  state.victoryDisplay.push({ code: '05178b' }, { code: '05178d' })
  const skull = resolveChaosToken(state, inv, 'skull', api)
  assert.equal(skull.delta, -3, '简单/普通：未了之事 2 张 → X = 2 + 1')
  state.difficulty = 'hard'
  const hardSkull = resolveChaosToken(state, inv, 'skull', api)
  assert.equal(hardSkull.delta, -2, '困难面 X = 未了之事张数')
  assert.equal(hardSkull.drawAnother, true, '困难面 skull 再揭示一个标记')
  state.difficulty = 'standard'
  resolveChaosToken(state, inv, 'cultist', api)
  assert.equal(state.scenarioFlags.wosCultistBuffRound, state.round, 'cultist 记录本轮异端者 +1 标记')
  // tablet：失败时触发威胁区未了之事的强制能力（如同轮末）。
  inv.threat.push({ id: 'ub', code: '05178b' })
  const tabletApi = apiFor(state)
  behavior.afterTest(state, inv, {
    success: false, drawn: ['tablet'], cancelledTokens: [], source: { label: '攻击' },
  }, tabletApi)
  assert.ok(tabletApi.calls.some(call => call.name === 'horror'),
    'tablet 失败触发未了之事的强制（受到 1 点恐惧）')
  // elderthing：攻击/躲避检定失败 → 结算所在地点每个闹鬼能力。
  const elderApi = apiFor(state)
  behavior.afterTest(state, inv, {
    success: false, drawn: ['elderthing'], cancelledTokens: [], source: { label: '攻击' },
  }, elderApi)
  assert.ok(elderApi.calls.some(call => call.name === 'haunted'),
    'elderthing 攻击失败结算所在地点的闹鬼能力')
})

test('05162 倒吊人·XII 背面：所有地点翻到幽灵面、看守人生成于绞刑者河、看守人组与幽灵弃牌堆洗回幽灵牌库', () => {
  const state = setup(stateFor())
  state.actIndex = 1 // 幕 2：05164 正面限制不再阻止翻面
  const api = apiFor(state)
  state.extraEncounterDecks.spectral.discard.push('05103')
  behavior.agendaReveal(state, state.agendas[0], api)
  const flipped = api.calls.filter(call => call.name === 'flipSpectral').map(call => call.args[0])
  assert.equal(flipped.length, state.locations.length, '每个地点翻到幽灵面')
  const spawn = api.calls.find(call => call.name === 'spawn')
  assert.ok(spawn, '幽灵看守人入场')
  assert.deepEqual(spawn.args.slice(0, 2), [SPECTRAL_WATCHER, 'hangmansBrook'])
  const piles = state.extraEncounterDecks.spectral
  assert.equal(piles.deck.filter(code => code === '05087').length, 2, '看守人组剩余 2 张洗入幽灵牌库')
  assert.equal(piles.discard.length, 0, '幽灵弃牌堆已一同洗回')
  assert.ok(piles.deck.includes('05103'), '原幽灵弃牌堆的卡进入幽灵牌库')
})

test('05163 死亡来临：幽灵面地点不能再翻回非幽灵面（非幽灵地点仍可翻面）', () => {
  const state = setup(stateFor())
  state.actIndex = 1
  state.agendaIndex = 1 // 密谋 2 在场
  const inv = state.investigators[0]
  const spectral = ensureLocation(state, 'hangmansBrook')
  spectral.spectral = true
  spectral.spectralFace = 'spectral'
  inv.location = spectral.id
  assert.equal(canFlipHere(state, spectral), false, '幽灵面不能被翻到非幽灵面')
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), false)
  const normal = ensureLocation(state, 'hauntedFields')
  normal.spectral = false
  normal.spectralFace = 'normal'
  inv.location = normal.id
  assert.equal(canFlipHere(state, normal), true, '非幽灵面翻到幽灵面不受 05163 限制')
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), true)
})

test('05164 追寻死者：幕 1 期间地点不能翻到幽灵面（议程翻面被阻止）；背面 4 处生成异端者、加线索、3+遗物发幽灵迷网', () => {
  // 正面：幕 1 期间不能翻到幽灵面（含 05162 议程背面的「所有地点翻面」）。
  const state = setup(stateFor())
  const normal = ensureLocation(state, 'hauntedFields')
  normal.spectral = false
  normal.spectralFace = 'normal'
  state.investigators[0].location = normal.id
  assert.equal(canFlipHere(state, normal), false, '幕 1 不能翻到幽灵面')
  const flipApi = apiFor(state)
  behavior.agendaReveal(state, state.agendas[0], flipApi)
  assert.equal(flipApi.calls.some(call => call.name === 'flipSpectral'), false,
    '05162 背面在幕 1 期间不翻面')
  // 背面：4 处生成异端者、加线索、3+ 遗物时每人获得放一边的幽灵迷网。
  const back = setup(stateFor())
  back.campaign.records.mementosDiscovered = ['cornHuskDoll', 'bloodyTreeCarvings', 'wispOfSpectralMist']
  const api = apiFor(back)
  const before = new Map(back.locations.map(location => [location.id, {
    clues: location.clues, maxClues: location.maxClues,
  }]))
  behavior.actReveal(back, back.acts[0], api)
  const spawns = api.calls.filter(call => call.name === 'spawn')
  assert.equal(spawns.length, 4, '4 处地点各生成 1 个放一边的异端者')
  const spawnGroups = new Set(spawns.map(call => locationGroupOf(back, call.args[1])))
  assert.deepEqual([...spawnGroups].sort(),
    ['chapelAttic', 'chapelCrypt', 'hereticsGraves', 'theGallows'].sort(),
    '异端者生成在绞刑架/墓地/阁楼/地下室')
  const hereticLocationIds = new Set(spawns.map(call => call.args[1]))
  for (const [id, previous] of before) {
    const location = loc(back, id)
    const expected = (hereticLocationIds.has(id) ? 2 : 1) * back.numInvestigators
    assert.equal((location.clues || 0) - previous.clues, expected,
      `「${location.name}」应增加 ${expected} 个线索`)
    assert.equal((location.maxClues || 0) - previous.maxClues, expected)
  }
  const webs = api.calls.filter(call => call.name === 'giveAsset')
  assert.equal(webs.length, back.investigators.length, '每位调查员各获得 1 张幽灵迷网')
  assert.ok(webs.every(call => call.args[1] === '05177'))
  assert.equal(back.scenarioFlags.hereticsSpawned, true)
})

test('05165 追寻生者：[fast] 翻面每轮每地点一次、非幽灵地点不能发现线索、4 张未了之事推进幕', () => {
  const state = setup(stateFor())
  state.actIndex = 1
  const inv = state.investigators[0]
  const location = ensureLocation(state, 'hauntedFields')
  location.spectral = false
  location.spectralFace = 'normal'
  inv.location = location.id
  assert.equal(behavior.canDiscoverClues(state, inv, location), false, '幕 2 非幽灵地点不能发现线索')
  const flip = behavior.actions(state, inv).find(move => move.rule === 'flipMyLocation')
  assert.ok(flip, '幕 2 正面提供 [fast] 翻面行动')
  assert.equal(flip.actions, 0, '[fast] 不消耗行动')
  const api = apiFor(state)
  behavior.performAction(state, inv, flip, api)
  assert.ok(api.calls.some(call => call.name === 'flipSpectral'), '翻面结算')
  assert.deepEqual(state.scenarioFlags.flippedThisRound.ids, [location.id], '本轮该地点已翻面')
  assert.equal(behavior.actions(state, inv).some(move => move.rule === 'flipMyLocation'), false,
    '团队每轮每地点仅限一次')
  // 目标：胜利区 4 张未了之事 → 推进幕 2。
  state.victoryDisplay = [{ code: '05178b' }, { code: '05178d' }, { code: '05178f' }, { code: '05178h' }]
  const objectiveApi = apiFor(state)
  behavior.checkObjectives(state, objectiveApi)
  assert.ok(objectiveApi.calls.some(call => call.name === 'advanceAct'), '4 张未了之事进胜利区后推进幕')
})

// ---------------------------------------------------------------------------
// 地点正面 05167/05168/05172/05173/05174
// ---------------------------------------------------------------------------

test('05167 闹鬼农田：位于此地的幽灵敌人 +1 恐惧值', () => {
  const state = setup(stateFor())
  const field = ensureLocation(state, 'hauntedFields')
  const spectral = { id: 'spectral-1', code: 'xspectral', traits: ['Spectral'], location: field.id }
  assert.deepEqual(behavior.enemyAttackModifier(state, spectral), { horror: 1 })
  const mundane = { id: 'mundane-1', code: 'xmundane', traits: ['Monster'], location: field.id }
  assert.deepEqual(behavior.enemyAttackModifier(state, mundane), {})
  const elsewhere = { id: 'spectral-2', code: 'xspectral2', traits: ['Spectral'], location: 'hangmansBrook' }
  assert.deepEqual(behavior.enemyAttackModifier(state, elsewhere), {}, '不在闹鬼农田的幽灵敌人无加成')
})

test('05168 废弃教堂：神话阶段位于此地的调查员每项技能 -1', () => {
  const state = setup(stateFor())
  const chapel = ensureLocation(state, 'abandonedChapel')
  const inv = state.investigators[0]
  inv.location = chapel.id
  state.phase = 'mythos'
  for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
    assert.equal(behavior.statModifier(state, inv, skill), -1, `神话阶段 ${skill} -1`)
  }
  state.phase = 'investigation'
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 0, '非神话阶段没有该惩罚')
})

test('05172 异端者的墓地（172）：此地的女巫敌人被击败后弃基础遭遇牌库顶 2 张', () => {
  const state = setup(stateFor())
  const graves = forceLocation(state, 'hereticsGraves', '05172')
  assert.equal(graves.defeatRule, 'discardStandardTwoOnWitchDefeat')
  state.encounterDeck = ['01020', '01021', '01022']
  state.encounterDiscard = []
  const witch = { id: 'witch-1', code: 'xwitch', traits: ['Witch'], location: graves.id }
  const api = apiFor(state)
  behavior.enemyDefeated(state, witch, api)
  assert.equal(state.encounterDeck.length, 1, '弃掉基础遭遇牌库顶 2 张')
  assert.deepEqual(state.encounterDiscard, ['01022', '01021'])
})

test('05173 教堂地下室（173）：没有重整状态的敌人时隐藏值 -3', () => {
  const state = setup(stateFor())
  const crypt = forceLocation(state, 'chapelCrypt', '05173')
  assert.equal(behavior.locationShroudModifier(state, crypt), -3, '没有敌人时 -3')
  const exhausted = { id: 'e1', code: 'xenemy', location: crypt.id, exhausted: true }
  state.enemies.push(exhausted)
  assert.equal(behavior.locationShroudModifier(state, crypt), -3, '只有横置敌人时仍 -3')
  exhausted.exhausted = false
  assert.equal(behavior.locationShroudModifier(state, crypt), 0, '有重整敌人时不再 -3')
})

test('05174 教堂地下室（174）：调查员威胁区没有巫术诡计时隐藏值 -3', () => {
  const state = setup(stateFor())
  const crypt = forceLocation(state, 'chapelCrypt', '05174')
  const inv = state.investigators[0]
  inv.location = crypt.id
  assert.equal(behavior.locationShroudModifier(state, crypt), -3, '没有巫术诡计时 -3')
  inv.threat.push({ id: 'hex-1', code: '05181' })
  assert.equal(behavior.locationShroudModifier(state, crypt), 0, '威胁区有巫术诡计时不减')
})

// ---------------------------------------------------------------------------
// 地点幽灵面 05167b/05168b/05172b/05173b/05174b/05175b
// ---------------------------------------------------------------------------

test('05167b 闹鬼农田幽灵面：闹鬼把最近的幽灵敌人向闹鬼农田移动一次', () => {
  const state = setup(stateFor())
  const field = ensureLocation(state, 'hauntedFields')
  const inv = state.investigators[0]
  inv.location = field.id
  const enemy = { id: 'spectral-1', code: 'xspectral', traits: ['Spectral'], location: 'hangmansBrook' }
  state.enemies.push(enemy)
  const api = apiFor(state, {
    stepToward: (from, to) => (to === field.id ? field.id : null),
  })
  assert.equal(behavior.hauntedScript(state, { scriptId: 'moveNearestSpectralToHere', seat: inv.seat }, api), true)
  const move = api.calls.find(call => call.name === 'moveEnemy')
  assert.ok(move, '最近的幽灵敌人向闹鬼农田移动')
  assert.deepEqual(move.args, [enemy, field.id])
})

test('05168b 废弃教堂幽灵面：本轮每项技能 -1，轮末清理', () => {
  const state = setup(stateFor())
  const chapel = ensureLocation(state, 'abandonedChapel')
  const inv = state.investigators[0]
  inv.location = chapel.id
  const api = apiFor(state)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'roundSkillPenalty', seat: inv.seat }, api), true)
  assert.equal(inv.wosRoundSkillPenalty, state.round)
  assert.equal(behavior.statModifier(state, inv, 'combat'), -1)
  behavior.roundEnded(state, apiFor(state))
  assert.equal(behavior.statModifier(state, inv, 'combat'), 0, '轮末清理本轮技能惩罚')
})

test('05172b 异端者的墓地（172）幽灵面：闹鬼治愈场上每个异端者与女巫 1 点伤害', () => {
  const state = setup(stateFor())
  const graves = forceLocation(state, 'hereticsGraves', '05172')
  const inv = state.investigators[0]
  inv.location = graves.id
  const witch = { id: 'witch-1', code: 'xwitch', traits: ['Witch'], location: graves.id, damageTaken: 2 }
  const heretic = { id: 'heretic-1', code: '05178a', originalCode: '05178a', location: graves.id, damageTaken: 3 }
  state.enemies.push(witch, heretic)
  behavior.enemySpawned(state, heretic, apiFor(state))
  const api = apiFor(state)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'healHereticsAndWitches', seat: inv.seat }, api), true)
  assert.equal(witch.damageTaken, 1, '女巫治愈 1 点')
  assert.equal(heretic.damageTaken, 2, '异端者治愈 1 点')
})

test('05173b 教堂地下室（173）幽灵面：牌库顶生成苏生亡者并与你交战，该牌移出游戏', () => {
  const state = setup(stateFor())
  const crypt = forceLocation(state, 'chapelCrypt', '05173')
  const inv = state.investigators[0]
  inv.location = crypt.id
  inv.deck = ['01020', '01021']
  const api = apiFor(state)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'spawnReanimatedDead', seat: inv.seat }, api), true)
  assert.deepEqual(state.removedFromGame, ['01021'], '牌库顶的卡移出游戏')
  const spawn = api.calls.find(call => call.name === 'spawnStoryEnemy')
  assert.ok(spawn, '生成苏生亡者')
  assert.equal(spawn.args[1], crypt.id)
  assert.equal(spawn.args[2].health, 1)
  assert.equal(spawn.args[2].fight, 1)
  assert.equal(spawn.args[2].evade, 1)
  assert.equal(spawn.args[2].damage, 1)
  assert.deepEqual(spawn.args[2].traits, ['Monster'])
  assert.ok(api.calls.some(call => call.name === 'engage' && call.args[1] === inv.seat), '与你交战')
})

test('05174b 教堂地下室（174）幽灵面：把基础遭遇弃牌堆最顶的巫术诡计放进你的威胁区', () => {
  const state = setup(stateFor())
  const crypt = forceLocation(state, 'chapelCrypt', '05174')
  const inv = state.investigators[0]
  inv.location = crypt.id
  state.encounterDiscard = ['05103', '05181', '05184']
  const api = apiFor(state)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'hexFromDiscardToThreat', seat: inv.seat }, api), true)
  assert.deepEqual(inv.threat.map(card => card.code), ['05181'], '最顶的巫术诡计进入威胁区')
  assert.deepEqual(state.encounterDiscard, ['05103', '05184'])
})

test('05175b 教堂阁楼（175）幽灵面：闹鬼随机弃掉阁楼底下一张卡牌', () => {
  const state = setup(stateFor())
  const attic = forceLocation(state, 'chapelAttic', '05175')
  const inv = state.investigators[0]
  inv.location = attic.id
  attic.beneath = [
    { code: '01020', ownerSeat: inv.seat },
    { code: '01021', ownerSeat: inv.seat },
  ]
  const api = apiFor(state, { random: () => 0 })
  assert.equal(behavior.hauntedScript(state, { scriptId: 'discardBeneathAttic', seat: inv.seat }, api), true)
  assert.equal(attic.beneath.length, 1, '底下一张卡被弃掉')
  assert.deepEqual(inv.discard, ['01020'], '被弃的卡进其所有者弃牌堆')
})

// ---------------------------------------------------------------------------
// 敌人 05179 + 异端者 05178a/c/e/g/i/k
// ---------------------------------------------------------------------------

test('05179 复仇女巫：生成于绞刑架/异端者墓地；被击败时同地点每位调查员受到其伤害与恐惧（直接）', () => {
  const state = setup(stateFor())
  const api = apiFor(state)
  const spawnLocationId = behavior.spawnLocation(state, '05179', null, null, api)
  const spawnGroup = locationGroupOf(state, spawnLocationId)
  assert.ok(['theGallows', 'hereticsGraves'].includes(spawnGroup), '生成于绞刑架或异端者墓地')
  const enemy = { id: 'witch-1', code: '05179', originalCode: '05179', location: spawnLocationId, damage: 1, horror: 1 }
  state.enemies.push(enemy)
  for (const inv of state.investigators) inv.location = spawnLocationId
  const defeatApi = apiFor(state)
  behavior.enemyDefeated(state, enemy, defeatApi)
  const damages = defeatApi.calls.filter(call => call.name === 'directDamage')
  const horrors = defeatApi.calls.filter(call => call.name === 'directHorror')
  assert.equal(damages.length, state.investigators.length, '同地点每位调查员受到直接伤害')
  assert.equal(horrors.length, state.investigators.length, '同地点每位调查员受到直接恐惧')
  assert.ok(damages.every(call => call.args[1] === 1))
  assert.ok(horrors.every(call => call.args[1] === 1))
})

const HERETIC_STORY = Object.fromEntries(HERETIC_FACES.map(face => [face.enemy, face.story]))

// 异端者 A/C/E/G（叙事面）共用断言：+2×人数生命、非幽灵地点冷漠/不可交战/不可伤害、被击败翻到未了之事面。
function assertHereticFace(enemyCode, storyCode) {
  // 定义层：+2[per_investigator] 生命与双面 faces 数据。
  const defState = setup(stateFor())
  assert.equal(defState.scenario.enemies[enemyCode].healthPerPlayerBonus, 2, '+2[per_investigator] 生命')
  assert.deepEqual(defState.scenario.enemies[enemyCode].faces,
    [{ code: enemyCode, side: 'enemy' }, { code: storyCode, side: 'unfinishedBusiness' }])
  const { state, inv, enemy, api } = hereticInPlay(enemyCode)
  const spectralLocation = loc(state, enemy.location)
  assert.equal(enemy.enemyRole, 'heretic')
  assert.equal(enemy.aloof, false, '幽灵地点不受冷漠限制')
  assert.equal(behavior.canEngageEnemy(state, inv, enemy), true, '幽灵地点可以交战')
  assert.equal(behavior.enemyDamageAllowed(state, enemy), true, '幽灵地点可以受伤')
  // 非幽灵地点：冷漠、不能交战、不能受伤。
  const mundane = ensureLocation(state, 'abandonedChapel')
  mundane.spectral = false
  mundane.spectralFace = 'normal'
  enemy.location = mundane.id
  inv.location = mundane.id
  behavior.enemyMoved(state, enemy, spectralLocation.id, api)
  assert.equal(enemy.aloof, true, '非幽灵地点获得冷漠')
  assert.equal(behavior.canEngageEnemy(state, inv, enemy), false, '非幽灵地点不能被交战')
  assert.equal(behavior.canFightEnemy(state, inv, enemy), false)
  assert.equal(behavior.enemyDamageAllowed(state, enemy), false, '非幽灵地点不能受到伤害')
  // 回到幽灵地点后被击败 → 翻到未了之事面并进入威胁区。
  enemy.location = spectralLocation.id
  inv.location = spectralLocation.id
  behavior.enemyMoved(state, enemy, mundane.id, api)
  const defeatApi = apiFor(state)
  behavior.enemyDefeated(state, enemy, defeatApi)
  assert.deepEqual(inv.threat.map(card => card.code), [storyCode], '未了之事进入击败者/交战者威胁区')
  assert.equal(state.scenarioFlags.unfinishedBusiness.length, 1)
  assert.equal(state.scenarioFlags.unfinishedBusiness[0].storyCode, storyCode)
  assert.equal(state.enemies.includes(enemy), false, '敌人面离开战场')
}

test('05178a 异端者（A 面）：+2×人数生命、非幽灵地点冷漠且不可交战/不可伤害、被击败翻到未了之事 05178b', () => {
  assertHereticFace('05178a', '05178b')
})

test('05178c 异端者（C 面）：+2×人数生命、非幽灵地点冷漠且不可交战/不可伤害、被击败翻到未了之事 05178d', () => {
  assertHereticFace('05178c', '05178d')
})

test('05178e 异端者（E 面）：+2×人数生命、非幽灵地点冷漠且不可交战/不可伤害、被击败翻到未了之事 05178f', () => {
  assertHereticFace('05178e', '05178f')
})

test('05178g 异端者（G 面）：+2×人数生命、非幽灵地点冷漠且不可交战/不可伤害、被击败翻到未了之事 05178h', () => {
  assertHereticFace('05178g', '05178h')
})

test('05178i 异端者（I 面）：被击败后立即翻回敌人面并攻击，本场不能以任何方式被击败、谈判需 1+人数线索', () => {
  const { state, inv, enemy } = hereticInPlay('05178i')
  const api = apiFor(state)
  behavior.enemyDefeated(state, enemy, api)
  const restored = state.enemies.find(candidate => candidate.hereticFace === '05178i')
  assert.ok(restored, 'J 面立即翻回敌人面')
  assert.equal(restored.cannotBeDefeated, true, '本场冒险剩余时间不能被任何方式击败')
  assert.equal(restored.hereticJResolved, true)
  assert.equal(restored.hereticParleyCost, 1 + state.numInvestigators, '谈判费用 = 1 + 人数')
  assert.ok(api.calls.some(call => call.name === 'attack'), '翻回后立即攻击')
  assert.equal(behavior.enemyCanBeDefeated(state, restored), false)
  // 下次谈判查看本面 → 改为驱除，而不是再次翻回。
  inv.clues = 5
  const parley = behavior.actions(state, inv).find(move => move.rule === 'hereticParley' && move.enemyId === restored.id)
  assert.ok(parley, 'J 面谈判在幽灵地点且线索足够时可用')
  behavior.performAction(state, inv, parley, apiFor(state))
  assert.ok(state.victoryDisplay.some(card => card.code === '05178j'), '第二次结算本面时被驱除进胜利区')
  assert.equal(inv.clues, 5 - (1 + state.numInvestigators))
})

test('05178k 异端者（K 面）：被击败后翻回敌人面并攻击，注册「下次击败即驱除」；第二次击败进胜利区', () => {
  const { state, enemy } = hereticInPlay('05178k')
  const api = apiFor(state)
  behavior.enemyDefeated(state, enemy, api)
  const restored = state.enemies.find(candidate => candidate.hereticFace === '05178k')
  assert.ok(restored, 'L 面立即翻回敌人面')
  assert.equal(restored.hereticBanishNext, true, '下次击败即驱除')
  assert.equal(restored.cannotBeDefeated, undefined)
  assert.ok(api.calls.some(call => call.name === 'attack'), '翻回后立即攻击')
  behavior.enemyDefeated(state, restored, apiFor(state))
  assert.ok(state.victoryDisplay.some(card => card.code === '05178l'), '第二次击败时被驱除进胜利区')
})

// ---------------------------------------------------------------------------
// 未了之事 05178d/05178f/05178h/05178l
// ---------------------------------------------------------------------------

test('05178d 未了之事（D）：轮末受到 1 伤害或翻回敌人面；在绞刑架无线索时意志/敏捷(4)驱除进胜利区', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const gallows = state.locations.find(location => locationGroupOf(state, location.id) === 'theGallows')
  assert.ok(gallows, '绞刑架应在场')
  inv.location = gallows.id
  gallows.clues = 0
  inv.threat.push({ id: 'ub-d', code: '05178d' })
  // 正常由 enemyDefeated→flipToUnfinishedBusiness 建立的快照（翻回敌人面时需要）。
  state.scenarioFlags.unfinishedBusiness = [{
    storyCode: '05178d', enemyCode: '05178c', holderSeat: 0, locationId: gallows.id,
    enemySnapshot: {
      id: 'heretic-d', code: '05178c', originalCode: '05178c', name: '异端者',
      location: gallows.id, health: 6, damageTaken: 0, engagedSeat: 0, exhausted: false,
    },
  }]
  const damageApi = apiFor(state, { choose: () => 'harm' })
  assert.equal(unfinishedBusinessForced(state, inv, inv.threat[0], damageApi), true)
  assert.ok(damageApi.calls.some(call => call.name === 'damage' && call.args[1] === 1), '选择受到 1 点伤害')
  const flipApi = apiFor(state, { choose: () => 'flip' })
  assert.equal(unfinishedBusinessForced(state, inv, inv.threat[0], flipApi), true)
  assert.ok(state.enemies.some(enemy => enemy.hereticFace === '05178c'), '选择翻回异端者面')
  // 重新建立威胁区实例（上一步翻回已移除）。
  inv.threat.push({ id: 'ub-d2', code: '05178d' })
  const banish = behavior.actions(state, inv).find(move => move.rule === 'banishUnfinishedBusiness'
    && move.threatCode === '05178d')
  assert.ok(banish, '绞刑架无线索时提供驱除行动')
  assert.ok(['willpower', 'agility'].includes(banish.skill), '驱除检定可用意志或敏捷')
  behavior.performAction(state, inv, banish, apiFor(state, { testResolve: 'success' }))
  assert.ok(state.victoryDisplay.some(card => card.code === '05178d'), '驱除后进入胜利区')
  assert.deepEqual(inv.threat, [], '威胁区清理')
})

test('05178f 未了之事（F）：轮末失去 2 资源或翻回敌人面；在教堂阁楼无线索时智识/敏捷(4)驱除', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const attic = state.locations.find(location => locationGroupOf(state, location.id) === 'chapelAttic')
  assert.ok(attic, '教堂阁楼应在场')
  inv.location = attic.id
  attic.clues = 0
  inv.threat.push({ id: 'ub-f', code: '05178f' })
  const api = apiFor(state, {
    choose: () => 'harm',
    loseResources: (seat, amount) => {
      const owner = state.investigators[seat]
      owner.resources -= amount
      return amount
    },
  })
  assert.equal(unfinishedBusinessForced(state, inv, inv.threat[0], api), true)
  assert.equal(inv.resources, 5 - UNFINISHED_BUSINESS_RULES['05178f'].forced.amount, '选择失去 2 资源')
  const banish = behavior.actions(state, inv).find(move => move.rule === 'banishUnfinishedBusiness'
    && move.threatCode === '05178f')
  assert.ok(banish, '教堂阁楼无线索时提供驱除行动')
  assert.ok(['intellect', 'agility'].includes(banish.skill))
  behavior.performAction(state, inv, banish, apiFor(state, { testResolve: 'success' }))
  assert.ok(state.victoryDisplay.some(card => card.code === '05178f'))
})

test('05178h 未了之事（H）：轮末选择并弃掉 2 张手牌或翻回敌人面；在墓地无线索时意志/战斗(4)驱除', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const graves = state.locations.find(location => locationGroupOf(state, location.id) === 'hereticsGraves')
  assert.ok(graves, '异端者的墓地应在场')
  inv.location = graves.id
  graves.clues = 0
  inv.threat.push({ id: 'ub-h', code: '05178h' })
  const api = apiFor(state, { choose: () => 'harm' })
  assert.equal(unfinishedBusinessForced(state, inv, inv.threat[0], api), true)
  const discard = api.calls.find(call => call.name === 'discardChosen')
  assert.ok(discard, '选择弃牌分支')
  assert.equal(discard.args[1], 2, '选择并弃掉 2 张手牌')
  const banish = behavior.actions(state, inv).find(move => move.rule === 'banishUnfinishedBusiness'
    && move.threatCode === '05178h')
  assert.ok(banish, '墓地无线索时提供驱除行动')
  assert.ok(['willpower', 'combat'].includes(banish.skill))
  behavior.performAction(state, inv, banish, apiFor(state, { testResolve: 'success' }))
  assert.ok(state.victoryDisplay.some(card => card.code === '05178h'))
})

test('05178l 未了之事（L）：被击败且已注册「下次击败即驱除」时进入胜利区（不重复翻面）', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const enemy = {
    id: 'heretic-l', code: '05178k', originalCode: '05178k', name: '异端者',
    location: inv.location, health: 6, damageTaken: 6, engagedSeat: inv.seat,
    exhausted: false, hereticFace: '05178k', hereticStory: '05178l',
    hereticBanishNext: true,
  }
  state.enemies.push(enemy)
  inv.engaged.push(enemy.id)
  behavior.enemySpawned(state, enemy, apiFor(state))
  const api = apiFor(state)
  behavior.enemyDefeated(state, enemy, api)
  assert.ok(state.victoryDisplay.some(card => card.code === '05178l'), 'L 面被驱除进胜利区')
  assert.equal(state.enemies.includes(enemy), false)
  assert.deepEqual(state.scenarioFlags.unfinishedBusiness || [], [], '不再生成未了之事威胁卡')
})

// ---------------------------------------------------------------------------
// 补充：05166 正面撤退 / 05171 正面调查加值
// ---------------------------------------------------------------------------

test('05166 绞刑者河：提供 [action] 撤退，结算后该调查员撤退', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const brook = ensureLocation(state, 'hangmansBrook')
  inv.location = brook.id
  const move = behavior.actions(state, inv).find(candidate => candidate.rule === 'resignHangmansBrook')
  assert.ok(move, '绞刑者河提供撤退行动')
  assert.equal(move.action, 'scenarioAction')
  const api = apiFor(state)
  behavior.performAction(state, inv, move, api)
  assert.ok(api.calls.some(call => call.name === 'resign' && call.args[0] === inv.seat), '撤退结算')
})

test('05171 异端者的墓地：调查时把当前意志值加入本次调查技能值', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  const graves = forceLocation(state, 'hereticsGraves', '05171')
  inv.location = graves.id
  assert.equal(graves.investigateBonus, 'willpower')
  const api = apiFor(state, { investigatorStat: () => 4 })
  behavior.beforeInvestigate(state, inv, graves, api)
  assert.deepEqual(inv.wosInvestigateBonus, { amount: 4, code: '05171', round: state.round })
  state.skillTest = { source: { code: '05171' } }
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 4, '当前意志值 4 加入本次调查技能值')
  assert.equal(behavior.statModifier(state, inv, 'combat'), 4, '任意调查技能都按同一加值结算')
  state.skillTest = { source: { code: '01001' } }
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 0, '不泄漏到无关检定')
  behavior.investigateResult(state, inv)
  assert.equal(inv.wosInvestigateBonus, undefined)
})

// ---------------------------------------------------------------------------
// 补充：05181 惩罚的威胁区 [action] 读点（autoSuccessWhen: exhaustedWitchHere）
// ---------------------------------------------------------------------------

test('05181 惩罚：[action] 意志(3)弃掉本卡；同地点有横置女巫敌人时自动成功', () => {
  const state = setup(stateFor())
  const inv = state.investigators[0]
  inv.threat.push({ id: 'punish-1', code: '05181' })
  const moves = behavior.encounterActions(state, inv).filter(move => move.rule === 'discardPunishment')
  assert.equal(moves.length, 1, '威胁区的惩罚提供 encounterAction')
  assert.equal(moves[0].actions, 1)
  // 分支一：没有横置女巫 → 走意志(3)检定，成功才弃掉。
  const testApi = apiFor(state, { testResolve: 'success' })
  assert.equal(behavior.performEncounterAction(state, inv, moves[0], testApi), true)
  const test = testApi.calls.find(call => call.name === 'test')
  assert.ok(test, '无横置女巫时发起检定')
  assert.equal(test.args[1], 'willpower')
  assert.equal(test.args[2], 3)
  assert.equal(inv.threat.some(card => card.code === '05181'), false, '检定成功后弃掉惩罚')
  // 分支二：同地点有横置的女巫敌人 → 自动成功（不发起检定）。
  const autoState = setup(stateFor())
  const autoInv = autoState.investigators[0]
  autoInv.threat.push({ id: 'punish-2', code: '05181' })
  const witch = {
    id: 'witch-1', code: '05179', originalCode: '05179',
    location: autoInv.location, exhausted: true,
  }
  autoState.enemies.push(witch)
  const autoMove = behavior.encounterActions(autoState, autoInv).find(move => move.rule === 'discardPunishment')
  const autoApi = apiFor(autoState)
  assert.equal(behavior.performEncounterAction(autoState, autoInv, autoMove, autoApi), true)
  assert.equal(autoApi.calls.some(call => call.name === 'test'), false, '有横置女巫时自动成功，不发起检定')
  assert.equal(autoInv.threat.some(card => card.code === '05181'), false, '自动成功后弃掉惩罚')
})

// ---------------------------------------------------------------------------
// 补充：05169 绞刑架 169 正面隐藏值与幽灵面闹鬼
// ---------------------------------------------------------------------------

test('05169 绞刑架（169）：隐藏值 +1×场上女巫敌人数量', () => {
  const state = setup(stateFor())
  const gallows = forceLocation(state, 'theGallows', '05169')
  assert.equal(gallows.shroudRule, 'perWitch', '隐藏值规则来自地点数据 perWitch')
  assert.equal(gallows.hauntedGroup, 'theGallows169')
  assert.equal(behavior.locationShroudModifier(state, gallows), 0, '场上没有女巫敌人时不加隐藏值')
  state.enemies.push(
    { id: 'witch-1', code: '05179', originalCode: '05179', location: gallows.id },
    { id: 'witch-2', code: '05179', originalCode: '05179', location: 'hangmansBrook' },
    { id: 'monster-1', code: 'xmonster', traits: ['Monster'], location: gallows.id },
  )
  assert.equal(behavior.locationShroudModifier(state, gallows), 2, '场上 2 个女巫敌人 → 隐藏值 +2')
})

test('05169b 绞刑架（169）幽灵面：闹鬼弃基础遭遇牌库顶 3 张，弃到女巫敌人时将其抽出交战', () => {
  const state = setup(stateFor())
  const gallows = forceLocation(state, 'theGallows', '05169')
  const inv = state.investigators[0]
  inv.location = gallows.id
  // 幽灵面：行为层按 hauntedGroup 写入闹鬼数据。
  gallows.spectral = true
  gallows.spectralFace = 'spectral'
  behavior.locationRevealed(state, gallows, apiFor(state))
  assert.ok(gallows.haunted?.[0]?.text?.includes('弃掉基础遭遇牌库顶 3 张'), '幽灵面闹鬼数据已就绪')
  // 牌库顶 = 数组尾：依次弃 01021、05179（女巫，抽出交战）、01020。
  state.encounterDeck = ['01020', '05179', '01021']
  state.encounterDiscard = []
  const api = apiFor(state)
  assert.equal(behavior.hauntedScript(state, { scriptId: 'discardStandardForWitch', seat: inv.seat }, api), true)
  assert.deepEqual(state.encounterDiscard, ['01021', '01020'], '非女巫卡进基础遭遇弃牌堆')
  const spawned = api.calls.find(call => call.name === 'spawnEngaged')
  assert.ok(spawned, '弃到的女巫敌人改为抽出')
  assert.equal(spawned.args[0], '05179')
  assert.equal(spawned.args[1], gallows.id)
  assert.equal(spawned.args[2], inv.seat, '与结算者交战')
})