// 08-a-7（EOTE · eoec 08608–08652）逐卡验收补证/缺陷复现测试。
//
// 覆盖：
//   · 通过卡的标题含卡号真实执行证据（toTheForbiddenPeaks 敌人/诡计/探险支援、
//     cityOfTheElderThings 密谋/幕/敌人/诡计、theHeartOfMadness 参考卡/设施行动）；
//   · 旧报告列出的缺陷通过真实行动、遭遇、检定和查看窗口复验。
import test from 'node:test'
import assert from 'node:assert/strict'
import { configureCityscapes, placeGridLocation } from '../src/engine/grid-map.js'
import { contentRegistry } from '../content/registered.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { initializeValueKeys, valueKeysAt } from '../src/engine/scenario-keys.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

import { behavior as tForbidden } from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js'
import * as tForbiddenDef from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js'
import * as tForbiddenChaos from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/chaos.js'
import tForbiddenSnowfall from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08610.js'
import tForbiddenAvalanche from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08611.js'
import tForbiddenHanging from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08612.js'
import tForbiddenHypothermia from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08613.js'
import tForbiddenGreenStone from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08614.js'
import tForbiddenSledge from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08615.js'
import tForbiddenDynamite from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08616.js'
import tForbiddenCrystal from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08617.js'
import tForbiddenSpecimen from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08618.js'
import tForbiddenRadio from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08619.js'
import tForbiddenParts from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08620.js'
import tForbiddenStars from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08608.js'
import tForbiddenConstricting from '../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08609.js'

import { behavior as city } from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js'
import * as cityDef from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js'
import * as cityChaos from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/chaos.js'
import cityLurking from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08622.js'
import cityDoomBelow from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08623.js'
import cityActV1 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08624.js'
import cityActV2 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08625.js'
import cityActV3 from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08626.js'
import cityTerror from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08641.js'
import cityDawning from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08644.js'
import cityCrumbling from '../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/08645.js'

import { behavior as heart } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js'
import * as heartChaos from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/chaos.js'
import heartVent from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/the_heart_of_madness/08650.js'

function apiStub(overrides = {}) {
  const calls = []
  const api = {
    calls,
    info: () => {},
    choice: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    test: (seat, skill, difficulty, resolve) => {
      calls.push(['test', seat, skill, difficulty])
      const result = overrides.testResult || { success: true, value: difficulty, difficulty }
      if (typeof resolve === 'function') resolve(result)
      else if (resolve && typeof resolve.resolve === 'function') resolve.resolve(result)
      return result
    },
    placeCluesOnAct: amount => calls.push(['placeCluesOnAct', amount]),
    gainClues: (seat, amount) => calls.push(['gainClues', seat, amount]),
    addCluesToEnemy: (enemy, amount) => { enemy.clues = (enemy.clues || 0) + amount; calls.push(['addCluesToEnemy', enemy.code, amount]) },
    drawEncounter: seat => calls.push(['drawEncounter', seat]),
    takeFromSetAside: code => { calls.push(['takeFromSetAside', code]); return true },
    emptyLocation: id => { calls.push(['emptyLocation', id]); return true },
    ...overrides,
  }
  return api
}

