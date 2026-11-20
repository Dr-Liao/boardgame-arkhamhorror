// TDC P7 共享资产（shared-assets worker：tasks 16 面 + tdc_expedition 6 张）单卡条目回归。
//
// 验收口径（CONTRACT §2/§3/§7）：
//   · 22 个单卡文件可 import 并通过 registerCardAbilities（注册期校验 code/scope/abilities/flags）；
//   · code 唯一、文件名 = code、scope = storyAsset、code 与条目一一对应；
//   · 任务映射完整（8 任务 × 未完成/完成两面）：partnerCode 互相指向，进度轨道/门限/完成记录
//     与战役层 records.js 的 TDC_TASKS / TDC_TASK_TRACK / TDC_TASK_COMPLETION_PROGRESS 完全一致；
//   · 远征用品 6 张的数据字段（uses/usesType、assetRule、modifiers、trackRoundActionHistory）；
//   · 用「最小 state + api spy」夹具直接调用条目函数，验证至少 2 张任务完成面与 1 张远征用品的数值。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { applyHarm, descriptorUsable, endCampaign, executeDescriptor, scenarioRuntime } from '../src/engine/engine.js'
import { answer, asset, fixture, legalMoves, move, settle, use } from './core-fixture.mjs'
import { changeProgress, claimProgress, progressFor } from '../src/campaign/progress-tracks.js'
import { persistEnabled, readSnapshot, saveSnapshot } from '../../../lib/sessions.js'
import {
  TDC_TASKS, TDC_TASK_COMPLETION_PROGRESS, TDC_TASK_TRACK, TDC_TASK_COMPLETED_RECORDS,
} from '../content/campaigns/theDrownedCity/records.js'

import t11753a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11753a.js'
import t11753b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11753b.js'
import t11754a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11754a.js'
import t11754b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11754b.js'
import t11755a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11755a.js'
import t11755b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11755b.js'
import t11756a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11756a.js'
import t11756b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11756b.js'
import t11757a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11757a.js'
import t11757b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11757b.js'
import t11758a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11758a.js'
import t11758b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11758b.js'
import t11759a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11759a.js'
import t11759b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11759b.js'
import t11760a from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11760a.js'
import t11760b from '../src/cards/encounter-entries/theDrownedCity/_shared/tasks/11760b.js'
import e11761 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11761.js'
import e11762 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11762.js'
import e11763 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11763.js'
import e11764 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11764.js'
import e11765 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11765.js'
import e11766 from '../src/cards/encounter-entries/theDrownedCity/_shared/tdc_expedition/11766.js'

const TASK_ENTRIES = [
  t11753a, t11753b, t11754a, t11754b, t11755a, t11755b, t11756a, t11756b,
  t11757a, t11757b, t11758a, t11758b, t11759a, t11759b, t11760a, t11760b,
]
const EXPEDITION_ENTRIES = [e11761, e11762, e11763, e11764, e11765, e11766]
const ENTRIES = [...TASK_ENTRIES, ...EXPEDITION_ENTRIES]
// 引擎 import 会通过 encounter-entries/index.js 统一注册非玩家条目；这里只补注册未注册项，
// 避免重复注册错误（第二轮起本文件接真实引擎做任务结局进度/反映射测试）。
for (const entry of ENTRIES) {
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}

const entryOf = code => registeredEntry(code)
const abilityOf = (code, index = 0) => entryOf(code)?.abilities?.[index]

// ---------------------------------------------------------------------------
// 夹具：最小 state + 记录调用的 api（与 tests/tdc-p7-shared-encounters.test.mjs 同口径）。
// ---------------------------------------------------------------------------
function makeState (overrides = {}) {
  const base = {
    round: 1,
    phase: 'investigation',
    currentSeat: 0,
    investigators: [
      { seat: 0, id: 'inv0', name: '测试员甲', location: 'locA', hand: [], assets: [], threat: [], resources: 5, damage: 0, horror: 0, defeated: false, resigned: false },
    ],
    locations: [
      { id: 'locA', name: '地点A', shroud: 2, connections: ['locB'], clues: 0, revealed: true },
      { id: 'locB', name: '地点B', shroud: 3, connections: ['locA'], clues: 1, revealed: true },
    ],
    enemies: [],
    encounterDeck: [],
    encounterDiscard: [],
    victoryDisplay: [],
    setAsideEnemies: [],
    scenarioFlags: {},
    numInvestigators: 1,
    log: [],
  }
  return { ...base, ...overrides }
}

function makeApi (options = {}) {
  const calls = []
  const record = (name, args, value) => { calls.push({ name, args }); return value }
  const base = {
    calls,
    info: message => record('info', [message], undefined),
    cardName: code => `卡片${code}`,
    locName: id => `名称:${id}`,
    tokenLabel: token => `标记${token}`,
    choice: spec => {
      calls.push({ name: 'choice', args: [spec] })
      return (options.answers || [])[Number.isInteger(options.answerIndex) ? options.answerIndex : 0]
        ?? spec?.options?.[0]?.id
    },
  }
  return new Proxy(base, {
    get (target, key) {
      if (key in target) return target[key]
      return (...args) => record(String(key), args, options.results?.[String(key)])
    },
  })
}

const callsOf = (api, name) => api.calls.filter(call => call.name === name)
const lastCall = (api, name) => callsOf(api, name).at(-1)
const sourceOf = code => ({ id: `src-${code}`, code, originalCode: code })

function runAbility (code, index, state, context = {}, options = {}) {
  const ability = abilityOf(code, index)
  assert.ok(ability, `${code} 缺少第 ${index} 条能力`)
  const api = makeApi(options)
  const inv = state.investigators[options.seat ?? 0]
  const source = options.source || sourceOf(code)
  const useIndex = options.abilityIndex ?? index
  ability.resolve({ state, inv, seat: inv.seat, source, context, events: [], api, descriptor: ability, window: context.when, abilityIndex: useIndex })
  return { api, source, ability }
}

const criteriaOf = (code, index = 0) => abilityOf(code, index).criteria

function holds (code, index, state, context) {
  const criteria = criteriaOf(code, index)
  if (!criteria) return true
  return Boolean(criteria({ state, inv: state.investigators[0], source: sourceOf(code), context }))
}

