// P6 M2-5（10059–10068）一般玩家卡 Node 验收。
//
// 覆盖策略（与 tsk-player-m2-1 / fhv-player-m2-2 同口径）：
//   · 每张卡至少一条真实行为断言（费用/目标/窗口/持续/负面路径之一）；
//   · 支援上的主动能力用合法行动入口（legalMoves → validateMove → applyMove）执行，
//     需要窗口/反应时用 reactionWindow / playerWindow + resolveTransaction；
//   · 引擎在每次 applyMove 后替换调查员对象 —— 断言前一律从 state 重新读取实例；
//   · 近似实现逐条披露在条目 note，并向 artifacts/migration/fhv/primitive-requests/<code>.json 登记。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { canEquip, playerWindow, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'

import e10059 from '../src/cards/entries/10059.js'
import e10060 from '../src/cards/entries/10060.js'
import e10061 from '../src/cards/entries/10061.js'
import e10062 from '../src/cards/entries/10062.js'
import e10063 from '../src/cards/entries/10063.js'
import e10064 from '../src/cards/entries/10064.js'
import e10065 from '../src/cards/entries/10065.js'
import e10066 from '../src/cards/entries/10066.js'
import e10067 from '../src/cards/entries/10067.js'
import e10068 from '../src/cards/entries/10068.js'

const ENTRIES = [e10059, e10060, e10061, e10062, e10063, e10064, e10065, e10066, e10067, e10068]

// 索引尚未重建时自注册缺少的条目；索引重建后跳过（避免重复注册）。
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

// 规则事务探针：在真实 transaction 里执行一次入口，并收敛所有待决选择。
function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'fhvPlayerM25Test' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 180, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

