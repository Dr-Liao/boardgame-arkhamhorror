// 08-a 分片 8（《地球边缘》eoec 08653–08697）新增验收证据。
//
// 目标：45 张卡各有标题含卡号的规则验收，重验旧缺口通过真实行动、遭遇、阶段和相应状态读点。
//
// 运行：node --test tests/acceptance-08-a-shard8.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { enemyEvadeValue, enemyFightValue, enemyPhase, getStat, registerCampaignScenarios, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entryFlags, locationRuleFor, actRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapterStory } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import * as p1 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import * as p2 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { initializeSeals, placeDormantSeal } from '../src/campaign/eote-seals.js'
import { initializeFacilities, damageTower, towerState } from '../src/engine/eote-facilities.js'
import { initializeTekeliDeck } from '../src/engine/eote-tekeli.js'

// ---- 动态加载 45 张单卡条目（与生产索引同一批文件），并登记到进程内注册表 -------------------
const ROOTS = [
  'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1',
  'src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2',
]
const SHARED_ROOT = 'src/cards/encounter-entries/edgeOfTheEarth/_shared'
const targets = []
for (const root of [...ROOTS, ...fs.readdirSync(SHARED_ROOT).map(group => path.join(SHARED_ROOT, group))]) {
  if (!fs.statSync(root).isDirectory()) continue
  for (const name of fs.readdirSync(root)) {
    const match = /^(086(?:5[3-9]|6\d|7\d|8\d|9[0-7]))\.js$/.exec(name)
    if (match) targets.push({ code: match[1], file: path.join(root, name) })
  }
}
const entries = {}
for (const target of targets) {
  const module = await import(pathToFileURL(path.resolve(target.file)).href)
  entries[target.code] = module.default
  if (!registeredEntry(target.code)) registerCardAbilities(module.default)
}

// ---- 测试工具 ---------------------------------------------------------------------------
function makeApi(handlers = {}) {
  const calls = []
  const proxy = (prefix = '') => new Proxy(function () {}, {
    get(_target, property) {
      if (property === 'calls') return calls
      const key = prefix ? `${prefix}.${String(property)}` : String(property)
      if (typeof handlers[key] === 'function') {
        return (...args) => { calls.push({ key, args }); return handlers[key](...args) }
      }
      const hasChild = Object.keys(handlers).some(name => name.startsWith(`${key}.`))
      if (hasChild) return proxy(key)
      return (...args) => { calls.push({ key, args }); return undefined }
    },
  })
  return proxy()
}
const called = (api, key) => api.calls.some(call => call.key === key)
const argsOf = (api, key) => api.calls.filter(call => call.key === key).map(call => call.args)
const json = value => JSON.parse(JSON.stringify(value))
const codeOf = card => card?.originalCode || card?.code

function investigator(seat = 0, extra = {}) {
  return { seat, name: `调查员${seat}`, code: '08001', defeated: false, resigned: false,
    location: 'A', clues: 2, resources: 5, damage: 0, horror: 0, ...extra }
}
function baseState(overrides = {}) {
  return {
    status: 'playing', round: 1, difficulty: 'standard', numInvestigators: 1, currentSeat: 0,
    investigators: [investigator(0)],
    locations: [
      { id: 'A', name: '甲', originalCode: '08653', connections: ['B'], traits: ['Ancient Facility'], clues: 0 },
      { id: 'B', name: '乙', originalCode: '08654', connections: ['A'], traits: [], clues: 0 },
    ],
    enemies: [],
    campaign: { leadSeat: 0, records: {}, eote: { seals: { entries: [] } } },
    scenarioFlags: {},
    scenario: { id: 'theHeartOfMadnessPart1', startLocation: 'A', enemies: {}, locations: {} },
    acts: [], agendas: [],
    ...overrides,
  }
}
function seal(kind, extra = {}) {
  return { kind, active: false, placedBySeat: null, locationId: null, ...extra }
}
const passTest = (result = { success: true, value: 99, failedBy: 0 }) => () => result
const runTest = (result = { success: true, value: 99, failedBy: 0 }) => (seat, skill, difficulty, options) => options?.resolve?.(result)

function heartState(chapter, count, links) {
  registerCampaignScenarios('edgeOfTheEarth')
  const state = fixture('01001', count)
  state.humanSeats = state.investigators.map(inv => inv.seat)
  state.scenario = json(chapter.scenario)
  state.acts = json(state.scenario.acts)
  state.agendas = json(state.scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.scenarioFlags = {}
  state.scenarioZones = {}
  state.campaign.id = 'edgeOfTheEarth'
  state.campaign.records = {}
  state.campaign.eote = {}
  state.locations = Object.entries(links).map(([id, connections]) => ({
    id, connections, name: id, revealed: true, shroud: 1, clues: 0,
  }))
  state.enemies = []
  state.encounterDeck = []
  state.encounterDiscard = []
  initializeSeals(state)
  for (const inv of state.investigators) inv.location = state.locations[0].id
  return state
}

function resolveHeartStep(state, command, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: command }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 30, state.pendingChoice.prompt)
    const choice = state.pendingChoice
    const selected = choose(choice)
    const option = choice.options.find(option => option.id === selected)
      ?? choice.options.find(option => ['skip', 'self'].includes(option.id)) ?? choice.options[0]
    assert.ok(option, choice.prompt)
    resolveTransaction(state, option.responderSeat ?? choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
  }
}

function drawHeartCard(state, code, choose) {
  state.encounterDeck.push(code)
  resolveHeartStep(state, 'drawHeartEncounter', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).drawEncounter(seat), choose)
}

const resolveEnemyPhase = state => resolveHeartStep(state, 'heartEnemyPhase',
  (draft, seat, command, events) => events.push(...enemyPhase(draft)))

