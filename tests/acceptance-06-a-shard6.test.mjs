// 06-a 食梦者 · 分片 6（Dark Side of the Moon，06195–06233）独立验收证据。
//
// 为既有测试没有「标题含卡号」用例的 25 张非玩家卡补逐卡真实断言：
//   06206 06207 06208 06209 06210 06211 06212 06213 06214 06214b 06215 06216 06217
//   06218 06219 06220 06221 06222 06224 06225 06226 06227 06229 06231 06233
// 断言对象是当前 HEAD 的章节 behavior / 单卡条目 / chaos 读点，不是「条目存在」。
import test from 'node:test'
import assert from 'node:assert/strict'
import { canDiscoverClueAt, discoverClueAt, scenarioRuntime } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { agendaDoom } from '../src/engine/rules-state.js'
import { canCommitToTest } from '../src/engine/commit-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { fixture } from './core-fixture.mjs'
import { registerCardAbilities, registeredCodes, registeredEntry } from '../src/engine/ability.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'

import { scenario as definition } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/definition.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/behavior.js'
import { dsmChaosToken, dsmChaosAfterTest } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/chaos.js'

import darkCrater from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06216.js'
import templeOfTheMoonLizard from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06217.js'
import moonForest from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06218.js'
import blackCore from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06220.js'
import lightSide from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06222.js'
import virgilGray from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06224.js'
import moonBeast from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06229.js'
import forcedIntoHiding from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06231.js'

// 章节 behavior 的规则分派读注册表；测试里显式注册一次，避免依赖引擎惰性注册时机。
if (!registeredCodes().length) {
  registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])
}

const CLONE = value => JSON.parse(JSON.stringify(value))

