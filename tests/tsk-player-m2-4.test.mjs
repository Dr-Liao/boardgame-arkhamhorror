// 《绯红密钥》（The Scarlet Keys）P6 M2-4 分片逐卡验收。
//
// 本文件覆盖 09102–09128 共 27 张一般玩家卡（含基础弱点 09124–09128）。
// 每张卡至少一条真实行为断言；缺引擎读点的子句以现有原语近似实现，并在对应单卡文件头
// 注释 / note 与测试标题中标注 approximation（详见各条目 note 与
// artifacts/migration/tsk/primitive-requests/<code>.json）。
//
// 约定（与 tests/eote-player-m2-4.test.mjs 相同）：
//   · 直接 import 单卡条目 + registerCardAbilities，不依赖 entries/index.js；
//   · 每次 move/applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · catalog-only 阶段事件卡不能走真实 play 入口，直接执行已注册的 played 描述符。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  applyHarm, drawCards, executeDescriptor, getStat, performTest, playCardFromDiscardForced, reactionWindow,
  slotUsage, playCost,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { customizationChecked } from '../src/engine/tsk-customizable.js'

import entry09102 from '../src/cards/entries/09102.js'
import entry09103 from '../src/cards/entries/09103.js'
import entry09104 from '../src/cards/entries/09104.js'
import entry09105 from '../src/cards/entries/09105.js'
import entry09106 from '../src/cards/entries/09106.js'
import entry09107 from '../src/cards/entries/09107.js'
import entry09108 from '../src/cards/entries/09108.js'
import entry09109 from '../src/cards/entries/09109.js'
import entry09110 from '../src/cards/entries/09110.js'
import entry09111 from '../src/cards/entries/09111.js'
import entry09112 from '../src/cards/entries/09112.js'
import entry09113 from '../src/cards/entries/09113.js'
import entry09114 from '../src/cards/entries/09114.js'
import entry09115 from '../src/cards/entries/09115.js'
import entry09116 from '../src/cards/entries/09116.js'
import entry09117 from '../src/cards/entries/09117.js'
import entry09118 from '../src/cards/entries/09118.js'
import entry09119 from '../src/cards/entries/09119.js'
import entry09120 from '../src/cards/entries/09120.js'
import entry09121 from '../src/cards/entries/09121.js'
import entry09122 from '../src/cards/entries/09122.js'
import entry09123 from '../src/cards/entries/09123.js'
import entry09124 from '../src/cards/entries/09124.js'
import entry09125 from '../src/cards/entries/09125.js'
import entry09126 from '../src/cards/entries/09126.js'
import entry09127 from '../src/cards/entries/09127.js'
import entry09128 from '../src/cards/entries/09128.js'

const ENTRIES = [
  entry09102, entry09103, entry09104, entry09105, entry09106, entry09107, entry09108, entry09109,
  entry09110, entry09111, entry09112, entry09113, entry09114, entry09115, entry09116, entry09117,
  entry09118, entry09119, entry09120, entry09121, entry09122, entry09123, entry09124, entry09125,
  entry09126, entry09127, entry09128,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const CODES = []
for (let index = 102; index <= 128; index++) CODES.push(`09${index}`)

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 160; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

function resolveChoices(state, choose = () => null, limit = 160) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

const pickOption = pattern => pending => {
  const option = pending.options.find(item => pattern.test(String(item.label || '')))
  return option ? option.id : null
}

const choices = (...selectors) => pending => {
  for (const select of selectors) {
    const result = select?.(pending)
    if (result != null) return result
  }
  return null
}

function runDescriptor(state, code, kind, { context = {}, choose = null, source = null } = {}) {
  const descriptor = registeredEntry(code)?.abilities?.find(ability => ability.kind === kind)
  assert.ok(descriptor, `${code} 缺少 ${kind} 描述符`)
  const inv = state.investigators[0]
  runTest(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0],
    source: source || { id: `probe:${code}`, code },
    descriptor, events: [], context, silent: false,
  }), choose)
  return descriptor
}

const resolvePlayed = (state, code, extra = {}) => (typeof extra === 'function'
  ? runDescriptor(state, code, 'played', { choose: extra })
  : runDescriptor(state, code, 'played', extra))

// catalog-only 阶段的弱点事件不能进 legalMoves（runtimeCardAvailable=false），
// 用引擎的「从弃牌堆强制打出」管线执行同一条 doPlay（真实费用、描述子与去向）。
function playForced(state, code) {
  runTest(state, draft => {
    draft.investigators[0].discard.push(code)
    playCardFromDiscardForced(draft, 0, code, [], { exileAfter: false })
  })
}

// 把「显现」类手牌事件放进手牌并模拟抽到它的 cardDrawn 窗口。
function revealFromHand(state, code, choose = null) {
  const inv = state.investigators[0]
  if (!inv.hand.includes(code)) inv.hand.push(code)
  runDescriptor(state, code, 'forced', {
    context: { when: 'cardDrawn', cardCode: code, seat: inv.seat, location: inv.location },
    choose,
  })
}

