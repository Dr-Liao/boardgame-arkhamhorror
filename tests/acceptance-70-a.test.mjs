import test from 'node:test'
import assert from 'node:assert/strict'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { openAbandonedWarehouse } from './acceptance-70-a-fixture.mjs'

test('70032 废弃仓库由幕 3 放置并揭示，线索随人数缩放且可调查', () => {
  for (const count of [1, 2]) {
    const state = openAbandonedWarehouse(count)
    const warehouse = () => state.locations.find(location => location.id === 'abandonedWarehouse')
    assert.equal(state.actIndex, 2)
    assert.equal(warehouse().originalCode, '70032')
    assert.equal(warehouse().revealed, true)
    assert.deepEqual(warehouse().traits, ['Distortion'])
    assert.equal(warehouse().shroud, 3)
    assert.equal(warehouse().clues, 2 * count)
    assert.deepEqual(warehouse().connections, ['chamberOfRot', 'chamberOfDecay', 'chamberOfHunger'])
    assert.ok(state.investigators.every(investigator => investigator.location === warehouse().id))
    assert.ok(legalMoves(state, 0).some(option => option.action === 'investigate'))
    const before = state.investigators[0].clues
    move(state, { action: 'investigate' })
    settle(state)
    assert.equal(warehouse().clues, 2 * count - 1)
    assert.equal(state.investigators[0].clues, before + 1)
  }
})