// ---------------------------------------------------------------------------
// 夹具（与 tests/tde-scenario-darkSideOfTheMoon.test.mjs 同口径）
// ---------------------------------------------------------------------------
function createState(overrides = {}) {
  const state = {
    scenario: CLONE(definition),
    acts: CLONE(definition.acts),
    agendas: CLONE(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    doom: 0,
    investigators: [
      { seat: 0, id: 'inv0', code: '06001', name: '调查员一', location: 'moonForest', damage: 0, horror: 0,
        clues: 3, resources: 5, hand: ['01001'], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
      { seat: 1, id: 'inv1', code: '06002', name: '调查员二', location: 'moonForest', damage: 0, horror: 0,
        clues: 3, resources: 5, hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
    ],
    locations: [], enemies: [], storyAssets: [],
    scenarioFlags: {}, scenarioZones: { setAside: [] },
    victoryDisplay: [], victory: 0,
    encounterDeck: [], encounterDiscard: [], removedFromGame: [],
    campaign: { leadSeat: 0, records: {}, investigators: [{ deck: [], purchases: [] }, { deck: [], purchases: [] }], chaosBag: [] },
    chaosBag: [], difficulty: 'standard', numInvestigators: 2,
    round: 1, phase: 'investigation', currentSeat: 0, turnSerial: 1, status: 'playing',
    investigatorCounters: { alarmLevel: { seats: [1, 1], max: 5 } },
  }
  return Object.assign(state, overrides)
}

function placeScenarioLocations(state, ids = ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater']) {
  for (const id of ids) {
    const def = state.scenario.locations[id]
    if (!def || state.locations.some(item => item.id === id)) continue
    state.locations.push({ ...CLONE(def), id, revealed: true, clues: 0, doom: 0, connections: [...(def.connections || [])] })
  }
  return state
}

function createApi(state, overrides = {}) {
  const calls = []
  const record = (name, fn = () => undefined) => (...args) => { calls.push({ name, args }); return fn(...args) }
  const api = {
    calls,
    info: () => {},
    choose: request => api.choice(request),
    choice: request => (overrides.choice ? overrides.choice(request) : request?.options?.[0]?.id ?? null),
    random: () => 0.5,
    shuffle: list => [...list],
    counters: {
      get: (seat, id) => Number(state.investigatorCounters?.[id]?.seats?.[seat] || 0),
      highestOf: id => (state.investigatorCounters?.[id]?.seats || [])
        .reduce((max, value) => Math.max(max, Number(value) || 0), 0),
      add: (seat, id, delta = 1) => {
        state.investigatorCounters ||= {}
        const entry = (state.investigatorCounters[id] ||= { seats: [], max: null })
        const next = Math.max(0, Math.min(entry.max ?? Infinity, (entry.seats[seat] || 0) + delta))
        entry.seats[seat] = next
        return next
      },
      setMax: (id, max) => { state.investigatorCounters ||= {}; (state.investigatorCounters[id] ||= { seats: [] }).max = max },
    },
    test: record('test', (seat, skill, difficulty, resolve) => {
      const result = overrides.testResult
        ? overrides.testResult({ seat, skill, difficulty })
        : { success: true, value: difficulty, difficulty, drawn: [], source: null }
      if (typeof resolve === 'function') resolve(result)
      return result
    }),
    payClues: record('payClues', (n, locationId) => {
      const payers = state.investigators.filter(inv => !locationId || inv.location === locationId)
      let remaining = n
      for (const inv of payers) { const paid = Math.min(remaining, inv.clues); inv.clues -= paid; remaining -= paid }
    }),
    canDrawCards: () => true,
    canGainResources: () => true,
    moveInvestigator: record('moveInvestigator', (seat, destination) => { const inv = state.investigators[seat]; if (inv) inv.location = destination }),
    moveEnemy: record('moveEnemy', (enemy, destination) => { enemy.location = destination }),
    advanceAct: record('advanceAct', () => { state.actAdvanced = (state.actAdvanced || 0) + 1 }),
    finish: record('finish', key => { state.finishedWith = key }),
    addDoom: record('addDoom', n => { state.doom += n }),
    horror: record('horror', (seat, n) => { state.investigators[seat].horror += n }),
    damage: record('damage', (seat, n) => { state.investigators[seat].damage += n }),
    damageEnemy: record('damageEnemy'),
    loseActions: record('loseActions', (seat, n) => { const inv = state.investigators[seat]; if (inv) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - n) }),
    gainResources: record('gainResources', (seat, n) => { state.investigators[seat].resources += n }),
    drawCards: record('drawCards', (seat, n) => { state.investigators[seat].hand.push(...Array(n).fill('01001')) }),
    discardChosen: record('discardChosen', (seat, n) => { const inv = state.investigators[seat]; for (let i = 0; i < n && inv.hand.length; i++) inv.discard.push(inv.hand.pop()) }),
    discardEnemy: record('discardEnemy', enemy => { state.enemies = state.enemies.filter(item => item !== enemy) }),
    spawn: record('spawn', (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, location,
        damageTaken: 0, exhausted: false, defeated: false, engagedSeat: null, doom: 0, traits: [] }
      state.enemies.push(enemy)
      return enemy
    }),
    exhaustEnemy: record('exhaustEnemy', enemy => { enemy.exhausted = true }),
    readyEnemy: record('readyEnemy', enemy => { enemy.exhausted = false }),
    shuffleDiscard: record('shuffleDiscard', () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] }),
    shuffleEncounterDeck: record('shuffleEncounterDeck'),
    discardEncounterCard: record('discardEncounterCard', code => {
      const index = state.encounterDeck.lastIndexOf(String(code))
      if (index < 0) return false
      state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0])
      return true
    }),
    drawEncounterDiscard: record('drawEncounterDiscard', seat => { state.drawnBy = seat }),
    drawEncounter: record('drawEncounter', seat => { state.drawnBy = seat }),
    takeFromSetAside: record('takeFromSetAside', code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(String(code))
      if (index >= 0) { list.splice(index, 1); return true }
      return false
    }),
    place: record('place', id => {
      const def = state.scenario.locations[id]
      if (!def || state.locations.some(item => item.id === id)) return null
      const location = { ...CLONE(def), id, revealed: false, clues: 0, doom: 0, connections: [...(def.connections || [])] }
      state.locations.push(location)
      return location
    }),
    reveal: record('reveal', id => { const location = state.locations.find(item => item.id === id); if (location) location.revealed = true }),
    removeLocationFromGame: record('removeLocationFromGame', id => {
      const location = state.locations.find(item => item.id === id)
      state.locations = state.locations.filter(item => item.id !== id)
      return location
    }),
    cardFlip: record('cardFlip'),
    giveAsset: record('giveAsset', (seat, code) => {
      const asset = { id: `asset-${code}`, code, originalCode: code }
      state.investigators[seat].assets.push(asset)
      return asset
    }),
    storyAsset: record('storyAsset', (code, location) => {
      const asset = { id: `story-${code}`, code, originalCode: code, location }
      state.storyAssets.push(asset)
      return asset
    }),
    attachToLocation: record('attachToLocation', (id, fields = {}) => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return null
      location.attachments ||= []
      location.attachments.push({ id: `attach-${fields.code}`, code: fields.code, originalCode: fields.code })
      return location.attachments.at(-1)
    }),
    detachLocationAttachment: record('detachLocationAttachment'),
    setScenarioFlag: record('setScenarioFlag', (key, value = true) => { state.scenarioFlags[key] = value; return value }),
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    campaignRecord: key => state.campaign.records[key] ?? null,
    setCampaignRecord: record('setCampaignRecord', (key, value) => { state.campaign.records[key] = value; return value }),
    markLocationCounter: record('markLocationCounter', (id, key, amount) => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return 0
      location[key] = Math.max(0, (location[key] || 0) + amount)
      return location[key]
    }),
    setShroudMod: record('setShroudMod', (location, amount) => { location.shroudMod = (location.shroudMod || 0) + amount }),
    healAsset: record('healAsset'),
    transferAssetControl: record('transferAssetControl'),
    evadeEnemy: record('evadeEnemy', enemy => { enemy.exhausted = true; enemy.engagedSeat = null }),
    canDiscardAsset: () => true,
    discardAsset: record('discardAsset'),
    ...overrides.custom,
  }
  return api
}

