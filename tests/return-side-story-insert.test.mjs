// 批次 2：主战役关间插入独立支线的引擎契约（原创夹具）。
//
// 验证：
//   1) 主战役 interlude 阶段，房主 legalMoves 出现 hubStartSideStory；
//   2) 执行后每位现役调查员支付 cost 经验，本局直接进入支线关卡；
//   3) 支线结局的战役记录写回主战役（记录 schema 在插入时合并，存档 JSON 往返保留）；
//   4) hubContinue 回到插入前的关间，随后可推进到原定下一章；
//   5) 已游玩支线不再重复出现；经验不足时动作不可见。
import test from 'node:test'
import assert from 'node:assert/strict'
import { bindScenarioIdentities } from '../content/identities.js'
import { layoutFor, scenarioManifest } from '../content/scenario-manifest.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState } from '../src/engine/engine.js'
import { legalMoves, move, settle } from './core-fixture.mjs'

const players = [{ seat: 0, role: 'human' }]
const send = (state, action) => { move(state, { action }); settle(state) }

function chapter(campaignId, id, name, options = {}) {
  const scenario = {
    id, name, startLocation: 'bench', resignAnywhere: true,
    originalCode: '01113',
    setup: '将调查员放在工作台。', setupNote: '从工作台开始。',
    locations: { bench: { id: 'bench', name: '工作台', shroud: 0, cluesPerInvestigator: 0, connections: [] } },
    acts: [{ id: 'measure', stage: '1a', name: '测量', objective: { type: 'manual' } }],
    agendas: [{ id: 'timer', stage: '1a', name: '计时', doomThreshold: 9 }],
    encounterDeck: [], enemies: {}, treacheries: {}, storyAssets: {},
    mechanics: { noEncounterDeck: true },
    resolutions: { r1: '校验结束。' },
  }
  const identities = { locations: { bench: { originalCode: '01113' } } }
  bindScenarioIdentities(scenario, identities)
  const behavior = {
    id,
    setupLocations: () => ['bench'],
    allResigned: (_, { finish }) => finish('r1'),
    resolution: () => ({ award: false, effects: options.reward || [] }),
  }
  return {
    scenario, behavior, identities,
    manifest: scenarioManifest(scenario, identities, {
      campaignId, layout: layoutFor(scenario, { bench: { x: 0, y: 0 } }), behaviorIds: [id],
      recordWrites: options.recordWrites || [],
    }),
  }
}

function fixture() {
  const template = contentRegistry.getCampaign('nightOfTheZealot')
  const hostScenarios = [
    chapter('insertionHostCampaign', 'insertHostOpen', '主机首章', { reward: [{ xp: 4 }] }),
    chapter('insertionHostCampaign', 'insertHostClose', '主机次章'),
  ]
  const sideScenarios = [
    chapter('insertionSideCampaign', 'insertSideCalibration', '支线校验',
      { recordWrites: ['sideStoryRecord'], reward: [{ xp: 1, record: { sideStoryRecord: true } }] }),
  ]
  const base = {
    schemaVersion: template.schemaVersion, contentVersion: '1.0.0', minRulesVersion: template.minRulesVersion,
    status: 'playable', chaosBags: structuredClone(template.chaosBags), interludeHandlerId: 'coreInterlude',
    opening: { experience: 0 }, recordLabels: {}, recordSchema: {}, resolutionIds: ['victory', 'defeat'],
  }
  return {
    host: {
      ...base, id: 'insertionHostCampaign', name: '插入宿主战役',
      requiredPackIds: ['core', 'notz'],
      scenarioIds: hostScenarios.map(entry => entry.scenario.id),
      unlock: { insertHostOpen: [], insertHostClose: ['insertHostOpen'] },
      flow: { start: 'open', nodes: {
        open: { type: 'scenario', scenarioId: 'insertHostOpen', next: 'restOne' },
        restOne: { type: 'interlude', title: '关间准备', next: 'close' },
        close: { type: 'scenario', scenarioId: 'insertHostClose', next: 'end' },
        end: { type: 'end' },
      } },
      sideStories: [{ campaignId: 'insertionSideCampaign', cost: 2 }],
    },
    side: {
      ...base, id: 'insertionSideCampaign', name: '插入支线战役',
      requiredPackIds: ['core', 'notz'],
      scenarioIds: ['insertSideCalibration'], unlock: { insertSideCalibration: [] },
      recordSchema: { sideStoryRecord: 'boolean' }, recordLabels: { sideStoryRecord: '支线校验完成' },
      flow: { start: 'calibration', nodes: {
        calibration: { type: 'scenario', scenarioId: 'insertSideCalibration', next: 'end' },
        end: { type: 'end' },
      } },
    },
    scenarios: [...hostScenarios, ...sideScenarios],
  }
}

