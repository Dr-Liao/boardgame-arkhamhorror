import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { commitIcons, drawCards, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

function reveal(state, seat, code, choices = []) {
  state.investigators[seat].deck.push(code)
  const execute = draft => drawCards(draft, draft.investigators[seat], 1, [])
  resolveTransaction(state, seat, { action: 'probeDraw' }, execute)
  let used = 0
  while (state.pendingChoice) {
    assert.ok(used < 100)
    const pending = state.pendingChoice
    const optionId = choices.find(id => pending.options.some(option => option.id === id))
      ?? pending.options.find(option => option.id === 'done' || option.id === 'skip')?.id
      ?? pending.options[0].id
    used++
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('09-a-3 09106、09107、09109：不同调查员共用每轮两张抉择上限', () => {
  const state = fixture('01001', 2)
  state.enemies = []
  reveal(state, 0, '09106', ['willpower', 'combat'])
  reveal(state, 1, '09107')
  reveal(state, 1, '09109', ['draw'])
  assert.ok(state.investigators[0].discard.includes('09106'))
  assert.ok(state.investigators[1].discard.includes('09107'))
  assert.ok(state.investigators[1].hand.includes('09109'))
  assert.equal(state.investigators[1].bonusActionsOnNextTurn, undefined)
  state.round++
  reveal(state, 1, '09109', ['draw'])
  assert.equal(state.investigators[0].bonusActionsOnNextTurn, -1)
  assert.ok(state.investigators[1].discard.includes('09109'))
})

test('09-a-3 09113：自动失败时仍在攻击结束后提供返回手牌的选择', () => {
  const state = fixture('01001')
  const bat = asset(state, '09113')
  const target = enemy(state)
  state.chaosBag = ['autofail']
  move(state, { action: 'ability', assetId: bat.id, abilityIndex: 0, targetId: target.id })
  settle(state, choice => choice.options.find(option => option.id === 'hand')?.id)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 0)
  assert.ok(state.investigators[0].hand.includes('09113'))
  assert.equal(state.investigators[0].assets.some(item => item.id === bat.id), false)
})

test('09-a-3 09088：敌人本轮不能受到伤害，下一轮恢复正常', () => {
  const state = fixture('01001')
  const target = enemy(state)
  const inv = state.investigators[0]
  inv.hand = ['09088']
  move(state, { action: 'play', cardId: '09088' })
  settle(state, choice => choice.options.find(option => option.id === 'evade')?.id)
  const current = state.enemies.find(item => item.id === target.id)
  assert.equal(current.exhausted, true)
  assert.equal(current.doom, 1)
  scenarioRuntime(state, []).damageEnemy(current.id, 2, 0)
  assert.equal(current.damageTaken, 0)
  state.round++
  scenarioRuntime(state, []).damageEnemy(current.id, 2, 0)
  assert.equal(current.damageTaken, 2)
})

test('09-a-3 09128：准备不足在手牌中只削减持有者投入的每张牌一个图标', () => {
  const state = fixture('01001', 2)
  const [holder, partner] = state.investigators
  const card = '01093'
  const icons = commitIcons(state, holder, card, 'willpower')
  assert.ok(icons > 0)
  holder.hand.push('09128')
  assert.equal(commitIcons(state, holder, card, 'willpower'), icons - 1)
  assert.equal(commitIcons(state, partner, card, 'willpower'), icons)
  holder.hand.pop()
  assert.equal(commitIcons(state, holder, card, 'willpower'), icons)
})
