// 06-a-7（TDE · pnr 06234–06275）逐卡验收补证测试。
//
// 目的：为 `tests/tde-scenario-pointOfNoReturn.test.mjs` / `tests/tde-player-m2-*.test.mjs` 里
// 没有「标题含卡号」的 35 张卡补真实执行证据（地点/故事/幕/密谋/玩家资产/敌人/诡计），
// 复验最近敌人、隧道和剧本参考卡伤害等共享读点。
//
// 全部走真实条目 / behavior / 共享 encounter-rules / 引擎原语读点；不依赖账本结论。
import test from 'node:test'
import assert from 'node:assert/strict'

import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { swarmCardsOf } from '../src/engine/swarm.js'
import { enemy, fixture } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { encounterRules } from '../content/campaigns/theDreamEaters/encounter-rules.js'
import * as pnr from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/index.js'
import {
  scenario as definition, ACT_ONE_VARIANTS, CODES, LOCATION_IDS, SEA_OF_PITCH_IDS,
  SET_ASIDE_GROUP_DECKS, REMOVE_FROM_GAME_DECKS,
} from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/definition.js'
import { referenceDamage, markerCountOf } from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/chaos.js'
import { swarmingSpec, swarmingXFromState } from '../src/engine/swarming.js'
import diary1 from '../src/cards/entries/06236.js'
import diary2 from '../src/cards/entries/06237.js'
import diary3 from '../src/cards/entries/06238.js'
import empowerCombat from '../src/cards/entries/06241.js'
import empowerAgility from '../src/cards/entries/06242.js'
import empowerIntellect from '../src/cards/entries/06243.js'
import gugCity from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06255.js'
import towerOfKoth from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06256.js'
import peaksOfThok from '../src/cards/encounter-entries/theDreamEaters/pointOfNoReturn/06260.js'
import shadowOfAtlachNacha from '../src/cards/encounter-entries/theDreamEaters/_shared/descent_into_the_pitch/06274.js'

const clone = value => JSON.parse(JSON.stringify(value))
const locDef = id => definition.locations[id]

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0, agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '06001', name: `调查员${seat + 1}`, location: 'vaultsOfZin',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], agendaAside: [],
    scenarioFlags: { storyResolved: {} }, scenarioZones: { setAside: [], removed: [] },
    markerCounts: {}, victoryDisplay: [], encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
    },
    numInvestigators: count, round: 1, phase: 'investigation', difficulty: 'standard', status: 'playing',
  }
}

function placeLocation(state, id) {
  if (state.locations.some(location => location.id === id)) return state.locations.find(location => location.id === id)
  const base = locDef(id)
  if (!base) return null
  const location = {
    ...clone(base), id, code: base.code, originalCode: base.code,
    revealed: true, clues: base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators,
    maxClues: base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators,
    doom: 0, attachments: [], flags: {},
  }
  state.locations.push(location)
  return location
}

