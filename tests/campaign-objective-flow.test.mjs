import assert from 'node:assert/strict'
import test from 'node:test'
import { campaignGraph, enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { changeProgress, claimProgress, progressFor, progressOptions, settleProgress, validateProgressTracks } from '../src/campaign/progress-tracks.js'
import { choiceError, requestChoice, resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

const scenarioIds = ['ridgeSurvey', 'valleySurvey', 'relayInterior', 'relayCommissioning']
const roleOptions = [
  { id: 'surveyor', label: '地形测量员' },
  { id: 'technician', label: '设备修理员' },
  { id: 'navigator', label: '路线领航员' },
]
const registered = event => ({ type: 'registered', handler: 'relayTest', event })
const route = (id, label, next) => ({ id, label, next, effects: [{ type: 'record', key: 'route', value: id }] })
const scenario = (scenarioId, next) => ({ type: 'scenario', scenarioId, next })
const recordCount = (key, atLeast) => ({ recordCount: { key, atLeast } })

// Synthetic campaign for a group reopening an abandoned communications relay.
// Each player has a different assignment, and either route can reach the relay.
const manifest = {
  scenarioIds,
  recordSchema: { route: 'string', permits: 'string[]', powerRestored: 'boolean' },
  flow: {
    start: 'briefing',
    nodes: {
      briefing: { type: 'story', effects: [registered('claimRoles')], next: 'route' },
      route: { type: 'choice', options: [route('ridge', '沿山脊行进', 'ridgeSurvey'), route('valley', '沿谷地行进', 'valleySurvey')] },
      ridgeSurvey: scenario('ridgeSurvey', 'gate'),
      valleySurvey: scenario('valleySurvey', 'gate'),
      gate: { type: 'stepReturn', rules: [
        { id: 'openRelay', when: recordCount('permits', 2), next: 'relayInterior' },
      ], next: 'remoteCommissioning' },
      relayInterior: scenario('relayInterior', 'remoteCommissioning'),
      remoteCommissioning: { type: 'interlude', upgrades: true, effects: [registered('settleRoles')], next: 'relayCommissioning' },
      relayCommissioning: scenario('relayCommissioning', 'outcome'),
      outcome: { type: 'stepReturn', rules: [
        { id: 'opened', when: { record: 'powerRestored', equals: true }, next: 'activeRelay' },
      ], next: 'securedRelay' },
      activeRelay: { type: 'end', outcome: 'restored' },
      securedRelay: { type: 'end', outcome: 'secured' },
    },
  },
}

function newState() {
  return { currentSeat: 0, revision: 0, investigators: [{ seat: 0 }, { seat: 1 }], campaign: {
    leadSeat: 0,
    records: { permits: [], powerRestored: false, route: '' },
    recordSchema: manifest.recordSchema,
    investigators: {
      0: { id: 'lia', merits: 0, repairKind: '' },
      1: { id: 'tomas', merits: 0, repairKind: '' },
    },
  } }
}

function applyEffect(state, effect) {
  const { campaign } = state
  if (effect.event === 'claimRoles') {
    for (const seat of [0, 1]) {
      const options = progressOptions(campaign, 'relayAssignments', seat, roleOptions)
      if (!options.length) continue
      const role = requestChoice(state, { kind: 'assignment', source: 'relayRoles', seat, options })
      assert.equal(claimProgress(campaign, 'relayAssignments', seat, role), true)
    }
  } else if (effect.event === 'settleRoles') {
    for (const seat of [0, 1]) {
      const record = campaign.investigators[seat]
      createMechanicsApi(state).progress.settle('relayAssignments', seat, 'remoteCommissioning', ({ value }) => {
        if (value < 2) {
          record.repairKind = requestChoice(state, { kind: 'repairKind', source: 'relayPreparation', seat,
            options: [{ id: 'stabilize', label: '加固装置' }, { id: 'reroute', label: '改接线路' }],
          })
        }
        record.merits += value
      })
    }
  } else throw new Error(`未知测试效果 ${effect.event}`)
}

function execute(state, _seat, move) {
  const { campaign } = state
  if (move.next) enterCampaignNode(campaign, manifest, move.next)
  if (move.action === 'settleAgain') applyEffect(state, registered('settleRoles'))
  state.arrived = walkCampaign(campaign, manifest, (id, _node, options) =>
    requestChoice(state, { kind: 'campaignBranch', source: id, seat: campaign.leadSeat,
      options: options.map(({ id, label }) => ({ id, label })),
    }), effect => applyEffect(state, effect)).id
}

function answer(state, seat, optionId) {
  const move = { action: 'choose', choiceId: state.pendingChoice.id, optionId }
  assert.equal(choiceError(state, seat, move), null)
  resolveTransaction(state, seat, move, execute)
}

test('战役选择可按席位暂停并恢复，重复许可不能解锁入口，结算重试只发放一次结果', () => {
  const state = newState()
  resolveTransaction(state, 0, { action: 'visit' }, execute)
  assert.equal(state.pendingChoice.seat, 0)
  answer(state, 0, 'surveyor')

  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.pendingChoice.options.map(option => option.id), ['technician', 'navigator'])
  assert.equal(restored.pendingChoice.seat, 1)
  assert.ok(choiceError(restored, 0, { action: 'choose', optionId: 'technician', choiceId: restored.pendingChoice.id }))
  answer(restored, 1, 'technician')
  assert.equal(restored.pendingChoice.seat, 0)
  answer(restored, 0, 'ridge')
  assert.equal(restored.arrived, 'ridgeSurvey')
  assert.equal(restored.campaign.records.route, 'ridge')

  restored.campaign.records.permits = ['construction', 'construction']
  assert.equal(changeProgress(restored.campaign, 'relayAssignments', 0, 2, 'ridgeSurveyExit'), 2)
  assert.equal(changeProgress(restored.campaign, 'relayAssignments', 1, 1, 'ridgeSurveyExit'), 1)
  assert.equal(changeProgress(restored.campaign, 'relayAssignments', 1, 1, 'ridgeSurveyExit'), false)
  resolveTransaction(restored, 0, { action: 'visit', next: 'gate' }, execute)
  assert.equal(restored.pendingChoice.seat, 1)
  assert.equal(restored.campaign.flow.visits.relayInterior, undefined)
  const beforeAnswer = JSON.parse(JSON.stringify(restored))
  answer(beforeAnswer, 1, 'reroute')
  assert.equal(beforeAnswer.arrived, 'remoteCommissioning')
  assert.deepEqual(Object.values(beforeAnswer.campaign.investigators).map(record => record.merits), [2, 1])
  assert.equal(beforeAnswer.campaign.investigators[1].repairKind, 'reroute')
  resolveTransaction(beforeAnswer, 0, { action: 'settleAgain' }, execute)
  assert.equal(beforeAnswer.pendingChoice, null)
  assert.deepEqual(Object.values(beforeAnswer.campaign.investigators).map(record => record.merits), [2, 1])
  assert.equal(progressFor(beforeAnswer.campaign, 'relayAssignments', 0).value, 2)
  assert.doesNotThrow(() => validateProgressTracks(beforeAnswer.campaign))
  resolveTransaction(beforeAnswer, 0, { action: 'visit', next: 'relayCommissioning' }, execute)
  assert.equal(beforeAnswer.arrived, 'relayCommissioning')
  resolveTransaction(beforeAnswer, 0, { action: 'visit', next: 'outcome' }, execute)
  assert.equal(beforeAnswer.arrived, 'securedRelay')
})

test('另一条路线可凭不同许可进入设施，终章入口与结果节点分别走各自出口', () => {
  const state = newState()
  resolveTransaction(state, 0, { action: 'visit' }, execute)
  answer(state, 0, 'navigator')
  answer(state, 1, 'technician')
  answer(state, 0, 'valley')
  assert.equal(state.arrived, 'valleySurvey')
  state.campaign.records.permits = ['construction', 'electrical', 'electrical']
  resolveTransaction(state, 0, { action: 'visit', next: campaignGraph(manifest).nodes.valleySurvey.next }, execute)
  assert.equal(state.arrived, 'relayInterior')
  assert.deepEqual(state.campaign.flow.history.find(visit => visit.nodeId === 'gate').choice, 'openRelay')
  state.campaign.records.powerRestored = true
  resolveTransaction(state, 0, { action: 'visit', next: 'outcome' }, execute)
  assert.equal(state.arrived, 'activeRelay')
})

test('集合门槛注册时拒绝错误类型、未知字段和非法计数，读取时拒绝坏集合值', () => {
  const check = when => {
    const copy = structuredClone(manifest)
    copy.flow.nodes.gate.rules[0].when = when
    return validateCampaignGraph(copy)
  }
  assert.doesNotThrow(() => check(recordCount('permits', 2)))
  assert.throws(() => check(recordCount('route', 2)), /集合记录/)
  assert.throws(() => check(recordCount('unknown', 2)), /集合记录/)
  assert.throws(() => check(recordCount('permits', 1.5)), /非负整数/)
  assert.throws(() => check({ recordCount: { key: 'permits', atLeast: 1, extra: 'garbage' } }), /非负整数/)
  assert.equal(flowCondition(recordCount('permits', 2), { records: { permits: ['construction', 'electrical', 7] } }), false)
  assert.equal(flowCondition(recordCount('permits', 0), { records: {} }), true)
})

test('进度结算按调查员身份区分，并回收失败及重入时的结算凭据', () => {
  const { campaign } = newState()
  assert.equal(claimProgress(campaign, 'relayAssignments', 0, 'surveyor'), true)
  assert.throws(() => settleProgress(campaign, 'relayAssignments', 0, 'payment', () => { throw new Error('取消') }), /取消/)
  assert.equal(settleProgress(campaign, 'relayAssignments', 0, 'payment', ({ option, value }) => {
    assert.equal(option, 'surveyor')
    assert.equal(value, 0)
    assert.equal(settleProgress(campaign, 'relayAssignments', 0, 'payment', assert.fail), false)
  }), true)
  assert.equal(settleProgress(campaign, 'relayAssignments', 0, 'payment', assert.fail), false)
  campaign.investigators[0] = { id: 'inez', merits: 0 }
  assert.equal(settleProgress(campaign, 'relayAssignments', 0, 'payment', assert.fail), false)
  assert.equal(claimProgress(campaign, 'relayAssignments', 0, 'surveyor'), false)
  assert.equal(claimProgress(campaign, 'relayAssignments', 0, 'navigator'), true)
  assert.equal(settleProgress(campaign, 'relayAssignments', 0, 'payment', () => {}), true)
  assert.doesNotThrow(() => validateProgressTracks(campaign))
})