// ---------------------------------------------------------------------------
// 1. 注册与清单
// ---------------------------------------------------------------------------
test('TDC P7 共享资产：22 个单卡条目注册成功，code 唯一、scope 合法、note 齐备', () => {
  assert.equal(ENTRIES.length, 22)
  assert.equal(TASK_ENTRIES.length, 16)
  assert.equal(EXPEDITION_ENTRIES.length, 6)
  const codes = ENTRIES.map(entry => entry.code)
  assert.equal(new Set(codes).size, codes.length, 'code 必须唯一')
  for (const entry of ENTRIES) {
    assert.equal(typeof entry.code, 'string')
    assert.match(entry.code, /^117(5[3-9]|60)[ab]?$|^1176[1-6]$/, `${entry.code} 不在本分片`)
    assert.equal(entryOf(entry.code)?.code, entry.code, `${entry.code} 未注册`)
    assert.equal(entry.scope, 'storyAsset', `${entry.code} 作用域错误`)
    assert.equal(typeof entry.implemented, 'boolean', `${entry.code} 必须显式声明 implemented`)
    assert.ok(entry.note && entry.note.length > 10, `${entry.code} 必须写 note（读点/近似）`)
    assert.ok(Array.isArray(entry.flags ? entry.flags.traits : null), `${entry.code} 缺 flags.traits`)
  }
})

// ---------------------------------------------------------------------------
// 2. 任务映射：8 任务 × 2 面（与战役层 records.js 同源）
// ---------------------------------------------------------------------------
test('TDC P7 任务映射完整：8 任务 × 完成/未完成两面，partnerCode 互指、进度轨道与门限一致', () => {
  assert.equal(TDC_TASKS.length, 8)
  assert.equal(TDC_TASK_COMPLETION_PROGRESS, 5)
  assert.equal(TDC_TASK_TRACK, 'tdcTask')
  const seen = new Set()
  for (const task of TDC_TASKS) {
    const incomplete = entryOf(task.card)
    const completed = entryOf(task.completedCard)
    assert.ok(incomplete, `${task.id} 缺未完成面 ${task.card}`)
    assert.ok(completed, `${task.id} 缺完成面 ${task.completedCard}`)
    seen.add(task.card)
    seen.add(task.completedCard)

    // 未完成面：任务标识、门限、完成记录、印刷判定数据。
    const left = incomplete.flags.task
    assert.equal(left.id, task.id, `${task.card} 任务 id 不一致`)
    assert.equal(left.side, 'incomplete')
    assert.equal(left.partnerCode, task.completedCard, `${task.card} partnerCode 未指向完成面`)
    assert.equal(left.completedCard, task.completedCard)
    assert.equal(left.completedRecord, task.completedRecord)
    assert.equal(left.progress.track, TDC_TASK_TRACK)
    assert.equal(left.progress.threshold, TDC_TASK_COMPLETION_PROGRESS)
    assert.ok(left.endOfGame && typeof left.endOfGame.kind === 'string', `${task.card} 缺 endOfGame 判定数据`)
    assert.ok(left.tally && typeof left.tally.token === 'string', `${task.card} 缺计数数据`)
    // 进度回执必须是 progress-tracks 的合法标识（/^[a-zA-Z][a-zA-Z0-9_-]*$/），
    // 且按调查员/轨道唯一（重复派发由 receipt 去重）。
    assert.match(left.progress.receipt, /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      `${task.card} 的 endOfGame receipt 必须是合法进度标识`)
    // 第四轮：8 张未完成面全部声明引擎卡级 gameEnds 窗口结算（hub.endCampaign 派发）。
    //  （引擎端 hub.createHub 缺 reactionWindow 依赖、resourcesGained 在 dispatch 事务内崩溃两处已在
    //   engine-needs 记录；条目声明与窗口级行为由本文件真实引擎用例覆盖。）
    assert.equal(left.endOfGame.settle, 'gameEnds', `${task.card} 应声明 gameEnds 结算`)
    assert.equal(incomplete.implemented, true, `${task.card} 的结局进度已接线`)
    assert.match(incomplete.note, /gameEnds/, `${task.card} note 必须说明 gameEnds 读点`)
    assert.match(incomplete.note, /进度/, `${task.card} note 必须说明进度写点`)
    assert.doesNotMatch(incomplete.note, /blocked read point/, `${task.card} 不应再写 blocked`)
    const gameEndsAbilities = (incomplete.abilities || [])
      .filter(ability => ability.trigger?.includes?.('gameEnds'))
    assert.equal(gameEndsAbilities.length, 1, `${task.card} 必须且只能声明一条 gameEnds 能力`)
    assert.ok(['forced', 'reaction'].includes(gameEndsAbilities[0].kind), `${task.card} gameEnds 作用域非法`)

    // 完成面：被动/反应已接线。
    const right = completed.flags.task
    assert.equal(right.id, task.id, `${task.completedCard} 任务 id 不一致`)
    assert.equal(right.side, 'completed')
    assert.equal(right.partnerCode, task.card, `${task.completedCard} partnerCode 未指向未完成面`)
    assert.equal(right.replaces, task.card)
    assert.equal(right.completedRecord, task.completedRecord)
    assert.equal(right.progress.track, TDC_TASK_TRACK)
    assert.equal(completed.implemented, true, `${task.completedCard} 应标 implemented:true`)
  }
  assert.deepEqual([...seen].sort(), TASK_ENTRIES.map(entry => entry.code).sort())
  // 完成记录必须都在 §4 规范记录键里（不自造战役记录键）。
  for (const record of TDC_TASK_COMPLETED_RECORDS) {
    assert.ok(TDC_TASKS.some(task => task.completedRecord === record))
  }
  // 两面不重复实现同一句行为：未完成面 = 一条计时能力 + 一条 gameEnds 结束判定（两轮引擎读点），
  // 完成面只有收益/反应能力。
  const completedCodes = new Set(TDC_TASKS.map(task => task.completedCard))
  for (const entry of TASK_ENTRIES) {
    const kinds = (entry.abilities || []).map(ability => ability.kind)
    if (!completedCodes.has(entry.code)) {
      assert.ok(kinds.every(kind => kind === 'forced' || kind === 'reaction'), `${entry.code} 未完成面不应有收益类能力`)
      const tracking = (entry.abilities || []).filter(ability => !ability.trigger?.includes?.('gameEnds'))
      assert.equal(tracking.length <= 1, true, `${entry.code} 未完成面最多一条计时能力`)
    } else {
      assert.ok(kinds.every(kind => kind === 'reaction'), `${entry.code} 完成面只能用反应/修正`)
    }
  }
})