const reactWindowProbe = (draft, context) => reactionWindow(draft, context.when, context, [])

// ---------------------------------------------------------------------------
// 09102 死神偶像
// ---------------------------------------------------------------------------

test('P6 09102 死神偶像：受到伤害时横置并弃 2 张手牌，取消 2 点伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['01088', '01025', '01031']
  const idol = asset(state, '09102')
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 2, 0, []) },
    choices(pickOption(/死神偶像/), pickOption(/弃 2 张/), pickOption(/取消 2 伤害/)))
  const inv = state.investigators[0]
  assert.equal(inv.damage, 0, '2 点伤害全部被取消')
  assert.equal(inv.assets.find(item => item.id === idol.id).exhausted, true, '死神偶像横置')
  assert.equal(inv.hand.length, 1, '弃掉 2 张手牌')
})

test('P6 09102 死神偶像：没有手牌时不提供反应', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  asset(state, '09102')
  let offered = false
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 1, 0, []) }, pending => {
    if (pending.options.some(item => /死神偶像/.test(String(item.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '没有手牌可弃时不能取消')
  assert.equal(state.investigators[0].damage, 1, '伤害正常结算')
})

// ---------------------------------------------------------------------------
// 09103 临时盾牌
// ---------------------------------------------------------------------------

test('P6 09103 临时盾牌：被击败时洗回牌库而不是弃掉', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].discard = []
  const shield = asset(state, '09103', { damage: 2 })
  runTest(state, draft => {
    draft.investigators[0].assets[0].damage = 2
    applyHarm(draft, draft.investigators[0], 1, 0, [], false, null, true)
  })
  const inv = state.investigators[0]
  assert.equal(inv.assets.some(item => item.id === shield.id), false, '临时盾牌已离场')
  assert.equal(inv.discard.includes('09103'), false, '没有进入弃牌堆')
  assert.ok(inv.deck.includes('09103'), '改为洗回牌库')
  assert.equal(registeredEntry('09103').playableFromDiscard, true)
  assert.equal(registeredEntry('09103').playableOnlyFromDiscard, true)
})

// ---------------------------------------------------------------------------
// 09104 道路尽头
// ---------------------------------------------------------------------------

test('P6 09104 道路尽头：最终密谋在场时打出，抽 1、+1 资源、+1 行动', () => {
  const state = fixture('01001')
  state.phase = 'investigation'
  state.currentSeat = 0
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.agendas = [{ code: 'a1', name: '密谋一', doom: 0 }, { code: 'a2', name: '最终密谋', doom: 0 }]
  state.agendaIndex = 1
  const conditions = registeredEntry('09104').playCondition
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), true, '最终密谋在场时可打出')
  const before = {
    hand: state.investigators[0].hand.length,
    resources: state.investigators[0].resources,
    actions: state.investigators[0].actionsLeft,
  }
  resolvePlayed(state, '09104')
  const inv = state.investigators[0]
  assert.equal(inv.hand.length, before.hand + 1, '抽 1 张牌')
  assert.equal(inv.resources, before.resources + 1, '获得 1 资源')
  assert.equal(inv.actionsLeft, before.actions + 1, '获得 1 个额外行动')
  assert.equal(registeredEntry('09104').abilities.find(item => item.kind === 'played').exileAfterPlay, true, '打出后移出游戏')
  state.agendaIndex = 0
  assert.equal(conditions.every(item => item.when({ state, inv })), false, '非最终密谋时不能打出')
})

// ---------------------------------------------------------------------------
// 09105 直击弱点
// ---------------------------------------------------------------------------

test('P6 09105 直击弱点：难度 0 的攻击检定自动成功并弃掉非精英敌人', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const target = enemy(state, { fight: 1, health: 10, engagedSeat: 0 })
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 0, stage: 'ST.4', committed: [], drawn: [],
    actionKind: 'fight', target: { kind: 'enemy', id: target.id } }
  resolvePlayed(state, '09105')
  assert.equal(state.skillTest.autoSuccess, true, '本次检定自动成功')
  assert.equal(state.enemies.some(item => item.id === target.id), false, '非精英敌人被弃掉')
})

test('P6 09105 直击弱点：精英改为自动躲避并造成 3 点伤害；难度不为 0 时不可用', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const elite = enemy(state, { fight: 1, health: 20, elite: true, engagedSeat: 0 })
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 0, stage: 'ST.4', committed: [], drawn: [],
    actionKind: 'fight', target: { kind: 'enemy', id: elite.id } }
  resolvePlayed(state, '09105')
  const after = state.enemies.find(item => item.id === elite.id)
  assert.equal(after.exhausted, true, '精英被自动躲避')
  assert.equal(after.damageTaken, 3, '精英受到 3 点伤害')
  const descriptor = registeredEntry('09105').abilities.find(item => item.kind === 'played')
  state.skillTest.difficulty = 2
  assert.equal(descriptor.criteria[0]({ state, inv: state.investigators[0] }), false, '难度不为 0 时 criteria 不成立')
})

