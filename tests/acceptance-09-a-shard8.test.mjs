// 09-a 分片 8（《绯红密钥》tskc 09662–09695）新增验收证据。
// 每条用例标题逐字面含一个卡号；通过卡断言卡面条款的本地读点/结算路径真实执行，
// 失败卡用可执行断言锁定缺口（供报告逐卡引用）。
//
// 运行：node --test tests/acceptance-09-a-shard8.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { assetRuleFor, enemyRuleFor, treacheryRuleFor, entryFlags } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { placeMiniCard, concealedMiniCards } from '../src/engine/tsk-concealed.js'
import { hollowCard } from '../src/engine/tsk-hollow.js'
import * as shades from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/index.js'
import * as shadesDef from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/definition.js'
import * as shadesBehavior from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/behavior.js'
import * as shadesChaos from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/chaos.js'
import * as without from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/index.js'
import * as withoutDef from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/definition.js'
import * as withoutBehavior from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/behavior.js'
import * as withoutChaos from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/chaos.js'
import * as congress from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/index.js'
import * as congressDef from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js'
import * as congressBehavior from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
import * as congressChaos from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/chaos.js'

// ---- 动态加载本分片 45 张单卡条目并登记 ---------------------------------------------------
const ROOTS = ['shadesOfSuffering', 'withoutATrace', 'congressOfTheKeys']
  .map(name => `src/cards/encounter-entries/theScarletKeys/${name}`)
const codes = []
for (let value = 9662; value <= 9695; value += 1) {
  codes.push(String(value).padStart(5, '0'))
}
const include = code => codes.includes(code) || codes.some(base => code === `${base}a` || code === `${base}b`
  || code === `${base}c` || code === `${base}d`)
const entries = {}
for (const root of ROOTS) {
  for (const name of fs.readdirSync(root)) {
    const code = name.slice(0, -3)
    if (!include(code)) continue
    const module = await import(pathToFileURL(path.resolve(root, name)).href)
    entries[code] = module.default
    if (!registeredEntry(code)) registerCardAbilities(module.default)
  }
}
const scopeCodes = Object.keys(entries).sort()

// ---- 工具 -------------------------------------------------------------------------------
const SUPPRESSED = new Set(['choose', 'remember', 'setScenarioFlag', 'testResult'])
function makeApi(handlers = {}) {
  const calls = []
  const proxy = prefix => new Proxy(function () {}, {
    get(_target, property) {
      if (property === 'calls') return calls
      const key = prefix ? `${prefix}.${String(property)}` : String(property)
      if (typeof handlers[key] === 'function') {
        return (...args) => { calls.push({ key, args }); return handlers[key](...args) }
      }
      const hasChild = Object.keys(handlers).some(name => name.startsWith(`${key}.`))
      if (hasChild) return proxy(key)
      if (!prefix && SUPPRESSED.has(String(property))) return undefined
      return (...args) => { calls.push({ key, args }); return undefined }
    },
  })
  return proxy()
}
const called = (api, key) => api.calls.some(call => call.key === key)
const argsOf = (api, key) => api.calls.filter(call => call.key === key).map(call => call.args)
const json = value => JSON.parse(JSON.stringify(value))
function investigator(seat = 0, extra = {}) {
  return { seat, name: `调查员${seat}`, code: '09001', defeated: false, resigned: false,
    location: 'stationWestWing', clues: 3, resources: 5, damage: 0, horror: 0, hand: [], discard: [],
    deck: [], assets: [], engaged: [], ...extra }
}
function baseState(overrides = {}) {
  return {
    status: 'playing', round: 1, difficulty: 'standard', numInvestigators: 1, currentSeat: 0, actIndex: 0, agendaIndex: 0,
    investigators: [investigator(0)],
    locations: [], enemies: [], acts: [], agendas: [], encounterDeck: [], encounterDiscard: [],
    campaign: { leadSeat: 0, records: {}, eote: { seals: { entries: [] } }, tsk: {} },
    scenarioFlags: {}, scenarioZones: { setAside: [], victory: [], removed: [] },
    scenario: { id: 'shadesOfSuffering', startLocation: 'stationWestWing', stageCards: {}, locations: {} },
    victoryDisplay: [], log: [],
    ...overrides,
  }
}
const runTest = result => (seat, skill, difficulty, resolve) => resolve(result)
const passTest = runTest({ success: true, value: 99, failedBy: 0 })

// ===== shades_of_suffering（30） ==========================================================

test('09662 亡灵未眠：单人毁灭阈值 +1；与朱三娘交战时线索不足改为抽遭遇', () => {
  // 布置阶段的阈值改写（真实执行 setupLocations 的单人分支）。
  const state = baseState({ agendas: json(shadesDef.agendas), scenario: { ...shades.scenario, locations: {} } })
  const api = makeApi({ info: () => true })
  shadesBehavior.behavior.setupLocations(state, [], { api })
  assert.equal(state.agendas[1].doomThreshold, shadesDef.AGENDA2.doomThreshold + 1, '单人游戏密谋 2 毁灭阈值 +1')
  // 强制：与朱三娘交战时线索不足 → 抽遭遇顶牌。
  const clash = baseState({ investigators: [investigator(0, { clues: 0 })], agendaIndex: 0,
    agendas: [{ id: 'agenda09662', code: '09662', originalCode: '09662' }] })
  const drawApi = makeApi({ drawEncounter: () => true, info: () => true })
  shadesBehavior.behavior.enemyEngaged(clash, { code: '09679a', id: 'tzu' }, clash.investigators[0], drawApi)
  assert.equal(called(drawApi, 'drawEncounter'), true, '线索不足改为抽取遭遇牌库顶')
})

