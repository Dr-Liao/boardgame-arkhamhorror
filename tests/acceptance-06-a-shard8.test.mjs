// 验收 06-a 食梦者 · 分片 8（wgd《神居之所》06276–06322）逐卡标题级证据补齐。
//
// 背景：`tests/tde-scenario-whereTheGodsDwell.test.mjs` 已覆盖本章章节流程，但下列卡片的测试标题
// 不含卡号（ACCEPTANCE-ORDER §3 维度 4 要求「标题含卡号的真实执行用例」）：
//   06288、06289、06291、06295、06296、06297、06298、06299、
//   06300–06305（6 座被遗忘的高塔）、06306–06310（5 个奈亚拉托提普复制品）、06312、
//   06314–06317（混沌低语四方向）、06318、06320、06321、06322。
// 本文件用与既有章节测试相同的「生产代码钩子 + 确定性 api」方式补真实断言：调用
// whereTheGodsDwell/behavior.js 钩子、单卡条目（enemyScript/locationRule/flags）与
// chaos.js，断言可观察状态（线索、手牌/隐藏手牌、胜利区、遭遇牌库、幕推进、毁灭、记录），
// 不写「条目存在」式空断言。
//
// 只读验收：本文件不修改 src/**、content/**、audit/**。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import * as engine from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/index.js'
import {
  scenario as definition, FORSAKEN_TOWERS, NYARLATHOTEP_COPIES, HIGH_PRIEST,
  ONYX_CASTLE, ONYX_GATES, MONASTERY_OF_LENG, COLD_WASTES, FORSAKEN_TOWER_IDS,
} from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/definition.js'
import { whereTheGodsDwellChaosToken } from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

// 单卡条目注册：索引未含本章时临时注册（与既有章节测试同一写法）。
const entryDir = new URL('../src/cards/encounter-entries/theDreamEaters/whereTheGodsDwell/', import.meta.url)
const entryModules = await Promise.all(readdirSync(entryDir)
  .filter(name => name.endsWith('.js'))
  .map(name => import(new URL(name, entryDir).href)))
const unregistered = entryModules
  .map(module => module.default)
  .filter(entry => entry && !registeredEntry(entry.code))
if (unregistered.length) registerCardAbilities(unregistered)

const behavior = chapter.behavior
const clone = value => structuredClone(value)
const loc = (state, id) => state.locations.find(location => location.id === id)
const inv = (state, seat = 0) => state.investigators[seat]

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'plateauOfLeng',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], hiddenCards: [], assets: [], threat: [],
      engaged: [], deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({
        deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', '-1', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(entry => entry.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
}

function setup(state) {
  behavior.setupLocations(state, [], {})
  placeLocations(state, ['plateauOfLeng', 'coldWastes', 'monasteryOfLeng', 'onyxGates', 'theOnyxCastle'])
  behavior.afterDeckSetup(state, [], {})
  return state
}

// 隐藏手牌原语桩：与 src/engine/scenario-runtime.js 的 api.hiddenCards 同语义。
function hiddenCardsStub(state) {
  const people = () => state.investigators
  const removeMarker = (owner, code) => {
    owner.hiddenCards ||= []
    const index = owner.hiddenCards.indexOf(code)
    if (index >= 0) owner.hiddenCards.splice(index, 1)
  }
  return {
    list: seat => [...(people()[seat]?.hiddenCards || [])],
    has: (seat, code = null) => (people()[seat]?.hiddenCards || [])
      .some(hidden => code == null || hidden === code),
    place: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      owner.hand.push(code)
      owner.hiddenCards ||= []
      owner.hiddenCards.push(code)
      return true
    },
    discard: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      const index = owner.hand.indexOf(code)
      if (index < 0 || !(owner.hiddenCards || []).includes(code)) return false
      owner.hand.splice(index, 1)
      removeMarker(owner, code)
      state.encounterDiscard.push(code)
      return true
    },
    take: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      const index = owner.hand.indexOf(code)
      if (index < 0 || !(owner.hiddenCards || []).includes(code)) return false
      owner.hand.splice(index, 1)
      removeMarker(owner, code)
      return true
    },
    removeMarker: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      removeMarker(owner, code)
      return true
    },
    transfer: (seat, targetSeat, code) => {
      const from = people()[seat]
      const to = people()[targetSeat]
      if (!from || !to) return false
      const index = from.hand.indexOf(code)
      if (index < 0 || !(from.hiddenCards || []).includes(code)) return false
      from.hand.splice(index, 1)
      removeMarker(from, code)
      to.hand.push(code)
      to.hiddenCards ||= []
      to.hiddenCards.push(code)
      return true
    },
  }
}

