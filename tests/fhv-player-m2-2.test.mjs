// P6 M2-2（10029–10038）一般玩家卡 Node 验收。
//
// 覆盖策略：
//   · 每张卡至少一条真实行为断言（费用/目标/窗口/持续/负面路径之一）；
//   · 事件用真实描述子执行入口（executeDescriptor + resolveTransaction，与 tsk-player-m2-2 同口径）；
//   · 支援能力同样走 executeDescriptor —— 桌面按钮/AI 的唯一执行入口；技能卡用真实检定流程
//     （api.test → 投入窗口 → 揭示 → 成功结算），断言混乱袋/伤害的真实变化；
//   · 事务提交的是克隆状态：所有断言都在事务结束后按 id/code 重新取实体，选择器用 memo 缓存
//     （同一 choiceId 只决策一次，事务重放时逐字一致）；
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, validateMove } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind } from '../src/engine/ability.js'
import { executeDescriptor, commitIcons, getStat } from '../src/engine/engine.js'
import { commitProfile } from '../src/engine/lifecycle.js'

import e10029 from '../src/cards/entries/10029.js'
import e10030 from '../src/cards/entries/10030.js'
import e10031 from '../src/cards/entries/10031.js'
import e10032 from '../src/cards/entries/10032.js'
import e10033 from '../src/cards/entries/10033.js'
import e10034 from '../src/cards/entries/10034.js'
import e10035 from '../src/cards/entries/10035.js'
import e10036 from '../src/cards/entries/10036.js'
import e10037 from '../src/cards/entries/10037.js'
import e10038 from '../src/cards/entries/10038.js'

const ENTRIES = [e10029, e10030, e10031, e10032, e10033, e10034, e10035, e10036, e10037, e10038]