const byCode = (state, code) => state.locations.find(location => (location.originalCode || location.code) === String(code))

// ---------------------------------------------------------------------------
// 06206 场景卡（混乱袋参照）
// ---------------------------------------------------------------------------
test('06206 月之暗面：混乱标记取值与失败后果，cultist 追加一次揭示', () => {
  const state = createState()
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  assert.equal(dsmChaosToken(state, state.investigators[0], 'skull'), -2, '简单面 skull = ceil(3/2)')
  assert.equal(dsmChaosToken(state, state.investigators[0], 'tablet'), -1)
  assert.deepEqual(behavior.resolveChaosToken(state, state.investigators[0], 'cultist'), { delta: 0, drawAnother: true })
  assert.equal(dsmChaosToken(state, state.investigators[0], 'elderthing'), 1)
  const hard = createState({ difficulty: 'hard' })
  hard.investigatorCounters.alarmLevel.seats = [3, 1]
  assert.equal(dsmChaosToken(hard, hard.investigators[0], 'skull'), -3)
  assert.equal(dsmChaosToken(hard, hard.investigators[0], 'tablet'), -2)
  assert.equal(dsmChaosToken(hard, hard.investigators[0], 'elderthing'), 0)
  // tablet 失败：警报 +1；cultist 失败且警报 > 修正后技能值：抽遭遇牌库顶。
  const api = createApi(state)
  dsmChaosAfterTest(state, state.investigators[0], {
    success: false, value: 2, difficulty: 5, drawn: ['cultist', 'tablet'], cancelledTokens: [], source: null,
  }, api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 4)
  assert.equal(state.drawnBy, 0, 'cultist：警报 4 > 修正后技能值 2，抽遭遇牌库顶')
})

// ---------------------------------------------------------------------------
// 06207–06209 议程
// ---------------------------------------------------------------------------
test('06207 无声暗涌：背面把遭遇弃牌堆洗回并把每位调查员警报等级 +1', () => {
  const state = createState({ encounterDiscard: ['06230', '06231'] })
  const api = createApi(state)
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(state.encounterDiscard.length, 0)
  assert.deepEqual(state.investigatorCounters.alarmLevel.seats, [2, 2])
})

test('06208 警报响起：洗回+警报；记录强行进庙时从遭遇牌堆/弃牌堆找出土星猫抽取', () => {
  const state = createState({ encounterDeck: ['06228', '06230'], encounterDiscard: [] })
  const api = createApi(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  assert.equal(state.drawnBy, undefined, '未记录强行进庙：不抽土星猫')
  const forced = createState({ encounterDeck: ['06228', '06230'] })
  forced.campaign.records.theInvestigatorsForcedTheirWayIntoTheTemple = true
  const forcedApi = createApi(forced)
  behavior.agendaReveal(forced, forced.agendas[1], forcedApi)
  assert.equal(forced.drawnBy, 0, '记录强行进庙：队长抽出 1 张土星猫')
  assert.ok(forcedApi.calls.some(call => call.name === 'discardEncounterCard' && call.args[0] === '06228'))
})

test('06209 它们是冲着你来的！：背面警报 +1、恐惧半警报、重置密谋 3a 并放 2 毁灭', () => {
  const state = createState({ agendaIndex: 2 })
  const api = createApi(state)
  assert.equal(behavior.agendaReveal(state, state.agendas[2], api), true)
  assert.deepEqual(state.investigatorCounters.alarmLevel.seats, [2, 2])
  assert.equal(state.investigators[0].horror, 1, 'ceil(2/2)=1 恐惧')
  assert.equal(state.agendaIndex, 2, '密谋牌库重置到 3a')
  assert.equal(state.doom, 2, '在当前密谋上放 2 毁灭')
})

// ---------------------------------------------------------------------------
// 06210–06213 幕
// ---------------------------------------------------------------------------
test('06210 月兽腹地：月兽之城团队 3×人数线索推进；背面把放在一边的维吉尔·格雷交给月兽之城调查员', () => {
  const state = createState()
  placeScenarioLocations(state)
  for (const inv of state.investigators) { inv.location = 'cityOfTheMoonBeasts'; inv.clues = 2 }
  const api = createApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, undefined, '每人 2 点/需 6 点：不推进')
  for (const inv of state.investigators) inv.clues = 3
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, 1)
  // 背面：把放一边的维吉尔·格雷交给月兽之城的一位调查员。
  const rescue = createState({ actIndex: 0 })
  placeScenarioLocations(rescue)
  rescue.investigators[0].location = 'cityOfTheMoonBeasts'
  rescue.investigators[1].location = 'cityOfTheMoonBeasts'
  rescue.scenarioZones.setAside = ['06224']
  const rescueApi = createApi(rescue, { choice: request => {
    assert.deepEqual(request.options.map(option => option.id), ['0', '1'])
    return '1'
  } })
  assert.equal(behavior.actReveal(rescue, rescue.acts[0], rescueApi), true)
  assert.equal(rescue.investigators[0].assets.some(asset => asset.code === '06224'), false)
  assert.ok(rescue.investigators[1].assets.some(asset => asset.code === '06224'))
  assert.equal(rescue.scenarioZones.setAside.includes('06224'), false)
})

