// 「重返卡尔克萨之路」· 战役层注册与流程验收。
//
// 覆盖：战役清单注册期契约（assertLaunchable / recordSchema / 卡包与遭遇组）、
// 八章解锁顺序、flow 节点从基础战役正确重映射到 returnToXxx id、以及从大厅
// 真实开局（campaignHub → 第一关）后章节可继续推进。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/returnToThePathToCarcosa/manifest.js'
import { campaignGraph } from '../src/campaign/campaign-flow.js'
import { createGameState, startScenario } from '../src/engine/engine.js'
import { settle } from './core-fixture.mjs'

const SCENARIO_IDS = [
  'returnToCurtainCall', 'returnToTheLastKing', 'returnToEchoesOfThePast',
  'returnToTheUnspeakableOath', 'returnToAPhantomOfTruth', 'returnToThePallidMask',
  'returnToBlackStarsRise', 'returnToDimCarcosa',
]

test('重返卡尔克萨之路战役清单通过注册期校验且可启动', () => {
  assert.doesNotThrow(() => contentRegistry.assertLaunchable(campaign.id))
  const registered = contentRegistry.getCampaign(campaign.id)
  assert.equal(registered.id, 'returnToThePathToCarcosa')
  assert.equal(registered.status, 'playable')
  assert.deepEqual(registered.scenarioIds, SCENARIO_IDS)
  for (const packId of ['core', 'carcosaCampaign', 'rtptcCampaign']) {
    assert.ok(registered.requiredPackIds.includes(packId), `缺少卡包 ${packId}`)
  }
  // 混乱袋与记录沿用基础战役：四档难度、pallidMaskBearer 转化、8 条幕间流程。
  assert.deepEqual(Object.keys(registered.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(registered.campaignWeaknessTransferRecord, 'pallidMaskBearer')
  assert.equal(registered.interludeHandlerId, 'carcosaInterlude')
})

test('八章 manifest 的 recordReads/recordWrites 都在战役 recordSchema 内', () => {
  const allowed = new Set(Object.keys(campaign.recordSchema))
  for (const scenarioId of SCENARIO_IDS) {
    const manifest = contentRegistry.getScenario(scenarioId)
    assert.equal(manifest.campaignId, campaign.id)
    for (const key of [...manifest.recordReads, ...manifest.recordWrites]) {
      assert.ok(allowed.has(key), `${scenarioId} 未声明的战役记录 ${key}`)
    }
    for (const groupId of manifest.requiredEncounterGroupIds) {
      assert.equal(typeof groupId, 'string')
      assert.ok(groupId.length > 0)
    }
  }
})

test('flow 节点从基础战役重映射到 returnToXxx 章节 id，并保留幕间与结局分支', () => {
  const graph = campaignGraph(campaign)
  assert.equal(graph.nodes.prologue.next, 'returnToCurtainCall')
  assert.equal(graph.nodes.returnToCurtainCall.scenarioId, 'returnToCurtainCall')
  assert.equal(graph.nodes.returnToCurtainCall.next, 'beforeLastKing')
  assert.equal(graph.nodes.beforeLastKing.next, 'returnToTheLastKing')
  assert.equal(graph.nodes.returnToTheLastKing.next, 'afterLastKing')
  // 最后的王者 r1 → 幕间一；其余 → 直接前往往事回声。
  const afterLastKing = graph.nodes.afterLastKing
  assert.equal(afterLastKing.type, 'branch')
  assert.deepEqual(afterLastKing.options.map(option => option.next).sort(),
    ['beforeEchoes', 'interludeOne'])
  // 幕间一的选择节点保留三选项。
  const interludeOne = graph.nodes.interludeOne
  assert.equal(interludeOne.type, 'choice')
  assert.deepEqual(interludeOne.options.map(option => option.id), ['intrude', 'flee', 'burn'])
  assert.ok(interludeOne.options.every(option => option.next === 'beforeEchoes'))
  // 幕间二的分支与卡城幽影结局。
  assert.equal(graph.nodes.interludeTwo.type, 'choice')
  assert.deepEqual(graph.nodes.interludeTwo.options.map(option => option.id), ['ignore', 'heed'])
  const afterDim = graph.nodes.afterDimCarcosa
  assert.equal(afterDim.type, 'branch')
  assert.deepEqual(afterDim.options.map(option => option.id).sort(), ['failure', 'success'])
  assert.equal(graph.nodes.end.type, 'end')
})

test('解锁顺序：每章仅在前一章完成后解锁', () => {
  assert.deepEqual(campaign.unlock.returnToCurtainCall, [])
  for (let index = 1; index < SCENARIO_IDS.length; index++) {
    assert.deepEqual(campaign.unlock[SCENARIO_IDS[index]], [SCENARIO_IDS[index - 1]])
  }
})

test('从战役大厅真实开局后，第一关可启动且可继续行动', () => {
  const state = createGameState({
    campaignId: campaign.id,
    playerInvestigator: '01001',
    seed: 'ret-carcosa-campaign-start',
    seatInvestigators: ['01001'],
  }, [{ seat: 0, role: 'human' }])
  settle(state)
  assert.equal(state.campaign.id, campaign.id)
  startScenario(state, 0, [])
  assert.equal(state.scenario.id, 'returnToCurtainCall')
  assert.equal(state.uiState, 'inScenario')
  assert.ok(state.legalMoves.length > 0)
  assert.equal(state.campaign.scenarioIndex, 0)
  // 战役记录默认值来自 recordSchema：八章共用同一套记录键。
  assert.equal(state.campaign.records.theStrangerIsOnToYou, false)
  assert.equal(state.campaign.records.chasingTheStranger, 0)
  assert.equal(state.campaign.records.doubt, 0)
  assert.equal(state.campaign.records.conviction, 0)
})
