import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { EFFECTS } from '../src/cards/card-effects.js'

export function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null, JSON.stringify(command))
  return applyMove(state, seat, command)
}
export function answer(state, id) {
  assert.ok(state.pendingChoice, `No pending choice for ${id}`)
  return move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: id })
}
export function settle(state, select = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 150, `Choice loop: ${state.pendingChoice.kind}`)
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(id => c.options.some(o => o.id === id)) ?? c.options[0]?.id
    assert.ok(id != null, JSON.stringify(c))
    answer(state, id)
  }
}
export function fixture(code = '01001', count = 1, settings = {}) {
  const state = createGameState({ playerInvestigator: code, seed: 'core-acceptance', ...settings },
    Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) {
    inv.hand = []; inv.assets = []; inv.threat = []; inv.discard = []; inv.engaged = []
    inv.deck = Array(30).fill('01088'); inv.resources = 30; inv.actionsLeft = 20
  }
  state.chaosBag = ['0']; state.encounterDeck = Array(20).fill('dissonantVoices'); state.encounterDiscard = []
  return state
}
export function asset(state, code, extra = {}, seat = 0) {
  const card = { id: 'c' + ++state.instanceSeq.c, code, exhausted: false,
    ...(EFFECTS[code]?.uses != null ? { uses: EFFECTS[code].uses, usesType: EFFECTS[code].usesType } : {}), ...extra }
  state.investigators[seat].assets.push(card)
  return card
}
export function enemy(state, extra = {}) {
  const card = { id: 'e' + ++state.instanceSeq.e, code: 'ghoulMinion', name: '测试敌人', location: state.investigators[0].location,
    fight: 1, evade: 1, health: 30, damageTaken: 0, damage: 0, horror: 0, engagedSeat: 0, ...extra }
  state.enemies.push(card)
  if (card.engagedSeat != null) state.investigators[card.engagedSeat].engaged.push(card.id)
  return card
}
export const play = (s, code) => { s.investigators[decisionSeat(s)].hand.push(code); return move(s, { action: 'play', cardId: code }) }
export const use = (s, a, extra = {}) => move(s, { action: 'ability', assetId: a.id, abilityIndex: 0, ...extra })
export { legalMoves, validateMove, decisionSeat }
