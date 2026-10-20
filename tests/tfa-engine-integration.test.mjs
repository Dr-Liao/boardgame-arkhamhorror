import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'
import * as wilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'

// 正式战役已可启动（M5）。这里仍注册一个只在本文件内有效的 playable 克隆，
// 以隔离单章路径，验证真实引擎路径（布置 → 探索 → 存档回放）。
const packId = 'tfaScenarioHarnessPack'
const campaignId = 'tfaScenarioHarnessCampaign'
const scenarioId = 'theUntamedWildsHarness'

registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: packId, status: 'playable' }],
  campaigns: [{
    ...campaignManifest,
    id: campaignId,
    name: '失落的时代（测试用）',
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', packId],
    flow: {
      start: scenarioId,
      nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      },
    },
  }],
  scenarios: [{
    scenario: { ...wilds.scenario, id: scenarioId },
    behavior: { ...wilds.behavior, id: scenarioId },
    manifest: {
      ...wilds.manifest,
      id: scenarioId,
      campaignId,
      status: 'playable',
      // 测试用卡包取代正式战役包，让本章单独装配。
      requiredPackIds: [...new Set([...wilds.manifest.requiredPackIds
        .map(id => (id === 'tfaCampaign' ? packId : id)), packId])],
      requiredEncounterGroupIds: [],
      requiredMechanicIds: [],
      behaviorIds: [scenarioId],
    },
  }],
})

const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 400, 'choice loop')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

function fixture(seed = 'tfa-wilds-engine') {
  const state = createGameState({
    campaignId,
    seed,
    playerInvestigator: '01001',
  }, [{ seat: 0 }])
  settle(state)
  return state
}

test('M3 引擎路径：荒莽密林按真实布置进入牌桌', () => {
  const registered = contentRegistry.getScenario(scenarioId)
  assert.equal(registered.status, 'playable')
  const state = fixture()
  assert.equal(state.scenario.id, scenarioId)
  const camp = state.locations.find(location => location.originalCode === '04050')
  assert.ok(camp, '探险营地已放置')
  assert.equal(state.investigators[0].location, camp.id)
  assert.equal(state.explorationDeck.length, 10, '探索牌库：5 处雨林地点 + 5 张诡计')
  assert.equal(state.status, 'playing')
  assert.equal(state.encounterDeck.length > 0, true)
})

test('M3 引擎路径：探索与存档恢复给出同一结果', () => {
  const run = () => {
    const state = fixture()
    const inv = state.investigators[0]
    inv.actionsLeft = 5
    const explore = legalMoves(state).find(move => move.action === 'explore')
    assert.ok(explore, '存在探索行动')
    applyMove(state, 0, explore)
    settle(state)
    return state
  }
  const first = run()
  const second = JSON.parse(JSON.stringify(first))
  assert.deepEqual(second.explorationDeck, first.explorationDeck)
  assert.deepEqual(second.locations.map(location => [location.id, location.connections]),
    first.locations.map(location => [location.id, location.connections]))
  assert.equal(first.explorationDeck.length, 9, '一次探索消耗一张')

  // 同一存档两份副本继续探索，必须给出完全一致的状态。
  const left = JSON.parse(JSON.stringify(first))
  const right = JSON.parse(JSON.stringify(first))
  for (const state of [left, right]) {
    state.investigators[0].actionsLeft = 5
    const move = legalMoves(state).find(option => option.action === 'explore')
    if (!move) break
    applyMove(state, 0, move)
    settle(state)
  }
  assert.deepEqual({ ...left, pendingChoice: null }, { ...right, pendingChoice: null })
})