// ---------------------------------------------------------------------------
// 09106 整装待发
// ---------------------------------------------------------------------------

test('P6 09106 整装待发：显现选择两项技能，所有调查员所选 +1、其余 -1', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const before = { willpower: getStat(state, state.investigators[0], 'willpower'),
    combat: getStat(state, state.investigators[0], 'combat') }
  revealFromHand(state, '09106', choices(pickOption(/^意志$/), pickOption(/^敏捷$/)))
  const inv = state.investigators[0]
  assert.equal(inv.hand.includes('09106'), false, '结算后进入弃牌堆')
  assert.equal(inv.discard.includes('09106'), true)
  assert.equal(getStat(state, inv, 'willpower'), before.willpower + 1, '所选意志 +1')
  assert.equal(getStat(state, inv, 'combat'), before.combat - 1, '未选战斗 -1')
  assert.ok((state.effects || []).some(effect => effect.sourceCode === '09106' && effect.duration === 'endOfPhase'))
})

test('P6 09106 整装待发：从牌库抽到时自动结算显现（真实 cardDrawn 窗口）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.investigators[0].deck = ['09106']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) },
    choices(pickOption(/^意志$/), pickOption(/^敏捷$/)))
  const inv = state.investigators[0]
  assert.equal(inv.hand.includes('09106'), false, '抽到后立即结算并离开手牌')
  assert.equal(inv.discard.includes('09106'), true)
  assert.ok((state.effects || []).some(effect => effect.sourceCode === '09106'), '显现效果已写入')
})

// ---------------------------------------------------------------------------
// 09107 猎人还是猎物
// ---------------------------------------------------------------------------

test('P6 09107 猎人还是猎物：场上没有敌人时抽 1 张', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.enemies = []
  const before = state.investigators[0].hand.length
  revealFromHand(state, '09107')
  const inv = state.investigators[0]
  assert.equal(inv.hand.length, before + 1, '抽 1 张牌（09107 结算后进弃牌堆）')
  assert.equal(inv.discard.includes('09107'), true)
})

test('P6 09107 猎人还是猎物：未交战非精英敌人朝最近的调查员移动一次', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'], clues: 0 },
    { id: 'b', name: 'B', revealed: true, connections: ['a'], clues: 0 },
  ]
  state.investigators[0].location = 'a'
  const stalker = enemy(state, { location: 'b', engagedSeat: null, elite: false, fight: 1 })
  revealFromHand(state, '09107', pickOption(/朝最近的调查员移动/))
  assert.equal(state.enemies.find(item => item.id === stalker.id).location, 'a', '敌人向调查员移动一步')
})

test('P6 09107 猎人还是猎物：调查员解除交战并远离最近的敌人移动一次', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'], clues: 0 },
    { id: 'b', name: 'B', revealed: true, connections: ['a'], clues: 0 },
  ]
  state.investigators[0].location = 'a'
  const engaged = enemy(state, { location: 'a', engagedSeat: 0, fight: 1 })
  revealFromHand(state, '09107', pickOption(/解除交战/))
  const inv = state.investigators[0]
  assert.equal(inv.location, 'b', '调查员远离敌人移动到连接地点')
  assert.deepEqual(inv.engaged, [], '与敌人解除交战')
  assert.equal(state.enemies.find(item => item.id === engaged.id).engagedSeat, null)
})

// ---------------------------------------------------------------------------
// 09108 拨云见日
// ---------------------------------------------------------------------------

test('P6 09108 拨云见日：难度 0 的调查检定自动成功，两个地点各额外发现 1 线索', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'], clues: 1, shroud: 0 },
    { id: 'b', name: 'B', revealed: true, connections: ['a'], clues: 1, shroud: 0 },
  ]
  state.investigators[0].location = 'a'
  state.skillTest = { seat: 0, skill: 'intellect', difficulty: 0, stage: 'ST.4', committed: [], drawn: [],
    actionKind: 'investigate' }
  resolvePlayed(state, '09108')
  assert.equal(state.skillTest.autoSuccess, true, '本次检定自动成功')
  assert.equal(state.locations.find(item => item.id === 'a').clues, 0, '本地点发现 1 个线索')
  assert.equal(state.locations.find(item => item.id === 'b').clues, 0, '任意地点发现 1 个线索')
})

// ---------------------------------------------------------------------------
// 09109 抉择时刻
// ---------------------------------------------------------------------------

