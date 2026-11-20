// TDC P7 共享遭遇（shared-encounters worker：13 组 32 张）单卡条目回归。
//
// 验收口径（CONTRACT §2/§7）：
//   · 32 个单卡文件可 import 并通过 registerCardAbilities（注册期校验 code/scope/flags）；
//   · code 唯一、作用域合法、每组卡号集合与 artifacts/migration/tdc/p7/shared/inventory.json 一致；
//   · 关键行为用「最小 state + api spy」夹具直接调用条目函数验证：
//     显现分支、失败分支、威胁区放入、放毁灭/弃卡/移动/攻击/生成等写点是否走 api。
//
// 注：tasks（11753a–11760b）与 tdc_expedition（11761–11766）由 Lead 的并行 helper 负责，
// 不在本文件覆盖范围（与 LEAD 指示一致）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

import stowaways11721 from '../src/cards/encounter-entries/theDrownedCity/_shared/stowaways/11721.js'
import stowaways11722 from '../src/cards/encounter-entries/theDrownedCity/_shared/stowaways/11722.js'
import pilgrims11723 from '../src/cards/encounter-entries/theDrownedCity/_shared/pilgrims/11723.js'
import pilgrims11724 from '../src/cards/encounter-entries/theDrownedCity/_shared/pilgrims/11724.js'
import starSpawn11725 from '../src/cards/encounter-entries/theDrownedCity/_shared/star_spawn/11725.js'
import starSpawn11726 from '../src/cards/encounter-entries/theDrownedCity/_shared/star_spawn/11726.js'
import starSpawn11727 from '../src/cards/encounter-entries/theDrownedCity/_shared/star_spawn/11727.js'
import starSpawn11728 from '../src/cards/encounter-entries/theDrownedCity/_shared/star_spawn/11728.js'
import cosmicLegacy11729 from '../src/cards/encounter-entries/theDrownedCity/_shared/cosmic_legacy/11729.js'
import cosmicLegacy11730 from '../src/cards/encounter-entries/theDrownedCity/_shared/cosmic_legacy/11730.js'
import elderMist11731 from '../src/cards/encounter-entries/theDrownedCity/_shared/elder_mist/11731.js'
import elderMist11732 from '../src/cards/encounter-entries/theDrownedCity/_shared/elder_mist/11732.js'
import undersea11733 from '../src/cards/encounter-entries/theDrownedCity/_shared/undersea_creatures/11733.js'
import undersea11734 from '../src/cards/encounter-entries/theDrownedCity/_shared/undersea_creatures/11734.js'
import undersea11735 from '../src/cards/encounter-entries/theDrownedCity/_shared/undersea_creatures/11735.js'
import flood11736 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_flood/11736.js'
import flood11737 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_flood/11737.js'
import flood11738 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_flood/11738.js'
import rlyeh11739 from '../src/cards/encounter-entries/theDrownedCity/_shared/rlyeh/11739.js'
import rlyeh11740 from '../src/cards/encounter-entries/theDrownedCity/_shared/rlyeh/11740.js'
import domination11741 from '../src/cards/encounter-entries/theDrownedCity/_shared/domination/11741.js'
import domination11742 from '../src/cards/encounter-entries/theDrownedCity/_shared/domination/11742.js'
import domination11743 from '../src/cards/encounter-entries/theDrownedCity/_shared/domination/11743.js'
import inescapable11744 from '../src/cards/encounter-entries/theDrownedCity/_shared/the_inescapable/11744.js'
import inescapable11745 from '../src/cards/encounter-entries/theDrownedCity/_shared/the_inescapable/11745.js'
import deepOnes11746 from '../src/cards/encounter-entries/theDrownedCity/_shared/deep_ones/11746.js'
import deepOnes11747 from '../src/cards/encounter-entries/theDrownedCity/_shared/deep_ones/11747.js'
import deepOnes11748 from '../src/cards/encounter-entries/theDrownedCity/_shared/deep_ones/11748.js'
import dreams11749 from '../src/cards/encounter-entries/theDrownedCity/_shared/dreams/11749.js'
import dreams11750 from '../src/cards/encounter-entries/theDrownedCity/_shared/dreams/11750.js'
import alienMachinery11751 from '../src/cards/encounter-entries/theDrownedCity/_shared/alien_machinery/11751.js'
import alienMachinery11752 from '../src/cards/encounter-entries/theDrownedCity/_shared/alien_machinery/11752.js'

const ENTRIES = [
  stowaways11721, stowaways11722,
  pilgrims11723, pilgrims11724,
  starSpawn11725, starSpawn11726, starSpawn11727, starSpawn11728,
  cosmicLegacy11729, cosmicLegacy11730,
  elderMist11731, elderMist11732,
  undersea11733, undersea11734, undersea11735,
  flood11736, flood11737, flood11738,
  rlyeh11739, rlyeh11740,
  domination11741, domination11742, domination11743,
  inescapable11744, inescapable11745,
  deepOnes11746, deepOnes11747, deepOnes11748,
  dreams11749, dreams11750,
  alienMachinery11751, alienMachinery11752,
]
registerCardAbilities(ENTRIES)

// 组 → 卡号（与 artifacts/migration/tdc/p7/shared/inventory.json 的 13 个 worker 组一致）。
const GROUPS = {
  stowaways: ['11721', '11722'],
  pilgrims: ['11723', '11724'],
  star_spawn: ['11725', '11726', '11727', '11728'],
  cosmic_legacy: ['11729', '11730'],
  elder_mist: ['11731', '11732'],
  undersea_creatures: ['11733', '11734', '11735'],
  tdc_flood: ['11736', '11737', '11738'],
  rlyeh: ['11739', '11740'],
  domination: ['11741', '11742', '11743'],
  the_inescapable: ['11744', '11745'],
  deep_ones: ['11746', '11747', '11748'],
  dreams: ['11749', '11750'],
  alien_machinery: ['11751', '11752'],
}
const VALID_SCOPES = new Set(['enemy', 'location', 'act', 'agenda', 'storyAsset', 'treachery', 'scenario'])
const ENEMY_CODES = new Set(['11721', '11723', '11724', '11725', '11726', '11727', '11728', '11733',
  '11744', '11746', '11747', '11751'])