// ===== 通过卡（20） ======================================================================
test('08653 原生质池：[action] 控制封印 D → agility(3)，成功后团队线索激活并伤害所有敌人', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = [seal('D', { placedBySeat: 0 })]
  state.enemies = [{ id: 'e1', name: '敌1', defeated: false }, { id: 'e2', name: '敌2', defeated: false }]
  const api = makeApi({ test: runTest(), 'scenario.spendClues': () => true,
    'mechanics.eoteCampaign.seals.activate': () => true })
  const ability = entries['08653'].abilities[0]
  assert.equal(ability.criteria({ state, inv: state.investigators[0] }), true)
  ability.resolve({ state, inv: state.investigators[0], source: state.locations[0], api })
  assert.equal(argsOf(api, 'test')[0][1], 'agility')
  assert.equal(argsOf(api, 'test')[0][2], 3)
  assert.ok(called(api, 'scenario.spendClues'))
  assert.equal(argsOf(api, 'mechanics.eoteCampaign.seals.activate')[0][0], 'D')
  assert.equal(argsOf(api, 'scenario.damageEnemy').length, 2, '对场上每个敌人各 2 伤害')
})

test('08654 无光之海大厅：控制封印 E → 团队线索 + 弃手牌 → 激活封印 E', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = [seal('E', { placedBySeat: 0 })]
  const api = makeApi({ 'scenario.spendClues': () => true, discardChosen: () => [],
    'mechanics.eoteCampaign.seals.activate': () => true })
  entries['08654'].abilities[0].resolve({ state, inv: state.investigators[0], source: state.locations[0], api })
  assert.ok(called(api, 'scenario.spendClues'))
  assert.ok(called(api, 'discardChosen'))
  assert.equal(argsOf(api, 'mechanics.eoteCampaign.seals.activate')[0][0], 'E')
})

test('08655 水下扩张区：每次检定的第一个 [frost] 修正视为 -3（每轮一次）', () => {
  const state = baseState()
  state.skillTest = { seat: 0, tokenResults: [] }
  const api = makeApi({ 'mechanics.chaosTokens.treat': () => true })
  const ability = entries['08655'].abilities[0]
  assert.equal(ability.criteria({ state, source: state.locations[0], inv: state.investigators[0], context: { token: 'frost' } }), true)
  ability.resolve({ state, source: state.locations[0], inv: state.investigators[0], context: { token: 'frost' }, api })
  assert.deepEqual(argsOf(api, 'mechanics.chaosTokens.treat')[0][0], { as: 'frost', modifier: -3 })
})

test('08656 拱形走廊：[fast] 选另一拱形走廊，敏捷(X) 成功后移动（每轮一次）', () => {
  const state = baseState({
    locations: [
      { id: 'A', name: '走廊1', originalCode: '08656', connections: ['M'], traits: [] },
      { id: 'M', name: '中间', originalCode: '08650', connections: ['A', 'B'], traits: [] },
      { id: 'B', name: '走廊2', originalCode: '08656', connections: ['M'], traits: [] },
    ],
  })
  const api = makeApi({ test: runTest(), choice: () => 'B', moveInvestigator: () => true })
  entries['08656'].abilities[0].resolve({ state, inv: state.investigators[0], source: state.locations[0], api })
  assert.equal(argsOf(api, 'test')[0][1], 'agility')
  assert.equal(argsOf(api, 'test')[0][2], 2, 'X = 相隔地点数（走廊1→中间→走廊2）')
  assert.deepEqual(argsOf(api, 'moveInvestigator')[0], [0, 'B'])
})

test('08657 原始恐怖：意志(2)+离伊夸之门距离，失败 2 恐惧', () => {
  const state = baseState({
    locations: [
      { id: 'A', name: '甲', originalCode: '08650', connections: ['M'], traits: [] },
      { id: 'M', name: '中', originalCode: '08651', connections: ['A', 'G'], traits: [] },
      { id: 'G', name: '伊夸之门', originalCode: '08649', connections: ['M'], traits: [] },
    ],
  })
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, failedBy: difficulty }) })
  entries['08657'].encounterResolve(state, state.investigators[0], { code: '08657' }, api)
  assert.equal(argsOf(api, 'test')[0][1], 'willpower')
  assert.equal(argsOf(api, 'test')[0][2], 4, '基础 2 + 相隔 2 个地点')
  assert.deepEqual(argsOf(api, 'horror')[0], [0, 2])
})

test('08658 地球根源：敏捷(2)+距离，失败 2 伤害', () => {
  const state = baseState({
    locations: [
      { id: 'A', name: '甲', originalCode: '08650', connections: ['G'], traits: [] },
      { id: 'G', name: '伊夸之门', originalCode: '08649', connections: ['A'], traits: [] },
    ],
  })
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, failedBy: difficulty }) })
  entries['08658'].encounterResolve(state, state.investigators[0], { code: '08658' }, api)
  assert.equal(argsOf(api, 'test')[0][1], 'agility')
  assert.equal(argsOf(api, 'test')[0][2], 3)
  assert.deepEqual(argsOf(api, 'damage')[0], [0, 2])
})

test('08659 跳动的心脏：同地点 2 枚激活封印 → R3，背面幕间「最后一根稻草」可读', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = [seal('A', { active: true, placedBySeat: 0 }), seal('B', { active: true, placedBySeat: 0 })]
  const api = makeApi({ finish: () => true, info: () => true,
    setScenarioFlag: (key, value) => { state.scenarioFlags[key] = value } })
  entries['08659'].agendaRule.onLeave(state, {}, api)
  assert.equal(state.scenarioFlags.interlude, 'theFinalStraw')
  const sections = chapterStory('theHeartOfMadnessPart1').sections
  assert.ok(JSON.stringify(sections).includes('最后一根稻草'), '章节指南含幕间「最后一根稻草」正文')
})

test('08663 巨大封印：五枚激活封印放上伊夸之门 → 大封印完成（R1）', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = ['A', 'B', 'C', 'D', 'E'].map(kind => seal(kind, { active: true, locationId: 'A' }))
  state.acts = [{ id: 'act08663', code: '08663', originalCode: '08663' }]
  state.actIndex = 0
  const api = makeApi({ finish: () => true, info: () => true, advanceAct: () => true })
  p1.behavior.checkObjectives(state, api)
  assert.equal(actRuleFor('08663').objective.type, 'allSealsOnGate')
  assert.deepEqual(argsOf(api, 'finish')[0], ['resolution1', state])
})