test('TDC P7 任务：计数次数与印刷「使用(N …)」一致（未完成面）', () => {
  const printed = {
    '11753a': [8, 'discoveries'],
    '11754a': [0, 'signs'],
    '11757a': [4, 'chances'],
    '11758a': [5, 'obligations'],
    '11760a': [5, 'obsessions'],
    '11757b': [3, 'chances'],
  }
  for (const [code, [uses, usesType]] of Object.entries(printed)) {
    assert.equal(entryOf(code).uses, uses, `${code} uses`)
    assert.equal(entryOf(code).usesType, usesType, `${code} usesType`)
  }
  // 好钱的「资源」用 uses 承载（0 起始，完成面没有 uses）。
  assert.equal(entryOf('11756a').uses, 0)
  assert.equal(entryOf('11756a').usesType, 'resources')
  // 坚守底线 / 毁灭之梦 是印在卡上的伤害/恐惧，不是 use 计数。
  assert.equal(entryOf('11755a').uses, null)
  assert.equal(entryOf('11759a').uses, null)
})

// ---------------------------------------------------------------------------
// 3. 远征用品数据字段
// ---------------------------------------------------------------------------
test('TDC P7 远征用品：6 张的数据字段与印刷一致（uses / assetRule / modifiers / 轮记账）', () => {
  assert.deepEqual(EXPEDITION_ENTRIES.map(entry => entry.code), ['11761', '11762', '11763', '11764', '11765', '11766'])
  const uses = {
    11761: [3, 'supplies'],
    11762: [3, 'supplies'],
    11763: [4, 'secrets'],
  }
  const traits = {
    11761: ['Item', 'Supply'],
    11762: ['Item', 'Supply'],
    11763: ['Item', 'Relic', "R'lyeh"],
  }
  for (const [code, [count, type]] of Object.entries(uses)) {
    assert.equal(entryOf(code).uses, count, `${code} uses`)
    assert.equal(entryOf(code).usesType, type, `${code} usesType`)
    assert.equal(entryOf(code).flags.expedition, true)
    assert.deepEqual(entryOf(code).flags.traits, traits[code], `${code} 特性`)
  }
  // 潜水服：伤害转移读点 + 有效淹没等级上限 1；印刷生命 3；4 张副本。
  assert.equal(entryOf('11764').assetRule.redirectOneDamageToSelf, true)
  assert.equal(entryOf('11764').assetRule.effectiveFloodLevelCap, 1)
  assert.equal(entryOf('11764').flags.health, 3)
  assert.equal(entryOf('11764').implemented, true)
  // 露比 / 安迪：+1 技能修正与盟友槽。
  assert.deepEqual(entryOf('11765').modifiers, [{ target: 'skill:agility', amount: 1 }])
  assert.deepEqual(entryOf('11766').modifiers, [{ target: 'skill:intellect', amount: 1 }])
  assert.deepEqual(entryOf('11765').flags.slots, ['ally'])
  assert.deepEqual(entryOf('11766').flags.slots, ['ally'])
  // 安迪的「本轮首次趁乱攻击」需要按轮记账。
  assert.equal(entryOf('11766').trackRoundActionHistory, true)
  // 每张远征用品都至少有一条已接线能力（潜水服是纯修正）。
  for (const entry of EXPEDITION_ENTRIES) {
    const wired = (entry.abilities || []).length > 0 || (entry.modifiers || []).length > 0 || Boolean(entry.assetRule)
    assert.ok(wired, `${entry.code} 没有任何已接线内容`)
  }
})

test('11764 潜水服（引擎）：受到伤害时引擎把 1 点改道到潜水服（assetRule 读点），其余照常由调查员承受', () => {
  // 条目只声明 assetRule.redirectOneDamageToSelf（无 resolve）；读写点都在 enemies.js#applyHarm。
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  const suit = asset(state, '11764', { id: 'suit', health: 3 })
  const startDamage = inv.damage
  // strategy 'self'：跳过伤害分配交互，直接结算（redirect 在读点内先于分配执行）。
  applyHarm(state, inv, 2, 0, [], false, null, false, 'self')
  assert.equal(suit.damage, 1, '1 点伤害改道到潜水服')
  assert.equal(inv.damage, startDamage + 1, '剩余 1 点由调查员承受')
  // 不在场/无潜水服时不改道。
  const state2 = fixture('01001', 1)
  applyHarm(state2, state2.investigators[0], 2, 0, [], false, null, false, 'self')
  assert.equal(state2.investigators[0].damage, 2)
})

test('11764 潜水服（引擎）：有效淹没等级上限 1——完全淹没视为部分淹没（无潜水服不生效）', () => {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  const runtime = scenarioRuntime(state, [])
  runtime.mechanics.water.set(inv.location, 2)
  assert.equal(runtime.mechanics.water.level(inv.location), 2, '实际淹没等级 = 2')
  assert.equal(runtime.mechanics.water.effectiveLevel(0), 2, '无潜水服时有效等级仍为 2')
  const suit = asset(state, '11764', { id: 'suit', health: 3 })
  assert.equal(runtime.mechanics.water.effectiveLevel(0), 1, '控制潜水服后有效等级 2 → 1')
  assert.equal(runtime.mechanics.water.level(inv.location), 2, '只改有效等级，不改实际淹没等级')
  // 移除潜水服后恢复（上限声明来自受控支援，随实例读）。
  inv.assets = inv.assets.filter(item => item !== suit)
  assert.equal(runtime.mechanics.water.effectiveLevel(0), 2, '失去潜水服后恢复为 2')
})

// ---------------------------------------------------------------------------
// 4. 数值验证：任务完成面（2 张）
// ---------------------------------------------------------------------------
test('11755b 完成面：+1 战斗、生命上限 +2（修正数值）', () => {
  assert.deepEqual(entryOf('11755b').modifiers, [
    { target: 'skill:combat', amount: 1 },
    { target: 'maxHealth', amount: 2 },
  ])
})

test('11754b 完成面：+1 意志；揭示 elder_sign 后治愈该地点调查员 1 点恐惧', () => {
  const entry = entryOf('11754b')
  assert.deepEqual(entry.modifiers, [{ target: 'skill:willpower', amount: 1 }])
  const state = makeState()
  // criteria：非 elder_sign 不触发；无同地点调查员也不触发。
  assert.equal(holds('11754b', 0, state, { token: 'skull', location: 'locA' }), false)
  assert.equal(holds('11754b', 0, state, { token: 'eldersign', location: 'locB' }), false, '该地点没有调查员')
  assert.equal(holds('11754b', 0, state, { token: 'eldersign', location: 'locA' }), true)
  const { api } = runAbility('11754b', 0, state, { when: 'chaosTokenRevealed', token: 'eldersign', location: 'locA', seat: 0 })
  assert.equal(callsOf(api, 'healHorror').length, 1)
  assert.deepEqual(lastCall(api, 'healHorror').args, [0, 1])
})

