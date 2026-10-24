// campaign-n4 系列测试的共享夹具：建局、结算到无待决选择、回答选择。
// campaign-n4.test.mjs / campaign-n4-purchase-stress.test.mjs / campaign-n4-matrix.test.mjs 共用，
// 避免三份文件各自维护一套"怎么点完一局"的样板。
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, decisionSeat } from '../src/engine/engine.js'

export const clone = value => JSON.parse(JSON.stringify(value))

export function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null)
  return applyMove(state, seat, command)
}

export function answer(state, optionId) {
  return move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId })
}

export function settle(state, stopKind = null) {
  const events = []
  for (let i = 0; state.pendingChoice && state.pendingChoice.kind !== stopKind; i++) {
    assert.ok(i < 150, '选择必须在有限步骤内完成')
    const choice = state.pendingChoice
    const preferred = ['done', 'skip', 'self', 'cancel'].find(id => choice.options.some(option => option.id === id))
    events.push(...answer(state, preferred || choice.options[0].id))
  }
  return events
}

export function game(code = '01001', count = 1, difficulty = 'standard') {
  const state = createGameState({ playerInvestigator: code, seed: 'n4-campaign', difficulty }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  return state
}

export function gatheringConclusion(state, resolution = 'r2') {
  state.actIndex = 2
  state.chaosBag = ['0']
  state.investigators[0].hand = []
  state.enemies = []
  move(state, { action: 'resource' })
  settle(state, 'story')
  assert.equal(state.pendingChoice.kind, 'story')
  answer(state, resolution)
}

export function finishInterlude(state) {
  settle(state, 'mulligan')
  assert.equal(state.pendingChoice?.kind, 'mulligan')
  settle(state)
}
