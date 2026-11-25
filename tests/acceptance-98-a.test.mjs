import test from 'node:test'
import assert from 'node:assert/strict'
import { beneathCards, stashBeneath } from '../src/engine/commit-origins.js'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'

test('98020 只允许弃掉同特质暗置遭遇牌，支付后攻击、躲避与遭遇检定难度减二', () => {
  for (const action of ['fight', 'evade', 'draw']) {
    const state = fixture('98019', 2)
    const ally = asset(state, '98020')
    const foe = enemy(state, { code: 'ghoulMinion', originalCode: '01160', fight: 4, evade: 4 })
    state.investigators[0].deck = ['01088']
    state.encounterDeck = []
    let matching, other, difficulty
    if (action === 'draw') {
      matching = 'dissonantVoices'
      other = 'ghoulMinion'
      difficulty = 1
    } else {
      matching = 'ghoulMinion'
      other = 'dissonantVoices'
      difficulty = 2
    }
    stashBeneath(state, 0, '98019', matching, 3)
    stashBeneath(state, 0, '98019', other, 3)
    if (action === 'draw') {
      // 以正常神话抽遭遇牌触发本次诡计检定，暗置牌仅作为费用候选。
      state.investigators[0].deck = ['01088', '01088']
      state.encounterDeck = ['ancientEvils', 'rottingRemains']
      move(state, { action: 'endTurn' })
      settle(state)
      move(state, { action: 'endTurn' })
    } else {
      move(state, { action, enemyId: foe.id })
    }
    let paid = false
    settle(state, choice => {
      if (choice.source === ally.id && choice.kind === 'card') {
        assert.deepEqual(choice.options.map(option => option.id), [matching])
        paid = true
        return matching
      }
      return choice.options.find(option => /同特质/.test(option.label))?.id
    })
    assert.ok(paid, action)
    assert.equal(state.lastTestResult.difficulty, difficulty)
    assert.ok(state.encounterDiscard.includes(matching))
    assert.ok(beneathCards(state, 0, '98019').includes(other))
  }
})

test('98008 引擎揭示遭遇牌库顶并在横置后弃置两副牌库顶部', () => {
  const state = fixture('98007', 2)
  const inv = () => state.investigators[0]
  state.encounterDeck = ['ancientEvils', 'dissonantVoices']
  inv().deck = ['01088', '01087']
  inv().hand = ['98008']
  move(state, { action: 'play', cardId: '98008' })
  settle(state)
  const support = () => inv().assets.find(item => item.code === '98008')
  const getAbility = index => legalMoves(state, 0).find(option => option.assetId === support().id && option.abilityIndex === index)
  const before = inv().actionsLeft
  move(state, getAbility(0))
  assert.deepEqual(state.pendingChoice.options[0].cardCodes, ['dissonantVoices'])
  settle(state)
  assert.equal(inv().actionsLeft, before - 1)
  assert.deepEqual(state.encounterDeck, ['ancientEvils', 'dissonantVoices'])
  move(state, getAbility(1))
  settle(state)
  assert.equal(support().exhausted, true)
  assert.deepEqual(inv().deck, ['01088'])
  assert.ok(inv().discard.includes('01087'))
  assert.deepEqual(state.encounterDeck, ['ancientEvils'])
  assert.deepEqual(state.encounterDiscard, ['dissonantVoices'])
  assert.equal(inv().actionsLeft, before - 1)
  assert.ok(validateMove(state, 0, { action: 'ability', assetId: support().id, abilityIndex: 1 }))
})