test('11760b 完成面：+1 智力；发现本地点最后一个线索后横置抽 1 张牌', () => {
  const entry = entryOf('11760b')
  assert.deepEqual(entry.modifiers, [{ target: 'skill:intellect', amount: 1 }])
  assert.equal(abilityOf('11760b', 0).cost.exhaust, true)
  const state = makeState()
  assert.equal(holds('11760b', 0, state, { seat: 0, lastClue: false }), false)
  assert.equal(holds('11760b', 0, state, { seat: 1, lastClue: true }), false, '不是自己的发现')
  assert.equal(holds('11760b', 0, state, { seat: 0, lastClue: true }), true)
  const { api } = runAbility('11760b', 0, state, { when: 'clueDiscovered', seat: 0, lastClue: true })
  assert.deepEqual(lastCall(api, 'drawCards').args, [0, 1])
})

// ---------------------------------------------------------------------------
// 5. 数值验证：未完成面的计时条款（抽两张，覆盖 uses / 伤害两条模板）
// ---------------------------------------------------------------------------
test('11753a 未完成面：揭示/放置地点时移除 1 个发现（cost.uses = 1）', () => {
  const ability = abilityOf('11753a', 0)
  assert.equal(ability.kind, 'forced')
  assert.deepEqual([...ability.trigger].sort(), ['locationPlaced', 'locationRevealed'])
  assert.equal(ability.cost.uses, 1)
  const state = makeState()
  assert.equal(holds('11753a', 0, state, { seat: 0, location: 'locA' }), true)
  assert.equal(holds('11753a', 0, state, { seat: 1, location: 'locA' }), false, '不是自己揭示的地点')
  assert.equal(entryOf('11753a').flags.task.endOfGame.kind, 'usesAtMostPerInvestigator')
  assert.equal(entryOf('11753a').flags.task.endOfGame.settle, 'gameEnds')
  assert.equal(entryOf('11753a').implemented, true)
})

test('11755a 未完成面：受到伤害时在本卡放 1 点伤害（useTokens 计数）', () => {
  const state = makeState()
  assert.equal(holds('11755a', 0, state, { seat: 0, damage: 0, horror: 2 }), false)
  assert.equal(holds('11755a', 0, state, { seat: 1, damage: 2 }), false)
  assert.equal(holds('11755a', 0, state, { seat: 0, damage: 2 }), true)
  const { api, source } = runAbility('11755a', 0, state, { when: 'harmAssigned', seat: 0, damage: 2 })
  assert.deepEqual(lastCall(api, 'placeUse').args, [source, 'damage', 1])
  assert.equal(entryOf('11755a').flags.task.endOfGame.kind, 'damageAtLeastMaxHealth')
  assert.equal(entryOf('11755a').flags.task.endOfGame.settle, 'gameEnds')
})

test('11759a 未完成面：受到恐惧时在本卡放 1 点恐惧（useTokens 计数）', () => {
  const state = makeState()
  assert.equal(holds('11759a', 0, state, { seat: 0, horror: 1 }), true)
  const { api, source } = runAbility('11759a', 0, state, { when: 'harmAssigned', seat: 0, horror: 1 })
  assert.deepEqual(lastCall(api, 'placeUse').args, [source, 'horror', 1])
})

test('11754a 未完成面：任意地点揭示 elder_sign 后放置 1 个征兆', () => {
  const state = makeState()
  assert.equal(holds('11754a', 0, state, { token: 'skull' }), false)
  assert.equal(holds('11754a', 0, state, { token: 'eldersign', location: 'locB' }), true)
  const { api, source } = runAbility('11754a', 0, state, { when: 'chaosTokenRevealed', token: 'eldersign' })
  assert.deepEqual(lastCall(api, 'placeUse').args, [source, 'signs', 1])
})

test('11757a 未完成面：低于难度 2 点失败后移除 1 个机会（失败差值口径）', () => {
  const state = makeState()
  const result = (success, difficulty, value, autoFail = false) => ({ success, difficulty, value, autoFail })
  assert.equal(holds('11757a', 0, state, { seat: 0, result: result(true, 3, 3) }), false)
  assert.equal(holds('11757a', 0, state, { seat: 0, result: result(false, 3, 2) }), false, '只低 1 点')
  assert.equal(holds('11757a', 0, state, { seat: 0, result: result(false, 3, 1) }), true)
  assert.equal(holds('11757a', 0, state, { seat: 1, result: result(false, 3, 1) }), false, '不是自己')
  assert.equal(holds('11757a', 0, state, { seat: 0, result: result(false, 3, 3, true) }), true, '自动失败')
  assert.equal(abilityOf('11757a', 0).cost.uses, 1)
})