function sealLocationTest(code, skill) {
  return () => {
    const state = baseState()
    const location = { id: 'A', name: code, originalCode: code, connections: [], traits: [], revealed: true }
    state.locations = [location]
    const moves = []
    locationRuleFor(code).actions({ moves, state, inv: state.investigators[0], location })
    assert.equal(moves.length, 1)
    assert.equal(moves[0].rule, `heartOfMadnessSeal:${code === '08664' ? 'A' : code === '08665' ? 'B' : code === '08666' ? 'C' : 'D'}`)
    assert.equal(entryFlags(code).recoverSkill, skill)
    assert.equal(entryFlags(code).recoverDifficulty, 2)
    const api = makeApi({ test: runTest(), payGroupClues: () => true, info: () => true })
    const handled = p1.behavior.performAction(state, state.investigators[0],
      { rule: moves[0].rule, action: 'scenarioAction' }, api)
    assert.equal(handled, true)
    assert.equal(argsOf(api, 'test')[0][1], skill)
  }
}
test('08664 冰川石窟：揭示放封印 A + [action] combat(2) 团队线索取得控制权', sealLocationTest('08664', 'combat'))
test('08665 雕塑墓室：揭示放封印 B + [action] intellect(2) 团队线索取得控制权', sealLocationTest('08665', 'intellect'))
test('08666 地底祭坛：揭示放封印 C + [action] willpower(2) 团队线索取得控制权', sealLocationTest('08666', 'willpower'))
test('08667 脓液隧道：揭示放封印 D + [action] agility(2) 团队线索取得控制权', sealLocationTest('08667', 'agility'))

test('08668 灰岩洞穴：团队线索 1×人数 + 资源 3×人数取得封印控制权（无检定）', () => {
  const state = baseState()
  state.campaign.id = 'edgeOfTheEarth'
  state.campaign.eote = {}
  state.investigators[0].resources = 9
  initializeSeals(state)
  const location = { id: 'A', name: '灰岩洞穴', originalCode: '08668', connections: [], traits: [] }
  placeDormantSeal(state, 'E', 'A')
  state.locations = [location]
  const moves = []
  locationRuleFor('08668').actions({ moves, state, inv: state.investigators[0], location })
  assert.equal(moves[0].rule, 'heartOfMadnessSeal:E')
  assert.equal(entryFlags('08668').recoverResourcesPerInvestigator, 3)
  const api = makeApi({ payGroupClues: () => true, info: () => true })
  p1.behavior.performAction(state, state.investigators[0], { rule: moves[0].rule }, api)
  assert.equal(argsOf(api, 'test').length, 0, '无检定')
  assert.ok(state.investigators[0].resources < 9, '资源费用已支付')
})

test('08686 隐秘隧道：每名未击败调查员都在隐藏隧道 → 幕目标结算（Run）', () => {
  const state = baseState()
  state.acts = [{ id: 'act08681', code: '08681', originalCode: '08681' }]
  state.actIndex = 0
  state.locations = [{ id: 'hiddenTunnel', name: '隐藏隧道', originalCode: '08686', connections: [] },
    ...[1, 2, 3, 4, 5].map(index => ({ id: `tower${index}`, name: `塔${index}`, originalCode: '08674', connections: [], traits: [] }))]
  state.investigators[0].location = 'hiddenTunnel'
  state.campaign.records.theTruthOfTheMirageEludesYou = true
  initializeFacilities(state, { facilities: [], towers: [1, 2, 3, 4, 5].map(index => ({ id: `tower${index}`, towerIndex: index, mistPylon: true })) })
  for (const index of [1, 2, 3, 4, 5]) damageTower(state, { towerId: `tower${index}`, amount: 99 })
  const api = makeApi({ finish: () => true, info: () => true })
  p2.behavior.checkObjectives(state, api)
  assert.deepEqual(argsOf(api, 'finish')[0], ['resolution2', state])
})

test('08687 原初恶魔：造成伤害后洗入 1 张忒咳哩-哩；不能洗入时它攻击你', () => {
  const state = baseState()
  const ability = entries['08687'].abilities[0]
  const context = { seat: 0, enemy: { id: 'e1', code: '08687' } }
  const api = makeApi({ 'mechanics.tekeli.size': () => 1, 'mechanics.tekeli.shuffleIn': () => ['05001'],
    'scenario.attack': () => true, info: () => true })
  ability.resolve({ state, source: { id: 'e1', code: '08687' }, context, api })
  assert.deepEqual(argsOf(api, 'mechanics.tekeli.shuffleIn')[0], [0, 1])
  assert.equal(called(api, 'scenario.attack'), false)
  const emptyApi = makeApi({ 'mechanics.tekeli.size': () => 0, 'scenario.attack': () => true, info: () => true })
  ability.resolve({ state, source: { id: 'e1', code: '08687' }, context, api: emptyApi })
  assert.equal(called(emptyApi, 'scenario.attack'), true, '不能洗入时攻击调查员')
})

test('08688 潜藏的疯狂：意志(4)，失败每点洗入 1 张，无法洗入每张 1 恐惧', () => {
  const state = baseState()
  const api = makeApi({
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 1, failedBy: 3 }),
    'mechanics.tekeli.size': () => 3, 'mechanics.tekeli.shuffleIn': () => ['05001', '05002'],
    horror: () => true, info: () => true,
  })
  entries['08688'].encounterResolve(state, state.investigators[0], { code: '08688' }, api)
  assert.equal(argsOf(api, 'test')[0][1], 'willpower')
  assert.equal(argsOf(api, 'test')[0][2], 4)
  assert.deepEqual(argsOf(api, 'horror')[0], [0, 1], '3 点失败 - 2 张可洗入 = 1 恐惧')
})

test('08689 实体疯狂：攻击后洗入 2 张，每张不能洗入则该次攻击 +1 伤害/+1 恐惧', () => {
  const state = baseState()
  const api = makeApi({ 'mechanics.tekeli.size': () => 2, 'mechanics.tekeli.shuffleIn': () => ['05001'],
    damage: () => true, horror: () => true, info: () => true })
  entries['08689'].abilities[0].resolve({ state, source: { id: 'e1', code: '08689' },
    context: { seat: 0, enemy: { id: 'e1', code: '08689' } }, api })
  assert.deepEqual(argsOf(api, 'damage')[0], [0, 1])
  assert.deepEqual(argsOf(api, 'horror')[0], [0, 1])
})