function setupInitial(state) {
  for (const id of ['vaultsOfZin', 'cityOfGugs', 'towerOfKoth', 'plainOfTheGhouls']) placeLocation(state, id)
  state.investigators.forEach(inv => { inv.location = 'vaultsOfZin' })
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

// 收集式 api 桩：与引擎同名 API 同语义；信息/选择/检定可配置。
function apiFor(state, overrides = {}) {
  const calls = []
  const info = text => calls.push(['info', text])
  const api = {
    calls, info,
    choose: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    test: (seat, skill, difficulty, resolve) => {
      calls.push(['test', seat, skill, difficulty])
      const result = overrides.testResult || { success: true, value: difficulty, difficulty, skill }
      resolve(result)
      return result
    },
    spawn: (code, locationId) => {
      const enemy = { id: `spawn${calls.length}`, code, originalCode: code, name: code, location: locationId,
        doom: 0, clues: 0, damageTaken: 0, exhausted: false, engagedSeat: null, traits: [] }
      state.enemies.push(enemy)
      calls.push(['spawn', code, locationId])
      return enemy
    },
    place: id => {
      const placed = placeLocation(state, id)
      calls.push(['place', id])
      return placed
    },
    reveal: id => { calls.push(['reveal', id]); return loc(state, id) },
    flipLocation: (id, seat) => { calls.push(['flipLocation', id, seat]); return true },
    takeFromSetAside: code => {
      const list = state.scenarioZones.setAside || []
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      calls.push(['takeFromSetAside', code])
      return true
    },
    giveAsset: (seat, code, options = {}) => {
      const asset = { id: `asset:${code}`, code, originalCode: code, ...options }
      state.investigators[seat].assets.push(asset)
      calls.push(['giveAsset', seat, code])
      return asset
    },
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value; calls.push(['setCampaignRecord', key, value]) },
    campaignRecord: key => state.campaign.records[key] ?? null,
    shuffleIntoEncounterDeck: (codes, options) => {
      const list = Array.isArray(codes) ? codes : [codes]
      state.encounterDeck.push(...list)
      calls.push(['shuffleIntoEncounterDeck', list, options])
    },
    shuffleDiscard: () => calls.push(['shuffleDiscard']),
    shuffleEncounterDeck: () => calls.push(['shuffleEncounterDeck']),
    discardEncounterCard: code => {
      const deckIndex = state.encounterDeck.indexOf(code)
      if (deckIndex >= 0) state.encounterDeck.splice(deckIndex, 1)
      state.encounterDiscard.push(code)
      calls.push(['discardEncounterCard', code])
      return true
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.indexOf(code)
      if (index >= 0) state.encounterDiscard.splice(index, 1)
      calls.push(['takeEncounterDiscard', code])
      return index >= 0
    },
    attachToLocation: (id, spec) => { calls.push(['attachToLocation', id, spec]); return spec },
    attachEncounterToLocation: (code, locationId) => {
      const location = loc(state, locationId)
      if (!location) return null
      const attachment = { id: `locatt:${code}:${(location.attachments || []).length}`, code, originalCode: code }
      location.attachments = [...(location.attachments || []), attachment]
      calls.push(['attachEncounterToLocation', code, locationId])
      return attachment
    },
    addCluesToEnemy: (enemy, amount) => { enemy.clues = (enemy.clues || 0) + amount; calls.push(['addCluesToEnemy', enemy.code, amount]) },
    clearCluesOnEnemy: enemy => { const clues = enemy.clues || 0; enemy.clues = 0; calls.push(['clearCluesOnEnemy', enemy.code, clues]) },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount; calls.push(['gainClues', seat, amount]) },
    spendClues: (seat, amount) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - amount); calls.push(['spendClues', seat, amount]) },
    addCluesToLocation: (id, amount) => { const location = loc(state, id); if (location) location.clues = (location.clues || 0) + amount; calls.push(['addCluesToLocation', id, amount]) },
    removeLocationClues: (id, amount) => { const location = loc(state, id); if (location) location.clues = Math.max(0, (location.clues || 0) - amount); calls.push(['removeLocationClues', id, amount]) },
    shuffleLocationPositions: (ids, options) => calls.push(['shuffleLocationPositions', ids, options]),
    advanceAct: () => calls.push(['advanceAct']),
    finish: key => calls.push(['finish', key]),
    markers: { add: (id, delta) => { state.markerCounts[id] = (state.markerCounts[id] || 0) + delta; calls.push(['markers.add', id, delta]) } },
    removeDoom: amount => { calls.push(['removeDoom', amount]) },
    clearDoomOnCard: card => { if (card) card.doom = 0; calls.push(['clearDoomOnCard']) },
    discardRandom: (seat, amount) => calls.push(['discardRandom', seat, amount]),
    loseResources: (seat, amount) => { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount); calls.push(['loseResources', seat, amount]) },
    loseActions: (seat, amount) => calls.push(['loseActions', seat, amount]),
    scoutEncounterTop: (seat, options) => calls.push(['scoutEncounterTop', seat, options]),
    setLocationFlag: (id, flag, value) => { const location = loc(state, id); if (location) { location.flags ||= {}; location.flags[flag] = value } calls.push(['setLocationFlag', id, flag, value]) },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => { state.scenarioFlags[key] = value; calls.push(['setScenarioFlag', key, value]); return value },
    drawCards: (seat, amount) => { calls.push(['drawCards', seat, amount]); state.investigators[seat].hand.push(...Array(amount).fill('01020')) },
    exhaustEnemy: enemy => { enemy.exhausted = true; calls.push(['exhaustEnemy', enemy.code]) },
    engage: (enemy, seat) => { enemy.engagedSeat = seat; calls.push(['engage', enemy.code, seat]) },
    moveEnemy: (enemy, locationId) => { enemy.location = locationId; calls.push(['moveEnemy', enemy.code, locationId]) },
    readyEnemy: enemy => calls.push(['readyEnemy', enemy.code]),
    stepToward: (from, to) => { calls.push(['stepToward', from, to]); return overrides.stepToward ?? null },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.push(['damage', seat, amount]) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.push(['horror', seat, amount]) },
    applyPenalty: (seat, fail, amount, options) => calls.push(['applyPenalty', seat, fail, amount, options]),
    attack: (enemy, inv) => calls.push(['attack', enemy.code, inv?.seat]),
    takeFromVictory: code => { calls.push(['takeFromVictory', code]); return null },
    locationShroud: id => Number(loc(state, id)?.shroud) || 0,
    cardName: code => code,
    drawEncounter: seat => calls.push(['drawEncounter', seat]),
    discardUntilEnemy: (seat, predicate) => {
      const index = state.encounterDeck.findIndex(code => predicate(ALL_CARDS[code], code))
      if (index < 0) return null
      const code = state.encounterDeck.splice(index, 1)[0]
      calls.push(['discardUntilEnemy', seat, code])
      return code
    },
    ...overrides,
  }
  return api
}

// ---------------------------------------------------------------------------
// 玩家资产（06236–06238 梦境日记 / 06241–06243 增强自我）
// ---------------------------------------------------------------------------

test('验收 06236/06237/06238 梦境日记：研究完成门控 + 跨卡条件图标 +2 + 回合开始取回「梦的本质」', () => {
  const cases = [
    [diary1, '06236', s => { placeLocation(s, 'plainOfTheGhouls'); s.investigators[0].location = 'plainOfTheGhouls' }, '隐藏值≥4'],
    [diary2, '06237', s => { s.enemies.push({ id: 'e1', code: '06267', originalCode: '06267', location: 'vaultsOfZin', engagedSeat: 0 }) }, '与敌人交战'],
    [diary3, '06238', s => { s.investigators[0].hand = Array(8).fill('01020') }, '手牌≥8'],
  ]
  for (const [entry, code, prepare, label] of cases) {
    const state = setupInitial(stateFor(2))
    prepare(state)
    const api = apiFor(state)
    assert.equal(entry.code, code)
    assert.equal(entry.researchRequirement, 'youHaveInterpretedTheDreams', `${code} 研究完成门控`)
    assert.equal(entry.commitIconBonus({ state, inv: state.investigators[0], committedCode: '06113', api }), 2, `${code} ${label} 时「梦的本质」+2 万能图标`)
    assert.equal(entry.commitIconBonus({ state, inv: state.investigators[0], committedCode: '01020', api }), 0, `${code} 非「梦的本质」不授图标`)
    const reaction = entry.abilities[0]
    assert.equal(reaction.trigger, 'turnBegins')
    assert.equal(reaction.criteria[0]({ inv: state.investigators[0], context: { seat: 0 }, helpers: { bondedAvailable: () => 0 } }), false)
    assert.equal(reaction.criteria[0]({ inv: state.investigators[0], context: { seat: 0 }, helpers: { bondedAvailable: () => 1 } }), true)
    // 真实绑定检索读点：api.bonded.retrieve（引擎唯一入口）。
    const retrieved = []
    const api2 = apiFor(state, {
      bonded: { retrieve: (seat, host, options) => { retrieved.push([seat, host, options.handCount]); return ['06113'] } },
    })
    reaction.resolve({ inv: state.investigators[0], api: api2 })
    assert.deepEqual(retrieved, [[0, code, 1]], `${code} 回合开始从绑定卡检索 1 张`)
  }
})

