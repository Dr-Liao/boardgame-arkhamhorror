// 05-a-3（The Secret Name · tsn 05109–05150）逐卡验收补证测试。
//
// 目的：为 `tests/tcu-secret-name.test.mjs` 里没有「标题含卡号」的 12 张卡补真实执行证据：
// 05121 / 05122 / 05123 / 05124 / 05125 / 05126 / 05127 / 05128 / 05132 / 05135 / 05148 / 05149。
// 全部走真实条目模块（agendaRule/actRule/locationRule/enemyScript/enemyStatRule 的实际读点）
// 或真实引擎路径（createGameState → debug 剧本 → debug 生成/推进议程），不做「条目存在」式断言。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { normalizeScenarioHaunted } from '../src/engine/haunted.js'
import { encounterRules } from '../content/campaigns/theCircleUndone/encounter-rules.js'
import * as secretName from '../content/campaigns/theCircleUndone/scenarios/theSecretName/index.js'
import {
  scenario as definition, NAHAB, BROWN_JENKIN, SWARM_OF_RATS,
} from '../content/campaigns/theCircleUndone/scenarios/theSecretName/definition.js'
import hermit from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05121.js'
import familiar from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05122.js'
import witchLight from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05123.js'
import marked from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05124.js'
import act1 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05125.js'
import act2 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05126.js'
import act3 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05127.js'
import walterRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05132.js'
import twilight from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05135.js'
import jenkin from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05148.js'
import nahab from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05149.js'

const clone = value => JSON.parse(JSON.stringify(value))

function setupApi() {
  let value = 7
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return { randomValue, shuffle: items => [...items] }
}

function stateFor(count = 2) {
  return {
    scenario: clone(definition), acts: clone(definition.acts), agendas: clone(definition.agendas),
    actIndex: 0, agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'moldyHalls',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: [],
    },
    chaosBag: [], difficulty: 'standard', numInvestigators: count, round: 1,
    phase: 'investigation', status: 'playing',
  }
}

function placeFromDefinition(state, id, { revealed = true } = {}) {
  const base = state.scenario.locations[id]
  if (!base) return null
  const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
  const location = { ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 }
  state.locations.push(location)
  return location
}

// 与章节 setup 相同的地点布置（真实 behavior.setupLocations 生成 zone 数据）。
function setup(state) {
  secretName.behavior.setupLocations(state, [], setupApi())
  for (const id of ['moldyHalls', 'walterGilmansRoom', 'landlordsQuarters', 'joeMazurewiczsRoom', 'frankElwoodsRoom']) {
    placeFromDefinition(state, id, { revealed: id === 'moldyHalls' })
  }
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

// 区域原语替身：与 src/engine/scenario-runtime.js 同语义（真实读写 state 数组）。
function zoneStub(state) {
  return {
    // 与引擎同名 API 同语义：读点是快照副本（src/engine/scenario-runtime.js:2181-2182），
    // 取出/移动只经 take* 原语。
    encounterDeckCards: () => [...state.encounterDeck],
    encounterDiscardCards: () => [...state.encounterDiscard],
    takeEncounterDeckCard: code => {
      const index = state.encounterDeck.indexOf(code)
      if (index < 0) return null
      return state.encounterDeck.splice(index, 1)[0]
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.indexOf(code)
      if (index < 0) return null
      return state.encounterDiscard.splice(index, 1)[0]
    },
    takeEncounterCard: code => {
      for (const pile of [state.encounterDiscard, state.encounterDeck]) {
        const index = pile.indexOf(code)
        if (index >= 0) return pile.splice(index, 1)[0]
      }
      return null
    },
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: codes => {
      const list = Array.isArray(codes) ? codes : [codes]
      state.encounterDeck.push(...list)
      return list
    },
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value === undefined || value === null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
      return state.scenarioFlags[key] ?? null
    },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
  }
}

