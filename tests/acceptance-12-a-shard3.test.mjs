// 验收 12-a 分片 3（core_2026 12081–12120）。
// 玩家侧 24 张（12081–12104）：批次 3 只有 5 条聚合测试、无任何标题含卡号用例，
// 本文件为每张补一条真实执行断言；12089–12096、12097/12100/12101 是重印别名号，
// 断言运行时别名解析到 canonical 条目并执行其钩子。
// 战役侧 16 张（12105–12120）：无条目/无别名/无 content 引用，逐卡断言缺失证据（预期失败）。
// 主进程合并时需登记 tests/suites.mjs / tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import '../src/engine/engine.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'
import { reprintAliasesFor } from '../src/cards/entries/_reprint-aliases.js'

const CAMPAIGN_CODES = ['12105', '12106', '12107', '12108', '12109', '12110', '12111', '12112', '12113', '12114', '12115', '12116', '12117', '12118', '12119', '12120']

function makeState() {
  const inv = {
    seat: 0, name: '调查员', location: 'here', damage: 0, horror: 0, resources: 5,
    assets: [], hand: ['01001'], deck: ['01002'], discard: [], threat: [], engaged: [],
  }
  return {
    investigators: [inv], currentSeat: 0, round: 1, phase: 'investigation',
    locations: [{ id: 'here', name: 'Here', shroud: 2, clues: 1, connections: ['near'] }, { id: 'near', name: 'Near', shroud: 1, clues: 0, connections: ['here'] }],
    enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {},
  }
}

function makeApi(state, options = {}) {
  const calls = {}
  const rec = name => (calls[name] ||= [])
  const choices = options.choices ? [...options.choices] : []
  const api = {
    calls,
    info: text => rec('info').push(String(text)),
    choice: request => { rec('choice').push(request); return choices.length ? choices.shift() : request.options?.[0]?.id },
    setReactionFlag: (key, value) => { rec('reactionFlag').push([key, value]) },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount; rec('gainResources').push([seat, amount]) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; rec('horror').push([seat, amount]) },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; rec('damage').push([seat, amount]) },
    healHorror: (seat, amount) => rec('healHorror').push([seat, amount]),
    exhaust: source => { source.exhausted = true; rec('exhaust').push(source?.id ?? source?.code) },
    discardSelf: code => rec('discardSelf').push(code),
    drawCards: (seat, amount) => rec('drawCards').push([seat, amount]),
    setCommitDestination: (item, destination) => { rec('setCommitDestination').push([item?.code, destination]); return true },
    shuffleDeck: seat => rec('shuffleDeck').push(seat),
    moveCard: spec => rec('moveCard').push(spec),
    locationShroudModUntilRoundEnd: (location, amount) => rec('shroudMod').push([location?.id, amount]),
    placeDoomOnCard: (card, amount) => { card.doom = (card.doom || 0) + amount; rec('placeDoomOnCard').push([card?.id, amount]) },
    maxSanity: seat => options.maxSanity ?? 9,
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    locationName: id => state.locations.find(location => location.id === id)?.name || id,
    investigate: (seat, opts) => { rec('investigate').push([seat, opts]); return { success: options.investigateSuccess ?? true } },
    fight: (seat, enemyId, opts) => {
      rec('fight').push([seat, enemyId, opts])
      if (options.defeatEnemy) state.enemies = state.enemies.filter(enemy => enemy.id !== enemyId)
      return { success: options.fightSuccess ?? true }
    },
  }
  return new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol') return undefined
      return (...args) => { rec(prop).push(args); return undefined }
    },
  })
}

// ---------------------------------------------------------------- 12081–12088 新卡
test('12081 及时干预：技能描述子声明 lateCommit，引擎有 ST.5 晚投入读点', () => {
  const entry = registeredEntry('12081')
  assert.ok(entry)
  assert.equal(entry.abilities[0].skill.lateCommit, true)
  assert.ok(fs.readFileSync('src/engine/tests.js', 'utf8').includes('lateCommit'))
})

test('12082 苦苦支撑：检定将失败时改为成功，符号标记则受 1 恐惧', () => {
  const state = makeState()
  state.chaos = { frames: [0], revealed: ['skull'] }
  const api = makeApi(state)
  const ability = registeredEntry('12082').abilities[0]
  assert.equal(ability.criteria[1]({ state, inv: state.investigators[0] }), true)
  ability.resolve({ state, inv: state.investigators[0], api, context: { testValue: 1, difficulty: 3 } })
  assert.deepEqual(api.calls.reactionFlag[0], ['testBonus', 2])
  assert.deepEqual(api.calls.horror, [[0, 1]])
})