test('验收 06241/06242/06243 增强自我：3 张共占 1 法术槽、属性替代可忽略、[fast] 横置 +2', () => {
  const cases = [
    [empowerCombat, '06241', 'combat', 'combat'],
    [empowerAgility, '06242', 'agility', 'agility'],
    [empowerIntellect, '06243', 'intellect', 'intellect'],
  ]
  for (const [entry, code, stat] of cases) {
    assert.equal(entry.code, code)
    assert.deepEqual(entry.sharedSlotGroup, { id: 'empowerSelf', slot: 'arcane', upTo: 3 }, `${code} 三张共占 1 法术槽`)
    assert.deepEqual(entry.ignoreSkillSubstitution, { from: stat, to: 'willpower' }, `${code} 可忽略「改用意志」的替代`)
    const ability = entry.abilities[0]
    assert.equal(ability.kind, 'free')
    assert.equal(ability.trigger, 'test.beforeCommit')
    assert.equal(ability.criteria[0]({ state: { skillTest: { skill: stat } } }), true, `${code} 仅本技能检定可用`)
    assert.equal(ability.criteria[0]({ state: { skillTest: { skill: 'willpower' } } }), false)
    const bonuses = []
    ability.resolve({ api: { addPendingTestBonus: value => bonuses.push(value) } })
    assert.deepEqual(bonuses, [2], `${code} 横置：本次检定 +2`)
    // 引擎读点存在性：条目注册后可被引擎按受限槽/属性替代读取。
    const registered = registeredEntry(code)
    assert.equal(registered?.sharedSlotGroup?.slot, 'arcane')
    assert.equal(registered?.ignoreSkillSubstitution?.to, 'willpower')
  }
})

// ---------------------------------------------------------------------------
// 幕 / 密谋（06248–06253）
// ---------------------------------------------------------------------------

test('验收 06248/06249 密谋推进：邪恶国度洗回弃牌+参考卡伤害；怪物围困选择/翻回/≥5 进结局 2', () => {
  const state = setupInitial(stateFor(2))
  state.agendaIndex = 0
  const api = apiFor(state)
  pnr.behavior.agendaAdvancing(state, state.agendas[0], api)
  assert.ok(api.calls.some(call => call[0] === 'shuffleDiscard'), '06248：遭遇弃牌堆洗回')
  assert.deepEqual(api.calls.find(call => call[0] === 'markers.add'), ['markers.add', 'reference', 1], '06248：参考卡放 1 点伤害')

  // 06249：Distortion < 5 → 选择 + 翻回正面（不推进）。
  const revert = setupInitial(stateFor(2))
  revert.agendaIndex = 1
  revert.markerCounts.reference = 3
  revert.investigators.forEach(inv => { inv.hand = ['01020']; inv.resources = 3 })
  const revertApi = apiFor(revert)
  const advanced = pnr.behavior.agendaWouldAdvance(revert, revertApi)
  assert.equal(advanced, true, '取消推进（翻回正面）')
  assert.ok(revertApi.calls.some(call => call[0] === 'discardRandom'), '每位调查员选择随机弃 1 张手牌或失去资源')
  assert.equal(revert.markerCounts.reference, 4, '参考卡再放 1 点伤害')
  assert.ok(revertApi.calls.some(call => call[0] === 'removeDoom') && revertApi.calls.some(call => call[0] === 'clearDoomOnCard'))

  // Distortion ≥ 5 → 结局 2。
  const finish = setupInitial(stateFor(2))
  finish.agendaIndex = 1
  finish.markerCounts.reference = 5
  const finishApi = apiFor(finish)
  pnr.behavior.agendaWouldAdvance(finish, finishApi)
  assert.ok(finishApi.calls.some(call => call[0] === 'finish' && call[1] === 'resolution2'), '参考卡伤害 ≥5 → 进入结局 2')
})

test('验收 06250/06251 进入地下世界 v.I/v.II：山谷地点入场、遭遇组移出/洗入、v.II 由指定调查员控制皮克曼，离场时移出游戏', () => {
  const state = setupInitial(stateFor(2))
  state.scenarioZones.setAside = [...Object.values(SET_ASIDE_GROUP_DECKS).flat()]
  const api = apiFor(state)
  const actV1 = state.acts[0]
  assert.equal(actV1.originalCode, '06250')
  pnr.behavior.actLeftPlay(state, actV1, api)
  const placedVale = ['cragOfTheGhouls', 'seaOfBones', 'peaksOfThok', 'valeOfPnath'].filter(id => loc(state, id))
  assert.equal(placedVale.length, 4, '06250：每个放一边的[[山谷]]地点入场')
  assert.ok(state.scenarioZones.removed.length > 0, '06250：食尸鬼/恐惧打击遭遇组移出游戏')
  assert.ok(api.calls.some(call => call[0] === 'shuffleIntoEncounterDeck'), '06250：恐怖谷+夜魇组洗入遭遇牌库')
  assert.ok(api.calls.some(call => call[0] === 'shuffleDiscard'), '06250：与遭遇弃牌堆一起洗入')
  const removedGhouls = state.scenarioZones.removed.filter(code => REMOVE_FROM_GAME_DECKS.ghouls.includes(code))
  assert.ok(removedGhouls.length > 0, '移出组包含食尸鬼组卡牌')

  const v2 = setupInitial(stateFor(2))
  v2.scenarioZones.setAside = [...Object.values(SET_ASIDE_GROUP_DECKS).flat(), CODES.richardUptonPickman]
  v2.acts = [clone(ACT_ONE_VARIANTS.v2), ...v2.acts.slice(1)]
  const v2Api = apiFor(v2, { choose: () => '1' })
  pnr.behavior.actLeftPlay(v2, v2.acts[0], v2Api)
  assert.ok(v2Api.calls.some(call => call[0] === 'giveAsset' && call[2] === '06266'), '06251：选一位调查员控制放一边的皮克曼')
  assert.equal(v2.scenarioFlags.pickmanSeat, 1)
  assert.ok(!v2.scenarioZones.setAside.includes('06266'))
  assert.ok(!v2.scenarioZones.removed.some(code => REMOVE_FROM_GAME_DECKS.ghouls.includes(code)), 'v.II 不移除食尸鬼组')
  const pickman = v2.investigators[1].assets.find(asset => asset.code === '06266')
  const production = fixture('01001', 2)
  production.investigators[1].assets.push(pickman)
  const ordinary = { ...pickman, id: 'ordinary', removeFromGameOnLeave: false }
  production.investigators[0].assets.push(ordinary)
  const runtime = scenarioRuntime(production, [])
  assert.equal(runtime.discardAsset(1, pickman.id), '06266')
  assert.ok(production.removedFromGame.includes('06266'))
  assert.ok(!production.investigators[1].discard.includes('06266'))
  assert.equal(runtime.discardAsset(0, ordinary.id), '06266')
  assert.ok(production.investigators[0].discard.includes('06266'))
})

