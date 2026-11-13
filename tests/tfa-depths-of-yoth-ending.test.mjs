// 幽嘶深渊 · 结局 1（坠入深渊）的深度结算回归。
//
// 2026-11-11 实战回归：结局 1 只能在「每位调查员都已撤退/被击败」后结算，旧实现却用
// active(state)（排除被击败者）遍历深度 1 的阵亡与深度 2/3 的创伤，真实路径下该集合必为空：
// 战役已判负、结算页却显示两名调查员「仍在役」，玩家看到「无法继续游戏，调查员还活着」。
// 2026-11-12 追加回归：从检查点重新开始后四属性变成 2/2/2/2（《天机之城》旧版换身还原把
// 2/2/2/2 写进了检查点的 continuation.base，开局重建不重算四属性）。
// 这里既验证行为钩子按「每位调查员」结算，也用真实引擎跑 finishScenario / 存档迁移全链路。
import test from 'node:test'
import assert from 'node:assert/strict'

import * as yoth from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/index.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { applyMove, createGameState, finishScenario, startScenario } from '../src/engine/engine.js'
import { migrateState, repairRuntimeCardModels } from '../src/engine/save-migration.js'
import { contentRegistry } from '../content/registered.js'

const clone = value => structuredClone(value)

function stateFor(count = 2, records = {}) {
  return {
    scenario: clone(yoth.scenario),
    acts: clone(yoth.scenario.acts),
    agendas: clone(yoth.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'cityOfTheSerpents',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    explorationDeck: [],
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [], trauma: { physical: 0, mental: 0 }, status: 'active' })),
      supplies: Object.fromEntries(Array.from({ length: count }, (_, seat) => [seat, []])),
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

const infoLog = (state) => {
  const calls = { info: [], trauma: [] }
  calls.api = {
    info: text => calls.info.push(text),
    random: () => 0,
    // 与 scenarioRuntime 的 api 口径一致：(seat, kind, amount)；
    // 累加创伤并把达到生命上限的调查员标成 killed（等价引擎 addTrauma + updateCampaignStatus）。
    addTrauma: (seat, kind, amount) => {
      const record = state.campaign.investigators[seat]
      record.trauma ||= { physical: 0, mental: 0 }
      record.trauma[kind] = (record.trauma[kind] || 0) + amount
      calls.trauma.push({ seat, kind, amount })
    },
  }
  return calls
}

function settleChoices(state) {
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  assert.ok(!state.pendingChoice, '开局待决选择未收敛')
}

function engineAtDepthsOfYoth(seed) {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theDepthsOfYoth'), [])
  settleChoices(state)
  assert.equal(state.scenario?.id, 'theDepthsOfYoth')
  return state
}

test('结局 1 深度 1：全队已被击败时，跃下深渊仍把每位调查员标为阵亡并结束战役', () => {
  const state = stateFor(2)
  const { api, info } = infoLog(state)
  state.scenarioFlags.depthLevel = 1
  // 真实路径：进入结局 1 时全队都已经 defeated，active(state) 为空。
  for (const inv of state.investigators) {
    inv.defeated = true
    inv.defeatCause = 'damage'
  }
  yoth.behavior.resolution(state, 'noResolution', [], api)
  assert.ok(state.investigators.every(inv => inv.defeated))
  for (const record of state.campaign.investigators) {
    assert.equal(record.status, 'killed', '全员阵亡必须写进战役记录，结算页不能仍显示「仍在役」')
  }
  assert.equal(state.campaign.failed, true, '深度 1 的坠落致命：战役失败')
  assert.ok(info.some(text => text.includes('战役失败')), `日志应说明战役失败：${info.join(' / ')}`)
})

