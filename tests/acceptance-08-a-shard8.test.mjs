// 08-a 分片 8（《地球边缘》eoec 08653–08697）新增验收证据。
//
// 目标：为 45 张卡各提供一条「真实执行且标题含卡号」的用例。通过卡断言卡面条款的本地读点/
// 结算路径真实执行；失败卡用可执行断言锁定缺口（实现缺失或读点缺失），供报告逐卡引用。
//
// 运行：node --test tests/acceptance-08-a-shard8.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { enemyCannotBeDamaged } from '../src/engine/enemy-restrictions.js'
import { entryFlags, locationRuleFor, actRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { chapterStory } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import * as p1 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import { scenarioApproximations as p1Approximations } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/behavior.js'
import * as p2 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { scenarioApproximations as p2Approximations } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/behavior.js'
import { initializeSeals, placeDormantSeal } from '../src/campaign/eote-seals.js'
import { initializeFacilities, damageTower } from '../src/engine/eote-facilities.js'

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

// ===== 失败卡（24） ======================================================================

test('08660 瘴气的召唤：背面 D/E 效果与印刷不符（D 应变失行动、E 应失资源）', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = ['A', 'B', 'C', 'D', 'E'].map(kind => seal(kind, { placedBySeat: 0, active: true }))
  const api = makeApi({ damage: () => true, discardRandom: () => true, horror: () => true,
    gainClues: () => true, gainResources: () => true, info: () => true })
  entries['08660'].agendaRule.onLeave(state, {}, api)
  // 印刷：seal_d 控制者「失去 1 行动（激活则 2）」、seal_e「失去 3 资源（激活则 6）」。
  assert.equal(called(api, 'gainClues'), true, '当前实现给 D 控制者 +1 线索（与印刷不符）')
  assert.equal(called(api, 'gainResources'), true, '当前实现给 E 控制者 +2 资源（与印刷不符）')
  assert.equal(called(api, 'loseAction'), false)
  assert.equal(called(api, 'loseResources'), false)
})

test('08661 疯狂的召唤：被击败后「精神创伤 或 洗入忒咳哩-哩」的选择缺失', () => {
  const state = baseState()
  const api = makeApi({ addTrauma: () => true, defeatInvestigator: () => true, info: () => true })
  entries['08661'].agendaRule.onLeave(state, {}, api)
  assert.equal(called(api, 'addTrauma'), true)
  assert.equal(called(api, 'choice'), false, '没有询问玩家选择创伤或洗牌')
  assert.equal(api.calls.some(call => call.key.includes('tekeli')), false, '忒咳哩-哩选项未实现')
})

test('08662 蛰伏：背面按刚放上的封印种类结算的治疗/抽牌/额外行动/资源未实现', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = [seal('A', { active: true, locationId: 'A' })]
  const api = makeApi({ info: () => true })
  entries['08662'].actRule.onLeave(state, {}, api)
  assert.equal(called(api, 'healDamage'), false)
  assert.equal(called(api, 'drawCards'), false)
  assert.equal(called(api, 'gainResources'), false)
  assert.equal(called(api, 'info'), true, '当前只写一条日志')
})

test('08669 原生质团：Prey「最近持封印调查员」与 Spawn「外环最远地点」没有读点', () => {
  assert.equal(entryFlags('08669').prey, 'nearestSealHolder')
  assert.equal(entryFlags('08669').spawnFarthestOuterRing, true)
  assert.equal(p1.scenario.enemies['08669'].prey, undefined, 'definition 没有猎物数据（引擎 preyTarget 无键）')
  assert.equal(p1.scenario.enemies['08669'].spawnFarthestFromAll, undefined, 'definition 没有外环最远生成读点')
  assert.ok(p1Approximations.some(text => text.includes('原质团')), '再次结算敌人阶段被披露为近似')
})

test('08671 封印减弱：背面只生成无名的疯狂，缺「真相未明 → 搜牌库逐张抽忒咳哩-哩」', () => {
  const state = baseState()
  state.scenario = json(p2.scenario)
  state.locations = [{ id: 'facility7', name: '高塔', originalCode: '08674', connections: [], traits: [] }]
  state.enemies = []
  state.investigators[0].location = 'facility7'
  state.campaign.records.theTruthOfTheMirageEludesYou = true
  const api = makeApi({ spawn: () => ({ id: 'x' }), info: () => true, 'mechanics.tekeli.size': () => 3,
    'mechanics.tekeli.shuffleIn': () => ['05001'] })
  p2.behavior.agendaLeftPlay(state, { code: '08671', originalCode: '08671' }, api)
  assert.ok(called(api, 'spawn'), '背面第一段（生成无名的疯狂）已实现')
  assert.equal(api.calls.some(call => call.key.includes('tekeli')), false, '第二段（逐张抽忒咳哩-哩并洗回）缺失')
})