function collectorApi(state, overrides = {}) {
  const calls = []
  let counter = 0
  const api = {
    calls,
    info: text => calls.push(['info', text]),
    choose: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    spawn: (code, locationId) => {
      const enemy = { id: `spawn${++counter}`, code, originalCode: code, name: code, location: locationId,
        doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null, traits: [] }
      state.enemies.push(enemy)
      calls.push(['spawn', code, locationId])
      return enemy
    },
    place: id => {
      const placed = placeFromDefinition(state, id, { revealed: false })
      calls.push(['place', id])
      return placed
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination; calls.push(['moveEnemy', enemy.code, destination]) },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    doomOn: (card, amount) => {
      if (!card) return 0
      card.doom = (card.doom || 0) + amount
      calls.push(['doomOn', card.originalCode || card.code, amount])
      return amount
    },
    removeDoom: amount => { state.doom = Math.max(0, (state.doom || 0) - amount); calls.push(['removeDoom', amount]) },
    clearDoomOnCard: card => { if (card) card.doom = 0 },
    setEnemyAside: enemy => {
      state.enemies = state.enemies.filter(candidate => candidate !== enemy)
      calls.push(['setEnemyAside', enemy.code])
      return true
    },
    giveAsset: (seat, code) => { state.investigators[seat].assets.push({ id: `asset:${code}`, code }); calls.push(['giveAsset', seat, code]) },
    swapLocation: (fromId, toId, options) => { calls.push(['swapLocation', fromId, toId, options]); return { id: toId } },
    removeLocationFromGame: id => { calls.push(['removeLocationFromGame', id]); return true },
    finish: key => { calls.push(['finish', key]); return true },
    advanceAct: () => { calls.push(['advanceAct']); return true },
    drawCards: (seat, amount) => { calls.push(['drawCards', seat, amount]) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    discardRandom: (seat, amount) => { calls.push(['discardRandom', seat, amount]) },
    test: (seat, skill, difficulty, resolve) => {
      const result = overrides.testResult || { success: false, value: 0, difficulty, skill }
      calls.push(['test', seat, skill, difficulty])
      resolve(result)
      return result
    },
    payClues: (amount, locationId) => { calls.push(['payClues', amount, locationId]); return true },
    ...zoneStub(state),
    shuffleIntoEncounterDeck: codes => {
      calls.push(['shuffleIntoEncounterDeck', codes])
      const list = Array.isArray(codes) ? codes : [codes]
      state.encounterDeck.push(...list)
      return list
    },
    ...overrides,
  }
  return api
}

const enemyAt = (state, code, location) => {
  const enemy = { id: `manual-${state.enemies.length + 1}`, code, originalCode: code, name: code,
    location, doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null, traits: [] }
  state.enemies.push(enemy)
  return enemy
}

// ---------------------------------------------------------------------------
// 批次 2：幕 / 密谋 / 场景（05120–05127）
// ---------------------------------------------------------------------------

test('验收 05121 隐士·IX：背面按詹金是否在场找出鼠群/詹金，3–4 人局追加巫宅鼠群', () => {
  const state = setup(stateFor(3))
  state.enemies = []
  const jenkinInPlay = enemyAt(state, BROWN_JENKIN, 'joeMazurewiczsRoom')
  state.encounterDeck = [SWARM_OF_RATS, '02007', SWARM_OF_RATS]
  state.encounterDiscard = []
  const api = collectorApi(state)
  assert.equal(hermit.agendaRule.onReveal(state, { originalCode: '05121' }, api), true)
  const spawns = api.calls.filter(call => call[0] === 'spawn')
  assert.deepEqual(spawns[0], ['spawn', SWARM_OF_RATS, 'joeMazurewiczsRoom'], '詹金在场：鼠群生成在他所在地点')
  assert.equal(spawns.length, 2, '3 人局再找 1 张鼠群')
  assert.ok(['moldyHalls', 'walterGilmansRoom'].includes(spawns[1][2]), '第二张鼠群生成在巫宅地点')
  assert.equal(jenkinInPlay.location, 'joeMazurewiczsRoom')

  // 詹金不在场：找出詹金生成在队长地点。
  const state2 = setup(stateFor(2))
  state2.enemies = []
  state2.encounterDeck = [BROWN_JENKIN]
  state2.encounterDiscard = []
  const api2 = collectorApi(state2)
  hermit.agendaRule.onReveal(state2, { originalCode: '05121' }, api2)
  const spawns2 = api2.calls.filter(call => call[0] === 'spawn')
  assert.deepEqual(spawns2[0], ['spawn', BROWN_JENKIN, 'moldyHalls'], '詹金不在场：找出他生成在队长地点')
})

test('验收 05122 魔宠：背面按幕放置那赫卜、洗入 2 张鬼影骤现并把詹金放到那赫卜处', () => {
  const state = setup(stateFor(2))
  state.encounterDeck = [BROWN_JENKIN]
  state.encounterDiscard = []
  const api = collectorApi(state)
  assert.equal(familiar.agendaRule.onReveal(state, { originalCode: '05122' }, api), true)
  const nahabSpawn = api.calls.find(call => call[0] === 'spawn' && call[1] === NAHAB)
  assert.deepEqual(nahabSpawn, ['spawn', NAHAB, 'walterGilmansRoom'], '幕 1：那赫卜生成在沃尔特房间')
  assert.equal(state.encounterDeck.filter(code => code === '05144').length, 2, '2 张鬼影骤现洗入遭遇牌库')
  assert.ok(state.scenarioZones.setAside.includes('05144') === false, '鬼影骤现从放一边取出')
  const jenkinSpawn = api.calls.find(call => call[0] === 'spawn' && call[1] === BROWN_JENKIN)
  assert.deepEqual(jenkinSpawn, ['spawn', BROWN_JENKIN, 'walterGilmansRoom'], '詹金被放到那赫卜所在地点')

  // 幕 3：那赫卜在场 → 放 1 毁灭。
  const state3 = setup(stateFor(2))
  state3.actIndex = 2
  const inPlay = enemyAt(state3, NAHAB, 'moldyHalls')
  const api3 = collectorApi(state3)
  familiar.agendaRule.onReveal(state3, { originalCode: '05122' }, api3)
  assert.deepEqual(api3.calls.find(call => call[0] === 'doomOn'), ['doomOn', NAHAB, 1])
  assert.equal(inPlay.doom, 1)
})

test('验收 05123 巫异光芒：非幕 3 把那赫卜放回场外并给密谋 4a 预留 4 毁灭；幕 3 放 1 毁灭', () => {
  const state = setup(stateFor(2))
  const nahabInPlay = enemyAt(state, NAHAB, 'moldyHalls')
  const api = collectorApi(state)
  assert.equal(witchLight.agendaRule.onReveal(state, { originalCode: '05123' }, api), true)
  assert.deepEqual(api.calls.find(call => call[0] === 'setEnemyAside'), ['setEnemyAside', NAHAB])
  assert.deepEqual(state.scenarioFlags.pendingAgendaDoom, { code: '05124', amount: 4 })
  // 05124 成为当前议程的同一结算里放 4 毁灭（behavior.agendaChain 读点）。
  const agenda4 = { originalCode: '05124', code: '05124', doom: 0 }
  secretName.behavior.agendaChain(state, agenda4, api)
  assert.equal(agenda4.doom, 4)
  assert.equal(state.scenarioFlags.pendingAgendaDoom, undefined, '预留标记只消费一次')

  const state3 = setup(stateFor(2))
  state3.actIndex = 2
  const inPlay = enemyAt(state3, NAHAB, 'moldyHalls')
  const api3 = collectorApi(state3)
  witchLight.agendaRule.onReveal(state3, { originalCode: '05123' }, api3)
  assert.equal(inPlay.doom, 1, '幕 3：那赫卜放 1 个毁灭')
  assert.equal(state3.scenarioFlags.pendingAgendaDoom, undefined)
})

test('验收 05124 献祭标志：背面结束剧本走结局 1', () => {
  const state = setup(stateFor(2))
  const api = collectorApi(state)
  assert.equal(marked.agendaRule.onReveal(state, { originalCode: '05124' }, api), true)
  assert.deepEqual(api.calls.find(call => call[0] === 'finish'), ['finish', 'resolution1'])
})

test('验收 05125 探访巫宅：背面换入凯夏的房间、移除其他地点、交黑书、洗入 2 张古怪图形', () => {
  const state = setup(stateFor(2))
  state.scenarioZones.setAside = ['05150', '05142', '05142']
  const api = collectorApi(state)
  assert.equal(act1.actRule.onReveal(state, { originalCode: '05125' }, api), true)
  assert.deepEqual(api.calls.find(call => call[0] === 'swapLocation'),
    ['swapLocation', 'walterGilmansRoom', 'keziahsRoom', { reveal: 'revealed' }])
  const removed = api.calls.filter(call => call[0] === 'removeLocationFromGame').map(call => call[1])
  assert.ok(removed.includes('moldyHalls') && !removed.includes('keziahsRoom'), '移出其他所有地点、保留凯夏的房间')
  assert.deepEqual(api.calls.find(call => call[0] === 'giveAsset'), ['giveAsset', 0, '05150'], '黑书交给选中的调查员')
  assert.deepEqual(api.calls.filter(call => call[0] === 'shuffleIntoEncounterDeck').at(-1),
    ['shuffleIntoEncounterDeck', ['05142', '05142']])
  assert.equal(state.scenarioFlags.blackBookSeat, 0)
})

test('验收 05126 巫宅之外：目标只允许巫宅遗址团队付线索；背面放置献祭场所与那赫卜/詹金', () => {
  // 幕数据：act2 的 advanceRule（behavior.actions 通用读点）。
  const actDef = definition.acts.find(act => act.originalCode === '05126')
  assert.deepEqual(actDef.advanceRule, {
    rule: 'advanceBeyondTheWitchHouse', perInvestigator: 5, payAtLocationId: 'witchHouseRuins',
    label: '🏚️ 巫宅遗址的调查员共同花费 {required} 个线索推进场景（巫宅之外）',
  })
  const state = setup(stateFor(2))
  state.actIndex = 1
  state.encounterDeck = [BROWN_JENKIN]
  state.encounterDiscard = []
  placeFromDefinition(state, 'witchHouseRuins')
  state.scenarioZones.setAside = [NAHAB]
  const api = collectorApi(state)
  assert.equal(act2.actRule.onReveal(state, { originalCode: '05126' }, api), true)
  assert.ok(loc(state, 'siteOfTheSacrifice'), '献祭场所入场')
  const nahabSpawn = api.calls.find(call => call[0] === 'spawn' && call[1] === NAHAB)
  assert.deepEqual(nahabSpawn, ['spawn', NAHAB, 'siteOfTheSacrifice'])
  const nahabState = state.enemies.find(entry => entry.code === NAHAB)
  assert.equal(nahabState.doom, 2, '密谋 1–3：那赫卜放 2 个毁灭')
  assert.ok(state.enemies.some(entry => entry.code === BROWN_JENKIN && entry.location === 'siteOfTheSacrifice'),
    '詹金被放到那赫卜所在地点')

  // 密谋 4：把密谋 4a 上的毁灭移到那赫卜。
  const state4 = setup(stateFor(2))
  state4.actIndex = 1
  state4.agendaIndex = 3
  state4.doom = 2
  state4.encounterDeck = []
  state4.encounterDiscard = []
  placeFromDefinition(state4, 'witchHouseRuins')
  state4.scenarioZones.setAside = [NAHAB]
  const api4 = collectorApi(state4)
  act2.actRule.onReveal(state4, { originalCode: '05126' }, api4)
  const nahab4 = state4.enemies.find(entry => entry.code === NAHAB)
  assert.equal(nahab4.doom, 2, '密谋 4：当前议程毁灭移到那赫卜（2）')
  assert.equal(state4.doom, 0)
})

test('验收 05127 阻止仪式：背面结局 2；幕 3 那赫卜被击败不弃掉并本轮不重整；无毁灭推进', () => {
  const state = setup(stateFor(2))
  const api = collectorApi(state)
  assert.equal(act3.actRule.onReveal(state, { originalCode: '05127' }, api), true)
  assert.deepEqual(api.calls.find(call => call[0] === 'finish'), ['finish', 'resolution2'])

  const state3 = setup(stateFor(2))
  state3.actIndex = 2
  const nahabInPlay = enemyAt(state3, NAHAB, 'siteOfTheSacrifice')
  nahabInPlay.damageTaken = 4
  nahabInPlay.engagedSeat = 0
  state3.investigators[0].engaged = [nahabInPlay.id]
  secretName.behavior.enemyDefeated(state3, nahabInPlay, collectorApi(state3))
  assert.equal(nahabInPlay.damageTaken, 0, '治愈全部伤害')
  assert.equal(nahabInPlay.exhausted, true, '横置')
  assert.deepEqual(nahabInPlay.preventReady, { from: 1, rounds: 1 }, '本轮补给阶段不重整')
  assert.equal(nahabInPlay.immobile, true, '不能离开献祭场所')
  assert.ok(state3.enemies.includes(nahabInPlay), '不弃掉')
  assert.deepEqual(state3.investigators[0].engaged, [], '解除交战')

  // 目标：那赫卜无毁灭 → 推进。
  state3.actIndex = 2
  const api3 = collectorApi(state3)
  state3.enemies = [nahabInPlay]
  secretName.behavior.checkObjectives(state3, api3)
  assert.ok(api3.calls.some(call => call[0] === 'advanceAct'), '无毁灭时推进幕')
})

// ---------------------------------------------------------------------------
// 批次 3：地点（05128 / 05132 / 05135）
// ---------------------------------------------------------------------------

test('验收 05128 发霉的走道：闹鬼「失去 3 资源」是引擎 haunted 加载器可结算的闭集子句', () => {
  assert.equal(definition.locations.moldyHalls.code, '05128')
  const normalized = normalizeScenarioHaunted(definition.locations)
  const ability = normalized.moldyHalls[0]
  assert.match(ability.text, /失去 3 资源/)
  assert.deepEqual(ability.effect, [{ kind: 'loseResource', amount: 3 }])
  // 读点存在：该地点的闹鬼能力可由引擎按 locationId 取出。
  assert.deepEqual(normalized.moldyHalls[0].effect[0], { kind: 'loseResource', amount: 3 })
})

test('验收 05131 弗兰克·埃尔伍德的房间：闹鬼「放线索或密谋放毁灭」是合法的 choice 子句', () => {
  assert.equal(definition.locations.frankElwoodsRoom.code, '05131')
  const normalized = normalizeScenarioHaunted(definition.locations)
  const ability = normalized.frankElwoodsRoom[0]
  assert.equal(ability.effect[0].kind, 'choice')
  assert.deepEqual(ability.effect[0].options.map(option => option.id), ['placeClue', 'agendaDoom'])
  assert.deepEqual(ability.effect[0].options[1].effect, [{ kind: 'doom', target: 'agenda', amount: 1 }])
})

test('验收 05132 沃尔特·吉尔曼的房间：锁门收费、进入付费、每名调查员每场一次抽 3 受 1 恐惧', () => {
  const state = setup(stateFor(2))
  const room = loc(state, 'walterGilmansRoom')
  // 锁门：发霉的走道上的调查员合计线索不足人数 → 拒绝进入。
  state.investigators[0].location = 'moldyHalls'
  state.investigators[0].clues = 1
  state.investigators[1].location = 'moldyHalls'
  state.investigators[1].clues = 0
  assert.match(walterRoom.locationRule.entryError(state, room, state.investigators[0]), /锁着/)
  // 线索足够 → 无错误，并进入时付费。
  state.investigators[0].clues = 2
  assert.equal(walterRoom.locationRule.entryError(state, room, state.investigators[0]), null)
  state.investigators[0].location = 'moldyHalls'
  const api = collectorApi(state)
  walterRoom.locationRule.beforeEnter(state, room, state.investigators[0], api)
  assert.deepEqual(api.calls.find(call => call[0] === 'payClues'), ['payClues', 2, 'moldyHalls'])
  // [action] 每名调查员每场一次：抽 3 张并受 1 点恐惧。
  state.investigators[0].location = 'walterGilmansRoom'
  const moves = []
  walterRoom.locationRule.actions({ moves, state, inv: state.investigators[0], location: room })
  assert.deepEqual(moves.map(move => move.rule), ['walterDrawCards'])
  const api2 = collectorApi(state)
  assert.equal(walterRoom.locationRule.performAction(state, state.investigators[0], moves[0], api2), true)
  assert.deepEqual(api2.calls.find(call => call[0] === 'drawCards'), ['drawCards', 0, 3])
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.scenarioFlags.walterDrawUsedBySeat[0], true)
  const movesAfter = []
  walterRoom.locationRule.actions({ moves: movesAfter, state, inv: state.investigators[0], location: room })
  assert.deepEqual(movesAfter, [], '同一调查员每场游戏只能使用一次')
})

