import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredEntry } from '../src/engine/ability.js'
import { fixture, legalMoves, move, settle } from './core-fixture.mjs'

test('99001 通用调查行动触发旧印并按控制权选择增加或移除毁灭', () => {
  for (const option of ['add:0', 'remove:0']) {
    const state = fixture('99001')
    const inv = () => state.investigators[0]
    assert.equal(inv().code, '99001')
    assert.equal(registeredEntry(inv().code)?.reprintOf, '05006')
    inv().hand = ['01063']
    const base = inv().actionsLeft
    move(state, { action: 'play', cardId: '01063' })
    settle(state)
    const support = () => inv().assets.find(card => card.code === '01063')
    assert.equal(support().doom, 1)
    assert.equal(inv().actionsLeft, base)
    assert.equal(inv().spellOnlyActions, 1)

    const location = () => state.locations.find(item => item.id === inv().location)
    location().clues = 2
    location().shroud = 5
    state.chaosBag = ['eldersign']
    assert.ok(legalMoves(state, 0).some(item => item.action === 'investigate'))
    move(state, { action: 'investigate' })
    let offered = false
    settle(state, choice => {
      if (choice.source !== 'marieElderSign') return null
      offered = true
      assert.ok(choice.options.some(item => item.id === 'skip'))
      assert.ok(choice.options.some(item => item.id === option))
      return option
    })
    assert.ok(offered)
    assert.equal(support().doom, option === 'add:0' ? 2 : 0)
    assert.equal(inv().spellOnlyActions ?? 0, option === 'add:0' ? 1 : 0)
    assert.equal(inv().clues, 1)
  }
})