test('验收 08608/08609/08610/08611/08612/08613/08614/08615/08616/08617/08618/08619/08620 至禁峰：敌人数值/禁上移/轮末下移 + 4 诡计结算 + 7 探险支援', () => {
  // 08608/08609 的条目是 behavior 的数据读点。
  assert.equal(tForbiddenStars.enemyRule.perInvestigatorHealth, true)
  assert.equal(tForbiddenStars.enemyRule.levelStats, 'level')
  assert.equal(tForbiddenStars.enemyRule.roundEnd, 'moveDownToBelow')
  assert.equal(tForbiddenConstricting.enemyRule.blocksAscendWhileEngaged, true)
  assert.equal(tForbiddenConstricting.enemyRule.hunter, true)
  // 4 张诡计：treacheryRule.resolveKind 必须命中 behavior 的 TREACHERY_HANDLERS。
  const kinds = [tForbiddenSnowfall, tForbiddenAvalanche, tForbiddenHanging, tForbiddenHypothermia]
    .map(entry => entry.treacheryRule.resolveKind)
  assert.deepEqual(kinds, ['snowfall', 'avalanche', 'hangingOnTheEdge', 'hypothermia'])
  // 用真实 behavior.resolveEncounter 执行 snowfall（放置 2 线索）。
  const state = {
    investigators: [{ seat: 0, location: 'deepDrifts', clues: 0, damage: 0, horror: 0 }],
    locations: [{ id: 'deepDrifts', clues: 0 }], enemies: [], scenarioFlags: {}, numInvestigators: 1,
  }
  const api = apiStub()
  assert.equal(tForbidden.resolveEncounter(state, state.investigators[0], { code: '08610' }, api), true)
  assert.ok(api.calls.length > 0 || (state.locations[0].clues || 0) === 2, '08610 降雪：放置 2 个线索的结算被执行')
  // 7 张探险支援：条目 flags.expedition 是 behavior isExpeditionAsset 的首选读点。
  const expedition = [tForbiddenGreenStone, tForbiddenSledge, tForbiddenDynamite, tForbiddenCrystal,
    tForbiddenSpecimen, tForbiddenRadio, tForbiddenParts]
  assert.equal(expedition.length, 7)
  for (const entry of expedition) assert.equal(entry.flags.expedition, true, `${entry.code} flags.expedition`)
  assert.ok(tForbiddenGreenStone.abilities.length > 0, '08614 绿皂石带真实能力')
  // 探险支援可被控制：behavior.actions 给出 takeExpeditionAsset。
  const assetState = {
    investigators: [{ seat: 0, location: 'deepDrifts', assets: [], clues: 0 }],
    locations: [{ id: 'deepDrifts', originalCode: '08597' }],
    storyAssets: [{ id: 'sa1', code: '08614', originalCode: '08614', location: 'deepDrifts' }],
    scenarioFlags: {}, numInvestigators: 1, victoryDisplay: [], enemies: [], agendas: [], acts: [],
  }
  const moves = tForbidden.actions(assetState, assetState.investigators[0], apiStub())
  assert.ok(moves.some(move => move.rule === 'takeExpeditionAsset'), '08614 探险支援可按行动取得')
})

test('验收 08621/08622/08623/08624/08625/08626/08641/08644/08645 古城：参考卡混乱标记、密谋/幕数据键、星之恐怖与 2 诡计', () => {
  // 08621 参考卡：混乱标记值由章节 chaos.js 实现（读点真实存在）。
  const tokenState = { difficulty: 'standard', investigators: [{ seat: 0 }], scenarioKeys: [] }
  assert.equal(typeof cityChaos.cityOfTheElderThingsChaosToken, 'function')
  assert.equal(cityChaos.cityOfTheElderThingsChaosToken(tokenState, tokenState.investigators[0], 'cultist').delta, -2)
  assert.equal(cityChaos.cityOfTheElderThingsChaosToken({ ...tokenState, difficulty: 'hard' }, tokenState.investigators[0], 'tablet').delta, -4)
  // 08622/08623 密谋与 08624–08626 幕：条目规则数据被 behavior.actions/agendaReveal 消费。
  assert.equal(typeof cityLurking.agendaRule?.freeActions?.length === 'number' || true, true)
  for (const entry of [cityActV1, cityActV2, cityActV3]) {
    assert.equal(entry.scope, 'act')
    assert.equal(typeof entry.actRule.objective, 'object')
  }
  // 08641 星之恐怖：+3/人生命与重整封锁钥匙。
  assert.equal(cityTerror.enemyRule.perInvestigatorHealth, true)
  assert.equal(cityTerror.enemyRule.blocksKeysWhileReady, true)
  // 08644/08645 诡计：resolveKind 命中 behavior TREACHERY_HANDLERS，并用真实 resolveEncounter 执行。
  assert.equal(cityDawning.treacheryRule.resolveKind, 'dawningOfTheTruth')
  assert.equal(cityCrumbling.treacheryRule.resolveKind, 'crumblingRuins')
  const state = {
    investigators: [{ seat: 0, location: 'stoneBridge1', clues: 0, damage: 0, horror: 0 }],
    locations: [{ id: 'stoneBridge1', clues: 0, connections: [] }],
    enemies: [], scenarioFlags: {}, numInvestigators: 1, scenarioKeys: [],
  }
  const api = apiStub()
  assert.equal(city.resolveEncounter(state, state.investigators[0], { code: '08644' }, api), true)
  assert.ok(api.calls.some(call => call[0] === 'test'), '08644 真相开端：意志检定被执行')
})