// 索引尚未重建时自注册缺少的条目；索引重建后跳过（避免重复注册）。
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
  resolveTransaction(state, 0, { action: 'fhvPlayerM22Test' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 180, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
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

function runAbility (state, code, { index = 0, context = {}, seat = 0, source = null, select = () => null, alreadyPaid = false } = {}) {
  const sourceId = source?.id ?? null
  transact(state, draft => {
    const inv = draft.investigators[seat]
    const descriptor = (registeredEntry(code)?.abilities || [])[index]
    const draftSource = sourceId ? (inv.assets.find(item => item.id === sourceId) || { id: sourceId, code }) : source
    executeDescriptor(draft, {
      inv, source: draftSource || { code }, descriptor, context, events: [],
      windowId: null, alreadyPaid, ignoreCosts: alreadyPaid,
    })
  }, select)
}

function runTest (state, { seat = 0, skill = 'intellect', difficulty = 1, select = () => null } = {}) {
  transact(state, draft => {
    const inv = draft.investigators[seat]
    executeDescriptor(draft, {
      inv, source: { code: inv.code }, context: {}, events: [], windowId: null, ignoreCosts: true,
      descriptor: { kind: 'action', cost: {}, resolve: ({ api }) => api.test(seat, skill, difficulty, {}) },
    })
  }, select)
}

const byCode = (state, code, seat = 0) => (state.investigators[seat].assets || []).find(item => item.code === code) || null
const blessCount = state => (state.chaosBag || []).filter(token => token === 'bless').length

test('P6 10029 净化：可投入任意检定，成功后按超出难度点数加入祝福标记（每次检定最多 1 张）', () => {
  const profile = commitProfile('10029')
  assert.equal(profile.anySkill, true, '任意类型检定由 skill.anySkill 放行')
  assert.equal(profile.maxPerTest, 1, '每次技能检定最多投入 1 张')

  const s = game()
  s.investigators[0].hand = ['10029']
  s.chaosBag = ['+2']
  assert.equal(commitIcons(s, s.investigators[0], '10029', ['intellect']), 0, '净化本身没有技能图标')
  const commitOnce = memo(choice => (choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null))
  runTest(s, { skill: 'intellect', difficulty: 1, select: commitOnce })
  const inv = s.investigators[0]
  assert.equal(s.lastTestResult.success, true, '净化被投入且检定成功')
  const successBy = Math.min(5, s.lastTestResult.value - s.lastTestResult.difficulty)
  assert.ok(successBy >= 1)
  assert.equal(blessCount(s), successBy, '每超出 1 点加入 1 个祝福标记')
  assert.equal(inv.discard.includes('10029'), true, '投入后进入弃牌堆')

  // 负面路径：检定失败时不净化。
  const failed = game()
  failed.investigators[0].hand = ['10029']
  failed.chaosBag = ['-4']
  runTest(failed, { skill: 'intellect', difficulty: 1, select: commitOnce })
  assert.equal(failed.lastTestResult.success, false)
  assert.equal(blessCount(failed), 0, '失败不加入祝福标记')
})

test('P6 10030 手眼协调：不支付[action]费用结算[[工具]]支援上的[action]能力', () => {
  registerCardAbilities({
    code: 'p6m22Tool',
    abilities: [{
      kind: 'action', label: 'P6 工具行动', cost: { action: true },
      resolve: ({ inv, api }) => { api.gainResources(inv.seat, 1) },
    }],
  })
  const s = game()
  const inv = s.investigators[0]
  const tool = asset(s, 'p6m22Tool', { traits: ['Tool'] })
  const toolId = tool.id
  inv.actionsLeft = 2
  inv.resources = 5
  inv.hand = ['10030']
  // 只有自己回合才能打出（真实 playCondition predicate）。
  assert.equal(e10030.playCondition[0].when({ inv, state: s }), true)
  const otherTurn = { ...s, currentSeat: 1, turnSeat: 1 }
  assert.equal(e10030.playCondition[0].when({ inv, state: otherTurn }), false, '别人的回合不能打出')

  runPlayed(s, '10030', {})
  const after = s.investigators[0]
  assert.equal(after.resources, 6, '工具支援的[action]能力被真实结算')
  assert.equal(after.actionsLeft, 2, '没有支付该能力的[action]费用')
  assert.equal(after.assets.find(item => item.id === toolId).exhausted, false, '这张牌没有让支援横置')
})

test('P6 10031 膂力过人：投入近战支援的攻击 +1 伤害；揭示后受伤可取消标记并重抽', () => {
  registerCardAbilities({
    code: 'p6m22Weapon',
    abilities: [{
      kind: 'action', countsAs: 'fight', target: { kind: 'enemy' }, cost: { action: true },
      resolve: ({ inv, target, api }) => { api.fight(inv.seat, target.entity.id) },
    }],
  })
  const fight = (withCard) => {
    const s = game()
    const inv = s.investigators[0]
    const foe = enemy(s, { fight: 1, evade: 1, health: 40, damageTaken: 0 })
    const foeId = foe.id
    const weapon = asset(s, 'p6m22Weapon', { traits: ['Melee', 'Weapon'] })
    inv.hand = withCard ? ['10031'] : []
    s.chaosBag = ['0']
    runAbility(s, 'p6m22Weapon', {
      source: weapon, context: { targetId: foeId },
      select: memo(choice => (choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null)),
    })
    return { s, foe: s.enemies.find(item => item.id === foeId) }
  }
  const plain = fight(false)
  assert.equal(plain.foe.damageTaken, 1, '未投入时基础伤害 1')
  const boosted = fight(true)
  assert.equal(boosted.s.lastTestResult.success, true)
  assert.equal(boosted.foe.damageTaken, 2, '投入近战支援的攻击 +1 伤害')

  // 揭示后：受到 1 点伤害取消该标记并重抽。
  const reroll = game()
  const inv = reroll.investigators[0]
  const foe = enemy(reroll, { fight: 1, evade: 1, health: 40 })
  const foeId = foe.id
  const weapon = asset(reroll, 'p6m22Weapon', { traits: ['Melee', 'Weapon'] })
  inv.hand = ['10031']
  reroll.chaosBag = ['0', '-4', '+2']
  reroll.debugNextTokens = ['-4', '+2']
  let rerolled = 0
  runAbility(reroll, 'p6m22Weapon', {
    source: weapon, context: { targetId: foeId },
    select: memo(choice => {
      if (choice.kind === 'commit') return choice.options.some(option => option.id === '0') ? '0' : null
      const option = choice.options.find(item => /膂力过人/.test(String(item.label || '')) && item.id !== 'skip')
      if (!option) return null
      const allow = rerolled === 0
      if (allow) rerolled += 1
      return allow ? option.id : null
    }),
  })
  assert.equal(rerolled, 1, '揭示混乱标记后列出并触发一次膂力过人')
  assert.equal(reroll.investigators[0].damage, 1, '受到 1 点伤害作为费用')
  assert.equal(reroll.lastTestResult.success, true, '重抽后的新标记使检定成功')
  assert.equal(reroll.lastTestResult.drawn.at(-1), '+2', '结算的是取消后重新揭示的标记')
})

test('P6 10032 恢复元气：第一个行动才可打出，本轮抽到诡计则改为治愈 3 点', () => {
  assert.equal(e10032.playCondition[0].when({ inv: { actionsTakenThisTurn: 0 } }), true)
  assert.equal(e10032.playCondition[0].when({ inv: { actionsTakenThisTurn: 1 } }), false, '不是第一个行动时不能打出')

  const withTreachery = game()
  withTreachery.investigators[0].damage = 3
  withTreachery.investigators[0].deck = Array(6).fill('01088')
  withTreachery.investigators[0].drewTreacheryRound = withTreachery.round
  runPlayed(withTreachery, '10032', {})
  assert.equal(withTreachery.investigators[0].damage, 0, '本轮抽到诡计：治愈 3 点伤害')
  assert.equal(withTreachery.investigators[0].hand.length, 1, '抽 1 张牌')

  const plain = game()
  plain.investigators[0].damage = 3
  plain.investigators[0].deck = Array(6).fill('01088')
  runPlayed(plain, '10032', {})
  assert.equal(plain.investigators[0].damage, 1, '未抽到诡计时只治愈 2 点伤害')
  assert.equal(plain.investigators[0].hand.length, 1, '抽 1 张牌')
})

test('P6 10033 清理工具套装：补给可代付弹药，花费时横置使本次检定 +2 技能值', () => {
  registerCardAbilities({
    code: 'p6m22Ammo',
    uses: 1,
    usesType: 'ammo',
    abilities: [{
      kind: 'action', countsAs: 'fight', target: { kind: 'enemy' }, cost: { action: true, uses: 1 },
      resolve: ({ inv, target, api }) => { api.fight(inv.seat, target.entity.id) },
    }],
  })
  const build = withKit => {
    const s = game()
    const foe = enemy(s, { fight: 5, evade: 1, health: 40 })
    const weapon = asset(s, 'p6m22Ammo')
    const kit = withKit ? asset(s, '10033') : null
    const kitId = kit?.id ?? null
    s.chaosBag = ['0']
    let triggered = 0
    runAbility(s, 'p6m22Ammo', {
      source: weapon, context: { targetId: foe.id },
      select: memo(choice => {
        if (choice.kind === 'effect') {
          const paidFromKit = choice.options.find(option => option.cardCode === '10033')
          if (paidFromKit) return paidFromKit.id
        }
        const option = choice.options.find(item => /清理工具套装/.test(String(item.label || '')) && item.id !== 'skip')
        if (!option) return null
        triggered += 1
        return triggered <= 1 ? option.id : null
      }),
    })
    return { s, kitId, triggered }
  }
  const control = build(false)
  assert.equal(control.triggered, 0, '没有清理工具套装时没有代付窗口')
  assert.equal(control.s.lastTestResult.success, false, '没有 +2 时 4 点对上难度 5 失败')
  const withKit = build(true)
  const kit = withKit.s.investigators[0].assets.find(item => item.id === withKit.kitId)
  assert.equal(kit.uses, 3, '从清理工具套装支付 1 点补给')
  assert.equal(kit.usesType, 'supplies')
  assert.equal(kit.exhausted, true, '反应费用为横置')
  assert.equal(withKit.triggered, 1, '花费补给时触发一次反应')
  assert.equal(withKit.s.lastTestResult.success, true, '+2 技能值把结果从失败翻为成功')
  assert.equal(withKit.s.lastTestResult.value, control.s.lastTestResult.value + 2, '本次检定 +2 技能值')
})

test('P6 10034 蒙福之刃：战斗 +2、成功 +1 伤害，揭示的祝福返回混乱袋，可横置预加 2 祝福', () => {
  const s = game()
  const foe = enemy(s, { fight: 1, evade: 1, health: 30 })
  const foeId = foe.id
  const blade = asset(s, '10034')
  const bladeId = blade.id
  s.chaosBag = ['bless', '0']
  s.debugNextTokens = ['bless']
  runAbility(s, '10034', {
    source: blade, context: { targetId: foeId },
    select: memo(choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null)),
  })
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.enemies.find(item => item.id === foeId).damageTaken, 2, '成功时基础伤害 1 + 1')
  assert.equal(blessCount(s), 1, '本次攻击揭示的祝福标记返回混乱袋')
  assert.equal(s.investigators[0].assets.find(item => item.id === bladeId).exhausted, false, '没有横置')

  const preloaded = game()
  const foe2 = enemy(preloaded, { fight: 1, evade: 1, health: 30 })
  const blade2 = asset(preloaded, '10034')
  const blade2Id = blade2.id
  preloaded.chaosBag = ['0']
  preloaded.debugNextTokens = ['0']
  runAbility(preloaded, '10034', {
    source: blade2, context: { targetId: foe2.id },
    select: memo(choice => (choice.options.some(option => option.id === 'exhaust') ? 'exhaust' : null)),
  })
  assert.equal(preloaded.investigators[0].assets.find(item => item.id === blade2Id).exhausted, true, '横置支付')
  assert.equal(blessCount(preloaded), 2, '揭示前加入 2 个祝福标记')
  assert.equal(preloaded.enemies.find(item => item.id === foe2.id).damageTaken, 2)
})

