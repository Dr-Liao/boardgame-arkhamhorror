// P6 M2-6（10069–10078）一般玩家卡 Node 验收。
//
// 覆盖策略：
//   · 每张卡至少一条真实行为断言（费用/目标/窗口/持续/负面路径）；
//   · 事件走真实打牌流程（core-fixture 的 move/settle）或真实窗口（reactionWindow/testEnds）；
//   · 支援能力走 legalMoves → move → settle；
//   · 有近似披露的卡（条目 note + artifacts/migration/fhv/primitive-requests/<code>.json）
//     断言的是近似后的真实行为。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, reactionWindow, getStat } from '../src/engine/engine.js'

import e10069 from '../src/cards/entries/10069.js'
import e10070 from '../src/cards/entries/10070.js'
import e10071 from '../src/cards/entries/10071.js'
import e10072 from '../src/cards/entries/10072.js'
import e10073 from '../src/cards/entries/10073.js'
import e10074 from '../src/cards/entries/10074.js'
import e10075 from '../src/cards/entries/10075.js'
import e10076 from '../src/cards/entries/10076.js'
import e10077 from '../src/cards/entries/10077.js'
import e10078 from '../src/cards/entries/10078.js'

const ENTRIES = [e10069, e10070, e10071, e10072, e10073, e10074, e10075, e10076, e10077, e10078]
// 索引尚未重建时自注册缺少的条目；索引重建后跳过（避免重复注册）。
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

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
    inv.engaged = []
  }
  for (const location of state.locations) location.clues = location.clues || 0
  return state
}