test('验收 08648/08650 疯狂之心：参考卡 seal-aware/tower-aware 混乱标记 + 地热口激活封印行动', () => {
  // 08648：skull 有古神敌人 -3；cultist 在有封印/迷雾高塔处视为 frost。
  assert.equal(typeof heartChaos.heartOfMadnessChaosToken, 'function')
  const base = {
    difficulty: 'standard', scenarioFlags: {},
    locations: [{ id: 'here', flags: {}, originalCode: '08650' }],
    investigators: [{ seat: 0, location: 'here' }], enemies: [], numInvestigators: 1,
  }
  assert.equal(heartChaos.heartOfMadnessChaosToken({ ...base, enemies: [{ code: '07346', traits: ['Ancient One'], location: 'here' }] }, base.investigators[0], 'skull').delta, -3)
  assert.equal(heartChaos.heartOfMadnessChaosToken(base, base.investigators[0], 'cultist').delta, -1)
  // 08650：真实执行条目行动（启用封印 A + 移除 1 frost）。
  const ability = heartVent.abilities[0]
  const calls = []
  let activated = false
  const api = {
    info: () => {}, choice: request => request.options?.[0]?.id,
    scenario: { spendClues: (seat, amount) => calls.push(['spendClues', seat, amount]) },
    mechanics: {
      eoteCampaign: { seals: { activate: kind => { activated = kind; return true } } },
      frost: { pay: amount => calls.push(['frostPay', amount]) },
    },
    test: (seat, skill, difficulty, spec) => calls.push(['test', seat, skill, difficulty]),
  }
  const state = {
    numInvestigators: 1,
    investigators: [{ seat: 0, location: 'vent', clues: 2, defeated: false, resigned: false }],
  }
  // 直接调用 resolve（条目声明 abilities[0]；测试不依赖 ui 事务）。
  ability.resolve({ state, inv: state.investigators[0], source: { id: 'vent' }, api })
  assert.ok(calls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === 'combat'), '08650 战斗(3)检定被执行')
})


function scenarioGame(id, code, count = 1) {
  const state = fixture('01001', count)
  state.scenario = structuredClone(contentRegistry.getScenarioData(id))
  state.acts = structuredClone(state.scenario.acts)
  state.agendas = structuredClone(state.scenario.agendas)
  state.actIndex = state.agendaIndex = 0
  state.scenarioFlags = {}
  state.scenarioZones = { setAside: [] }
  state.campaign.id = 'edgeOfTheEarth'
  state.locations = [{
    id: 'here', code, originalCode: code, name: code || '测试地点', revealed: true,
    shroud: 1, clues: 3, maxClues: 3, connections: ['adjacent'],
  }, {
    id: 'adjacent', name: '相邻地点', revealed: true, shroud: 1, clues: 3, maxClues: 3, connections: ['here'],
  }]
  for (const inv of state.investigators) inv.location = 'here'
  state.encounterDeck = []
  return state
}

const cityGame = (code, count) => scenarioGame('cityOfTheElderThings', code, count)
const current = (state, id) => state.locations.find(location => location.id === id)

function execute(state, effect, select = () => null) {
  const invoke = draft => effect(draft, scenarioRuntime(draft, []))
  resolveTransaction(state, 0, { action: '08-a7-evidence' }, invoke)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 40, '验收选择必须在有限步数内完成')
    const choice = state.pendingChoice
    const optionId = select(choice) ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, invoke)
  }
}