test('P6 09109 抉择时刻：所选调查员失去 1 行动并抽 3 张', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  const before = state.investigators[0].actionsLeft
  revealFromHand(state, '09109', pickOption(/失去 1 个行动/))
  const inv = state.investigators[0]
  assert.equal(inv.actionsLeft, before - 1, '失去 1 个行动')
  assert.equal(inv.hand.length, 3, '抽 3 张牌（09109 自身结算后进弃牌堆）')
  assert.equal(inv.discard.includes('09109'), true)
})

test('P6 09109 抉择时刻：立即进行一次行动后随机弃 1 张手牌', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['01088', '01025', '01031']
  const before = state.investigators[0].resources
  revealFromHand(state, '09109', choices(pickOption(/立即进行一次行动/), pickOption(/获得 1 资源/)))
  const inv = state.investigators[0]
  assert.equal(inv.resources, before + 1, '立即行动执行了「获得 1 资源」')
  assert.equal(inv.hand.length, 3, '立即行动后随机弃 1 张手牌（09109 自身另进弃牌堆；随机弃牌可能弃到它）')
  assert.ok(inv.discard.length >= 1, '至少 1 张牌进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 09110 救生索
// ---------------------------------------------------------------------------

test('P6 09110 救生索：获得 1 个额外行动并放逐；每回合只能打出 1 张', () => {
  const state = fixture('01001')
  state.phase = 'investigation'
  state.currentSeat = 0
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  const before = state.investigators[0].actionsLeft
  const descriptor = registeredEntry('09110').abilities.find(item => item.kind === 'played')
  assert.equal(descriptor.exileAfterPlay, true, '打出后放逐')
  const conditions = registeredEntry('09110').playCondition
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), true, '自己回合可打出')
  resolvePlayed(state, '09110')
  assert.equal(state.investigators[0].actionsLeft, before + 1, '获得 1 个额外行动（X 近似为 1）')
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), false, '同一回合不能再打出')
})

// ---------------------------------------------------------------------------
// 09111 野兽本性
// ---------------------------------------------------------------------------

test('P6 09111 野兽本性：揭示遭遇牌库顶 3 张，抽 1 张、弃其余，并发现 1 个线索', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [], clues: 2, shroud: 2 }]
  state.investigators[0].location = 'a'
  state.encounterDeck = ['ancientEvils', 'ancientEvils', 'ancientEvils']
  state.encounterDiscard = []
  state.chaosBag = ['+3']
  revealFromHand(state, '09111', pickOption(/第 1 张/))
  assert.equal(state.encounterDeck.length, 0, '3 张全部离开遭遇牌库')
  assert.equal(state.encounterDiscard.length, 3, '抽到的 1 张结算后与其余 2 张都在遭遇弃牌堆')
  assert.equal(state.locations[0].clues, 1, '发现 1 个线索')
})

// ---------------------------------------------------------------------------
// 09112 主动出击
// ---------------------------------------------------------------------------

test('P6 09112 主动出击：可投入任意检定，并使本次检定难度 -2', () => {
  // catalog-only 阶段：runtimeCardAvailable 会挡住投入候选，因此按「检定档案 + onCommit 契约」
  // 验证（引擎在真实投入时以同一份 api 调用 onCommit）。
  const state = fixture('01001')
  state.investigators[0].assets = []
  const profile = registeredEntry('09112').abilities.find(item => item.kind === 'commit').skill
  assert.equal(profile.anySkill, true, '没有印刷图标也能投入任意检定')
  assert.equal(profile.maxPerTest, 1, '每次检定最多投入 1 张')
  let reduced = 0
  profile.onCommit({ api: { reduceTestDifficulty: amount => { reduced += amount } } })
  assert.equal(reduced, 2, '投入后本次检定难度 -2')
  state.chaosBag = ['0']
  runTest(state, draft => { performTest(draft, 0, 'willpower', 3) })
  assert.equal(state.lastTestResult?.difficulty, 3, '未投入时不减难度（对照）')
})

// ---------------------------------------------------------------------------
// 09113 棒球棒
// ---------------------------------------------------------------------------

test('P6 09113 棒球棒：+2 战斗 +1 伤害；骷髅时选择额外 +1 伤害并弃掉', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const bat = asset(state, '09113')
  const target = enemy(state, { fight: 1, health: 30, engagedSeat: 0 })
  state.chaosBag = ['skull']
  move(state, { action: 'ability', assetId: bat.id, abilityIndex: 0, targetId: target.id })
  resolveChoices(state, pickOption(/额外 \+1 伤害/))
  const inv = state.investigators[0]
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3, '基础 1 + 卡面 1 + 额外 1')
  assert.equal(inv.assets.some(item => item.id === bat.id), false, '棒球棒被弃掉')
  assert.ok(inv.discard.includes('09113'))
})

