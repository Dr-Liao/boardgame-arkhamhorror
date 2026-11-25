// 验收 06-a · 食梦者 · 分片 5（tsh，06155–06194）的逐卡证据测试。
//
// 覆盖本分片「既有证据只是文件级/数据一致性」的 25 张战役卡与场景参考卡：
//   06168（场景参考卡：混乱标记数值与失败后果）
//   06169a / 06169b（议程 I 背面生成不可名状之物 / 敌人规则组）
//   06170 / 06171（议程 II/III：蜂拥授予、敌人关键词、轮末/背面）
//   06172 / 06173（幕 I 流程分派 / 幕 II 目标与撤退）
//   06175–06188（地点规则；06174 既有标题证据，见 artifacts/acceptance/06-a-5/probe-defects.mjs）
//   06191–06194（诡计：威胁区、轮末、强制、旁置）
//
// 口径与 tests/tde-scenario-aThousandShapesOfHorror.test.mjs 一致：真实条目/真实章节 behavior
// + 同语义 api 替身（存档结构不受影响）。不改既有 tests/src/content；登记进 suites 由主进程完成。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/engine/engine.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/behavior.js'
import { scenario as definition, STAIRS_IDS } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/definition.js'
import { tshChaosToken, tshChaosAfterTest } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

import act06172 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06172.js'
import act06173 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06173.js'
import location06175 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06175.js'
import location06176 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06176.js'
import location06177 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06177.js'
import location06178 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06178.js'
import location06179 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06179.js'
import location06180 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06180.js'
import location06181 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06181.js'
import location06182 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06182.js'
import location06183 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06183.js'
import location06184 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06184.js'
import location06185 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06185.js'
import location06186 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06186.js'
import location06187 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06187.js'
import location06188 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06188.js'
import asset06189 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06189.js'
import treachery06191 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06191.js'
import treachery06192 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06192.js'
import treachery06193 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06193.js'
import treachery06194 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06194.js'

const CLONE = value => JSON.parse(JSON.stringify(value))
const THE_UNNAMABLE = '06169b'
const ACT_CARD = '06172'

function createState (overrides = {}) {
  const state = {
    scenario: CLONE(definition),
    acts: CLONE(definition.acts),
    agendas: CLONE(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    doom: 0,
    investigators: [
      { seat: 0, id: 'inv0', code: '06001', name: '调查员一', location: 'burialGround', damage: 0, horror: 0,
        clues: 2, resources: 5, hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false, willpower: 2, intellect: 3, combat: 4, agility: 1 },
      { seat: 1, id: 'inv1', code: '06002', name: '调查员二', location: 'burialGround', damage: 0, horror: 0,
        clues: 2, resources: 5, hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false, willpower: 3, intellect: 2, combat: 2, agility: 3 },
    ],
    locations: [],
    enemies: [],
    storyAssets: [],
    agendaAside: [],
    scenarioFlags: {},
    scenarioZones: { setAside: [] },
    victoryDisplay: [],
    encounterDeck: ['06191', '06192', '06193', '06194', '01159'],
    encounterDiscard: [],
    removedFromGame: [],
    campaign: { leadSeat: 0, records: {}, investigators: [{ deck: [] }, { deck: [] }], chaosBag: [] },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: 2,
    round: 1,
    phase: 'investigation',
    currentSeat: 0,
    turnSerial: 1,
    status: 'playing',
    investigatorCounters: {},
  }
  return Object.assign(state, overrides)
}

function placeAllLocations (state) {
  for (const location of Object.values(state.scenario.locations)) {
    if (state.locations.some(item => item.id === location.id)) continue
    state.locations.push({ ...CLONE(location), id: location.id, revealed: false, clues: 0, doom: 0,
      connections: [...(location.connections || [])] })
  }
  return state
}

function createApi (state, overrides = {}) {
  const api = {
    info: () => {},
    choice: request => request?.options?.[0]?.id ?? null,
    choose: request => api.choice(request),
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, drawn: [], source: null }),
    payClues: (n, locationId) => {
      const payers = (state.investigators || []).filter(inv => !locationId || inv.location === locationId)
      let remaining = n
      for (const inv of payers) {
        const paid = Math.min(remaining, inv.clues)
        inv.clues -= paid
        remaining -= paid
      }
      assert.equal(remaining, 0, 'stub 支付失败：线索不足')
    },
    loseActions: (seat, n) => {
      const inv = state.investigators[seat]
      if (inv) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - n)
    },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    discoverClue: seat => {
      const inv = state.investigators[seat]
      const location = state.locations.find(item => item.id === inv.location)
      if (location && location.clues > 0) { location.clues -= 1; inv.clues += 1 }
    },
    discardFromHand: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv.hand.indexOf(code)
      if (index < 0) return false
      inv.hand.splice(index, 1)
      inv.discard.push(code)
      return true
    },
    discardChosen: (seat, n) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < n && inv.hand.length; index++) inv.discard.push(inv.hand.pop())
    },
    removeThreat: card => {
      for (const inv of state.investigators) inv.threat = inv.threat.filter(item => item !== card)
    },
    threat: (seat, code) => {
      const card = { id: `threat-${code}`, code, originalCode: code, name: code }
      state.investigators[seat].threat.push(card)
      return card
    },
    markLocationCounter: (id, key, amount) => {
      const location = state.locations.find(item => item.id === id)
      if (location) location[key] = Math.max(0, (location[key] || 0) + amount)
      return location?.[key] ?? 0
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, location,
        damageTaken: 0, exhausted: false, defeated: false, engagedSeat: null, doom: 0, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    place: id => {
      const def = state.scenario.locations[id] || Object.values(state.scenario.locations).find(item => item.id === id)
      if (!def || state.locations.some(item => item.id === id)) return null
      const location = { ...CLONE(def), id: def.id || id, revealed: false, clues: 0, doom: 0,
        connections: [...(def.connections || [])] }
      state.locations.push(location)
      return location
    },
    reveal: id => { const location = state.locations.find(item => item.id === id); if (location) location.revealed = true },
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(String(code))
      if (index >= 0) list.splice(index, 1)
      return index >= 0
    },
    discardEncounterCard: (code, options = {}) => {
      const deckIndex = state.encounterDeck.lastIndexOf(String(code))
      if (deckIndex >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(deckIndex, 1)[0]); return true }
      if (options.includeDiscard === true) {
        const index = state.encounterDiscard.lastIndexOf(String(code))
        if (index >= 0) { state.encounterDiscard.splice(index, 1); return true }
      }
      return false
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.lastIndexOf(String(code))
      if (index >= 0) { state.encounterDiscard.splice(index, 1); return true }
      return false
    },
    shuffleEncounterDeck: () => {},
    shuffleDiscard: () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] },
    advanceAct: () => { state.actAdvanced = (state.actAdvanced || 0) + 1 },
    finish: key => { state.finishedWith = key },
    resign: seat => { state.investigators[seat].resigned = true },
    removeLocationFromGame: id => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return null
      state.locations = state.locations.filter(item => item.id !== id)
      state.removedFromGame.push(location.originalCode || location.code)
      return location
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); return state.encounterDeck.length },
    clearEnemyAloof: enemy => { enemy.aloof = false },
    swarm: { place: (enemy, amount) => Array.from({ length: amount }, () => ({ code: '01159' })) },
    putNextToAgenda: code => {
      const card = { id: `aside-${code}`, code, originalCode: code }
      state.agendaAside.push(card)
      return card
    },
    attack: (enemy, inv) => { api.__attacks = (api.__attacks || 0) + 1; void inv },
    evadeEnemy: enemy => { enemy.evaded = true },
  }
  return Object.assign(api, overrides)
}