test('08690 冰川幻影：敌军阶段末向人最多地点移动，相邻调查员各洗入 1 张（不能则 1 恐惧）', () => {
  const state = baseState({
    locations: [
      { id: 'A', name: '甲', originalCode: '08653', connections: ['B'], traits: [] },
      { id: 'B', name: '乙', originalCode: '08654', connections: ['A'], traits: [] },
    ],
  })
  state.investigators = [investigator(0, { location: 'B' }), investigator(1, { location: 'B' })]
  state.enemies = [{ id: 'e1', code: '08690', originalCode: '08690', location: 'A', exhausted: false, defeated: false }]
  const api = makeApi({ 'scenario.moveEnemyToward': () => true, 'mechanics.tekeli.size': () => 0,
    'mechanics.tekeli.shuffleIn': () => false, horror: () => true, info: () => true })
  entries['08690'].abilities[0].resolve({ state, source: state.enemies[0], api })
  assert.ok(called(api, 'scenario.moveEnemyToward'), '向人最多的地点移动一次')
  assert.equal(argsOf(api, 'horror').length, 2, '甲/乙都在幻影地点或连接地点，无法洗入各受 1 恐惧')
})

test('08695 古老者清道夫：攻击后弃牌库顶 3 张并抽取其中的弱点', () => {
  const state = baseState()
  const weak = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].subtype === 'weakness' && /^0/.test(code))
  const api = makeApi({ discardTopOfDeck: () => [weak, '05001', '05002'], moveCard: () => true,
    drawCards: () => true, info: () => true })
  entries['08695'].abilities[0].resolve({ state, source: { id: 'e1', code: '08695' },
    context: { seat: 0, enemy: { id: 'e1', code: '08695' } }, api })
  assert.deepEqual(argsOf(api, 'discardTopOfDeck')[0], [0, 3])
  assert.equal(argsOf(api, 'moveCard')[0][0].to, 'deckTop')
  assert.deepEqual(argsOf(api, 'drawCards')[0], [0, 1])
})

test('08696 古老者守卫：每 1 点伤害弃牌库顶 1 张并抽取弱点', () => {
  const state = baseState()
  const weak = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].subtype === 'weakness' && /^0/.test(code))
  const api = makeApi({ discardTopOfDeck: () => [weak, '05001'], moveCard: () => true,
    drawCards: () => true, info: () => true })
  entries['08696'].abilities[0].resolve({ state, source: { id: 'e1', code: '08696' },
    context: { seat: 0, enemy: { id: 'e1', code: '08696' }, amount: 2 }, api })
  assert.deepEqual(argsOf(api, 'discardTopOfDeck')[0], [0, 2])
  assert.deepEqual(argsOf(api, 'drawCards')[0], [0, 1])
})

// ===== 规则缺口复验 ======================================================================

function advanceHeartAgenda(state, code, choose) {
  state.agendaIndex = state.agendas.findIndex(agenda => codeOf(agenda) === code)
  assert.ok(state.agendaIndex >= 0)
  resolveHeartStep(state, 'advanceHeartAgenda', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).advanceAgenda(), choose)
}

test('08660 瘴气的召唤：控制封印 D 或 E 的调查员分别失去行动或资源，激活时增加', () => {
  for (const active of [false, true]) {
    const state = heartState(p1, 2, { origin: ['neighbor'], neighbor: ['origin'] })
    state.investigators[1].location = 'neighbor'
    const [d, e] = ['D', 'E'].map(kind => state.campaign.eote.seals.entries.find(entry => entry.kind === kind))
    Object.assign(d, { placedBySeat: 0, active })
    Object.assign(e, { placedBySeat: 1, active })
    const action = state.investigators[0].actionsLeft
    const resources = state.investigators[1].resources
    advanceHeartAgenda(state, '08660')
    assert.equal(state.investigators[0].actionsLeft, action - (active ? 2 : 1))
    assert.equal(state.investigators[1].resources, resources - (active ? 6 : 3))
    assert.equal(codeOf(state.agendas[state.agendaIndex]), '08661')
  }
})

test('08661 疯狂的召唤：调查员可分别选择精神创伤或洗入三张忒咳哩，随后均被击败', () => {
  const state = heartState(p1, 2, { origin: [] })
  initializeTekeliDeck(state, { cards: ['08723'], copies: [3] })
  const seats = []
  state.hubFlow = true
  state.agendaIndex = state.agendas.findIndex(agenda => codeOf(agenda) === '08661')
  state.doom = state.agendas[state.agendaIndex].doomThreshold - 1
  finishHeartRound(state, choice => {
    if (choice.source !== '08661') return null
    seats.push(choice.seat)
    return choice.seat === 0 ? 'trauma' : 'tekeli'
  })
  assert.deepEqual(seats, [0, 1])
  assert.ok(state.investigators.every(inv => inv.defeated))
  assert.equal(state.campaign.trauma[0].mental, 1)
  assert.equal(state.campaign.trauma[1].mental, 0)
  assert.equal(state.investigators[1].deck.filter(code => code === '08723').length, 3)
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 0)
})

test('08662 蛰伏：放置首枚激活封印后推进幕，按封印种类给予放置者对应收益', () => {
  for (const kind of ['A', 'B', 'C', 'D', 'E']) {
    const state = heartState(p1, 1, { theGateOfYquaa: [] })
    state.locations[0].originalCode = '08649'
    const inv = () => state.investigators[0]
    inv().damage = 2
    inv().horror = 2
    const beforeActions = inv().actionsLeft
    const beforeResources = inv().resources
    const seal = () => state.campaign.eote.seals.entries.find(entry => entry.kind === kind)
    Object.assign(seal(), { placedBySeat: 0, active: true })
    const place = legalMoves(state).find(move => move.action === 'entityAbility' && move.entityId === 'theGateOfYquaa' && move.abilityIndex === 0)
    assert.ok(place)
    move(state, place)
    settle(state)
    assert.equal(codeOf(state.acts[state.actIndex]), '08663')
    assert.equal(seal().locationId, 'theGateOfYquaa')
    assert.equal(inv().damage, kind === 'A' ? 1 : 2)
    assert.equal(inv().hand.length, kind === 'B' ? 2 : 0)
    assert.equal(inv().horror, kind === 'C' ? 1 : 2)
    assert.equal(inv().actionsLeft, beforeActions - 1 + (kind === 'D' ? 1 : 0))
    assert.equal(inv().resources, beforeResources + (kind === 'E' ? 3 : 0))
  }
})

