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

// 序章故事调查员的选人面板要显示职业、副标题、四维与生命/理智，这些字段都印在公开卡面上；
// 但它们只补发给这类选择的应答座位，普通待决选择不能借用同一份白名单把内部字段带出去。
test('故事调查员选项向应答座位补发公开卡面身份字段', () => {
  const state = settled(2)
  // 形状与 src/engine/story-investigators.js 的选项一致，另加一个未登记的内部字段作探针。
  const identity = {
    klass: 'seeker', classLabel: '探求者', subtitle: '女继承人',
    stats: { willpower: 2, intellect: 4, combat: 2, agility: 3 },
    health: 6, sanity: 8,
  }
  state.pendingChoice = {
    id: 'q-story-1', kind: 'storyInvestigator', seat: 0,
    prompt: 'P0：选择你本次冒险使用的故事调查员。',
    options: [
      { id: '05046', label: '阿米莉亚·班克罗夫特', ...identity, secret: '内部字段不应下发' },
      { id: '05047', label: '另一张故事调查员' },
    ],
  }
  const responderView = viewState(structuredClone(state), 0)
  assert.deepEqual(responderView.pendingChoice.options[0], { id: '05046', label: '阿米莉亚·班克罗夫特', ...identity })
  assert.equal(responderView.pendingChoice.options[0].secret, undefined, '未登记的内部字段不得下发')
  assert.deepEqual(responderView.pendingChoice.options[1], { id: '05047', label: '另一张故事调查员' })

  const otherView = viewState(structuredClone(state), 1)
  assert.deepEqual(otherView.pendingChoice.options, [], '非应答座位仍然拿不到选项')

  // 非 storyInvestigator 的普通待决选择即使选项带着同样的字段也不能放行。
  const commitState = structuredClone(state)
  commitState.pendingChoice = {
    id: 'q-commit-1', kind: 'commit', seat: 0,
    prompt: '确认？',
    options: [{ id: 'confirm', label: '确认', cardCode: '05046', ...identity, secret: '内部字段不应下发' }],
  }
  const commitView = viewState(structuredClone(commitState), 0)
  assert.deepEqual(commitView.pendingChoice.options, [{ id: 'confirm', label: '确认', cardCode: '05046' }])
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