const byCode = code => ({ id: code, code, originalCode: code })
const here = (state, inv) => state.locations.find(location => location.id === inv.location)

// ---------------------------------------------------------------------------
// 06168 场景参考卡：混乱标记数值（含坟地/困难面）与失败后果
// ---------------------------------------------------------------------------
test('06-a5 06168 万千骇形：混乱标记数值与 [skull]/[elder_thing]/[tablet] 后果', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.burialGround), id: 'burialGround', revealed: true, traits: ['Graveyard'] })
  const inv = state.investigators[0]
  assert.equal(tshChaosToken(state, inv, 'skull'), -3, '标准难度位于[[墓地]]：skull -3')
  assert.equal(tshChaosToken(state, inv, 'tablet'), 2, '标准难度 tablet +2')
  assert.equal(tshChaosToken(state, inv, 'elder_thing'), -2, '标准难度 elder_thing -2')
  inv.location = 'frontPorchEntryway'
  state.locations.push({ ...CLONE(definition.locations.frontPorchEntryway), id: 'frontPorchEntryway', revealed: true, traits: [] })
  assert.equal(tshChaosToken(state, inv, 'skull'), -1, '非墓地地点 skull -1')
  state.difficulty = 'hard'
  assert.equal(tshChaosToken(state, inv, 'skull'), -2, '困难面非墓地 skull -2')
  assert.equal(tshChaosToken(state, inv, 'tablet'), 1, '困难面 tablet +1')
  assert.equal(tshChaosToken(state, inv, 'elder_thing'), -3, '困难面 elder_thing -3')

  // [elder_thing] 失败：把 1 个线索放到所在地点，或受到 1 点伤害。
  const api = createApi(state, { choice: request => request.options.find(option => option.id === 'damage')?.id })
  inv.clues = 2
  const result = { success: false, value: 1, difficulty: 3, drawn: ['elder_thing'], source: null }
  tshChaosAfterTest(state, inv, result, api)
  assert.equal(inv.damage, 1, '[elder_thing] 失败选择伤害：受到 1 点伤害')
  assert.equal(inv.clues, 2, '选择伤害时不丢线索')

  // [tablet] 成功：躲避任意地点攻击值不超过成功点数的敌人。
  const unnamable = { id: 'foe', code: '06169b', originalCode: '06169b', name: '不可名状之物', location: 'burialGround', fight: 2, defeated: false }
  state.enemies.push(unnamable)
  const tabletApi = createApi(state, {
    choice: request => request.options.find(option => option.id === 'foe')?.id,
    enemyFight: enemy => enemy.fight,
  })
  const success = { success: true, value: 6, difficulty: 4, drawn: ['tablet'], source: null }
  tshChaosAfterTest(state, inv, success, tabletApi)
  assert.equal(unnamable.evaded, true, '[tablet] 成功：按成功点数躲避敌人')
})