test('P6 10035 瓦卢西亚之瞳：谈判放置充能并按指定敌人与行动修正本轮检定；快速交换到幽嘶之刃', () => {
  const s = game()
  const inv = s.investigators[0]
  const foe = enemy(s, { fight: 2, evade: 2, health: 30 })
  const eyes = asset(s, '10035')
  const eyesId = eyes.id
  const baseCombat = getStat(s, inv, 'combat')
  assert.equal(registeredEntry('10035').abilities[0].actionKind, 'parley', '第一个能力按谈判行动结算')
  runAbility(s, '10035', { index: 0, source: eyes, context: { targetId: foe.id } })
  assert.equal(byCode(s, '10035').uses, 1, '放置 1 点充能')
  const effect = (s.effects || []).find(record => record.sourceCode === '10035')
  assert.ok(effect, '写入本轮持续效果')
  assert.equal(effect.duration, 'endOfRound')
  assert.equal(effect.modifiers[0].condition.testEnemyId, foe.id, '修正只指向所选敌人')
  assert.equal(getStat(s, s.investigators[0], 'combat'), baseCombat, '检定外没有普通技能值加成')
  assert.ok(s.investigators[0].assets.some(item => item.id === eyesId))

  // [fast] 交换：从绑定区检索，充能随之移动。
  const swap = game()
  const valusia = asset(swap, '10035', { uses: 2 })
  runAbility(swap, '10035', { index: 1, source: valusia })
  const blade = byCode(swap, '10036')
  assert.ok(blade, '幽嘶之刃放置入场')
  assert.equal(blade.uses, 2, '所有充能从瓦卢西亚之瞳移动过来')
  assert.equal(Object.values(swap.bondedSets).some(set => set.cards.includes('10035')), true, '被换下的卡返回绑定区')
  assert.equal(swap.investigators[0].assets.some(item => item.code === '10035'), false, '瓦卢西亚之瞳离开场上')
})

