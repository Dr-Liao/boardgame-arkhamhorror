// 九循环《铁杉谷盛宴》P6 一般玩家卡 · M2-9 分片（10099–10108）逐卡验收。
//
// 分片共 10 张：事件 10099/10100/10101/10102/10103/10105，支援 10104/10106/10107/10108。
// 每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> …` 真实行为测试。
// 缺读点（延迟去向 / 绑定检索洗牌 / 离场去向 / 印刷上限）在条目 note 里披露，并在
// `artifacts/migration/fhv/primitive-requests/<code>.json` 登记。
//
// 约定（与 tests/fhv-player-m2-2.test.mjs 相同）：
//   · 直接 import 单卡条目 + 缺少时自注册，不依赖 entries/index.js（索引由主进程重建）；
//   · 事件走真实描述子执行入口（executeDescriptor + resolveTransaction）；支援能力走真实
//     legalMoves / ability 行动；检定与混乱标记用 state.debugNextTokens 固定揭示顺序（仅测试用）；
//   · 事务提交的是克隆状态：断言前按 id/code 从 state 重新取实体，选择器用 memo 缓存
//     （同一 choiceId 只决策一次，事务重放时逐字一致）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind, playedActionCost } from '../src/engine/ability.js'
import { executeDescriptor, getStat, performTest } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

import e10099 from '../src/cards/entries/10099.js'
import e10100 from '../src/cards/entries/10100.js'
import e10101 from '../src/cards/entries/10101.js'
import e10102 from '../src/cards/entries/10102.js'
import e10103 from '../src/cards/entries/10103.js'
import e10104 from '../src/cards/entries/10104.js'
import e10105 from '../src/cards/entries/10105.js'
import e10106 from '../src/cards/entries/10106.js'
import e10107 from '../src/cards/entries/10107.js'
import e10108 from '../src/cards/entries/10108.js'

const ENTRIES = [e10099, e10100, e10101, e10102, e10103,
  e10104, e10105, e10106, e10107, e10108]
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

// 事务重放会重新执行同一个 select：按 choiceId 缓存，保证同一选择点永远给出同一个答案。
function memo (select) {
  const cache = new Map()
  return (choice, state) => {
    if (!cache.has(choice.id)) cache.set(choice.id, select(choice, state))
    return cache.get(choice.id)
  }
}