// ---------------------------------------------------------------------------
// 06169a 议程 I 背面：阁楼不在场时把不可名状之物生成在「楼上的走廊」
// ---------------------------------------------------------------------------
test('06-a5 06169a 无名之屋：议程 I 背面生成不可名状之物（阁楼不在场→楼上的走廊）', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.upstairsHallway), id: 'upstairsHallway', revealed: false })
  const api = createApi(state)
  const handled = behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(handled, true, '议程 I 背面的生成指示应被结算')
  assert.equal(state.enemies.length, 1, '生成 1 个敌人')
  assert.equal(state.enemies[0].code, '06169b', '生成的是不可名状之物')
  assert.equal(state.enemies[0].location, 'upstairsHallway', '生成在楼上的走廊')
})

// ---------------------------------------------------------------------------
// 06169b 不可名状之物：不能被击败；记住的事实时每项 -1 攻击/-1 躲避；生成指示
// ---------------------------------------------------------------------------
test('06-a5 06169b 不可名状之物：不能被击败 + 记住事实各 -1 攻击/躲避 + 生成指示', () => {
  // 「不能被击败」由 TDE card-data 把 enemyRule 并进定义（content/.../card-data.js:320），引擎读 def.cannotBeDefeated。
  const definition46169b = Object.values(definition.locations).length > 0
  assert.equal(definition46169b, true)
  const state = createState()
  state.enemies.push({ id: 'unnamable', code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    fight: 5, evade: 5, damageTaken: 0, exhausted: false, defeated: false })
  const enemy = state.enemies[0]
  assert.equal(behavior.enemyStatModifier(state, enemy, 'fight'), 0, '没有记住事实时无修正')
  state.scenarioFlags.remembered = ['foundACrackedMirror']
  assert.equal(behavior.enemyStatModifier(state, enemy, 'fight'), -1, '1 条事实：攻击 -1')
  assert.equal(behavior.enemyStatModifier(state, enemy, 'evade'), -1, '1 条事实：躲避 -1')
  state.scenarioFlags.remembered.push('studiedADesecratedPortrait', 'noticedTheMissingBones')
  assert.equal(behavior.enemyStatModifier(state, enemy, 'fight'), -3, '3 条事实：攻击 -3')
  // 生成指示：阁楼/楼上的走廊里选在场者。
  state.locations.push({ ...CLONE(definition.locations.upstairsHallway), id: 'upstairsHallway', revealed: false })
  assert.equal(behavior.spawnLocation(state, THE_UNNAMABLE, 'frontPorchEntryway'), 'upstairsHallway', '生成到楼上的走廊')
  // 「不能被击败」：TDE card-data 把条目 enemyRule 并进场景定义，引擎读 def.cannotBeDefeated。
  assert.equal(definition.enemies[THE_UNNAMABLE].cannotBeDefeated, true, '场景定义带 cannotBeDefeated（内容层合并读点）')
  assert.equal(definition.enemies[THE_UNNAMABLE].fight, 5, '印刷攻击值 5')
  assert.equal(definition.enemies[THE_UNNAMABLE].evade, 5, '印刷躲避值 5')
})

// ---------------------------------------------------------------------------
// 06170 议程 II：每张鼠群获得蜂拥 1；轮首未重整的不可名状之物攻击；背面洗回
// ---------------------------------------------------------------------------
test('06-a5 06170 无名之物：鼠群获得蜂拥 1、轮首意志(2)失败被攻击、背面洗回遭遇牌库', () => {
  const state = createState({ agendaIndex: 1 })
  const swarmCalls = []
  const stateApi = createApi(state, {
    swarm: { place: (enemy, amount) => { swarmCalls.push({ enemy: enemy.code, amount }); return [] } },
  })
  const rats = { id: 'rats', code: '01159', originalCode: '01159', location: 'burialGround', defeated: false }
  behavior.enemySpawned(state, rats, stateApi)
  assert.deepEqual(swarmCalls, [{ enemy: '01159', amount: 1 }], '议程 II 正面：鼠群获得蜂拥 1')

  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    exhausted: false, defeated: false })
  const failApi = createApi(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }) })
  behavior.turnBegins(state, state.investigators[0], failApi)
  assert.equal(failApi.__attacks, 2, '回合开始意志(2)失败：不可名状之物攻击两位同地点调查员')
  const okApi = createApi(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 2, difficulty }) })
  behavior.turnBegins(state, state.investigators[0], okApi)
  assert.equal(okApi.__attacks, undefined, '意志检定成功不攻击')

  state.encounterDiscard = ['06191', '06192']
  behavior.agendaReveal(state, state.agendas[1], createApi(state))
  assert.equal(state.encounterDiscard.length, 0, '议程 II 背面：遭遇弃牌堆全部洗回')
  assert.ok(state.encounterDeck.includes('06191'))
})

// ---------------------------------------------------------------------------
// 06171 议程 III：鼠群蜂拥 2、不可名状之物失去冷漠获得庞大、背面结局 2
// ---------------------------------------------------------------------------
test('06-a5 06171 无名之死：鼠群蜂拥 2、失去冷漠获得庞大、背面 → 结局 2', () => {
  const state = createState({ agendaIndex: 2 })
  const swarmCalls = []
  const api = createApi(state, { swarm: { place: (enemy, amount) => { swarmCalls.push(amount); return [] } } })
  behavior.enemySpawned(state, { id: 'rats', code: '01159', originalCode: '01159', location: 'burialGround' }, api)
  assert.deepEqual(swarmCalls, [2], '议程 III 正面：鼠群获得蜂拥 2')

  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    aloof: true, massive: false, exhausted: false, defeated: false })
  behavior.turnBegins(state, state.investigators[0], createApi(state))
  const unnamable = state.enemies[0]
  assert.equal(unnamable.aloof, false, '不可名状之物失去冷漠')
  assert.equal(unnamable.massive, true, '不可名状之物获得庞大')
  state.enemies = []
})

