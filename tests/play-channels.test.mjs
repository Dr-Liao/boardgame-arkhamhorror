// 「如同手牌」通道统一原语（src/engine/play-channels.js）回归。
//
// 收敛前这些存储形状各窗口支持不一致，反复出现同一类 bug：
//   · 05013 银暮匕首（beneath）漏了快速事件反应窗口/能力窗口；
//   · 05002 直觉牌库漏了快速事件窗口；
//   · 背包（04037）/ 原定计划（03264）/ 弃牌堆（温蒂的护身符）/ 宿主附属（05279）漏了
//     收尾玩家窗口与能力窗口。
// 本文件按「通道 × 窗口」矩阵验收统一后的行为，并校验服务端下发的 uiKey 能把选项挂回牌桌实体。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset } from './core-fixture.mjs'
import { reactionWindow, playerWindow, legalMoves } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { choicePresentation, entityMoves } from '../web/card-interactions.js'

const me = state => state.investigators[0]

function baseState() {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = []
  inv.discard = []
  inv.resources = 10
  for (const location of state.locations) location.clues = Math.max(1, location.clues || 0)
  return state
}

// 在事务里打开一次窗口并停在待决选择（与大厅提交同一条事务管线），返回 pendingChoice。
function openWindow(state, execute) {
  resolveTransaction(state, 0, { action: 'playChannelProbe' }, execute)
  return state.pendingChoice
}

function answerWindow(state, execute, optionId) {
  const pending = state.pendingChoice
  assert.ok(pending, '窗口没有打开')
  resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
}

// 把窗口里剩下的提示全部让过/交掉。
function settleWindow(state, execute) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 60, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = ['skip', 'done', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

function defeatEnemyWindow(current) {
  return current => reactionWindow(current, 'defeatEnemy', {
    when: 'defeatEnemy', seat: 0, location: current.investigators[0].location,
    enemy: { id: 'pc-enemy', code: 'ghoulMinion', name: '测试敌人', location: current.investigators[0].location },
    prompt: '你击败了一个敌人',
  }, [])
}

function closingWindow(current) {
  return current => playerWindow(current, 'investigation.afterAction', [], null, { fastCards: true })
}

// ---------------------------------------------------------------------------
// 反应窗口：背包里的快速反应事件（收敛前完全不枚举）
// ---------------------------------------------------------------------------
test('背包（04037）里的快速反应事件进入反应窗口，打完后空包弃置', () => {
  const state = baseState()
  const bag = asset(state, '04037')
  bag.attachedCards = ['01022']
  const execute = defeatEnemyWindow(state)
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '01022')
  assert.ok(option, '背包通道必须进入反应窗口')
  assert.match(option.label, /背包/)
  assert.equal(option.uiKey, `asset:${bag.id}`, '选项带 uiKey，界面可挂回背包实体')
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
  const inv = me(state)
  assert.ok(inv.discard.includes('01022'), '打出的快速事件正常进弃牌堆')
  assert.equal(inv.assets.some(item => item.id === bag.id), false, '最后一张打完后背包弃置')
})

// ---------------------------------------------------------------------------
// 收尾玩家窗口：原定计划 / 银暮匕首下方 / 弃牌堆顶（收敛前只枚举手牌与直觉牌库）
// ---------------------------------------------------------------------------
test('原定计划（03264）附属的事件进入收尾快速卡窗口并横置原定计划', () => {
  const state = baseState()
  const plan = asset(state, '03264')
  plan.attached = ['01036']
  me(state).actionsLeft = 0
  const execute = closingWindow(state)
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '01036')
  assert.ok(option, '原定计划通道必须进入收尾窗口')
  assert.match(option.label, /原定计划/)
  assert.equal(option.uiKey, `asset:${plan.id}`)
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
  const planAfter = me(state).assets.find(item => item.id === plan.id)
  assert.ok(planAfter, '原定计划仍在场')
  assert.equal(planAfter.exhausted, true, '横置原定计划作为附加通道费用')
  assert.equal((planAfter.attached || []).includes('01036'), false, '卡已从原定计划下移出')
  assert.ok(me(state).discard.includes('01036'), '打出的快速事件进弃牌堆')
})