test('08669 原质团：生成在距抽牌者最远的外环，只自动追猎封印持有者，激活后再攻击一次', () => {
  const state = heartState(p1, 2, {
    origin: ['facility2'], facility2: ['origin', 'bridge'], bridge: ['facility2', 'facility1'],
    facility1: ['bridge', 'outside'], outside: ['facility1'],
  })
  state.investigators[1].location = 'facility2'
  Object.assign(state.campaign.eote.seals.entries[0], { placedBySeat: 1 })
  drawHeartCard(state, '08669')
  const mass = () => state.enemies.find(enemy => codeOf(enemy) === '08669')
  assert.equal(mass().location, 'facility1', '比外环更远的普通地点不在生成范围')
  assert.equal(mass().engagedSeat, null)
  state.investigators[0].location = 'facility1'
  assert.ok(legalMoves(state).some(move => move.action === 'engage' && move.enemyId === mass().id),
    '未持有封印的调查员仍可主动交战')
  resolveEnemyPhase(state)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(mass().location, 'bridge')
  assert.equal(mass().engagedSeat, null)
  assert.equal(mass().exhausted, false)

  state.investigators[1].location = 'bridge'
  state.campaign.eote.seals.entries[0].active = true
  state.round++
  resolveEnemyPhase(state)
  assert.equal(mass().engagedSeat, 1)
  assert.equal(mass().exhausted, true)
  assert.equal(state.investigators[1].damage, 2)
  assert.equal(state.investigators[1].horror, 2)
})

test('08671 封印渐弱：消耗场外副本在最近高塔生成；真相未明时逐张结算并洗回忒咳哩', () => {
  const state = heartState(p2, 1, { facility8: ['facility7'], facility7: ['facility8'] })
  Object.assign(state.locations[1], { originalCode: '08674', mistPylon: true })
  p2.behavior.preScenarioSetup(state, [], scenarioRuntime(state, []))
  const pool = () => state.scenarioZones.setAside.filter(code => code === '08679')
  assert.equal(pool().length, 15)
  assert.equal(state.campaign.records.theTruthOfTheMirageEludesYou, true)
  const deck = ['01088', '08724', '08723']
  state.investigators[0].deck = deck.slice()
  advanceHeartAgenda(state, '08671')
  const nameless = state.enemies.find(enemy => codeOf(enemy) === '08679')
  assert.ok(nameless)
  assert.equal(nameless.location, 'facility7')
  assert.equal(pool().length, 14)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.deepEqual(state.investigators[0].deck.toSorted(), deck.toSorted())
  assert.equal(codeOf(state.agendas[state.agendaIndex]), '08672')
})

test('08672 无名存在：用掉场外副本替代毁灭；十五份在场后轮末推进并按已坍塌高塔旁置', () => {
  const state = heartState(p2, 1, {
    origin: ['neighbor'], neighbor: ['origin'], shelter: [], tower: [],
    theGateOfYquaa: [],
  })
  state.agendaIndex = 1
  state.scenarioZones.setAside = Array(14).fill('08679')
  initializeFacilities(state, { facilities: [], towers: [{ id: 'tower', towerIndex: 1, mistPylon: true, health: 1 }] })
  const spawn = (draft, where, events) => scenarioRuntime(draft, events).spawn('08679', where)
  spawn(state, 'neighbor', [])
  resolveHeartStep(state, 'heartDoomReplaced', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).addDoom(2))
  const all = () => state.enemies.filter(enemy => codeOf(enemy) === '08679')
  assert.equal(state.doom, 0)
  assert.equal(all().length, 2)
  assert.ok(all().some(enemy => enemy.location === 'origin'))
  assert.equal(state.scenarioZones.setAside.length, 13)

  for (let count = 0; count < 13; count++) {
    assert.ok(scenarioRuntime(state, []).takeFromSetAside('08679'))
    spawn(state, 'neighbor', [])
  }
  damageTower(state, { towerId: 'tower', amount: 1 })
  state.investigators[0].clues = 3
  state.investigators[0].location = 'shelter'
  assert.equal(all().length, 15)
  finishHeartRound(state)
  assert.equal(codeOf(state.acts[state.actIndex]), '08681')
  assert.equal(codeOf(state.agendas[state.agendaIndex]), '08681')
  assert.equal(state.investigators[0].location, 'titanicRamp1')
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(all().length, 13, '轮末旁置三份，随后的神话阶段以毁灭换回一份')
  assert.ok(all().every(enemy => enemy.location === 'titanicRamp1'))
  assert.equal(scenarioRuntime(state, []).enemyZones.list('namelessMadness').length, 2)
})

test('08673 坍塌高塔：可以花掉刚在高塔发现的全部线索并造成等量伤害', () => {
  const state = heartState(p2, 1, { tower: [] })
  Object.assign(state.locations[0], { mistPylon: true, clues: 2 })
  initializeFacilities(state, { facilities: [], towers: [{ id: 'tower', towerIndex: 1, mistPylon: true, health: 2 }] })
  state.investigators[0].clues = 1
  let accepted = false
  resolveHeartStep(state, 'heartFindClues', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).discoverClue(seat, 2, 'tower'), choice => {
    const option = choice.options.find(option => /对该高塔造成等量伤害/.test(option.label))
    if (option) accepted = true
    return option?.id
  })
  assert.equal(accepted, true)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.locations[0].clues, 0)
  assert.equal(towerState(state, 'tower').damage, 2)
  assert.equal(towerState(state, 'tower').collapsed, true)
})