// ---------------------------------------------------------------------------
// 06172 幕 I：章节流程 id 分派到 intoTheDepths（跨卡顺序流程）
// ---------------------------------------------------------------------------
test('06-a5 06172 搜寻不可名状之物：chapterFlow=intoTheDepths 由章节 behavior 分派执行', () => {
  assert.equal(act06172.actRule.chapterFlow, 'intoTheDepths')
  const state = createState()
  // 只放非阶梯地点；6 张神秘阶梯在「放在一边」。
  for (const id of ['burialGround', 'frontPorchEntryway', 'upstairsHallway', 'den', 'parlor', 'library', 'bedroom', 'attic', 'unmarkedTomb']) {
    state.locations.push({ ...CLONE(definition.locations[id]), id, revealed: false, clues: 0 })
  }
  state.scenarioFlags.remembered = []
  state.scenarioZones.setAside = [...STAIRS_IDS, '06169b', '06190', '06190', '06190', '06190']
  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'attic',
    damageTaken: 3, doom: 1, exhausted: true, defeated: false })
  const api = createApi(state, { shuffle: list => [...list] })
  const handled = behavior.actReveal(state, state.acts[0], api)
  assert.equal(handled, true, '幕 I 背面的跨卡流程应被结算')
  const stairsInPlay = state.locations.filter(location => STAIRS_IDS.includes(location.id))
  assert.equal(stairsInPlay.length, 5, '6 张神秘阶梯中 5 张纵向入场')
  assert.equal(state.removedFromGame.filter(code => code === '06183' || code === '06184' || code === '06185' || code === '06186' || code === '06187' || code === '06188').length, 1, '剩 1 张神秘阶梯移出游戏')
  assert.equal(stairsInPlay.filter(location => location.revealed).length, 1, '最上方阶梯被揭示')
  const spawned = state.enemies.find(enemy => enemy.code === THE_UNNAMABLE && enemy.location !== 'attic')
  assert.ok(spawned, '不可名状之物被放到最上方神秘阶梯')
  assert.equal(spawned.damageTaken, 3, '不可名状之物保留伤害')
  assert.equal(spawned.doom, 1, '不可名状之物保留毁灭')
  assert.equal(spawned.exhausted, true, '不可名状之物保留横置状态')
})

// ---------------------------------------------------------------------------
// 06173 幕 II：最下方阶梯获得「撤退」；所有未败退者撤退后按目标推进；背面结局 1
// ---------------------------------------------------------------------------
test('06-a5 06173 无尽阶梯：最下方阶梯获得撤退行动，全员撤退推进，背面 → 结局 1', () => {
  const state = createState({ actIndex: 1 })
  const bottom = { ...CLONE(definition.locations.mysteriousStairs1), id: 'mysteriousStairs1', revealed: true, verticalIndex: 2 }
  state.locations.push(bottom)
  const inv = state.investigators[0]
  inv.location = bottom.id
  const moves = behavior.actions(state, inv)
  const resign = moves.find(move => move.rule === 'tshResignAtBottomStairs')
  assert.ok(resign, '最下方阶梯揭示后提供 [action]：撤退')
  const api = createApi(state)
  behavior.performAction(state, inv, resign, api)
  assert.equal(state.investigators[0].resigned, true, '执行撤退')
  const api2 = createApi(state)
  behavior.checkObjectives(state, api2)
  assert.equal(state.actAdvanced, undefined, '还有一人未撤退时不推进')
  state.investigators[1].resigned = true
  behavior.checkObjectives(state, api2)
  assert.equal(state.actAdvanced, 1, '所有未败退调查员撤退后推进')
  behavior.actReveal(state, state.acts[1], createApi(state))
  assert.equal(state.finishedWith, 'resolution1', '幕 II 背面 → 结局 1')
})

// ---------------------------------------------------------------------------
// 06175 入口：团队线索揭示楼上的走廊；不可名状之物受伤后放置无名坟墓
// ---------------------------------------------------------------------------
test('06-a5 06175 入口：团队花费线索揭示楼上的走廊；伤害足够时放置无名坟墓', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.frontPorchEntryway), id: 'frontPorchEntryway', revealed: true })
  state.locations.push({ ...CLONE(definition.locations.upstairsHallway), id: 'upstairsHallway', revealed: false })
  state.locations.push({ ...CLONE(definition.locations.unmarkedTomb), id: 'unmarkedTomb', revealed: false })
  const inv = state.investigators[0]
  inv.location = 'frontPorchEntryway'
  const moves = []
  location06175.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const revealMove = moves.find(move => move.rule === 'tshRevealUpstairsHallway')
  assert.ok(revealMove, '提供「揭示楼上的走廊」行动')
  assert.equal(revealMove.reason, undefined, '团队线索足够时不带禁止原因')
  const api = createApi(state)
  assert.equal(location06175.locationRule.performAction(state, inv, revealMove, api), true)
  assert.equal(inv.clues, 0, '团队花费 1[每调查员]=2 个线索')
  assert.equal(state.locations.find(item => item.id === 'upstairsHallway').revealed, true, '楼上的走廊被揭示')

  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    damageTaken: 2, defeated: false })
  state.locations = state.locations.filter(item => item.id !== 'unmarkedTomb')
  const moves2 = []
  location06175.locationRule.actions({ moves: moves2, state, inv, location: here(state, inv) })
  const tombMove = moves2.find(move => move.rule === 'tshPlaceUnmarkedTombFromEntryway')
  assert.ok(tombMove, '不可名状之物伤害达到 1[每调查员] 时提供放置无名坟墓')
  assert.equal(location06175.locationRule.performAction(state, inv, tombMove, createApi(state)), true)
  assert.ok(state.locations.some(item => item.id === 'unmarkedTomb'), '无名坟墓被放置入场')
})