test('银暮匕首（05013）下方的事件进入收尾快速卡窗口并横置支援', () => {
  const state = baseState()
  const knife = asset(state, '05013')
  me(state).beneath = ['01037']
  me(state).actionsLeft = 0
  const execute = closingWindow(state)
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '01037')
  assert.ok(option, '银暮匕首通道必须进入收尾窗口')
  assert.match(option.label, /银暮匕首/)
  assert.equal(option.uiKey, 'beneath:01037')
  const before = me(state).clues
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
  const knifeAfter = me(state).assets.find(item => item.id === knife.id)
  assert.equal(knifeAfter.exhausted, true, '横置通道支援')
  assert.deepEqual(me(state).beneath, [])
  assert.ok(me(state).discard.includes('01037'))
  assert.equal(me(state).clues, before + 1, '「专业的直觉」发现 1 个线索')
})

test('温蒂的护身符（01014）弃牌堆顶事件进入收尾快速卡窗口', () => {
  const state = baseState()
  asset(state, '01014')
  me(state).discard = ['01088', '01037'] // 末尾事件 = 弃牌堆顶事件
  me(state).actionsLeft = 0
  const execute = closingWindow(state)
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '01037')
  assert.ok(option, '护身符看弃牌堆顶事件的通道必须进入收尾窗口')
  assert.match(option.label, /护身符/)
  const before = me(state).clues
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
  assert.equal(me(state).clues, before + 1, '弃牌堆顶的「专业的直觉」被正常打出')
})

// ---------------------------------------------------------------------------
// 能力窗口：宿主附属里的 fromHand 反应描述子（收敛前只枚举手牌/下方/直觉牌库）
// ---------------------------------------------------------------------------
test('宿主附属（05279）里的 fromHand 快速事件进入能力窗口，并支付宿主附加费', () => {
  const state = baseState()
  const host = asset(state, '05279')
  host.uses = 2
  host.usesType = 'secrets'
  host.attachments = [{ id: 'pc-att-1', code: '05032' }]
  const context = {
    when: 'wouldLoseResources', seat: 0, location: me(state).location,
    source: { kind: 'encounter' }, what: 'resources', cancelled: false,
  }
  const execute = current => reactionWindow(current, 'wouldLoseResources', context, [])
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '05032')
  assert.ok(option, '宿主附属通道必须进入能力窗口')
  assert.match(option.label, /宿主附属/)
  assert.equal(option.uiKey, `asset:${host.id}`)
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
  const hostAfter = me(state).assets.find(item => item.id === host.id)
  assert.equal(context.cancelled, true, '「否决存在」取消了这次失去资源')
  assert.equal(hostAfter.exhausted, true, '横置宿主作为附加费')
  assert.equal(hostAfter.uses, 1, '支付 1 秘密')
  assert.ok(hostAfter.attachments.some(item => item.code === '05032'), '打出后仍附属')
})

// ---------------------------------------------------------------------------
// 观察投影 + 牌桌映射：uiKey 协议端到端
// ---------------------------------------------------------------------------
test('通道候选的 uiKey 经过观察投影后仍能把选项挂回牌桌实体', () => {
  const state = baseState()
  const bag = asset(state, '04037')
  bag.attachedCards = ['01022']
  const execute = defeatEnemyWindow(state)
  const pending = openWindow(state, execute)
  const option = pending.options.find(item => item.cardCode === '01022')
  // 直接调用窗口事务不会像 applyMove 那样回填 legalMoves；观察投影要读到本窗口的选项先补一次。
  state.legalMoves = legalMoves(state)
  const view = viewState(state, 0)
  const item = choicePresentation(view).find(entry => entry.move.optionId === option.id)
  assert.ok(item, '投影后的选项仍可被界面识别')
  assert.equal(item.key, `asset:${bag.id}`, '选项 key 直接使用服务端 uiKey')
  assert.equal(entityMoves(view, `asset:${bag.id}`).length, 1, '点背包实体 = 回答当前窗口')
  answerWindow(state, execute, option.id)
  settleWindow(state, execute)
})