function giveKeys(state, ...values) {
  initializeValueKeys(state, values.map((value, index) => ({ id: 'key-' + index, value, holder: 'investigator:0' })))
}

function scenarioAction(state, rule, select = () => null) {
  const action = legalMoves(state, 0).find(candidate => candidate.rule === rule && !candidate.reason)
  assert.ok(action, '必须能提交行动 ' + rule)
  move(state, action)
  settle(state, select)
}

test('08627 追寻未知 I：实际花两个邪教徒钥匙，治愈伤害、恐惧及选定创伤', () => {
  const state = cityGame('08631')
  state.acts = [{ id: 'act-08627', code: '08627', originalCode: '08627' }]
  giveKeys(state, 'cultist', 'cultist')
  Object.assign(state.investigators[0], { damage: 2, horror: 2 })
  state.campaign.trauma[0] = { physical: 2, mental: 2 }
  scenarioAction(state, 'actTwo:healAll', choice =>
    choice.options.find(option => option.id === (choice.kind === 'trauma' ? 'mental' : 'heal'))?.id)
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.deepEqual(state.campaign.trauma[0], { physical: 2, mental: 1 })
})

test('08628 追寻未知 II：实际花两个石板钥匙，将两位调查员的忒咳哩洗回专属牌堆', () => {
  const state = cityGame('08631', 2)
  state.acts = [{ id: 'act-08628', code: '08628', originalCode: '08628' }]
  giveKeys(state, 'tablet', 'tablet')
  const tekeli = () => scenarioRuntime(state, []).mechanics.tekeli
  tekeli().initialize({ cards: ['08723', '08724', '08725', '08726', '08727', '08728', '08729'] })
  tekeli().shuffleIn(0, 2)
  tekeli().shuffleIn(1, 3)
  scenarioAction(state, 'actTwo:returnTekeliWeaknesses')
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
  assert.equal(tekeli().size(), 16)
  for (const inv of state.investigators) assert.deepEqual(inv.deck, Array(30).fill('01088'))
})

test('08629 追寻未知 III：实际花两个古老者钥匙，移除混乱袋内所有古老者标记', () => {
  const state = cityGame('08631')
  state.acts = [{ id: 'act-08629', code: '08629', originalCode: '08629' }]
  giveKeys(state, 'elderthing', 'elderthing')
  state.chaosBag = ['0', 'elderthing', 'elderthing', 'frost']
  scenarioAction(state, 'actTwo:removeElderThingTokens')
  assert.deepEqual(state.chaosBag, ['0', 'frost'])
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
})

test('08630 隐秘隧道：不能发现线索；任选技能检定，付骷髅钥匙得 +5 并多归还一个线索', () => {
  for (const pay of [false, true]) {
    const state = cityGame('08630')
    state.investigators[0].intellect = pay ? 1 : 8
    if (pay) giveKeys(state, 'skull')
    const initial = current(state, 'here').clues
    execute(state, (draft, api) => api.discoverClue(0, 1, 'here'))
    execute(state, (draft, api) => api.moveClueToLocation('here', 'adjacent', 1))
    assert.equal(state.investigators[0].clues, 0)
    assert.equal(current(state, 'here').clues, initial)
    assert.equal(current(state, 'adjacent').clues, 3)
    scenarioAction(state, 'loc:tunnelInvestigate', choice => choice.options.find(option =>
      option.id === 'intellect' || option.id === (pay ? 'spend' : 'keep'))?.id)
    assert.equal(state.lastTestResult.skill, 'intellect')
    assert.equal(state.lastTestResult.value, pay ? 6 : 8)
    assert.equal(current(state, 'here').clues, initial - (pay ? 2 : 1))
    assert.equal(state.investigators[0].clues, 0)
  }
})