// ---------------------------------------------------------------------------
// 06176 休息间：调查成功后弃 1 张手牌换额外线索；团队线索记住肖像画
// ---------------------------------------------------------------------------
test('06-a5 06176 休息间：调查成功后弃手牌换额外线索；团队线索记住亵渎肖像画', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.den), id: 'den', revealed: true, clues: 3 })
  const inv = state.investigators[0]
  inv.location = 'den'
  inv.hand = ['01020', '01021']
  const api = createApi(state, { choice: () => 'trigger' })
  location06176.locationRule.afterInvestigate(state, inv, here(state, inv), { success: true }, api)
  assert.equal(inv.discard.length, 1, '弃掉 1 张手牌')
  assert.equal(inv.clues, 3, '发现 1 个额外线索（由地点线索池转入手牌）')
  assert.deepEqual(state.scenarioFlags.remembered, undefined, 'afterInvestigate 不写记住事实')
  const moves = []
  location06176.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const remember = moves.find(move => move.rule === 'tshRememberDesecratedPortrait')
  assert.ok(remember, '提供记住「研究了一幅亵渎的肖像画」的团队线索行动')
  assert.equal(location06176.locationRule.performAction(state, inv, remember, createApi(state)), true)
  assert.ok(state.scenarioFlags.remembered.includes('studiedADesecratedPortrait'))
})

// ---------------------------------------------------------------------------
// 06177 客厅：每位在场调查员 +1 隐藏值；不可名状之物伤害足够时记住奇怪钥匙
// ---------------------------------------------------------------------------
test('06-a5 06177 客厅：每位在场调查员 +1 隐藏值；伤害 2[每调查员] 后记住奇怪的钥匙', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.parlor), id: 'parlor', revealed: true })
  const [a, b] = state.investigators
  a.location = 'parlor'; b.location = 'parlor'
  assert.equal(location06177.locationRule.shroudModifier(state, here(state, a), a), 2, '2 人在客厅：隐藏值 +2')
  b.location = 'burialGround'
  assert.equal(location06177.locationRule.shroudModifier(state, here(state, a), a), 1, '1 人在客厅：隐藏值 +1')
  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    damageTaken: 0, defeated: false })
  const moves = []
  location06177.locationRule.actions({ moves, state, inv: a, location: here(state, a) })
  assert.equal(moves.length, 0, '伤害不足时没有行动')
  state.enemies[0].damageTaken = 4
  const moves2 = []
  location06177.locationRule.actions({ moves: moves2, state, inv: a, location: here(state, a) })
  const remember = moves2.find(move => move.rule === 'tshRememberStrangeKeyParlor')
  assert.ok(remember, '不可名状之物 4 点伤害（2[每调查员]）后提供记住奇怪钥匙')
  assert.equal(location06177.locationRule.performAction(state, a, remember, createApi(state)), true)
  assert.ok(state.scenarioFlags.remembered.includes('recoveredAStrangeKey'))
})

// ---------------------------------------------------------------------------
// 06178 楼上的走廊：未揭示不能进入；团队线索把阁楼放置入场
// ---------------------------------------------------------------------------
test('06-a5 06178 楼上的走廊：未揭示不能进入；团队线索放置阁楼', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.upstairsHallway), id: 'upstairsHallway', revealed: false })
  const inv = state.investigators[0]
  inv.location = 'upstairsHallway'
  const error = location06178.locationRule.entryErrorWhenUnrevealed
  assert.match(error, /不能进入/, '未揭示时不能进入')
  const moves = []
  location06178.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  assert.equal(moves.length, 0, '未揭示时不提供放置阁楼行动')
  here(state, inv).revealed = true
  const moves2 = []
  location06178.locationRule.actions({ moves: moves2, state, inv, location: here(state, inv) })
  const place = moves2.find(move => move.rule === 'tshPlaceAtticFromHallway')
  assert.ok(place, '揭示后提供「团队线索放置阁楼」')
  assert.equal(location06178.locationRule.performAction(state, inv, place, createApi(state)), true)
  assert.ok(state.locations.some(item => item.id === 'attic'), '阁楼被放置入场')
})