test('06211 月上探索：月蜥神庙团队 1×人数线索推进；背面放置月下洞穴（暗面）/黑暗月核并横置生成月蜥', () => {
  const state = createState({ actIndex: 1 })
  placeScenarioLocations(state)
  state.scenarioZones.setAside = ['06219', '06220', '06226']
  const api = createApi(state)
  assert.equal(behavior.actReveal(state, state.acts[1], api), true)
  assert.ok(byCode(state, '06219'), '月下洞穴（暗面）入场')
  assert.ok(byCode(state, '06220'), '黑暗月核入场')
  const lizard = state.enemies.find(enemy => enemy.code === '06226')
  assert.ok(lizard)
  assert.equal(lizard.location, byCode(state, '06220').id)
  assert.equal(lizard.exhausted, true, '月蜥以横置状态生成')
})

test('06212 月之核心：仅成功调查可发现黑暗月核线索；满足推进目标后放置三个地点', () => {
  const state = createState({ actIndex: 2 })
  placeScenarioLocations(state, ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest',
    'theDarkCrater', 'cavernsBeneathTheMoonDarkSide', 'theBlackCore'])
  const discovery = fixture()
  const core = { ...CLONE(definition.locations.theBlackCore), id: 'theBlackCore', originalCode: '06220', clues: 2, revealed: true }
  discovery.locations.push(core)
  discovery.acts = CLONE(definition.acts)
  discovery.actIndex = 2
  discovery.investigators[0].location = core.id
  assert.equal(canDiscoverClueAt(discovery, discovery.investigators[0], core), false)
  assert.equal(discoverClueAt(discovery, discovery.investigators[0], 1, []), false)
  assert.equal(core.clues, 2)
  assert.equal(canDiscoverClueAt(discovery, discovery.investigators[0], core, { investigation: true }), true)
  discoverClueAt(discovery, discovery.investigators[0], 1, [], { investigation: true })
  assert.equal(core.clues, 1)
  assert.equal(discovery.investigators[0].clues, 1)
  state.scenarioZones.setAside = ['06221', '06222', '06223']
  const api = createApi(state)
  assert.equal(behavior.actReveal(state, state.acts[2], api), true)
  for (const code of ['06221', '06222', '06223']) assert.ok(byCode(state, code), `${code} 入场`)
  // 目标：全员在黑暗月核且无线索时推进。
  const objective = createState({ actIndex: 2 })
  placeScenarioLocations(objective, ['theBlackCore'])
  for (const inv of objective.investigators) inv.location = 'theBlackCore'
  behavior.checkObjectives(objective, createApi(objective))
  assert.equal(objective.actAdvanced, 1)
})

test('06213 意外救援：背面进入结局 1；目标由船长的谈判检定推进', () => {
  const state = createState({ actIndex: 3 })
  const api = createApi(state)
  assert.equal(behavior.actReveal(state, state.acts[3], api), true)
  assert.equal(state.finishedWith, 'resolution1')
})