// ---------------------------------------------------------------------------
// 夹具：最小 state + 记录调用的 api。
// ---------------------------------------------------------------------------
function makeState(overrides = {}) {
  const base = {
    round: 1,
    phase: 'mythos',
    currentSeat: 0,
    investigators: [
      { seat: 0, id: 'inv0', name: '测试员甲', location: 'locA', hand: ['01088'], assets: [], threat: [], resources: 5, defeated: false, resigned: false },
      { seat: 1, id: 'inv1', name: '测试员乙', location: 'locA', hand: ['01088'], assets: [], threat: [], resources: 5, defeated: false, resigned: false },
    ],
    locations: [
      { id: 'locA', name: '地点A', shroud: 2, connections: ['locB'], clues: 1, revealed: true },
      { id: 'locB', name: '地点B', shroud: 3, connections: ['locA', 'locC'], clues: 0, revealed: true },
      { id: 'locC', name: '地点C', shroud: 1, connections: ['locB'], clues: 0, revealed: false },
    ],
    enemies: [],
    encounterDeck: [],
    encounterDiscard: [],
    victoryDisplay: [],
    removedFromGame: [],
    setAsideEnemies: [],
    scenarioFlags: {},
    scenarioZones: { setAside: [] },
    numInvestigators: 2,
  }
  return { ...base, ...overrides }
}

function makeApi(options = {}) {
  const calls = []
  const answers = [...(options.answers || [])]
  const record = (name, args, value) => { calls.push({ name, args }); return value }
  const waterDef = { level: () => 0, nearestTargets: () => [], change: () => 0, ...(options.water || {}) }
  const water = {}
  for (const [key, fn] of Object.entries(waterDef)) {
    water[key] = (...args) => record(`water.${key}`, args, fn(...args))
  }
  const mapDef = { nearest: () => [], ...(options.map || {}) }
  const map = {}
  for (const [key, fn] of Object.entries(mapDef)) map[key] = (...args) => record(`map.${key}`, args, fn(...args))
  const mechanics = { water, map }
  const scenarioBase = {
    setEnemyKeywords: (...args) => record('scenario.setEnemyKeywords', args, true),
    readyEnemy: (...args) => record('scenario.readyEnemy', args, true),
    hunterStep: (...args) => record('scenario.hunterStep', args, options.hunterStep ?? null),
    moveEnemy: (...args) => record('scenario.moveEnemy', args, true),
    attack: (...args) => record('scenario.attack', args, true),
    spawn: (...args) => record('scenario.spawn', args, options.spawnEnemy ?? { id: 'spawned' }),
    takeFromVictory: (...args) => record('scenario.takeFromVictory', args, true),
    exhaustEnemy: (...args) => record('scenario.exhaustEnemy', args, true),
    detachLocationAttachment: (...args) => record('scenario.detachLocationAttachment', args, true),
    restoreEnemyFromAside: (...args) => record('scenario.restoreEnemyFromAside', args, true),
    ...(options.scenario || {}),
  }
  const scenario = new Proxy(scenarioBase, {
    get(target, key) {
      if (key in target) return target[key]
      return (...args) => record(`scenario.${String(key)}`, args)
    },
  })
  const base = {
    calls,
    answers,
    mechanics,
    scenario,
    info: (...args) => { calls.push({ name: 'info', args }) },
    cardName: code => `卡片${code}`,
    locName: id => `名称:${id}`,
    choice: spec => {
      calls.push({ name: 'choice', args: [spec] })
      return answers.length ? answers.shift() : spec?.options?.[0]?.id
    },
    test: (seat, skill, difficulty, testOptions) => {
      calls.push({ name: 'test', args: [seat, skill, difficulty], options: testOptions })
    },
  }
  for (const [key, fn] of Object.entries(options.api || {})) {
    if (typeof fn === 'function') base[key] = (...args) => record(key, args, fn(...args))
    else base[key] = fn
  }
  return new Proxy(base, {
    get(target, key) {
      if (key in target) return target[key]
      return (...args) => record(String(key), args)
    },
  })
}

const callsOf = (api, name) => api.calls.filter(call => call.name === name)
const lastCall = (api, name) => callsOf(api, name).at(-1)
const abilityOf = (code, index = 0) => registeredEntry(code)?.abilities?.[index]
const entryOf = code => registeredEntry(code)

/** 按条目声明的方式求值 criteria（用于「不应触发」断言）。 */
function matches(ability, context) {
  const criteria = ability?.criteria
  if (!criteria) return true
  const list = Array.isArray(criteria) ? criteria : [criteria]
  return list.every(item => {
    const fn = typeof item === 'function' ? item : item?.when
    return typeof fn === 'function' ? Boolean(fn(context)) : true
  })
}

/** 直接调用描述子 resolve（用 spy api 验证它走了哪个写点）。 */
function runAbility(code, index, state, context = {}, options = {}) {
  const ability = abilityOf(code, index)
  assert.ok(ability, `${code} 缺少第 ${index} 条能力`)
  const api = options.useApi || makeApi(options)
  const source = options.source || { id: `src-${code}`, code, originalCode: code }
  ability.resolve({ state, inv: state.investigators[0], seat: 0, source, context, events: [], api })
  return { api, source, ability }
}

/** 调用 encounterResolve 并返回 spy api。 */
function runReveal(code, state, options = {}) {
  const api = makeApi(options)
  const inv = state.investigators[options.seat ?? 0]
  entryOf(code).encounterResolve(state, inv, { code, originalCode: code }, api)
  return api
}

/** 取得显现/能力里发起的检定；兼容 (seat,skill,diff,resolve,...) 与 (seat,skill,diff,{resolve})。 */
function capturedTest(api) {
  const call = lastCall(api, 'test')
  assert.ok(call, '没有发起检定')
  const options = call.options
  const resolve = typeof options === 'function' ? options : options?.resolve
  assert.equal(typeof resolve, 'function', '检定为不可结算（缺少 resolve）')
  return { call, resolve: result => resolve(result) }
}

