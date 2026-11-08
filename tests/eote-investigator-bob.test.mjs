// P5 08016 鲍勃·詹金斯（含专属 08017 精明的交易 / 08018 贪婪）的 Node 验收。
//
// 覆盖：专属条目注册、旧印按控制道具数、揭示授权（crossSeat）、受限额外行动（itemPlay）、
// 跨座位代打归牌主控制与双方付费、精明的交易道具减费与任意控制者、贪婪按资源阶梯恐惧、JSON 往返。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, move } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { performTest, legalMoves, validateMove, applyMove, executeDescriptor, drawCards, getStat,
  turnBeginningWindow, actionCost } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import bobEntry from '../src/cards/entries/08016.js'
import shrewdEntry from '../src/cards/entries/08017.js'
import greedEntry from '../src/cards/entries/08018.js'

for (const entry of [bobEntry, shrewdEntry, greedEntry]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const clone = value => JSON.parse(JSON.stringify(value))
const investigator = (s, seat = 0) => s.investigators[seat]

function transact(state, run, select = () => null, seat = 0) {
  const execute = draft => run(draft)
  resolveTransaction(state, seat, { action: 'eoteBobTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 60, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const c = state.pendingChoice
    const id = select(c) ?? ['done', 'skip', 'self'].find(option => c.options.some(o => o.id === option)) ?? c.options[0]?.id
    resolveTransaction(state, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
}
// 真实行动：先按合法行动校验，再应用；随后逐个结算待决选择。
function doAction(state, command, select = () => null) {
  const seat = state.currentSeat
  assert.equal(validateMove(state, seat, command), null, JSON.stringify(command))
  applyMove(state, seat, command)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 60, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const c = state.pendingChoice
    const id = select(c) ?? ['done', 'skip', 'self'].find(option => c.options.some(o => o.id === option)) ?? c.options[0]?.id
    move(state, { action: 'choose', choiceId: c.id, optionId: id })
  }
}
function setup(count = 2) {
  const s = fixture('01001', count)
  s.abilityLimits = {}
  s.investigators[0].code = '08016'
  s.investigators[0].originalCode = '08016'
  s.investigators[0].beneath = []
  for (const inv of s.investigators.slice(1)) inv.location = s.investigators[0].location
  return s
}
const itemInHand = (s, seat = 1, code = '01016') => { s.investigators[seat].hand = [code]; return code }
const grantSeat = (s, codes, costSplit = null) =>
  createMechanicsApi(s).interactions.crossSeat.grant(0, { fromSeat: 1, codes, ...(costSplit ? { costSplit } : {}) })
const otherHandMove = (s, code = '01016') =>
  legalMoves(s, 0).find(item => item.action === 'play' && item.fromOtherHand === true && item.cardId === code)

test('P5 08016 条目注册与旧印：每控制 1 张 [[道具]] 支援 +1', () => {
  assert.ok(registeredEntry('08016'))
  assert.ok(registeredEntry('08017')); assert.equal(registeredEntry('08017').assetRule.playUnderAnyAtLocation, true)
  assert.ok(registeredEntry('08018'))
  assert.deepEqual(registeredEntry('08016').investigator.restrictedAction, { kind: 'itemPlay' })
  const s = setup(1)
  asset(s, '01016'); asset(s, '01030')
  s.chaosBag = ['eldersign']
  let result
  transact(s, draft => {
    result = performTest(draft, 0, 'willpower', 0, { resolve: resolved => { result = resolved } })
  })
  assert.equal(result.value, getStat(s, investigator(s), 'willpower') + 2)
})

test('P5 08016 揭示授权：同地点队友手牌中的 [[道具]] 支援进入合法行动', () => {
  const s = setup()
  itemInHand(s, 1, '01016')
  s.investigators[1].hand.push('01088', '01030')
  const descriptor = registeredEntry('08016').abilities.find(item => item.kind === 'free')
  transact(s, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { investigator: 0, code: '08016' }, descriptor, events: [],
  }))
  const grant = createMechanicsApi(s).crossSeat.data()?.grants?.[0]
  assert.equal(grant.fromSeat, 1)
  assert.deepEqual([...grant.codes].sort(), ['01016', '01030'], '只授权 [[道具]] 支援')
  assert.ok(otherHandMove(s, '01016'), '授权后应出现代打行动')
  assert.equal(otherHandMove(s, '01088'), undefined, '非道具不进入代打候选')
})

test('P5 08016 受限额外行动：只能用于代打队友 [[道具]]，普通行动不能用它', () => {
  const s = setup()
  itemInHand(s, 1, '01016')
  transact(s, draft => createMechanicsApi(draft).interactions.crossSeat.grant(0, { fromSeat: 1, codes: ['01016'] }))
  s.investigators[0].actionsLeft = 0
  transact(s, draft => turnBeginningWindow(draft, []))
  assert.equal(investigator(s).itemPlayOnlyActions, 1, '回合开始应发放 1 个受限行动')
  assert.equal(investigator(s).actionsLeft, 1)
  // 只有受限额度时：普通行动（抽牌/移动等）不可用，代打 [[道具]] 可用。
  const drawMove = legalMoves(s, 0).find(item => item.action === 'draw')
  assert.equal(drawMove, undefined, '只剩受限行动时不能抽牌')
  const candidate = otherHandMove(s, '01016')
  assert.ok(candidate, '受限行动只能用于代打队友 [[道具]]')
  assert.equal(actionCost(s, investigator(s), candidate), 1)
  doAction(s, candidate)
  assert.equal(investigator(s).actionsLeft, 0, '代打消耗受限行动额度')
  assert.ok(!investigator(s).itemPlayOnlyActions, '受限行动额度已用尽')
})

test('P5 08016 跨座位代打：资产归牌主控制，双方按分摊共同支付', () => {
  const s = setup()
  itemInHand(s, 1, '01016')
  s.investigators[0].resources = 5
  s.investigators[1].resources = 5
  grantSeat(s, ['01016'], { self: 2, owner: 2 })
  const candidate = otherHandMove(s, '01016')
  assert.ok(candidate)
  doAction(s, candidate)
  assert.equal(s.investigators[0].resources, 3, '代打者支付自己那一份')
  assert.equal(s.investigators[1].resources, 3, '牌主支付自己那一份')
  const played = s.investigators[1].assets.filter(item => item.code === '01016')
  assert.equal(played.length, 1, '资产归牌主（队友）控制')
  assert.equal(s.investigators[0].assets.some(item => item.code === '01016'), false)
})

test('P5 08017 精明的交易：道具费用 -1，且可置于同地点任意调查员控制下', () => {
  const s = setup()
  asset(s, '08017')
  s.investigators[0].hand = ['01016']
  s.investigators[1].hand = []
  const play = legalMoves(s, 0).find(item => item.action === 'play' && item.cardId === '01016')
  assert.ok(play)
  const base = s.investigators[0].resources
  doAction(s, play, c => (c.kind === 'investigator' ? '1' : null))
  assert.equal(s.investigators[0].resources, base - 3, '01016 费用 4，精明的交易 -1')
  assert.equal(s.investigators[1].assets.some(item => item.code === '01016'), true, '可置于队友控制下')
  assert.equal(s.investigators[0].assets.some(item => item.code === '01016'), false)
})

test('P5 08018 贪婪：按资源阶梯受到 1–4 点恐惧', () => {
  for (const [resources, horror] of [[11, 1], [10, 2], [5, 3], [0, 4]]) {
    const s = setup(1)
    s.investigators[0].resources = resources
    s.investigators[0].deck.push('08018')
    transact(s, draft => drawCards(draft, draft.investigators[0], 1, []))
    assert.equal(investigator(s).horror, horror, `资源 ${resources} 时应受到 ${horror} 点恐惧`)
  }
})

test('P5 08016 JSON 往返：跨座位授权与受限行动记录可恢复', () => {
  const s = setup()
  itemInHand(s, 1, '01016')
  grantSeat(s, ['01016'], { self: 2, owner: 2 })
  transact(s, draft => turnBeginningWindow(draft, []))
  const restored = migrateState(clone(s)).state
  assert.deepEqual(createMechanicsApi(restored).crossSeat.data()?.grants?.[0].codes, ['01016'])
  assert.equal(restored.investigators[0].itemPlayOnlyActions, 1)
})