function game(count = 1) {
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

const me = (state, seat = 0) => state.investigators[seat]
const freshAsset = (state, code, seat = 0) => me(state, seat).assets.find(card => card.code === code)
const wants = keyword => choice => {
  const option = (choice.options || []).find(item => typeof item.label === 'string'
    && item.label.includes(keyword) && item.id !== 'skip')
  return option ? option.id : null
}
const abilityMove = (state, assetId, index, targetId = undefined) => legalMoves(state, 0).find(item =>
  item.action === 'ability' && item.assetId === assetId && item.abilityIndex === index
  && (targetId == null || String(item.targetId) === String(targetId)))
// 窗口探针：直接开真实 reactionWindow（与牌桌/引擎触发同一入口），返回窗口 context。
function windowProbe(state, when, context, select = () => null) {
  let captured = null
  transact(state, draft => {
    captured = { ...context }
    reactionWindow(draft, when, captured, [], { allowNested: true })
  }, select)
  return captured
}

// ── 10059 饥饿霉菌（智能菌株）────────────────────────────────────────────────
test('P6 10059 饥饿霉菌 检索绑定卡每轮一次；隐藏值不大于生长数时取消非弱点诡计并清空生长', () => {
  const s = game()
  const myconid = asset(s, '10059')
  myconid.uses = 2
  const search = abilityMove(s, myconid.id, 0)
  assert.ok(search, '每轮一次的绑定卡检索应出现在合法行动里')
  move(s, search)
  assert.deepEqual(me(s).hand, ['10045'], '绑定卡「诡异疯长」加入手牌')
  assert.equal(abilityMove(s, freshAsset(s, '10059').id, 0), undefined, '同一轮不能再次检索（limit oncePerRound）')

  const location = s.locations.find(item => item.id === me(s).location)
  assert.equal(location.shroud, 2)
  const context = windowProbe(s, 'encounterDrawn', {
    when: 'encounterDrawn', seat: 0, location: location.id, cardCode: '01165', weakness: false,
  }, choice => wants('饥饿霉菌')(choice) ?? 'skip')
  assert.equal(context.cancelled, true, '诡计被取消（窗口 context.cancelled）')
  assert.equal(freshAsset(s, '10059').uses, 0, '移除全部生长（2 点）')

  // 负面路径：弱点诡计不满足「非弱点诡计」条件。
  const weak = game()
  const other = asset(weak, '10059')
  other.uses = 2
  const weakContext = windowProbe(weak, 'encounterDrawn', {
    when: 'encounterDrawn', seat: 0, location: me(weak).location, cardCode: '10003', weakness: true,
  })
  assert.notEqual(weakContext.cancelled, true, '弱点诡计不能被取消')
  assert.equal(freshAsset(weak, '10059').uses, 2, '生长保留')
})

// ── 10060 饥饿霉菌（食肉菌株）────────────────────────────────────────────────
test('P6 10060 饥饿霉菌 剩余生命值不超过生长数的非精英敌人被击败并清空生长', () => {
  const s = game()
  const myconid = asset(s, '10060')
  myconid.uses = 2
  const foe = enemy(s, { fight: 1, evade: 1, health: 5, damageTaken: 3 })
  const option = abilityMove(s, myconid.id, 1, foe.id)
  assert.ok(option, '剩余生命值 5-3=2 ≤ 生长 2：目标合法')
  move(s, option)
  settle(s)
  assert.equal(s.enemies.some(item => item.id === foe.id), false, '敌人被击败离场')
  assert.equal(freshAsset(s, '10060').uses, 0, '移除全部生长')

  // 负面路径：剩余生命值 3 > 生长 2，不能选为目标。
  const toughGame = game()
  const toughCard = asset(toughGame, '10060')
  toughCard.uses = 2
  const tough = enemy(toughGame, { fight: 1, evade: 1, health: 5, damageTaken: 2 })
  assert.equal(abilityMove(toughGame, toughCard.id, 1, tough.id), undefined, '剩余生命值过高的敌人不是合法目标')
})

// ── 10061 饥饿霉菌（滋长菌株）────────────────────────────────────────────────
test('P6 10061 饥饿霉菌 移除全部生长：治愈自身等量伤恐，或把同地点调查员的伤恐移上来', () => {
  // 治愈模式：2 伤害 + 1 恐惧 = 3，生长 3 → 全部治愈。
  const s = game()
  const myconid = asset(s, '10061', { damage: 2, horror: 1 })
  myconid.uses = 3
  const heal = abilityMove(s, myconid.id, 1)
  assert.ok(heal, '有伤可治愈时能力可用')
  move(s, heal)
  settle(s, choice => (choice.options.some(option => option.id === 'heal') ? 'heal' : null))
  const healed = freshAsset(s, '10061')
  assert.deepEqual([healed.damage, healed.horror, healed.uses], [0, 0, 0], '治愈 3 点并移除全部生长')

  // 移动模式：队友 1 点伤害 → 移到饥饿霉菌身上。
  const moveGame = game(2)
  const carrier = asset(moveGame, '10061')
  carrier.uses = 2
  const mate = me(moveGame, 1)
  mate.location = me(moveGame, 0).location
  mate.damage = 1
  const moveOption = abilityMove(moveGame, carrier.id, 1)
  assert.ok(moveOption, '同地点调查员有伤害时能力可用')
  move(moveGame, moveOption)
  settle(moveGame, choice => (choice.options.some(option => option.id === 'move') ? 'move' : null))
  const fed = freshAsset(moveGame, '10061')
  assert.equal(me(moveGame, 1).damage, 0, '队友的 1 点伤害被移走')
  assert.equal(fed.damage, 1, '伤害移到饥饿霉菌身上')
  assert.equal(fed.uses, 0, '移除全部生长')
})

// ── 10062 “咪咪”比安卡（放声歌唱）────────────────────────────────────────────
test('P6 10062 “咪咪”比安卡 借出 X 资源并检定[敏捷](X)；失败记欠款、生成敌人并移出游戏', () => {
  // 成功路径：借 1 资源，敏捷(1) 检定成功 → 卡留在场上（横置）。
  const s = game()
  const bianca = asset(s, '10062')
  me(s).resources = 5
  const borrow = abilityMove(s, bianca.id, 0)
  assert.ok(borrow, '借款行动应可用')
  move(s, borrow)
  settle(s, choice => (choice.kind === 'amount' ? '1' : null))
  const kept = freshAsset(s, '10062')
  assert.equal(me(s).resources, 6, '从比安卡身上移动 1 资源到资源池')
  assert.deepEqual([kept.uses, kept.exhausted], [9, true], '花掉 1 资源并横置')
  assert.equal(s.lastTestResult.success, true, '敏捷(1) 检定成功')
  assert.equal(s.lastTestResult.skill, 'agility')
  assert.equal(s.enemies.some(item => item.code === '10063'), false, '成功时不生成敌人')

  // 失败路径：检定失败 → 记住欠款、生成比安卡敌人、本卡移出游戏。
  const failed = game()
  const card = asset(failed, '10062')
  failed.chaosBag = ['-8']
  const action = abilityMove(failed, card.id, 0)
  move(failed, action)
  settle(failed, choice => (choice.kind === 'amount' ? '1' : null))
  assert.equal(failed.campaign.records['youOweBianca:0'], 1, '记住“你欠比安卡 1 资源”')
  const spawned = failed.enemies.find(item => item.code === '10063')
  assert.ok(spawned, '绑定敌人“咪咪”比安卡已生成')
  assert.equal(spawned.location, me(failed).location, '生成在你的地点')
  assert.equal(spawned.bearerSeat, 0, '承受者为借款的调查员')
  assert.equal(me(failed).assets.some(item => item.code === '10062'), false, '资产已离场')
  assert.ok((failed.removedFromGame || []).includes('10062'), '资产已移出游戏')
  const owedParley = legalMoves(failed, 0).find(item => item.action === 'entityAbility'
    && item.actionKind === 'parley' && item.entityId === spawned.id)
  assert.ok(owedParley, '10062 写入的欠款记录能被 10063 的谈判行动读取')
})

// ── 10063 “咪咪”比安卡（敌人）────────────────────────────────────────────────
test('P6 10063 “咪咪”比安卡 欠款时花 X 资源谈判加入胜利区；无欠款不可谈判', () => {
  const s = game()
  me(s).resources = 10
  transact(s, draft => { scenarioRuntime(draft, []).spawnEngaged('10063', me(draft).location, 0) })
  const bianca = s.enemies.find(item => item.code === '10063')
  assert.ok(bianca, '敌人已在场')
  assert.equal(bianca.hunter, true, '猎手关键词来自 enemyWeakness')

  // 没有欠款时不能使用谈判行动。
  assert.equal(legalMoves(s, 0).some(item => item.action === 'entityAbility'
    && item.actionKind === 'parley' && item.entityId === bianca.id), false, '没有欠款时不能谈判')

  s.campaign.records['youOweBianca:0'] = 2
  const parley = legalMoves(s, 0).find(item => item.action === 'entityAbility'
    && item.actionKind === 'parley' && item.entityId === bianca.id)
  assert.ok(parley, '欠款时谈判行动可用')
  move(s, parley)
  assert.equal(s.victoryDisplay.some(item => String(item.id) === String(bianca.id)), true, '加入胜利区')
  assert.equal(s.enemies.some(item => String(item.id) === String(bianca.id)), false, '敌人离场')
  assert.equal(me(s).resources, 8, '花费 2 资源')
  assert.equal(s.campaign.records['youOweBianca:0'], undefined, '欠款记录被清除')

  // 强制：被击败时（非上述谈判）洗回承受者牌库。
  const defeated = game()
  transact(defeated, draft => { scenarioRuntime(draft, []).spawnEngaged('10063', me(draft).location, 0) })
  const prey = defeated.enemies.find(item => item.code === '10063')
  transact(defeated, draft => { scenarioRuntime(draft, []).damageEnemy(prey.id, 3, 0) })
  assert.equal(defeated.enemies.some(item => item.id === prey.id), false, '比安卡被击败离场')
  assert.ok(me(defeated).deck.includes('10063'), '被击败时洗回承受者的牌库')
})

// ── 10064 敲诈文件 ────────────────────────────────────────────────────────────
test('P6 10064 敲诈文件 谈判检定[意志](印刷生命值)；成功解除交战并获得冷漠直到本轮结束', () => {
  const s = game()
  const file = asset(s, '10064')
  const foe = enemy(s, { fight: 1, evade: 1, health: 3 })
  s.chaosBag = ['0']
  const option = abilityMove(s, file.id, 0, foe.id)
  assert.ok(option, '非精英敌人是合法目标')
  move(s, option)
  settle(s)
  assert.equal(s.lastTestResult.success, true, '意志 3 对难度 3（印刷生命值）成功')
  assert.equal(s.lastTestResult.difficulty, 3)
  const after = s.enemies.find(item => item.id === foe.id)
  assert.equal(after.engagedSeat, null, '与每位调查员解除交战')
  assert.deepEqual(after.keywordOverrides?.aloof, { enabled: true, throughRound: s.round }, '获得冷漠直到本轮结束')
  assert.equal(me(s).engaged.includes(foe.id), false)

  // 负面路径：精英敌人不能选。
  const eliteGame = game()
  asset(eliteGame, '10064')
  const elite = enemy(eliteGame, { fight: 1, evade: 1, health: 3, elite: true })
  assert.equal(abilityMove(eliteGame, freshAsset(eliteGame, '10064').id, 0, elite.id), undefined, '精英敌人不是合法目标')
})

// ── 10065 不列颠斗牛犬左轮手枪 ────────────────────────────────────────────────
test('P6 10065 不列颠斗牛犬左轮手枪 花 1 子弹用[敏捷]攻击 +1 伤害；谈判失败后从手牌入场', () => {
  const s = game()
  const gun = asset(s, '10065')
  const foe = enemy(s, { fight: 1, evade: 1, health: 30 })
  s.chaosBag = ['0']
  const shot = abilityMove(s, gun.id, 0, foe.id)
  assert.ok(shot, '攻击行动可用')
  move(s, shot)
  settle(s, choice => (choice.options.some(option => option.id === 'agility') ? 'agility' : null))
  assert.equal(s.lastTestResult.skill, 'agility', '本次攻击用[敏捷]代替[战斗]')
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.enemies.find(item => item.id === foe.id).damageTaken, 2, '基础 1 点 + 本武器 +1 点伤害')
  assert.equal(freshAsset(s, '10065').uses, 2, '花费 1 发子弹')

  // 反应：与敌人谈判的技能检定失败后，把手牌里的本卡放置入场。
  const reactionGame = game()
  asset(reactionGame, '10064')
  const mark = enemy(reactionGame, { fight: 1, evade: 1, health: 3 })
  me(reactionGame).hand = ['10065']
  reactionGame.chaosBag = ['-8']
  const blackmail = abilityMove(reactionGame, freshAsset(reactionGame, '10064').id, 0, mark.id)
  assert.ok(blackmail)
  let triggered = false
  move(reactionGame, blackmail)
  settle(reactionGame, choice => {
    const option = wants('不列颠斗牛犬')(choice)
    if (option) {
      triggered = true
      return option
    }
    return null
  })
  assert.equal(triggered, true, '谈判失败后列出从手牌入场的反应')
  assert.equal(me(reactionGame).hand.includes('10065'), false, '手牌已离开')
  const placed = freshAsset(reactionGame, '10065')
  assert.ok(placed, '不列颠斗牛犬左轮手枪已放置入场')
  assert.equal(placed.uses, 3, '入场带 3 发子弹')
})