function apiStub(state, overrides = {}) {
  state.log ||= []; state.instanceSeq ||= {}; state.currentSeat ??= 0
  const runtime = engine.scenarioRuntime(state, [])
  const api = {
    ...runtime,
    info: () => {},
    choose: request => (request?.options?.[0]?.id ?? 'skip'),
    random: () => 0.5,
    shuffle: items => [...items],
    damage: (seat, amount) => { inv(state, seat).damage += amount },
    horror: (seat, amount) => { inv(state, seat).horror += amount },
    loseActions: (seat, amount) => { inv(state, seat).actionsLeft = Math.max(0, inv(state, seat).actionsLeft - amount) },
    addDoom: amount => { state.doom += amount },
    doomOn: (card, amount = 1) => { if (card) card.doom = (card.doom || 0) + amount },
    cardReveal: code => { api.revealed.push(code) },
    revealed: [],
    hiddenCards: hiddenCardsStub(state),
    attacks: [],
    moveCard: spec => {
      const owner = state.investigators[spec.ownerSeat ?? 0]
      if (spec.from === 'hand') {
        const index = owner.hand.indexOf(spec.code)
        if (index >= 0) owner.hand.splice(index, 1)
      }
      if (spec.to === 'victoryDisplay') {
        state.victoryDisplay.push({ id: `vd-${state.victoryDisplay.length + 1}`, code: spec.code, originalCode: spec.code, victory: 2 })
      }
      return true
    },
    attackFromHiddenEnemy: (seat, code) => { api.attacks.push({ seat, code }) },
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty + 1, difficulty, skill }),
    spawn: (code, locationId, seat = null) => {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location: locationId, engagedSeat: seat, damageTaken: 0, exhausted: false,
        traits: [], fight: definition.enemies[code]?.fight ?? 0, evade: definition.enemies[code]?.evade ?? 0,
        health: definition.enemies[code]?.health ?? 1, victory: definition.enemies[code]?.victory ?? 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    spawnStoryEnemy: (code, locationId, stats = {}, extra = {}) => {
      const enemy = {
        id: `story-enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: stats.name || code, location: locationId, engagedSeat: null, damageTaken: 0,
        exhausted: false, ...stats, ...extra,
      }
      state.enemies.push(enemy)
      return enemy
    },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(entry => entry.id === enemyId)
      if (!enemy) return 0
      enemy.damageTaken = (enemy.damageTaken || 0) + amount
      return amount
    },
    moveInvestigator: (seat, locationId) => { inv(state, seat).location = locationId },
    place: id => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
      state.locations.push({ ...clone(base), id, revealed: false, clues: 0, maxClues: clues, doom: 0 })
      return loc(state, id)
    },
    reveal: id => {
      const location = loc(state, id)
      if (!location) return null
      location.revealed = true
      location.clues = location.maxClues || 0
      if (location.unrevealedActualName) {
        location.name = location.unrevealedActualName
        delete location.unrevealedActualName
      }
      return location
    },
    removeLocationFromGame: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
      return index >= 0
    },
    addCluesToLocation: (id, amount) => {
      const location = loc(state, id)
      if (!location) return 0
      location.clues = (location.clues || 0) + amount
      return location.clues
    },
    discardEncounterTop: (count = 1) => {
      const discarded = []
      for (let index = 0; index < count && state.encounterDeck.length; index += 1) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); return state.encounterDeck.length },
    shuffleDiscard: () => {
      state.encounterDeck.push(...state.encounterDiscard)
      state.encounterDiscard = []
    },
    takeFromSetAside: code => {
      const aside = state.scenarioZones?.setAside || []
      const index = aside.indexOf(code)
      if (index < 0) return false
      aside.splice(index, 1)
      return true
    },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags[key] = value },
    loseClues: (seat, amount) => {
      const owner = inv(state, seat)
      const lost = Math.min(owner.clues || 0, amount)
      owner.clues -= lost
      return lost
    },
    spendClues: (seat, amount) => { inv(state, seat).clues -= amount },
    payClues: (amount, locationId = null) => {
      let remaining = amount
      for (const entry of state.investigators) {
        if (locationId && entry.location !== locationId) continue
        const spend = Math.min(entry.clues || 0, remaining)
        entry.clues -= spend
        remaining -= spend
      }
    },
    advanceAct: () => { state.actIndex += 1 },
    finish: key => { state.resolutionKey = key },
    locationDistance: (from, targets) => (targets.includes(from) ? 0 : 1),
    stepToward: (from, to) => to,
    moveEnemy: (enemy, locationId) => { enemy.location = locationId },
    attack: (enemy, investigator) => {
      investigator.damage += Number(enemy.damage || 0)
      investigator.horror += Number(enemy.horror || 0)
    },
    discardFromHand: (seat, code) => {
      const owner = inv(state, seat)
      const index = owner.hand.indexOf(code)
      if (index < 0) return false
      owner.hand.splice(index, 1)
      state.encounterDiscard.push(code)
      return true
    },
    driveInsane: seat => { inv(state, seat).drivenInsane = true; inv(state, seat).defeated = true },
    defeat: (target, cause = null) => {
      target.defeated = true
      target.defeatCause = cause
    },
    defeatEnemy: (enemy, options = {}) => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.victoryDisplay.push({ id: `vd-${state.victoryDisplay.length + 1}`, code: enemy.code || enemy.originalCode, originalCode: enemy.code || enemy.originalCode, victory: 2 })
      api.defeatedEnemies = [...(api.defeatedEnemies || []), enemy.code]
      return true
    },
    resolveEnemyPhaseOf: enemy => { api.enemyPhaseResolved = [...(api.enemyPhaseResolved || []), enemy.code]; return { attacked: true } },
    ...overrides,
  }
  return api
}

// 把某张单卡条目挂进注册表可读的状态（条目已随 engine 注册；此 helper 只取条目）。
const entryOf = code => registeredEntry(code)

// 在场上放一处地点（可选揭示）并把调查员放过去。
function placeOne(state, id, { revealed = true, seat = 0 } = {}) {
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
  state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  const location = loc(state, id)
  if (seat != null) inv(state, seat).location = id
  return location
}

// ---------------------------------------------------------------------------
// 议程 / 幕 06288、06289、06291
// ---------------------------------------------------------------------------

test('06288 混沌之形 背面：act 4 时给被遗忘的高塔补线索、揭示手中奈亚拉托提普并按选择攻击/洗回', () => {
  const state = setup(stateFor())
  state.actIndex = 3 // act 4
  const tower = placeOne(state, FORSAKEN_TOWER_IDS[0])
  tower.clues = 0
  tower.maxClues = 3
  inv(state, 0).hand.push('06306')
  inv(state, 0).hiddenCards.push('06306')
  const api = apiStub(state, { choose: request => (request.kind === 'story' ? 'shuffled' : (request.options?.[0]?.id ?? 'skip')) })
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(tower.clues, 3, '每座塔的线索补到其线索值')
  assert.ok(api.revealed.includes('06306'), '揭示持有者手牌中的奈亚拉托提普')
  assert.equal(inv(state, 1).damage, 1, '未持有复制品的调查员受到 1 伤害（默认选伤害）')
  assert.equal(api.attacks.length, 1, '复制品攻击一次')
  assert.ok(state.encounterDeck.includes('06306'), '选择「攻击 1 次」后洗回遭遇牌库')
  // 非 act 4 时不结算背面。
  const early = setup(stateFor())
  early.actIndex = 0
  const earlyApi = apiStub(early)
  behavior.agendaReveal(early, early.agendas[1], earlyApi)
  assert.equal(earlyApi.revealed.length, 0, 'act 4 之前不结算该背面')
})

test('06289 混沌化身 背面：每位未被击败/撤退的调查员被击败', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  behavior.agendaReveal(state, state.agendas[2], api)
  assert.deepEqual(state.investigators.map(owner => owner.defeated), [true, true])
  assert.ok(state.investigators.every(owner => owner.defeatCause === 'chaosIncarnate'))
  // 已知缺口（见报告失败清单）：「driven insane」子句没有本地读点——本条只调用 api.defeat，
  // 未调用 api.driveInsane；战役记录 status 不会写成 insane。
  assert.equal(state.investigators.every(owner => !owner.drivenInsane), true, '当前实现不发疯（缺口）')
})

test('06291 袍下之人：靠近+打晕后可用 [action] 直接击败大祭司并推进幕', () => {
  const state = setup(stateFor())
  state.actIndex = 1 // 幕 2：袍下之人
  const api = apiStub(state)
  const priest = { id: 'priest-1', code: HIGH_PRIEST, originalCode: HIGH_PRIEST, name: '不可描述的高阶祭司', location: 'monasteryOfLeng', damageTaken: 0 }
  state.enemies.push(priest)
  const inv0 = inv(state, 0)
  // 条件不满足时不提供该行动。
  assert.equal(behavior.actions(state, inv0).some(move => move.rule === 'defeatHighPriest'), false)
  state.scenarioFlags.maneuveredThePriestCloser = true
  state.scenarioFlags.stunnedThePriest = true
  const move = behavior.actions(state, inv0).find(candidate => candidate.rule === 'defeatHighPriest')
  assert.ok(move, '记住「靠近」「打晕」后提供击败行动')
  assert.equal(move.scriptCard, 'act')
  behavior.performAction(state, inv0, move, api)
  assert.deepEqual(api.defeatedEnemies, [HIGH_PRIEST], '直接击败不可描述的高阶祭司')
  assert.equal(state.enemies.includes(priest), false)
  // 目标：大祭司被击败（在胜利区）→ 推进幕。
  behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2, '大祭司被击败后从幕 2 推进到幕 3')
})

// ---------------------------------------------------------------------------
// 地点 06295–06299
// ---------------------------------------------------------------------------

test('06295 冷原：敌人试图生成在无人地点且场上没有无人地点时改为生成在冷原', () => {
  const state = setup(stateFor())
  const api = apiStub(state)
  for (const id of ['plateauOfLeng', 'coldWastes', 'monasteryOfLeng', 'onyxGates', 'theOnyxCastle']) {
    if (!loc(state, id)) placeOne(state, id, { seat: null })
  }
  // 场上仍有无人地点 → 不改道（交回引擎继续别的落点）。
  assert.equal(behavior.spawnLocation(state, '06012', null, 0, api, { targetMatcher: 'emptyLocation' }), null)
  // 让每个地点都被调查员或敌人占据 → 没有无人地点 → 改生成在冷原。
  for (const [index, location] of state.locations.entries()) {
    state.enemies.push({ id: `block-${index}`, code: 'xblock', originalCode: 'xblock', location: location.id })
  }
  assert.equal(
    behavior.spawnLocation(state, '06012', null, 0, api, { targetMatcher: 'emptyLocation' }),
    'plateauOfLeng',
    '没有无人地点时改生成在冷原',
  )
})

test('06296 冰封荒土：调查时揭示特殊标记后必须受伤或失去 1 个行动', () => {
  const state = setup(stateFor())
  const inv0 = inv(state, 0)
  inv0.location = 'coldWastes'
  const api = apiStub(state, {
    choose: request => (request.options?.some(option => option.id === 'loseAction') ? 'loseAction' : request.options?.[0]?.id ?? 'skip'),
  })
  behavior.afterTest(state, inv0, {
    success: false, drawn: ['skull'], cancelledTokens: [], source: { code: String(COLD_WASTES) },
  }, api)
  assert.equal(inv0.actionsLeft, 2, '选择失去 1 个行动')
  assert.equal(inv0.damage, 0)
  // 没有特殊标记 → 不触发。
  const calm = setup(stateFor())
  inv(calm, 0).location = 'coldWastes'
  behavior.afterTest(calm, inv(calm, 0), {
    success: true, drawn: ['eldersign'], cancelledTokens: [], source: { code: String(COLD_WASTES) },
  }, apiStub(calm))
  assert.equal(inv(calm, 0).actionsLeft, 3)
})

test('06297 冷原隐修院：[fast] 团队花费 1×人数线索记住「靠近了祭司」；未揭示时不能进入', () => {
  const state = setup(stateFor())
  const monastery = placeOne(state, 'monasteryOfLeng', { revealed: false, seat: null })
  const inv0 = inv(state, 0)
  inv0.location = monastery.id
  inv0.clues = 2
  const api = apiStub(state)
  const move = behavior.actions(state, inv0).find(candidate => candidate.rule === 'maneuverPriestCloser')
  assert.ok(move, '线索足够时提供 [fast] 记住行动')
  assert.equal(move.actions, 0)
  behavior.performAction(state, inv0, move, api)
  assert.equal(state.scenarioFlags.maneuveredThePriestCloser, true)
  assert.equal(inv0.clues, 0, '团队共同花费 1×人数线索')
  // 未揭示时不能进入。
  assert.ok(behavior.moveError(state, inv0, monastery, monastery.id))
  monastery.revealed = true
  assert.equal(behavior.moveError(state, inv0, monastery, monastery.id), null)
})

test('06298 缟玛瑙大门：隐藏值 +1×人数；揭示后按「卡达斯的证据」记录移除线索', () => {
  const state = setup(stateFor())
  const gates = placeOne(state, 'onyxGates', { revealed: false, seat: null })
  assert.equal(behavior.locationShroudModifier(state, gates), 1 * state.numInvestigators)
  gates.clues = 5
  state.campaign.records.evidenceOfKadath = 2
  const api = apiStub(state)
  entryOf('06298').locationRule.onReveal(state, gates, api, 0)
  assert.equal(gates.clues, 3, '「卡达斯的证据」每有 1 条记录移除 1 个线索')
})

test('06299 大礼堂：[action] 把手牌中的隐私卡交给同地点另一位调查员；未揭示时不能进入', () => {
  const state = setup(stateFor())
  const castle = placeOne(state, 'theOnyxCastle', { revealed: true, seat: 0 })
  inv(state, 1).location = castle.id
  const inv0 = inv(state, 0)
  inv0.hand.push('06306')
  inv0.hiddenCards.push('06306')
  const api = apiStub(state)
  const move = behavior.actions(state, inv0).find(candidate => candidate.rule === 'giveHiddenCard')
  assert.ok(move, '有隐私手牌与同地点其他调查员时提供行动')
  behavior.performAction(state, inv0, move, api)
  assert.equal(inv0.hand.includes('06306'), false)
  assert.equal(inv(state, 1).hand.includes('06306'), true, '隐私卡进入另一调查员手牌')
  assert.equal(inv(state, 1).hiddenCards.includes('06306'), true, '隐私标记一起转移')
  castle.revealed = false
  assert.ok(behavior.moveError(state, inv0, castle, castle.id), '未揭示的缟玛瑙城堡不能进入')
})

// ---------------------------------------------------------------------------
// 被遗忘的高塔 06300–06305
// ---------------------------------------------------------------------------

function towerSetup(towerCode, { direction = 'north', whisperCode = '06314' } = {}) {
  const state = setup(stateFor())
  const tower = FORSAKEN_TOWERS.find(entry => entry.code === towerCode)
  const location = placeOne(state, tower.id, { revealed: true, seat: 0 })
  state.scenarioFlags.towerCompass = { [tower.id]: direction }
  const inv0 = inv(state, 0)
  inv0.hand.push(whisperCode, '06306')
  inv0.hiddenCards.push(whisperCode, '06306')
  return { state, location, inv0, tower }
}

function assertTower(towerCode, skill, difficultyKind, copyCode) {
  const { state, inv0, tower } = towerSetup(towerCode)
  inv0.hand = inv0.hand.filter(code => code !== '06306').concat(copyCode)
  inv0.hiddenCards = inv0.hiddenCards.filter(code => code !== '06306').concat(copyCode)
  const testCalls = []
  const api = apiStub(state, {
    test: (seat, testSkill, difficulty, resolve) => {
      testCalls.push({ seat, testSkill, difficulty })
      resolve({ success: true, value: difficulty + 1, difficulty, skill: testSkill })
    },
  })
  const move = behavior.actions(state, inv0).find(candidate => candidate.rule === `forsakenTower:${tower.id}`)
  assert.ok(move, '有同方向混沌低语与手中复制品时提供塔行动')
  behavior.performAction(state, inv0, move, api)
  assert.equal(testCalls.length, 1)
  assert.equal(testCalls[0].testSkill, skill, '检定技能来自条目数据')
  const copy = ALL_CARDS[copyCode]
  assert.equal(testCalls[0].difficulty, Number(copy[difficultyKind]), '难度取所选复制品的印刷值')
  assert.ok(api.revealed.includes(copyCode), '揭示所选复制品')
  assert.ok(api.revealed.includes('06314'), '揭示同方向的混沌低语')
  assert.ok(state.victoryDisplay.some(card => card.code === copyCode), '成功：复制品进入胜利区')
  assert.equal(inv0.hand.includes(copyCode), false)
  assert.equal(inv0.hiddenCards.includes(copyCode), false)
  // 失败分支：复制品攻击并与混沌低语一起洗回遭遇牌库。
  const failState = towerSetup(towerCode)
  const failInv = inv(failState.state, 0)
  failInv.hand = failInv.hand.filter(code => code !== '06306').concat(copyCode)
  failInv.hiddenCards = failInv.hiddenCards.filter(code => code !== '06306').concat(copyCode)
  const failApi = apiStub(failState.state, {
    test: (seat, testSkill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill: testSkill }),
  })
  const failMove = behavior.actions(failState.state, failInv).find(candidate => candidate.rule === `forsakenTower:${tower.id}`)
  behavior.performAction(failState.state, failInv, failMove, failApi)
  assert.equal(failApi.attacks.length, 1, '失败：复制品攻击调查员')
  assert.ok(failState.state.encounterDeck.includes(copyCode), '失败：复制品洗回遭遇牌库')
  assert.ok(failState.state.encounterDeck.includes('06314'), '失败：混沌低语洗回遭遇牌库')
}

test('06300 被遗忘的高塔·神话与传说：智识调查检定，难度=所选复制品生命，成功复制品进胜利区', () => {
  assertTower('06300', 'intellect', 'health', '06306')
})

test('06301 被遗忘的高塔·生死：意志攻击检定，难度=所选复制品攻击值', () => {
  assertTower('06301', 'willpower', 'fight', '06307')
})

test('06302 被遗忘的高塔·无尽真理：智识躲避检定，难度=所选复制品躲避值', () => {
  assertTower('06302', 'intellect', 'evade', '06308')
})

test('06303 被遗忘的高塔·永恒之火：战斗攻击检定，难度=所选复制品攻击值', () => {
  assertTower('06303', 'combat', 'fight', '06309')
})

test('06304 被遗忘的高塔·夜之女王：敏捷躲避检定，难度=所选复制品躲避值', () => {
  assertTower('06304', 'agility', 'evade', '06310')
})

test('06305 被遗忘的高塔·原始之光：意志检定(难度=所选复制品生命)，成功复制品进胜利区', () => {
  assertTower('06305', 'willpower', 'health', '06306')
})

test('06300 被遗忘的高塔数据：6 座塔各自声明不同的检定类别/技能/难度来源', () => {
  const data = Object.fromEntries(FORSAKEN_TOWERS.map(({ code }) => [code, entryOf(code).locationRule.towerAction]))
  assert.deepEqual(Object.keys(data).sort(), ['06300', '06301', '06302', '06303', '06304', '06305'])
  assert.deepEqual(data['06300'], { rule: 'forsakenTower', testKind: 'investigate', skill: 'intellect', difficultyKind: 'health' })
  assert.deepEqual(data['06301'], { rule: 'forsakenTower', testKind: 'fight', skill: 'willpower', difficultyKind: 'fight' })
  assert.deepEqual(data['06302'], { rule: 'forsakenTower', testKind: 'evade', skill: 'intellect', difficultyKind: 'evade' })
  assert.deepEqual(data['06303'], { rule: 'forsakenTower', testKind: 'fight', skill: 'combat', difficultyKind: 'fight' })
  assert.deepEqual(data['06304'], { rule: 'forsakenTower', testKind: 'evade', skill: 'agility', difficultyKind: 'evade' })
  assert.deepEqual(data['06305'], { rule: 'forsakenTower', testKind: 'willpower', skill: 'willpower', difficultyKind: 'health' })
})

// ---------------------------------------------------------------------------
// 奈亚拉托提普复制品 06306–06310
// ---------------------------------------------------------------------------

function assertHiddenNyarlathotep(code) {
  const state = setup(stateFor())
  const inv0 = inv(state, 0)
  const api = apiStub(state)
  assert.equal(behavior.spawnLocation(state, code, inv0.location, 0, api), '__hidden_in_hand__', '复制品不在场上生成')
  state.encounterDiscard.push(code) // 引擎生成失败时会把该卡放进遭遇弃牌堆，随后 spawnFailed 取回
  behavior.spawnFailed(state, code, 0, api)
  assert.equal(inv0.hand.includes(code), true, '秘密加入调查员手牌')
  assert.equal(inv0.hiddenCards.includes(code), true, '带隐私标记')
  assert.equal(entryOf(code).flags?.nyarlathotepCopy, true)
  assert.equal(entryOf(code).hiddenEnemyInHand, true)
  // 提到手中未揭示的本卡 → 发疯（章节的零行动快速入口）。
  const mention = behavior.actions(state, inv0).find(candidate => candidate.rule === `reportHiddenMention:${code}`)
  assert.ok(mention, '提供申报「提到了它」的 [fast] 入口')
  const driveApi = apiStub(state)
  behavior.performAction(state, inv0, mention, driveApi)
  assert.equal(inv0.drivenInsane, true, '申报后发疯')
}

test('06306 奈亚拉托提普·蠕行的混沌：遭遇生成被拦截并秘密加入手牌；申报「提到了它」会发疯', () => {
  assertHiddenNyarlathotep('06306')
})

test('06307 奈亚拉托提普·无面的低语者：遭遇生成被拦截并秘密加入手牌；申报「提到了它」会发疯', () => {
  assertHiddenNyarlathotep('06307')
})

test('06308 奈亚拉托提普·外神的信使：遭遇生成被拦截并秘密加入手牌；申报「提到了它」会发疯', () => {
  assertHiddenNyarlathotep('06308')
})

test('06309 奈亚拉托提普·万千化身之神：遭遇生成被拦截并秘密加入手牌；申报「提到了它」会发疯', () => {
  assertHiddenNyarlathotep('06309')
})

test('06310 奈亚拉托提普·星间行者：遭遇生成被拦截并秘密加入手牌；申报「提到了它」会发疯', () => {
  assertHiddenNyarlathotep('06310')
})

// ---------------------------------------------------------------------------
// 敌人 06312
// ---------------------------------------------------------------------------

test('06312 荒土蠕虫：生成于冰封荒土或大礼堂（二选一），猎物为敏捷最低', () => {
  const state = setup(stateFor())
  const cold = loc(state, 'coldWastes')
  const castle = loc(state, 'theOnyxCastle')
  castle.revealed = true
  castle.name = '大礼堂'
  let chosenOptions = null
  const api = apiStub(state, {
    choose: request => {
      chosenOptions = request.options.map(option => option.id)
      return request.options[request.options.length - 1].id
    },
  })
  const picked = behavior.spawnLocation(state, '06312', null, 0, api)
  assert.deepEqual([...chosenOptions].sort(), [cold.id, castle.id].sort(), '候选为冰封荒土与大礼堂')
  assert.equal(picked, castle.id, '按队长选择生成')
  assert.equal(state.scenario.enemies['06312'].prey, 'Lowest [agility]')
  assert.equal(state.scenario.enemies['06312'].hunter, true)
  // 已知缺口（见报告失败清单）：引擎 preyTarget 的排序表用 camelCase key（lowestAgility），
  // 而 definition 里是印刷短语；条目没有 enemyRule.prey 覆盖 → 猎物排序未接线。
  assert.equal(entryOf('06312').enemyRule?.prey, undefined, '缺少 lowestAgility 覆盖（缺口）')
})

test('06313 无面欺诈者：猎物「手牌最多」缺少引擎 prey 键（实现缺口已记录）', () => {
  assert.equal(stateFor().scenario.enemies['06313'].prey, 'Most cards in hand')
  assert.equal(entryOf('06313').enemyRule?.prey, undefined, '缺少 mostCardsInHand 覆盖（缺口）')
})

// ---------------------------------------------------------------------------
// 混沌低语 06314–06317
// ---------------------------------------------------------------------------

function assertWhisperDirection(whisperCode, direction) {
  const towerId = FORSAKEN_TOWER_IDS[0]
  const towerRow = FORSAKEN_TOWERS.find(entry => entry.id === towerId)
  // 方向一致：可发动。
  const matched = towerSetup(towerRow.code, { direction, whisperCode })
  assert.equal(matched.state.scenarioFlags.towerCompass[towerId], direction)
  const move = behavior.actions(matched.state, matched.inv0)
    .find(candidate => candidate.rule === `forsakenTower:${towerId}`)
  assert.ok(move, `方向一致（${direction}）时提供塔行动`)
  // 方向不一致：不可发动。
  const otherDirection = ['north', 'east', 'south', 'west'].find(item => item !== direction)
  const mismatched = towerSetup(towerRow.code, { direction: otherDirection, whisperCode })
  const blocked = behavior.actions(mismatched.state, mismatched.inv0)
    .find(candidate => candidate.rule === `forsakenTower:${towerId}`)
  assert.equal(blocked, undefined, '方向不一致时不能发动塔能力')
}

test('06314 混沌低语·北：手牌中且北塔方向一致时可激活该塔能力', () => {
  assertWhisperDirection('06314', 'north')
})

test('06315 混沌低语·东：手牌中且东塔方向一致时可激活该塔能力', () => {
  assertWhisperDirection('06315', 'east')
})

test('06316 混沌低语·南：手牌中且南塔方向一致时可激活该塔能力', () => {
  assertWhisperDirection('06316', 'south')
})

test('06317 混沌低语·西：手牌中且西塔方向一致时可激活该塔能力', () => {
  assertWhisperDirection('06317', 'west')
})

// ---------------------------------------------------------------------------
// 万千化身 06318
// ---------------------------------------------------------------------------

test('06318 万千化身：揭示手中全部奈亚拉托提普、逐张攻击并洗回遭遇牌库；真形在场上时移动并攻击', () => {
  const state = setup(stateFor())
  const inv0 = inv(state, 0)
  inv0.hand.push('06306', '06307')
  inv0.hiddenCards.push('06306', '06307')
  state.enemies.push({
    id: 'true-shape', code: '06293', originalCode: '06293', name: '奈亚拉托提普的真形',
    scenarioEnemyRole: 'nyarlathotepTrueShape', location: 'theOnyxCastle',
  })
  const api = apiStub(state)
  entryOf('06318').encounterResolve(state, inv0, ALL_CARDS['06318'], api)
  assert.ok(api.revealed.includes('06306') && api.revealed.includes('06307'), '揭示手中全部复制品')
  assert.equal(api.attacks.length, 2, '每张复制品各攻击一次')
  assert.ok(state.encounterDeck.includes('06306') && state.encounterDeck.includes('06307'), '攻击后洗回遭遇牌库')
  assert.deepEqual(api.enemyPhaseResolved, ['06293'], '真形在场上时如同敌军阶段移动并攻击')
  assert.equal(state.scenarioFlags.myriadFormsAttacked, true)
  // 已知缺口（见报告失败清单）：「若没有奈亚拉托提普因此攻击则获得涌动」没有读点：
  // 条目写的 scenarioFlags.myriadFormsAttacked 全仓没有读取方，章节也没有 encounterGainsSurge。
  assert.equal(behavior.encounterGainsSurge, undefined, '章节未接线涌动判定（缺口）')
})

// ---------------------------------------------------------------------------
// 无眠之旅 06319–06321
// ---------------------------------------------------------------------------

function assertRestlessJourney(code, skill) {
  const state = setup(stateFor())
  const inv0 = inv(state, 0)
  inv0.hand.push(code)
  inv0.hiddenCards.push(code)
  assert.equal(engine.hiddenCommitLimitReached(state, inv0), false, '尚未投入任何卡')
  engine.noteHiddenCommit(state, inv0)
  assert.equal(engine.hiddenCommitLimitReached(state, inv0), true, '隐藏期间每轮最多投入 1 张卡')
  const move = behavior.actions(state, inv0).find(candidate => candidate.rule === `restlessJourney:${code}`)
  assert.ok(move, '[fast] 弃牌检定行动')
  assert.equal(move.actions, 0)
  const testCalls = []
  const failApi = apiStub(state, {
    test: (seat, testSkill, difficulty, resolve) => {
      testCalls.push({ seat, testSkill, difficulty })
      resolve({ success: false, value: 0, difficulty, skill: testSkill })
    },
  })
  behavior.performAction(state, inv0, move, failApi)
  assert.deepEqual(testCalls.map(call => call.testSkill), [skill])
  assert.equal(testCalls[0].difficulty, 3)
  assert.equal(state.doom, 1, '失败在当前密谋放 1 毁灭')
  assert.equal(inv0.hand.includes(code), false, '弃掉无眠之旅')
  assert.equal(inv0.hiddenCards.includes(code), false)
  // 成功分支不放毁灭。
  const okState = setup(stateFor())
  const okInv = inv(okState, 0)
  okInv.hand.push(code)
  okInv.hiddenCards.push(code)
  const okMove = behavior.actions(okState, okInv).find(candidate => candidate.rule === `restlessJourney:${code}`)
  behavior.performAction(okState, okInv, okMove, apiStub(okState))
  assert.equal(okState.doom, 0)
}

test('06319 无眠之旅·谬论：隐藏期间每轮限投 1 张；[fast] 弃掉并检定智识(3)，失败在当前密谋放 1 毁灭', () => {
  assertRestlessJourney('06319', 'intellect')
})

test('06320 无眠之旅·昏迷：隐藏期间每轮限投 1 张；[fast] 弃掉并检定战斗(3)，失败在当前密谋放 1 毁灭', () => {
  assertRestlessJourney('06320', 'combat')
})

test('06321 无眠之旅·梦魇：隐藏期间每轮限投 1 张；[fast] 弃掉并检定敏捷(3)，失败在当前密谋放 1 毁灭', () => {
  assertRestlessJourney('06321', 'agility')
})

// ---------------------------------------------------------------------------
// 众神所弃 06322
// ---------------------------------------------------------------------------

test('06322 众神所弃：意志(3)失败后按差值选择不同数字，每位玩家弃掉对应印刷费用的事件/支援', () => {
  const state = setup(stateFor())
  const choices = ['1', '2']
  const api = apiStub(state, {
    choose: request => (request.kind === 'number' ? choices.shift() ?? '0' : request.options?.[0]?.id ?? 'skip'),
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: difficulty - 2, difficulty, skill }),
  })
  const inv0 = inv(state, 0)
  const inv1 = inv(state, 1)
  inv0.hand = ['06276', '01037', '01020'] // cost 1 / 2 / 3
  inv1.hand = ['01022'] // cost 1
  entryOf('06322').encounterResolve(state, inv0, ALL_CARDS['06322'], api)
  assert.deepEqual(inv0.hand, ['01020'], '费用等于所选数字 1/2 的事件与支援被弃掉，费用 3 的保留')
  assert.deepEqual(inv1.hand, [], '其他玩家同样弃掉对应费用的事件/支援')
})

// ---------------------------------------------------------------------------
// 混乱标记（06286 剧本参考卡的经验证补充）
// ---------------------------------------------------------------------------

test('06286 混乱标记表：skull 随幕/密谋编号、tablet -4/-6、cultist 再揭示一个；elderthing 读数缺口已记录', () => {
  const state = setup(stateFor())
  const inv0 = inv(state, 0)
  state.actIndex = 2 // 幕 3
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'skull').delta, -3)
  state.agendaIndex = 1 // 密谋 2
  state.difficulty = 'hard'
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'skull').delta, -(3 + 2), '困难或专家：幕编号+密谋编号')
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'tablet').delta, -6)
  const cultist = whereTheGodsDwellChaosToken(state, inv0, 'cultist')
  assert.equal(cultist.delta, 0)
  assert.equal(cultist.drawAnother, true)
  state.difficulty = 'standard'
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'tablet').delta, -4)
  // 已知缺口（见报告失败清单）：引擎抽取的实际标记 id 是 `elderthing`（tde-chaos.js 明确小写无下划线），
  // 而 chaos.js 只匹配 `elder_thing`，因此这里返回 null，引擎回落到 SYMBOL_DEFAULTS.elderthing = -3；
  // 印刷值为简单/普通 0、困难/专家 -1。本条断言锁定「当前实现未命中」的事实，不冒充正确。
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'elderthing'), null, '引擎 id 未命中（实现缺口）')
  assert.equal(whereTheGodsDwellChaosToken(state, inv0, 'elder_thing').delta, 0, '旧测试用的 id 才命中')
})