test('疯狂之心章间：领队只分配记录中的封印，放上门的保持激活，回收的以休眠面进入', () => {
  const previous = heartState(p1, 2, { theGateOfYquaa: ['oldFacility'], oldFacility: ['theGateOfYquaa'] })
  const oldSeals = previous.campaign.eote.seals.entries
  Object.assign(oldSeals[0], { active: true, placedBySeat: 0, locationId: 'theGateOfYquaa' })
  Object.assign(oldSeals[1], { active: true, placedBySeat: 0 })
  oldSeals[2].locationId = 'oldFacility'
  oldSeals[3].placedBySeat = 1
  previous.investigators[1].defeated = true
  p1.behavior.resolution(previous, 'resolution2', [], scenarioRuntime(previous, []))
  assert.deepEqual(previous.campaign.records.sealsPlaced, ['A'])
  assert.deepEqual(previous.campaign.records.sealsRecovered, ['B'])

  const next = heartState(p2, 2, { facility8: [] })
  next.campaign = structuredClone(previous.campaign)
  const recipients = ['1', '0']
  resolveHeartStep(next, 'heartSetupSeals', (draft, seat, command, events) =>
    p2.behavior.preScenarioSetup(draft, events, scenarioRuntime(draft, events)), choice => {
    assert.equal(choice.source, 'heartOfMadnessSeals')
    assert.equal(choice.seat, next.campaign.leadSeat)
    return recipients.shift()
  })
  assert.deepEqual(recipients, [])
  const seals = next.campaign.eote.seals.entries
  assert.deepEqual(seals.map(({ kind, placedBySeat, active, locationId }) => [kind, placedBySeat, active, locationId]), [
    ['A', 1, true, null], ['B', 0, false, null], ['C', null, false, null], ['D', null, false, null], ['E', null, false, null],
  ])
  assert.equal(next.scenarioZones.setAside.filter(code => code === '08679').length, 15)
})

const pylonCodes = [
  ['08674', 'A', '提高封印持有者对高塔的伤害'],
  ['08675', 'B', '所有高塔的帷幕减 2'],
  ['08676', 'C', '所有高塔所在地的调查员四技能加 1'],
  ['08677', 'D', '高塔所在地每次受伤恐惧时取消一点'],
  ['08678', 'E', '所有高塔所在地的敌人战斗与躲避减 2'],
]

for (const [code, kind, effect] of pylonCodes) {
  test(`${code} 迷雾高塔：未揭示入场需团队线索，释放已激活封印后${effect}`, () => {
    const state = heartState(p2, 2, { origin: ['tower'], tower: ['origin', 'otherTower'], otherTower: ['tower'] })
    const [start, tower, other] = state.locations
    Object.assign(tower, { originalCode: code, mistPylon: true, revealed: false, shroud: 4 })
    Object.assign(other, { mistPylon: true, shroud: 4 })
    initializeFacilities(state, { facilities: [], towers: [
      { id: tower.id, towerIndex: 1, mistPylon: true, health: 4 },
      { id: other.id, towerIndex: 2, mistPylon: true, health: 4 },
    ] })
    const inv = () => state.investigators[0]
    const teammate = () => state.investigators[1]
    const enter = () => ({ action: 'move', locationId: tower.id })
    const release = choice => choice.options.find(option => option.id === `scenario-fast:heartOfMadnessUnleash:${kind}:`)?.id
    inv().clues = 1
    teammate().clues = 1
    teammate().location = other.id
    assert.match(validateMove(state, 0, enter()), /线索/)
    assert.equal(inv().location, start.id)
    teammate().location = start.id
    move(state, enter())
    settle(state)
    assert.equal(inv().location, tower.id)
    assert.equal(inv().clues, 0)
    assert.equal(teammate().clues, 0)
    assert.equal(state.locations.find(location => location.id === tower.id).revealed, true)
    move(state, { action: 'resource' })
    settle(state, choice => assert.equal(release(choice), undefined))
    const seal = () => state.campaign.eote.seals.entries.find(seal => seal.kind === kind)
    seal().placedBySeat = 0
    move(state, { action: 'resource' })
    settle(state, choice => assert.equal(release(choice), undefined, '休眠封印不能释放'))
    seal().active = true
    const skills = ['willpower', 'intellect', 'combat', 'agility']
    const readSkills = () => skills.map(skill => getStat(state, inv(), skill))
    const base = readSkills()
    move(state, { action: 'resource' })
    let offeredRelease = false
    settle(state, choice => {
      const command = release(choice)
      if (command) offeredRelease = true
      return command
    })
    assert.equal(offeredRelease, true, '有激活的对应封印时提供快速动作')
    assert.equal(seal().locationId, tower.id)

    inv().location = other.id
    if (kind === 'A') {
      state.chaosBag = ['+8']
      const attack = legalMoves(state).find(move => move.rule === `heartOfMadnessAttackPylon:${other.id}`)
      assert.ok(attack)
      move(state, attack)
      settle(state)
      assert.equal(towerState(state, other.id).damage, 2)
    } else if (kind === 'B') {
      assert.equal(scenarioRuntime(state, []).locationShroud(other.id, 0, { includeLocationState: true }), 2)
    } else if (kind === 'C') {
      assert.deepEqual(readSkills(), base.map(value => value + 1))
      inv().location = start.id
      assert.deepEqual(readSkills(), base)
    } else if (kind === 'D') {
      resolveHeartStep(state, 'heartPylonHarm', (draft, seat, command, events) =>
        scenarioRuntime(draft, events).harm(seat, { damage: 1, horror: 1 }),
      choice => choice.source === '08677' ? 'horror' : null)
      assert.equal(inv().damage, 1)
      assert.equal(inv().horror, 0)
    } else {
      const foe = enemy(state, { location: other.id, fight: 4, evade: 5 })
      assert.equal(enemyFightValue(state, foe, inv()), 2)
      assert.equal(enemyEvadeValue(state, foe, inv()), 3)
      foe.location = start.id
      assert.equal(enemyFightValue(state, foe, inv()), 4)
      assert.equal(enemyEvadeValue(state, foe, inv()), 5)
    }
  })
}