// ── 10066 假证 ───────────────────────────────────────────────────────────────
test('P6 10066 假证 谈判成功发现线索并放置疑点（难度随之 +1）；失败让所选敌人攻击', () => {
  const s = game()
  const card = asset(s, '10066')
  const foe = enemy(s, { fight: 1, evade: 1, health: 3 })
  const location = s.locations.find(item => item.id === me(s).location)
  location.clues = 1
  s.chaosBag = ['0']
  const first = abilityMove(s, card.id, 0, foe.id)
  assert.ok(first, '敌人是合法目标')
  move(s, first)
  settle(s)
  assert.equal(s.lastTestResult.difficulty, 1, '无疑点时难度 1')
  assert.equal(me(s).clues, 1, '发现 1 个线索')
  assert.equal(s.locations.find(item => item.id === location.id).clues, 0)
  assert.equal(freshAsset(s, '10066').uses, 1, '放置 1 资源作为疑点')

  // 第二次：疑点 1 → 难度 2（横置已支付，先重整）。
  freshAsset(s, '10066').exhausted = false
  const second = abilityMove(s, freshAsset(s, '10066').id, 0, foe.id)
  assert.ok(second)
  move(s, second)
  settle(s)
  assert.equal(s.lastTestResult.difficulty, 2, '每个疑点使难度 +1')
  assert.equal(freshAsset(s, '10066').uses, 2)

  // 失败路径：弃掉假证或让所选敌人攻击。
  const failed = game()
  const fake = asset(failed, '10066')
  const attacker = enemy(failed, { fight: 1, evade: 1, health: 3, damage: 1 })
  failed.chaosBag = ['-8']
  move(failed, abilityMove(failed, fake.id, 0, attacker.id))
  let attacked = false
  settle(failed, choice => {
    if (choice.options.some(option => option.id === 'attack')) {
      attacked = true
      return 'attack'
    }
    return null
  })
  assert.equal(attacked, true, '失败后给出「弃掉 / 敌人攻击」选择')
  assert.equal(me(failed).damage, 1, '所选敌人攻击你（1 点伤害）')
  assert.ok(freshAsset(failed, '10066'), '选择攻击时不弃掉假证')
})