test('08672 无名存在：目标（回合末 15 份在场且非全塔坍塌）与毁灭替换均未接线', () => {
  const state = baseState()
  state.scenario = json(p2.scenario)
  state.locations = [{ id: 'facility1', name: '高塔', originalCode: '08674', connections: [], traits: [], mistPylon: true }]
  state.enemies = Array.from({ length: 15 }, (_, index) => ({
    id: `n${index}`, code: '08679', originalCode: '08679', location: 'facility1', defeated: false,
  }))
  state.acts = [{ id: 'act08673', code: '08673', originalCode: '08673' }]
  state.agendas = [{ id: 'agenda08672', code: '08672', originalCode: '08672' }]
  state.actIndex = 0
  state.agendaIndex = 0
  const api = makeApi({ finish: () => true, advanceAct: () => true, info: () => true })
  p2.behavior.checkObjectives(state, api)
  assert.equal(called(api, 'finish'), false, '08672 目标未实现（引擎只在 doomThreshold=null 时不推进）')
  assert.equal(called(api, 'advanceAct'), false)
  assert.ok(p2Approximations.some(text => text.includes('毁灭')))
})

test('08673 摧毁高塔：[reaction] 在迷雾高塔发现线索时花线索造成等量伤害未接线', () => {
  assert.equal(entries['08673'].actRule.clueReactionDamage, true)
  const state = baseState()
  state.scenario = json(p2.scenario)
  const api = makeApi({ info: () => true, addDoom: () => true })
  p2.behavior.afterTest(state, state.investigators[0], { success: true, cluesDiscovered: 2 }, api)
  assert.equal(api.calls.some(call => call.key.includes('damageTower')), false, '没有线索→高塔伤害的反应结算')
})

function pylonEnterCostTest(code) {
  return () => {
    assert.equal(locationRuleFor(code).enterCostCluePerInvestigator, 1)
    const slot = Object.values(p2.scenario.locations).find(location => codeOf(location) === code)
    assert.ok(slot, 'definition 有该高塔槽位')
    assert.equal(slot.enterCost, undefined, '地点定义没有入场费用数据（引擎 movement 无读点）')
  }
}
test('08674 迷雾高塔：入场额外费用「团队花 1×人数线索」没有读点（缺口）', pylonEnterCostTest('08674'))
test('08675 迷雾高塔：入场额外费用「团队花 1×人数线索」没有读点（缺口）', pylonEnterCostTest('08675'))
test('08676 迷雾高塔：入场额外费用「团队花 1×人数线索」没有读点（缺口）', pylonEnterCostTest('08676'))
test('08677 迷雾高塔：入场额外费用「团队花 1×人数线索」没有读点（缺口）', pylonEnterCostTest('08677'))
test('08678 迷雾高塔：入场额外费用「团队花 1×人数线索」没有读点（缺口）', pylonEnterCostTest('08678'))

test('08679 无名疯狂：印刷「不能受到伤害」与「成功差值横置最近已重整副本」均未实现', () => {
  assert.equal(enemyCannotBeDamaged({}, { code: '08679', originalCode: '08679' }), false,
    '引擎读 enemyRule.cannotBeDamaged，但条目只声明 flags.cannotTakeDamage')
  const state = baseState({ scenario: json(p2.scenario) })
  state.enemies = [
    { id: 'n1', code: '08679', originalCode: '08679', exhausted: true, defeated: false },
    { id: 'n2', code: '08679', originalCode: '08679', exhausted: false, defeated: false },
  ]
  state.skillTest = { testTarget: { enemy: state.enemies[0] } }
  const api = makeApi({ info: () => true, addDoom: () => true })
  p2.behavior.afterTest(state, state.investigators[0], { success: true, failedBy: 0 }, api)
  assert.equal(state.enemies[0].exhausted, false, '实现方向相反：成功后被重整，而印刷要求横置最近的已重整副本')
})

test('08680 未封幻影：Spawn 最近未坍塌高塔、保护高塔、向最近高塔移动均未接线', () => {
  assert.equal(entryFlags('08680').spawnNearestStandingPylon, true)
  assert.equal(entryFlags('08680').protectsReadyPylon, true)
  assert.equal(p2.scenario.enemies['08680'].spawnFarthestFromAll, undefined)
  assert.equal(p2.scenario.enemies['08680'].spawnMostClues, undefined)
  assert.equal(p2.scenario.enemies['08680'].prey, undefined)
})

test('08681 最终幻景：「无名的疯狂获得猎手」与毁灭替换未接线', () => {
  assert.equal(actRuleFor('08681').namelessGainsHunter, true)
  assert.equal(p2.scenario.enemies['08679'].hunter, undefined, 'definition 未给无名的疯狂猎手')
  assert.equal(entries['08681'].flags.finalMirage, true)
  assert.equal(entries['08672'].flags.finalMirageDoomReplacement, true)
  assert.ok(p2Approximations.some(text => text.includes('毁灭')))
  const state = baseState({ scenario: json(p2.scenario) })
  state.acts = [{ id: 'act08681', code: '08681', originalCode: '08681' }]
  state.actIndex = 0
  const api = makeApi({ finish: () => true, info: () => true })
  p2.behavior.checkObjectives(state, api)
  assert.equal(called(api, 'finish'), false, '调查员不在隐藏隧道时不会结算（目标本身已接线）')
})