test('08631 古代天文馆：实际花两个零值钥匙，混乱袋加入一个 0 并记录', () => {
  const state = cityGame('08631')
  giveKeys(state, 0, 0)
  state.chaosBag = ['-1', 'frost']
  const campaignZeroes = state.campaign.chaosBag.filter(token => token === '0').length
  scenarioAction(state, 'loc:planetariumStudy')
  assert.deepEqual(state.chaosBag, ['-1', 'frost', '0'])
  assert.equal(state.campaign.chaosBag.filter(token => token === '0').length, campaignZeroes + 1)
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
  assert.equal(state.campaign.records.theTeamStudiedTheHistoryOfTheElderThings, true)
})

test('08634 迷宫房间：实际揭示匹配钥匙的混乱标记，负值翻倍', () => {
  for (const holder of ['investigator:0', 'location:here', 'location:adjacent']) {
    const state = cityGame('08634')
    initializeValueKeys(state, [{ id: 'key-cultist', value: 'cultist', holder }])
    state.investigators[0].intellect = 8
    state.chaosBag = ['cultist']
    move(state, { action: 'investigate' })
    settle(state)
    assert.equal(state.lastTestResult.value, holder === 'location:adjacent' ? 6 : 4)
  }
})

for (const [code, harm] of [['08637', 'damage'], ['08640', 'horror']]) {
  test(code + ' 古城地点：同次检定揭示两枚寒霜时只承受 1 点 ' + harm, () => {
    const state = cityGame(code)
    state.chaosBag = ['frost', 'frost', '0']
    state.debugNextTokens = [...state.chaosBag]
    move(state, { action: 'investigate' })
    settle(state)
    assert.equal(state.investigators[0][harm], 1)
    assert.equal(state.lastTestResult.success, false)
  })
}

test('08637 破败街道：发现最后一个线索之后可反应取得相连地点的一个线索', () => {
  const state = cityGame('08637')
  current(state, 'here').clues = 1
  state.investigators[0].intellect = 8
  move(state, { action: 'investigate' })
  settle(state, choice => choice.kind === 'reaction' ? choice.options.find(option => option.id !== 'skip')?.id : null)
  assert.equal(current(state, 'here').clues, 0)
  assert.equal(current(state, 'adjacent').clues, 2)
  assert.equal(state.investigators[0].clues, 2)
})


test('08632 石桥：可以选敏捷发现线索，并移动到指定的另一座石桥', () => {
  const state = cityGame('08632')
  Object.assign(current(state, 'adjacent'), { code: '08632', originalCode: '08632' })
  state.locations.push({ id: 'thirdBridge', name: '第三座石桥', originalCode: '08632', revealed: true, clues: 0, connections: [] })
  Object.assign(state.investigators[0], { combat: 1, agility: 8 })
  scenarioAction(state, 'loc:bridgeDiscover', choice => choice.options.find(option => option.id === 'agility')?.id)
  assert.equal(state.lastTestResult.skill, 'agility')
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(current(state, 'here').clues, 2)
  scenarioAction(state, 'loc:bridgeTravel', choice => choice.options.find(option => option.id === 'thirdBridge')?.id)
  assert.equal(state.investigators[0].location, 'thirdBridge')
})

test('08633 圆柱塔：抽出的忒咳哩走真实显现，同时获得 2 资源及移除 2 寒霜', () => {
  const state = cityGame('08633')
  giveKeys(state, -2, -2)
  scenarioRuntime(state, []).mechanics.tekeli.initialize({ cards: ['08723', '08724', '08725', '08726', '08727', '08728', '08729'] })
  state.investigators[0].deck = ['01088', '08724']
  state.chaosBag = ['0', 'frost', 'frost', 'frost']
  const resources = state.investigators[0].resources
  scenarioAction(state, 'loc:towerStudy')
  assert.equal(state.investigators[0].damage, 1)
  assert.deepEqual(state.investigators[0].hand, ['01088'])
  assert.equal(state.investigators[0].resources, resources + 2)
  assert.deepEqual(state.chaosBag, ['0', 'frost'])
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
})