// ---------------------------------------------------------------------------
// 06179 藏书室：调查额外费用（失行动或受恐惧）；团队线索放置无名坟墓
// ---------------------------------------------------------------------------
test('06-a5 06179 藏书室：调查额外费用二选一；团队线索放置无名坟墓', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.library), id: 'library', revealed: true })
  state.locations.push({ ...CLONE(definition.locations.unmarkedTomb), id: 'unmarkedTomb', revealed: false })
  const inv = state.investigators[0]
  inv.location = 'library'
  inv.actionsLeft = 2
  const actionApi = createApi(state, { choice: () => 'action' })
  assert.equal(location06179.locationRule.beforeInvestigate(state, inv, here(state, inv), actionApi), true)
  assert.equal(inv.actionsLeft, 1, '选择失去 1 个行动')
  const horrorApi = createApi(state, { choice: () => 'horror' })
  location06179.locationRule.beforeInvestigate(state, inv, here(state, inv), horrorApi)
  assert.equal(inv.horror, 1, '选择受到 1 点恐惧')
  state.locations = state.locations.filter(item => item.id !== 'unmarkedTomb')
  const moves = []
  location06179.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const place = moves.find(move => move.rule === 'tshPlaceUnmarkedTombFromLibrary')
  assert.ok(place, '提供放置无名坟墓的团队线索行动')
  assert.equal(location06179.locationRule.performAction(state, inv, place, createApi(state)), true)
  assert.ok(state.locations.some(item => item.id === 'unmarkedTomb'))
})

// ---------------------------------------------------------------------------
// 06180 卧室：[action][action] 清威胁区非弱点诡计；团队线索记住破碎镜子
// ---------------------------------------------------------------------------
test('06-a5 06180 卧室：2 行动清威胁区非弱点诡计；团队线索记住破碎镜子', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.bedroom), id: 'bedroom', revealed: true })
  const inv = state.investigators[0]
  inv.location = 'bedroom'
  inv.threat = [byCode('06191'), byCode('05015')]
  const moves = []
  location06180.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const clear = moves.find(move => move.rule === 'tshBedroomClearThreats')
  assert.equal(clear.actions, 2, '清威胁区花费 2 个行动')
  assert.equal(location06180.locationRule.performAction(state, inv, clear, createApi(state)), true)
  assert.equal(inv.threat.length, 1, '非弱点诡计全部弃掉，弱点保留')
  assert.equal(inv.threat[0].code, '05015', '弱点仍在威胁区')
  const moves2 = []
  location06180.locationRule.actions({ moves: moves2, state, inv, location: here(state, inv) })
  const remember = moves2.find(move => move.rule === 'tshRememberCrackedMirror')
  assert.ok(remember, '提供记住「找到了破碎的镜子」')
  assert.equal(location06180.locationRule.performAction(state, inv, remember, createApi(state)), true)
  assert.ok(state.scenarioFlags.remembered.includes('foundACrackedMirror'))
})

// ---------------------------------------------------------------------------
// 06181 阁楼：团队线索记住「发现了一把奇怪的钥匙」
// ---------------------------------------------------------------------------
test('06-a5 06181 阁楼：团队线索记住「发现了一把奇怪的钥匙」', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.attic), id: 'attic', revealed: true })
  const inv = state.investigators[0]
  inv.location = 'attic'
  const moves = []
  location06181.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const remember = moves.find(move => move.rule === 'tshRememberSilverKeyAttic')
  assert.ok(remember, '提供记住奇怪钥匙的团队线索行动')
  assert.equal(location06181.locationRule.performAction(state, inv, remember, createApi(state)), true)
  assert.ok(state.scenarioFlags.remembered.includes('recoveredAStrangeKey'))
  const moves2 = []
  location06181.locationRule.actions({ moves: moves2, state, inv, location: here(state, inv) })
  assert.equal(moves2.length, 0, '已记住后不再提供')
})

// ---------------------------------------------------------------------------
// 06182 无名坟墓：轮末目标——全员在场且已发现钥匙时推进幕 I
// ---------------------------------------------------------------------------
test('06-a5 06182 无名坟墓：轮末全员在此且发现钥匙才推进幕 I', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.unmarkedTomb), id: 'unmarkedTomb', revealed: true })
  state.investigators[0].location = 'unmarkedTomb'
  state.investigators[1].location = 'burialGround'
  state.scenarioFlags.remembered = ['recoveredAStrangeKey']
  const api = createApi(state)
  location06182.locationRule.forced.roundEnd(state, here(state, state.investigators[0]), api)
  assert.equal(state.actAdvanced, undefined, '有人不在无名坟墓时不推进')
  state.investigators[1].location = 'unmarkedTomb'
  location06182.locationRule.forced.roundEnd(state, here(state, state.investigators[0]), api)
  assert.equal(state.actAdvanced, 1, '条件满足时推进幕 I')
})

// ---------------------------------------------------------------------------
// 06183 神秘阶梯：进入后失去 1 个行动
// ---------------------------------------------------------------------------
test('06-a5 06183 神秘阶梯：进入后失去 1 个行动', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs1), id: 'mysteriousStairs1', revealed: true })
  const inv = state.investigators[0]
  inv.actionsLeft = 3
  location06183.locationRule.onEnter.effect(state, here(state, inv), createApi(state), inv)
  assert.equal(inv.actionsLeft, 2, '进入后失去 1 个行动')
})