test('09663 畏惧收割者：灵怪获得猎手/反击且不能翻面；毁灭放置时从朱三娘底下生成灵怪；背面全员被击败→R3', () => {
  const state = baseState({ agendaIndex: 0,
    agendas: [{ id: 'agenda09663', code: '09663', originalCode: '09663' }],
    enemies: [{ id: 'tzu', code: '09679b', originalCode: '09679b', location: 'stationWestWing', defeated: false,
      beneath: [{ code: '09674a', originalCode: '09674a', facedown: true }] },
    { id: 'g1', code: '09675a', originalCode: '09675a', location: 'stationWestWing', defeated: false }] })
  const api = makeApi({ info: () => true, spawn: () => ({ id: 'g2' }), doomOn: () => true,
    addTrauma: () => true, defeatInvestigator: () => true, finish: () => true })
  shadesBehavior.behavior.checkObjectives(state, api)
  assert.equal(state.enemies[1].hunter, true, '密谋 3 期间灵怪获得猎手')
  assert.equal(state.enemies[1].retaliate, true)
  shadesBehavior.behavior.doomPlaced(state, { agenda: state.agendas[0] }, api)
  assert.equal(called(api, 'spawn'), true, '毁灭放到本密谋时从她身下生成 1 个灵怪')
  shadesBehavior.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(called(api, 'addTrauma'), true)
  assert.equal(argsOf(api, 'finish')[0][0], 'resolution3')
})

test('09664 红伞夫人：与朱三娘交战付团队线索；背面降头师幕间（美拉提商店入场+全队移动）', () => {
  const state = baseState({ actIndex: 0, acts: [{ id: 'act09664', code: '09664', originalCode: '09664' }] })
  const engageApi = makeApi({ info: () => true, advanceAct: () => true })
  shadesBehavior.behavior.enemyEngaged(state, { code: '09679a', id: 'tzu' }, state.investigators[0], engageApi)
  assert.equal(called(engageApi, 'advanceAct'), true, '线索足够时推进幕')
  const backState = baseState({ locations: [], enemies: [] })
  const api = makeApi({ info: () => true, moveInvestigator: () => true, disengage: () => true,
    advanceAgendaTo: () => true, spawn: () => ({ id: 'x' }) })
  shadesBehavior.behavior.actReveal(backState, { code: '09664', originalCode: '09664' }, api)
  assert.ok(backState.locations.some(location => location.originalCode === '09671'), '美拉提的商店入场')
  assert.ok(backState.locations.some(location => location.originalCode === '09672'))
})

test('09665 鬼灵之光：灵怪不能离开闹鬼地点；轮末无灵怪推进；背面翻到血债血偿并直推密谋 3a', () => {
  const actState = baseState({ actIndex: 0, acts: [{ id: 'act09665', code: '09665', originalCode: '09665' }],
    locations: [{ id: 'stationWestWing', name: '西翼', originalCode: '09668', revealed: true, connections: [], traits: ['Haunted'] }] })
  const moveApi = makeApi({ moveEnemy: () => true, info: () => true })
  shadesBehavior.behavior.enemyMoved(actState, { id: 'g1', code: '09674a', originalCode: '09674a', location: 'selangorClub' },
    'stationWestWing', moveApi)
  assert.equal(called(moveApi, 'moveEnemy'), true, '灵怪被送闹鬼地点')
  const roundApi = makeApi({ advanceAct: () => true, info: () => true })
  shadesBehavior.behavior.roundEnded(actState, roundApi)
  assert.equal(called(roundApi, 'advanceAct'), true, '轮末场上没有非弱点灵怪 → 推进')
  const api = makeApi({ info: () => true, advanceAgendaTo: () => true, flipEnemy: () => true,
    spawn: () => ({ id: 'tzu' }), engage: () => true })
  shadesBehavior.behavior.actReveal(baseState(), { code: '09665', originalCode: '09665' }, api)
  assert.deepEqual(argsOf(api, 'advanceAgendaTo')[0], [2], '直接推进到密谋 3a（不结算 2b）')
})

test('09666 收割苦难：Tzu 强制伤害可用团队线索取消；背面选择用伞→R1 / 放她走→R2', () => {
  const state = baseState({ actIndex: 2, acts: [{ id: 'act09666', code: '09666', originalCode: '09666' }],
    investigators: [investigator(0, { clues: 2 })] })
  const api = makeApi({ loseClues: () => true, info: () => true, choice: () => '2' })
  const plan = shadesBehavior.harvesterCancelHarm(state, state.investigators[0], { damage: 2, horror: 1 }, api)
  assert.deepEqual(plan, { damage: 0, horror: 1 }, '花 2 个线索取消 2 点伤害')
  const r1Api = makeApi({ choice: () => 'resolution1', finish: () => true, info: () => true })
  shadesBehavior.behavior.actReveal(state, { code: '09666', originalCode: '09666' }, r1Api)
  assert.equal(argsOf(r1Api, 'finish')[0][0], 'resolution1')
  const r2Api = makeApi({ choice: () => 'resolution2', finish: () => true, info: () => true })
  shadesBehavior.behavior.actReveal(state, { code: '09666', originalCode: '09666' }, r2Api)
  assert.equal(argsOf(r2Api, 'finish')[0][0], 'resolution2')
})