// ---------------------------------------------------------------------------
// 1. 注册与清单
// ---------------------------------------------------------------------------
test('TDC P7 共享遭遇：32 个单卡条目注册成功，code 唯一、scope 合法、每组卡号与清单一致', () => {
  assert.equal(ENTRIES.length, 32)
  const codes = ENTRIES.map(entry => entry.code)
  assert.equal(new Set(codes).size, codes.length, 'code 必须唯一')
  const actualByGroup = {}
  for (const entry of ENTRIES) {
    assert.equal(typeof entry.code, 'string')
    assert.equal(registeredEntry(entry.code)?.code, entry.code, `${entry.code} 未注册`)
    assert.ok(VALID_SCOPES.has(entry.scope), `${entry.code} scope 非法：${entry.scope}`)
    assert.equal(entry.implemented, true, `${entry.code} 应标记 implemented`)
    assert.ok(entry.note, `${entry.code} 必须写 note（逐条读点/近似）`)
    assert.equal(entry.scope, ENEMY_CODES.has(entry.code) ? 'enemy' : 'treachery', `${entry.code} 作用域错误`)
    const group = findGroupOf(entry.code)
    actualByGroup[group] = [...(actualByGroup[group] || []), entry.code]
  }
  for (const [group, expected] of Object.entries(GROUPS)) {
    assert.deepEqual([...(actualByGroup[group] || [])].sort(), [...expected].sort(), `${group} 卡号集合不一致`)
  }
})

function findGroupOf(code) {
  return Object.entries(GROUPS).find(([, codes]) => codes.includes(code))?.[0]
}

// ---------------------------------------------------------------------------
// 2. stowaways
// ---------------------------------------------------------------------------
test('11721 偷渡者工蜂：敌军阶段结束在另一名非精英敌人上放毁灭，然后弃掉自己；巡逻目标为无毁灭敌人', () => {
  const target = { id: 'e1', code: 'ghoulMinion', name: '另一名敌人', location: 'locA', doom: 0, elite: false }
  const enemy = { id: 'drone', code: '11721', originalCode: '11721', location: 'locA', doom: 0, elite: false }
  const state = makeState({ enemies: [enemy, target] })
  const { api } = runAbility('11721', 0, state, { when: 'enemyPhaseEnds' }, { source: enemy })
  assert.equal(entryOf('11721').enemyRule.patrolTarget.kind, 'enemy')
  assert.equal(callsOf(api, 'doomOn').length, 1)
  assert.equal(lastCall(api, 'doomOn').args[0], target)
  assert.equal(callsOf(api, 'discardEnemy').length, 1)
  assert.equal(lastCall(api, 'discardEnemy').args[0], enemy)
  // 没有其他非精英敌人时不满足条件。
  const solo = makeState({ enemies: [enemy] })
  assert.equal(matches(abilityOf('11721', 0), { state: solo, source: enemy, context: {} }), false)
})

test('11722 感染！：显现进威胁区并判重；回合结束在危险地点放毁灭；摆脱行动意志(3)', () => {
  const state = makeState()
  const inv = state.investigators[0]
  const api = makeApi()
  assert.equal(entryOf('11722').encounterResolve(state, inv, {}, api), true)
  assert.deepEqual(lastCall(api, 'threat').args, [0, '11722'])
  inv.threat.push({ id: 'threat-1', code: '11722', originalCode: '11722' })
  assert.equal(entryOf('11722').encounterResolve(state, inv, {}, api), false, '每位调查员限 1 张')

  const doom = runAbility('11722', 0, state, { seat: 0 }, { source: inv.threat[0] })
  assert.equal(callsOf(doom.api, 'doomOn').length, 1)
  // 同地点既无其他调查员也无偷渡者敌人时不触发。
  const alone = makeState({ investigators: [{ ...makeState().investigators[0], threat: [{ id: 't', code: '11722' }], hand: [] }] })
  assert.equal(matches(abilityOf('11722', 0), { state: alone, source: alone.investigators[0].threat[0], context: { seat: 0 } }), false)

  const action = abilityOf('11722', 1)
  assert.equal(action.cost.action, 1)
  const { api: actionApi } = runAbility('11722', 1, state, {}, { source: inv.threat[0] })
  const actionTest = capturedTest(actionApi)
  assert.deepEqual(actionTest.call.args, [0, 'willpower', 3])
  actionTest.resolve({ success: false, value: 1, difficulty: 3, failedBy: 2 })
  assert.equal(callsOf(actionApi, 'damage').length, 1)
  actionTest.resolve({ success: true, value: 4, difficulty: 3 })
  assert.equal(callsOf(actionApi, 'removeThreat').length, 1)
})

// ---------------------------------------------------------------------------
// 3. pilgrims
// ---------------------------------------------------------------------------
test('11723 朝圣者侍僧：攻击后在自己身上放 1 毁灭', () => {
  const enemy = { id: 'acolyte', code: '11723', originalCode: '11723', location: 'locA' }
  const state = makeState({ enemies: [enemy] })
  const { api } = runAbility('11723', 0, state, { when: 'enemyAttacked', enemy, seat: 0, attack: { cancelled: false } },
    { source: enemy })
  assert.equal(callsOf(api, 'doomOn').length, 1)
  assert.deepEqual(lastCall(api, 'doomOn').args, [enemy, 1])
  assert.equal(matches(abilityOf('11723', 0), { source: enemy, context: { enemy: { id: 'other' } } }), false)
})