// ---------------------------------------------------------------------------
// 06214 / 06214b 月兽帆船与背面「下船」
// ---------------------------------------------------------------------------
test('06214 月兽帆船：无线索时提供 [fast] 翻面；一轮结束有 3 毁灭也翻面（玩家卡效果不能进出）', () => {
  const state = createState({ actIndex: 0 })
  placeScenarioLocations(state)
  const location = createApi(state).place('moonBeastGalley')
  state.investigators[0].location = location.id
  const api = createApi(state)
  const moves = behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'flipMoonBeastGalley' && move.actions === 0 && move.fast === true && move.flow === 'offTheGalley'))
  // 「玩家卡效果不能进入或离开」：效果移动被 movementError 拒绝。
  assert.match(behavior.movementError(state, state.investigators[0], 'moonForest'), /月兽帆船/)
  // 轮末 3 毁灭：自动翻面 → 下船（无线索：移动到月之森林、弃掉本地敌人、移出游戏）。
  state.doom = 3
  state.enemies.push({ id: 'e1', code: '06229', originalCode: '06229', location: location.id })
  behavior.roundEnded(state, api)
  assert.equal(state.scenarioFlags.moonBeastGalleyFlipped, true)
  assert.equal(state.investigators[0].location, 'moonForest')
  assert.equal(state.enemies.length, 0)
  assert.ok(state.removedFromGame.includes('06214'))
  assert.equal(byCode(state, '06214'), undefined, '帆船地点移出游戏')
})

test('06214b 下船：翻面时已有线索 → 每位调查员警报 +1，并与敌人一起被带到月兽之城', () => {
  const state = createState()
  placeScenarioLocations(state)
  const galley = createApi(state).place('moonBeastGalley')
  galley.clues = 2
  state.investigators[0].location = galley.id
  const enemy = { id: 'e1', code: '06229', originalCode: '06229', location: galley.id }
  state.enemies.push(enemy)
  const api = createApi(state)
  behavior.performAction(state, state.investigators[0], { flow: 'offTheGalley' }, api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  assert.equal(state.investigators[0].location, 'cityOfTheMoonBeasts')
  assert.equal(enemy.location, 'cityOfTheMoonBeasts')
  assert.ok(state.removedFromGame.includes('06214'))
})

// ---------------------------------------------------------------------------
// 06215 月兽之城
// ---------------------------------------------------------------------------
test('06215 月兽之城：帷幕等于最高警报；轮末敏捷(2)失败者警报 +1', () => {
  const state = createState()
  placeScenarioLocations(state)
  const city = byCode(state, '06215')
  state.investigators[0].location = city.id
  state.investigators[1].location = 'moonForest'
  const api = createApi(state, { testResult: () => ({ success: false, value: 0, difficulty: 2, drawn: [], source: null }) })
  behavior.roundEnded(state, api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2, '本地失败者 +1')
  assert.equal(state.investigatorCounters.alarmLevel.seats[1], 1, '不在本地的调查员不受影响')
  assert.equal(behavior.locationShroudModifier(state, city, state.investigators[0]), 2)
  state.investigatorCounters.alarmLevel.seats[1] = 4
  assert.equal(behavior.locationShroudModifier(state, city, state.investigators[0]), 4)
})

// ---------------------------------------------------------------------------
// 06216–06218 月面地点
// ---------------------------------------------------------------------------
test('06216 漆黑深坑：智力(5)成功警报 -1（每场一次）；本回合发现线索后回合末意志(3)失败警报 +1', () => {
  const state = createState()
  placeScenarioLocations(state)
  const crater = byCode(state, '06216')
  state.investigators[0].location = crater.id
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  const api = createApi(state)
  assert.equal(darkCrater.locationRule.performAction(state, state.investigators[0], { rule: 'tshDarkCraterHide' }, api), true)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  assert.equal(state.scenarioFlags.darkCraterHideSuccess, true)
  darkCrater.locationRule.onCluesDiscovered(state, state.investigators[0], 1, api)
  const failApi = createApi(state, { testResult: () => ({ success: false, value: 0, difficulty: 3, drawn: [], source: null }) })
  darkCrater.locationRule.forced.turnEnd(state, state.investigators[0], crater, failApi)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 3)
})

test('06217 月蜥神庙：意志(5)成功警报 -1；发现线索后受等量恐惧或弃等量手牌', () => {
  const state = createState()
  placeScenarioLocations(state)
  const temple = byCode(state, '06217')
  state.investigators[0].location = temple.id
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  const api = createApi(state)
  assert.equal(templeOfTheMoonLizard.locationRule.performAction(state, state.investigators[0], { rule: 'tshTempleHide' }, api), true)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  templeOfTheMoonLizard.locationRule.onCluesDiscovered(state, state.investigators[0], 2, api)
  assert.equal(state.investigators[0].horror, 2, '选择恐惧：受到 2 点恐惧')
})