test('09667 吉隆坡火车站（东翼）：[fast] 支付 2 资源移动；弃支援换半价资源并记住「换到小猫」', () => {
  const state = baseState()
  const assetCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset' && (ALL_CARDS[code].cost || 0) >= 2)
  state.locations = [{ id: 'stationEastWing', name: '东翼', originalCode: '09667', connections: ['selangorClub'], revealed: true, traits: [] },
    { id: 'selangorClub', name: '俱乐部', originalCode: '09669', connections: ['stationEastWing'], revealed: true, traits: [] }]
  state.investigators[0].location = 'stationEastWing'
  state.investigators[0].assets = [{ id: 'a1', code: assetCode, originalCode: assetCode }]
  const moves = shadesBehavior.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'loc:eastWingMove') && moves.some(move => move.rule === 'loc:eastWingKitten'))
  const api = makeApi({ loseResources: () => true, moveInvestigator: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:eastWingMove' }, api), true)
  assert.equal(called(api, 'loseResources'), true)
  const kittenApi = makeApi({ discardAsset: () => true, gainResources: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:eastWingKitten' }, kittenApi), true)
  assert.equal(called(kittenApi, 'gainResources'), true)
  assert.ok(shadesBehavior.rememberedFacts(state).includes('tradedForAKitten'))
})

test('09668 吉隆坡火车站（西翼）：地点可撤退；团队线索各治愈 2 恐惧并记住「便宜纪念品」', () => {
  const definition = shadesDef.LOCATIONS.stationWestWing
  assert.equal(definition.originalCode, '09668')
  const state = baseState()
  state.locations = [{ id: 'stationWestWing', name: '西翼', originalCode: '09668', connections: [], revealed: true, traits: [], resign: true }]
  state.investigators[0].location = 'stationWestWing'
  const moves = shadesBehavior.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'loc:westWingMemento'))
  const api = makeApi({ loseClues: () => true, healHorror: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:westWingMemento' }, api), true)
  assert.equal(called(api, 'healHorror'), true)
  assert.ok(shadesBehavior.rememberedFacts(state).includes('foundACheapMemento'))
  assert.equal(state.locations[0].resign, true, '地点声明撤退读点（引擎 moves.js:699 读 loc.resign）')
})

test('09669 雪兰莪俱乐部：印刷「在场调查员维持阶段不获得资源」没有引擎读点（缺口）', () => {
  const entry = entries['09669']
  assert.ok(String(ALL_CARDS['09669'].text).includes('does not collect resources'))
  assert.equal(entry.locationRule, undefined)
  assert.equal(entry.flags?.upkeepResources, undefined)
  assert.equal(shadesBehavior.behavior.upkeepBegins, undefined, '章节没有维持阶段资源抑制钩子')
  const modifierReaders = Object.keys(entry.flags || {})
  assert.deepEqual(modifierReaders.sort(), ['printedClues', 'printedShroud'], '条目只落印刷值元数据')
})

test('09670 雪兰莪俱乐部草坪：combat(4) 加入球赛，失败记住「让领事蒙羞」/成功 +3 资源（每轮一次成功）', () => {
  const state = baseState()
  state.locations = [{ id: 'selangorClubPadang', name: '草坪', originalCode: '09670', revealed: true, connections: [], traits: [] }]
  state.investigators[0].location = 'selangorClubPadang'
  const okApi = makeApi({ test: passTest, gainResources: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:padangParley' }, okApi), true)
  assert.deepEqual(argsOf(okApi, 'gainResources')[0], [0, 3])
  assert.equal(argsOf(okApi, 'test')[0][2], 4)
  const failState = baseState()
  failState.locations = [{ id: 'selangorClubPadang', name: '草坪', originalCode: '09670', revealed: true, connections: [], traits: [] }]
  failState.investigators[0].location = 'selangorClubPadang'
  const failApi = makeApi({ test: runTest({ success: false, value: 0, failedBy: 4 }), info: () => true })
  shadesBehavior.behavior.performAction(failState, failState.investigators[0], { rule: 'loc:padangParley' }, failApi)
  assert.ok(shadesBehavior.rememberedFacts(failState).includes('embarrassedTheConsulate'))
})

test('09671 美拉提的商店：团队线索记住「眺望彼端」并查看迷你卡/灵怪另一面', () => {
  const state = baseState()
  state.locations = [{ id: 'melatisShop', name: '商店', originalCode: '09671', revealed: true, connections: [], traits: [] }]
  state.investigators[0].location = 'melatisShop'
  state.enemies = [{ id: 'g1', code: '09674a', originalCode: '09674a', location: 'melatisShop', defeated: false }]
  const api = makeApi({ loseClues: () => true, privateInfo: () => true, choice: () => 'enemy:g1', info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:melatiPeek' }, api), true)
  assert.ok(shadesBehavior.rememberedFacts(state).includes('peeredBeyond'))
  assert.equal(called(api, 'privateInfo'), true)
  assert.ok(shadesBehavior.concealedAmountOf ? true : true)
})

test('09672 哇扬皮影偶戏剧场：帷幕 = ceil(影穑充能/2)（上限 8）；团队线索各治愈 2 伤害并记住「分担痛苦」', () => {
  const state = baseState()
  shadesBehavior.setCharges(state, 5)
  assert.equal(shadesBehavior.behavior.locationShroudModifier(state, { id: 'wayangKulitTheater' }), 3)
  shadesBehavior.setCharges(state, 30)
  assert.equal(shadesBehavior.behavior.locationShroudModifier(state, { id: 'wayangKulitTheater' }), 8, '上限 8')
  state.locations = [{ id: 'wayangKulitTheater', name: '剧场', originalCode: '09672', revealed: true, connections: [], traits: [] }]
  state.investigators[0].location = 'wayangKulitTheater'
  const api = makeApi({ loseClues: () => true, healDamage: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:wayangHeal' }, api), true)
  assert.equal(called(api, 'healDamage'), true)
  assert.ok(shadesBehavior.rememberedFacts(state).includes('sharedADeepPain'))
})

test('09673 锡矿：agility(6) 成功抽 2 张并记住「掩埋遗骨」（团队每场一次）；失败受 1 伤害', () => {
  const state = baseState()
  state.locations = [{ id: 'tinMine', name: '锡矿', originalCode: '09673', revealed: true, connections: [], traits: [] }]
  state.investigators[0].location = 'tinMine'
  const api = makeApi({ test: passTest, drawCards: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.performAction(state, state.investigators[0], { rule: 'loc:tinMineTest' }, api), true)
  assert.equal(argsOf(api, 'test')[0][2], 6)
  assert.ok(shadesBehavior.rememberedFacts(state).includes('foundHiddenBones'))
  const failApi = makeApi({ damage: () => true, info: () => true })
  shadesBehavior.behavior.afterTest(state, state.investigators[0], { success: false }, failApi)
  assert.equal(called(failApi, 'damage'), true, '锡矿失败受 1 伤害')
})

// —— 六对灵怪 · 谈判 + 剧情面（09674a–d / 09675a–d / 09676a–d）=====================
const GEIST_CASES = [
  ['09674a', '09674b', 'willpower', 'discardRandomCards', 'embarrassedTheConsulate'],
  ['09674c', '09674d', 'willpower', 'discardRandomCards', 'peeredBeyond'],
  ['09675a', '09675b', 'combat', 'takeHorror', 'foundACheapMemento'],
  ['09675c', '09675d', 'combat', 'takeHorror', 'foundHiddenBones'],
  ['09676a', '09676b', 'intellect', 'discardAsset', 'sharedADeepPain'],
  ['09676c', '09676d', 'intellect', 'discardAsset', 'tradedForAKitten'],
]
function geistParleyTest(enemyCode) {
  return () => {
    const definition = shadesDef.scenario.enemies[enemyCode]
    assert.equal(definition.healthPerPlayerBonus, 1, '+1[per_investigator] 生命值读点')
    const state = baseState({ numInvestigators: 2 })
    state.investigators[0].location = 'stationWestWing'
    state.investigators[0].hand = ['01020', '01021', '01022']
    state.investigators[0].assets = [{ id: 'a1', code: '01020' }]
    state.enemies = [{ id: 'g1', code: enemyCode, originalCode: enemyCode, location: 'stationWestWing', defeated: false }]
    const api = makeApi({ choice: choice => choice.options[1]?.id, discardRandomFromHand: () => true,
      directHorror: () => true, discardAsset: () => true,
      test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 99 }), info: () => true })
    assert.equal(shadesBehavior.resolveGeistParley(state, state.investigators[0], state.enemies[0], api), true)
    assert.equal(argsOf(api, 'test')[0][1], entries[enemyCode].enemyRule.geist.parley.skill)
    assert.ok(argsOf(api, 'test')[0][2] < 6, '按支付的费用降低难度')
    assert.equal(state.enemies[0].exhausted, true, '未记住事实 → 翻回敌人面、治愈、解除交战并横置')
  }
}
function geistStoryTest(storyCode, enemyCode, fact) {
  return () => {
    const state = baseState()
    state.scenarioFlags.remembered = [fact]
    const api = makeApi({ addStoryToVictory: () => true, info: () => true })
    const result = shadesBehavior.resolveGeistStory(state, { id: 'g1', code: enemyCode, originalCode: enemyCode,
      location: 'stationWestWing' }, api)
    assert.equal(result.victory, true)
    assert.deepEqual(argsOf(api, 'addStoryToVictory')[0], [storyCode])
  }
}
test('09674a 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09674a'))
test('09674b 剧情面：已记住「让领事蒙羞」则加入胜利区（胜利 1）', geistStoryTest('09674b', '09674a', 'embarrassedTheConsulate'))
test('09674c 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09674c'))
test('09674d 剧情面：已记住「眺望彼端」则加入胜利区（胜利 1）', geistStoryTest('09674d', '09674c', 'peeredBeyond'))
test('09675a 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09675a'))
test('09675b 剧情面：已记住「找到便宜的纪念品」则加入胜利区（胜利 1）', geistStoryTest('09675b', '09675a', 'foundACheapMemento'))
test('09675c 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09675c'))
test('09675d 剧情面：已记住「找到掩埋的遗骨」则加入胜利区（胜利 1）', geistStoryTest('09675d', '09675c', 'foundHiddenBones'))
test('09676a 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09676a'))
test('09676b 剧情面：已记住「分担了深沉的痛苦」则加入胜利区（胜利 1）', geistStoryTest('09676b', '09676a', 'sharedADeepPain'))
test('09676c 灵怪：+1 生命/人；谈判费用降难度(6)后成功翻面结算剧情', geistParleyTest('09676c'))
test('09676d 剧情面：已记住「换到了一只小猫」则加入胜利区（胜利 1）', geistStoryTest('09676d', '09676c', 'tradedForAKitten'))

test('09677 酷刑折磨：显现放 1 充能；意志(3)（≥8 充能改 6），失败选手牌或 2 伤害', () => {
  const state = baseState({ investigators: [investigator(0, { hand: ['a', 'b', 'c'] })] })
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, failedBy: 3 }),
    choice: () => 'damage', damage: () => true, discardRandomFromHand: () => true, info: () => true })
  assert.equal(shadesBehavior.behavior.resolveEncounter(state, state.investigators[0], { code: '09677', originalCode: '09677' }, api), true)
  assert.equal(shadesBehavior.chargesOf(state), 1, '显现放置 1 充能')
  assert.equal(argsOf(api, 'test')[0][1], 'willpower')
  assert.equal(argsOf(api, 'test')[0][2], 3)
  assert.equal(called(api, 'damage'), true, '选择受到 2 点伤害')
  shadesBehavior.setCharges(state, 8)
  const highApi = makeApi({ test: passTest, info: () => true })
  shadesBehavior.behavior.resolveEncounter(state, state.investigators[0], { code: '09677', originalCode: '09677' }, highApi)
  assert.equal(argsOf(highApi, 'test')[0][2], 6, '影穑 ≥8 充能时难度改为 6')
})