test('11724 朝圣者领袖：任意空地点生成；重整时其他异教徒敌人 +2 战斗并获得无情', () => {
  const entry = entryOf('11724')
  assert.equal(entry.enemyRule.spawnAnyEmpty, true)
  const modifier = entry.modifiers[0]
  assert.equal(modifier.target, 'enemyFight')
  assert.equal(modifier.audience, 'enemies')
  const cultist = { id: 'cultist-1', traits: ['Humanoid', 'Cultist'] }
  assert.equal(modifier.condition.when({ source: { id: 'leader', exhausted: false }, entity: cultist }), true)
  assert.equal(modifier.condition.when({ source: { id: 'leader', exhausted: true }, entity: cultist }), false)
  assert.equal(modifier.condition.when({ source: { id: 'leader', exhausted: false }, entity: { id: 'x', traits: ['Monster'] } }), false)
  assert.equal(modifier.condition.when({ source: { id: 'cultist-1', exhausted: false }, entity: cultist }), false, '不对自己生效')

  const enemies = [
    { id: 'leader', code: '11724', originalCode: '11724', location: 'locA', exhausted: false },
    { id: 'cultist-1', code: '01182', location: 'locB', traits: ['Humanoid', 'Cultist'] },
  ]
  const { api } = runAbility('11724', 0, makeState({ enemies }), {}, { source: enemies[0] })
  const synced = callsOf(api, 'scenario.setEnemyKeywords')
  assert.equal(synced.length, 1)
  assert.deepEqual(synced[0].args[0], enemies[1])
  assert.deepEqual(synced[0].args[1], ['relentless'])
})

// ---------------------------------------------------------------------------
// 4. star_spawn（标记揭示强制）
// ---------------------------------------------------------------------------
test('11725 怪异星之眷族：攻击/躲避它时揭示旧神标记 → 治愈 1 点伤害', () => {
  const enemy = { id: 'monstrous', code: '11725', originalCode: '11725', location: 'locA', damageTaken: 2 }
  const state = makeState({ enemies: [enemy], skillTest: { seat: 0, actionKind: 'fight', target: { kind: 'enemy', id: enemy.id } } })
  const { api } = runAbility('11725', 0, state, { token: 'elderthing', seat: 0 }, { source: enemy })
  assert.equal(callsOf(api, 'healEnemy').length, 1)
  assert.deepEqual(lastCall(api, 'healEnemy').args, [enemy, 1])
  const other = makeState({ enemies: [enemy], skillTest: { seat: 0, actionKind: 'investigate', target: { kind: 'location', id: 'locA' } } })
  assert.equal(matches(abilityOf('11725', 0), { state: other, source: enemy, context: { token: 'elderthing', seat: 0 } }), false)
})

test('11726 感染星之眷族：首次将要被击败 → 替换（治愈所有伤害并重整）；标记揭示受 1 恐惧', () => {
  const enemy = { id: 'infected', code: '11726', originalCode: '11726', location: 'locA', damageTaken: 3 }
  const context = { kind: 'defeat', phase: 'would', enemy, replaced: false, cancelled: false }
  const replaced = []
  const { api } = runAbility('11726', 0, makeState({ enemies: [enemy] }), context, {
    source: enemy,
    api: { enemyOutcomes: { replace: (ctx, spec) => { replaced.push(spec); ctx.replaced = true; return true } } },
  })
  assert.equal(replaced.length, 1)
  assert.deepEqual(replaced[0], { healAllDamage: true, ready: true })
  assert.ok(callsOf(api, 'info').length >= 1)
  const limit = abilityOf('11726', 0).limit
  assert.equal(limit.scope, 'perGame')
  assert.equal(limit.owner, 'instance')

  const testing = makeState({ enemies: [enemy], skillTest: { seat: 0, actionKind: 'evade', target: { kind: 'enemy', id: enemy.id } } })
  const horror = runAbility('11726', 1, testing, { token: 'elderthing', seat: 0 }, { source: enemy })
  assert.equal(callsOf(horror.api, 'horror').length, 1)
  assert.deepEqual(lastCall(horror.api, 'horror').args, [0, 1])
})

test('11727 珊瑚星之眷族：有伤害时同步警戒/反击；标记揭示受 1 伤害', () => {
  const enemy = { id: 'coral', code: '11727', originalCode: '11727', location: 'locA', damageTaken: 1 }
  const { api } = runAbility('11727', 0, makeState({ enemies: [enemy] }), {}, { source: enemy })
  const synced = callsOf(api, 'scenario.setEnemyKeywords')
  assert.equal(synced.length, 1)
  assert.deepEqual(synced[0].args[1], ['alert', 'retaliate'])
  assert.equal(synced[0].args[2].enabled, true)

  const healthy = { ...enemy, damageTaken: 0 }
  const off = runAbility('11727', 0, makeState({ enemies: [healthy] }), {}, { source: healthy })
  assert.equal(lastCall(off.api, 'scenario.setEnemyKeywords').args[2].enabled, false)

  const testing = makeState({ enemies: [enemy], skillTest: { seat: 0, actionKind: 'fight', target: { kind: 'enemy', id: enemy.id } } })
  const dmg = runAbility('11727', 1, testing, { token: 'elderthing', seat: 0 }, { source: enemy })
  assert.deepEqual(lastCall(dmg.api, 'damage').args, [0, 1])
})

test('11728 星之眷族观察者：调查它所在地点时揭示旧神标记 → 交战并立刻攻击', () => {
  const enemy = { id: 'observer', code: '11728', originalCode: '11728', location: 'locA' }
  const state = makeState({
    enemies: [enemy],
    skillTest: { seat: 0, actionKind: 'investigate', target: { kind: 'location', id: 'locA' } },
  })
  const { api } = runAbility('11728', 0, state, { token: 'elderthing', seat: 0 }, { source: enemy })
  assert.equal(callsOf(api, 'engage').length, 1)
  assert.deepEqual(lastCall(api, 'engage').args, [enemy, 0])
  assert.equal(callsOf(api, 'scenario.attack').length, 1)
  assert.deepEqual(lastCall(api, 'scenario.attack').args[0], enemy)
  // 调查的是别的地点时不触发。
  const elsewhere = makeState({
    enemies: [enemy],
    skillTest: { seat: 0, actionKind: 'investigate', target: { kind: 'location', id: 'locB' } },
  })
  assert.equal(matches(abilityOf('11728', 0), { state: elsewhere, source: enemy, context: { token: 'elderthing', seat: 0 } }), false)
})