function transact (state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'fhvPlayerM29Test' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 200, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    assert.ok(choice.options.some(option => option.id === id), `无效选项 ${id}：${JSON.stringify(choice.options)}`)
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

function game (count = 1) {
  const state = fixture('01001', count)
  state.abilityLimits = {}
  for (const inv of state.investigators) {
    inv.hand = []
    inv.threat = []
    inv.assets = []
    inv.damage = 0
    inv.horror = 0
    inv.resources = 30
    inv.clues = 0
    inv.actionsLeft = 20
  }
  return state
}

function runPlayed (state, code, { context = {}, seat = 0, source = null, select = () => null, ignoreCosts = true } = {}) {
  transact(state, draft => {
    const inv = draft.investigators[seat]
    executeDescriptor(draft, {
      inv, source: source || { code }, descriptor: descriptorOfKind(code, 'played'),
      context, events: [], windowId: null, ignoreCosts,
    })
  }, select)
}

// 用真实能力面执行一段 api 调用（同一份 abilityApi；离开场/伤害判定等原语只从这里进入）。
function viaApi (state, run) {
  transact(state, draft => {
    const inv = draft.investigators[0]
    executeDescriptor(draft, {
      inv, events: [], silent: true, alreadyPaid: true,
      descriptor: { kind: 'free', code: inv.code, cost: {}, resolve: ({ api }) => { run(api, draft) } },
    })
  })
}

// 真实技能检定（在事务里跑，窗口里打出的反应由 select 决定）。
function runTest (state, select = () => null, { seat = 0, skill = 'willpower', difficulty = 0 } = {}) {
  transact(state, draft => {
    performTest(draft, seat, skill, difficulty, {})
  }, select)
}

const byId = (state, id) => state.investigators[0].assets.find(item => item.id === id)
const bagCount = (state, token) => (state.chaosBag || []).filter(face => face === token).length
const abilityMoves = (state, assetId) => legalMoves(state)
  .filter(row => row.action === 'ability' && row.assetId === assetId)

// ── 10099 呼唤彼端 ───────────────────────────────────────────────────────────
test('P6 10099 呼唤彼端：额外加入 3 个诅咒，补满所选充能支援并可免行动费结算其能力', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['10099']
  inv.resources = 10
  inv.actionsLeft = 1
  s.chaosBag = ['0', '0']
  const scrying = asset(s, '01061', { uses: 0 }) // 印刷上限 3 充能
  assert.equal(registeredEntry('01061').uses, 3)

  move(s, { action: 'play', cardId: '10099' })
  settle(s, pending => pending.options.find(option => /窥视/.test(String(option.label || '')))?.id ?? null)
  const settled = s.investigators[0]
  assert.equal(settled.actionsLeft, 0, '打出事件耗尽唯一行动；结算支援能力不再花行动')
  assert.equal(bagCount(s, 'curse'), 3, '额外费用：混乱袋加入 3 个诅咒标记')
  const after = settled.assets.find(item => item.id === scrying.id)
  assert.equal(after.uses, 2, '先补满到印刷上限 3，再花 1 充能结算能力')
  assert.equal(after.exhausted, true, '结算能力时横置支援')
  assert.equal(settled.discard.includes('10099'), true, '事件结算后进弃牌堆')

  // 支付条件：袋里放不下 3 个诅咒时不能打出。
  const blocked = game()
  blocked.investigators[0].hand = ['10099']
  blocked.chaosBag = [...Array.from({ length: 8 }, () => 'curse'), 'bless', 'bless']
  asset(blocked, '01061', { uses: 0 })
  assert.equal(legalMoves(blocked).some(row => row.action === 'play' && row.cardId === '10099'), false)
  assert.match(String(validateMove(blocked, 0, { action: 'play', cardId: '10099' })), /混乱标记/)
})