test('P6 09113 棒球棒：没有骷髅/自动失败时只造成 +1 伤害，棒球棒留在场上', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const bat = asset(state, '09113')
  const target = enemy(state, { fight: 1, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: bat.id, abilityIndex: 0, targetId: target.id })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 卡面 1')
  assert.equal(inv.assets.some(item => item.id === bat.id), true, '棒球棒留在场上')
})

// ---------------------------------------------------------------------------
// 09114 卡蒂亚·伊斯特班克
// ---------------------------------------------------------------------------

test('P6 09114 卡蒂亚：抽到非弱点牌时横置，把该牌放到她底下并抽 1 张替代', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const katja = asset(state, '09114')
  state.investigators[0].hand = []
  state.investigators[0].deck = ['01025', '01088']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) }, pickOption(/卡蒂亚/))
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === katja.id).exhausted, true, '卡蒂亚横置')
  assert.deepEqual(inv.assets.find(item => item.id === katja.id).attachments.map(item => item.code), ['01088'], '01088 放在她底下')
  assert.deepEqual(inv.hand, ['01025'], '抽 1 张替代（01025）')
})

test('P6 09114 卡蒂亚：[action] 抽取她底下的任意一张卡牌', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const katja = asset(state, '09114')
  state.investigators[0].hand = []
  state.investigators[0].deck = ['01025', '01088']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) }, pickOption(/卡蒂亚/))
  move(state, { action: 'ability', assetId: katja.id, abilityIndex: 0 })
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('01088'), '取回她底下的 01088')
  assert.deepEqual(inv.assets.find(item => item.id === katja.id).attachments, [], '底下已清空')
})

// ---------------------------------------------------------------------------
// 09115 随心而动
// ---------------------------------------------------------------------------

test('P6 09115 随心而动：三堆选一堆，每位调查员抽取该堆自己的牌，其余移出游戏', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.investigators[0].deck = ['01088', '01025', '01031', '01041']
  revealFromHand(state, '09115', pickOption(/第 1 堆/))
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('01041'), '抽到第 1 堆的牌（牌库顶）')
  assert.equal(inv.deck.length, 1, '其余牌离开牌库')
  assert.ok(state.exiled.includes('01031') && state.exiled.includes('01025'), '其余两堆的非弱点牌移出游戏')
})

// ---------------------------------------------------------------------------
// 09116 修旧利废
// ---------------------------------------------------------------------------

test('P6 09116 修旧利废：把弃牌堆的[[道具]]支援移出游戏并获得等于其费用的资源', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].discard = ['01020']
  state.investigators[0].resources = 0
  resolvePlayed(state, '09116')
  const inv = state.investigators[0]
  assert.equal(inv.discard.includes('01020'), false, '支援离开弃牌堆')
  assert.ok(state.exiled.includes('01020'), '支援移出游戏')
  assert.equal(inv.resources, 3, '获得等于费用（3）的资源')
})

test('P6 09116 修旧利废：支付费用打出弃牌堆的[[道具]]支援', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].discard = ['01020']
  state.investigators[0].resources = 5
  resolvePlayed(state, '09116', pickOption(/支付 3 资源打出/))
  const inv = state.investigators[0]
  assert.ok(inv.assets.some(item => item.code === '01020'), '大砍刀进入场上')
  assert.equal(inv.resources, 2, '支付 3 资源')
  assert.equal(inv.discard.includes('01020'), false, '离开弃牌堆')
})

// ---------------------------------------------------------------------------
// 09117 陈旧的钥匙圈
// ---------------------------------------------------------------------------

test('P6 09117 陈旧的钥匙圈：调查隐藏值 -2，成功后移除 1 钥匙，难度 0 额外发现 1 线索', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [], clues: 2, shroud: 2 }]
  state.investigators[0].location = 'a'
  const ring = asset(state, '09117', { uses: 3, usesType: 'keys' })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: ring.id, abilityIndex: 0 })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.difficulty, 0, '隐藏值 2 - 2 = 0')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(inv.assets.find(item => item.id === ring.id).uses, 2, '成功移除 1 钥匙')
  assert.equal(state.locations[0].clues, 0, '通常发现 1 个 + 难度 0 额外 1 个')
})

// ---------------------------------------------------------------------------
// 09118 命运无常
// ---------------------------------------------------------------------------

test('P6 09118 命运无常：放置 1 毁灭，每位调查员治愈 3 伤害与 3 恐惧', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].damage = 2
  state.investigators[0].horror = 1
  state.agendas = [{ code: 'a1', name: '密谋', doom: 1 }]
  state.agendaIndex = 0
  state.doom = 1
  revealFromHand(state, '09118', pickOption(/放置 1 毁灭/))
  const inv = state.investigators[0]
  assert.equal(state.doom, 2, '当前密谋 +1 毁灭')
  assert.equal(inv.damage, 0, '治愈 3 点伤害（只有 2 点）')
  assert.equal(inv.horror, 0, '治愈 3 点恐惧（只有 1 点）')
})