// ---------------------------------------------------------------------------
// 5. cosmic_legacy
// ---------------------------------------------------------------------------
test('11729 深渊之眼：进威胁区；cultist/tablet 改为 elderthing；成功弃卡', () => {
  const state = makeState()
  const inv = state.investigators[0]
  const api = makeApi()
  assert.equal(entryOf('11729').encounterResolve(state, inv, {}, api), true)
  assert.deepEqual(lastCall(api, 'threat').args, [0, '11729'])
  inv.threat.push({ id: 'eye', code: '11729', originalCode: '11729' })

  const replaced = runAbility('11729', 0, state, { when: 'tokenReveal', token: 'tablet', seat: 0 },
    { source: inv.threat[0], api: { replaceChaosToken: () => true } })
  assert.equal(callsOf(replaced.api, 'replaceChaosToken').length, 1)
  assert.equal(callsOf(replaced.api, 'replaceChaosToken')[0].args[1], 'elderthing')
  // 不是持有者揭示时不触发。
  assert.equal(matches(abilityOf('11729', 0), {
    state, source: inv.threat[0], context: { when: 'tokenReveal', token: 'cultist', seat: 1 },
  }), false)

  const action = runAbility('11729', 1, state, {}, { source: inv.threat[0] })
  capturedTest(action.api).resolve({ success: true, value: 5, difficulty: 3 })
  assert.equal(callsOf(action.api, 'removeThreat').length, 1)
})

test('11730 狡诈拟态：无怪物敌人时涌动；有怪物时检定失败 → 最近怪物攻击（无论位置）', () => {
  const empty = makeState()
  assert.deepEqual(entryOf('11730').encounterResolve(empty, empty.investigators[0], {}, makeApi()), { gainSurge: true })

  const monsters = makeState({
    enemies: [
      { id: 'm1', code: 'ghoulMinion', location: 'locB', traits: ['Monster'], name: '近怪' },
      { id: 'm2', code: 'ghoulMinion', location: 'locC', traits: ['Monster'], name: '远怪' },
      { id: 'human', code: 'cultist', location: 'locA', traits: ['Humanoid'], name: '人类' },
    ],
  })
  const api = makeApi()
  entryOf('11730').encounterResolve(monsters, monsters.investigators[0], {}, api)
  capturedTest(api).resolve({ success: false, value: 0, difficulty: 3, failedBy: 3 })
  assert.equal(lastCall(api, 'attack').args[0].id, 'm1', '应攻击最近的怪物敌人')
  assert.equal(callsOf(api, 'attack').length, 1)
})

// ---------------------------------------------------------------------------
// 6. elder_mist
// ---------------------------------------------------------------------------
test('11731 古老迷雾：附属到最近未附属地点；地点调查员成功超过 2 点后弃掉', () => {
  const state = makeState()
  const api = makeApi({ map: { nearest: () => ['locB'] } })
  assert.deepEqual(entryOf('11731').encounterResolve(state, state.investigators[0], {}, api), { placed: true })
  assert.deepEqual(lastCall(api, 'attachToLocation').args[0], 'locB')

  const attached = makeState()
  attached.locations[0].attachments = [{ id: 'mist-1', code: '11731', originalCode: '11731' }]
  const success = runAbility('11731', 0, attached, { when: 'testEnds', seat: 0, result: { success: true, successBy: 2 } })
  assert.equal(callsOf(success.api, 'scenario.detachLocationAttachment').length, 1)
  assert.equal(matches(abilityOf('11731', 0), { state: attached, context: { seat: 0, result: { success: true, successBy: 1 } } }), false)
  const elsewhere = makeState()
  elsewhere.locations[0].attachments = [{ id: 'mist-2', code: '11731', originalCode: '11731' }]
  elsewhere.investigators[1].location = 'locB'
  assert.equal(matches(abilityOf('11731', 0), {
    state: elsewhere, context: { seat: 1, result: { success: true, successBy: 3 } },
  }), false, '必须是附属地点的调查员')
})

test('11732 腐蚀浓雾：智识/战斗(4)；失败 <3 受 1 伤害，≥3 改为直接伤害调查员与每张有生命的盟友/道具', () => {
  const state = makeState()
  state.investigators[0].assets = [
    { id: 'a1', code: '01021' }, // 盟友（有生命值）
    { id: 'a2', code: '01020' }, // 道具（无生命值）
  ]
  const api = makeApi({ answers: ['combat'] })
  entryOf('11732').encounterResolve(state, state.investigators[0], {}, api)
  const test = capturedTest(api)
  assert.deepEqual(test.call.args.slice(0, 3), [0, 'combat', 4])
  test.resolve({ success: false, value: 2, difficulty: 4, failedBy: 2 })
  assert.equal(callsOf(api, 'damage').length, 1)
  assert.equal(callsOf(api, 'directDamage').length, 0)

  const api2 = makeApi({ answers: ['intellect'] })
  entryOf('11732').encounterResolve(state, state.investigators[0], {}, api2)
  capturedTest(api2).resolve({ success: false, value: 0, difficulty: 4, failedBy: 4 })
  assert.equal(callsOf(api2, 'directDamage').length, 1)
  assert.deepEqual(callsOf(api2, 'damageAsset').map(call => call.args), [[0, 'a1', 1]])
})

// ---------------------------------------------------------------------------
// 7. undersea_creatures
// ---------------------------------------------------------------------------
test('11733 伏特鳗：完全淹没地点视为互相连接（enemyRule 读点）', () => {
  assert.equal(entryOf('11733').enemyRule.hunterTreatsFloodedConnected, true)
  assert.equal(entryOf('11733').flags.hunter, true)
})

