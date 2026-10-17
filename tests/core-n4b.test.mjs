import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'

function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null, JSON.stringify(command))
  applyMove(state, seat, command)
}
function answer(state, id) { move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: id }) }
function settle(state, max = 80) {
  for (let i = 0; state.pendingChoice && i < max; i++) {
    const choice = state.pendingChoice
    const ms = (state.legalMoves || []).filter(m => m.action === 'choose' && m.choiceId === choice.id)
    const pick = ms.find(m => ['done', 'skip', 'self', '0'].includes(m.optionId)) || ms[0]
    assert.ok(pick, `${choice.kind}: ${JSON.stringify(choice.options)}`)
    applyMove(state, pick.seat ?? decisionSeat(state), { ...pick, choiceId: choice.id })
  }
  assert.equal(state.pendingChoice, null)
}
function fixture(code = '01001', count = 1) {
  const state = createGameState({ playerInvestigator: code, seed: 'n4b-core' }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) {
    inv.hand = []
    inv.deck = ['01088', '01088', '01088']
    inv.resources = 10
    inv.actionsLeft = 10
  }
  state.chaosBag = ['0']
  state.encounterDeck = ['dissonantVoices']
  state.encounterDiscard = []
  return state
}
function asset(state, code, extra = {}) {
  const card = { id: 'a' + ++state.instanceSeq.c, code, exhausted: false, ...extra }
  state.investigators[0].assets.push(card)
  return card
}

test('N4.2 医学教科书由使用者检定，成功治疗目标，失败伤害目标', () => {
  const state = fixture('01001', 2)
  const med = asset(state, '01035', { uses: 3 })
  state.investigators[0].intellect = 6
  state.investigators[1].damage = 2
  move(state, { action: 'ability', assetId: med.id, abilityIndex: 0 })
  assert.equal(state.pendingChoice.kind, 'investigator')
  answer(state, '1')
  assert.equal(state.pendingChoice.kind, 'commit')
  answer(state, 'done')
  settle(state)
  assert.equal(state.investigators[1].damage, 1)
  assert.equal(state.investigators[0].damage, 0)
})

test('N4.2 医院债务每轮最多支付两次，支付后资源进入债务卡', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const debt = { id: 'debt', code: '01011', resources: 0, debtPaymentsThisRound: 0, counters: 0 }
  inv.threat.push(debt)
  assert.ok(legalMoves(state).some(m => m.action === 'payDebt' && m.threatId === 'debt'))
  move(state, { action: 'payDebt', threatId: 'debt' })
  move(state, { action: 'payDebt', threatId: 'debt' })
  assert.equal(state.investigators[0].resources, 8)
  assert.equal(state.investigators[0].threat.find(item => item.id === 'debt').resources, 2)
  assert.match(validateMove(state, 0, { action: 'payDebt', threatId: 'debt' }), /两次/)
})

test('N4.2 幸运兔脚在任意技能检定失败后触发，不只限于调查/攻击/躲避入口', () => {
  const state = fixture()
  const foot = asset(state, '01075')
  const inv = state.investigators[0]
  inv.willpower = 0
  state.encounterDeck = ['rottingRemains']
  state.encounterDiscard = []
  state.chaosBag = ['0']
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'commit')
  answer(state, 'done')
  assert.equal(state.pendingChoice.kind, 'reaction')
  assert.equal(state.pendingChoice.source, 'rabbitsFoot')
  answer(state, 'trigger')
  settle(state)
  assert.equal(state.investigators[0].hand.length, 2)
  assert.equal(state.investigators[0].assets.find(a => a.code === '01075').exhausted, true)
})