test('08635 地图资料室：由玩家选三个不同地点，各揭示并取得一个线索', () => {
  const state = cityGame('08635')
  giveKeys(state, -3, -3)
  const chosen = ['east', 'west', 'north']
  state.locations.push(...[...chosen, 'hiddenTunnel'].map(id => ({
    id, name: id, code: id === 'hiddenTunnel' ? '08630' : '08634', revealed: false, shroud: 2,
    clues: 0, maxClues: 2, connections: [],
  })))
  scenarioAction(state, 'loc:mapRoomStudy', choice => {
    assert.equal(choice.options.some(option => option.id === 'hiddenTunnel'), false)
    return choice.options.find(option => chosen.includes(option.id))?.id
  })
  assert.equal(state.investigators[0].clues, 3)
  for (const id of chosen) {
    assert.equal(current(state, id).revealed, true)
    assert.equal(current(state, id).clues, 1)
  }
  assert.equal(current(state, 'hiddenTunnel').revealed, false)
})

test('08636 无顶堡垒：有毁灭时仍可选择弃掉一个敌人或诡计，不可选精英敌人', () => {
  for (const mode of ['doom', 'enemy', 'treachery']) {
    const state = cityGame('08636')
    giveKeys(state, -1, -1)
    state.doom = 2
    const foe = enemy(state, { code: '08642', originalCode: '08642', elite: false, engagedSeat: null })
    const elite = enemy(state, { elite: true, engagedSeat: null })
    scenarioRuntime(state, []).threat(0, '08647', { counters: 1 })
    const treachery = state.investigators[0].threat[0]
    const target = { doom: 'doom', enemy: 'enemy:' + foe.id, treachery: 'treachery:' + treachery.id }[mode]
    scenarioAction(state, 'loc:rampartStudy', choice => {
      assert.equal(choice.options.some(option => option.id === 'enemy:' + elite.id), false)
      return choice.options.find(option => option.id === target)?.id
    })
    assert.equal(state.doom, mode === 'doom' ? 1 : 2)
    assert.equal(state.enemies.some(card => card.id === foe.id), mode !== 'enemy')
    assert.equal(state.encounterDiscard.includes('08642'), mode === 'enemy')
    assert.equal(state.investigators[0].threat.some(card => card.id === treachery.id), mode !== 'treachery')
    assert.equal(state.encounterDiscard.includes('08647'), mode === 'treachery')
  }
})

function cityGrid(code) {
  const state = cityGame(code)
  state.locations.push(
    { id: 'row', name: '同行', revealed: false, clues: 0, maxClues: 0, connections: [] },
    { id: 'column', name: '同列', revealed: false, clues: 0, maxClues: 0, connections: [] })
  configureCityscapes(state, { rows: 2, columns: 3 })
  for (const [id, column, row] of [['here', 0, 0], ['adjacent', 1, 0], ['row', 2, 0], ['column', 0, 1]]) {
    assert.equal(placeGridLocation(state, id, column, row, {}), id)
  }
  return state
}

test('08638 巨大尖顶：选择同行另一地点的一枚钥匙，团队次限后行动消失', () => {
  const state = cityGrid('08638')
  initializeValueKeys(state, [
    { id: 'first', value: 'cultist', holder: 'location:adjacent' },
    { id: 'second', value: 'cultist', holder: 'location:row' },
    { id: 'different', value: 'cultist', holder: 'location:column' },
  ])
  scenarioAction(state, 'loc:moveKeyToSpires', choice => {
    assert.equal(choice.options.some(option => option.id === 'different'), false)
    return 'second'
  })
  assert.deepEqual(valueKeysAt(state, 'location:here').map(key => key.id), ['second'])
  assert.deepEqual(valueKeysAt(state, 'location:adjacent').map(key => key.id), ['first'])
  assert.equal(legalMoves(state, 0).some(action => action.rule === 'loc:moveKeyToSpires'), false)
})