// ---------------------------------------------------------------------------
// 06184 神秘阶梯：本地点有线索时不能移动/撤退
// ---------------------------------------------------------------------------
test('06-a5 06184 神秘阶梯：有线索时不能移动也不能撤退', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs2), id: 'mysteriousStairs2', revealed: true, clues: 1 })
  state.investigators[0].location = 'mysteriousStairs2'
  const lock = location06184.locationRule.blockWhileClues
  assert.equal(lock.move, true)
  assert.equal(lock.resign, true)
  assert.match(lock.message, /不能移动或撤退/)
  const message = behavior.moveError(state, state.investigators[0], 'burialGround')
  assert.match(String(message), /不能移动/, 'behavior.moveError 读到线索锁')
  state.locations[0].clues = 0
  assert.equal(behavior.moveError(state, state.investigators[0], 'burialGround'), undefined, '无线索时不封锁')
})

// ---------------------------------------------------------------------------
// 06185 神秘阶梯：有重整敌人时封锁；揭示时从遭遇牌库找食尸鬼生成
// ---------------------------------------------------------------------------
test('06-a5 06185 神秘阶梯：有重整敌人封锁；揭示时找出[[食尸鬼]]敌人生成', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs3), id: 'mysteriousStairs3', revealed: true })
  state.investigators[0].location = 'mysteriousStairs3'
  state.enemies.push({ id: 'ghoul', code: '01159', originalCode: '01159', location: 'mysteriousStairs3', exhausted: false, defeated: false })
  assert.match(String(behavior.moveError(state, state.investigators[0], 'burialGround')), /不能移动/, '有重整敌人时封锁移动')
  state.enemies = []
  state.encounterDeck = ['07001', '01160', '07002']
  const api = createApi(state)
  const handled = location06185.locationRule.onReveal(state, here(state, state.investigators[0]), api)
  assert.equal(handled, true)
  assert.equal(state.enemies.length, 1, '生成 1 个敌人')
  assert.equal(state.enemies[0].code, '01160', '从遭遇牌库找出的[[食尸鬼]]敌人（01160 Ghoul Minion）')
  assert.ok(!state.encounterDeck.includes('01160'), '该牌从遭遇牌库移出')
})

// ---------------------------------------------------------------------------
// 06186 神秘阶梯：揭示放 1[每调查员]资源；最低技能(2)成功弃 1 资源；有资源封锁
// ---------------------------------------------------------------------------
test('06-a5 06186 神秘阶梯：揭示放资源、最低技能检定弃资源、有资源时封锁', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs4), id: 'mysteriousStairs4', revealed: true })
  const inv = state.investigators[0]
  inv.location = 'mysteriousStairs4'
  const api = createApi(state)
  location06186.locationRule.onReveal(state, here(state, inv), api)
  assert.equal(here(state, inv).resources, 2, '揭示时放置 1[每调查员]=2 个资源')
  assert.match(String(behavior.moveError(state, inv, 'burialGround')), /不能移动/, '有资源时封锁移动')
  const moves = []
  location06186.locationRule.actions({ moves, state, inv, location: here(state, inv) })
  const clear = moves.find(move => move.rule === 'tshStairsClearResource')
  assert.ok(clear, '提供最低技能检定弃资源行动')
  assert.equal(location06186.locationRule.performAction(state, inv, clear, createApi(state)), true)
  assert.equal(here(state, inv).resources, 1, '检定成功弃掉 1 个资源')
})

// ---------------------------------------------------------------------------
// 06187 神秘阶梯：揭示时移动不可名状之物；伤害不足时封锁
// ---------------------------------------------------------------------------
test('06-a5 06187 神秘阶梯：揭示时移动不可名状之物，伤害不足时封锁移动', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs5), id: 'mysteriousStairs5', revealed: true })
  const inv = state.investigators[0]
  inv.location = 'mysteriousStairs5'
  state.enemies.push({ id: THE_UNNAMABLE, code: THE_UNNAMABLE, originalCode: THE_UNNAMABLE, location: 'burialGround',
    damageTaken: 0, defeated: false })
  const api = createApi(state)
  location06187.locationRule.onReveal(state, here(state, inv), api)
  assert.equal(state.enemies[0].location, 'mysteriousStairs5', '揭示时把不可名状之物移动到本地点')
  assert.match(String(behavior.moveError(state, inv, 'burialGround')), /不能移动/, '伤害不足时封锁移动')
  state.enemies[0].damageTaken = 2
  assert.equal(behavior.moveError(state, inv, 'burialGround'), undefined, '伤害足够（1[每调查员]）后不再封锁')
})

// ---------------------------------------------------------------------------
// 06188 神秘阶梯：移动/撤退的额外费用——弃 1 张含 2 个相同技能图标的手牌
// ---------------------------------------------------------------------------
test('06-a5 06188 神秘阶梯：移动/撤退前弃含 2 个相同技能图标的手牌', () => {
  const state = createState()
  state.locations.push({ ...CLONE(definition.locations.mysteriousStairs6), id: 'mysteriousStairs6', revealed: true })
  const inv = state.investigators[0]
  inv.location = 'mysteriousStairs6'
  inv.hand = ['01020'] // 01020 砍刀只有 1 个战斗图标：不合格
  assert.match(String(location06188.locationRule.moveError(state, inv, 'burialGround')), /不能移动/, '没有合格手牌时不能移动')
  inv.hand = ['01020', '01089'] // 01089 胆量有 2 个意志图标
  assert.equal(location06188.locationRule.moveError(state, inv, 'burialGround'), undefined, '有合格手牌时可以移动')
  const paid = location06188.locationRule.beforeMove(state, inv, 'burialGround', createApi(state))
  assert.equal(paid, true, '移动前结算弃牌费用')
  assert.deepEqual(inv.hand, ['01020'], '弃掉含 2 个相同技能图标的手牌')
  const resignPaid = location06188.locationRule.beforeResign(state, inv, createApi(state))
  assert.equal(resignPaid, false, '再次撤退时已无合格手牌，费用付不起')
})