test('11758a 未完成面：治愈调查员或盟友支援后移除 1 个义务（盟友特性判定）', () => {
  const state = makeState()
  const hasAlly = card => (card.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
  const allyCode = Object.values(ALL_CARDS).find(card => card.type === 'asset' && hasAlly(card)).code
  const nonAllyCode = Object.values(ALL_CARDS).find(card => card.type === 'asset' && !hasAlly(card)).code
  const ally = { id: 'ally-1', code: allyCode, originalCode: allyCode }
  state.investigators[0].assets.push(ally)
  const otherAsset = { id: 'asset-2', code: nonAllyCode, originalCode: nonAllyCode }
  state.investigators[0].assets.push(otherAsset)
  assert.equal(holds('11758a', 0, state, { seat: 0, assetId: null }), true, '治愈调查员')
  assert.equal(holds('11758a', 0, state, { seat: 1, assetId: null }), false, '治疗者不是自己')
  assert.equal(holds('11758a', 0, state, { seat: 0, assetId: 'ally-1' }), true, '治愈盟友支援')
  assert.equal(holds('11758a', 0, state, { seat: 0, assetId: 'asset-2' }), false, '非盟友支援')
  assert.equal(abilityOf('11758a', 0).cost.uses, 1)
})

test('11760a 未完成面：本地点最后一个线索被发现后移除 1 个痴迷', () => {
  const state = makeState()
  assert.equal(holds('11760a', 0, state, { seat: 0, lastClue: false }), false)
  assert.equal(holds('11760a', 0, state, { seat: 1, lastClue: true }), false)
  assert.equal(holds('11760a', 0, state, { seat: 0, lastClue: true }), true)
  assert.equal(abilityOf('11760a', 0).cost.uses, 1)
})

// ---------------------------------------------------------------------------
// 6. 数值验证：远征用品（11761 医疗 + 移敌、11762 取消诡计、11765 快速移动）
// ---------------------------------------------------------------------------
test('11761 远征装备：花费 1 补给治愈同地点 1 点伤害；移出游戏移动非精英敌人一次', () => {
  const state = makeState()
  const allySeat = { seat: 1, id: 'inv1', name: '测试员乙', location: 'locA', hand: [], assets: [], threat: [], resources: 5, damage: 2, defeated: false, resigned: false }
  state.investigators.push(allySeat)
  // 第 1 条：action + cost { action: 1, uses: 1 } → api.healDamage(seat, 1)
  const action = abilityOf('11761', 0)
  assert.equal(action.cost.action, 1)
  assert.equal(action.cost.uses, 1)
  const healed = runAbility('11761', 0, state, {}, { answers: ['0'] })
  assert.deepEqual(lastCall(healed.api, 'healDamage').args, [0, 1])

  // 第 2 条：[fast] 移出游戏 → 敌人沿连接移动一步。
  const enemy = { id: 'e1', name: '深潜者', code: '01167', location: 'locA', elite: false, exhausted: false }
  state.enemies.push(enemy)
  const fast = abilityOf('11761', 1)
  assert.equal(fast.cost.action, false)
  assert.equal(fast.cost.exileSelf, true)
  assert.equal(holds('11761', 1, state, {}), true)
  const moved = runAbility('11761', 1, state, {})
  assert.deepEqual(lastCall(moved.api, 'moveEnemy').args, [enemy, 'locB'])
  // 精英敌人不可选：没有合法目标时 criteria 为假。
  state.enemies[0].elite = true
  assert.equal(holds('11761', 1, state, {}), false)
})

test('11762 鸦片酊：花费 1 补给治愈 1 点恐惧；取消力量/恐怖诡计的显现并移出游戏', () => {
  const state = makeState()
  state.investigators[0].horror = 2
  const healed = runAbility('11762', 0, state, {})
  assert.deepEqual(lastCall(healed.api, 'healHorror').args, [0, 1])

  const reaction = abilityOf('11762', 1)
  assert.equal(reaction.cost.exileSelf, true)
  // 特性判定：Power / Terror 命中，其它特性或弱点不命中。
  assert.equal(holds('11762', 1, state, { cardCode: '11741', weakness: false }), true, '11741 是 Power')
  assert.equal(holds('11762', 1, state, { cardCode: '11739', weakness: false }), true, '11739 是 Terror')
  assert.equal(holds('11762', 1, state, { cardCode: '11741', weakness: true }), false)
  const context = { when: 'treachery', cardCode: '11741', cancellation: false }
  const cancelled = runAbility('11762', 1, state, context)
  assert.equal(context.cancelled, true, '取消走 context.cancelled')
  assert.equal(callsOf(cancelled.api, 'info').length >= 1, true)
})

test('11765 露比·斯坦迪什：同地点无重整敌人时横置移动到连接地点', () => {
  const state = makeState()
  assert.deepEqual(entryOf('11765').modifiers, [{ target: 'skill:agility', amount: 1 }])
  // 有重整敌人 → 不能移动。
  state.enemies.push({ id: 'e1', code: '01167', location: 'locA', elite: false, exhausted: false })
  assert.equal(holds('11765', 0, state, {}), false)
  // 敌人横置 → 可以移动。
  state.enemies[0].exhausted = true
  assert.equal(holds('11765', 0, state, {}), true)
  const { api } = runAbility('11765', 0, state, {})
  assert.deepEqual(lastCall(api, 'moveInvestigator').args, [0, 'locB'])
})

test('11766 安迪·范·诺特维克：本轮首次趁乱攻击可被忽略（需要按轮记账）', () => {
  const state = makeState()
  assert.deepEqual(entryOf('11766').modifiers, [{ target: 'skill:intellect', amount: 1 }])
  assert.equal(entryOf('11766').trackRoundActionHistory, true)
  assert.equal(holds('11766', 0, state, { firstThisRound: true, seat: 0 }), true)
  assert.equal(holds('11766', 0, state, { firstThisRound: false, seat: 0 }), false, '不是本轮首次')
  assert.equal(holds('11766', 0, state, { firstThisRound: true, seat: 1 }), false, '不是针对自己')
  state.locations[0].clues = 1
  assert.equal(holds('11766', 0, state, { firstThisRound: true, seat: 0 }), false, '本地点有线索')
  state.locations[0].clues = 0
  const context = { when: 'opportunityAttack', firstThisRound: true, seat: 0 }
  runAbility('11766', 0, state, context)
  assert.equal(context.cancelled, true)
})

test('11763 外星石板：处于检定期间（test.beforeCommit）时可 +2 待决加值', () => {
  const state = makeState()
  const ability = abilityOf('11763', 0)
  assert.equal(ability.kind, 'reaction')
  assert.deepEqual(ability.trigger, ['test.beforeCommit'])
  assert.equal(ability.duringOwnSkillTest, true)
  assert.equal(holds('11763', 0, state, { when: 'test.beforeCommit' }), false, '没有检定来源卡')
  state.skillTest = { seat: 0, source: { code: '11630' } } // 11630 Court Keeper：Glyph（= 卡文「符文」）
  assert.equal(holds('11763', 0, state, { when: 'test.beforeCommit' }), true)
  assert.equal(ability.cost.exhaust, true)
  assert.equal(ability.cost.uses, 1)
  const { api } = runAbility('11763', 0, state, { when: 'test.beforeCommit' })
  assert.deepEqual(lastCall(api, 'addPendingTestBonus').args, [2])
})

test('11757b 完成面：花费 1 个机会取消本次检定的标记（tokenEffectWouldResolve + context.cancelled）', () => {
  const entry = entryOf('11757b')
  assert.equal(entry.uses, 3)
  assert.equal(entry.usesType, 'chances')
  const ability = entry.abilities[0]
  assert.equal(ability.kind, 'reaction')
  assert.deepEqual([...ability.trigger], ['tokenEffectWouldResolve'])
  assert.equal(ability.cost.uses, 1)
  const state = makeState()
  const source = { id: 'chances', code: '11757b', originalCode: '11757b', uses: 3, usesType: 'chances' }
  const holdsWith = context => Boolean(ability.criteria({
    state, inv: state.investigators[0], source, context,
  }))
  assert.equal(holdsWith({ token: 'autofail', location: 'locA', seat: 0 }), false, 'autofail 不可取消')
  assert.equal(holdsWith({ token: 'skull', location: 'locB', seat: 0 }), false, '不在自己所在地点')
  assert.equal(holdsWith({ token: 'skull', location: 'locA', seat: 1 }), false, '不是自己的检定')
  assert.equal(holdsWith({ token: 'skull', location: 'locA', seat: 0 }), true, '符号标记可取消')
  assert.equal(holdsWith({ token: '-2', location: 'locA', seat: 0 }), true, '数值标记同样可取消')
  assert.equal(ability.criteria({ state, inv: state.investigators[0], source: { ...source, uses: 0 }, context: { token: 'skull', location: 'locA', seat: 0 } }), false,
    '机会用尽时不可取消')
  const context = { when: 'tokenEffectWouldResolve', token: '-2', location: 'locA', seat: 0 }
  const { api } = runAbility('11757b', 0, state, context, { source })
  assert.equal(context.cancelled, true, '取消通过 context.cancelled 生效')
  assert.equal(callsOf(api, 'info').length >= 1, true)
})

test('11757b（引擎）：tokenEffectWouldResolve 窗口按 criteria/cost 接线（autofail/异地点不可用，执行后花 1 机会并 cancelled）', () => {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  const task = { id: 'chances', code: '11757b', originalCode: '11757b', uses: 3, usesType: 'chances', exhausted: false }
  inv.assets = [task]
  const ability = entryOf('11757b').abilities[0]
  const context = { when: 'tokenEffectWouldResolve', seat: 0, location: inv.location, token: '-2' }
  assert.equal(descriptorUsable(state, inv, task, ability, { windowId: 'tokenEffectWouldResolve', context }), true,
    '非 autofail 标记在窗口内可用')
  assert.equal(descriptorUsable(state, inv, task, ability, {
    windowId: 'tokenEffectWouldResolve', context: { ...context, token: 'autofail' },
  }), false, 'autofail 不可取消')
  assert.equal(descriptorUsable(state, inv, task, ability, {
    windowId: 'tokenEffectWouldResolve', context: { ...context, location: 'elsewhere' },
  }), false, '不在自己所在地点不可用')
  const resolved = { ...context }
  assert.equal(executeDescriptor(state, {
    inv, source: task, descriptor: ability, context: resolved, events: [], silent: true, windowId: 'tokenEffectWouldResolve',
  }), true)
  assert.equal(resolved.cancelled, true, 'resolve 设置 context.cancelled')
  assert.equal(task.uses, 2, 'cost { uses: 1 } 扣 1 个机会')
})

test('11757b（引擎端到端）：单标记袋取消后不抛错、标记效果不结算、uses 3→2；autofail 不可取消', () => {
  const investigateWithCancel = (bag, withTask) => {
    const state = fixture('01001', 1)
    state.chaosBag = bag
    state.investigators[0].hand = []
    state.investigators[0].assets = []
    if (withTask) {
      state.investigators[0].assets.push({
        id: 'chances', code: '11757b', originalCode: '11757b', exhausted: false, uses: 3, usesType: 'chances',
      })
    }
    move(state, legalMoves(state, 0).find(item => item.action === 'investigate'))
    let used = false
    for (let i = 0; state.pendingChoice && i < 8; i += 1) {
      const choice = state.pendingChoice
      let optionId = null
      if (!used && choice.options.some(option => option.cardCode === '11757b')) {
        optionId = choice.options.find(option => option.cardCode === '11757b').id
        used = true
      }
      optionId ||= choice.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
        ?? choice.options[0].id
      answer(state, optionId)
    }
    return state
  }
  const logText = state => state.log.map(line => line.text || line).filter(text => typeof text === 'string').join('\n')
  const taskOf = state => state.investigators[0].assets.find(asset => asset.code === '11757b')

  // 单标记袋 ['-2']：取消后不得抛错、不得再抽标记、-2 效果不结算（智识 3 vs 未取消的 1）。
  const cancelled = investigateWithCancel(['-2'], true)
  assert.equal(taskOf(cancelled).uses, 2, '花 1 个机会')
  assert.match(logText(cancelled), /取消了 -2 的效果/, '标记效果被取消')
  assert.match(logText(cancelled), /调查成功（智识 3 vs 2）/, '-2 未计入检定值')
  const plain = investigateWithCancel(['-2'], false)
  assert.match(logText(plain), /调查失败（智识 1 vs 2，标记 -2）/, '未取消时 -2 正常结算（对照）')

  // autofail：11757b 不出现在候选、机会不消耗。
  const autoFail = investigateWithCancel(['autofail'], true)
  assert.equal(taskOf(autoFail).uses, 3, 'autofail 不可取消')
  assert.match(logText(autoFail), /自动失败/)
})

test('11758b 完成面：横置获得 1 资源；失败/无目标时不触发', () => {
  const state = makeState()
  assert.equal(holds('11758b', 0, state, { seat: 1, assetId: null }), false)
  assert.equal(holds('11758b', 0, state, { seat: 0, assetId: null }), true)
  assert.equal(abilityOf('11758b', 0).cost.exhaust, true)
  const { api } = runAbility('11758b', 0, state, { when: 'damageHealed', seat: 0, assetId: null, amount: 1 })
  assert.deepEqual(lastCall(api, 'gainResources').args, [0, 1])
})

test('11753b 完成面：额外一次行动（actions +1，仅移动为印刷限制）', () => {
  assert.deepEqual(entryOf('11753b').modifiers, [{ target: 'actions', amount: 1 }])
  assert.equal(entryOf('11753b').flags.task.extraActionLimit, 'move')
})

test('11756b 完成面：开局 +5 资源（条目级 startingResources）', () => {
  assert.equal(entryOf('11756b').startingResources, 5)
  assert.equal(entryOf('11756b').uses, null)
})

test('11759b 完成面：1 个额外法术槽位与理智上限 +2', () => {
  assert.deepEqual(entryOf('11759b').modifiers, [
    { target: 'add:slot', value: 'arcane', amount: 1 },
    { target: 'maxSanity', amount: 2 },
  ])
})

// ---------------------------------------------------------------------------
// 6b. 真实引擎（第四轮）：任务「游戏结束时标记 1 点进度」走引擎卡级 gameEnds 窗口
//     （hub.endCampaign → reactionWindow('gameEnds') → forced 条目自动结算）；
//     11756a「获得资源后放 1 个到本卡」走 resourcesGained 窗口 + 卡级 resources 写点。
//     引擎侧约束（Lead 已确认）：
//       · gameEnds 窗口内的**可选 reaction** 会受事务选择簿记限制，任务卡因此全部声明
//         `kind:'forced'`（自动结算，不询问）；
//       · resourcesGained 窗口当前只允许 forced 安全消费（可选 reaction 会触发
//         「未消费的选择恢复凭据」），11756a 的 [reaction] 因此写成 forced，可选性差异登记为近似。
// ---------------------------------------------------------------------------
const setupTaskState = (code, option, fields = {}) => {
  const state = fixture('01001', 1)
  state.campaign = {
    id: 'theDrownedCity',
    records: {},
    investigatorOrder: [0],
    progressTracks: {},
    scenarioResults: [],
    flow: { history: [] },
    investigators: [{ seat: 0, id: 'i0', code: '01001', name: '甲', status: 'active', deck: [code] }],
  }
  assert.equal(claimProgress(state.campaign, 'tdcTask', 0, option), true)
  const task = { id: `task-${code}`, code, originalCode: code, exhausted: false, ...fields }
  state.investigators[0].assets = [task]
  return { state, inv: state.investigators[0], task }
}
const fireCampaignEnds = state => endCampaign(state, [])
const taskProgressValue = state => progressFor(state.campaign, 'tdcTask', 0)?.value ?? 0

test('任务结局进度（引擎）：8 张任务在 endCampaign 的 gameEnds 窗口按印刷判定写入 tdcTask +1，重复收尾按 receipt 去重', () => {
  const metCases = [
    ['11753a', 'noPlaceLikeHome', { uses: 0 }],
    ['11754a', 'walkInFaith', { uses: 2 }],
    ['11755a', 'toeTheLine', { useTokens: { damage: 99 } }],
    ['11756a', 'goodMoney', { resources: 5 }],
    ['11757a', 'proveYourWorth', { uses: 1 }],
    ['11758a', 'doNoHarm', { uses: 0 }],
    ['11759a', 'dreamsOfDestruction', { useTokens: { horror: 99 } }],
    ['11760a', 'plumbTheDepths', { uses: 0 }],
  ]
  for (const [code, option, fields] of metCases) {
    const { state } = setupTaskState(code, option, fields)
    fireCampaignEnds(state)
    assert.equal(state.status, 'over', `${code} 战役收尾应正常完成`)
    assert.equal(taskProgressValue(state), 1, `${code} 条件满足时应写入 +1 进度`)
    fireCampaignEnds(state)
    assert.equal(taskProgressValue(state), 1, `${code} 重复收尾不得重复 +1（receipt 去重）`)
  }
})

test('任务结局进度（引擎）：条件不满足不写入；条件在收尾后改变也只在窗口内判定一次', () => {
  const unmetCases = [
    ['11753a', 'noPlaceLikeHome', { uses: 5 }],
    ['11754a', 'walkInFaith', { uses: 1 }],
    ['11755a', 'toeTheLine', { useTokens: { damage: 0 } }],
    ['11756a', 'goodMoney', { resources: 4 }],
    ['11757a', 'proveYourWorth', { uses: 0 }],
    ['11758a', 'doNoHarm', { uses: 2 }],
    ['11759a', 'dreamsOfDestruction', { useTokens: { horror: 0 } }],
    ['11760a', 'plumbTheDepths', { uses: 3 }],
  ]
  for (const [code, option, fields] of unmetCases) {
    const { state } = setupTaskState(code, option, fields)
    fireCampaignEnds(state)
    assert.equal(taskProgressValue(state), 0, `${code} 条件不满足时不得写入进度`)
  }
  // 未 claim 任务时窗口安静跳过、不抛错。
  const { state: noClaim } = (() => {
    const state = fixture('01001', 1)
    state.campaign = {
      id: 'theDrownedCity', records: {}, investigatorOrder: [0], progressTracks: {}, scenarioResults: [],
      flow: { history: [] },
      investigators: [{ seat: 0, id: 'i0', code: '01001', name: '甲', status: 'active', deck: ['11753a'] }],
    }
    state.investigators[0].assets = [{ id: 'task', code: '11753a', originalCode: '11753a', uses: 0 }]
    return { state }
  })()
  assert.equal(progressFor(noClaim.campaign, 'tdcTask', 0), null)
  fireCampaignEnds(noClaim)
  assert.equal(progressFor(noClaim.campaign, 'tdcTask', 0), null, '未 claim 时不写入进度')
})

test('11756a（引擎）：resourcesGained 窗口自动放 1 个资源到卡上（forced），并获得时按卡上资源判定结局进度', () => {
  const { state, inv, task } = setupTaskState('11756a', 'goodMoney', { resources: 0 })
  const ability = entryOf('11756a').abilities[0]
  assert.equal(ability.kind, 'forced', '引擎事务限制下 forced 才安全（可选性差异见 note/账本）')
  assert.deepEqual([...ability.trigger], ['resourcesGained'])
  const context = { when: 'resourcesGained', seat: 0, location: inv.location, amount: 2 }
  assert.equal(descriptorUsable(state, inv, task, ability, { windowId: 'resourcesGained', context }), true,
    'resourcesGained 窗口里条目能力应可用')
  // amount = 0 不满足印刷「获得 1 个或更多资源」。
  assert.equal(descriptorUsable(state, inv, task, ability, {
    windowId: 'resourcesGained', context: { ...context, amount: 0 },
  }), false)
  const before = inv.resources
  assert.equal(executeDescriptor(state, {
    inv, source: task, descriptor: ability, context, events: [], silent: true, windowId: 'resourcesGained',
  }), true)
  assert.equal(task.resources, 1, '卡级 resources 计数 +1')
  assert.equal(inv.resources, before - 1, '资源从资源池移 1 个到卡上（总数守恒）')

  // 全链路：用 02140「获得 2 资源」action 走 applyMove（resourcesGained 由此真实派发），
  // 事务提交后用状态里的实例复核（applyMove 会 clone 状态，不能持有旧引用）。
  const played = fixture('01001', 1)
  played.investigators[0].hand = []
  played.investigators[0].assets = []
  const income = asset(played, '02140', { id: 'income' })
  asset(played, '11756a', { id: 'gm', resources: 0 })
  const pockets = played.investigators[0].resources
  use(played, income)
  settle(played)
  const goodMoney = played.investigators[0].assets.find(item => item.code === '11756a')
  assert.equal(goodMoney.resources, 1, '真实获得资源后自动放 1 个到卡上')
  assert.equal(played.investigators[0].resources, pockets + 1, '获得 2、移 1 到卡上 → 净 +1')
})


test('11763（引擎）：检定期间（test.beforeCommit）真实窗口可用，横置+花 1 秘密给本次检定 +2', () => {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  const slate = { id: 'slate', code: '11763', originalCode: '11763', exhausted: false, uses: 4, usesType: 'secrets' }
  inv.assets = [slate]
  const ability = entryOf('11763').abilities[0]
  state.skillTest = { id: 'st-1', seat: 0, source: { code: '11630' } } // 11630 Court Keeper：Glyph
  state.timingWindow = 'test.beforeCommit'
  assert.equal(descriptorUsable(state, inv, slate, ability, { windowId: 'test.beforeCommit', context: { seat: 0 } }), true)
  assert.equal(executeDescriptor(state, {
    inv, source: slate, descriptor: ability, context: { seat: 0 }, events: [], silent: true, windowId: 'test.beforeCommit',
  }), true)
  assert.equal(slate.exhausted, true, '费用：横置')
  assert.equal(slate.uses, 3, '费用：花 1 个秘密')
  assert.equal(state.skillTest.pendingBonus, 2, '本次检定待决 +2')
  // 非符文/拉莱耶来源 → criteria 不成立。
  slate.exhausted = false
  slate.uses = 4
  state.skillTest = { id: 'st-2', seat: 0, source: { code: '01001' } }
  assert.equal(descriptorUsable(state, inv, slate, ability, { windowId: 'test.beforeCommit', context: { seat: 0 } }), false)
})

// ---------------------------------------------------------------------------
// saveReplay（CONTINUATION §2.1，第二轮）：真实 lib/sessions.js 落盘 → 读回 → 深比较 →
// 从读回状态续跑一个共享层动作，与从未存过档的同一起点结果做指纹比较。
//
// 共享层没有自己的章节 setup/manifest（任务/远征资产由章节 setup 发放），因此沿用本文件既有的
// makeState 夹具作为「真实对局状态」骨架，并在其中放入本 worker 领属的真实条目实例：
//   11753a（uses 8 discoveries）、11761（uses 3 supplies）+ 战役 tdcTask 进度轨；
// 续跑动作 = 远征装备 [action] 的印刷费用（1 行动 + 1 补给）与 resolve 写点（治疗同地点 1 点伤害）
// + 任务结局进度的真实 P7 原语 changeProgress（src/campaign/progress-tracks.js）。
// 说明：这里不断言引擎 dispatch 路径（validateMove+applyMove），因为共享层条目没有章节 dispatch
// 入口；引擎侧动作等价性由 Lead 的整局 replay/save 矩阵覆盖，本用例只证明存档往返 +
// 条目数据/进度状态恢复后行为确定。
// ---------------------------------------------------------------------------
test('共享层存档重放：任务/远征资产与 tdcTask 进度真实 saveSnapshot→readSnapshot 恢复等价，续跑动作确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  const home = mkdtempSync(path.join(os.tmpdir(), 'tdc-shared-save-'))
  process.env.DSH_HOME = home
  // 默认开启路径：不设置 BOARDGAME_PERSIST=0。
  delete process.env.BOARDGAME_PERSIST
  const sessionId = 'tdcSharedAssetsReplay'
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认必须开启')
    // 1) 真实对局状态 + 本 worker 条目实例 + 战役 tdcTask 进度轨。
    const state = makeState({
      campaign: {
        records: {},
        investigatorOrder: [0],
        investigators: [{ seat: 0, id: 'investigator-1', code: '01001', name: '测试员甲', status: 'active', deck: ['11753a', '11761'] }],
        progressTracks: {},
        scenarioResults: [],
      },
    })
    const inv = state.investigators[0]
    inv.damage = 2
    inv.assets = [
      { id: 'shared-task', code: '11753a', uses: 8, usesType: 'discoveries', exhausted: false },
      { id: 'shared-gear', code: '11761', uses: 3, usesType: 'supplies', exhausted: false },
    ]
    assert.equal(claimProgress(state.campaign, 'tdcTask', 0, 'noPlaceLikeHome'), true)
    assert.equal(changeProgress(state.campaign, 'tdcTask', 0, 1, 'taskEndOfGame11753a'), 1)

    // 2) 真实落盘：saveSnapshot → readSnapshot（lib/sessions.js，默认开启路径）。
    const file = saveSnapshot({
      sessionId,
      modId: 'arkhamhorror',
      state,
      players: [{ seat: 0, name: '测试员甲', investigatorId: 'investigator-1' }],
      events: [{ seq: 0, type: 'info', text: '共享层存档重放夹具' }],
      settings: { playerCount: 1, campaignId: 'theDrownedCity', difficulty: 'standard', seed: 'tdc-shared-assets-replay' },
    })
    assert.ok(existsSync(file), `存档文件应存在：${file}`)
    assert.ok(file.includes(path.join('boardgame-hall', 'sessions', 'arkhamhorror')),
      `存档应落 mod 子目录：${file}`)
    const restored = readSnapshot(sessionId)
    assert.ok(restored, `readSnapshot 返回 null；磁盘内容：${existsSync(file) ? readFileSync(file, 'utf8').slice(0, 500) : '缺失'}`)

    // 3) 读回状态与内存状态深度相等（JSON 规范化：undefined 归一）。
    const normalize = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalize(restored.session.state), normalize(state))
    assert.deepEqual(normalize(restored.session.state.campaign.progressTracks),
      normalize(state.campaign.progressTracks), 'tdcTask 进度轨必须随存档恢复')
    assert.equal(restored.modId, undefined)
    assert.equal(restored.session.modId, 'arkhamhorror')
    assert.equal(restored.session.sessionId, sessionId)

    // 4) 从读回状态续跑一个共享层动作：11761 [action] 费用 + 治疗写点；任务进度用 P7 原语推进。
    const restoredState = restored.session.state
    const runGearHeal = target => {
      const entry = registeredEntry('11761')
      const gear = target.investigators[0].assets.find(asset => asset.id === 'shared-gear')
      assert.equal(entry.abilities[0].cost.action, 1)
      assert.equal(entry.abilities[0].cost.uses, 1)
      gear.uses -= entry.abilities[0].cost.uses
      const api = makeApi()
      api.healDamage = (seat, amount) => {
        target.investigators[seat].damage = Math.max(0, target.investigators[seat].damage - amount)
      }
      entry.abilities[0].resolve({
        state: target, inv: target.investigators[0], seat: 0, source: gear, context: {}, events: [], api,
      })
    }
    const advance = target => {
      runGearHeal(target)
      changeProgress(target.campaign, 'tdcTask', 0, 1, 'gearHeal11761Round2')
    }
    advance(state)
    advance(restoredState)

    // 5) 两条路径结果一致（指纹 = 规范化 JSON）。
    const fingerprint = value => JSON.stringify(normalize(value))
    assert.equal(fingerprint(restoredState), fingerprint(state))
    // 关键字段再显式复核一次（避免指纹偶然相等）。
    assert.equal(restoredState.investigators[0].damage, 1)
    assert.equal(restoredState.investigators[0].assets.find(asset => asset.id === 'shared-gear').uses, 2)
    assert.equal(progressFor(restoredState.campaign, 'tdcTask', 0).value, 2)
    assert.deepEqual(
      normalize(restoredState.campaign.progressTracks),
      normalize(state.campaign.progressTracks))
  } finally {
    rmSync(home, { recursive: true, force: true })
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
  }
})