function transact (state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'fhvPlayerCardTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

function runDescriptor (state, code, kind, { context = {}, seat = 0, source = null, select = () => null, index = 0, ignoreCosts = true } = {}) {
  transact(state, draft => {
    const inv = draft.investigators[seat]
    const abilities = (registeredEntry(code)?.abilities || []).filter(ability => ability.kind === kind)
    const descriptor = kind === 'played' ? descriptorOfKind(code, 'played') : abilities[index]
    executeDescriptor(draft, {
      inv, source: source || { code }, descriptor, context, events: [], windowId: null, ignoreCosts,
    })
  }, select)
}

function playEvent (state, code, select = () => null) {
  const seat = state.currentSeat ?? 0
  state.investigators[seat].hand.push(code)
  move(state, { action: 'play', cardId: code })
  settle(state, select)
}

test('P6 10069 银行劫案：额外花费 1 行动，同地点调查员共获得 8 资源且可自由分配', () => {
  const s = game(2)
  const [first, second] = s.investigators
  const actionsBefore = first.actionsLeft
  // 前 4 个资源给座位 0、后 4 个给座位 1：验证「由你自由分配」。
  let point = 0
  playEvent(s, '10069', () => (point++ < 4 ? '0' : '1'))
  assert.equal(registeredEntry('10069').abilities[0].cost.action, 1, 'Double 的额外行动费用')
  assert.equal(s.investigators[0].actionsLeft, actionsBefore - 2, '普通打出 1 行动 + Double 额外 1 行动')
  assert.equal(s.investigators[0].resources, 30 - 2 + 4, '自己承担 2 费并分到 4 资源')
  assert.equal(s.investigators[1].resources, 30 + 4, '另一位分到 4 资源')
  assert.equal(s.investigators[0].resources + s.investigators[1].resources, 30 + 30 - 2 + 8, '总计 8 资源')
})

test('P6 10070 诈降：谈判打出手牌[[武器]]（费用 -1），并以[敏捷]用该武器攻击所选敌人', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['01016']
  const foe = enemy(s, { fight: 1, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  const weaponCost = Number(ALL_CARDS['01016'].cost)
  playEvent(s, '10070', choice => {
    if (choice.kind === 'effect') return choice.options.some(option => option.id === 'fight') ? 'fight' : null
    return choice.options[0]?.id ?? null
  })
  const weapon = s.investigators[0].assets.find(card => card.code === '01016')
  assert.ok(weapon, '[[武器]]支援被打出并留在场上')
  assert.equal(s.investigators[0].resources, 30 - 1 - Math.max(0, weaponCost - 1), '武器费用 -1')
  assert.equal(s.lastTestResult.skill, 'agility', '本次攻击使用[敏捷]')
  assert.ok(s.enemies.find(item => item.id === foe.id).damageTaken > 0, '对所选敌人造成了伤害')
})

test('P6 10071 诱骗：谈判[敏捷](0) 成功按超过点数获得资源（最多 6），失败则敌人攻击', () => {
  const success = game()
  enemy(success, { fight: 1, evade: 1, health: 10 })
  success.chaosBag = ['+2']
  playEvent(success, '10071')
  const successBy = success.lastTestResult.value - success.lastTestResult.difficulty
  assert.ok(successBy > 0, '检定成功且超过难度')
  assert.equal(success.investigators[0].resources, 30 + Math.min(6, successBy), '按超过点数获得资源（最多 6）')
  assert.equal(success.lastTestResult.skill, 'agility')
  assert.equal(success.lastTestResult.difficulty, 0)

  const failure = game()
  const attacker = enemy(failure, { fight: 1, evade: 1, health: 10, damage: 2, engagedSeat: 0 })
  failure.chaosBag = ['autofail']
  playEvent(failure, '10071')
  assert.equal(failure.investigators[0].damage, 2, '检定失败后该敌人攻击你')
  assert.ok(failure.enemies.some(item => item.id === attacker.id))
})

test('P6 10072 “我肯定还！”：快速借走同地点调查员全部资源，轮末自动归还并弃卡', () => {
  const s = game(2)
  const [first, second] = s.investigators
  first.resources = 2
  second.resources = 7
  s.phase = 'investigation'
  s.currentSeat = 0
  playEvent(s, '10072')
  assert.equal(s.investigators[0].resources, 9, '借走另一位调查员的全部 7 资源')
  assert.equal(s.investigators[1].resources, 0, '另一位的资源池清空')
  assert.ok(s.investigators[0].hand.includes('10072'), '本轮结束前留在手牌等待轮末归还')

  transact(s, draft => {
    reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, [])
  })
  assert.equal(s.investigators[0].resources, 0, '轮末把自己的全部资源还给对方')
  assert.equal(s.investigators[1].resources, 9, '对方拿回全部 9 资源')
  assert.equal(s.investigators[0].hand.includes('10072'), false, '轮末结算后不再留在手牌')
  assert.ok(s.investigators[0].discard.includes('10072'), '轮末结算后进入弃牌堆')
})

test('P6 10073 把水搅浑：谈判[智力](X=伤害+恐惧)，成功后对同地点每个敌人造成 2 伤害并可解除交战移动', () => {
  const s = game()
  const inv = s.investigators[0]
  const here = s.locations.find(location => location.id === inv.location)
  here.revealed = true
  const destination = { id: 'stir-destination', name: '连接地点', revealed: true, clues: 0, shroud: 1, connections: [here.id] }
  here.connections = [destination.id]
  s.locations.push(destination)
  const target = enemy(s, { fight: 1, evade: 1, health: 20, damage: 2, horror: 1, engagedSeat: 0 })
  const other = enemy(s, { fight: 1, evade: 1, health: 20, damage: 0, horror: 0, engagedSeat: null })
  s.chaosBag = ['+3']
  playEvent(s, '10073', choice => {
    if (choice.kind === 'target') return target.id
    if (choice.kind === 'effect') return choice.options.some(option => option.id === 'move') ? 'move' : null
    if (choice.kind === 'location') return destination.id
    return choice.options[0]?.id ?? null
  })
  assert.equal(s.lastTestResult.difficulty, 3, 'X = 该敌人的伤害 2 + 恐惧 1')
  assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2, '所选敌人受到 2 伤害')
  assert.equal(s.enemies.find(item => item.id === other.id).damageTaken, 2, '同地点的每个敌人都受到 2 伤害')
  assert.equal(s.investigators[0].location, destination.id, '超过难度 2 点后可以解除交战并移动')
  assert.equal(s.investigators[0].engaged.length, 0, '与每个敌人解除交战')
})