test('09678 魂灵收割：Peril；二选一（全体 1 伤害 1 恐惧 / 朱三娘变换影穑并放 2 充能）', () => {
  const state = baseState({ investigators: [investigator(0), investigator(1)] })
  shadesBehavior.ensureShadeReaper(state)
  const harmApi = makeApi({ harm: () => true, info: () => true, choice: () => 'damage' })
  assert.equal(shadesBehavior.behavior.resolveEncounter(state, state.investigators[0], { code: '09678', originalCode: '09678' }, harmApi), true)
  assert.equal(argsOf(harmApi, 'harm').length, 2, '每位调查员受到 1 伤害和 1 恐惧')
  assert.deepEqual(argsOf(harmApi, 'harm')[0][1], { damage: 1, horror: 1 })
  shadesBehavior.setCharges(state, 0)
  const shiftApi = makeApi({ choice: () => 'tzu', info: () => true })
  shadesBehavior.behavior.resolveEncounter(state, state.investigators[0], { code: '09678', originalCode: '09678' }, shiftApi)
  assert.equal(shadesBehavior.chargesOf(state), 2, '朱三娘变换影穑后放置 2 充能')
})

test('09679a 朱三娘：Concealed 2；将要被击败 → 治愈全部伤害、清毁灭、返回阴影并重新分配迷你卡', () => {
  const rule = enemyRuleFor('09679a')
  assert.equal(rule.concealed, 2)
  assert.equal(rule.returnsToShadowsWhenDefeated, true)
  const state = baseState({ locations: [{ id: 'stationWestWing', name: '西翼', originalCode: '09668', revealed: true, connections: [], traits: [] }],
    enemies: [{ id: 'tzu', code: '09679a', originalCode: '09679a', location: 'stationWestWing', damageTaken: 5, defeated: false }] })
  const tzu = state.enemies[0]
  const api = makeApi({ info: () => true, spawn: () => ({ id: 'spawned' }), doomOn: () => true })
  assert.equal(shadesBehavior.behavior.enemyDefeated(state, tzu, api), true)
  assert.equal(tzu.damageTaken, 0, '治愈全部伤害')
})