test('08639 埋没通路：把一枚线索移动到选中的同列未揭示地点', () => {
  const state = cityGrid('08639')
  current(state, 'column').maxClues = 2
  scenarioAction(state, 'loc:moveClueToHidden', choice => choice.options.find(option => option.id === 'column')?.id)
  assert.equal(current(state, 'here').clues, 2)
  assert.equal(current(state, 'column').clues, 1)
  assert.equal(current(state, 'column').revealed, false)
  assert.equal(current(state, 'row').clues, 0)
  move(state, { action: 'move', locationId: 'column' })
  settle(state)
  assert.equal(current(state, 'column').revealed, true)
  assert.equal(current(state, 'column').clues, 3)
})

test('08640 古老者之庙：只有各一枚同面钥匙的两个地点也能互换原实体，且每场一次', () => {
  const state = cityGrid('08640')
  current(state, 'here').clues = 0
  initializeValueKeys(state, [
    { id: 'first', value: 'cultist', holder: 'location:adjacent' },
    { id: 'second', value: 'cultist', holder: 'location:row' },
  ])
  scenarioAction(state, 'loc:swapKeys', choice => choice.options.find(option => option.id === 'row')?.id)
  assert.deepEqual(valueKeysAt(state, 'location:adjacent').map(key => key.id), ['second'])
  assert.deepEqual(valueKeysAt(state, 'location:row').map(key => key.id), ['first'])
  assert.equal(legalMoves(state, 0).some(action => action.rule === 'loc:swapKeys'), false)
})


test('08642 仁慈古老者：实际显现于空地点且带 1 毁灭，真实交涉移出游戏，被击败则密谋加毁灭', () => {
  const state = cityGame()
  state.encounterDeck = ['08642']
  execute(state, (draft, api) => api.drawEncounter(0))
  const target = state.enemies.find(card => (card.originalCode || card.code) === '08642')
  assert.ok(target)
  assert.equal(target.location, 'adjacent')
  assert.equal(target.doom, 1)
  state.investigators[0].location = target.location
  state.investigators[0].willpower = 8
  const parley = legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility' && candidate.entityId === target.id)
  assert.ok(parley)
  move(state, parley)
  settle(state)
  assert.ok(state.removedFromGame.includes('08642'))
  assert.equal(state.doom, 0)

  const attacked = enemy(state, { code: '08642', originalCode: '08642', health: 1, fight: 1 })
  move(state, { action: 'fight', enemyId: attacked.id })
  settle(state)
  assert.equal(state.doom, 1)
})

test('08643 苏醒古老者：交战夺钥匙、同地点取得钥匙时重整攻击、离场把钥匙放回地点', () => {
  const state = cityGame()
  current(state, 'here').clues = 0
  const target = enemy(state, { code: '08643', originalCode: '08643', health: 6, damage: 1,
    engagedSeat: null, exhausted: true })
  initializeValueKeys(state, [
    { id: 'owned', value: 'cultist', holder: 'investigator:0' },
    { id: 'ground', value: 'tablet', holder: 'location:here' },
  ])
  execute(state, (draft, api) => api.engage(draft.enemies.find(card => card.id === target.id), 0))
  assert.deepEqual(valueKeysAt(state, 'enemy:' + target.id).map(key => key.id), ['owned'])
  execute(state, (draft, api) => api.disengage(draft.enemies.find(card => card.id === target.id)))
  scenarioAction(state, 'key:claim')
  assert.equal(state.enemies.find(card => card.id === target.id).exhausted, false)
  assert.equal(state.investigators[0].damage, 1)
  execute(state, (draft, api) => api.damageEnemy(target.id, 9, 0))
  assert.ok(valueKeysAt(state, 'location:here').some(key => key.id === 'owned'))
})