test('P6 09118 命运无常：移除 1 毁灭，每位调查员受到 1 直接伤害与 1 直接恐惧，本卡移出游戏', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].damage = 0
  state.investigators[0].horror = 0
  state.agendas = [{ code: 'a1', name: '密谋', doom: 1 }]
  state.agendaIndex = 0
  state.doom = 1
  revealFromHand(state, '09118', pickOption(/移除 1 毁灭/))
  const inv = state.investigators[0]
  assert.equal(state.doom, 0, '当前密谋 -1 毁灭')
  assert.equal(inv.damage, 1, '受到 1 点直接伤害')
  assert.equal(inv.horror, 1, '受到 1 点直接恐惧')
  assert.ok(state.exiled.includes('09118'), '命运无常移出游戏')
})

// ---------------------------------------------------------------------------
// 09119 超自然发射器
// ---------------------------------------------------------------------------

test('P6 09119 超自然发射器：已解锁形态可切换，轨道射击具象攻击 +1 伤害', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { '09119': [0, 1] } } } }
  const gun = asset(state, '09119')
  const target = enemy(state, { fight: 1, health: 20, engagedSeat: 0 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: gun.id, abilityIndex: 1 })
  resolveChoices(state, pickOption(/轨道射击/))
  assert.ok((state.effects || []).some(effect => effect.label === 'shotcaster:form:Railshooter'), '当前形态记为轨道射击')
  move(state, { action: 'ability', assetId: gun.id, abilityIndex: 0 })
  resolveChoices(state, pickOption(/^意志$/))
  const inv = state.investigators[0]
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '具象攻击造成 +1 伤害')
  assert.equal(inv.assets.find(item => item.id === gun.id).uses, 3, '花费 1 以太')
})

test('P6 09119 超自然发射器：以太连接（勾选）入场时额外 +2 以太', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { '09119': [5] } } } }
  const gun = asset(state, '09119')
  const descriptor = registeredEntry('09119').abilities.find(item => item.kind === 'entersPlay')
  runTest(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0],
    source: draft.investigators[0].assets.find(item => item.id === gun.id),
    descriptor, events: [], context: {}, silent: false,
  }))
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id).uses, 6, '4 + 2 以太')
  assert.equal(registeredEntry('09119').customizationOptions.length, 7, '七个定制选项全部声明')
})

// ---------------------------------------------------------------------------
// 09120 工具带
// ---------------------------------------------------------------------------

test('P6 09120 工具带：附属的[[工具]]支援不占用槽位', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const belt = asset(state, '09120')
  const tool = asset(state, '09117')
  assert.equal(slotUsage(state.investigators[0]).hand || 0, 1, '工具原本占用手槽')
  move(state, { action: 'ability', assetId: belt.id, abilityIndex: 0 })
  resolveChoices(state, pickOption(/钥匙圈/))
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === tool.id).attachedToAsset, belt.id, '工具附属到工具带')
  assert.equal(slotUsage(inv).hand || 0, 0, '附属的工具不占槽位')
})

// ---------------------------------------------------------------------------
// 09121 精益求精
// ---------------------------------------------------------------------------

test('P6 09121 精益求精：额外花 1 行动，立刻勾选定制卡的一个方框', () => {
  const state = fixture('01001')
  state.phase = 'investigation'
  state.currentSeat = 0
  state.investigators[0].assets = []
  state.investigators[0].hand = ['09119']
  state.investigators[0].actionsLeft = 5
  const conditions = registeredEntry('09121').playCondition
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), true, '拥有定制卡且行动足够')
  resolvePlayed(state, '09121', pickOption(/Railshooter|轨道射击/))
  assert.deepEqual(customizationChecked(state, 0, '09119'), [0], '勾选了第一个方框')
  assert.equal(state.campaign.records['refine:0'], true, '每场游戏一次记账')
  assert.equal(state.investigators[0].actionsLeft, 4, '额外花费 1 个行动')
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), false, '同一场游戏不能再用')
})

// ---------------------------------------------------------------------------
// 09122 手电筒
// ---------------------------------------------------------------------------

test('P6 09122 手电筒：调查检定开始时花费 1 补给，难度 -2', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const torch = asset(state, '09122', { uses: 4, usesType: 'supplies' })
  state.chaosBag = ['0']
  runTest(state, draft => { performTest(draft, 0, 'intellect', 2, { actionKind: 'investigate' }) },
    pickOption(/手电筒/))
  assert.equal(state.lastTestResult?.difficulty, 0, '难度 2 - 2 = 0')
  assert.equal(state.investigators[0].assets.find(item => item.id === torch.id).uses, 3, '花费 1 补给')
})