test('验收 05135 暮光深渊：进入后检定战斗或敏捷(3)，失败每差 1 点受 1 伤害', () => {
  assert.equal(twilight.locationRule.onEnter.effect !== undefined, true, '强制进入效果是声明的读点')
  const state = setup(stateFor(2))
  placeFromDefinition(state, 'twilightAbyss')
  const location = loc(state, 'twilightAbyss')
  state.investigators[0].location = 'twilightAbyss'
  const api = collectorApi(state, {
    choose: () => 'agility',
    testResult: { success: false, value: 1, difficulty: 3, skill: 'agility' },
  })
  twilight.locationRule.onEnter.effect(state, location, api, state.investigators[0])
  assert.deepEqual(api.calls.find(call => call[0] === 'test'), ['test', 0, 'agility', 3], 'combat 或 agility 二选一检定')
  assert.equal(state.investigators[0].damage, 2, '失败 2 点差 → 2 点伤害')

  const stateOk = setup(stateFor(2))
  placeFromDefinition(stateOk, 'twilightAbyss')
  stateOk.investigators[0].location = 'twilightAbyss'
  const apiOk = collectorApi(stateOk, {
    choose: () => 'combat',
    testResult: { success: true, value: 3, difficulty: 3, skill: 'combat' },
  })
  twilight.locationRule.onEnter.effect(stateOk, loc(stateOk, 'twilightAbyss'), apiOk, stateOk.investigators[0])
  assert.equal(stateOk.investigators[0].damage, 0, '检定成功不受伤害')
})