test('06218 月之森林：敏捷(5)藏身警报 -1；[fast] 躲避失败警报 +1（每轮一次）', () => {
  const state = createState()
  placeScenarioLocations(state)
  const forest = byCode(state, '06218')
  state.investigators[0].location = forest.id
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  state.enemies.push({ id: 'e1', code: '06229', originalCode: '06229', location: forest.id, evade: 2 })
  const api = createApi(state)
  const moves = []
  moonForest.locationRule.actions({ moves, state, inv: state.investigators[0], location: forest })
  assert.ok(moves.some(move => move.rule === 'tshMoonForestHide' && move.actions === 1))
  assert.ok(moves.some(move => move.rule === 'tshMoonForestEvade' && move.actions === 0 && move.fast === true))
  moonForest.locationRule.performAction(state, state.investigators[0], { rule: 'tshMoonForestHide' }, api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  const failApi = createApi(state, { testResult: () => ({ success: false, value: 0, difficulty: 2, drawn: [], source: null }) })
  moonForest.locationRule.performAction(state, state.investigators[0], { rule: 'tshMoonForestEvade' }, failApi)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 3, '躲避失败：警报 +1')
})

// ---------------------------------------------------------------------------
// 06219–06222 洞穴与亮面
// ---------------------------------------------------------------------------
test('06219 月下洞穴（暗面）：调查失败后隐藏值 -2 直到你回合结束，回合结束还原', () => {
  const state = createState()
  placeScenarioLocations(state, ['cavernsBeneathTheMoonDarkSide', 'theBlackCore', 'moonForest'])
  const cave = byCode(state, '06219')
  state.investigators[0].location = cave.id
  const api = createApi(state)
  behavior.afterTest(state, state.investigators[0], {
    success: false, value: 1, difficulty: 3, drawn: [], source: { label: '调查' },
  }, api)
  assert.equal(cave.shroudMod, -2, '失败后帷幕 -2')
  assert.equal(cave.shroudPenaltyActive, true)
  behavior.turnEnded(state, state.investigators[0], api)
  assert.equal(cave.shroudMod, 0, '回合结束还原')
  assert.equal(cave.shroudPenaltyActive, undefined)
})

test('06220 黑暗月核：揭示放 3+3×人数深度标记；隐藏值 = 深度标记；暗面洞穴有线索时不能进入；游泳移除深度', () => {
  const state = createState()
  placeScenarioLocations(state, ['cavernsBeneathTheMoonDarkSide', 'theBlackCore'])
  const core = byCode(state, '06220')
  const api = createApi(state)
  // 条目 onReveal 由引擎的 revealLocation 读点调用；这里直接调用同一钩子。
  assert.equal(blackCore.locationRule.onReveal(state, core, api), true)
  assert.equal(core.depthTokens, 3 + 3 * 2, '3 + 3[per_investigator]')
  assert.equal(behavior.locationShroudModifier(state, core), 9, '隐藏值 X = 深度标记数')
  const cave = byCode(state, '06219')
  cave.clues = 1
  state.investigators[0].location = 'moonForest'
  assert.match(behavior.investigatorEntryError(state, core, state.investigators[0]), /不能进入/)
  state.investigators[0].location = core.id
  const swimApi = createApi(state, { testResult: () => ({ success: true, value: 5, difficulty: 2, drawn: [], source: null }) })
  blackCore.locationRule.performAction(state, state.investigators[0], { rule: 'tshBlackCoreSwim' }, swimApi)
  assert.equal(core.depthTokens, 6, '成功超出 3 点：移除 3 个深度标记')
})

test('06221 月下洞穴（亮面）：调查失败后隐藏值 -2 直到你回合结束，回合结束还原', () => {
  const state = createState()
  placeScenarioLocations(state, ['cavernsBeneathTheMoonLightSide', 'theBlackCore'])
  const cave = byCode(state, '06221')
  state.investigators[0].location = cave.id
  const api = createApi(state)
  behavior.afterTest(state, state.investigators[0], {
    success: false, value: 1, difficulty: 3, drawn: [], source: { label: '调查' },
  }, api)
  assert.equal(cave.shroudMod, -2)
  behavior.turnEnded(state, state.investigators[0], api)
  assert.equal(cave.shroudMod, 0)
})

test('06222 月之亮面：智力/敏捷(1)每超过难度 3 点警报 -1（每轮一次成功）；亮面洞穴有线索时不能进入', () => {
  const state = createState()
  placeScenarioLocations(state, ['cavernsBeneathTheMoonLightSide', 'lightSideOfTheMoon'])
  const light = byCode(state, '06222')
  state.investigators[0].location = light.id
  state.investigatorCounters.alarmLevel.seats = [5, 1]
  const api = createApi(state, { testResult: () => ({ success: true, value: 8, difficulty: 1, drawn: [], source: null }) })
  assert.equal(lightSide.locationRule.performAction(state, state.investigators[0], { rule: 'tshLightSideHide' }, api), true)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 3, '超出 7 点 → 7/3 向下取整 = 2 级')
  assert.equal(state.scenarioFlags.lightSideSuccessRound, state.round)
  const cave = byCode(state, '06221')
  cave.clues = 1
  state.investigators[0].location = 'moonForest'
  assert.match(behavior.investigatorEntryError(state, light, state.investigators[0]), /不能进入/)
})

