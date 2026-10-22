import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, decisionSeat, legalMoves } from '../src/engine/engine.js'
import { viewState, viewEvents } from '../src/integration/observation.js'

// 观察投影的隐私边界：任何只属于某个座位的信息，都不能出现在别人的视图里。
// 这些断言是阶段 A（viewState 公私拆分）的护栏，不只是文档。

function advance(state, seat, move) {
  const next = structuredClone(state)
  assert.equal(validateMove(structuredClone(next), seat, structuredClone(move)), null)
  applyMove(next, seat, move)
  next.revision = state.revision + 1
  return next
}

function answerChoice(state) {
  const seat = decisionSeat(state)
  const moves = legalMoves(state, seat)
  const move = ['done', 'skip', 'self', 'keep']
    .map(id => moves.find(item => item.optionId === id)).find(Boolean) || moves[0]
  assert.ok(move, '待决选择必须有可用选项')
  return advance(state, seat, move)
}

function createState(seats = 2) {
  return createGameState({ seed: 'view-privacy', campaignHub: false },
    Array.from({ length: seats }, (_, seat) => ({ seat, role: 'human', name: 'P' + seat })))
}

function settled(seats = 2) {
  let state = createState(seats)
  for (let i = 0; state.pendingChoice && i < 200; i++) state = answerChoice(state)
  return state
}

function withChoice(seats = 2) {
  let state = createState(seats)
  for (let i = 0; i < 200; i++) {
    if (state.pendingChoice) return state
    const seat = decisionSeat(state)
    const moves = legalMoves(state, seat)
    const move = moves.find(item => item.action === 'endTurn') || moves[0]
    if (!move) return null
    state = advance(state, seat, move)
  }
  return null
}

test('其他席位的手牌/牌组/压牌不会进入观察视图', () => {
  const state = settled(2)
  state.pendingChoice = null
  state.investigators[0].hand = ['01020']
  state.investigators[1].hand = ['01021']
  state.investigators[1].beneath = ['01022']
  const view = viewState(structuredClone(state), 0)
  assert.deepEqual(view.investigators[0].hand, ['01020'], '自己的手牌可见')
  assert.deepEqual(view.investigators[1].hand, [], '别人的手牌必须为空')
  assert.deepEqual(view.investigators[1].beneath, [], '别人的压牌必须为空')
  assert.deepEqual(view.investigators[1].deck, [])
  assert.equal(view.investigators[1].deckSize, state.investigators[1].deck.length)
  for (const record of Object.values(view.campaign?.investigators || {})) {
    if (record.seat === 0) continue
    assert.equal(record.deck, undefined, '别人的牌组清单不能下发')
    assert.equal(record.purchases, undefined)
  }
})

test('卡面自愈只补公共可见与本人手牌，不因别人的手牌扩大', () => {
  const state = settled(2)
  state.pendingChoice = null
  state.investigators[0].hand = ['01020']
  state.investigators[1].hand = ['01021']
  // 模拟旧存档 / 中途加入的卡：展示表里缺这两张。
  delete state.cards['01020']
  delete state.cards['01021']
  const view = viewState(structuredClone(state), 0)
  assert.ok(view.cards['01020'], '自己手牌的卡面必须补齐')
  assert.equal(view.cards['01021'], undefined, '别人手牌的卡面不能借自愈补进来')
})

test('待决选择只把选项给应答座位', () => {
  const state = withChoice(2)
  assert.ok(state?.pendingChoice, '夹具应推进出一个待决选择')
  const choice = state.pendingChoice
  const responder = Number.isInteger(choice.seat) ? choice.seat : choice.seats?.[0]
  const other = responder === 0 ? 1 : 0
  const responderView = viewState(structuredClone(state), responder)
  const otherView = viewState(structuredClone(state), other)
  assert.ok(responderView.pendingChoice, '应答座位能看到选择')
  if (otherView.pendingChoice) {
    assert.deepEqual(otherView.pendingChoice.options, [], '非应答座位不得获得可选项')
  }
  assert.deepEqual(otherView.legalMoves?.filter(move => move.action === 'choose') || [], [])
})

test('非行动座位的合法行动为空，私人检定不外泄', () => {
  const state = settled(2)
  state.pendingChoice = null
  state.currentSeat = 1
  state.legalMoves = []
  state.skillTest = { seat: 1, helpRequested: false, publicLog: ['公开线索'], log: ['只有我能看到的检定记录'] }
  const view = viewState(structuredClone(state), 0)
  assert.deepEqual(view.legalMoves, [])
  assert.equal(view.skillTest, null, '别人进行中的私人检定不可见')
  assert.ok(!(view.log || []).includes('只有我能看到的检定记录'), '私人检定日志不得进入公共日志')
})

test('事件投影过滤别人的私有事件，并遮蔽演出快照里的手牌', () => {
  const events = [
    { seq: 0, type: 'info', text: '公开事件' },
    { seq: 1, type: 'info', text: '私密事件', privateSeat: 1 },
    { seq: 2, type: 'presentation', kind: 'checkpoint', tableState: { investigators: [{ seat: 0, hand: ['01020'] }, { seat: 1, hand: ['01021'] }] } },
  ]
  const view = viewEvents(events, 0)
  assert.equal(view.some(event => event.privateSeat === 1), false)
  const tableState = view.find(event => event.tableState)?.tableState
  assert.deepEqual(tableState.investigators[1].hand, [], '演出快照同样要遮蔽别人的手牌')
  assert.deepEqual(tableState.investigators[0].hand, ['01020'])
})