// ── 10100 缥缈灵体 ───────────────────────────────────────────────────────────
test('P6 10100 缥缈灵体：意志躲避成功后解除交战并化为无形；揭示符号则返回手牌', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['10100']
  inv.resources = 10
  const foe = enemy(s, { fight: 0, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  s.debugNextTokens = ['0']
  const agility = getStat(s, inv, 'agility')
  const willpower = getStat(s, inv, 'willpower')

  move(s, { action: 'play', cardId: '10100' })
  settle(s)
  assert.equal(s.lastTestResult.skill, 'agility', '本次是躲避检定')
  assert.equal(s.lastTestResult.value, agility + willpower, '意志值加入本次技能值')
  const after = s.enemies.find(item => item.id === foe.id)
  assert.equal(after.exhausted, true, '被躲避的敌人横置')
  assert.equal(after.engagedSeat, null, '与敌人解除交战')
  const effect = (s.effects || []).find(item => item.sourceCode === '10100')
  assert.ok(effect, '无形是持续效果')
  assert.equal(effect.duration, 'endOfRound', '持续到本轮结束')
  assert.deepEqual(effect.modifiers.map(item => item.target).sort(),
    ['capability:dealEnemyDamage', 'capability:engage', 'capability:fight'])
  assert.equal(s.investigators[0].discard.includes('10100'), true, '未揭示符号：结算后进弃牌堆')

  // 揭示了符号：返回手牌（近似：结算后立即返回）。
  const symbol = game()
  const symbolInv = symbol.investigators[0]
  symbolInv.hand = ['10100']
  symbolInv.resources = 10
  enemy(symbol, { fight: 0, evade: 1, health: 20, engagedSeat: 0 })
  symbol.chaosBag = ['skull', '0']
  symbol.debugNextTokens = ['skull', '0']
  move(symbol, { action: 'play', cardId: '10100' })
  settle(symbol)
  assert.equal(symbol.investigators[0].hand.includes('10100'), true, '揭示符号 → 返回手牌')
  assert.equal(symbol.investigators[0].discard.includes('10100'), false)

  // 没有交战的敌人时不能打出。
  const idle = game()
  idle.investigators[0].hand = ['10100']
  assert.equal(legalMoves(idle).some(row => row.action === 'play' && row.cardId === '10100'), false)
  assert.match(String(validateMove(idle, 0, { action: 'play', cardId: '10100' })), /交战/)
})

// ── 10101 解读秘符 ───────────────────────────────────────────────────────────
test('P6 10101 解读秘符：意志加入调查、成功额外 1 线索；揭示符号则返回手牌', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['10101']
  inv.resources = 10
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 3
  here.shroud = 0
  s.chaosBag = ['0']
  s.debugNextTokens = ['0']
  const intellect = getStat(s, inv, 'intellect')
  const willpower = getStat(s, inv, 'willpower')

  move(s, { action: 'play', cardId: '10101' })
  settle(s)
  assert.equal(s.lastTestResult.skill, 'intellect', '调查检定仍用智力')
  assert.equal(s.lastTestResult.value, intellect + willpower, '意志值加入本次技能值')
  assert.equal(s.investigators[0].clues, 2, '成功发现 1 个线索 + 卡面额外 1 个')
  assert.equal(s.locations.find(location => location.id === here.id).clues, 1, '地点线索减少 2')
  assert.equal(s.investigators[0].discard.includes('10101'), true, '未揭示符号：进弃牌堆')

  // 揭示符号（教徒）：返回手牌。
  const symbol = game()
  const symbolInv = symbol.investigators[0]
  symbolInv.hand = ['10101']
  symbolInv.resources = 10
  const room = symbol.locations.find(location => location.id === symbolInv.location)
  room.clues = 2
  room.shroud = 0
  symbol.chaosBag = ['cultist', '0']
  symbol.debugNextTokens = ['cultist', '0']
  move(symbol, { action: 'play', cardId: '10101' })
  settle(symbol)
  assert.equal(symbol.investigators[0].hand.includes('10101'), true, '揭示符号 → 返回手牌')
  assert.equal(symbol.investigators[0].discard.includes('10101'), false)
})

// ── 10102 幽灵利刃 ───────────────────────────────────────────────────────────
test('P6 10102 幽灵利刃：意志加入攻击，非精英 +2 伤害 / 精英 +1；揭示符号返回手牌', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['10102']
  inv.resources = 10
  const foe = enemy(s, { fight: 0, evade: 1, health: 20, engagedSeat: null })
  s.chaosBag = ['0']
  s.debugNextTokens = ['0']
  const combat = getStat(s, inv, 'combat')
  const willpower = getStat(s, inv, 'willpower')

  move(s, { action: 'play', cardId: '10102' })
  settle(s, pending => pending.options.find(option => option.id === 'engage')?.id ?? null)
  assert.equal(s.lastTestResult.skill, 'combat', '本次是攻击检定')
  assert.equal(s.lastTestResult.value, combat + willpower, '意志值加入本次技能值')
  assert.equal(s.enemies.find(item => item.id === foe.id).damageTaken, 3, '基础 1 + 非精英 2 伤害')
  assert.equal(s.enemies.find(item => item.id === foe.id).engagedSeat, 0, '攻击前主动交战')
  assert.equal(s.investigators[0].discard.includes('10102'), true, '未揭示符号：进弃牌堆')

  // 精英敌人只 +1 伤害。
  const elite = game()
  elite.investigators[0].hand = ['10102']
  elite.investigators[0].resources = 10
  const boss = enemy(elite, { fight: 0, evade: 1, health: 20, elite: true, engagedSeat: null })
  elite.chaosBag = ['0']
  elite.debugNextTokens = ['0']
  move(elite, { action: 'play', cardId: '10102' })
  settle(elite, pending => pending.options.find(option => option.id === 'skip')?.id ?? null)
  assert.equal(elite.enemies.find(item => item.id === boss.id).damageTaken, 2, '精英敌人受到 1 + 1 伤害')

  // 揭示符号：返回手牌。
  const symbol = game()
  symbol.investigators[0].hand = ['10102']
  symbol.investigators[0].resources = 10
  const tough = enemy(symbol, { fight: 0, evade: 1, health: 20, engagedSeat: 0 })
  symbol.chaosBag = ['tablet', '0']
  symbol.debugNextTokens = ['tablet', '0']
  move(symbol, { action: 'play', cardId: '10102' })
  settle(symbol)
  assert.equal(symbol.investigators[0].hand.includes('10102'), true, '揭示符号 → 返回手牌')
  assert.equal(symbol.investigators[0].discard.includes('10102'), false)
  assert.ok(symbol.enemies.find(item => item.id === tough.id), '敌人仍存活（检定失败/未击败都不影响去向）')
})

