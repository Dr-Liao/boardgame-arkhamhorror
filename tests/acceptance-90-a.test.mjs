import test from 'node:test'
import assert from 'node:assert/strict'
import { enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'

const me = state => state.investigators[0]
const here = state => state.locations.find(location => location.id === me(state).location)

test('90019 抽到后保留手牌，回合末受恐惧，打出加毁灭并立即推进密谋', () => {
  const state = fixture('90017', 2)
  me(state).deck = ['90019']
  move(state, { action: 'draw' })
  settle(state)
  assert.deepEqual(me(state).hand, ['90019'])
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).horror, 2)
  assert.deepEqual(me(state).hand, ['90019'])

  const played = fixture('90017')
  me(played).hand = ['90019']
  const stage = played.agendas[played.agendaIndex]
  played.doom = stage.doomThreshold - 1
  const actionsBefore = me(played).actionsLeft
  move(played, { action: 'play', cardId: '90019' })
  settle(played)
  assert.equal(played.agendaIndex, 1)
  assert.equal(played.doom, 0)
  assert.equal(me(played).actionsLeft, actionsBefore - 1)
  assert.ok(!me(played).hand.includes('90019'))
  assert.ok(me(played).discard.includes('90019'))
})

test('90030 入场四发，按线索修正战斗，只有无线索时击败敌人才补弹', () => {
  for (const [clues, fight, health, killed, ammo] of [
    [1, 8, 2, true, 3],
    [0, 8, 2, false, 3],
    [0, 6, 2, true, 4],
    [0, 6, 3, false, 3],
  ]) {
    const state = fixture('90024')
    here(state).clues = clues
    me(state).hand = ['90030']
    move(state, { action: 'play', cardId: '90030' })
    settle(state)
    const weapon = () => me(state).assets.find(card => card.code === '90030')
    assert.equal(weapon().uses, 4)
    const targetId = enemy(state, { fight, health, damage: 0, horror: 0 }).id
    const shot = legalMoves(state, 0).find(option => option.assetId === weapon().id && option.targetId === targetId)
    assert.ok(shot, '真实目标应出现')
    const before = me(state).actionsLeft
    move(state, shot)
    settle(state)
    const target = state.enemies.find(item => item.id === targetId)
    assert.equal(!target, killed)
    if (target) assert.equal(target.damageTaken, fight === 8 ? 0 : 2)
    assert.equal(weapon().uses, ammo)
    assert.equal(me(state).actionsLeft, before - 1)
    weapon().uses = 0
    assert.ok(validateMove(state, 0, shot))
  }
})