test('11734 梦游迁徙：无敌人涌动；失败二选一（最近敌人移动+攻击 / 抽遭遇弃牌堆顶敌人）', () => {
  const empty = makeState()
  assert.deepEqual(entryOf('11734').encounterResolve(empty, empty.investigators[0], {}, makeApi()), { gainSurge: true })

  const state = makeState({ enemies: [{ id: 'e1', code: 'ghoulMinion', location: 'locB', name: '近敌' }] })
  const moveApi = makeApi({ answers: ['move'] })
  entryOf('11734').encounterResolve(state, state.investigators[0], {}, moveApi)
  capturedTest(moveApi).resolve({ success: false, value: 1, difficulty: 3, failedBy: 2 })
  assert.deepEqual(lastCall(moveApi, 'moveEnemy').args.slice(0, 2), [state.enemies[0], 'locA'])
  assert.equal(callsOf(moveApi, 'attack').length, 1)

  const discardState = makeState({
    enemies: [{ id: 'e2', code: '01101', location: 'locB', name: '场上的敌人' }],
    encounterDiscard: ['01088', '01101'],
  })
  const drawApi = makeApi({ answers: ['draw'], api: { takeEncounterCard: () => ({ pile: 'encounterDiscard' }) } })
  entryOf('11734').encounterResolve(discardState, discardState.investigators[0], {}, drawApi)
  capturedTest(drawApi).resolve({ success: false, value: 1, difficulty: 3, failedBy: 2 })
  assert.equal(callsOf(drawApi, 'drawEncounter').length, 1)
  assert.equal(lastCall(drawApi, 'drawEncounter').args[1].code, '01101')
})

test('11735 水下狩猎：完全淹没难度 +2；失败受 1 伤害并抬升最近可涨水地点', () => {
  const state = makeState()
  const flooded = makeApi({ water: { level: () => 2, nearestTargets: () => ['locB'] } })
  entryOf('11735').encounterResolve(state, state.investigators[0], {}, flooded)
  assert.deepEqual(capturedTest(flooded).call.args.slice(0, 3), [0, 'agility', 5])
  capturedTest(flooded).resolve({ success: false, value: 2, difficulty: 5, failedBy: 3 })
  assert.equal(callsOf(flooded, 'damage').length, 1)
  assert.deepEqual(lastCall(flooded, 'water.change').args, ['locB', 1])

  const dry = makeApi({ water: { level: () => 1 } })
  entryOf('11735').encounterResolve(state, state.investigators[0], {}, dry)
  assert.deepEqual(capturedTest(dry).call.args.slice(0, 3), [0, 'agility', 3])
})

// ---------------------------------------------------------------------------
// 8. tdc_flood
// ---------------------------------------------------------------------------
test('11736 致命急流：未淹没涌动；游向安全/坚守阵地两条失败分支', () => {
  const dryState = makeState()
  assert.deepEqual(entryOf('11736').encounterResolve(dryState, dryState.investigators[0], {},
    makeApi({ water: { level: () => 0 } })), { gainSurge: true })

  const state = makeState()
  const wet = makeApi({ water: { level: () => 1 }, answers: ['agility'] })
  entryOf('11736').encounterResolve(state, state.investigators[0], {}, wet)
  capturedTest(wet).resolve({ success: true, value: 5, difficulty: 4 })
  assert.equal(callsOf(wet, 'moveInvestigator').length, 1)
  capturedTest(wet).resolve({ success: false, value: 1, difficulty: 4, failedBy: 3 })
  assert.equal(callsOf(wet, 'damage').length, 1)
  assert.equal(callsOf(wet, 'horror').length, 1)

  state.investigators[0].assets = [{ id: 'asset-1', code: '01021' }]
  const hold = makeApi({ water: { level: () => 2 }, answers: ['combat'] })
  entryOf('11736').encounterResolve(state, state.investigators[0], {}, hold)
  capturedTest(hold).resolve({ success: false, value: 1, difficulty: 4, failedBy: 3 })
  assert.equal(callsOf(hold, 'damage').length, 1)
  assert.equal(callsOf(hold, 'discardAsset').length, 1, '01021 占盟友槽应被弃置')
})

test('11737 水中之物：显现抬升最近可涨水地点的淹没等级', () => {
  const api = makeApi({ water: { nearestTargets: () => ['locB'] } })
  const state = makeState()
  entryOf('11737').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(lastCall(api, 'water.change').args, ['locB', 1])
  const noTarget = makeApi()
  entryOf('11737').encounterResolve(state, state.investigators[0], {}, noTarget)
  assert.equal(callsOf(noTarget, 'water.change').length, 0)
})

test('11738 不祥寂静：进威胁区；打出额外费用花 1 资源或受 1 恐惧；未淹没时摆脱检定自动成功', () => {
  const state = makeState()
  const threatApi = makeApi()
  assert.equal(entryOf('11738').encounterResolve(state, state.investigators[0], {}, threatApi), true)
  assert.deepEqual(lastCall(threatApi, 'threat').args, [0, '11738'])
  state.investigators[0].threat.push({ id: 'silence', code: '11738', originalCode: '11738' })

  const pay = runAbility('11738', 0, state, { cardCode: '01020', seat: 0 },
    { source: state.investigators[0].threat[0], answers: ['resource'] })
  assert.equal(callsOf(pay.api, 'spendResources').length, 1)
  const hurt = runAbility('11738', 0, state, { cardCode: '01020', seat: 0 },
    { source: state.investigators[0].threat[0], answers: ['horror'] })
  assert.equal(callsOf(hurt.api, 'horror').length, 1)

  const dry = runAbility('11738', 1, state, {}, { source: state.investigators[0].threat[0], water: { level: () => 0 } })
  assert.equal(callsOf(dry.api, 'removeThreat').length, 1, '未淹没自动成功弃卡')
  const wet = runAbility('11738', 1, state, {}, { source: state.investigators[0].threat[0], water: { level: () => 2 } })
  capturedTest(wet.api).resolve({ success: true, value: 5, difficulty: 3 })
  assert.equal(callsOf(wet.api, 'removeThreat').length, 1)
})

// ---------------------------------------------------------------------------
// 9. rlyeh
// ---------------------------------------------------------------------------
test('11739 独眼巨人建筑：难度 = 印刷隐藏值；失败每差 1 点弃 1 张手牌（最多 3）', () => {
  const state = makeState()
  state.investigators[0].hand = ['01020', '01021', '01022', '01023', '01024']
  const api = makeApi()
  entryOf('11739').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(capturedTest(api).call.args.slice(0, 3), [0, 'intellect', 2])
  capturedTest(api).resolve({ success: false, value: -3, difficulty: 2, failedBy: 5 })
  assert.deepEqual(lastCall(api, 'discardChosen').args, [0, 3, '11739'])
})