// ---------------------------------------------------------------------------
// 批次 4：敌人（05148 / 05149）
// ---------------------------------------------------------------------------

test('验收 05148 布朗·詹金：重整生物敌人 +2 攻击；敌军阶段结束弃手牌再抽等量', () => {
  const state = setup(stateFor(2))
  const jenkinEnemy = enemyAt(state, BROWN_JENKIN, 'moldyHalls')
  const creature = enemyAt(state, SWARM_OF_RATS, 'moldyHalls')
  assert.equal(encounterRules.enemyStatModifier(state, creature, 'fight'), 2, '重整的鼠群（生物）+2 攻击')
  creature.exhausted = true
  assert.equal(encounterRules.enemyStatModifier(state, creature, 'fight'), 0, '横置的生物不吃光环')
  creature.exhausted = false
  const humanoid = enemyAt(state, '05095', 'moldyHalls')
  assert.equal(encounterRules.enemyStatModifier(state, humanoid, 'fight'), 0, '非生物敌人不 +2')
  assert.equal(jenkinEnemy.location, 'moldyHalls')

  // 敌军阶段结束：本地每位调查员弃掉手牌再抽等量。
  state.investigators[0].location = 'moldyHalls'
  state.investigators[0].hand = ['01020', '01021', '01022']
  const api = collectorApi(state)
  jenkin.enemyScript.onEnemyPhaseEnd(state, jenkinEnemy, api)
  assert.deepEqual(api.calls.find(call => call[0] === 'discardRandom'), ['discardRandom', 0, 3])
  assert.deepEqual(api.calls.find(call => call[0] === 'drawCards'), ['drawCards', 0, 3])
  // 横置时不触发。
  jenkinEnemy.exhausted = true
  const api2 = collectorApi(state)
  jenkin.enemyScript.onEnemyPhaseEnd(state, jenkinEnemy, api2)
  assert.equal(api2.calls.some(call => call[0] === 'discardRandom'), false)
  assert.equal(jenkin.enemyRule.aloof && jenkin.enemyRule.hunter, true, '冷漠 + 猎手')
})