// ── 10067 狐面具 ─────────────────────────────────────────────────────────────
test('P6 10067 狐面具 每位调查员限 1 张[[面具]]；花 1 贡品本次检定 +2；离开有敌人的地点补 1 贡品', () => {
  const s = game()
  const mask = asset(s, '10067')
  assert.equal(canEquip(me(s), { code: '10067', traits: ['Mask'], slots: [] }), false, '已有面具时不能再装备面具')

  // [fast] 花费 1 贡品：+2 技能值，每次检定一次。
  s.skillTest = { seat: 0, skill: 'intellect', difficulty: 2, value: 3, committed: [], stage: 'ST.2' }
  let offered = false
  transact(s, draft => playerWindow(draft, 'test.beforeCommit', [], 0), choice => {
    const option = wants('狐面具')(choice)
    if (option) {
      offered = true
      return option
    }
    return 'skip'
  })
  assert.equal(offered, true, '检定中列出花费贡品的[fast]能力')
  assert.equal(freshAsset(s, '10067').uses, 1, '花费 1 个贡品')
  assert.equal(s.skillTest.pendingBonus, 2, '本次检定 +2 技能值')
  let again = false
  transact(s, draft => playerWindow(draft, 'test.beforeCommit', [], 0), choice => {
    if (wants('狐面具')(choice)) {
      again = true
      return wants('狐面具')(choice)
    }
    return 'skip'
  })
  assert.equal(again, false, '每次检定仅限一次（perTest 上限）')

  // 强制：移动离开有敌人的地点后补 1 贡品（上限 2）。
  const s2 = game()
  asset(s2, '10067').uses = 1
  const from = me(s2).location
  const to = 'attic'
  s2.locations.push({ id: to, name: '阁楼', clues: 0, shroud: 1, revealed: true, connections: [from] })
  enemy(s2, { location: from, engagedSeat: null })
  windowProbe(s2, 'move', { when: 'move', seat: 0, location: to, from })
  assert.equal(freshAsset(s2, '10067').uses, 2, '离开有敌人的地点后补满 1 个贡品')
  windowProbe(s2, 'move', { when: 'move', seat: 0, location: from, from: to })
  assert.equal(freshAsset(s2, '10067').uses, 2, '贡品不会超过 2 个')
})

// ── 10068 贝壳护符 ───────────────────────────────────────────────────────────
test('P6 10068 贝壳护符 横置加入 1-3 个[诅咒]标记：获得 1 资源，每加入 1 个再获得 1 资源', () => {
  const s = game()
  const charm = asset(s, '10068')
  me(s).resources = 5
  const action = abilityMove(s, charm.id, 0)
  assert.ok(action, '行动可用（混乱袋有诅咒标记空间）')
  move(s, action)
  settle(s, choice => (choice.kind === 'amount' ? '2' : null))
  assert.equal(s.chaosBag.filter(token => token === 'curse').length, 2, '加入 2 个[诅咒]标记')
  assert.equal(me(s).resources, 8, '获得 1 + 2 = 3 资源')
  const after = freshAsset(s, '10068')
  assert.equal(after.exhausted, true, '横置作为费用')
})