test('结局 1 深度 2/3：全队已被击败时仍按卡面给每位调查员创伤（不能用 active 过滤）', () => {
  const depth2 = stateFor(2)
  const two = infoLog(depth2)
  depth2.scenarioFlags.depthLevel = 2
  for (const inv of depth2.investigators) inv.defeated = true
  yoth.behavior.resolution(depth2, 'r1', [], two.api)
  assert.deepEqual(two.trauma, [
    { seat: 0, kind: 'physical', amount: 2 },
    { seat: 1, kind: 'physical', amount: 2 },
  ], '深度 2：每位调查员承受 2 点肉体创伤')
  for (const record of depth2.campaign.investigators) {
    assert.equal(record.deck.length, 1, '深度 2：每位调查员各获得一张基础伤势弱点')
    assert.ok((ALL_CARDS[record.deck[0]]?.traits || []).includes('Injury'), `应为 [[伤势]] 弱点：${record.deck[0]}`)
  }
  assert.notEqual(depth2.campaign.failed, true, '创伤没有杀死所有人时战役继续')

  const depth3 = stateFor(2)
  const three = infoLog(depth3)
  depth3.scenarioFlags.depthLevel = 3
  for (const inv of depth3.investigators) inv.defeated = true
  yoth.behavior.resolution(depth3, 'r1', [], three.api)
  assert.deepEqual(three.trauma, [
    { seat: 0, kind: 'physical', amount: 1 },
    { seat: 1, kind: 'physical', amount: 1 },
  ], '深度 3：每位调查员受到 1 点肉体创伤')

  const depth4 = stateFor(1)
  const four = infoLog(depth4)
  depth4.scenarioFlags.depthLevel = 4
  depth4.investigators[0].defeated = true
  yoth.behavior.resolution(depth4, 'r1', [], four.api)
  assert.deepEqual(four.trauma, [], '深度 4：坠落不再造成创伤')
  assert.notEqual(depth4.campaign.failed, true)
})

test('结局 1 深度 2：若创伤导致所有调查员死亡，战役失败', () => {
  const state = stateFor(2)
  state.scenarioFlags.depthLevel = 2
  for (const inv of state.investigators) inv.defeated = true
  yoth.behavior.resolution(state, 'r1', [], {
    random: () => 0,
    info: () => {},
    addTrauma: (seat, kind, amount) => {
      const record = state.campaign.investigators[seat]
      record.trauma ||= { physical: 0, mental: 0 }
      record.trauma[kind] = (record.trauma[kind] || 0) + amount
      record.status = 'killed' // 模拟引擎 updateCampaignStatus：创伤达到生命上限即阵亡
    },
  })
  assert.equal(state.campaign.failed, true, '卡面：这一创伤导致所有调查员死亡时战役失败')
})

test('真实引擎：深度 1 结局 1 的结算记录与战役记录都写阵亡（不再显示仍在役）', () => {
  const state = engineAtDepthsOfYoth('yoth-ending-depth1')
  state.scenarioFlags.depthLevel = 1
  for (const inv of state.investigators) {
    inv.defeated = true
    inv.defeatCause = 'damage'
  }
  let ended = null
  try { finishScenario(state, 'noResolution', []) } catch (error) { ended = error }
  assert.equal(ended?.constructor?.name, 'ScenarioEnded', `结算应结束本关：${ended?.message}`)
  assert.equal(state.campaign.failed, true, '深度 1 的坠落致命：战役失败')
  assert.equal(ended.nextIndex, null, '战役失败时不再进入下一关')
  assert.ok(state.log.some(line => typeof line === 'string' && line.includes('深度等级 1') && line.includes('战役失败')),
    '游戏日志应说明深度 1 坠落致命且战役失败')
  for (const record of Object.values(state.campaign.investigators)) {
    assert.equal(record.status, 'killed', '战役记录必须标为阵亡')
  }
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.scenarioId, 'theDepthsOfYoth')
  assert.equal(result.resolution, 'noResolution')
  assert.equal(result.storyResolution, 'r1', '未达成结局按卡面读结局 1')
  for (const inv of result.investigators) {
    assert.equal(inv.status, 'killed', '结算页的调查员状态必须是阵亡')
  }
})

test('真实引擎：深度 2 结局 1 不再误判战役失败，队伍带创伤继续下一关', () => {
  const state = engineAtDepthsOfYoth('yoth-ending-depth2')
  state.scenarioFlags.depthLevel = 2
  for (const inv of state.investigators) {
    inv.defeated = true
    inv.defeatCause = 'damage'
  }
  let ended = null
  try { finishScenario(state, 'noResolution', []) } catch (error) { ended = error }
  assert.equal(ended?.constructor?.name, 'ScenarioEnded', `结算应结束本关：${ended?.message}`)
  assert.notEqual(state.campaign.failed, true, '深度 2 的创伤没有杀死全员时战役继续')
  assert.equal(ended.nextIndex, state.campaign.scenarioIndex + 1, '结束后进入下一章（幕间故事 V）')
  for (const record of Object.values(state.campaign.investigators)) {
    assert.notEqual(record.status, 'killed', '只有创伤达到生命上限的调查员才阵亡')
    // 1 点来自「被伤害击败」的败退创伤 + 深度 2 结局 1 的 2 点坠落创伤。
    assert.equal(record.trauma.physical, 3, '每位调查员都要吃到深度 2 的 2 点肉体创伤')
  }
  const result = state.campaign.scenarioResults.at(-1)
  for (const inv of result.investigators) assert.notEqual(inv.status, 'killed')
  assert.ok(state.log.some(line => typeof line === 'string' && line.includes('深度等级 2') && line.includes('肉体创伤')),
    '游戏日志应说明深度 2 的坠落创伤')
})