test('11740 崩塌砖石：难度 = 印刷隐藏值；失败受 2 伤害', () => {
  const state = makeState()
  const api = makeApi()
  entryOf('11740').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(capturedTest(api).call.args.slice(0, 3), [0, 'agility', 2])
  capturedTest(api).resolve({ success: false, value: 1, difficulty: 2, failedBy: 1 })
  assert.deepEqual(lastCall(api, 'damage').args, [0, 2])
})

// ---------------------------------------------------------------------------
// 10. domination
// ---------------------------------------------------------------------------
test('11741 克苏鲁弗坦：战斗(3)；失败二选一（2 恐惧 / 同地点调查员 1 直接伤害）', () => {
  const state = makeState()
  const horror = makeApi({ answers: ['horror'] })
  entryOf('11741').encounterResolve(state, state.investigators[0], {}, horror)
  capturedTest(horror).resolve({ success: false, value: 1, difficulty: 3, failedBy: 2 })
  assert.deepEqual(lastCall(horror, 'horror').args, [0, 2])

  const damage = makeApi({ answers: ['damage', '1'] })
  entryOf('11741').encounterResolve(state, state.investigators[0], {}, damage)
  capturedTest(damage).resolve({ success: false, value: 1, difficulty: 3, failedBy: 2 })
  assert.deepEqual(lastCall(damage, 'directDamage').args, [1, 1])
})

test('11742 压迫影响：意志(印刷隐藏值)；失败受 2 恐惧', () => {
  const state = makeState()
  const api = makeApi()
  entryOf('11742').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(capturedTest(api).call.args.slice(0, 3), [0, 'willpower', 2])
  capturedTest(api).resolve({ success: false, value: 0, difficulty: 2, failedBy: 2 })
  assert.deepEqual(lastCall(api, 'horror').args, [0, 2])
})

test('11743 支配：三选一（密谋放毁灭 / 每人弃 2 手牌 / 每人失 1 行动）', () => {
  const doom = runReveal('11743', makeState(), { answers: ['doom'] })
  assert.deepEqual(lastCall(doom, 'addDoom').args, [1])

  const discard = runReveal('11743', makeState(), { answers: ['discard'] })
  assert.deepEqual(callsOf(discard, 'discardChosen').map(call => call.args[0]), [0, 1])

  const actions = runReveal('11743', makeState(), { answers: ['actions'] })
  assert.deepEqual(callsOf(actions, 'loseActions').map(call => call.args), [[0, 1], [1, 1]])
})

// ---------------------------------------------------------------------------
// 11. the_inescapable
// ---------------------------------------------------------------------------
test('11744 穷途异魔：生成到连接地点（尽可能为空）；每轮首次旧神标记重整并猎手移动', () => {
  const enemy = { id: 'inescapable', code: '11744', originalCode: '11744', location: 'locA', exhausted: false }
  const state = makeState({ enemies: [enemy] })
  const spawn = runAbility('11744', 0, state, { when: 'enemySpawn', enemy, seat: 0 }, { source: enemy })
  assert.equal(callsOf(spawn.api, 'moveEnemy').length, 1)
  assert.deepEqual(lastCall(spawn.api, 'moveEnemy').args.slice(0, 2), [enemy, 'locB'])

  const token = runAbility('11744', 1, state, { token: 'elderthing', seat: 0 },
    { source: enemy, scenario: { hunterStep: () => 'locB' } })
  assert.equal(callsOf(token.api, 'scenario.readyEnemy').length, 1)
  assert.deepEqual(lastCall(token.api, 'moveEnemy').args.slice(0, 2), [enemy, 'locB'], '猎手关键词移动一步')
  assert.equal(callsOf(token.api, 'scenario.attack').length, 0, '不发动攻击')
  const tokenLimit = abilityOf('11744', 1).limit
  assert.equal(tokenLimit.scope, 'perRound')
  assert.equal(tokenLimit.owner, 'group')
})

test('11745 仍在你身后：难度随胜利区份数递增；失败时在场敌人逐地点移动并交战', () => {
  const enemy = { id: 'inescapable', code: '11744', originalCode: '11744', location: 'locC', name: '穷途异魔' }
  const state = makeState({
    enemies: [enemy],
    victoryDisplay: [{ code: '11745', originalCode: '11745' }, { code: '11745', originalCode: '11745' }],
  })
  const api = makeApi({
    api: { moveEnemy: (target, destination) => { target.location = destination; return true } },
  })
  entryOf('11745').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(capturedTest(api).call.args.slice(0, 3), [0, 'agility', 4], '2 + 胜利区 2 份')
  capturedTest(api).resolve({ success: false, value: 1, difficulty: 4, failedBy: 3 })
  assert.equal(callsOf(api, 'moveEnemy').length, 2, '从 locC 逐地点移动到 locA')
  assert.equal(callsOf(api, 'engage').length, 1)

  // 不在场：从场外（遭遇牌库）找出穷途异魔抽取，并把本卡加入胜利区。
  const outOfPlay = makeState({ encounterDeck: ['11744'], victoryDisplay: [] })
  const findApi = makeApi({
    api: { takeEncounterCard: () => ({ pile: 'encounterDeck' }) },
  })
  entryOf('11745').encounterResolve(outOfPlay, outOfPlay.investigators[0], {}, findApi)
  capturedTest(findApi).resolve({ success: false, value: 1, difficulty: 2, failedBy: 1 })
  assert.equal(callsOf(findApi, 'drawEncounter').length, 1)
  assert.equal(lastCall(findApi, 'drawEncounter').args[1].code, '11744')
  assert.equal(callsOf(findApi, 'addStoryToVictory').length, 1)
})

// ---------------------------------------------------------------------------
// 12. deep_ones
// ---------------------------------------------------------------------------
test('11746 深潜者奴仆：与你交战后随机弃 1 张手牌', () => {
  const enemy = { id: 'thrall', code: '11746', originalCode: '11746', location: 'locA', traits: ['Monster', 'Deep One'] }
  const { api } = runAbility('11746', 0, makeState({ enemies: [enemy] }), { enemy, seat: 0 }, { source: enemy })
  assert.deepEqual(lastCall(api, 'discardRandomFromHand').args, [0, 1])
})