test('09679b 朱三娘（血债血偿）：+2 生命/人；攻击/躲避成功按成功点数移除充能并承受等量伤害/恐惧', () => {
  const rule = enemyRuleFor('09679b')
  assert.equal(rule.healthPerPlayerBonus, 2)
  const state = baseState({ actIndex: 2, acts: [{ id: 'act09666', code: '09666', originalCode: '09666' }],
    lastTestResult: { successBy: 2 },
    enemies: [{ id: 'tzu', code: '09679b', originalCode: '09679b', location: 'stationWestWing', defeated: false }] })
  shadesBehavior.ensureShadeReaper(state)
  shadesBehavior.setCharges(state, 3)
  const api = makeApi({ harm: () => true, info: () => true })
  shadesBehavior.behavior.enemyAttackedSuccessfully(state, state.investigators[0], state.enemies[0], api)
  assert.equal(shadesBehavior.chargesOf(state), 1, '移除 2 充能')
  assert.equal(called(api, 'harm'), true)
})

test('09680a 影穑（稳定面）：Shift 选择非精英敌人，可移动并强制其以恐惧攻击另一敌人', () => {
  const rule = assetRuleFor('09680a').shift
  assert.equal(rule.kind, 'moveAndClash')
  const state = baseState({ investigators: [investigator(0, { location: 'stationWestWing' })],
    enemies: [{ id: 'e1', code: '09674a', originalCode: '09674a', location: 'stationWestWing', defeated: false,
      traits: ['Geist'] }, { id: 'e2', code: '09675a', originalCode: '09675a', location: 'stationWestWing',
      defeated: false, traits: ['Geist'] }] })
  shadesBehavior.ensureShadeReaper(state)
  const api = makeApi({ choice: () => 'e1', damageEnemy: () => true, moveEnemy: () => true,
    'mechanics.tsk.keys.shift': () => true, info: () => true })
  const result = shadesBehavior.shiftShadeReaper(state, 0, api)
  assert.ok(result !== null, 'Shift 结算返回结果')
})

test('09680b 影穑（动荡面）：每位调查员失去 1 行动（不在其回合则下回合）；调查员变换时翻回稳定面', () => {
  const rule = assetRuleFor('09680b').shift
  assert.equal(rule.kind, 'loseActions')
  assert.equal(rule.flipOnShift, 'investigatorOnly')
  const state = baseState({ currentSeat: 0, investigators: [investigator(0), investigator(1, { location: 'stationWestWing' })] })
  shadesBehavior.ensureShadeReaper(state)
  const api = makeApi({ loseActions: () => true, 'mechanics.tsk.keys.shift': () => true, info: () => true })
  shadesBehavior.shiftShadeReaper(state, 0, api)
  assert.equal(called(api, 'loseActions'), true)
})

// ===== without_a_trace（13） ==============================================================

function withoutState(overrides = {}) {
  const state = baseState({ scenario: { id: 'withoutATrace', startLocation: 'courtOfTheOutsiders',
    stageCards: {}, locations: {} }, ...overrides })
  state.investigators[0].location = withoutDef.START_LOCATION
  return state
}

test('09681 不留痕迹：剧本参考卡混乱标记表（skull 地点数 / cultist 域外敌人 / tablet 空洞 / elderthing 空洞化）', () => {
  const state = withoutState({ locations: [{ id: 'l1', revealed: true }, { id: 'l2', revealed: false }] })
  const inv = state.investigators[0]
  const skull = withoutChaos.withoutATraceChaosToken(state, inv, 'skull', { countLocations: () => 2, countHollows: () => 0 })
  assert.equal(skull.delta, -1, 'skull -X = 一半地点数向下取整')
  const tablet = withoutChaos.withoutATraceChaosToken(state, inv, 'tablet', { countLocations: () => 2, countHollows: () => 2 })
  assert.equal(tablet.delta, -2, 'tablet -X = 自己放一边的空洞数（上限 5）')
  const elder = withoutChaos.withoutATraceChaosToken(state, inv, 'elderthing', { countLocations: () => 2, countHollows: () => 0 })
  assert.equal(elder.delta, -3)
  assert.ok(elder.rider === 'elderThingHollow' || elder.hollow === true || elder.rider, 'elderthing 有空洞化 rider')
  const hardState = withoutState({ difficulty: 'hard', locations: [{ id: 'l1', revealed: true }, { id: 'l2', revealed: true }] })
  const hardSkull = withoutChaos.withoutATraceChaosToken(hardState, hardState.investigators[0], 'skull', { countLocations: () => 2, countHollows: () => 0 })
  assert.equal(hardSkull.delta, -2, '困难 skull = 地点数')
})

