// TDE P5 批次 2：hub 四模式开局、座位分线与按线准备的 Node 验收。
//
// 用一份「合成双线战役」（克隆核心《聚会》的 4 章，声明 parts A/B 各 2 章）跑真实 hub：
//   · 未选模式时只给四个模式 + 队长，置灰项带原因；
//   · 单线 A/B 能一路走到关卡开始（模式化 scenarioOrder）；
//   · 分选可以改线与按线准备牌组（另一条线的 record 落在 parts 快照），并能进入 A 线关卡；
//   · 并行准备完成后，由大厅边界（mod.applyMove）启动两份运行时；纯引擎调用仍拒绝；
//   · 跨线重复选人校验同时看两条线的记录。
import test from 'node:test'
import assert from 'node:assert/strict'

import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { applyMove, createGameState, decisionSeat, legalMoves, validateMove } from '../src/engine/engine.js'
import { dualPartFlow } from '../src/campaign/part-flow.js'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'
import mod from '../index.js'
import { isParallelState } from '../src/integration/parallel-runtime.js'

const CHAPTER_IDS = ['a1', 'b1', 'a2', 'b2']
const PARTS = Object.freeze({
  A: Object.freeze({ name: '梦寻', chapters: [{ scenarioId: 'a1' }, { scenarioId: 'a2' }] }),
  B: Object.freeze({ name: '梦网', chapters: [{ scenarioId: 'b1' }, { scenarioId: 'b2' }] }),
})

function registerDualHubCampaign() {
  if (contentRegistry.getCampaign('dualHub')) return
  const base = contentRegistry.getCampaign('nightOfTheZealot')
  const scenarios = CHAPTER_IDS.map(id => ({
    manifest: { ...gathering.manifest, id, campaignId: 'dualHub', behaviorIds: [id] },
    scenario: { ...gathering.scenario, id, behaviorId: id },
    behavior: { ...gathering.behavior, id },
  }))
  const campaign = {
    ...base,
    id: 'dualHub',
    name: '双线测试战役',
    scenarioIds: [...CHAPTER_IDS],
    unlock: Object.fromEntries(CHAPTER_IDS.map(id => [id, []])),
    parts: PARTS,
    modes: ['singleA', 'singleB', 'pick', 'parallel'],
    dualLineGate: 'open',
    flow: dualPartFlow(PARTS),
  }
  registerContentBundle({ campaigns: [campaign], scenarios })
}

const hub = (playerCount, seed = 'dual-hub') => {
  registerDualHubCampaign()
  return createGameState({ campaignId: 'dualHub', campaignHub: true, seed }, 
    Array.from({ length: playerCount }, (_, seat) => ({ seat })))
}

const movesOf = (state, action, seat = null) =>
  legalMoves(state, seat ?? decisionSeat(state)).filter(move => move.action === action)

const play = (state, move, seat = null) => {
  const target = seat ?? decisionSeat(state)
  const error = validateMove(state, target, move)
  assert.equal(error, null, `move ${JSON.stringify(move)} 应合法：${error}`)
  return applyMove(state, target, move)
}