test('P6 10074 自由表演：谈判检定任意技能(3)，按所选技能结算（战斗 2 伤害 / 意志移除毁灭）', () => {
  const combat = game()
  const target = enemy(combat, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  combat.chaosBag = ['+3']
  playEvent(combat, '10074', choice => {
    if (choice.kind === 'skill') return 'combat'
    return choice.options[0]?.id ?? null
  })
  assert.equal(combat.enemies.find(item => item.id === target.id).damageTaken, 2, '检定[战斗]成功：造成 2 伤害')

  const will = game()
  const doomed = enemy(will, { fight: 1, evade: 1, health: 10, doom: 2, engagedSeat: 0 })
  will.chaosBag = ['+3']
  playEvent(will, '10074', choice => {
    if (choice.kind === 'skill') return 'willpower'
    return choice.options[0]?.id ?? null
  })
  assert.equal(will.enemies.find(item => item.id === doomed.id).doom, 1, '检定[意志]成功：移除 1 个毁灭标记')
})

test('P6 10075 福倚祸伏：揭示[诅咒]标记时从手牌投入，并获得 3 个[万能]图标的价值', () => {
  const s = game()
  const inv = s.investigators[0]
  const base = getStat(s, inv, 'willpower')
  inv.hand = ['10075']
  // 诅咒标记默认会「再揭示一个标记」，因此袋里还需要第二枚标记。
  s.chaosBag = ['curse', '0']
  s.debugNextTokens = ['curse']
  s.campaign.chaosBag = ['curse', '0']
  const difficulty = base + 1
  transact(s, draft => {
    executeDescriptor(draft, {
      inv: draft.investigators[0], source: { code: '01001' }, context: {}, events: [], windowId: null, ignoreCosts: true,
      descriptor: { kind: 'action', resolve: ({ api }) => api.test(0, 'willpower', difficulty, {
        source: { label: '谈判', actionKind: 'parley' },
      }) },
    })
  }, choice => choice.options.find(option => option.cardCode === '10075')?.id ?? null)
  assert.equal(s.lastTestResult.success, true, '基础值 + 诅咒 -2 + 4 点图标价值后成功')
  assert.equal(s.lastTestResult.value, base + 2, '诅咒 -2、印刷 1 与获得 3 个[万能]图标都计入本次检定')
  assert.equal(s.investigators[0].hand.includes('10075'), false, '本卡从手牌投入')
  assert.ok(s.investigators[0].discard.includes('10075'), '检定结束后进入弃牌堆')

  // 负面路径：没有诅咒标记时不会触发从手牌投入。
  const plain = game()
  plain.investigators[0].hand = ['10075']
  plain.chaosBag = ['0']
  plain.debugNextTokens = ['0']
  plain.campaign.chaosBag = ['0']
  transact(plain, draft => {
    executeDescriptor(draft, {
      inv: draft.investigators[0], source: { code: '01001' }, context: {}, events: [], windowId: null, ignoreCosts: true,
      descriptor: { kind: 'action', resolve: ({ api }) => api.test(0, 'willpower', 1, {
        source: { label: '谈判', actionKind: 'parley' },
      }) },
    })
  }, choice => choice.options.find(option => option.cardCode === '10075')?.id ?? null)
  assert.ok(plain.investigators[0].hand.includes('10075'), '不是[诅咒]标记时留在手牌')
})

test('P6 10076 脚步轻盈：躲避检定成功后自动躲避所在地点的另一个敌人', () => {
  const s = game()
  const inv = s.investigators[0]
  const evaded = enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  const another = enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: null })
  s.skillTest = {
    seat: 0, skill: 'agility', difficulty: 1, committed: [{ seat: 0, code: '10076', icons: 1 }],
  }
  runDescriptor(s, '10076', 'reaction', {
    context: { when: 'evadeSuccess', seat: 0, enemy: evaded, location: inv.location, successBy: 1 },
  })
  const fresh = s.enemies.find(item => item.id === another.id)
  assert.equal(fresh.exhausted, true, '另一个敌人被自动躲避（横置）')
  assert.equal(fresh.engagedSeat, null, '自动躲避后不与你交战')
})