function rampLeaveTest(code, difficulty) {
  return () => {
    const rule = locationRuleFor(code)
    assert.equal(rule.leaveTestDifficulty, difficulty)
    assert.equal(rule.spendClueAutoSucceed, true)
    const state = baseState()
    const from = { id: 'R', name: '坡道', originalCode: code, connections: ['T'], traits: [] }
    const leaveTest = p2.behavior.locationLeaveTest(state, state.investigators[0], from, 'T', makeApi())
    assert.deepEqual(leaveTest, { skill: 'agility', difficulty, spendClueAutoSucceed: true })
    assert.equal(p2.behavior.locationLeaveFailed, undefined,
      '引擎 leaveTest 分支失败时只调用 locationLeaveFailed；没有该钩子 → 移动不取消，花线索自动成功无读点')
  }
}
test('08682 泰坦坡道：离开检定 4 已接线，但「失败取消移动 / 花 1 线索自动成功」缺失', rampLeaveTest('08682', 4))
test('08683 泰坦坡道：离开检定 3 已接线，但「失败取消移动 / 花 1 线索自动成功」缺失', rampLeaveTest('08683', 3))
test('08684 泰坦坡道：离开检定 2 已接线，但「失败取消移动 / 花 1 线索自动成功」缺失', rampLeaveTest('08684', 2))
test('08685 泰坦坡道：离开检定 1 已接线，但「失败取消移动 / 花 1 线索自动成功」缺失', rampLeaveTest('08685', 1))

function attachedGapTest(code, label) {
  return () => {
    const state = baseState()
    state.locations = [{ id: 'A', name: '甲', originalCode: '08653', connections: [], traits: [], attachments: [] }]
    const api = makeApi({ attachToLocation: (id, fields) => { state.locations[0].attachments.push(fields) }, info: () => true, choice: () => 'A' })
    entries[code].encounterResolve(state, state.investigators[0], { code }, api)
    assert.equal(state.locations[0].attachments.length, 1, '显现附属已接线')
    assert.match(String(entries[code].note), /primitive-requests/,
      `${label}：持续/轮末强制条款仍缺引擎读点（未实现）`)
  }
}
test('08691 同源迷雾：附属缺「洗入改为抽到牌库底 + 轮末弃掉」（读点缺失，条目自述未实现）', attachedGapTest('08691', '同源迷雾'))
test('08692 南极寒风：附属缺「不能打牌/抽牌 + 轮末弃掉」（读点缺失，条目自述未实现）', attachedGapTest('08692', '南极寒风'))
test('08693 雪盲危机：附属缺「四项技能 -1 + 轮末弃掉」（读点缺失，条目自述未实现）', attachedGapTest('08693', '雪盲危机'))
test('08694 极地旋涡：附属缺「回合末控制卡各 1 直接伤害 + 轮末弃掉」（读点缺失，条目自述未实现）', attachedGapTest('08694', '极地旋涡'))

test('08697 古老者崛起：生成交战已接线，但「交战中的古老者 +1 攻击/+1 躲避直到轮末」缺失', () => {
  const state = baseState()
  state.encounterDiscard = ['08695']
  const api = makeApi({ takeEncounterDiscard: () => '08695', spawn: () => ({ id: 'e1', code: '08695' }),
    engageAtInvestigator: () => true, info: () => true })
  const result = entries['08697'].encounterResolve(state, state.investigators[0], { code: '08697' }, api)
  assert.notEqual(result, undefined)
  assert.ok(called(api, 'spawn'))
  assert.ok(called(api, 'engageAtInvestigator'))
  assert.match(String(entries['08697'].note), /primitive-requests/,
    '临时攻击/躲避修正仍缺引擎读点（未实现）')
})

// ===== 待定（1） ========================================================================
test('08670 静电释放：按「与封印同地点」判定，但只统计地点上的封印（调查员持有的封印未计入，待裁决）', () => {
  const state = baseState()
  state.campaign.eote.seals.entries = [seal('A', { active: true, placedBySeat: 0, locationId: null })]
  const api = makeApi({ horror: () => true, damage: () => true, info: () => true })
  p1.behavior.resolveEncounter(state, state.investigators[0], { code: '08670', originalCode: '08670' }, api)
  assert.equal(argsOf(api, 'horror').length, 1, '基础 1 恐惧已实现')
  assert.equal(argsOf(api, 'damage').length, 0,
    '调查员持有的激活封印是否算「同地点的封印」口径未定：当前只算地点附属封印（待裁决）')
})