test('P6 10036 幽嘶之刃：花费 1-3 充能攻击，每点 +2 技能值 / +1 伤害，可用意志代替战斗', () => {
  const s = game()
  const foe = enemy(s, { fight: 1, evade: 1, health: 40 })
  const foeId = foe.id
  const blade = asset(s, '10036', { uses: 3 })
  const bladeId = blade.id
  s.chaosBag = ['+1']
  runAbility(s, '10036', {
    source: blade, context: { targetId: foeId },
    select: memo(choice => {
      if (choice.options.some(option => option.id === 'willpower')) return 'willpower'
      if (choice.options.some(option => option.id === '2')) return '2'
      return null
    }),
  })
  assert.equal(s.investigators[0].assets.find(item => item.id === bladeId).uses, 0, '共花费 1+2 点充能')
  assert.equal(s.lastTestResult.skill, 'willpower', '改为使用[willpower]检定')
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.enemies.find(item => item.id === foeId).damageTaken, 4, '基础 1 点 + 每点充能 1 点伤害')

  // [fast] 交换：幽嘶之刃返回绑定区，弃掉所有充能。
  const swap = game()
  const eyes = asset(swap, '10035', { uses: 2 })
  runAbility(swap, '10035', { index: 1, source: eyes })
  const yoth = byCode(swap, '10036')
  runAbility(swap, '10036', { index: 1, source: yoth })
  assert.ok(byCode(swap, '10035'), '瓦卢西亚之瞳放置入场')
  assert.equal(Object.values(swap.bondedSets).some(set => set.cards.includes('10036')), true, '幽嘶之刃返回绑定区')
  assert.equal(swap.investigators[0].assets.some(item => item.code === '10036'), false, '幽嘶之刃离开场上')
})

