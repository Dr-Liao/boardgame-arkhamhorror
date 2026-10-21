// 开局「游戏高级设置」：卡牌范围（全部 / 渐进式）与回档开关。
// 另外守住 AI 感知剧情已移入 AI 高级选项、默认开启。
import test from 'node:test'
import assert from 'node:assert/strict'

import arkham from '../index.js'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { createGameState, applyMove, corePlayerPool } from '../src/engine/engine.js'
import { captureReplayLog, replayLog, stateHash } from '../src/engine/replay.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_CYCLES, cardAllowedByScope, cardCycle, campaignCycle, normalizeCardPoolScope,
} from '../src/deck/card-pool.js'
import { checkpointView, forkSessionCheckpoint } from '../src/integration/hall-integration.js'

const HUMAN = [{ seat: 0, role: 'human' }]

function hubGame(settings = {}) {
  const state = createGameState({ campaignHub: true, campaignId: 'nightOfTheZealot', seed: 'game-settings', ...settings }, structuredClone(HUMAN))
  for (const move of [
    { action: 'hubSetDifficulty', difficulty: 'easy' },
    { action: 'hubSelectScenario', scenarioId: 'theGathering' },
    { action: 'hubGoSetup' },
  ]) applyMove(state, 0, move)
  return state
}

function choseRoland(state) {
  applyMove(state, 0, { action: 'hubSelectInvestigator', code: '01001' })
  return state
}

test('开局设置：AI 感知剧情在 AI 高级选项里且默认开启，游戏高级设置含卡牌范围与回档', () => {
  const spec = key => arkham.settingsSpec.find(item => item.key === key)
  assert.equal(spec('aiStoryAwareness').type, 'toggle')
  assert.equal(spec('aiStoryAwareness').default, 'on')
  assert.equal(spec('aiStoryAwareness').label, 'AI 感知剧情')
  assert.equal(spec('cardPoolScope').type, 'select')
  assert.deepEqual(spec('cardPoolScope').options.map(option => option.value), ['all', 'progressive'])
  assert.deepEqual(spec('cardPoolScope').options.map(option => option.label), ['全部', '渐进式'])
  assert.equal(spec('cardPoolScope').default, 'all')
  assert.equal(spec('allowRollback').type, 'toggle')
  assert.equal(spec('allowRollback').default, 'on')
  assert.equal(arkham.defaults.aiStoryAwareness, 'on')
  assert.equal(arkham.defaults.cardPoolScope, 'all')
  assert.equal(arkham.defaults.allowRollback, 'on')
})

test('每个可启动战役都登记了循环，渐进式按卡号循环过滤', () => {
  for (const campaign of campaignListForUi(contentRegistry)) {
    assert.ok(Number.isInteger(CAMPAIGN_CYCLES[campaign.id]), `战役缺少循环登记：${campaign.id}`)
  }
  assert.equal(campaignCycle('nightOfTheZealot'), 1)
  assert.equal(campaignCycle('theDunwichLegacy'), 2)
  assert.equal(campaignCycle('thePathToCarcosa'), 3)
  assert.equal(campaignCycle('theForgottenAge'), 4)
  assert.equal(campaignCycle('unknownCampaign'), null)
  assert.equal(cardCycle('01001'), 1)
  assert.equal(cardCycle('03009b'), 3)
  assert.equal(cardCycle('obscuringFog'), null)
  assert.equal(normalizeCardPoolScope('weird'), 'all')
  assert.equal(cardAllowedByScope('02016', 'all', 1), true)
  assert.equal(cardAllowedByScope('02016', 'progressive', 1), false)
  assert.equal(cardAllowedByScope('02016', 'progressive', 2), true)
  assert.equal(cardAllowedByScope('01038', 'progressive', 1), true)
  assert.equal(cardAllowedByScope('01038', 'progressive', null), true, '未知循环不限制')
})

test('默认局不写新状态字段，渐进式与禁止回档才落盘（旧存档与重放基线不受影响）', () => {
  const plain = hubGame()
  assert.equal('cardPoolScope' in plain, false)
  assert.equal('allowRollback' in plain, false)
  assert.equal(cardAllowedByScope('02016', plain.cardPoolScope, campaignCycle(plain.campaign.id)), true)

  const progressive = hubGame({ cardPoolScope: 'progressive', allowRollback: 'off' })
  assert.equal(progressive.cardPoolScope, 'progressive')
  assert.equal(progressive.allowRollback, false)
  assert.equal(normalizeCardPoolScope(progressive.cardPoolScope), 'progressive')
})