test('P6 09122 手电筒：非调查/躲避检定不提供反应', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const torch = asset(state, '09122', { uses: 4, usesType: 'supplies' })
  state.chaosBag = ['0']
  let offered = false
  runTest(state, draft => { performTest(draft, 0, 'willpower', 1) }, pending => {
    if (pending.options.some(item => /手电筒/.test(String(item.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '意志检定不触发手电筒')
  assert.equal(state.investigators[0].assets.find(item => item.id === torch.id).uses, 4)
})

// ---------------------------------------------------------------------------
// 09123 灵魂封圣
// ---------------------------------------------------------------------------

test('P6 09123 灵魂封圣：检定期间花费 1 贡品，本次检定 +2 技能值', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  const relic = asset(state, '09123', { uses: 1, usesType: 'offerings' })
  state.chaosBag = ['0']
  const base = getStat(state, state.investigators[0], 'willpower')
  runTest(state, draft => { performTest(draft, 0, 'willpower', 1) }, pickOption(/灵魂封圣/))
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.value, base + 2, '本次检定 +2 技能值')
  assert.equal(inv.assets.find(item => item.id === relic.id).uses, 0, '花费 1 贡品')
})

// ---------------------------------------------------------------------------
// 09124 暗处潜伏者
// ---------------------------------------------------------------------------

test('P6 09124 暗处潜伏者：显现时在任意连接地点生成，猎手关键词生效', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b', 'c'], clues: 0 },
    { id: 'b', name: 'B', revealed: true, connections: ['a'], clues: 0 },
    { id: 'c', name: 'C', revealed: true, connections: ['a'], clues: 0 },
  ]
  state.investigators[0].location = 'a'
  state.investigators[0].deck = ['09124']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) }, pickOption(/^B$/))
  const lurker = state.enemies.find(item => item.code === '09124')
  assert.ok(lurker, '暗处潜伏者生成')
  assert.equal(lurker.location, 'b', '生成在所选连接地点')
  assert.equal(lurker.engagedSeat, null, '生成在连接地点时不与调查员交战')
  assert.equal(lurker.hunter, true, '猎手关键词')
})

test('P6 09124 暗处潜伏者：只能被武器支援/策略事件攻击（徒手攻击被来源限制阻止）', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [], clues: 0 }]
  state.investigators[0].location = 'a'
  state.investigators[0].deck = ['09124']
  state.investigators[0].engaged = []
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  const lurker = state.enemies.find(item => item.code === '09124')
  assert.ok(lurker, '弱点敌人生成')
  lurker.location = 'a'
  lurker.engagedSeat = 0
  state.investigators[0].engaged = [lurker.id]
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: lurker.id })
  resolveChoices(state)
  // 2026-11-13 P1-8：enemyRule.damageOnlyFromSourceTraits 已接线——徒手（无武器/策略来源）攻击
  // 在 combat.js 的入口被阻止，因此不会产生战斗检定结果，也不会造成伤害。
  assert.equal(state.lastTestResult ?? null, null, '徒手攻击应被来源特质限制阻止（不产生检定结果）')
  assert.equal(state.enemies.find(item => item.id === lurker.id).damageTaken, 0, '不会造成伤害')
})

// ---------------------------------------------------------------------------
// 09125 量子悖论
// ---------------------------------------------------------------------------

test('P6 09125 量子悖论：弱点留在手中，回合结束时揭示并受到 1 点恐惧', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.investigators[0].deck = ['09125']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('09125'), '量子悖论留在手中')
  assert.equal(inv.threat.length, 0, '没有进入威胁区域')
  move(state, { action: 'endTurn' })
  resetChoices(state)
  assert.equal(state.investigators[0].horror, 1, '回合结束受到 1 点恐惧')
})

test('P6 09125 量子悖论：手牌 ≥5 时可打出并额外弃 4 张', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['01088', '01025', '01031', '01041']
  state.investigators[0].resources = 3
  const conditions = registeredEntry('09125').playCondition
  state.investigators[0].hand = ['09125', '01088', '01025', '01031', '01041']
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), true, '手牌 5 张时可打出')
  assert.equal(registeredEntry('09125').playableWeakness, true, '弱点可打出的唯一许可')
  state.investigators[0].hand = ['01088', '01025', '01031', '01041']
  playForced(state, '09125')
  const inv = state.investigators[0]
  assert.equal(inv.hand.length, 0, '额外弃掉 4 张其它手牌')
  assert.ok(inv.discard.includes('09125'), '量子悖论进入弃牌堆')
  assert.equal(inv.discard.filter(code => code !== '09125').length, 4, '额外弃掉 4 张')
})

// ---------------------------------------------------------------------------
// 09126 该付账了
// ---------------------------------------------------------------------------