// ---------------------------------------------------------------------------
// 2026-11-12 实战回归：从「幽嘶深渊」检查点重新开始后，两名调查员的四属性变成 2/2/2/2。
// 根因是 v0.4.0 的《天机之城》换身还原污染了检查点的 continuation.base（开局事务基座）：
// 卡号/名字是本人、四属性却是伊斯人身体的 2/2/2/2 且没有换身标记。点击「开始行动」重放开局
// 事务时，prepareInvestigator 旧实现只重算生命/理智，不重建卡面四属性，于是全队变 2/2/2/2。
// 修复：①开局重建按战役记录里的调查员卡对齐卡面身份；②存档迁移在 runtime 与 continuation.base
// 上按同一口径修复旧存档。
// ---------------------------------------------------------------------------
const identityOf = (state, inv) => {
  const def = INVESTIGATORS[state.campaign.investigators[inv.seat].code]
  return [def.willpower, def.intellect, def.combat, def.agility]
}
const statsOf = inv => [inv.willpower, inv.intellect, inv.combat, inv.agility]
const polluteBodyStats = state => {
  for (const inv of state.investigators) Object.assign(inv, { willpower: 2, intellect: 2, combat: 2, agility: 2 })
}

test('真实引擎：从被 2/2/2/2 污染的续执行基座重放开局时，按战役记录恢复卡面属性', () => {
  const state = engineAtDepthsOfYoth('yoth-replay-identity')
  polluteBodyStats(state)
  // 检查点续执行的路径就是「以 continuation.base 为基座重放 hubBeginScenario」，
  // 即再次执行关卡开局重建；旧代码会把污染的 2/2/2/2 原样带进新场景。
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theDepthsOfYoth'), [])
  settleChoices(state)
  for (const inv of state.investigators) {
    assert.deepEqual(statsOf(inv), identityOf(state, inv), `座位 ${inv.seat} 应恢复成调查员卡印刷属性`)
  }
})

test('存档迁移：旧版换身还原残留的 2/2/2/2 按战役记录修复，runtime 与续执行基座都覆盖', () => {
  const state = engineAtDepthsOfYoth('yoth-identity-migration')
  polluteBodyStats(state)
  // 检查点的 continuation.base 是与 runtime 分开的另一份旧状态，必须一起修。
  state.continuation = {
    id: 'legacy-hub-begin', base: structuredClone(state), seat: 0,
    move: { action: 'hubBeginScenario' }, answers: [], emitted: 0,
  }
  const changes = []
  repairRuntimeCardModels(state, changes)
  repairRuntimeCardModels(state.continuation.base, changes)
  for (const inv of state.investigators) assert.deepEqual(statsOf(inv), identityOf(state, inv))
  for (const inv of state.continuation.base.investigators) {
    assert.deepEqual(statsOf(inv), identityOf(state.continuation.base, inv), '续执行基座也要修复')
  }
  assert.ok(changes.some(line => line.includes('重建调查员卡面属性')), `迁移应报告卡面属性修复：${changes.join('；')}`)
})

test('存档迁移：读档时自动修复 2/2/2/2 残留，且第二次迁移无变化（幂等）', () => {
  const state = engineAtDepthsOfYoth('yoth-identity-load')
  polluteBodyStats(state)
  const migrated = migrateState(JSON.parse(JSON.stringify(state)))
  assert.ok(migrated.changes.some(line => line.includes('重建调查员卡面属性')), migrated.changes.join('；'))
  for (const inv of migrated.state.investigators) {
    assert.deepEqual(statsOf(inv), identityOf(migrated.state, inv))
  }
  const again = migrateState(JSON.parse(JSON.stringify(migrated.state)))
  assert.deepEqual(again.changes, [], '修复后再次读档不应再产生迁移改动')
})
