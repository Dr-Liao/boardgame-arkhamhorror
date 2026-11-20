import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, legalMoves, actingSeats, decisionSeat, seatLocalMove } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { createTableDecisions } from '../src/engine/table-decisions.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import { fixture } from './core-fixture.mjs'

const players = [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }, { seat: 2, role: 'human' }]
const act = (state, seat, move) => {
  assert.equal(validateMove(state, seat, move), null, `${seat}:${move.action}`)
  return applyMove(state, seat, move)
}
const prepare = (state, seat) => {
  act(state, seat, legalMoves(state, seat).find(move => move.action === 'hubSelectInvestigator'))
  act(state, seat, { action: 'hubAutoDeck' })
  act(state, seat, { action: 'hubConfirmDeck' })
  act(state, seat, { action: 'hubDoneSeat' })
}

test('大厅跨席位和跨线保留调查员身份，自己的不同版本仍可换选', () => {
  const SELECTABLE_INVESTIGATORS = ['01001', '01002', '01003']
  const ALL_INVESTIGATORS = {
    '01001': { name: 'Rowan North' }, '01002': { name: 'Ｒｏｗａｎ North' }, '01003': { name: 'Drew West' },
  }
  const { hubInvestigatorChoices } = createTableDecisions({ SELECTABLE_INVESTIGATORS, ALL_INVESTIGATORS })
  const state = fixture()
  state.campaign.investigators = {}
  state.campaign.parts = { other: { investigators: { 1: { seat: 1, status: 'active', code: '01001' } } } }
  assert.deepEqual(hubInvestigatorChoices(state, 0), ['01003'])
  assert.deepEqual(hubInvestigatorChoices(state, 1), SELECTABLE_INVESTIGATORS)
  state.campaign.parts.other.investigators[1].status = 'killed'
  assert.deepEqual(hubInvestigatorChoices(state, 1), ['01003'])
  state.campaign.parts = {}
  state.investigators = [{ seat: 1, code: '01002' }]
  state.hubSeatSelected = { 1: true }
  assert.deepEqual(hubInvestigatorChoices(state, 0), ['01003'])
})

test('限量暗置通过剧本运行时拒绝超额，对局恢复后可取回并腾出容量', () => {
  const state = fixture()
  const owner = state.investigators[0]
  owner.hand = ['01088', '01091']
  let zone = scenarioRuntime(state, []).mechanics.commitOrigins
  assert.equal(zone.store(0, 'cache', '01088', { capacity: 0 }), false)
  assert.equal(zone.store(0, 'cache', '01088', { capacity: 1 }), true)
  assert.equal(zone.store(0, 'cache', '01091', { capacity: 1 }), false)
  assert.deepEqual(owner.hand, ['01091'])
  assert(!JSON.stringify(viewState(state, null).mechanics.beneath).includes('01088'))
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  zone = scenarioRuntime(saved, []).mechanics.commitOrigins
  assert.equal(zone.store(0, 'cache', '01091', { capacity: 1 }), false)
  assert.equal(zone.take(0, 'cache', '01088', 'discard'), true)
  assert.equal(zone.store(0, 'cache', '01091', { capacity: 1 }), true)
})

test('局外准备阶段真人席位同时操作，AI 队友在真人全部确认后再准备', () => {
  const s = createGameState({ campaignHub: true, seed: 'hub-concurrent' }, players)
  assert.deepEqual(actingSeats(s), [0])
  assert.ok(validateMove(s, 2, { action: 'hubGoSetup' }), '战役总览仍只由房主推进')
  act(s, 0, { action: 'hubGoSetup' })
  assert.deepEqual(actingSeats(s), [0, 2])
  assert.ok(viewState(s, 2).legalMoves.some(move => move.action === 'hubSelectInvestigator'))
  assert.deepEqual(viewState(s, 1).legalMoves, [], 'AI 队友等待真人挑选')

  const [first, second] = legalMoves(s, 2).filter(move => move.action === 'hubSelectInvestigator')
  assert.equal(seatLocalMove(s, 2, first), true)
  act(s, 2, first)
  assert.ok(validateMove(s, 0, { action: 'hubSelectInvestigator', code: first.code }), '队友已选的调查员不可重复选择')
  act(s, 0, second)
  act(s, 2, { action: 'hubAutoDeck' })
  act(s, 2, { action: 'hubConfirmDeck' })
  act(s, 2, { action: 'hubDoneSeat' })
  assert.deepEqual(actingSeats(s), [0])
  assert.deepEqual(viewState(s, 2).legalMoves, [], '已确认的席位等待队友')
  assert.ok(validateMove(s, 2, { action: 'hubAutoDeck' }))

  act(s, 0, { action: 'hubAutoDeck' })
  act(s, 0, { action: 'hubConfirmDeck' })
  act(s, 0, { action: 'hubDoneSeat' })
  assert.deepEqual(actingSeats(s), [1])
  assert.equal(decisionSeat(s), 1)
  assert.ok(!legalMoves(s, 1).some(move => [first.code, second.code].includes(move.code)), 'AI 只能从剩余调查员中挑选')
  prepare(s, 1)
  assert.equal(s.hubReady, true)
  assert.deepEqual(actingSeats(s), [0])
  assert.equal(seatLocalMove(s, 0, { action: 'hubDoneSeat' }), false, '全队就绪后不再按席位并发')
})

test('关间升级同样并发，最后一名确认后推进战役', () => {
  const s = createGameState({ campaignHub: true, seed: 'hub-concurrent-interlude' }, players)
  act(s, 0, { action: 'hubGoSetup' })
  for (const seat of [2, 0, 1]) prepare(s, seat)
  s.uiState = 'interlude'; s.phase = 'interlude'; s.campaign.phase = 'interlude'
  s.hubReady = false; s.hubSeatDone = {}; s.currentSeat = 0
  assert.deepEqual(actingSeats(s), [0, 2])
  act(s, 2, { action: 'hubDoneSeat' })
  act(s, 0, { action: 'hubDoneSeat' })
  assert.equal(s.uiState, 'interlude')
  assert.deepEqual(actingSeats(s), [1])
  act(s, 1, { action: 'hubDoneSeat' })
  assert.equal(s.hubReady, true)
})