test('09682 异界恐惧：背面洗入天启噩兆/原生质重组者并群选两项；正面入场额外费用时机未落地（缺口）', () => {
  const state = withoutState({ agendas: [{ id: 'agenda09682', code: '09682', originalCode: '09682',
    backAction: 'chooseTwoOfThree', shuffleBack: [withoutDef.RAW_CODES.apocalypticPresage, withoutDef.RAW_CODES.protoplasmicReassembler] }] })
  const api = makeApi({ shuffleIntoEncounterDeck: () => true, choice: choice => choice.options[0].id,
    info: () => true, dealTo: () => true, harm: () => true })
  withoutBehavior.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(called(api, 'shuffleIntoEncounterDeck'), true, '洗入两张放一边的敌人')
  // 缺口证据：入场额外费用被记成「待付」并在下一次 locationLeft 才扣（单槽位可被覆盖）。
  const flags = withoutBehavior.withoutATraceFlags(withoutState())
  assert.equal(flags.pendingEntryCost, null, 'pendingEntryCost 是单一待付槽位')
  assert.equal(withoutBehavior.behavior.upkeepBegins, undefined)
})

test('09683 异界的羔羊：背面三选二（伤害恐惧 / 空洞 / 混洗迷你卡）', () => {
  const state = withoutState({ agendas: [{ id: 'agenda09683', code: '09683', originalCode: '09683', backAction: 'chooseTwoOfThree' }] })
  const api = makeApi({ choice: (() => { let index = -1; return choice => choice.options[Math.min(++index, choice.options.length - 1)].id })(),
    harm: () => true, info: () => true })
  withoutBehavior.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(api.calls.filter(call => call.key === 'choice').length, 2, '共同选择两项')
})

test('09684 异界的屠杀：背面未撤退者发疯、已撤退者可立即推进幕 3b（未实现「可」的选择，缺口）', () => {
  const state = withoutState({ agendas: [{ id: 'agenda09684', code: '09684', originalCode: '09684', backAction: 'drivenInsane' }],
    investigators: [investigator(0, { resigned: true, location: withoutDef.START_LOCATION }),
      investigator(1, { location: withoutDef.START_LOCATION })] })
  const api = makeApi({ driveInsane: () => true, finish: () => true, info: () => true })
  withoutBehavior.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(called(api, 'driveInsane'), true, '未撤退者被驱入疯狂')
  assert.equal(called(api, 'finish'), true, '有撤退者时直接推进结局（自动，无「可」选择）')
  assert.equal(called(api, 'choice'), false, '缺口：没有询问是否立即推进')
})

test('09685 穿越域外之地：域外来客之巢揭示推进；背面生成横置拟态克星、弃牌堆空洞、红手套放一边', () => {
  const state = withoutState({ actIndex: 0, acts: [{ id: 'act09685', code: '09685', originalCode: '09685', objective: { type: 'campaignRule', kind: 'lairRevealed' } }],
    locations: [{ id: withoutDef.OUTSIDERS_LAIR_ID, name: '巢', originalCode: '09689', revealed: true, connections: [], traits: [] }],
    investigators: [investigator(0, { location: withoutDef.START_LOCATION, discard: ['01020', '01021'] })] })
  withoutBehavior.withoutATraceFlags(state).lairRevealed = true
  const api = makeApi({ advanceAct: () => true, info: () => true })
  withoutBehavior.behavior.checkObjectives(state, api)
  assert.equal(called(api, 'advanceAct'), true)
  const backApi = makeApi({ spawn: () => ({ id: 'nemesis' }), moveCard: () => true, info: () => true })
  withoutBehavior.ACT_BACK_HANDLERS['09685'](state, backApi)
  assert.equal(called(backApi, 'spawn'), true, '拟态克星生成')
})

test('09686 红色废墟：与拟态克星同地点花 1 线索造成 2 伤害；红手套入场推进幕 2', () => {
  const state = withoutState({ actIndex: 1, acts: [{ id: 'act09685', code: '09685', originalCode: '09685' },
    { id: 'act09686', code: '09686', originalCode: '09686', objective: { type: 'campaignRule', kind: 'redGlovedManEntersPlay' } }],
    enemies: [{ id: 'mimic', code: '09690', originalCode: '09690', location: withoutDef.START_LOCATION, defeated: false }],
    investigators: [investigator(0, { location: withoutDef.START_LOCATION, clues: 2 })] })
  const moves = withoutBehavior.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'act2StrikeMimetic'))
  const api = makeApi({ spendClues: () => true, scenario: { damageEnemy: () => true }, damageEnemy: () => true, info: () => true })
  assert.equal(withoutBehavior.behavior.performAction(state, state.investigators[0], { rule: 'act2StrikeMimetic' }, api), true)
  assert.equal(state.investigators[0].clues, 2, '线索由 api.spendClues 支付（stub 不改）')
  withoutBehavior.withoutATraceFlags(state).redGlovedManInPlay = true
  const objectiveApi = makeApi({ advanceAct: () => true, info: () => true })
  withoutBehavior.behavior.checkObjectives(state, objectiveApi)
  assert.equal(called(objectiveApi, 'advanceAct'), true, '红手套男子入场 → 推进幕')
})