test('P6 09126 该付账了：用额外行动把 10 费降到 0 后打出', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.investigators[0].resources = 0
  state.investigators[0].actionsLeft = 3
  const modifier = registeredEntry('09126').playCostModifier({ state, inv: state.investigators[0], card: ALL_CARDS['09126'] })
  assert.equal(modifier, -10, '2 个额外行动 = -10 费')
  assert.equal(playCost(state, state.investigators[0], ALL_CARDS['09126']), 0, '实际费用为 0')
  playForced(state, '09126')
  const inv = state.investigators[0]
  assert.equal(inv.actionsLeft, 0, '打出花 1 行动，另花 2 个额外行动')
  assert.ok(inv.discard.includes('09126'), '该付账了被弃掉')
})

test('P6 09126 该付账了：回合结束时若在手牌，揭示并受到 1 点伤害', () => {
  // 2026-11-13 P0：抽到后留手 + 回合结束 1 伤害改由引擎读点实现
  // （weaknessStaysInHand + endTurnInHandDamage，见 turn-flow.js#advanceInvestigator）。
  // 之前用条目级 fromHand 强制能力，真实对局里根本没有派发点；真实引擎回归在
  // tests/tsk-p0-regressions.test.mjs（debug 抽牌 + endTurn）。
  const entry = registeredEntry('09126')
  assert.equal(entry.weaknessStaysInHand, true, '09126 抽到后应留在手牌')
  assert.equal(entry.endTurnInHandDamage, 1, '09126 回合结束应受到 1 点伤害')
  assert.equal(entry.endTurnInHandHorror, null)
})

// ---------------------------------------------------------------------------
// 09127 恐怖异灵
// ---------------------------------------------------------------------------

test('P6 09127 恐怖异灵：弱点在本地点生成并交战，空法术槽额外揭示标记', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [], clues: 0 }]
  state.investigators[0].location = 'a'
  state.investigators[0].deck = ['09127']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  const horror = state.enemies.find(item => item.code === '09127')
  assert.ok(horror, '恐怖异灵生成')
  assert.equal(horror.location, 'a')
  assert.equal(horror.engagedSeat, 0, '与抽到它的调查员交战')
  assert.equal(horror.hunter, true, '猎手关键词')
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 2, stage: 'ST.1', committed: [], drawn: [],
    actionKind: 'fight', target: { kind: 'enemy', id: horror.id } }
  runTest(state, draft => { reactWindowProbe(draft, { when: 'testBegins', seat: 0, location: 'a' }) })
  assert.equal(state.skillTest.extraChaosChoices, 1, '1 个空法术槽额外揭示 1 个标记')
})

test('P6 09127 恐怖异灵：没有空法术槽时不额外揭示', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = [{ id: 'a', name: 'A', revealed: true, connections: [], clues: 0 }]
  state.investigators[0].location = 'a'
  state.investigators[0].deck = ['09127']
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  const horror = state.enemies.find(item => item.code === '09127')
  asset(state, '01061') // 探知术：占用法术槽
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 2, stage: 'ST.1', committed: [], drawn: [],
    actionKind: 'fight', target: { kind: 'enemy', id: horror.id } }
  runTest(state, draft => { reactWindowProbe(draft, { when: 'testBegins', seat: 0, location: 'a' }) })
  assert.equal(state.skillTest.extraChaosChoices || 0, 0, '法术槽已占用，不额外揭示')
})

// ---------------------------------------------------------------------------
// 09128 准备不足
// ---------------------------------------------------------------------------

test('P6 09128 准备不足：只有这一张手牌且恰好 1 资源时才能打出', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['09128']
  state.investigators[0].resources = 1
  const conditions = registeredEntry('09128').playCondition
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), true, '满足打出条件')
  state.investigators[0].hand = ['09128', '01088']
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), false, '手牌不止一张时不能打出')
  state.investigators[0].hand = ['09128']
  state.investigators[0].resources = 2
  assert.equal(conditions.every(item => item.when({ state, inv: state.investigators[0] })), false, '资源不是恰好 1 时不能打出')
})

test('P6 09128 准备不足：支付 1 资源打出以弃掉它', () => {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = []
  state.investigators[0].resources = 1
  assert.equal(registeredEntry('09128').playableWeakness, true, '弱点可打出的唯一许可')
  assert.equal(playCost(state, state.investigators[0], ALL_CARDS['09128']), 1, '印刷费用 1')
  playForced(state, '09128')
  const inv = state.investigators[0]
  assert.equal(inv.resources, 0, '支付 1 资源')
  assert.ok(inv.discard.includes('09128'), '准备不足进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 分片完整性守卫
// ---------------------------------------------------------------------------

test('P6 M2-4 分片：27 张条目全部注册且 code 与文件名一致', () => {
  assert.equal(CODES.length, 27, 'M2-4 分片固定 27 张')
  for (const code of CODES) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.code, code)
  }
})

// 引擎在 move 里可能留下待决选择（endTurn / play 的额外选择），统一点掉。
function resetChoices(state) {
  let guard = 0
  while (state.pendingChoice && guard++ < 80) {
    const pending = state.pendingChoice
    const chosen = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}