test('验收 06252/06253 深入/无边黑暗：深海地点入场+洗入组；无边黑暗推进→结局 1', () => {
  const state = setupInitial(stateFor(2))
  state.scenarioZones.setAside = [...Object.values(SET_ASIDE_GROUP_DECKS).flat()]
  state.actIndex = 1
  const api = apiFor(state)
  pnr.behavior.actLeftPlay(state, state.acts[1], api)
  assert.equal(state.acts[1].originalCode, '06252')
  assert.equal(SEA_OF_PITCH_IDS.filter(id => loc(state, id)).length, 4, '06252：每个放一边的[[深海]]地点入场')
  assert.ok(api.calls.some(call => call[0] === 'shuffleIntoEncounterDeck'), '06252：深入漆黑之海+阿特拉克·纳克亚的使徒组洗入')
  const finish = setupInitial(stateFor(2))
  finish.actIndex = 2
  const finishApi = apiFor(finish)
  pnr.behavior.actLeftPlay(finish, finish.acts[2], finishApi)
  assert.equal(finish.acts[2].originalCode, '06253')
  assert.ok(finishApi.calls.some(call => call[0] === 'finish' && call[1] === 'resolution1'), '06253：推进→结局 1')
})

// ---------------------------------------------------------------------------
// 地点 + 背面故事（06254–06265 及 06254b–06265b）
// ---------------------------------------------------------------------------

test('验收 06254/06254b 辛之墓穴 + 阴森隧道：掩藏翻面后找出[[噩妖]]横置生成并带 1 线索', () => {
  const state = setupInitial(stateFor(2))
  const vaults = loc(state, 'vaultsOfZin')
  assert.equal(vaults.originalCode, '06254')
  assert.equal(vaults.veiled, true, '06254：掩藏关键词')
  const api = apiFor(state)
  api.discardUntilEnemy = (seat, predicate) => {
    const index = state.encounterDeck.findIndex(code => predicate(ALL_CARDS[code], code))
    if (index < 0) return null
    const code = state.encounterDeck.splice(index, 1)[0]
    api.calls.push(['discardUntilEnemy', seat, code])
    return code
  }
  state.encounterDeck = ['06254b', '06091', '01020']
  pnr.behavior.locationFlipped(state, vaults, api, 0)
  const spawnCall = api.calls.find(call => call[0] === 'spawn')
  assert.ok(spawnCall, '06254b：找出敌人并生成')
  assert.deepEqual(spawnCall[2], 'vaultsOfZin', '生成在辛之墓穴')
  const enemy = state.enemies.find(entry => entry.code === spawnCall[1])
  assert.equal(enemy.clues, 1, '06254b：敌人带 1 个线索')
  assert.equal(enemy.exhausted, true, '06254b：横置生成')
  assert.ok(api.calls.some(call => call[0] === 'shuffleEncounterDeck'), '06254b：混洗遭遇牌库')
})

test('验收 06255/06255b 古革巨人之城 + 岗哨：进入强制翻面；生成哨兵并敏捷(3)决定横置/交战', () => {
  const state = setupInitial(stateFor(2))
  const city = loc(state, 'cityOfGugs')
  assert.equal(city.originalCode, '06255')
  const enterApi = apiFor(state)
  gugCity.locationRule.onEnter.effect(state, city, enterApi, state.investigators[0])
  assert.ok(enterApi.calls.some(call => call[0] === 'flipLocation' && call[1] === 'cityOfGugs'), '06255：进入后强制翻面')
  gugCity.locationRule.onEnter.effect(state, city, enterApi, state.investigators[0])
  assert.equal(enterApi.calls.filter(call => call[0] === 'flipLocation').length, 1, '只翻一次')

  // 06255b：生成哨兵；成功 → 横置不交战。
  const success = setupInitial(stateFor(2))
  success.scenarioZones.setAside = ['06267']
  const successApi = apiFor(success, { testResult: { success: true, value: 3, difficulty: 3 } })
  pnr.behavior.locationFlipped(success, loc(success, 'cityOfGugs'), successApi, 0)
  const sentry = success.enemies.find(enemy => enemy.code === '06267')
  assert.ok(sentry, '06255b：生成放一边的古革哨兵')
  assert.equal(sentry.exhausted, true, '敏捷(3)成功：横置入场')
  assert.equal(sentry.engagedSeat, null, '成功：不交战')
  assert.equal(sentry.clues, 2, '1[per_investigator] 线索（2 人局 = 2）')
  // 失败 → 交战。
  const fail = setupInitial(stateFor(2))
  fail.scenarioZones.setAside = ['06267']
  const failApi = apiFor(fail, { testResult: { success: false, value: 1, difficulty: 3 } })
  pnr.behavior.locationFlipped(fail, loc(fail, 'cityOfGugs'), failApi, 0)
  assert.equal(fail.enemies.find(enemy => enemy.code === '06267').engagedSeat, 0, '检定失败：与调查员交战')
})

