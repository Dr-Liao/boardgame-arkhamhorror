// P1 回归：战役失败语义、弱点去向、剧本攻击限制。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, applyMove, legalMoves, decisionSeat } from '../src/engine/engine.js'
import { fixture, move, settle } from './core-fixture.mjs'
import { contentRegistry } from '../content/registered.js'

test('P1 全员撤退只结束本关，队伍带着记录进入下一关', () => {
  const state = createGameState({ playerInvestigator: '01001', seed: 'p1-tpk-continue', difficulty: 'easy' }, [{ seat: 0 }])
  settle(state)
  for (let index = 0; state.status === 'playing' && state.scenario?.id === 'theGathering' && index < 300; index++) {
    const moves = legalMoves(state)
    assert.ok(moves.length, '每一步都应有合法动作')
    const command = state.pendingChoice
      ? moves.find(candidate => ['done', 'skip', 'self'].includes(candidate.optionId)) || moves[0]
      : moves.find(candidate => candidate.action === 'resign') || moves.find(candidate => candidate.action === 'endTurn')
    assert.ok(command, `第 ${index} 步没有可提交动作`)
    applyMove(state, decisionSeat(state), command)
  }
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'noResolution')
  assert.equal(state.campaign.failed, undefined)
  assert.equal(state.status, 'playing')
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.pendingChoice?.kind, 'mulligan')
})

test('P1 02178 跨越时空结算后进入弃牌堆，不再从所有区域消失', () => {
  const state = fixture()
  state.investigators[0].deck = ['01088', '01089', '01090', '01091', '02178']
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].deck.length, 1)
  assert.deepEqual(state.investigators[0].discard.filter(code => code !== '02178').sort(), ['01089', '01090', '01091'])
  assert.ok(state.investigators[0].discard.includes('02178'))
})

test('P1 不可言说的誓约：持有 03186 时不能攻击狂人敌人', () => {
  const behavior = contentRegistry.getBehavior('theUnspeakableOath')
  const state = { scenario: { id: 'theUnspeakableOath' } }
  const lunatic = { code: 'test-lunatic', traits: ['Lunatic'] }
  const monster = { code: 'test-monster', traits: ['Monster'] }
  assert.equal(behavior.canFightEnemy(state, { hiddenCards: ['03186'] }, lunatic), false)
  assert.equal(behavior.canFightEnemy(state, { hiddenCards: ['03186'] }, monster), true)
  assert.equal(behavior.canFightEnemy(state, { hiddenCards: [] }, lunatic), true)
})