// ---------------------------------------------------------------------------
// 06189 银钥匙：将要受到恐惧时横置，取消 1 点恐惧
// ---------------------------------------------------------------------------
test('06-a5 06189 银钥匙：横置取消即将受到的 1 点恐惧', () => {
  const state = createState()
  const inv = state.investigators[0]
  const ability = asset06189.abilities[0]
  assert.equal(ability.cost.exhaust, true, '费用为横置自身')
  const context = { seat: inv.seat, horror: 2 }
  const criteria = ability.criteria[0]
  assert.equal(criteria({ inv, context }), true, '有恐惧时可用')
  assert.equal(criteria({ inv, context: { seat: inv.seat, horror: 0 } }), false, '没有恐惧时不可用')
  ability.resolve({ inv, context, api: { info: () => {} } })
  assert.equal(context.horror, 1, '取消 1 点恐惧')
})

// ---------------------------------------------------------------------------
// 06191 难以描述的鬼魅：显现进威胁区；[action][action] 弃掉
// ---------------------------------------------------------------------------
test('06-a5 06191 难以描述的鬼魅：显现进入威胁区域并提供 2 行动摆脱', () => {
  const state = createState()
  const inv = state.investigators[0]
  const api = createApi(state)
  const handled = treachery06191.encounterResolve(state, inv, byCode('06191'), api)
  assert.equal(handled, true, '显现返回已放置')
  assert.equal(inv.threat.length, 1, '进入威胁区域')
  assert.equal(treachery06191.threatAction.actions, 2, '[action][action] 摆脱费用为 2 行动')
  assert.equal(treachery06191.threatAction.noTest, true, '摆脱不需要检定')
})

// ---------------------------------------------------------------------------
// 06192 发光的眼睛：显现进入威胁区域
// ---------------------------------------------------------------------------
test('06-a5 06192 发光的眼睛：显现进入威胁区域（轮末恐惧见失败清单）', () => {
  const state = createState()
  const inv = state.investigators[0]
  const handled = treachery06192.encounterResolve(state, inv, byCode('06192'), createApi(state))
  assert.equal(handled, true)
  assert.equal(inv.threat.length, 1, '进入威胁区域')
  assert.equal(inv.threat[0].code, '06192')
})

// ---------------------------------------------------------------------------
// 06193 欺骗性记忆：显现进威胁区；另一张卡进入威胁区后强制弃 1 张手牌
// ---------------------------------------------------------------------------
test('06-a5 06193 欺骗性记忆：进威胁区；另一张卡进入后强制弃 1 张手牌', () => {
  const state = createState()
  const inv = state.investigators[0]
  treachery06193.encounterResolve(state, inv, byCode('06193'), createApi(state))
  assert.equal(inv.threat.length, 1, '进入威胁区域')
  const source = inv.threat[0]
  inv.hand = ['01020', '01021']
  const ability = treachery06193.abilities[0]
  const criteria = ability.criteria[0]
  assert.equal(criteria({ inv, source, context: { seat: inv.seat, card: byCode('06192') } }), true, '另一张卡进入时触发')
  assert.equal(criteria({ inv, source, context: { seat: inv.seat, card: source } }), false, '自己进入时不触发')
  ability.resolve({ inv, api: createApi(state, { choice: () => '01020' }) })
  assert.deepEqual(inv.hand, ['01021'], '选择并弃掉 1 张手牌')
})

// ---------------------------------------------------------------------------
// 06194 阁楼的秘密：显现失败→1 恐惧 + 放密谋牌库旁；旁置时地点 [fast] 不能触发；轮末弃 1 张
// ---------------------------------------------------------------------------
test('06-a5 06194 阁楼的秘密：失败放密谋牌库旁、封锁地点[fast]、轮末弃 1 张', () => {
  const state = createState()
  const inv = state.investigators[0]
  const failApi = createApi(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }) })
  const placed = treachery06194.encounterResolve(state, inv, byCode('06194'), failApi)
  assert.equal(placed, true, '检定失败：放置「放在密谋牌库旁」的实体')
  assert.equal(inv.horror, 1, '检定失败受到 1 点恐惧')
  assert.equal(state.agendaAside.length, 1, '阁楼的秘密放在密谋牌库旁')
  assert.deepEqual(behavior.fastActions(state, inv), [], '旁置期间地点 [fast] 能力不能触发')
  state.agendaAside = []
  const successApi = createApi(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 3, difficulty }) })
  assert.equal(treachery06194.encounterResolve(state, inv, byCode('06194'), successApi), false, '检定成功不放置')
  state.agendaAside.push({ id: 'aside-06194-a', code: '06194', originalCode: '06194' })
  state.agendaAside.push({ id: 'aside-06194-b', code: '06194', originalCode: '06194' })
  behavior.roundEnded(state, createApi(state))
  assert.equal(state.agendaAside.length, 1, '轮末从场上弃掉 1 张（每轮最多一次）')
})