test('P6 10037 旋风连击：Double 额外花费 1 行动，用近战支援连续攻击并结束回合', () => {
  const s = game(2)
  const inv = s.investigators[0]
  const foe = enemy(s, { fight: 1, evade: 1, health: 40 })
  const foeId = foe.id
  asset(s, '10034')
  inv.hand = ['10037']
  inv.resources = 6
  s.chaosBag = ['0', '0', '0', '0', '0']
  assert.equal(e10037.playCondition[0].when({ inv }), true, '控制[[近战]]支援才能打出')
  assert.equal(e10037.playCondition[0].when({ inv: { ...inv, assets: [] } }), false, '没有近战支援不能打出')

  // 额外费用：没有行动时打出被拒绝（played 描述子的 cost.action 读点）。
  inv.actionsLeft = 0
  assert.ok(validateMove(s, 0, { action: 'play', cardId: '10037' }), '没有行动时不能支付 Double 的额外费用')
  inv.actionsLeft = 3

  let repeatsOffered = 0
  const select = memo(choice => {
    if (choice.options.some(option => option.id === 'repeat')) {
      repeatsOffered += 1
      return repeatsOffered === 1 ? 'repeat' : 'done'
    }
    if (choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  })
  move(s, { action: 'play', cardId: '10037' })
  settle(s, select)
  assert.equal(repeatsOffered, 2, '两次攻击后各提供一次重复机会')
  assert.equal(s.investigators[0].resources, 4, '支付 2 资源')
  assert.equal(s.enemies.find(item => item.id === foeId).damageTaken, 4, '两次蒙福之刃攻击（每次 2 点伤害）')
  assert.equal(s.currentSeat, 1, '最后一次攻击结算后结束本回合')
})

test('P6 10038 奇迹祝愿：祝福揭示后快速打出，转瞬为神入场并按揭示数放置祝愿', () => {
  const entry = registeredEntry('10038')
  assert.equal(entry.removeAfterPlay, true, '打出结算后移出游戏')
  const descriptor = descriptorOfKind('10038', 'played')
  assert.equal(descriptor.fast, true, '快速事件')
  assert.ok(descriptor.trigger.includes('chaosTokenRevealed'), '窗口：技能检定揭示标记后')
  const inv0 = game().investigators[0]
  const atLocation = { when: 'chaosTokenRevealed', token: 'bless', location: inv0.location }
  assert.equal(descriptor.criteria[0]({ inv: inv0, context: atLocation }), true)
  assert.equal(descriptor.criteria[0]({ inv: inv0, context: { ...atLocation, token: '-1' } }), false, '非祝福标记不满足')
  assert.equal(descriptor.criteria[0]({ inv: inv0, context: { ...atLocation, location: 'elsewhere' } }), false, '不在你的地点不满足')

  const s = game()
  const inv = s.investigators[0]
  s.chaos = { revealed: ['bless', 'bless'], frames: [0], sealed: [], removed: [], orders: [] }
  runPlayed(s, '10038', {
    context: { when: 'chaosTokenRevealed', seat: 0, location: inv.location, token: 'bless' },
    select: memo(choice => (choice.options.some(option => option.id === '2') ? '2' : null)),
  })
  const ascension = byCode(s, '10039')
  assert.ok(ascension, '检索绑定卡并把转瞬为神放置入场')
  assert.equal(ascension.uses, 2, '按本次揭示的祝福数量放置 2 个祝愿')
  assert.equal(s.investigators[0].hand.includes('10039'), false, '绑定卡已离开手牌')
})