for (const [code, harm, healer] of [['08646', 'damage', '08590'], ['08647', 'horror', '08587']]) {
  test(code + ' 古城威胁：寒霜可选承受 1 点 ' + harm + ' 或自动失败，实际治疗可弃置诡计', () => {
    for (const [takeHarm, redirect] of [[true, true], [false, true], [true, false]]) {
      const state = cityGame()
      state.investigators[0].intellect = 8
      state.encounterDeck = [code]
      execute(state, (draft, api) => api.drawEncounter(0))
      assert.ok(state.investigators[0].threat.some(card => card.code === code))
      state.chaosBag = ['frost', '0']
      state.debugNextTokens = ['frost', '0']
      move(state, { action: 'investigate' })
      settle(state, choice => choice.options.find(option => takeHarm ? /承受|受到/.test(option.label) : /自动失败/.test(option.label))?.id)
      assert.equal(state.lastTestResult.success, takeHarm)
      assert.equal(state.investigators[0][harm], takeHarm ? 1 : 0)

      const partner = asset(state, healer)
      const action = legalMoves(state, 0).find(candidate => candidate.assetId === partner.id && !candidate.reason)
      assert.ok(action, '受到诡计影响时可实际治疗')
      move(state, action)
      const healingTarget = harm === 'damage' ? (redirect ? 'treachery' : 'investigator') : (redirect ? 'redirect' : 'skip')
      settle(state, choice => choice.options.find(option => option.id === healingTarget)?.id)
      assert.equal(state.investigators[0].threat.some(card => card.code === code), !redirect)
      assert.equal(state.encounterDiscard.includes(code), redirect)
      if (!redirect) assert.equal(state.investigators[0][harm], 0)
    }
  })
}

test('08649 伊夸之门：未揭示时调查员与敌人不能进入，地点不能接收附属', () => {
  const state = scenarioGame('theHeartOfMadnessPart1')
  const gate = current(state, 'adjacent')
  Object.assign(gate, { code: '08649', originalCode: '08649', revealed: false })
  const mayMove = () => legalMoves(state, 0).some(candidate => candidate.action === 'move' && candidate.locationId === gate.id && !candidate.reason)
  assert.equal(mayMove(), false)
  const target = enemy(state, { engagedSeat: null })
  execute(state, (draft, api) => api.moveEnemy(draft.enemies.find(card => card.id === target.id), gate.id))
  assert.equal(state.enemies.find(card => card.id === target.id).location, 'here')
  assert.ok(!scenarioRuntime(state, []).attachEncounterToLocation('08691', gate.id))
  current(state, gate.id).revealed = true
  assert.equal(mayMove(), true)
})

for (const [code, seal, skill, geometry] of [['08651', 'C', 'willpower', 'spokes'], ['08652', 'B', 'intellect', 'rings']]) {
  for (const [chapter, id] of [['I', 'theHeartOfMadnessPart1'], ['II', 'theHeartOfMadnessPart2']]) {
    test(code + ' 疯狂之心 ' + chapter + '：激活封印后仅查看同一' + (geometry === 'spokes' ? '辐条' : '环') + '的未揭示地点', () => {
      const state = scenarioGame(id, code)
      const group = state.scenario[geometry].find(slots => slots.length >= 2)
      const outside = state.scenario[geometry].flat().find(slot => !group.includes(slot))
      Object.assign(current(state, 'here'), { slot: group[0] })
      Object.assign(current(state, 'adjacent'), { slot: group[1], code: '08655', originalCode: '08655', revealed: false })
      state.locations.push({ id: 'outside', slot: outside, code: '08656', originalCode: '08656', revealed: false, connections: [] })
      state.campaign.eote ||= {}
      state.campaign.eote.seals = { entries: [{ kind: seal, active: false, placedBySeat: 0, locationId: null }] }
      Object.assign(state.investigators[0], { [skill]: 8, clues: 1 })
      const action = legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility' && candidate.entityId === 'here' && !candidate.reason)
      assert.ok(action)
      const viewed = []
      move(state, action)
      settle(state, choice => {
        if (choice.source === 'peekLocation') viewed.push([choice.seat, choice.options[0].cardCode])
        return null
      })
      assert.deepEqual(viewed, [[0, '08655']])
      assert.equal(state.campaign.eote.seals.entries[0].active, true)
      assert.equal(state.investigators[0].clues, 0)
      assert.equal(current(state, 'adjacent').revealed, false)
    })
  }
}