// ---------------------------------------------------------------------------
// 06224 / 06225 剧情支援
// ---------------------------------------------------------------------------
test('06224 维吉尔·格雷：警报提高后抽 1/获得 1 资源/治愈 1 恐惧，然后转交控制权；离场移出游戏', () => {
  const state = createState()
  const virgil = { id: 'story-06224', code: '06224', originalCode: '06224', horror: 1 }
  state.investigators[0].assets.push(virgil)
  const ability = virgilGray.abilities[0]
  const ctx = {
    state, inv: state.investigators[0], source: virgil,
    context: { counterId: 'alarmLevel', seat: 0, delta: 1 },
    helpers: { canDrawCards: () => true, canGainResources: () => true },
  }
  assert.equal(ability.criteria[0](ctx), true)
  const api = createApi(state, { choice: request => request.kind === 'card' ? 'draw' : request?.options?.[0]?.id })
  ability.resolve({ state, inv: state.investigators[0], source: virgil, api })
  assert.equal(state.investigators[0].hand.length, 2, '抽 1 张牌')
  assert.deepEqual(api.calls.find(call => call.name === 'transferAssetControl').args, [virgil, 1])
  assert.equal(virgilGray.removeFromGameOnLeave, true, '离场从游戏中移除（引擎读点 removeFromGameOnLeave）')
})

test('06225 船长：全员在白船时任意白船调查员可谈判（意志/智力 X=最高警报），成功推进场景', () => {
  const state = createState()
  placeScenarioLocations(state)
  const ship = createApi(state).place('theWhiteShip')
  for (const inv of state.investigators) inv.location = ship.id
  state.storyAssets.push({ id: 'story-06225', code: '06225', originalCode: '06225', location: ship.id })
  state.investigatorCounters.alarmLevel.seats = [4, 1]
  const api = createApi(state)
  const moves = behavior.actions(state, state.investigators[0])
  const parley = moves.find(move => move.rule === 'tshCaptainSetsSail')
  assert.ok(parley, '提供船长谈判行动')
  behavior.performAction(state, state.investigators[0], parley, api)
  const testCall = api.calls.find(call => call.name === 'test')
  assert.equal(testCall.args[2], 4, '难度 X = 最高警报等级')
  assert.equal(state.actAdvanced, 1, '成功推进场景')
})

// ---------------------------------------------------------------------------
// 06226 / 06227 敌人
// ---------------------------------------------------------------------------
test('06226 月蜥：只能进入[[洞穴]]地点；交战/未交战的攻击与躲避值按警报等级', () => {
  const state = createState()
  placeScenarioLocations(state, ['moonForest', 'templeOfTheMoonLizard', 'theDarkCrater', 'cavernsBeneathTheMoonDarkSide'])
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  const lizard = { id: 'e1', code: '06226', originalCode: '06226', location: 'moonForest', fight: 5, evade: 5, engagedSeat: null }
  state.enemies.push(lizard)
  assert.equal(behavior.enemyStatModifier(state, lizard, 'fight'), 0, '未交战：X=5（与印刷值持平）')
  lizard.engagedSeat = 0
  assert.equal(behavior.enemyStatModifier(state, lizard, 'fight'), -2, '交战：X=警报等级 3 → 修正 3-5')
  // 猎手只在洞穴子图移动：月之森林的洞穴邻居只有月下洞穴（暗面）。
  const api = createApi(state)
  lizard.engagedSeat = null
  state.investigators[0].location = 'moonForest'
  behavior.hunterMove(state, lizard, api)
  assert.equal(lizard.location, 'cavernsBeneathTheMoonDarkSide')
})