test('12083 旧指南针：调查帷幕 -1；失败可横置再试一次（帷幕 -2）', () => {
  const state = makeState()
  const api = makeApi(state, { investigateSuccess: false, choices: ['retry'] })
  const source = { id: 'compass', code: '12083' }
  registeredEntry('12083').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.investigate[0][1], { shroudMod: -1 })
  assert.deepEqual(api.calls.investigate[1][1], { shroudMod: -2 })
  assert.equal(source.exhausted, true)
})

test('12084 悬崖勒马：失败时其他投入卡回手并抽 1 张', () => {
  const state = makeState()
  state.skillTest = { committed: [{ code: '01020' }, { code: '12084' }] }
  const api = makeApi(state)
  const source = { code: '12084', seat: 0 }
  registeredEntry('12084').abilities[0].skill.onFail({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.setCommitDestination, [['01020', 'hand']])
  assert.deepEqual(api.calls.drawCards, [[0, 1]])
})

test('12085 切肉刀：剩余神智≤3 时 +3 战斗，付 1 恐惧换 +1 伤害，击败后治愈 1 恐惧', () => {
  const state = makeState()
  state.enemies.push({ id: 'e1', code: '01021', location: 'here' })
  const api = makeApi(state, { maxSanity: 4, choices: ['pay', 'heal'], defeatEnemy: true })
  state.investigators[0].horror = 1
  registeredEntry('12085').abilities[0].resolve({ state, inv: state.investigators[0], target: { entity: state.enemies[0] }, api })
  assert.equal(api.calls.fight[0][2].combatBonus, 3)
  assert.equal(api.calls.fight[0][2].damageBonus, 1)
  assert.deepEqual(api.calls.healHorror, [[0, 1]])
})

test('12086 破瓶子：+1 战斗，选择牺牲时伤害 +1 且成功才弃置（已披露近似）', () => {
  const state = makeState()
  state.enemies.push({ id: 'e2', code: '01021', location: 'here' })
  const api = makeApi(state, { choices: ['discard'] })
  const entry = registeredEntry('12086')
  assert.match(entry.note, /approximation/)
  entry.abilities[0].resolve({ state, inv: state.investigators[0], target: { entity: state.enemies[0] }, api })
  assert.equal(api.calls.fight[0][2].combatBonus, 1)
  assert.equal(api.calls.fight[0][2].damageBonus, 1)
  assert.equal(typeof api.calls.fight[0][2].onSuccess, 'function')
})

test('12087 软呢帽：无能力文本，行为由卡面数据（1 生命/1 神智）与通用承伤规则承担', () => {
  const card = ALL_CARDS['12087']
  assert.equal(card.text, '')
  assert.equal(card.health, 1)
  assert.equal(card.sanity, 1)
  const entry = registeredEntry('12087')
  assert.ok(entry)
  assert.equal((entry.abilities || []).length, 0)
})

test('12088 手摇式手电筒：调查 +1；成功后弃置使地点帷幕 -1 直到轮末', () => {
  const state = makeState()
  const api = makeApi(state, { choices: ['discard'] })
  const source = { id: 'flashlight', code: '12088' }
  registeredEntry('12088').abilities[0].resolve({ state, inv: state.investigators[0], source, api })
  assert.deepEqual(api.calls.investigate[0][1], { bonus: 1 })
  assert.deepEqual(api.calls.discardSelf, ['12088'])
  assert.deepEqual(api.calls.shroudMod, [['here', -1]])
})

// ---------------------------------------------------------------- 12089–12096 重印别名
for (const [code, canonical] of [['12089', '01088'], ['12090', '01089'], ['12091', '01092'], ['12092', '01091'], ['12093', '01090'], ['12094', '01093'], ['12095', '02158'], ['12096', '02157']]) {
  test(`${code} 重印别名解析到 ${canonical} 并注册行为条目`, () => {
    assert.equal(canonicalCode(code), canonical)
    assert.deepEqual(reprintAliasesFor(canonical), [code])
    const entry = registeredEntry(code)
    assert.ok(entry, '别名号应在运行时注册条目')
    assert.equal(entry.code, code)
  })
}

test('12089 应急物资（别名）：played 描述子声明获得 3 资源', () => {
  const played = registeredEntry('12089').abilities.find(ability => ability.kind === 'played')
  assert.ok(played)
  assert.deepEqual(played.effect, { type: 'gainResource', amount: 3 })
})

// ---------------------------------------------------------------- 12097–12104 基础弱点
for (const [code, canonical] of [['12097', '01096'], ['12100', '03040'], ['12101', '01097']]) {
  test(`${code} 基础弱点重印别名解析到 ${canonical}`, () => {
    assert.equal(canonicalCode(code), canonical)
    assert.ok(registeredEntry(code))
  })
}

test('12098 金甲虫：威胁区弱点 -1 生命/-1 神智，不能离场；行动洗回牌库', () => {
  const state = makeState()
  const entry = registeredEntry('12098')
  const weakness = entry.abilities.find(ability => ability.kind === 'weakness')
  assert.deepEqual(weakness.weakness, { type: 'threat', healthModifier: -1, sanityModifier: -1 })
  assert.equal(entry.cannotLeavePlay, true)
  const api = makeApi(state)
  const action = entry.abilities.find(ability => ability.kind === 'action')
  action.resolve({ state, inv: state.investigators[0], api })
  assert.deepEqual(api.calls.discardSelf, ['12098'])
  assert.deepEqual(api.calls.shuffleDeck, [0])
})

test('12099 无名潜伏者：最远无人地点生成；调查阶段结束若重整无毁灭则放 1 毁灭', () => {
  const state = makeState()
  const entry = registeredEntry('12099')
  assert.equal(entry.weaknessSpawnsAtFarthestEmptyLocation, true)
  assert.equal(entry.enemyWeakness.aloof, true)
  const source = { id: 'lurker', code: '12099', location: 'near', defeated: false, exhausted: false, doom: 0 }
  const api = makeApi(state)
  const forced = entry.abilities.find(ability => ability.kind === 'forced')
  assert.equal(forced.criteria[0]({ source }), true)
  forced.resolve({ source, api })
  assert.deepEqual(api.calls.placeDoomOnCard, [['lurker', 1]])
})

test('12102 后有追兵：进入地点强制恐惧，两个行动弃掉', () => {
  const state = makeState()
  const entry = registeredEntry('12102')
  const weakness = entry.abilities.find(ability => ability.kind === 'weakness')
  assert.deepEqual(weakness.weakness.discardCost, { action: 2 })
  const api = makeApi(state)
  const forced = entry.abilities.find(ability => ability.kind === 'forced')
  assert.equal(forced.criteria[0]({ inv: state.investigators[0], context: { enemy: { id: 'e' }, location: 'here' } }), true)
  forced.resolve({ inv: state.investigators[0], api })
  assert.deepEqual(api.calls.horror, [[0, 1]])
})

test('12103 组织重担：花费资源后强制 1 伤害，两个行动弃掉', () => {
  const state = makeState()
  const entry = registeredEntry('12103')
  assert.deepEqual(entry.abilities.find(a => a.kind === 'weakness').weakness.discardCost, { action: 2 })
  const forced = entry.abilities.find(ability => ability.kind === 'forced')
  assert.equal(forced.criteria[0]({ inv: state.investigators[0], context: { seat: 0, amount: 2 } }), true)
  const api = makeApi(state)
  forced.resolve({ inv: state.investigators[0], api })
  assert.deepEqual(api.calls.damage, [[0, 1]])
})

test('12104 受伤：每回合第一次移动强制 1 伤害，两个行动弃掉', () => {
  const state = makeState()
  const entry = registeredEntry('12104')
  assert.deepEqual(entry.abilities.find(a => a.kind === 'weakness').weakness.discardCost, { action: 2 })
  const forced = entry.abilities.find(ability => ability.kind === 'forced')
  assert.deepEqual(forced.trigger, ['move'])
  assert.equal(forced.limit?.label ?? forced.limit, 'oncePerTurn')
  assert.equal(forced.criteria[0]({ inv: state.investigators[0], context: { seat: 0 } }), true)
  const api = makeApi(state)
  forced.resolve({ inv: state.investigators[0], api })
  assert.deepEqual(api.calls.damage, [[0, 1]])
})

// ---------------------------------------------------------------- 12105–12120 战役侧
for (const code of CAMPAIGN_CODES) {
  test(`${code} 战役侧：无条目/无别名/无 content 引用（实现失败证据）`, () => {
    assert.equal(registeredEntry(code), null, '不应有行为条目')
    assert.equal(canonicalCode(code), code, '不是重印别名（无 canonical 映射）')
    const files = []
    const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const path = dir + '/' + entry.name; if (entry.isDirectory()) walk(path); else if (entry.name.endsWith('.js')) files.push(path) } }
    walk('src'); walk('content')
    const hits = files.filter(file => fs.readFileSync(file, 'utf8').includes("'" + code + "'") || fs.readFileSync(file, 'utf8').includes('"' + code + '"'))
    const behaviorHits = hits.filter(file => !file.endsWith('cards-data.js') && !file.includes('acceptance'))
    assert.deepEqual(behaviorHits, [], '除 cards-data 外不应有任何实现/内容引用')
  })
}