test('验收 06256/06256b 卡斯之塔 + 另一条路：战斗(5)翻面，揭示魔幻森林并记录战役日志', () => {
  const state = setupInitial(stateFor(2))
  const tower = loc(state, 'towerOfKoth')
  assert.equal(tower.originalCode, '06256')
  const api = apiFor(state)
  pnr.behavior.performAction(state, state.investigators[0], { rule: 'flipLocation:towerOfKoth' }, api)
  assert.deepEqual(api.calls.find(call => call[0] === 'test'), ['test', 0, 'combat', 5], '06256：[action] 检定战斗(5)')
  assert.ok(api.calls.some(call => call[0] === 'flipLocation'), '检定成功翻面')
  state.scenarioZones.setAside = ['06053']
  const storyApi = apiFor(state)
  pnr.behavior.locationFlipped(state, tower, storyApi, 0)
  assert.ok(storyApi.calls.some(call => call[0] === 'place' && call[1] === 'enchantedWoods'), '06256b：放一边的魔幻森林（石板暗门）入场')
  assert.ok(storyApi.calls.some(call => call[0] === 'reveal' && call[1] === 'enchantedWoods'), '以已揭示状态入场')
  assert.equal(state.campaign.records.theInvestigatorsFoundAWayOutOfTheUnderworld, true, '06256b：写入战役记录')
})

test('验收 06257/06257b 食尸鬼平原 + 诡异食尸鬼：古革生成改道/禁入；线索门槛不足翻回、足够推进', () => {
  const state = setupInitial(stateFor(2))
  const api = apiFor(state)
  const redirect = pnr.behavior.spawnLocation(state, '06267', 'plainOfTheGhouls', 0, api)
  assert.equal(redirect, 'cityOfGugs', '06257：[[古革巨人]]改在古革巨人之城生成')
  const gug = { id: 'gug', code: '06267', originalCode: '06267', location: 'plainOfTheGhouls', traits: [] }
  state.enemies.push(gug)
  pnr.behavior.enemyMoved(state, gug, 'plainOfTheGhouls', api, 'vaultsOfZin')
  assert.equal(gug.location, 'cityOfGugs', '06257：[[古革巨人]]不能进入食尸鬼平原（移动改道）')

  // 06257b：线索不足 → 翻回（可再次翻面）。
  const low = setupInitial(stateFor(2))
  low.investigators.forEach(inv => { inv.clues = 1 })
  const lowApi = apiFor(low)
  pnr.behavior.locationFlipped(low, loc(low, 'plainOfTheGhouls'), lowApi, 0)
  assert.ok(!lowApi.calls.some(call => call[0] === 'advanceAct'), '线索不足不推进')
  assert.equal(low.scenarioFlags[`pnrStory:${'plainOfTheGhouls'}`], undefined, '翻回后可再次翻面')
  // 线索足够 → 共同花费 3[per_investigator] 并推进。
  const high = setupInitial(stateFor(2))
  high.investigators[0].clues = 4
  high.investigators[1].clues = 2
  const highApi = apiFor(high)
  pnr.behavior.locationFlipped(high, loc(high, 'plainOfTheGhouls'), highApi, 0)
  assert.ok(highApi.calls.some(call => call[0] === 'advanceAct'), '线索足够：推进当前幕')
  assert.ok(highApi.calls.some(call => call[0] === 'spendClues'))
})

test('验收 06258/06258b 食尸鬼峭壁 + 探查山谷：首张诡计涌动；查看遭遇牌库顶并忽略本地点文本', () => {
  const state = setupInitial(stateFor(2))
  placeLocation(state, 'cragOfTheGhouls')
  const inv = state.investigators[0]
  inv.location = 'cragOfTheGhouls'
  state.phase = 'mythos'
  assert.equal(pnr.behavior.encounterGainsSurge(state, '06269', inv), true, '06258：神话阶段本地第一张诡计获得涌动')
  assert.equal(pnr.behavior.encounterGainsSurge(state, '06269', inv), undefined, '同一轮/同一调查员只一次')
  state.phase = 'investigation'
  assert.equal(pnr.behavior.encounterGainsSurge(state, '06269', inv), undefined, '非神话阶段不触发')

  state.phase = 'investigation'
  const api = apiFor(state)
  pnr.behavior.locationFlipped(state, loc(state, 'cragOfTheGhouls'), api, 0)
  const scout = api.calls.find(call => call[0] === 'scoutEncounterTop')
  assert.ok(scout, '06258b：查看遭遇牌库顶 2[per_investigator] 张')
  assert.equal(scout[2].count, 4, '2 人局 = 4 张')
  assert.ok(api.calls.some(call => call[0] === 'setLocationFlag' && call[2] === 'ignoreText' && call[3] === true), '06258b：本场游戏忽略食尸鬼峭壁文本')
})

