import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, legalMoves, actingSeats, decisionSeat, seatLocalMove } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'

const players = [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }, { seat: 2, role: 'human' }]
const act = (state, seat, move) => {
  assert.equal(validateMove(state, seat, move), null, `${seat}:${move.action}`)
  return applyMove(state, seat, move)
}
const prepare = (state, seat) => {
  act(state, seat, legalMoves(state, seat).find(move => move.action === 'hubSelectInvestigator'))
  act(state, seat, { action: 'hubAutoDeck' })
  act(state, seat, { action: 'hubDoneSeat' })
}

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
  act(s, 2, { action: 'hubDoneSeat' })
  assert.deepEqual(actingSeats(s), [0])
  assert.deepEqual(viewState(s, 2).legalMoves, [], '已确认的席位等待队友')
  assert.ok(validateMove(s, 2, { action: 'hubAutoDeck' }))

  act(s, 0, { action: 'hubAutoDeck' })
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
