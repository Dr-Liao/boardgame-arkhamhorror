import test from 'node:test'
import assert from 'node:assert/strict'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { consumeStartingAdjustments, startScenario } from '../src/engine/engine.js'
import { requestChoice, resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'
import { fixture } from './core-fixture.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const setupAdjustments = state => createMechanicsApi(state).startingAdjustments

function findRoute() {
  return {
    currentSeat: 0,
    revision: 0,
    scenario: { id: 'fieldWorkshop' },
    investigators: [{ seat: 0, campaignId: 'operator-one', resources: 5, clues: 0 }],
    campaign: {
      investigators: { 0: { id: 'operator-one', status: 'active' } },
      flow: { history: [{ nodeId: 'workshop', visit: 1 }] },
    },
  }
}

function enter(state, id) {
  state.scenario.id = id
  state.campaign.flow.history.push({ nodeId: id, visit: 1 })
  return consumeStartingAdjustments(state, state.investigators[0])
}

test('跨章调整跳过重置和不匹配的目的地，兑现后按身份永久忽略重复回执', () => {
  const state = findRoute()
  const next = { receipt: 'shiftPayment', resources: 2 }
  const specific = { receipt: 'markSurvey', scenarioId: 'weatherStation', clues: 1 }
  assert.equal(setupAdjustments(state).defer(0, next), true)
  assert.equal(setupAdjustments(state).defer(0, next), false)
  assert.equal(setupAdjustments(state).defer(0, specific), true)

  const saved = clone(state)
  // Rebuilding the same scenario does not enter a new flow node.
  assert.equal(consumeStartingAdjustments(saved, saved.investigators[0]), null)
  assert.deepEqual(enter(saved, 'supplyShed'), { resources: 2, clues: 0 })
  assert.equal(saved.investigators[0].resources, 7)
  assert.deepEqual(enter(saved, 'weatherStation'), { resources: 0, clues: 1 })
  assert.equal(saved.investigators[0].clues, 1)
  assert.equal(consumeStartingAdjustments(saved, saved.investigators[0]), null)
  assert.equal(setupAdjustments(saved).defer(0, next), false)
  assert.equal(setupAdjustments(saved).defer(0, specific), false)

  // A new investigator can schedule an independent award with the same receipt.
  saved.campaign.investigators[0] = { id: 'operator-two', status: 'active' }
  saved.investigators[0].campaignId = 'operator-two'
  assert.equal(setupAdjustments(saved).defer(0, next), true)
})

test('暂停和读档保留原调查员的回执，替补不继承未兑现的调整', () => {
  const state = findRoute()
  const queueOnConfirmation = (draft, seat) => {
    assert.equal(setupAdjustments(draft).defer(seat, { receipt: 'eveningPay', resources: 2 }), true)
    requestChoice(draft, { kind: 'schedule', source: 'fieldWorkshop', seat,
      options: [{ id: 'confirm', label: '确认维修班次' }] })
  }
  resolveTransaction(state, 0, { action: 'finishShift' }, queueOnConfirmation)
  assert.equal(state.pendingChoice.seat, 0)
  assert.equal(state.continuation.base.campaign.startingAdjustmentQueue, undefined)
  const saved = clone(state)
  resolveTransaction(saved, 0, { action: 'choose', choiceId: saved.pendingChoice.id, optionId: 'confirm' }, queueOnConfirmation)
  assert.equal(saved.pendingChoice, null)
  assert.equal(saved.campaign.startingAdjustmentQueue.length, 1)
  saved.campaign.investigators[0] = { id: 'operator-two', status: 'active' }
  saved.investigators[0].campaignId = 'operator-two'
  assert.equal(enter(saved, 'supplyShed'), null)
  assert.equal(saved.investigators[0].resources, 5)
})

test('真实关卡开局合并新旧调整，迁移拒绝无效或重复的存档回执', () => {
  const state = fixture()
  const { flow } = state.campaign
  assert.ok(flow.history.length)
  assert.equal(setupAdjustments(state).defer(0, { receipt: 'repairAllowance', resources: 2, clues: 1 }), true)
  state.campaign.startingAdjustments = { 0: { resources: -1, clues: 0 } }
  const saved = clone(state)
  assert.doesNotThrow(() => migrateState(saved))
  const duplicate = clone(saved)
  duplicate.campaign.startingAdjustmentQueue.push(duplicate.campaign.startingAdjustmentQueue[0])
  assert.throws(() => migrateState(duplicate), /重复的跨章开局调整回执/)
  const malformed = clone(saved)
  malformed.campaign.startingAdjustmentQueue[0].resources = 0.25
  assert.throws(() => migrateState(malformed), /非零整数/)
  assert.equal(saved.campaign.startingAdjustmentQueue[0].applied, false)

  // The engine consumes both queues through completeStartingHand.
  flow.history.push({ nodeId: 'nextEntry', visit: 1 })
  saved.campaign.flow.history = flow.history
  const before = clone(saved)
  delete before.campaign.startingAdjustmentQueue
  startScenario(before, 1, [])
  startScenario(saved, 1, [])
  assert.equal(saved.investigators[0].resources, before.investigators[0].resources + 2)
  assert.equal(saved.investigators[0].clues, before.investigators[0].clues + 1)
  assert.equal(saved.campaign.startingAdjustmentQueue[0].applied, true)
  assert.equal(saved.campaign.startingAdjustments[0], undefined)
})