test('验收 06259/06259b 骸骨之海 + 下方之物：发现线索翻面；附属巨噬蠕虫隧道并拉来巨噬蠕虫', () => {
  const state = setupInitial(stateFor(2))
  placeLocation(state, 'seaOfBones')
  const sea = loc(state, 'seaOfBones')
  assert.equal(sea.originalCode, '06259')
  const api = apiFor(state)
  pnr.behavior.cluesRemoved(state, sea, 1, api)
  assert.ok(api.calls.some(call => call[0] === 'flipLocation' && call[1] === 'seaOfBones'), '06259：发现线索后强制翻面')

  state.encounterDeck = ['06272', '06271']
  state.encounterDiscard = []
  const storyApi = apiFor(state)
  state.scenarioFlags.storyResolved = {}
  delete state.scenarioFlags['pnrStory:seaOfBones']
  pnr.behavior.locationFlipped(state, sea, storyApi, 0)
  assert.ok(storyApi.calls.some(call => call[0] === 'attachEncounterToLocation' && call[1] === '06272'), '06259b：将巨噬蠕虫隧道附属到骸骨之海')
  assert.ok(storyApi.calls.some(call => call[0] === 'shuffleEncounterDeck'), '06259b：混洗遭遇牌库')
  const dhole = state.enemies.find(enemy => enemy.code === '06271')
  assert.ok(dhole && dhole.location === 'seaOfBones', '06259b：滑行的巨噬蠕虫在此生成/移动到此')
  assert.equal(dhole.clues, 2, '06259b：在其上放 2 个线索')
  assert.equal(dhole.exhausted, true, '06259b：横置生成')
})

test('验收 06260/06260b 撒克山峰 + 山谷住民：攀登翻面、离开检定、生成夜魇/抽牌/放线索', () => {
  const state = setupInitial(stateFor(2))
  placeLocation(state, 'peaksOfThok')
  placeLocation(state, 'valeOfPnath')
  const peaks = loc(state, 'peaksOfThok')
  assert.equal(peaks.originalCode, '06260')
  const api = apiFor(state)
  pnr.behavior.performAction(state, state.investigators[0], { rule: 'flipLocation:peaksOfThok' }, api)
  assert.deepEqual(api.calls.find(call => call[0] === 'test'), ['test', 0, 'agility', 5], '06260：[action] 检定敏捷(5)')
  assert.ok(api.calls.some(call => call[0] === 'flipLocation'))
  assert.deepEqual(peaksOfThok.locationRule.onLeave.test, { skill: 'agility', difficulty: 2 }, '06260：离开时敏捷(2)')
  const leaveApi = apiFor(state)
  peaksOfThok.locationRule.onLeave.onFail(state, peaks, leaveApi, state.investigators[0])
  assert.ok(leaveApi.calls.some(call => call[0] === 'damage' && call[1] === 0 && call[2] === 1), '离开检定失败受到 1 点伤害')

  state.encounterDeck = ['01172']
  state.investigators[0].location = 'peaksOfThok'
  state.investigators[1].location = 'peaksOfThok'
  state.enemies.push({ id: 'target', code: '06267', originalCode: '06267', location: 'vaultsOfZin', defeated: false })
  const storyApi = apiFor(state)
  pnr.behavior.locationFlipped(state, peaks, storyApi, 0)
  const nightgaunt = state.enemies.find(enemy => enemy.code === '01172')
  assert.ok(nightgaunt && nightgaunt.location === 'valeOfPnath', '06260b：夜魇生成在潘斯山谷')
  assert.equal(nightgaunt.exhausted, true, '以横置状态生成')
  assert.equal(storyApi.calls.filter(call => call[0] === 'drawCards').length, 2, '06260b：撒克山峰的每位调查员抽 2 张')
  assert.ok(storyApi.calls.some(call => call[0] === 'addCluesToEnemy' && call[2] === 2), '06260b：在任意敌人上放 2 个线索')
})

test('验收 06261/06261b 潘斯山谷 + 逃生之路：仍有线索时禁止打出/投入；团队线索门槛后推进', () => {
  const state = setupInitial(stateFor(2))
  placeLocation(state, 'valeOfPnath')
  const vale = loc(state, 'valeOfPnath')
  assert.equal(vale.originalCode, '06261')
  vale.clues = 2
  state.investigators.forEach(inv => { inv.location = 'valeOfPnath' })
  assert.equal(pnr.behavior.canPlayCard(state, state.investigators[0], {}), false, '06261：仍有线索时不能打出卡牌')
  assert.equal(pnr.behavior.canCommitCard(state, state.investigators[0], '01020'), false, '06261：仍有线索时不能投入卡牌')
  vale.clues = 0
  assert.equal(pnr.behavior.canPlayCard(state, state.investigators[0], {}), undefined, '线索清空后恢复')
  assert.equal(pnr.behavior.canCommitCard(state, state.investigators[0], '01020'), undefined)
  // 06261b：线索足够 → 共同花费并推进。
  state.investigators[0].clues = 4
  state.investigators[1].clues = 2
  const api = apiFor(state)
  pnr.behavior.locationFlipped(state, vale, api, 0)
  assert.ok(api.calls.some(call => call[0] === 'spendClues') && api.calls.some(call => call[0] === 'advanceAct'), '06261b：共同花费 3[per_investigator] 线索并推进当前幕')
})

test('验收 06262/06262b 漆黑之海 + 蛛群之海：帷幕 = 参考卡伤害；弃到蜘蛛生成并带线索', () => {
  const state = setupInitial(stateFor(2))
  for (const id of SEA_OF_PITCH_IDS) placeLocation(state, id)
  const sea = loc(state, 'seaOfPitch262')
  assert.equal(sea.originalCode, '06262')
  state.markerCounts.reference = 3
  assert.equal(pnr.behavior.locationShroudModifier(state, sea), 3, '06262：帷幕 X = 剧本参考卡伤害数')
  state.markerCounts.reference = 0
  assert.equal(pnr.behavior.locationShroudModifier(state, sea), 0)

  state.markerCounts.reference = 2
  const api = apiFor(state)
  state.encounterDeck = ['06273', '01020']
  state.encounterDiscard = ['01021']
  pnr.behavior.locationFlipped(state, sea, api, 0)
  assert.ok(api.calls.some(call => call[0] === 'shuffleDiscard'), '06262b：遭遇弃牌堆洗回遭遇牌库')
  const spider = state.enemies.find(enemy => enemy.code === '06273')
  assert.ok(spider && spider.location === 'seaOfPitch262', '06262b：弃到蜘蛛敌人生成在此')
  assert.equal(spider.clues, 2, '06262b：带 1[per_investigator] 线索（2 人局）')
})