test('11747 长老深潜者：其他深潜者获得无情；交战后治愈其他深潜者 1 点伤害', () => {
  const enemies = [
    { id: 'elder', code: '11747', originalCode: '11747', location: 'locA', traits: ['Monster', 'Deep One'] },
    { id: 'thrall', code: '11746', originalCode: '11746', location: 'locB', traits: ['Monster', 'Deep One'], damageTaken: 2 },
    { id: 'ghoul', code: 'ghoulMinion', location: 'locB', traits: ['Monster'], damageTaken: 2 },
  ]
  const state = makeState({ enemies })
  const sync = runAbility('11747', 0, state, {}, { source: enemies[0] })
  assert.equal(callsOf(sync.api, 'scenario.setEnemyKeywords').length, 1)
  assert.deepEqual(lastCall(sync.api, 'scenario.setEnemyKeywords').args[0], enemies[1])

  const heal = runAbility('11747', 1, state, { enemy: enemies[0], seat: 0 }, { source: enemies[0] })
  assert.equal(callsOf(heal.api, 'healEnemy').length, 1)
  assert.deepEqual(lastCall(heal.api, 'healEnemy').args, [enemies[1], 1])
})

test('11748 深潜者伏击：进威胁区；深潜者交战后该敌人攻击并弃卡', () => {
  const state = makeState()
  assert.equal(entryOf('11748').encounterResolve(state, state.investigators[0], {}, makeApi()), true)
  state.investigators[0].threat.push({ id: 'ambush', code: '11748', originalCode: '11748' })
  const threat = state.investigators[0].threat[0]
  const enemy = { id: 'thrall', code: '11746', originalCode: '11746', traits: ['Deep One'], location: 'locA', name: '深潜者奴仆' }
  const { api } = runAbility('11748', 0, { ...state, enemies: [enemy] }, { enemy, seat: 0 }, { source: threat })
  assert.deepEqual(lastCall(api, 'scenario.attack').args[0], enemy)
  assert.equal(callsOf(api, 'removeThreat').length, 1)
  const human = { id: 'human', code: 'cultist', traits: ['Humanoid'] }
  assert.equal(matches(abilityOf('11748', 0), { state: { ...state, enemies: [human] }, source: threat, context: { enemy: human, seat: 0 } }), false)
})

// ---------------------------------------------------------------------------
// 13. dreams
// ---------------------------------------------------------------------------
test('11749 痛苦幻象：手牌 ≤3 时难度 +2；失败 1 直接恐惧 + 随机弃 1', () => {
  const state = makeState()
  state.investigators[0].hand = ['01020', '01021', '01022']
  const api = makeApi()
  entryOf('11749').encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(capturedTest(api).call.args.slice(0, 3), [0, 'willpower', 5])
  capturedTest(api).resolve({ success: false, value: 0, difficulty: 5, failedBy: 5 })
  assert.equal(callsOf(api, 'directHorror').length, 1)
  assert.equal(callsOf(api, 'discardRandom').length, 1)

  state.investigators[0].hand = ['01020', '01021', '01022', '01023']
  const api2 = makeApi()
  entryOf('11749').encounterResolve(state, state.investigators[0], {}, api2)
  assert.deepEqual(capturedTest(api2).call.args.slice(0, 3), [0, 'willpower', 3])
})

test('11750 引向黑暗：威胁区手牌上限 -3；回合结束无手牌弃卡', () => {
  assert.equal(entryOf('11750').threatEffect.handSizeModifier, -3)
  const state = makeState()
  state.investigators[0].threat.push({ id: 'darkness', code: '11750', originalCode: '11750' })
  const threat = state.investigators[0].threat[0]
  state.investigators[0].hand = []
  const { api } = runAbility('11750', 0, state, { seat: 0 }, { source: threat })
  assert.equal(callsOf(api, 'removeThreat').length, 1)
  state.investigators[0].hand = ['01020']
  assert.equal(matches(abilityOf('11750', 0), { state, source: threat, context: { seat: 0 } }), false)
})

// ---------------------------------------------------------------------------
// 14. alien_machinery
// ---------------------------------------------------------------------------
test('11751 持久构造体：击败时把胜利区每名其他持久构造体在你所在地点横置生成', () => {
  const enemy = { id: 'construct', code: '11751', originalCode: '11751', location: 'locA' }
  const state = makeState({
    enemies: [enemy],
    victoryDisplay: [{ code: '11751', originalCode: '11751' }, { code: '11751', originalCode: '11751' }],
  })
  const { api } = runAbility('11751', 0, state, { enemy, seat: 0 }, { source: enemy })
  assert.equal(callsOf(api, 'scenario.takeFromVictory').length, 2)
  assert.equal(callsOf(api, 'scenario.spawn').length, 2)
  assert.equal(callsOf(api, 'scenario.exhaustEnemy').length, 2)
  for (const call of callsOf(api, 'scenario.spawn')) assert.deepEqual(call.args, ['11751', 'locA'])
})

test('11752 地狱机械：进威胁区；智识/敏捷(4)成功弃卡', () => {
  const state = makeState()
  const threatApi = makeApi()
  assert.equal(entryOf('11752').encounterResolve(state, state.investigators[0], {}, threatApi), true)
  assert.deepEqual(lastCall(threatApi, 'threat').args, [0, '11752'])
  state.investigators[0].threat.push({ id: 'machinery', code: '11752', originalCode: '11752' })
  const spellApi = makeApi({ answers: ['agility'] })
  runAbility('11752', 0, state, {}, { source: state.investigators[0].threat[0], useApi: spellApi })
  assert.deepEqual(capturedTest(spellApi).call.args.slice(0, 3), [0, 'agility', 4])
  capturedTest(spellApi).resolve({ success: true, value: 5, difficulty: 4 })
  assert.equal(callsOf(spellApi, 'removeThreat').length, 1)
})