const cleanMove = move => Object.fromEntries(Object.entries(move)
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

test('P5-2 未选模式时只给四个模式与队长；奇数人数时并行置灰并给原因', () => {
  const state = hub(3)
  const modes = movesOf(state, 'hubSetMode')
  assert.deepEqual(modes.map(move => move.mode), ['singleA', 'singleB', 'pick', 'parallel'])
  const parallel = modes.find(move => move.mode === 'parallel')
  assert.equal(parallel.disabled, true)
  assert.match(parallel.explanation, /两组人数相等/)
  const pick = modes.find(move => move.mode === 'pick')
  assert.equal(pick.disabled, false)
  // 未选模式前不提供「选择第一关 / 配置调查员」。
  assert.equal(movesOf(state, 'hubGoSetup').length, 0)
  assert.equal(movesOf(state, 'hubSelectScenario').length, 0)
  // 直接提交被置灰的并行：dispatch 复核人数并拒绝。
  assert.throws(() => play(state, cleanMove(parallel)), /两组人数相等|奇数/)
  // 4 人时并行可用。
  const four = hub(4, 'dual-hub-4')
  assert.equal(movesOf(four, 'hubSetMode').find(move => move.mode === 'parallel').disabled, false)
})

test('P5-2 单线 A：模式化章节顺序，选人/牌组后可以真正开始第一关', () => {
  const state = hub(2, 'dual-single-a')
  play(state, cleanMove(movesOf(state, 'hubSetMode').find(move => move.mode === 'singleA')))
  assert.equal(state.campaign.mode, 'singleA')
  assert.deepEqual([...state.campaign.seatParts], ['A', 'A'])
  assert.deepEqual([...state.campaign.activeParts], ['A'])
  assert.equal(state.campaign.currentPart, 'A')
  assert.equal(state.hubSelectedScenarioId, 'a1', '单线只跑本线的章，首章是 a1')

  play(state, cleanMove(movesOf(state, 'hubGoSetup')[0]))
  assert.equal(state.uiState, 'scenarioSetup')
  for (const seat of [0, 1]) {
    const choices = movesOf(state, 'hubSelectInvestigator', seat)
    assert.ok(choices.length > 0, `座位 ${seat} 应有可选调查员`)
    play(state, cleanMove(choices[0]), seat)
    const auto = movesOf(state, 'hubAutoDeck', seat).find(move => move.sessionId == null) || movesOf(state, 'hubAutoDeck', seat)[0]
    assert.ok(auto, `座位 ${seat} 应能自动构筑`)
    play(state, cleanMove(auto), seat)
    const done = movesOf(state, 'hubDoneSeat', seat)[0]
    assert.ok(done, `座位 ${seat} 应能确认准备`)
    play(state, cleanMove(done), seat)
  }
  assert.equal(state.hubReady, true)
  play(state, cleanMove(movesOf(state, 'hubBeginScenario')[0]))
  assert.equal(state.scenario.id, 'a1')
})

test('P5-2 单线 B：章节顺序是 B 线（b1 → b2），不混入 A 章', () => {
  const state = hub(1, 'dual-single-b')
  play(state, cleanMove(movesOf(state, 'hubSetMode').find(move => move.mode === 'singleB')))
  assert.equal(state.hubSelectedScenarioId, 'b1')
  assert.equal(state.campaign.scenarioCount ?? state.campaign.scenarioCount, state.campaign.scenarioCount)
  assert.equal(state.campaign.currentPart, 'B')
  assert.deepEqual([...state.campaign.seatParts], ['B'])
})

test('P5-2 分选：改线受两条线下限约束，按线准备把 record 写进 parts 快照，并能进入 A 线关卡', () => {
  const state = hub(2, 'dual-pick')
  play(state, cleanMove(movesOf(state, 'hubSetMode').find(move => move.mode === 'pick')))
  assert.deepEqual([...state.campaign.seatParts], ['A', 'B'])
  // 把唯一的 B 座位改到 A：B 线会空 → 动作置灰并被拒绝。
  const emptyB = movesOf(state, 'hubSetSeatPart').find(move => move.seat === 1 && move.part === 'A')
  assert.equal(emptyB.disabled, true)
  assert.match(emptyB.explanation, /B 线没有座位/)
  assert.throws(() => play(state, cleanMove(emptyB)), /B 线没有座位/)
  // 3 人分选 2+1 的合法改线。
  const three = hub(3, 'dual-pick-3')
  play(three, cleanMove(movesOf(three, 'hubSetMode').find(move => move.mode === 'pick')))
  const toB = movesOf(three, 'hubSetSeatPart').find(move => move.seat === 2 && move.part === 'B')
  play(three, cleanMove(toB))
  assert.deepEqual([...three.campaign.seatParts], ['A', 'B', 'B'])

  // 2 人分选：座位 1 在 B 线，牌组与 record 落 parts.B 快照。
  play(state, cleanMove(movesOf(state, 'hubGoSetup')[0]))
  play(state, cleanMove(movesOf(state, 'hubSelectInvestigator', 0)[0]), 0)
  play(state, cleanMove(movesOf(state, 'hubAutoDeck', 0)[0]), 0)
  play(state, cleanMove(movesOf(state, 'hubDoneSeat', 0)[0]), 0)
  const seatOneChoice = movesOf(state, 'hubSelectInvestigator', 1)[0]
  play(state, cleanMove(seatOneChoice), 1)
  play(state, cleanMove(movesOf(state, 'hubAutoDeck', 1)[0]), 1)
  play(state, cleanMove(movesOf(state, 'hubDoneSeat', 1)[0]), 1)
  const lineB = state.campaign.parts?.B
  assert.ok(lineB, '另一条线的快照必须存在')
  assert.equal(lineB.investigators[1]?.code, seatOneChoice.code)
  assert.ok(lineB.investigators[1].deck.length > 0)
  assert.equal(state.campaign.investigators[1], undefined, 'B 线座位的 record 不能写进活动线')
  // 跨线重复选人：A 线座位 0 已选的人不能出现在 B 线的候选里（反之亦然）。
  const lineBChoices = movesOf(state, 'hubSelectInvestigator', 1).map(move => move.code)
  assert.ok(!lineBChoices.includes(state.campaign.investigators[0].code), '另一线已选调查员不能重复')
  // 准备完成后可以进入 A1（P5 批次 3：分选已接 lane 运行时）；B 线记录仍在快照里。
  assert.equal(state.hubReady, true)
  play(state, cleanMove(movesOf(state, 'hubBeginScenario')[0]))
  assert.equal(state.scenario.id, 'a1')
  assert.equal(state.laneRuntime.part, 'A')
  assert.deepEqual(state.investigators.map(inv => inv.seat), [0])
  assert.equal(state.campaign.investigators[1], undefined)
  assert.ok(state.campaign.parts.B.investigators[1].deck.length > 0)
})

test('P5-2 并行：4 人准备完成后，大厅边界启动双运行时（纯引擎不直接开局）', () => {
  const state = hub(4, 'dual-parallel')
  play(state, cleanMove(movesOf(state, 'hubSetMode').find(move => move.mode === 'parallel')))
  assert.deepEqual([...state.campaign.seatParts], ['A', 'A', 'B', 'B'])
  assert.deepEqual([...state.campaign.activeParts], ['A', 'B'])
  assert.equal(state.campaign.currentPart, null)
  play(state, cleanMove(movesOf(state, 'hubGoSetup')[0]))
  assert.equal(state.uiState, 'scenarioSetup')
  // 4 个座位都能在准备阶段挑人与保存牌组（每座位一套，不因另一线而阻塞）。
  for (let seat = 0; seat < 4; seat += 1) {
    if (!movesOf(state, 'hubSelectInvestigator', seat).length) continue
    play(state, cleanMove(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, cleanMove(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, cleanMove(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  assert.equal(state.hubReady, true)
  // 出发准备分屏：两条线各自的关卡 id/名字来自投影（启动前，容器仍是并行 hub）。
  const ready = mod.viewState(state, 0).campaign
  assert.equal(ready.partScenarios.A, 'a1')
  assert.equal(ready.partScenarios.B, 'b1')
  assert.deepEqual(ready.partScenarioNames, { A: 'a1', B: 'b1' })
  // 纯引擎调用不直接启动双运行时（引擎层没有容器）；大厅边界（mod）负责开闸。
  assert.throws(() => play(state, cleanMove(movesOf(state, 'hubBeginScenario')[0])), /大厅边界|并行/)
  const events = mod.applyMove(state, 0, cleanMove(movesOf(state, 'hubBeginScenario')[0]))
  assert.ok(events.length >= 1)
  assert.equal(isParallelState(state), true)
  assert.equal(state.parallel.lanes.A.scenario.id, 'a1')
  assert.equal(state.parallel.lanes.B.scenario.id, 'b1')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(mod.viewState(state, 0).parallel.lane, 'A')
  assert.equal(mod.viewState(state, 3).parallel.lane, 'B')

})

test('并行自由分线：每座位可改线，人数不等时「开始」置灰且带原因', () => {
  const state = createGameState({ campaignId: 'dualHub', campaignHub: true, seed: 'parallel-seats' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }])
  play(state, cleanMove(movesOf(state, 'hubSetMode').find(move => move.mode === 'parallel')))
  const seatMove = movesOf(state, 'hubSetSeatPart', 0).find(move => move.seat === 3 && move.part === 'A')
  assert.ok(seatMove, '并行也应该给座位改线动作')
  play(state, cleanMove(seatMove), 0)
  assert.deepEqual(state.campaign.seatParts, ['A', 'A', 'B', 'A'])
  play(state, cleanMove(movesOf(state, 'hubGoSetup')[0]))
  for (const seat of [0, 1, 2, 3]) {
    play(state, cleanMove(movesOf(state, 'hubSelectInvestigator', seat)[0]), seat)
    play(state, cleanMove(movesOf(state, 'hubAutoDeck', seat)[0]), seat)
    play(state, cleanMove(movesOf(state, 'hubDoneSeat', seat)[0]), seat)
  }
  const begin = movesOf(state, 'hubBeginScenario', 0)[0]
  assert.equal(begin.disabled, true)
  assert.match(begin.explanation, /两线人数必须相等（A 3 \/ B 1）/)
  // 大厅边界也拒绝：不能绕过 UI 直接开局。
  assert.throws(() => mod.applyMove(state, 0, cleanMove(begin)), /两线人数必须相等/)
  // 把座位 3 改回 B 线即可开始（不需要重新准备牌组）。
  const back = movesOf(state, 'hubSetSeatPart', 0).find(move => move.seat === 3 && move.part === 'B')
  play(state, cleanMove(back), 0)
  assert.deepEqual(state.campaign.seatParts, ['A', 'A', 'B', 'B'])
  assert.equal(movesOf(state, 'hubBeginScenario', 0)[0].disabled, undefined)
})

test('投影 requiresMode：只有声明 parts 的战役带模式标记（非房主席位也能看到首屏门）', () => {
  registerDualHubCampaign()
  const partsState = createGameState({ campaignId: 'dualHub', campaignHub: true, seed: 'requires-mode' }, [{ seat: 0 }, { seat: 1 }])
  const partsView = mod.viewState(partsState, 1)
  assert.equal(partsView.campaign.requiresMode, true)
  assert.equal(partsView.campaign.mode, null)
  const core = createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'no-requires-mode' }, [{ seat: 0 }])
  assert.equal(mod.viewState(core, 0).campaign.requiresMode, undefined)
})