test('06227 月之拜亚基：生成在最近的[[月面]]地点；忽略/不能交战警报 ≤2 的调查员', () => {
  const state = createState()
  placeScenarioLocations(state, ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater', 'theBlackCore'])
  for (const inv of state.investigators) inv.location = 'theBlackCore'
  const spawn = behavior.spawnLocation(state, '06227', 'moonForest')
  assert.equal(spawn, 'theDarkCrater', '从黑暗月核出发，最近的[[月面]]地点是漆黑深坑')
  state.investigatorCounters.alarmLevel.seats = [2, 1]
  assert.equal(behavior.canEngageEnemy(state, state.investigators[0], { code: '06227', originalCode: '06227' }), false)
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  assert.equal(behavior.canEngageEnemy(state, state.investigators[0], { code: '06227', originalCode: '06227' }), true)
  // 猎手忽略警报 ≤2：全部低警报时不会移动。
  const low = createState()
  placeScenarioLocations(low, ['moonForest', 'templeOfTheMoonLizard'])
  low.investigatorCounters.alarmLevel.seats = [1, 2]
  const enemy = { id: 'e1', code: '06227', originalCode: '06227', location: 'moonForest', hunter: true }
  low.enemies.push(enemy)
  behavior.hunterMove(low, enemy, createApi(low))
  assert.equal(enemy.location, 'moonForest', '低警报调查员被忽略，不移动')
  state.investigatorCounters.alarmLevel.seats = [3, 5]
  assert.deepEqual(behavior.preyRank(state, enemy, [0, 1]), [1])
  assert.deepEqual(behavior.preyRank(state, enemy, state.investigators), [state.investigators[1]])
})

// ---------------------------------------------------------------------------
// 06229 / 06231 / 06233
// ---------------------------------------------------------------------------
test('06229 月兽：入场每位调查员警报 +1；被击败每位调查员警报 -1', () => {
  const state = createState()
  const beast = { id: 'e1', code: '06229', originalCode: '06229', location: 'moonForest' }
  const api = createApi(state)
  moonBeast.enemyScript.onSpawn(state, beast, api)
  assert.deepEqual(state.investigatorCounters.alarmLevel.seats, [2, 2])
  assert.equal(moonBeast.enemyScript.onDefeated(state, beast, api), false, '不接管引擎默认弃置')
  assert.deepEqual(state.investigatorCounters.alarmLevel.seats, [1, 1])
})

test('06231 被迫藏身：意志检定难度 = 你的警报等级；失败差值 1/3/5 分别失去 1/2/3 个行动', () => {
  const cases = [[3, 1], [1, 2], [-1, 3]]
  for (const [value, lost] of cases) {
    const state = createState()
    state.investigatorCounters.alarmLevel.seats = [4, 1]
    const api = createApi(state, { testResult: () => ({ success: false, value, difficulty: 4, drawn: [], source: null }) })
    forcedIntoHiding.encounterResolve(state, state.investigators[0], {}, api)
    const testCall = api.calls.find(call => call.name === 'test')
    assert.equal(testCall.args[2], 4, '难度 = 警报等级 4')
    assert.equal(state.investigators[0].actionsLeft, 3 - lost, `差值 ${4 - value} → 失去 ${lost} 行动`)
  }
})

test('06233 卡达斯：公开旁置并有 1 毁灭；其他座位也能行动，成功移出游戏', () => {
  const state = fixture('01001', 2)
  state.scenario = CLONE(definition)
  const before = agendaDoom(state)
  const actual = scenarioRuntime(state, [])
  behavior.afterChaosBagSetup(state, [], actual)
  const card = state.agendaAside[0]
  assert.equal(card.code, '06233')
  assert.equal(card.doom, 1)
  assert.equal(agendaDoom(state), before + 1)
  assert.equal(viewState(state, 1).agendaAside[0].code, '06233')
  const inv = state.investigators[1]
  const awakening = behavior.actions(state, inv).find(move => move.rule === 'tshFalseAwakening')
  assert.ok(awakening)
  const api = { ...actual, choice: () => 'agility', test: (seat, skill, difficulty, resolve) => {
    assert.deepEqual([seat, skill, difficulty], [1, 'agility', 4])
    resolve({ success: true })
  } }
  behavior.performAction(state, inv, awakening, api)
  assert.ok(!state.agendaAside.some(item => item.id === card.id))
  assert.ok(state.removedFromGame.includes('06233'))
  assert.equal(agendaDoom(state), before)
})

test('06203 月石：不能投入检定，作为手牌仍可弃置', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['06203', '01089']
  state.skillTest = { seat: 0, skill: 'willpower', explicitBaseValue: 2, difficulty: 3, committed: [] }
  const deps = { cardDef: code => ALL_CARDS[code], commitIcons: () => 1, registeredEntry }
  assert.equal(canCommitToTest(state, inv, '06203', deps), false)
  assert.equal(canCommitToTest(state, inv, '01089', deps), true)
  inv.resources = 0
  assert.equal(scenarioRuntime(state, []).discardFromHand(0, '06203'), true)
  assert.deepEqual(inv.discard, ['06203'])
  assert.deepEqual(inv.hand, ['01089'])
})