test('P6 10077 不列颠斗牛犬左轮手枪：花 1 子弹以[敏捷]攻击（+2 技能值/+1 伤害）；谈判检定失败后从手牌入场', () => {
  const s = game()
  const gun = asset(s, '10077')
  const foe = enemy(s, { fight: 1, evade: 1, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  const agilityBase = getStat(s, s.investigators[0], 'agility')
  const command = legalMoves(s, 0).find(item => item.action === 'ability'
    && item.assetId === gun.id && item.targetId === foe.id)
  assert.ok(command, '花费 1 子弹的攻击能力进入合法动作')
  move(s, command)
  settle(s, choice => choice.kind === 'skill'
    ? (choice.options.find(option => option.id === 'agility')?.id ?? null)
    : null)
  const freshGun = s.investigators[0].assets.find(item => item.id === gun.id)
  assert.equal(freshGun.uses, 2, '花费 1 子弹')
  assert.equal(s.lastTestResult.skill, 'agility', '可使用[敏捷]替代[战斗]')
  assert.equal(s.lastTestResult.value, agilityBase + 2, '技能值 +2')
  assert.equal(s.enemies.find(item => item.id === foe.id).damageTaken, 2, '造成 +1 伤害（合计 2）')

  const parleyFail = game()
  parleyFail.investigators[0].hand = ['10077']
  enemy(parleyFail, { fight: 1, evade: 1, health: 20, engagedSeat: 0 })
  parleyFail.chaosBag = ['0']
  transact(parleyFail, draft => {
    executeDescriptor(draft, {
      inv: draft.investigators[0], source: { code: '01001' }, context: {}, events: [], windowId: null, ignoreCosts: true,
      descriptor: { kind: 'action', resolve: ({ api }) => api.test(0, 'willpower', 8, {
        source: { label: '谈判', actionKind: 'parley', enemyId: draft.enemies[0]?.id },
      }) },
    })
  }, choice => choice.options.find(option => option.cardCode === '10077')?.id ?? null)
  const placed = parleyFail.investigators[0].assets.find(item => item.code === '10077')
  assert.ok(placed, '谈判检定失败后从手牌放置入场')
  assert.equal(placed.uses, 3, '入场时带 3 子弹')
  assert.equal(parleyFail.investigators[0].resources, 30, '放置入场不支付打出费用')
})

test('P6 10078 告密：快速在谈判检定成功后打出，从所在地点与连接地点共发现 2 个线索', () => {
  const s = game()
  const inv = s.investigators[0]
  const here = s.locations.find(location => location.id === inv.location)
  here.revealed = true
  here.clues = 2
  const next = { id: 'snitch-next', name: '连接地点', revealed: true, clues: 2, shroud: 1, connections: [here.id] }
  here.connections = [next.id]
  s.locations.push(next)
  inv.hand = ['10078']
  inv.resources = 5
  s.chaosBag = ['0']
  transact(s, draft => {
    executeDescriptor(draft, {
      inv: draft.investigators[0], source: { code: '01001' }, context: {}, events: [], windowId: null, ignoreCosts: true,
      descriptor: { kind: 'action', resolve: ({ api }) => api.test(0, 'willpower', 1, {
        source: { label: '谈判', actionKind: 'parley' },
      }) },
    })
  }, choice => {
    if (choice.options.some(option => option.cardCode === '10078')) {
      return choice.options.find(option => option.cardCode === '10078').id
    }
    return null
  })
  assert.equal(s.investigators[0].clues, 2, '发现总计 2 个线索')
  assert.equal(s.investigators[0].resources, 4, '支付 1 费')
  assert.equal(s.investigators[0].hand.includes('10078'), false, '快速事件结算后离手')
  assert.ok(s.investigators[0].discard.includes('10078'), '快速事件结算后进入弃牌堆')
})