test('验收 06263/06263b 漆黑之海 + 平静海面：帷幕 X；查看另一张漆黑之海的背面', () => {
  const state = setupInitial(stateFor(2))
  for (const id of SEA_OF_PITCH_IDS) placeLocation(state, id)
  const sea = loc(state, 'seaOfPitch263')
  assert.equal(sea.originalCode, '06263')
  state.markerCounts.reference = 2
  assert.equal(pnr.behavior.locationShroudModifier(state, sea), 2, '06263：帷幕 X = 参考卡伤害数')
  const api = apiFor(state)
  pnr.behavior.locationFlipped(state, sea, api, 0)
  const info = api.calls.filter(call => call[0] === 'info').map(call => call[1]).join('\n')
  assert.match(info, /漆黑之海/, '06263b：查看另一张漆黑之海的背面（信息效果）')
})

test('验收 06264/06264b 漆黑之海 + 起伏的漩涡：线索原样收回再平均分配、位置重洗、可再翻面', () => {
  const state = setupInitial(stateFor(2))
  for (const id of SEA_OF_PITCH_IDS) placeLocation(state, id)
  const sea = loc(state, 'seaOfPitch264')
  assert.equal(sea.originalCode, '06264')
  loc(state, 'seaOfPitch262').clues = 3
  loc(state, 'seaOfPitch263').clues = 1
  loc(state, 'seaOfPitch264').clues = 0
  loc(state, 'seaOfPitch265').clues = 0
  state.scenarioFlags.storyResolved = { seaOfPitch262: '06262b' }
  const api = apiFor(state)
  pnr.behavior.locationFlipped(state, sea, api, 0)
  assert.ok(api.calls.some(call => call[0] === 'removeLocationClues'), '06264b：各漆黑之海的线索先收回')
  const shuffled = api.calls.find(call => call[0] === 'shuffleLocationPositions')
  assert.ok(shuffled, '06264b：重洗漆黑之海的位置')
  assert.equal(shuffled[1].length, 4)
  assert.equal(shuffled[2].preserveOccupants, true, '调查员与敌人留在原位置')
  const totalAdded = api.calls.filter(call => call[0] === 'addCluesToLocation').reduce((sum, call) => sum + call[2], 0)
  assert.equal(totalAdded, 4, '06264b：4 个线索尽可能平均分配回去')
  assert.equal(state.scenarioFlags.storyResolved.seaOfPitch262, undefined, '各漆黑之海可再次用掩藏关键词翻面')
})

test('验收 06265/06265b 漆黑之海 + 大海中央：团队线索门槛；足够时共同花费并推进', () => {
  const state = setupInitial(stateFor(2))
  for (const id of SEA_OF_PITCH_IDS) placeLocation(state, id)
  const sea = loc(state, 'seaOfPitch265')
  assert.equal(sea.originalCode, '06265')
  state.markerCounts.reference = 1
  assert.equal(pnr.behavior.locationShroudModifier(state, sea), 1, '06265：帷幕 X = 参考卡伤害数')
  // 线索不足 → 翻回。
  state.investigators.forEach(inv => { inv.clues = 1 })
  const lowApi = apiFor(state)
  pnr.behavior.locationFlipped(state, sea, lowApi, 0)
  assert.ok(!lowApi.calls.some(call => call[0] === 'advanceAct'))
  assert.equal(state.scenarioFlags['pnrStory:seaOfPitch265'], undefined, '线索不足翻回后可再次翻面')
  // 线索足够 → 共同花费并推进。
  state.investigators[0].clues = 4
  state.investigators[1].clues = 3
  const highApi = apiFor(state)
  pnr.behavior.locationFlipped(state, sea, highApi, 0)
  assert.ok(highApi.calls.some(call => call[0] === 'advanceAct'), '06265b：共同花费 3[per_investigator] 线索后推进当前幕')
})

// ---------------------------------------------------------------------------
// 复验 06268、06270、06272 的真实距离、移动与区域结算
// ---------------------------------------------------------------------------

function pathState() {
  const state = fixture()
  const ids = ['a', 'b', 'c', 'd']
  state.locations = ids.map((id, index) => ({
    id, name: id, code: '01111', revealed: true, clues: 0, attachments: [],
    connections: [ids[index - 1], ids[index + 1]].filter(Boolean),
  }))
  state.investigators[0].location = 'a'
  return state
}

function runResolution(state, resolve, select = () => null) {
  resolveTransaction(state, 0, { action: 'acceptanceShard7' }, resolve)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 20, '选择必须收敛')
    const choice = state.pendingChoice
    const id = select(choice) ?? choice.options.find(item => item.id === 'self')?.id ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, resolve)
  }
}

function failTest(state, failedBy) {
  return {
    ...scenarioRuntime(state, []),
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, failedBy, difficulty, value: difficulty - failedBy }),
  }
}

test('验收 06268 鲜血的滋味：可把线索放到相距三个连接的最近敌人上', () => {
  const state = pathState()
  enemy(state, { location: 'd', engagedSeat: null })
  state.investigators[0].clues = 2
  const execute = current => registeredEntry('06268').encounterResolve(current, current.investigators[0], null, failTest(current, 2))
  runResolution(state, execute, choice => choice.options.some(option => option.id === 'enemy') ? 'enemy' : null)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.enemies[0].clues, 2)
  assert.equal(state.investigators[0].damage, 0)
})

test('验收 06270 意外伏击：失败差值达到 3，远处最近敌人重整、移动、交战并立即攻击', () => {
  const state = pathState()
  enemy(state, { location: 'd', exhausted: true, damage: 1, engagedSeat: null })
  const execute = current => registeredEntry('06270').encounterResolve(current, current.investigators[0], null, failTest(current, 3))
  runResolution(state, execute)
  assert.equal(state.enemies[0].location, 'a')
  assert.equal(state.enemies[0].exhausted, false)
  assert.equal(state.enemies[0].engagedSeat, 0)
  assert.equal(state.investigators[0].damage, 1)
})

