// 回合收尾窗口：行动点用尽（0 行动）之后，「快速。只能在你回合期间打出」的手牌
// 仍然可以在「行动结束」玩家窗口里打出；「将要被击败」的救命卡也不会因为结算
// 已经处在一张快速卡/反应内部而被吞掉。
//
// 回归的是两个真实症状：
//   1. 用完最后一个行动 → applyMoveUnchecked 立刻 advanceInvestigator，
//      手牌里的快速卡永远没有打出的时机（旧窗口只列装备上的免费能力）。
//   2. 致命伤害发生在快速卡结算内部时，reactionWindow 的嵌套保护直接返回，
//      调查员被直接判定击败并结束回合，来不及打出「死里逃生」这类救命卡。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, answer, move } from './core-fixture.mjs'
import { checkDefeated } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const me = state => state.investigators[0]

test('行动点用尽后，收尾窗口仍可打出「只能在你回合期间打出」的快速卡', () => {
  const state = fixture('01001')
  me(state).actionsLeft = 1
  me(state).hand = ['01036']
  me(state).resources = 5
  move(state, { action: 'draw' })
  assert.equal(me(state).actionsLeft, 0)
  assert.equal(state.pendingChoice?.kind, 'playerWindow')
  const option = state.pendingChoice.options.find(option => option.id === 'fast-card:01036')
  assert.ok(option, '收尾窗口必须列出 0 费的快速卡')
  answer(state, option.id)
  assert.ok(!me(state).hand.includes('01036'))
  assert.ok(me(state).discard.includes('01036'), '快速事件打出后正常进弃牌堆')
  assert.equal(state.round, 2, '打完快速卡后窗口没有剩余选项，回合正常结束进入下一轮')
})

test('收尾窗口在一张快速卡打完后会再次列出其余快速卡', () => {
  const state = fixture('01001')
  me(state).actionsLeft = 1
  me(state).hand = ['01036', '02017']
  me(state).resources = 5
  move(state, { action: 'draw' })
  answer(state, 'fast-card:01036')
  assert.equal(state.pendingChoice?.kind, 'playerWindow')
  assert.ok(state.pendingChoice.options.some(option => option.id === 'fast-card:02017'))
  answer(state, 'fast-card:02017')
  assert.deepEqual([...me(state).discard].sort(), ['01036', '02017'])
})

test('普通牌与付不起的快速卡不会出现在收尾窗口', () => {
  const ordinary = fixture('01001')
  me(ordinary).actionsLeft = 1
  me(ordinary).hand = ['01088'] // 「获得 3 资源」是普通事件：要花 1 行动
  me(ordinary).resources = 5
  move(ordinary, { action: 'draw' })
  assert.equal(ordinary.pendingChoice, null)
  assert.equal(ordinary.round, 2)
  assert.ok(me(ordinary).hand.includes('01088'))

  const poor = fixture('01001')
  me(poor).actionsLeft = 1
  me(poor).hand = ['01036']
  me(poor).resources = 0
  move(poor, { action: 'draw' })
  assert.equal(poor.pendingChoice, null)
  assert.equal(poor.round, 2)
  assert.ok(me(poor).hand.includes('01036'), '付不起的快速卡不能被窗口打出去')
})

test('免费触发能力与快速卡并列在同一个收尾窗口', () => {
  const state = fixture('01001')
  asset(state, '01518')
  me(state).actionsLeft = 1
  me(state).hand = ['01036']
  me(state).resources = 5
  move(state, { action: 'draw' })
  const labels = state.pendingChoice.options.map(option => option.label)
  assert.ok(labels.some(label => label.includes('巡警')), '装备上的免费能力仍然照旧列出')
  assert.ok(labels.some(label => label.includes('心胜于物')), '快速卡与免费能力共用同一个窗口')
})

test('主动结束回合时同样会打开快速卡窗口', () => {
  const state = fixture('01001')
  me(state).hand = ['01036']
  me(state).resources = 5
  me(state).actionsLeft = 3
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'playerWindow')
  assert.ok(state.pendingChoice.options.some(option => option.id === 'fast-card:01036'))
  answer(state, 'skip')
  assert.equal(state.round, 2)
})

test('致命伤害先开「将受到伤害」窗口，取消牌可以救命', () => {
  const state = fixture('01001')
  me(state).damage = me(state).maxHealth - 1
  me(state).hand = ['04111']
  me(state).resources = 10
  enemy(state, { damage: 2, horror: 0, fight: 99 })
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const save = state.pendingChoice.options.find(option => option.label.includes('坚韧不拔'))
  assert.ok(save, '致命伤害前必须给出取消伤害的快速卡')
  answer(state, save.id)
  assert.equal(state.pendingChoice?.kind, 'harm')
  answer(state, '2:0')
  assert.equal(me(state).defeated, false)
  assert.equal(me(state).damage, me(state).maxHealth - 1)
})

test('致命伤害的「将要被击败」窗口可以跳过，跳过后才判定击败', () => {
  const state = fixture('01001')
  me(state).damage = me(state).maxHealth - 1
  me(state).hand = ['03310']
  me(state).resources = 10
  enemy(state, { damage: 2, horror: 0, fight: 99 })
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  assert.ok(state.pendingChoice.options.some(option => option.label.includes('死里逃生')))
  answer(state, 'skip')
  assert.equal(me(state).defeated, true)
})

test('回合结束时的强制恐惧同样能在击败前打出救命卡', () => {
  const state = fixture('01001')
  me(state).horror = me(state).maxSanity - 1
  me(state).hand = ['01013', '03310'] // 黑暗回忆：回合结束时揭示并受到 2 点恐惧
  me(state).resources = 10
  me(state).actionsLeft = 1
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const save = state.pendingChoice.options.find(option => option.label.includes('死里逃生'))
  assert.ok(save, '回合结束的强制恐惧也不能跳过救命窗口')
  answer(state, save.id)
  assert.equal(me(state).defeated, false)
})

test('致命伤害发生在反应结算内部时仍会开「将要被击败」窗口', () => {
  const state = fixture('01001')
  me(state).hand = ['03310']
  me(state).resources = 10
  me(state).damage = me(state).maxHealth
  // playReactionCard 在结算快速卡期间会写 state._reaction；这里构造同一状态，
  // 验证「已经处在一个窗口里」不会吞掉被击败前的救命窗口。
  state._reaction = { when: 'customReaction', seat: 0, context: {} }
  const execute = (draft, seat, command, events) => { checkDefeated(draft, seat, events) }
  resolveTransaction(state, 0, { action: 'draw' }, execute)
  assert.equal(state.pendingChoice?.kind, 'reaction')
  const option = state.pendingChoice.options.find(item => item.label?.includes('死里逃生'))
  assert.ok(option, '嵌套结算里也必须给出救命卡')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id }, execute)
  assert.equal(me(state).defeated, false)
  assert.equal(me(state).damage, me(state).maxHealth - 2)
  assert.equal(state._reaction?.when, 'customReaction', '嵌套窗口结束后必须恢复外层反应上下文')
})
