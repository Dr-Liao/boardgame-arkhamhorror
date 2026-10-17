import assert from 'node:assert/strict'
import { createGameState, applyMove, decisionSeat } from '../../src/engine/engine.js'

export const move = (s, command) => applyMove(s, decisionSeat(s), command)
export function settle(s) {
  const events = []
  for (let i = 0; s.pendingChoice; i++) {
    assert.ok(i < 150)
    const c = s.pendingChoice
    const option = c.options.find(o => ['done', 'skip', 'self', 'r2'].includes(o.id)) || c.options[0]
    events.push(...move(s, { action: 'choose', choiceId: c.id, optionId: option.id }))
  }
  return events
}

export function midnightConclusion() {
  const s = createGameState({ campaignHub: true, seed: 'midnight-story' }, [{ seat: 0, role: 'human' }])
  for (const command of [
    { action: 'hubGoSetup' }, { action: 'hubSelectInvestigator', code: '01001' },
    { action: 'hubAutoDeck' }, { action: 'hubDoneSeat' }, { action: 'hubBeginScenario' },
  ]) move(s, command)
  settle(s)
  s.actIndex = 2; s.enemies = []; s.investigators[0].hand = []
  move(s, { action: 'resource' }); settle(s)
  assert.equal(s.uiState, 'scenarioResult')
  move(s, { action: 'hubContinue' }); move(s, { action: 'hubDoneSeat' }); move(s, { action: 'hubBeginScenario' }); settle(s)
  assert.equal(s.scenario.id, 'theMidnightMasks')
  // Resolve the real midnight agenda transition without playing eight rounds.
  s.agendaIndex = 1; s.doom = 7; s.enemies = []; s.investigators[0].hand = []
  const events = [...move(s, { action: 'endTurn' }), ...settle(s)]
  assert.equal(s.uiState, 'scenarioResult')
  assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'r2')
  return { state: s, events }
}
