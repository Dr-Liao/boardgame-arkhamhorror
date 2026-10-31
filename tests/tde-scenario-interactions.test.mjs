// 食梦者交互 3–10：观察投影不泄露朝下的牌、袋序、他人隐藏牌和未到达结局；掩藏翻面走合法行动。
import test from 'node:test'
import assert from 'node:assert/strict'

import mod from '../index.js'
import { fixture } from './core-fixture.mjs'
import { scenarioInteractionsView } from '../src/integration/scenario-interactions.js'

test('没有蜂拥、滋生袋、警报、隐藏牌、掩藏、计数、纵链或结局时不增加视图字段', () => {
  const state = fixture()
  assert.equal(scenarioInteractionsView(state, 0), null)
  assert.equal('scenarioInteractions' in mod.viewState(state, 0), false)
})

test('投影只公开该公开的部分', () => {
  const state = fixture('01001', 2)
  const host = state.enemies[0] || (state.enemies.push({ id: 'host', name: '头领', health: 2, location: state.investigators[0].location }), state.enemies[0])
  host.swarmCards = [
    { id: 'swarm1', code: 'secret-a', source: 'swarming', defeated: false },
    { id: 'swarm2', code: 'secret-b', source: 'swarming', defeated: false },
  ]
  state.tokenBags = { infestation: { tokens: ['skull', 'tablet', 'cultist'], revealed: [] } }
  state.investigatorCounters = { alarmLevel: { seats: [2, 0], max: 5 } }
  state.investigators[0].hiddenCards = ['hidden-own']
  state.investigators[1].hiddenCards = ['hidden-other']
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  here.veiled = true
  here.clues = 2
  here.backCode = 'story-secret'
  state.markerCounts = { reference: 4 }
  const second = state.locations.find(location => location.id !== here.id) || here
  here.verticalIndex = 0
  if (second !== here) second.verticalIndex = 1
  here.dreamGate = true
  state.campaign.epilogueMatrix = {
    a: [{ id: 'a1' }],
    b: [{ id: 'b1' }, { id: 'b2' }],
    entries: {
      'a1|b1': { title: '已到达的结局', textKey: 'reached' },
      'a1|b2': { title: '不应出现', textKey: 'secret-ending' },
    },
  }
  state.campaign.epilogueResolved = { a: 'a1', b: 'b1' }
  const view = mod.viewState(state, 0)
  const panel = view.scenarioInteractions
  const dumped = JSON.stringify(panel)
  assert.equal(dumped.includes('secret-a'), false)
  assert.equal(dumped.includes('secret-ending'), false)
  assert.equal(dumped.includes('不应出现'), false)
  assert.equal(dumped.includes('hidden-other'), false)
  assert.equal(dumped.includes('skull'), false)
  assert.equal(panel.swarm[0].count, 2)
  assert.equal(panel.swarm[0].blockedReason.includes('2'), true)
  assert.equal(panel.tokenBag.bags[0].count, 3)
  assert.deepEqual(panel.tokenBag.bags[0].revealed, [])
  assert.deepEqual(panel.alarm.seats[0], { seat: 0, value: 2 })
  assert.deepEqual(panel.hidden.seats.find(item => item.seat === 0).codes, ['hidden-own'])
  assert.equal(panel.hidden.seats.find(item => item.seat === 1).codes, undefined)
  assert.equal(panel.veiled[0].storyCode, null)
  assert.equal(panel.veiled[0].reason, '地点上还有线索')
  assert.equal(panel.markers[0].count, 4)
  assert.equal(panel.epilogue.title, '已到达的结局')
  assert.equal(panel.epilogue.status, 'reached')
  assert.equal(view.enemies.find(enemy => enemy.id === host.id).swarmCards.some(card => card.code), false)
  const guest = mod.viewState(state, 1)
  assert.equal(JSON.stringify(guest.scenarioInteractions).includes('hidden-own'), false)
})

test('无线索的掩藏地点可以翻面，翻过之后故事卡号可见且不能再翻', () => {
  const state = fixture()
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  location.veiled = true
  location.clues = 0
  location.backCode = 'demo-story'
  const move = mod.legalMoves(state, 0).find(item => item.action === 'flipVeiled')
  assert.equal(move.locationId, location.id)
  mod.applyMove(state, 0, { action: 'flipVeiled', locationId: location.id })
  const projected = mod.viewState(state, 0).scenarioInteractions.veiled.find(item => item.id === location.id)
  assert.equal(projected.flipped, true)
  assert.equal(projected.storyCode, 'demo-story')
  assert.equal(mod.legalMoves(state, 0).some(item => item.action === 'flipVeiled'), false)
})
