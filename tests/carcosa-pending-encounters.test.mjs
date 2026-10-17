import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as carcosaPack } from '../content/packs/carcosaCampaign/manifest.js'
import * as phantom from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'

const packId = 'carcosaPendingEncounterPack'
const scenarioId = 'carcosaPendingEncounterScenario'
const campaignId = 'carcosaPendingEncounterCampaign'
const production = phantom.behavior

registerContentBundle({ packs: [{ ...carcosaPack, id: packId, status: 'playable' }] })
registerContentBundle({
  campaigns: [{
    ...contentRegistry.getCampaign('thePathToCarcosa'),
    id: campaignId,
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', 'notz', packId],
    flow: {
      start: scenarioId,
      nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      },
    },
  }],
  scenarios: [{
    scenario: { ...phantom.scenario, id: scenarioId },
    behavior: {
      ...production,
      id: scenarioId,
      actions(state, inv) {
        return [
          ...(production.actions?.(state, inv) || []),
          { action: 'scenarioAction', rule: 'c5DrawEncounter', actions: 0, label: 'C5 抽遭遇牌' },
        ]
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'c5DrawEncounter') return api.drawEncounter(inv.seat)
        return production.performAction?.(state, inv, move, api)
      },
    },
    manifest: {
      ...phantom.manifest,
      id: scenarioId,
      campaignId,
      status: 'playable',
      requiredMechanicIds: [],
      requiredEncounterGroupIds: [],
      requiredPackIds: ['core', 'notz', packId],
      behaviorIds: [scenarioId],
    },
  }],
})

const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, 'choice loop')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, {
      action: 'choose', choiceId: pending.id, optionId,
    })
  }
}

function fixture() {
  const state = createGameState({
    campaignId,
    seed: 'carcosa-c5-pending',
    playerInvestigator: '01001',
  }, [{ seat: 0 }])
  settle(state)
  state.phase = 'investigation'
  state.currentSeat = 0
  state.turnSerial = 1
  const inv = state.investigators[0]
  inv.actionsLeft = 20
  inv.hand = []
  inv.discard = []
  inv.assets = []
  inv.threat = []
  state.enemies = []
  return state
}

test('C5 Torturous Chords charges fast card plays and removes one resource per copy', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['03232']
  inv.resources = 10
  inv.threat = [
    { id: 'chords-1', code: '03225', resources: 2,
      threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true } },
    { id: 'chords-2', code: '03225', resources: 3,
      threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true } },
  ]
  const play = legalMoves(state).find(move => move.action === 'play' && move.cardId === '03232')
  assert.ok(play)
  const actions = inv.actionsLeft
  const resources = inv.resources
  applyMove(state, 0, play)
  settle(state)
  const after = state.investigators[0]
  assert.equal(after.actionsLeft, actions)
  assert.ok(!after.hand.includes('03232'))
  assert.deepEqual(after.threat.map(card => card.resources), [1, 2])
  assert.equal(after.resources, resources - 3)
})

test('03185 约束衣占满手部与身体槽，并生成双行动弃置入口', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['01016']
  inv.resources = 10
  inv.threat = [{
    id: 'straitjacket',
    code: '03185',
    slots: ['Body', 'Hand x2'],
    cannotLeavePlay: true,
    threatEffect: {
      discardCost: { action: 2 },
      sameLocationAction: true,
    },
  }]
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01016'), false)
  const discard = legalMoves(state).find(move =>
    move.action === 'discardThreat' && move.threatId === 'straitjacket')
  assert.ok(discard)
  const before = inv.actionsLeft
  applyMove(state, 0, discard)
  assert.equal(state.investigators[0].actionsLeft, before - 2)
  assert.equal(state.investigators[0].threat.length, 0)
  assert.ok(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01016'))
})
