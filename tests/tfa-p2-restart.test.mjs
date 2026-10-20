import test from 'node:test'
import assert from 'node:assert/strict'
import { registerContentBundle } from '../content/registered.js'
import { manifest as nightManifest } from '../content/campaigns/nightOfTheZealot/manifest.js'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'

// P2 剧本重开原语（§2.6 最后一项）：结局钩子调用 api.restartScenario() 后，
// 引擎放弃本次结算、把当前节点的 visit 计数 +1，并原地重新布置同一剧本。
// 用一个最小战役验证引擎路径；04059 结局 4 在自己的章节测试里验证语义。
const campaignId = 'tfaRestartHarness'
const scenarioId = 'tfaRestartHarnessScenario'

registerContentBundle({
  packs: [],
  campaigns: [{
    ...nightManifest,
    id: campaignId,
    name: '剧本重开验证',
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', 'notz'],
    flow: {
      start: scenarioId,
      nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } },
    },
  }],
  scenarios: [{
    scenario: { ...gathering.scenario, id: scenarioId },
    behavior: {
      ...gathering.behavior,
      id: scenarioId,
      // 每次行动后都结算一次「结局」，第一次请求重开、第二次正常结束。
      checkObjectives(state, api) { api.finish('r1') },
      resolution(state, key, events, api) {
        if (!state.campaign.records.restartUsed) {
          state.campaign.records.restartUsed = true
          if (api.restartScenario?.()) return { award: false, bonus: 0, restarted: true }
        }
        return { award: true, bonus: 0 }
      },
    },
    manifest: {
      ...Object.fromEntries(Object.entries(gathering.manifest)
        .filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: scenarioId,
      campaignId,
      status: 'playable',
      requiredPackIds: ['core', 'notz'],
      requiredEncounterGroupIds: [],
      behaviorIds: [scenarioId],
    },
  }],
})

const { createGameState, applyMove, decisionSeat } = await import('../src/engine/engine.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice && guard < 400; guard++) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

test('剧本重开：结局钩子重开同一剧本，visit +1 且不记录本次结算', () => {
  const state = createGameState({ campaignId, seed: 'tfa-restart', playerInvestigator: '01001' }, [{ seat: 0 }])
  settle(state)
  assert.equal(state.status, 'playing')
  assert.equal(state.scenario.id, scenarioId)
  const nodeId = state.campaign.flow.nodeId
  const visitsBefore = state.campaign.flow.visits[nodeId]
  assert.equal(visitsBefore, 1)

  applyMove(state, decisionSeat(state), { action: 'endTurn' })
  settle(state)

  assert.equal(state.campaign.flow.visits[nodeId], 2, '重开后同一节点 visit +1')
  assert.equal(state.campaign.scenarioResults.length, 0, '被重开的结算不进账本')
  assert.equal(state.status, 'playing', '重开后仍在进行中')
  assert.equal(state.campaign.records.restartUsed, true)
  assert.ok(state.investigators[0].hand.length > 0, '重开后重新发起始手牌')
  assert.equal(state.scenario.id, scenarioId, '仍是同一剧本')

  // 第二次结算不再重开，正常结束战役。
  applyMove(state, decisionSeat(state), { action: 'endTurn' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1, '第二次正常记账')
  assert.equal(state.status, 'over', '战役结束')
})