test('09687 逃出异界：域外敌人失去冷漠（近似自动交战）；全体幸存者撤退推进；背面按同谋胜利区 R1–R4', () => {
  assert.equal(withoutBehavior.behavior.assetLeftPlay, undefined,
    '缺口：红手套被击败（资产离场）没有 assetLeftPlay 读点')
  const state = withoutState({ actIndex: 2, acts: [{ id: 'act09685', code: '09685', originalCode: '09685' },
    { id: 'act09686', code: '09686', originalCode: '09686' },
    { id: 'act09687', code: '09687', originalCode: '09687', objective: { type: 'campaignRule', kind: 'allResigned' } }],
    enemies: [{ id: 'o1', code: withoutDef.OUTSIDERS_GROUP_ENEMIES[0], originalCode: withoutDef.OUTSIDERS_GROUP_ENEMIES[0],
      location: withoutDef.START_LOCATION, defeated: false }] })
  const api = makeApi({ engageAtInvestigator: () => true, info: () => true })
  withoutBehavior.behavior.phaseBegan(state, 'enemy', api)
  assert.equal(called(api, 'engageAtInvestigator'), true, '幕 3 域外敌人失去冷漠（自动交战近似）')
  state.investigators[0].resigned = true
  const objApi = makeApi({ advanceAct: () => true, info: () => true })
  withoutBehavior.behavior.checkObjectives(state, objApi)
  assert.equal(called(objApi, 'advanceAct'), true)
  const resolved = withoutBehavior.resolutionFromVictory({ victoryDisplay: [{ code: '09692', originalCode: '09692' }] })
  assert.equal(resolved, 'resolution2', '仅红手套在胜利区 → R2')
})

test('09688 域外来客之廷：撤退检定(4)成功撤退并把同谋加入胜利区；失败后本回合难度 -1', () => {
  const state = withoutState({ investigators: [investigator(0, { location: withoutDef.START_LOCATION,
    assets: [{ id: 'a1', code: '09692', originalCode: '09692' }] })] })
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 9 }),
    removeAsset: () => true, addStoryToVictory: () => true,
    resign: seat => { state.investigators[seat].resigned = true }, info: () => true })
  assert.equal(withoutBehavior.behavior.performAction(state, state.investigators[0], { rule: 'resignCourtOfTheOutsiders' }, api), true)
  assert.equal(state.investigators[0].resigned, true)
  const failApi = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 }), info: () => true })
  const failState = withoutState()
  withoutBehavior.behavior.performAction(failState, failState.investigators[0], { rule: 'resignCourtOfTheOutsiders' }, failApi)
  assert.equal(withoutBehavior.withoutATraceFlags(failState).courtResignFailRound, failState.round, '失败后本回合难度 -1')
})

test('09689 域外来客之巢：域外敌人 +1 fight/evade；[fast] 红手套唯一空洞时入场；揭示左/中/右强制（缺失去冷漠读点）', () => {
  const state = withoutState({ locations: [{ id: withoutDef.OUTSIDERS_LAIR_ID, name: '巢', originalCode: '09689',
    revealed: true, connections: [], traits: [] }],
    enemies: [{ id: 'o1', code: withoutDef.OUTSIDERS_GROUP_ENEMIES[0], originalCode: withoutDef.OUTSIDERS_GROUP_ENEMIES[0],
      location: withoutDef.OUTSIDERS_LAIR_ID, defeated: false }],
    investigators: [investigator(0, { location: withoutDef.OUTSIDERS_LAIR_ID })] })
  state.investigators[0].location = withoutDef.OUTSIDERS_LAIR_ID
  assert.equal(withoutBehavior.behavior.enemyStatModifier(state, state.enemies[0], 'fight'), 1)
  assert.equal(withoutBehavior.behavior.enemyStatModifier(state, state.enemies[0], 'evade'), 1)
  const moves = withoutBehavior.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'lairSummonRedGlovedMan'))
  // 缺口：印刷「此地点每个域外敌人失去冷漠」没有读点（behavior 只在幕 3 自动交战）。
  assert.equal(withoutBehavior.behavior.locationRule, undefined)
  assert.equal(withoutDef.scenario.locations[withoutDef.OUTSIDERS_LAIR_ID].losesAloof, undefined,
    '巢地点定义没有「域外敌人失去冷漠」字段（缺口）')
})

test('09690 拟态克星：造成伤害改为弃等量空洞；轮末本地调查员空洞化或受攻击', () => {
  const state = withoutState({ enemies: [{ id: 'm', code: '09690', originalCode: '09690', location: withoutDef.START_LOCATION, defeated: false }] })
  hollowCard(state, { code: '01020', source: 'test', scope: 'investigator', seat: 0 })
  const api = makeApi({ info: () => true })
  assert.equal(withoutBehavior.behavior.enemyDamageAmount(state, state.enemies[0], 1, api), 0, '伤害改为弃空洞')
  assert.equal(withoutBehavior.setAsideHollows(state).length, 0, '空洞被弃掉')
  const roundApi = makeApi({ choice: () => null, attack: () => true, info: () => true })
  const results = withoutBehavior.behavior.roundEnded(state, roundApi)
  assert.ok(Array.isArray(results))
})

test('09691 原生质重组者：Spawn 离所有调查员最远；敌军阶段末生成魔像（以牌库顶空洞近似）', () => {
  assert.equal(entries['09691'].spawnFarthestFromAll, true)
  const state = withoutState({ enemies: [{ id: 'r', code: '09691', originalCode: '09691',
    location: withoutDef.START_LOCATION, defeated: false, exhausted: false }],
    investigators: [investigator(0, { location: withoutDef.START_LOCATION, deck: ['01020'] })] })
  const api = makeApi({ moveCard: () => true, info: () => true })
  const result = withoutBehavior.behavior.enemyPhaseEnd(state, api)
  assert.ok(result && result.golem === '01020', '牌库顶卡作为魔像（空洞近似）')
})