test('验收 06272 巨噬蠕虫隧道：按既有隧道的距离选址，并从胜利区取出敌人横置生成', () => {
  const state = pathState()
  loc(state, 'b').attachments.push({ id: 'oldTunnel', code: '06272' })
  state.victoryDisplay = [{ id: 'victoryDhole', code: '06271', victory: 1 }]
  const tunnel = registeredEntry('06272')
  const execute = current => tunnel.encounterResolve(current, current.investigators[0], null, scenarioRuntime(current, []))
  assert.equal(execute(state), true)
  assert.equal(loc(state, 'c').attachments.length, 0)
  assert.equal(loc(state, 'd').attachments[0].code, '06272')
  assert.equal(state.victoryDisplay.length, 0)
  assert.equal(state.enemies[0].code, '06271')
  assert.equal(state.enemies[0].location, 'd')
  assert.equal(state.enemies[0].exhausted, true)
  assert.equal(state.enemies[0].engagedSeat, null)
})

// ---------------------------------------------------------------------------
// 敌人 / 诡计（06271 / 06273 / 06274）
// ---------------------------------------------------------------------------

test('验收 06271 滑行的巨噬蠕虫：生成点=最近隧道地点、失败洗回+涌动、移动时隧道地点互相连接', () => {
  const state = setupInitial(stateFor(2))
  placeLocation(state, 'cragOfTheGhouls')
  const city = loc(state, 'cityOfGugs')
  city.attachments = [{ id: 't1', code: '06272', originalCode: '06272' }]
  const api = apiFor(state)
  const spawnId = encounterRules.spawnLocation(state, '06271', 'towerOfKoth', 0, api)
  assert.equal(spawnId, 'cityOfGugs', '06271：生成在最近的附属巨噬蠕虫隧道的地点')
  assert.equal(encounterRules.spawnLocation(state, '06271', 'towerOfKoth', 0, api), 'cityOfGugs')
  // 生成失败：洗回遭遇牌库 + 涌动。
  const failApi = apiFor(state)
  encounterRules.spawnFailed(state, '06271', 1, failApi)
  assert.ok(failApi.calls.some(call => call[0] === 'takeEncounterDiscard' && call[1] === '06271'), '生成失败：先取出该卡')
  assert.ok(failApi.calls.some(call => call[0] === 'shuffleIntoEncounterDeck' && Array.isArray(call[1]) && call[1][0] === '06271'), '生成失败：洗回遭遇牌库')
  assert.ok(failApi.calls.some(call => call[0] === 'drawEncounter' && call[1] === 1), '生成失败：该敌人获得涌动（再抽 1 张遭遇牌）')
  // 「移动时隧道地点互相连接」：共享 enemyConnections 读点。
  placeLocation(state, 'seaOfBones')
  loc(state, 'seaOfBones').attachments = [{ id: 't2', code: '06272', originalCode: '06272' }]
  const dhole = { id: 'dhole', code: '06271', originalCode: '06271', location: 'cityOfGugs' }
  state.enemies.push(dhole)
  const connected = encounterRules.enemyConnections(state, dhole, city)
  assert.deepEqual(connected, ['seaOfBones'], '06271：移动时所有带巨噬蠕虫隧道的地点视作互相连接')
})

test('验收 06273 漆黑蜘蛛：生成点=无人漆黑之海；攻击伤害/恐惧二选一；蜂拥 X 随参考卡伤害变化', () => {
  const state = setupInitial(stateFor(2))
  for (const id of SEA_OF_PITCH_IDS) placeLocation(state, id)
  state.investigators[0].location = 'seaOfPitch262'
  const api = apiFor(state)
  const spawnId = encounterRules.spawnLocation(state, '06273', 'cityOfGugs', 0, api)
  assert.equal(spawnId, 'seaOfPitch263', '06273：生成在无人的漆黑之海地点')
  const spider = { id: 'spider', code: '06273', originalCode: '06273', location: 'seaOfPitch263', traits: [] }
  state.enemies.push(spider)
  const damageApi = apiFor(state, { choose: () => 'damage' })
  assert.deepEqual(encounterRules.beforeEnemyHarm(state, spider, state.investigators[0], { damage: 2, horror: 1 }, damageApi),
    { damage: 2, horror: 0 }, '06273：攻击改为只造成伤害')
  const horrorApi = apiFor(state, { choose: () => 'horror' })
  assert.deepEqual(encounterRules.beforeEnemyHarm(state, spider, state.investigators[0], { damage: 2, horror: 1 }, horrorApi),
    { damage: 0, horror: 1 }, '06273：攻击改为只造成恐惧')
  const production = pathState()
  production.scenario = clone(definition)
  production.markerCounts = { reference: 3 }
  production.scenarioFlags.referenceDamage = 9
  const host = enemy(production, {
    code: '06273', originalCode: '06273', location: 'a',
    swarming: swarmingSpec(ALL_CARDS['06273'].text), engagedSeat: 0,
  })
  encounterRules.enemySpawned(production, host, scenarioRuntime(production, []))
  assert.equal(referenceDamage(production), 3)
  assert.equal(swarmingXFromState(production, 'scenarioDamage'), 3)
  assert.equal(swarmCardsOf(host).length, 3)
  assert.equal(production.investigators[0].deck.length, 27)
})

test('验收 06274 阿特拉克·纳克亚之影：以参考卡伤害加成难度，失败受伤害与恐惧', () => {
  const state = pathState()
  state.markerCounts = { reference: 3 }
  state.scenarioFlags.referenceDamage = 9
  const execute = current => shadowOfAtlachNacha.encounterResolve(current, current.investigators[0], null, {
    ...scenarioRuntime(current, []),
    test: (seat, skill, difficulty, resolve) => {
      assert.deepEqual([seat, skill, difficulty], [0, 'willpower', 5])
      resolve({ success: false, value: 0, difficulty })
    },
  })
  runResolution(state, execute)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
})