test('08679 无名疯狂：攻击成功免疫伤害，超过难度的点数决定横置最近已重整的份数', () => {
  const state = heartState(p2, 1, { origin: ['near'], near: ['origin', 'far'], far: ['near'] })
  const enemies = [
    enemy(state, { code: '08679', originalCode: '08679', location: 'origin', engagedSeat: null, massive: true, fight: 3, exhausted: false }),
    enemy(state, { code: '08679', originalCode: '08679', location: 'near', engagedSeat: null, massive: true, exhausted: false }),
    enemy(state, { code: '08679', originalCode: '08679', location: 'far', engagedSeat: null, massive: true, exhausted: false }),
  ]
  state.chaosBag = ['+1']
  move(state, { action: 'fight', enemyId: enemies[0].id })
  settle(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.value - state.lastTestResult.difficulty, 2)
  assert.deepEqual(enemies.map(original => state.enemies.find(enemy => enemy.id === original.id).exhausted), [true, true, false])
  assert.ok(state.enemies.every(enemy => enemy.damageTaken === 0))
})

test('08680 未封幻影：跳过已坍塌高塔、重整后护塔，敌人阶段末向最近可用高塔移动一格', () => {
  const state = heartState(p2, 1, {
    origin: ['near', 'bridge'], near: ['origin'], bridge: ['origin', 'standing'],
    standing: ['bridge', 'remote'], remote: ['standing'],
  })
  for (const site of state.locations) site.mistPylon = ['near', 'standing', 'remote'].includes(site.id)
  initializeFacilities(state, { facilities: [], towers: [
    { id: 'near', towerIndex: 1, mistPylon: true, health: 2 },
    { id: 'standing', towerIndex: 2, mistPylon: true, health: 3 },
    { id: 'remote', towerIndex: 3, mistPylon: true, health: 2 },
  ] })
  damageTower(state, { towerId: 'near', amount: 2 })
  drawHeartCard(state, '08680')
  const phantasm = () => state.enemies.find(enemy => codeOf(enemy) === '08680')
  assert.equal(phantasm().location, 'standing')
  assert.equal(damageTower(state, { towerId: 'standing', amount: 1 }), false)
  assert.equal(towerState(state, 'standing').damage, 0)
  phantasm().exhausted = true
  assert.equal(damageTower(state, { towerId: 'standing', amount: 1 }).damage, 1)

  phantasm().location = 'origin'
  resolveEnemyPhase(state)
  assert.equal(phantasm().location, 'origin', '横置时不移动')
  phantasm().exhausted = false
  state.investigators[0].location = 'near'
  resolveEnemyPhase(state)
  assert.equal(phantasm().location, 'bridge')
  resolveEnemyPhase(state)
  assert.equal(phantasm().location, 'standing')
  resolveEnemyPhase(state)
  assert.equal(phantasm().location, 'standing', '已在未坍塌高塔时停留')

  state.enemies = []
  damageTower(state, { towerId: 'standing', amount: 2 })
  damageTower(state, { towerId: 'remote', amount: 2 })
  drawHeartCard(state, '08680')
  assert.equal(phantasm().location, 'near', '没有可用高塔时生成于抽牌者地点')
})

test('08681 最终幻景：毁灭替换为最靠近出口起点的调查员地点生成；无名疯狂获得猎手', () => {
  const state = heartState(p2, 2, {
    titanicRamp1: ['titanicRamp2'], titanicRamp2: ['titanicRamp1', 'titanicRamp3'], titanicRamp3: ['titanicRamp2'],
  })
  state.actIndex = 1
  state.agendas = [{ ...state.acts[1], type: 'agenda' }]
  state.scenarioZones.setAside = ['08679']
  state.investigators[1].location = 'titanicRamp3'
  resolveHeartStep(state, 'finalMirageDoom', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).addDoom(1))
  const nameless = () => state.enemies.find(enemy => codeOf(enemy) === '08679')
  assert.equal(state.doom, 0)
  assert.equal(nameless().location, 'titanicRamp1')
  assert.equal(state.scenarioZones.setAside.includes('08679'), false)
  state.investigators[0].location = 'titanicRamp3'
  resolveEnemyPhase(state)
  assert.equal(nameless().location, 'titanicRamp2')
})

for (const [code, difficulty] of [['08682', 4], ['08683', 3], ['08684', 2], ['08685', 1]]) {
  test(`${code} 泰坦坡道：敏捷 ${difficulty} 失败取消移动；相邻调查员花 1 线索可使其自动成功`, () => {
    const state = heartState(p2, 2, { ramp: ['next'], next: ['ramp'] })
    state.locations[0].originalCode = code
    state.investigators[1].location = 'next'
    state.investigators[1].clues = 1
    state.chaosBag = ['autofail']
    const attempt = { action: 'move', locationId: 'next' }
    move(state, attempt)
    let offered = false
    settle(state, choice => {
      if (choice.kind !== 'payment') return null
      assert.equal(choice.seat, 1)
      offered = true
      return 'skip'
    })
    assert.equal(offered, true)
    assert.equal(state.lastTestResult.success, false)
    assert.equal(state.lastTestResult.difficulty, difficulty)
    assert.equal(state.investigators[0].location, 'ramp')
    assert.equal(state.investigators[1].clues, 1)

    move(state, attempt)
    settle(state, choice => choice.kind === 'payment' ? 'pay' : null)
    assert.equal(state.lastTestResult.success, true)
    assert.equal(state.investigators[0].location, 'next')
    assert.equal(state.investigators[1].clues, 0)
  })
}

const attached = (state, id, code) => state.locations.find(site => site.id === id)?.attachments?.some(card => codeOf(card) === code) === true
const current = state => state.investigators[state.currentSeat]

function finishHeartRound(state, choose = () => null) {
  state.encounterDeck = Array(4).fill('rottingRemains')
  state.chaosBag = ['+8']
  const thisRound = state.round
  for (let count = 0; state.round === thisRound && state.phase === 'investigation' && state.status === 'playing'; count++) {
    assert.ok(count < state.numInvestigators, '每名调查员只需结束一次回合')
    move(state, { action: 'endTurn' })
    settle(state, choice => choose(choice) ?? (choice.kind === 'turnOrder' ? choice.options[0].id : null))
  }
}