test('验收 05149 那赫卜：攻击 + 当前密谋编号；重整时敌军阶段开始放毁灭；密谋推进不移除毁灭（真实引擎）', () => {
  const state = setup(stateFor(2))
  state.agendaIndex = 0
  const nahabEnemy = enemyAt(state, NAHAB, 'moldyHalls')
  assert.equal(encounterRules.enemyStatModifier(state, nahabEnemy, 'fight'), 1, '密谋 1：+1 攻击')
  state.agendaIndex = 2
  assert.equal(encounterRules.enemyStatModifier(state, nahabEnemy, 'fight'), 3, '密谋 3：+3 攻击')
  assert.equal(encounterRules.enemyStatModifier(state, nahabEnemy, 'evade'), 0)
  assert.equal(nahab.enemyRule.hunter && nahab.enemyRule.retaliate, true, '猎手 + 反击')

  // 敌军阶段开始若重整：放 1 毁灭。
  state.agendaIndex = 0
  const api = collectorApi(state)
  nahab.enemyScript.onEnemyPhaseStart(state, nahabEnemy, api)
  assert.equal(nahabEnemy.doom, 1)
  nahabEnemy.exhausted = true
  const api2 = collectorApi(state)
  nahab.enemyScript.onEnemyPhaseStart(state, nahabEnemy, api2)
  assert.equal(nahabEnemy.doom, 1, '横置时不放毁灭')

  // 真实引擎：密谋推进时不移除那赫卜身上的毁灭（doomKeptOnAgendaAdvance 引擎读点）。
  const engine = createGameState({ campaignId: 'theCircleUndone', campaignHub: true, seed: 'tsn-05149' }, [{ seat: 0, role: 'human' }])
  applyMove(engine, 0, { action: 'debug', kind: 'scenario', scenarioId: 'theSecretName' })
  settleEngine(engine)
  applyMove(engine, engine.currentSeat, { action: 'debug', kind: 'spawn', code: NAHAB, targetSeat: engine.currentSeat })
  settleEngine(engine)
  const spawned = engine.enemies.find(entry => String(entry.originalCode || entry.code) === NAHAB)
  assert.ok(spawned, '真实引擎生成那赫卜')
  spawned.doom = 2
  applyMove(engine, engine.currentSeat, { action: 'debug', kind: 'advanceAgenda' })
  settleEngine(engine)
  assert.equal(engine.agendaIndex, 1, '真实引擎推进到下一张密谋')
  const after = engine.enemies.find(entry => String(entry.originalCode || entry.code) === NAHAB)
  assert.equal(after.doom, 2, '密谋推进后那赫卜的毁灭保留')
})

// 真实引擎的待决选择清理（与 tests/tcu-chapters-smoke.test.mjs 同口径）。
const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']
function settleEngine(state, guardMax = 100) {
  let guard = 0
  while (state.pendingChoice && guard++ < guardMax) {
    const pending = state.pendingChoice
    const options = pending.options || []
    if (!options.length) break
    const optionId = SAFE_IDS.map(id => options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)?.id
      ?? options[0].id
    try {
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
    } catch {
      try { resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => current) } catch { break }
    }
  }
  return state.pendingChoice || null
}