test('渐进式收窄可选调查员与自动牌组：核心战役只能拿核心包卡', () => {
  const state = hubGame({ cardPoolScope: 'progressive' })
  const choices = state.legalMoves.filter(move => move.action === 'hubSelectInvestigator').map(move => move.code)
  assert.ok(choices.length >= 5)
  assert.deepEqual(choices.slice().sort(), ['01001', '01002', '01003', '01004', '01005'])
  choseRoland(state)
  applyMove(state, 0, { action: 'hubAutoDeck' })
  const record = state.campaign.investigators[0]
  assert.ok(record.startingDeckReady)
  assert.deepEqual([...new Set(record.deck.map(code => code.slice(0, 2)))], ['01'])
})

test('渐进式的 AI 队友不会因职业人设选到当前循环外的调查员', () => {
  const state = createGameState({ campaignHub: true, campaignId: 'nightOfTheZealot', cardPoolScope: 'progressive', seed: 'scope-persona' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai', persona: '你是秘术，擅长法术与意志' }])
  assert.deepEqual(state.investigators.map(inv => inv.code.slice(0, 2)), ['01', '01'])
  assert.equal(state.investigators[1].klass, 'mystic')
})

test('渐进式拒绝超过当前循环的卡牌，全部模式照常接受', () => {
  const progressive = choseRoland(hubGame({ cardPoolScope: 'progressive' }))
  const coreDeck = buildDeck(INVESTIGATORS['01001'], { seat: 0, seed: 1, playerPool: corePlayerPool(progressive) }).playerCards
  assert.equal(coreDeck.length, 30)
  const outOfCycle = [...coreDeck.slice(0, -1), '02016']
  assert.throws(() => applyMove(progressive, 0, { action: 'hubSetDeck', codes: outOfCycle }), /playerPool/)
  // 同一位调查员的核心包清单仍然合法。
  applyMove(progressive, 0, { action: 'hubSetDeck', codes: coreDeck })
  assert.equal(progressive.campaign.investigators[0].startingDeckReady, true)

  const all = choseRoland(hubGame())
  applyMove(all, 0, { action: 'hubSetDeck', codes: outOfCycle })
  assert.equal(all.campaign.investigators[0].startingDeckReady, true)
})

test('重放日志记录卡牌范围与回档开关，重放指纹一致', () => {
  const state = hubGame({ cardPoolScope: 'progressive', allowRollback: 'off' })
  const log = captureReplayLog(state)
  assert.equal(log.settings.cardPoolScope, 'progressive')
  assert.equal(log.settings.allowRollback, false)
  assert.equal(stateHash(replayLog(log)), stateHash(state))
})

function sessionFor(state) {
  const checkpointId = 'scenario:nightOfTheZealot:theGathering:1'
  return {
    sessionId: 'bg-settings-test', modId: 'arkhamhorror', modName: '诡镇奇谈', render: {}, players: [], settings: {},
    state, events: [], notes: [], agentPlans: {},
    scenarioCheckpoints: [{
      checkpointId, campaignId: 'nightOfTheZealot', scenarioId: 'theGathering', scenarioName: '集结',
      visitId: 'theGathering:1', createdAt: '2026-10-21T00:00:00.000Z', sourceRevision: state.revision,
      snapshot: { state: structuredClone(state), events: [], notes: [], agentPlans: {} },
    }],
  }
}

test('关闭回档后检查点不可分支，服务端拒绝请求；默认仍可回档', () => {
  const allowed = sessionFor(hubGame())
  const leadSeat = allowed.state.campaign.leadSeat
  assert.equal(checkpointView(allowed, leadSeat)[0].rollbackAllowed, true)
  assert.equal(checkpointView(allowed, leadSeat)[0].canFork, true)
  const branch = forkSessionCheckpoint(allowed, allowed.scenarioCheckpoints[0].checkpointId,
    { sessionId: allowed.sessionId, revision: allowed.state.revision + 1, seat: leadSeat })
  assert.equal(branch.forkedFrom.checkpointId, allowed.scenarioCheckpoints[0].checkpointId)

  const disabled = sessionFor(hubGame({ allowRollback: 'off' }))
  const view = checkpointView(disabled, disabled.state.campaign.leadSeat)[0]
  assert.equal(view.rollbackAllowed, false)
  assert.equal(view.canFork, false)
  assert.throws(() => forkSessionCheckpoint(disabled, disabled.scenarioCheckpoints[0].checkpointId,
    { sessionId: disabled.sessionId, revision: disabled.state.revision + 1, seat: disabled.state.campaign.leadSeat }),
  error => error.code === 'ROLLBACK_DISABLED' && /关闭回档/.test(error.message))
})