test('08691 同源迷雾：替换忒咳哩洗入为真实显现和放牌库底；仅触发过的附属在轮末弃置', () => {
  const state = heartState(p1, 1, { origin: ['neighbor'], neighbor: ['origin'] })
  drawHeartCard(state, '08691')
  drawHeartCard(state, '08691')
  assert.equal(attached(state, 'origin', '08691'), true)
  assert.equal(attached(state, 'neighbor', '08691'), true, '最近地点已有同名附属时改选相邻地点')
  initializeTekeliDeck(state, { cards: ['08723'], copies: [1] })
  resolveHeartStep(state, 'heartShuffleTekeli', (draft, seat, command, events) =>
    scenarioRuntime(draft, events).mechanics.tekeli.shuffleIn(seat, 1))
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[0].deck[0], '08723')
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 0)
  finishHeartRound(state)
  assert.equal(attached(state, 'origin', '08691'), false)
  assert.equal(attached(state, 'neighbor', '08691'), true)
  assert.ok(state.encounterDiscard.includes('08691'))
})

test('08692 南极寒风：只封锁附属地点的打牌和牌库抽牌，轮末弃置并解除', () => {
  const state = heartState(p1, 1, { origin: ['neighbor'], neighbor: ['origin'] })
  current(state).hand = ['01088']
  drawHeartCard(state, '08692')
  assert.equal(attached(state, 'origin', '08692'), true)
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01088'), false)
  assert.equal(legalMoves(state).some(move => move.action === 'draw'), false)
  move(state, { action: 'move', locationId: 'neighbor' })
  settle(state)
  assert.ok(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01088'))
  assert.ok(legalMoves(state).some(move => move.action === 'draw'))
  finishHeartRound(state)
  assert.equal(attached(state, 'origin', '08692'), false)
  assert.ok(state.encounterDiscard.includes('08692'))
})

test('08693 雪盲危机：附属地点四项技能各减 1，轮末弃置后恢复', () => {
  const state = heartState(p1, 2, { origin: ['neighbor'], neighbor: ['origin'] })
  const skills = ['willpower', 'intellect', 'combat', 'agility']
  const read = seat => skills.map(skill => getStat(state, state.investigators[seat], skill))
  state.investigators[1].location = 'neighbor'
  const local = read(0)
  const remote = read(1)
  drawHeartCard(state, '08693')
  assert.deepEqual(read(0), local.map(value => value - 1))
  assert.deepEqual(read(1), remote)
  finishHeartRound(state)
  assert.equal(attached(state, 'origin', '08693'), false)
  assert.ok(state.encounterDiscard.includes('08693'))
  assert.deepEqual(read(0), local)
})

test('08694 极地旋涡：调查员回合末直接伤害自己与每张有生命值的支援，轮末弃置', () => {
  const state = heartState(p1, 2, { origin: ['neighbor'], neighbor: ['origin'] })
  const ally = asset(state, '01018')
  const gun = asset(state, '01016')
  const remoteAlly = asset(state, '01018', {}, 1)
  state.investigators[1].location = 'neighbor'
  drawHeartCard(state, '08694')
  assert.equal(attached(state, 'origin', '08694'), true)
  move(state, { action: 'endTurn' })
  settle(state, choice => choice.kind === 'turnOrder' ? '1' : null)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === ally.id)?.damage, 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id)?.damage, undefined)
  assert.equal(state.investigators[1].assets.find(item => item.id === remoteAlly.id)?.damage, undefined)
  assert.equal(attached(state, 'origin', '08694'), true)
  finishHeartRound(state)
  assert.equal(attached(state, 'origin', '08694'), false)
  assert.ok(state.encounterDiscard.includes('08694'))
})

test('08697 古老者崛起：从弃牌堆顶找古老者，只有与你交战的古老者获得当轮战斗与躲避加值', () => {
  const state = heartState(p1, 1, { origin: ['neighbor'], neighbor: ['origin'] })
  const outside = enemy(state, { code: '08695', originalCode: '08695', location: 'neighbor', engagedSeat: null })
  state.encounterDiscard = ['08695', '08696', 'rottingRemains']
  drawHeartCard(state, '08697')
  const spawned = () => state.enemies.find(enemy => codeOf(enemy) === '08696')
  const remote = () => state.enemies.find(enemy => enemy.id === outside.id)
  assert.ok(spawned())
  assert.equal(spawned().engagedSeat, 0)
  assert.ok(state.encounterDiscard.includes('08695'))
  assert.equal(state.encounterDiscard.includes('08696'), false)
  assert.ok(state.encounterDiscard.includes('08697'))
  assert.equal(enemyFightValue(state, spawned(), current(state)), spawned().fight + 1)
  assert.equal(enemyEvadeValue(state, spawned(), current(state)), spawned().evade + 1)
  assert.equal(enemyFightValue(state, remote(), current(state)), remote().fight)
  spawned().exhausted = true
  finishHeartRound(state)
  assert.equal(enemyFightValue(state, spawned(), current(state)), spawned().fight)
  assert.equal(enemyEvadeValue(state, spawned(), current(state)), spawned().evade)

  const none = heartState(p1, 1, { origin: [] })
  none.encounterDeck = ['dissonantVoices']
  drawHeartCard(none, '08697')
  assert.equal(none.encounterDeck.length, 0, '没有生成敌人时涌动')
  assert.equal(none.enemies.length, 0)
})

test('08670 静电放电：全场含封印的地点受影响，调查员持有的激活封印也造成伤害', () => {
  const state = heartState(p1, 4, {
    origin: ['dormant'], dormant: ['origin', 'active'], active: ['dormant'],
  })
  state.investigators[1].location = 'dormant'
  state.investigators[2].location = 'active'
  state.investigators[3].location = 'active'
  const [dormant, active] = state.campaign.eote.seals.entries
  dormant.locationId = 'dormant'
  Object.assign(active, { placedBySeat: 2, active: true })
  state.encounterDeck = ['dissonantVoices']
  const order = ['3', '1']
  drawHeartCard(state, '08670', choice => {
    if (choice.source !== '08670' || choice.kind !== 'investigator') return null
    assert.equal(choice.seat, 0)
    return order.shift()
  })
  assert.deepEqual(order, [])
  assert.deepEqual(state.investigators.map(inv => [inv.damage, inv.horror]), [[0, 0], [0, 1], [1, 1], [1, 1]])
  assert.ok(state.encounterDiscard.includes('08670'))
  assert.equal(state.encounterDeck.length, 0, '涌动额外抽一张')
})