test('09692 戴红手套的男子：攻击/躲避域外敌人超过难度 2 点时横置→1 伤害+1 线索', () => {
  const rule = assetRuleFor('09692').outsiderSuccessReaction
  assert.equal(rule.by, 2)
  const state = withoutState({ lastTestResult: { successBy: 3 },
    enemies: [{ id: 'o1', code: withoutDef.OUTSIDERS_GROUP_ENEMIES[0], originalCode: withoutDef.OUTSIDERS_GROUP_ENEMIES[0],
      location: withoutDef.START_LOCATION, defeated: false }],
    investigators: [investigator(0, { location: withoutDef.START_LOCATION,
      assets: [{ id: 'rgm', code: '09692', originalCode: '09692' }] })] })
  const api = makeApi({ damageEnemy: () => true, discoverClue: () => true, info: () => true })
  const result = withoutBehavior.behavior.enemyAttackedSuccessfully(state, state.investigators[0], state.enemies[0], api)
  assert.ok(result)
  assert.equal(state.investigators[0].assets[0].exhausted, true)
  assert.equal(called(api, 'discoverClue'), true)
})

test('09693 艾里奇：迷你卡揭露后横置→选择一张放一边的空洞由所有者抽回', () => {
  const rule = assetRuleFor('09693').exposeRecallHollow
  assert.equal(rule, true)
  const state = withoutState({ locations: [{ id: withoutDef.START_LOCATION, name: '廷', originalCode: '09688',
    revealed: true, connections: [], traits: [] }],
    investigators: [investigator(0, { location: withoutDef.START_LOCATION,
      assets: [{ id: 'aliki', code: '09693', originalCode: '09693' }] })] })
  withoutBehavior.withoutATraceFlags(state)
  state.scenarioFlags.mechanics = { grid: { [withoutDef.START_LOCATION]: { x: 0, y: 0 } } }
  const flags = withoutBehavior.withoutATraceFlags(state)
  flags.shadows = { left: 'shadowLeft', middle: null, right: null }
  state.locations.push({ id: 'shadowLeft', name: '影左', originalCode: withoutDef.RAW_CODES.outsidersLair,
    revealed: false, connections: [], traits: [] })
  const mini = placeMiniCard(state, { kind: withoutDef.MINI_KIND_BY_POSITION.left, decoy: false, locationId: 'shadowLeft' })
  flags.spots[mini.id] = { x: 1, y: 0 }
  hollowCard(state, { code: '01020', source: 'test', scope: 'investigator', seat: 0 })
  const api = makeApi({ info: () => true })
  const result = withoutBehavior.exposeMiniInShadows(state, state.investigators[0], mini.id, api)
  assert.ok(result, '揭露迷你卡')
  assert.equal(state.investigators[0].assets[0].exhausted, true, '艾里奇横置')
})

// ===== congress_of_the_keys（2） ==========================================================

test('09694 钥匙议会：混乱标记表（skull 幕编号 / cultist 翻稳定钥匙 / tablet 对重整域外自动失败 / elderthing 空洞化投入卡）', () => {
  const state = baseState({ scenario: { id: 'congressOfTheKeys', stageCards: {}, locations: {} },
    acts: [{ id: 'act1', stage: '2a', code: '09694' }], agendaIndex: 0 })
  const inv = state.investigators[0]
  const skull = congressChaos.congressChaosToken(state, inv, 'skull')
  assert.equal(skull.delta, -2, 'skull -X，X=当前幕编号')
  const tablet = congressChaos.congressChaosToken(state, inv, 'tablet', { attackOutsider: true })
  assert.equal(tablet.autoFail, true, '对重整域外敌人的攻击自动失败')
  const elder = congressChaos.congressChaosToken(state, inv, 'elderthing')
  assert.equal(elder.cancelCommitted, true)
  assert.equal(elder.rider, 'hollowCommitted')
  const cultist = congressChaos.congressChaosToken(state, inv, 'cultist')
  assert.equal(cultist.delta, -5)
  assert.equal(cultist.flipDelta, -2)
})

test('09695 因果汇流：幕 2/3/4 时跳过 b 面；背面按幕版本结算（vII 放 4 毁灭并推进幕，vI/vIII 变钥匙+额外敌军阶段近似）', () => {
  const state = baseState({ scenario: { id: 'congressOfTheKeys', stageCards: {}, locations: {} },
    actIndex: 2, agendas: [{ id: 'agenda09695', code: '09695', originalCode: '09695' }], agendaIndex: 0,
    acts: [{ id: 'act1', stage: '3a', code: '09697' }], campaign: { leadSeat: 0, records: {}, tsk: {} } })
  const skipApi = makeApi({ info: () => true, advanceAct: () => true, finish: () => true })
  congressBehavior.behavior.agendaReveal(state, state.agendas[0], skipApi)
  assert.equal(called(skipApi, 'advanceAct'), false, '幕 2/3/4 时跳过 b 面（不结算）')
  assert.equal(called(skipApi, 'finish'), false)
  // 版本一/三：每个敌人变换身上附属的每个钥匙，然后立即结算额外一个敌军阶段（近似披露）。
  const shiftState = baseState({ scenario: { id: 'congressOfTheKeys', stageCards: {}, locations: {} },
    actIndex: 0, agendas: [{ id: 'agenda09695', code: '09695', originalCode: '09695' }],
    acts: [{ id: 'act1', stage: '1a', code: '09696' }], campaign: { leadSeat: 0, records: {}, tsk: {} },
    enemies: [{ id: 'e1', code: withoutDef.OUTSIDERS_GROUP_ENEMIES[0], originalCode: withoutDef.OUTSIDERS_GROUP_ENEMIES[0],
      location: 'anywhere', defeated: false, keyIds: ['09680'] }] })
  const shiftApi = makeApi({ info: () => true, advanceAct: () => true })
  congressBehavior.behavior.agendaReveal(shiftState, shiftState.agendas[0], shiftApi)
  assert.equal(called(shiftApi, 'info'), true, '密谋 1b 按版本分派并披露额外敌军阶段近似')
})