let registered = null
function registerFixture() {
  if (registered) return registered
  const bundle = fixture()
  registerContentBundle({ campaigns: [bundle.host, bundle.side], scenarios: bundle.scenarios })
  registered = { host: bundle.host.id, side: bundle.side.id, sideScenario: 'insertSideCalibration' }
  return registered
}

function startHost(fixtureIds) {
  const state = createGameState({ campaignId: fixtureIds.host, campaignHub: true, seed: 'insert-side-story' }, players)
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  send(state, 'hubAutoDeck')
  send(state, 'hubConfirmDeck')
  for (const action of ['hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.uiState, 'inScenario')
  send(state, 'resign')
  if (state.uiState === 'scenarioResult') send(state, 'hubContinue')
  assert.equal(state.uiState, 'interlude')
  return state
}

test('关间插入支线：扣经验、写记录、回到原定下一章', () => {
  const fixtureIds = registerFixture()
  const state = startHost(fixtureIds)
  const before = state.campaign.investigators[0].xp
  assert.ok(before >= 2, `首关后至少要有 2 XP，实际 ${before}`)
  const options = legalMoves(state).filter(row => row.action === 'hubStartSideStory')
  assert.deepEqual(options.map(row => row.campaignId), [fixtureIds.side])
  assert.equal(options[0].cost, 2)
  assert.equal(options[0].scenarioId, fixtureIds.sideScenario)
  move(state, { action: 'hubStartSideStory', campaignId: fixtureIds.side, scenarioId: fixtureIds.sideScenario, cost: 2 })
  settle(state)
  assert.equal(state.scenario.id, fixtureIds.sideScenario, '插入后应直接进入支线关卡')
  assert.equal(state.campaign.investigators[0].xp, before - 2)
  assert.deepEqual(state.campaign.sideStoriesPlayed, [fixtureIds.side])
  assert.equal(Object.hasOwn(state.campaign.recordSchema, 'sideStoryRecord'), true)
  send(state, 'resign')
  assert.equal(state.campaign.records.sideStoryRecord, true, '支线记录写回主战役')
  assert.equal(state.uiState, 'scenarioResult')
  assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId),
    ['insertHostOpen', fixtureIds.sideScenario])
  // 存档 JSON 往返后仍保留合并的记录表与支线状态。
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(Object.hasOwn(restored.campaign.recordSchema, 'sideStoryRecord'), true)
  assert.deepEqual(restored.campaign.sideStoriesPlayed, [fixtureIds.side])
  send(state, 'hubContinue')
  assert.equal(state.uiState, 'interlude', '支线结算后回到同一关间')
  assert.equal(state.campaign.sideStoryReturn, undefined)
  // 已游玩支线不再出现；随后正常推进到原定下一章。
  assert.deepEqual(legalMoves(state).filter(row => row.action === 'hubStartSideStory'), [])
  send(state, 'hubDoneSeat')
  assert.equal(state.uiState, 'scenarioSetup')
  send(state, 'hubBeginScenario')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'insertHostClose')
})

test('经验不足时关间不出现插入支线选项', () => {
  const fixtureIds = registerFixture()
  const state = startHost(fixtureIds)
  state.campaign.investigators[0].xp = 0
  assert.deepEqual(legalMoves(state).filter(row => row.action === 'hubStartSideStory'), [])
})