// ── 10103 超凡织造 ───────────────────────────────────────────────────────────
test('P6 10103 超凡织造：Double 额外花 1 行动；依次打出两张[[法术]]事件（各减 1 费、结算时 +2）', () => {
  assert.equal(playedActionCost('10103'), 1, 'Double：played 描述子声明额外行动费用')
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['10103', '10101', '06201'] // 两张不同名的 [[法术]] 事件（解读秘符 / 幽灵利刃）
  inv.resources = 30
  inv.actionsLeft = 20
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 3
  here.shroud = 0
  const foe = enemy(s, { fight: 0, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0', '0']
  s.debugNextTokens = ['0', '0']
  const intellect = getStat(s, inv, 'intellect')
  const willpower = getStat(s, inv, 'willpower')
  const combat = getStat(s, inv, 'combat')

  const revealOrder = ['10101', '06201']
  move(s, { action: 'play', cardId: '10103' })
  settle(s, pending => {
    const next = revealOrder.find(code => pending.options.some(option => option.id === code))
    return next ?? null
  })
  assert.equal(s.investigators[0].actionsLeft, 18, '打出事件 1 行动 + Double 额外 1 行动')
  assert.equal(s.investigators[0].resources, 27, '10103 费 1 + 两张事件各减 1 费（1 + 1）')
  assert.equal(s.investigators[0].clues, 2, '10101 给出 2 线索')
  assert.deepEqual([...s.investigators[0].discard].sort(), ['06201', '10101', '10103'], '三张事件都进弃牌堆')
  assert.equal(s.investigators[0].hand.includes('10101'), false, '已打出的揭示事件离开手牌')
  assert.equal(s.lastTestResult.value, combat + willpower + 2, '结算揭示事件时技能值 +2')
  assert.ok(s.enemies.find(item => item.id === foe.id).damageTaken >= 3, '打出的幽灵利刃造成伤害')

  // 没有[[法术]]事件时不能打出。
  const none = game()
  none.investigators[0].hand = ['10103']
  assert.equal(legalMoves(none).some(row => row.action === 'play' && row.cardId === '10103'), false)
  assert.match(String(validateMove(none, 0, { action: 'play', cardId: '10103' })), /法术/)
})

// ── 10104 所罗门之钥 ─────────────────────────────────────────────────────────
test('P6 10104 所罗门之钥：祝福多于诅咒时移除祝福治愈 2 点；诅咒多于祝福时移除诅咒获得 2 资源', () => {
  const bless = game()
  const blessInv = bless.investigators[0]
  blessInv.damage = 2
  bless.chaosBag = ['bless', 'bless', 'curse', '0']
  const key = asset(bless, '10104')
  const blessMoves = abilityMoves(bless, key.id)
  assert.equal(blessMoves.length, 1, '只列出「祝福多于诅咒」的那条能力')
  move(bless, blessMoves[0])
  settle(bless)
  const after = byId(bless, key.id)
  assert.equal(bless.investigators[0].damage, 0, '治愈 2 点伤害')
  assert.equal(after.exhausted, true, '横置所罗门之钥')
  assert.equal(bagCount(bless, 'bless'), 1, '从混乱袋移除 1 个祝福标记')
  assert.equal(bagCount(bless, 'curse'), 1)

  // 盟友支援：治愈其恐惧。
  const allyCase = game()
  allyCase.chaosBag = ['bless', 'bless', 'curse']
  const ally = asset(allyCase, '01018', { horror: 2 })
  const allyKey = asset(allyCase, '10104')
  move(allyCase, abilityMoves(allyCase, allyKey.id)[0])
  settle(allyCase)
  assert.equal(byId(allyCase, ally.id).horror, 0, '治愈[[盟友]]的 2 点恐惧')
  assert.equal(allyCase.investigators[0].horror, 0)

  // 诅咒多于祝福：移除诅咒并获得 2 资源。
  const curse = game()
  const curseInv = curse.investigators[0]
  curseInv.resources = 5
  curse.chaosBag = ['curse', 'curse', 'bless', '0']
  const curseKey = asset(curse, '10104')
  const curseMoves = abilityMoves(curse, curseKey.id)
  assert.equal(curseMoves.length, 1, '只列出「诅咒多于祝福」的那条能力')
  move(curse, curseMoves[0])
  settle(curse)
  assert.equal(curse.investigators[0].resources, 7, '获得 2 资源')
  assert.equal(bagCount(curse, 'curse'), 1, '从混乱袋移除 1 个诅咒标记')
  assert.equal(byId(curse, curseKey.id).exhausted, true)

  // 数量相等：两条能力都不出现。
  const even = game()
  even.chaosBag = ['bless', 'curse', '0']
  const evenKey = asset(even, '10104')
  assert.equal(abilityMoves(even, evenKey.id).length, 0)
})

// ── 10105 上古封印 ───────────────────────────────────────────────────────────
test('P6 10105 上古封印：检定结束揭示 2 诅咒/2 祝福后，把对应绑定召唤物放置入场并移出游戏', () => {
  const entry = registeredEntry('10105')
  assert.equal(entry.removeAfterPlay, true, '结算后移出游戏')
  const descriptor = descriptorOfKind('10105', 'played')
  assert.equal(descriptor.fast, true, '快速事件')
  assert.ok(descriptor.trigger.includes('testEnds'), '窗口：技能检定结束时')
  const probe = game().investigators[0]
  const criteria = descriptor.criteria[0]
  assert.equal(criteria({ state: { investigators: [probe] }, inv: probe,
    context: { when: 'testEnds', seat: 0, result: { drawn: ['curse', 'curse', '0'] } } }), true)
  assert.equal(criteria({ state: { investigators: [probe] }, inv: probe,
    context: { when: 'testEnds', seat: 0, result: { drawn: ['bless', 'bless', '0'] } } }), true)
  assert.equal(criteria({ state: { investigators: [probe] }, inv: probe,
    context: { when: 'testEnds', seat: 0, result: { drawn: ['curse', 'bless', '0'] } } }), false,
  '只有 1 诅咒 1 祝福不满足')

  const curses = game()
  runPlayed(curses, '10105', { context: { when: 'testEnds', seat: 0, result: { drawn: ['curse', 'curse', '0'] } } })
  assert.equal(curses.investigators[0].assets.some(card => card.code === '10107'), true, '黄铜仆从放置入场')
  assert.equal(curses.investigators[0].assets.some(card => card.code === '10106'), false)

  const blesses = game()
  runPlayed(blesses, '10105', { context: { when: 'testEnds', seat: 0, result: { drawn: ['bless', 'bless', '0'] } } })
  assert.equal(blesses.investigators[0].assets.some(card => card.code === '10106'), true, '钥匙看管者放置入场')
  assert.equal(blesses.investigators[0].assets.some(card => card.code === '10107'), false)

  const both = game()
  runPlayed(both, '10105', { context: { when: 'testEnds', seat: 0, result: { drawn: ['curse', 'curse', 'bless', 'bless'] } } })
  assert.deepEqual(both.investigators[0].assets.map(card => card.code).sort(), ['10106', '10107'],
    '两种标记各 2 个：两者都放置入场')
  assert.deepEqual((both.bondedSets?.['10105']?.cards || []).sort(), [], '两张绑定副本都已离开场外集合')

  const negative = game()
  runPlayed(negative, '10105', { context: { when: 'testEnds', seat: 0, result: { drawn: ['curse', '0'] } } })
  assert.deepEqual(negative.investigators[0].assets, [], '只揭示 1 个诅咒：不放置入场')
})

// ── 10106 钥匙看管者 ─────────────────────────────────────────────────────────
test('P6 10106 钥匙看管者：祝福揭示时受 1 恐惧并发现 1 线索；离场时收回场外绑定集合', () => {
  const s = game()
  const inv = s.investigators[0]
  const keeper = asset(s, '10106')
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 2
  s.chaosBag = ['bless', '0']
  s.debugNextTokens = ['bless', '0']

  let asked = false
  runTest(s, pending => {
    const option = pending.options.find(item => /钥匙看管者/.test(String(item.label || '')))
    if (option) { asked = true; return option.id }
    return null
  })
  assert.equal(asked, true, '揭示祝福后列出钥匙看管者的反应')
  const after = byId(s, keeper.id)
  assert.equal(after.horror, 1, '对钥匙看管者造成 1 点恐惧')
  assert.equal(s.investigators[0].clues, 1, '发现 1 个线索')
  assert.equal(s.locations.find(location => location.id === here.id).clues, 1)

  // 同一次揭示不重复触发；下一次揭示可以再次触发。
  s.debugNextTokens = ['bless', '0']
  const offeredAgain = (() => {
    let again = false
    runTest(s, pending => {
      const option = pending.options.find(item => /钥匙看管者/.test(String(item.label || '')))
      if (option) again = true
      return option ? option.id : null
    })
    return again
  })()
  assert.equal(offeredAgain, true, '新的一次揭示仍可触发')

  // 神智 4：再受 3 点恐惧被击败 → 放在一边（场外绑定集合）。
  viaApi(s, (api, draft) => {
    const target = draft.investigators[0].assets.find(item => item.code === '10106')
    api.placeAssetHarm(target, { horror: 3 })
  })
  assert.equal(s.investigators[0].assets.some(item => item.code === '10106'), false, '被击败离场')
  assert.ok((s.bondedSets?.['10105']?.cards || []).includes('10106'), '收回场外绑定集合（放在一边）')
})

// ── 10107 黄铜仆从 ───────────────────────────────────────────────────────────
test('P6 10107 黄铜仆从：诅咒揭示时受 1 伤害并对你地点/连接地点的敌人造成 2 伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  const servant = asset(s, '10107')
  const here = s.locations.find(location => location.id === inv.location)
  here.connections = [...(here.connections || []), 'm2-9-attic']
  s.locations.push({ id: 'm2-9-attic', name: '阁楼', revealed: true, clues: 0, shroud: 1, connections: [here.id] })
  const foe = enemy(s, { location: 'm2-9-attic', engagedSeat: null, health: 20 })
  s.chaosBag = ['curse', '0']
  s.debugNextTokens = ['curse', '0']

  let asked = false
  runTest(s, pending => {
    const option = pending.options.find(item => /黄铜仆从/.test(String(item.label || '')))
    if (option) { asked = true; return option.id }
    return null
  })
  assert.equal(asked, true, '揭示诅咒后列出黄铜仆从的反应')
  assert.equal(byId(s, servant.id).damage, 1, '对黄铜仆从造成 1 点伤害')
  assert.equal(s.enemies.find(item => item.id === foe.id).damageTaken, 2, '对连接地点的敌人造成 2 点伤害')

  // 生命 4：再受 3 点伤害被击败 → 放在一边（场外绑定集合）。
  viaApi(s, (api, draft) => {
    const target = draft.investigators[0].assets.find(item => item.code === '10107')
    api.placeAssetHarm(target, { damage: 3 })
  })
  assert.equal(s.investigators[0].assets.some(item => item.code === '10107'), false, '被击败离场')
  assert.ok((s.bondedSets?.['10105']?.cards || []).includes('10107'), '收回场外绑定集合（放在一边）')
})

// ── 10108 火柴盒 ─────────────────────────────────────────────────────────────
test('P6 10108 火柴盒：使用（3 补给）；快速横置花 1 补给使你地点本回合隐蔽值 -1，用尽弃掉', () => {
  const entry = registeredEntry('10108')
  assert.deepEqual([entry.uses, entry.usesType], [3, 'supplies'], '使用（3 补给）')
  assert.equal(entry.discardWhenEmpty, true, '没有补给就弃掉')
  const s = game()
  const inv = s.investigators[0]
  const box = asset(s, '10108')
  assert.deepEqual([box.uses, box.usesType], [3, 'supplies'])
  const here = s.locations.find(location => location.id === inv.location)
  here.shroud = 3
  s.chaosBag = ['0']
  s.debugNextTokens = ['0']

  move(s, { action: 'ability', assetId: box.id, abilityIndex: 0 })
  settle(s)
  const after = byId(s, box.id)
  assert.equal(after.uses, 2, '花费 1 补给')
  assert.equal(after.exhausted, true, '横置火柴盒')
  const shroudLocation = s.locations.find(location => location.id === inv.location)
  assert.deepEqual(shroudLocation.turnShroudMod, { amount: -1, round: s.round, turnSeat: s.currentSeat },
    '本回合隐蔽值 -1')
  assert.equal(s.investigators[0].actionsLeft, 20, '[fast] 能力不消耗行动')

  move(s, { action: 'investigate' })
  settle(s)
  assert.equal(s.lastTestResult.difficulty, 2, '调查难度 = 3 - 1')

  // 补给用尽：弃掉火柴盒。
  const empty = game()
  const last = asset(empty, '10108', { uses: 1 })
  move(empty, { action: 'ability', assetId: last.id, abilityIndex: 0 })
  settle(empty)
  assert.equal(empty.investigators[0].assets.some(item => item.id === last.id), false, '没有补给后弃掉')
  assert.equal(empty.investigators[0].discard.includes('10108'), true)
})

// ── 分片完整性守卫 ───────────────────────────────────────────────────────────
test('P6 M2-9 分片：10 张条目全部注册、code 与文件名一致，近似实现逐张披露', () => {
  assert.equal(ENTRIES.length, 10, 'M2-9 分片固定 10 张')
  for (const entry of ENTRIES) {
    const registered = registeredEntry(entry.code)
    assert.ok(registered, `${entry.code} 未注册`)
    assert.equal(registered.code, entry.code)
    assert.ok(ALL_CARDS[entry.code], `${entry.code} 缺少卡面数据`)
  }
  for (const code of ['10099', '10100', '10101', '10102', '10103', '10105', '10106', '10107']) {
    assert.equal(registeredEntry(code).simplified, true, `${code} 应声明 simplified`)
    assert.ok(registeredEntry(code).note, `${code} 应带 note`)
  }
  // 「躲避。」「攻击。」「调查。」的 played 描述子必须声明行动性质（借机攻击/行动指示门禁）。
  assert.equal(descriptorOfKind('10100', 'played').countsAs, 'evade')
  assert.equal(descriptorOfKind('10101', 'played').countsAs, 'investigate')
  assert.equal(descriptorOfKind('10102', 'played').countsAs, 'fight')
  assert.deepEqual(descriptorOfKind('10103', 'played').cost, { action: 1 }, 'Double 的额外行动费用')
  // 10105 的绑定关系来自卡面数据：两张召唤物各自绑定到上古封印。
  assert.deepEqual((ALL_CARDS['10105'].bondedCards || []).map(item => item.code).sort(), ['10106', '10107'])
  assert.equal(ALL_CARDS['10106'].bondedTo, 'Seal of the Elders')
  assert.equal(ALL_CARDS['10107'].bondedTo, 'Seal of the Elders')
})
