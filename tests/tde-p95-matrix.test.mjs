// 《食梦者》P9.5 双线开闸：运行时矩阵与路线图 §11.2 十项门禁（真实 TDE 战役）。
//
// 口径：docs/tde-migration-roadmap.md §7.5.2 / §11.2（双线额外门禁 10 条）/ §13。
// 世界：tests/tde-p95-fixture.mjs 注册的真实 TDE 战役（8 章 + 真实 parts/flows/modes），
// 所有开局、行动、存档、投影都走真实引擎/mod 边界，不 mock 被验收模块。
//
// 门禁 → 用例名前缀（G1–G10 = 路线图 §11.2「双线额外门禁」第 1–10 条；账本
// tools/audit-tde-parallel.mjs → audit/tde-parallel-acceptance.json 按 `P9.5 G<n> ` 归集）：
//
//   G1  campaign.mode/seatParts/activeParts/currentPart/parts 只对 TDE 写入；D8-C 顶层
//       shared/lanes 容器只对 parallel 写入；非 TDE 建局前后零新增字段；13 局 baseline 留档。
//   G2  人数矩阵与开局阻塞：4 人 2+2、2 人 1+1、3 人并行入口置灰给原因、pick 3 人 2+1、
//       两线不均/0 人显式拒绝、缺牌组阻塞并给原因、先存牌组后改线仍可开局。
//   G4  双线 log/bag/XP/trauma/victory/story/abilityLimits 互不串线；两袋按
//       manifest.partChaosBags 不同；跨线写入只走 recordInPart/inPart/mutateBothBags。
//   G5  campaignView/viewState/viewEvents 同时按 part/lane 与 roomSeat 脱敏（含观战公开摘要、
//       另一线 move/结算/牌桌快照不可见；viewEvents 第三参 { lane }/{ state, seat } 按线过滤）。
//   G6  schema 迁移对非 TDE no-op、TDE 并行容器单文件 save→restore 往返一致且两线继续可行动；
//       旧 13 局 baseline 只 compare、不用新 --baseline 覆盖（留档断言在本文件）。
//   G7  roomSeat↔laneSeat 双向映射覆盖 currentSeat/pendingChoice.seat(s)/humanSeats/leadSeat/
//       调查员记录/事件/checkpoint；非连续房间座位 A,B,A,B 与 A,A,B,B；线内数组连续、人数按本线；
//       投影字段也换回 roomSeat。
//   G8  顶层 revision 每次任一线提交递增、目标 lane revision 独立递增；跨线全局过期可安全重基、
//       同线过期拒绝（STALE_REVISION）；投影携带 revision + parallel.laneRevision。
//   G9  两线交错提交不丢更新、状态替换/事件 seq/屏障/checkpoint/保存全局串行；批量确认按座位
//       原子提交；单文件存档同内容同字节、坏档明确失败。
//   G10 两线同时完成同一 pairId 时 pairSealed+幕间效果+interludeApplied 只提交一次，重放/读档幂等；
//       章对屏障：未封盘不能开下一章；封盘后两线自动进真实幕间 I（2–3 节点）并开下一章。
//   G3（16 种逐章对先手排列的轻量 flow/gate）由 P5 的 tests/tde-dual-flow.test.mjs 覆盖；
//   本文件按 task-5 分工只做运行时矩阵/门禁，章对屏障的运行时部分归 G10。
//
// 缺口约定：所有能力已接线时本文件应 0 skip；若后续再次出现未接线能力，用 `{ skip: '缺口…' }`
// 保留完整断言骨架并 send_message 报 Lead（沿用 P9.5 协作口径）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  loadTdeCampaignWorld,
  hubSetup,
  hubBegin,
  settlePendingChoices,
  settleParallelLaneChoices,
  legalFor,
  findMove,
  play,
  serializeContainer,
  restoreContainer,
  P95_INVESTIGATOR_CODES,
} from './tde-p95-fixture.mjs'

const world = await loadTdeCampaignWorld()
const { engine, mod } = world
const pr = world.parallelRuntime

// 世界注册完之后再动态 import：引擎/内容注册表在 import 时读注册结果。
const { contentRegistry } = await import('../content/registered.js')
const { campaignView } = await import('../src/campaign/campaign.js')
const { campaignGraph } = await import('../src/campaign/campaign-flow.js')
const { partManifest } = await import('../src/campaign/part-flow.js')
const {
  laneSeatOf, roomSeatOf, seatPartMap, recordInPart, partRecord, inPart,
  mutateBothBags, partChaosBag, setPart,
} = await import('../src/campaign/campaign-parts.js')
const { modeOptions, modePlan, assignSeatPart, laneBalance } = await import('../src/campaign/campaign-modes.js')
const { migrateState } = await import('../src/engine/save-migration.js')
const { STATE_SCHEMA_VERSION, RULES_VERSION } = await import('../src/engine/rules-state.js')
const {
  createDualRuntime, commitLane, commitBoth, markAwaitingPair, sealPairOnce,
  serializeDualRuntime, restoreDualRuntime,
} = await import('../src/campaign/dual-runtime.js')
const { createSessionCheckpoint, checkpointView } = await import('../src/integration/hall-integration.js')
const { manifest: tdeManifest } = await import('../content/campaigns/theDreamEaters/manifest.js')
const tdeChaos = await import('../content/campaigns/theDreamEaters/tde-chaos.js')

const CAMPAIGN = 'theDreamEaters'
const SCENARIO = Object.freeze({
  A1: 'beyondTheGatesOfSleep', B1: 'wakingNightmare',
  A2: 'theSearchForKadath', B2: 'aThousandShapesOfHorror',
  A3: 'darkSideOfTheMoon', B3: 'pointOfNoReturn',
  A4: 'whereTheGodsDwell', B4: 'weaverOfTheCosmos',
})
const CHAPTER_NAME = Object.freeze({
  A1: '梦境门外', B1: '清醒噩梦', A2: '寻觅卡达斯', B2: '万千骇形',
})
const REPORT_CAMPAIGNS = Object.freeze(['nightOfTheZealot', 'theCircleUndone'])

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------
const clone = value => structuredClone(value)
const clean = move => Object.fromEntries(Object.entries(move)
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
const tokensOf = bag => {
  const counts = {}
  for (const token of bag || []) counts[token] = (counts[token] || 0) + 1
  return counts
}
const applyHub = (state, move, seat = 0) => {
  assert.ok(move, '需要合法局外动作')
  assert.notEqual(move.disabled, true, `局外动作不应置灰：${move.explanation || ''}`)
  play(engine, state, move, seat)
  return state
}
const legalMovesFor = (state, seat) => mod.legalMoves(state, seat)

/** 并行开局（mod 边界），返回状态；已知 fixture 会自动结算两线开局待决选择。 */
function beginParallel(state) {
  const begin = legalMovesFor(state, 0).find(move => move.action === 'hubBeginScenario')
  assert.ok(begin, '开局准备完成后应有「开始当前关卡」')
  assert.notEqual(begin.disabled, true, `开始不应置灰：${begin.explanation || ''}`)
  mod.applyMove(state, 0, clean(begin))
  settleParallelLaneChoices(engine, mod, state)
  assert.equal(pr.isParallelState(state), true)
  return state
}

/** 并行原始开局（不结算 lane 待决选择），用于断言 pendingChoice/事件座位映射。 */
function launchParallelRaw(state) {
  const begin = legalMovesFor(state, 0).find(move => move.action === 'hubBeginScenario')
  assert.ok(begin)
  mod.applyMove(state, 0, clean(begin))
  assert.equal(pr.isParallelState(state), true)
  return state
}

/** 在并行容器上提交一个房间座位动作，并结算随之产生的窗口选择。 */
function actParallel(state, seat, move) {
  const events = mod.applyMove(state, seat, move) || []
  settleParallelLaneChoices(engine, mod, state)
  return events
}

/** 当前两条线各自的可行动座位（房间座位）。 */
function actingByLane(state) {
  const acting = mod.actingSeats(state)
  return {
    A: acting.find(seat => state.campaign.seatParts[seat] === 'A') ?? null,
    B: acting.find(seat => state.campaign.seatParts[seat] === 'B') ?? null,
  }
}

function pickInvestigator(state, seat) {
  const options = legalFor(engine, state, seat).filter(move => move.action === 'hubSelectInvestigator')
  if (!options.length) throw new Error(`座位 ${seat} 没有可选调查员`)
  return options.find(move => P95_INVESTIGATOR_CODES.includes(move.code)) || options[0]
}

/**
 * 自定义 hub 驾驶：先分线、再按座位选人/建组/确认；支持真人角色与「缺牌组」构造。
 * 与 fixture.hubSetup 的区别：可在选人/建组前改线（主动改线；先存牌组后改线由
 * dispatch 的 moveSeatRecordToPart 搬 record，见 G2 用例），以及指定玩家角色。
 */
function hubSetupAdvanced({
  seats = 4, mode = 'parallel', seed = 'tde-p95-matrix', roles = null,
  assignParts = null, skipDeck = [],
} = {}) {
  const players = Array.from({ length: seats }, (_, seat) => (roles ? { seat, role: roles[seat] } : { seat }))
  const state = engine.createGameState({ campaignId: CAMPAIGN, campaignHub: true, seed }, players)
  settlePendingChoices(engine, state)
  applyHub(state, legalFor(engine, state).find(move => move.action === 'hubSetMode' && move.mode === mode))
  applyHub(state, findMove(engine, state, 'hubGoSetup'))
  for (let seat = 0; seat < seats; seat += 1) {
    if (assignParts && state.campaign.seatParts[seat] !== assignParts[seat]) {
      const target = assignParts[seat]
      const change = legalFor(engine, state, seat)
        .find(move => move.action === 'hubSetSeatPart' && move.seat === seat && move.part === target)
      assert.ok(change, `座位 ${seat} 应能改线到 ${target}`)
      assert.notEqual(change.disabled, true, `改线不应置灰：${change.explanation || ''}`)
      play(engine, state, change, seat)
    }
    play(engine, state, pickInvestigator(state, seat), seat)
    if (!skipDeck.includes(seat)) {
      const deck = findMove(engine, state, 'hubAutoDeck', seat)
      assert.ok(deck, `座位 ${seat} 应有自动构筑`)
      play(engine, state, deck, seat)
    }
    const done = findMove(engine, state, 'hubDoneSeat', seat)
    if (done) play(engine, state, done, seat)
  }
  settlePendingChoices(engine, state)
  return state
}

/** 给两条线各自的当前关卡找一个「真实结算」状态：
 *  与 finishScenario 同口径写 campaign.pendingNode/pendingNextIndex；并行 lane 的结算后处理
 *  （dispatch.settleScenarioBoundary）不再 leaveLaneRuntime，座位/记录保持线内密集座位。
 *  用于章对屏障/幕间推进验收。 */
function simulateScenarioFinished(state, lane) {
  const laneState = state.parallel.lanes[lane]
  const manifest = partManifest({ ...tdeManifest, status: 'playable', dualLineGate: 'open' }, laneState.campaign.mode)
  const graph = campaignGraph(manifest)
  const current = graph.nodes[laneState.campaign.flow.nodeId]
  assert.equal(current?.type, 'scenario', `${lane} 线当前应在关卡节点（${laneState.campaign.flow.nodeId}）`)
  laneState.campaign.pendingNode = current.next
  laneState.campaign.pendingNextIndex = laneState.campaign.scenarioIndex + 1
  laneState.uiState = 'scenarioResult'
  laneState.phase = 'scenarioResult'
  laneState.campaign.phase = 'scenarioResult'
  laneState.currentSeat = 0
  laneState.hubReady = false
  return laneState.campaign.pendingNode
}

function sealPair(state, pairId = 1) {
  simulateScenarioFinished(state, 'A')
  simulateScenarioFinished(state, 'B')
  const first = pr.markLaneFinished(state, 'A', pairId)
  const second = pr.markLaneFinished(state, 'B', pairId)
  assert.equal(first.sealed, false)
  assert.equal(second.sealed, true)
  assert.ok(state.parallel.sealed[pairId])
  return state
}

/** 真实 TDE manifest 的「双线容器」——供 dual-runtime 协议层用真实 lane 数据。 */
function dualContainerFromLanes(state) {
  return createDualRuntime({
    shared: {
      mode: 'parallel',
      seatParts: [...state.campaign.seatParts],
      campaign: clone(state.campaign),
      pairProgress: {},
    },
    lanes: {
      A: clone(state.parallel.lanes.A),
      B: clone(state.parallel.lanes.B),
    },
  })
}

// ---------------------------------------------------------------------------
// G1（门禁 1）：campaign 双线字段只对 TDE 写入；顶层容器只对 parallel 写入
// ---------------------------------------------------------------------------
test('P9.5 G1 非 TDE 战役建局前后零新增双线字段', () => {
  for (const campaignId of REPORT_CAMPAIGNS) {
    assert.ok(contentRegistry.getCampaign(campaignId), `战役应已注册：${campaignId}`)
    const state = engine.createGameState({ campaignId, campaignHub: true, seed: `p95-${campaignId}` },
      [{ seat: 0 }, { seat: 1 }])
    settlePendingChoices(engine, state)
    const before = Object.keys(state.campaign).sort()
    assert.equal('mode' in state.campaign, false)
    assert.equal('seatParts' in state.campaign, false)
    assert.equal('activeParts' in state.campaign, false)
    assert.equal('currentPart' in state.campaign, false)
    assert.equal('parts' in state.campaign, false)
    // 走几个局外动作后仍不应新增双线字段（模式面板/分线控件都不能出现在非 TDE 战役）。
    const difficulty = legalMovesFor(state, 0).find(move => move.action === 'hubSetDifficulty')
    if (difficulty) play(engine, state, difficulty, 0)
    settlePendingChoices(engine, state)
    assert.deepEqual(Object.keys(state.campaign).sort(), before, `${campaignId} 不得新增 campaign 字段`)
    assert.equal(state.parallel, undefined)
    // 内容层：未声明 parts 的 manifest 经 partManifest 原样返回（不生成 mode flow）。
    const manifest = contentRegistry.getCampaign(campaignId)
    assert.equal(partManifest(manifest, 'parallel'), manifest)
  }
})

test('P9.5 G1 TDE 选定模式才写 campaign 双线字段；parallel 才写 state.parallel；13 局基线留档', () => {
  // 未选模式前：hub 只有四个模式动作，没有 seatParts 等字段。
  const hub = engine.createGameState({ campaignId: CAMPAIGN, campaignHub: true, seed: 'p95-gate1' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }])
  settlePendingChoices(engine, hub)
  assert.equal(hub.campaign.mode, undefined)
  assert.equal(hub.campaign.seatParts, undefined)
  assert.equal(hub.parallel, undefined)
  assert.deepEqual(modeOptions({ playerCount: 4, parts: tdeManifest.parts }).map(option => option.mode),
    ['singleA', 'singleB', 'pick', 'parallel'])

  // 单线 A：写 mode/seatParts/activeParts/currentPart/parts，但不写容器。
  const single = hubSetup(engine, { seats: 2, mode: 'singleA', seed: 'p95-single' })
  assert.equal(single.campaign.mode, 'singleA')
  assert.deepEqual(single.campaign.seatParts, ['A', 'A'])
  assert.deepEqual(single.campaign.activeParts, ['A'])
  assert.equal(single.campaign.currentPart, 'A')
  assert.ok(single.campaign.parts && typeof single.campaign.parts === 'object')
  assert.equal(single.parallel, undefined)
  hubBegin(engine, single)
  assert.equal(single.scenario.id, SCENARIO.A1)
  assert.equal(single.parallel, undefined, '单线不得写 D8-C 容器')

  // 并行：准备期不写容器；开闸后写 state.parallel（A/B 两套完整运行时）。
  const parallel = hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-container' })
  assert.equal(parallel.campaign.mode, 'parallel')
  assert.deepEqual(parallel.campaign.seatParts, ['A', 'A', 'B', 'B'])
  assert.deepEqual(parallel.campaign.activeParts, ['A', 'B'])
  assert.equal(parallel.campaign.currentPart, null)
  assert.equal(parallel.parallel, undefined, '未开闸前容器不出现')
  beginParallel(parallel)
  assert.ok(parallel.parallel?.lanes?.A && parallel.parallel?.lanes?.B)
  assert.equal(parallel.campaign.mode, 'parallel')
  assert.equal(parallel.parallel.lanes.A.parallel, undefined, 'lane 内部不再嵌套容器')

  // §11.2 门禁 1：旧 13 局 baseline 留档且 hashes 逐条在（行为零变化由 replay --compare 复算）。
  const baseline = JSON.parse(fs.readFileSync(new URL('../artifacts/migration/tde/replay-before.json', import.meta.url), 'utf8'))
  assert.equal(baseline.fixtures.length, 13, '旧 13 局 baseline 必须保留')
  for (const fixture of baseline.fixtures) {
    assert.ok(fixture.hashes?.length || fixture.hash, `fixture ${fixture.name || fixture.id} 缺少 hashes`)
  }
})

// ---------------------------------------------------------------------------
// G2（门禁 2）：人数矩阵、入口置灰、缺牌组阻塞
// ---------------------------------------------------------------------------
test('P9.5 G2 4 人 2+2 并行真实开局：A1/B1 同时在场且两线各自可行动', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-2x2' }))
  const { A, B } = state.parallel.lanes
  assert.equal(A.scenario.id, SCENARIO.A1)
  assert.equal(B.scenario.id, SCENARIO.B1)
  assert.match(A.scenario.name, /梦境门外/)
  assert.match(B.scenario.name, /清醒噩梦/)
  assert.equal(A.uiState, 'inScenario')
  assert.equal(B.uiState, 'inScenario')
  assert.equal(A.round, 1)
  assert.equal(B.round, 1)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.status, 'playing')
  // 两条线各有自己的决策座位，且同一时刻都能行动（并发推理、串行提交）。
  const decisions = pr.parallelDecisionSeats(state)
  assert.equal(decisions.length, 2)
  assert.equal(state.campaign.seatParts[decisions[0]], 'A')
  assert.equal(state.campaign.seatParts[decisions[1]], 'B')
  assert.ok([0, 1].includes(decisions[0]), `A 线决策座位应在房间座位 0/1：${decisions[0]}`)
  assert.ok([2, 3].includes(decisions[1]), `B 线决策座位应在房间座位 2/3：${decisions[1]}`)
  const acting = actingByLane(state)
  assert.equal(state.campaign.seatParts[acting.A], 'A')
  assert.equal(state.campaign.seatParts[acting.B], 'B')
  assert.ok(legalMovesFor(state, 0).some(move => move.action === 'resource'))
  assert.ok(legalMovesFor(state, 2).some(move => move.action === 'resource'))
  // 每条线只有本线两个座位，且线内座位连续。
  assert.deepEqual(A.laneRuntime.roomSeats, [0, 1])
  assert.deepEqual(B.laneRuntime.roomSeats, [2, 3])
  assert.deepEqual(A.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(B.investigators.map(inv => inv.seat), [0, 1])
  assert.equal(A.numInvestigators, 2)
  assert.equal(B.numInvestigators, 2)
  assert.equal(state.numInvestigators, 4, '容器保留房间座位总数')
})

test('P9.5 G2 并行开局第一处待决选择：B1 介绍 1 与 A1 梦境选择在真人视图里都有按钮', () => {
  // 用户存档 bg-1-mvy4j5xb 的复现：并行开局的 setup 在 resolveTransaction 里暂停后漏算
  // `legalMoves` 缓存，B 线第一处选择正好问真人（没有 AI 先提交动作刷新缓存），
  // 观察投影只给提示不给选项 → 清醒噩梦关不了、地图也出不来。
  const state = launchParallelRaw(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-2x2-intro' }))
  const decisions = pr.parallelDecisionSeats(state)
  for (const lane of ['A', 'B']) {
    const laneState = state.parallel.lanes[lane]
    const roomSeat = decisions.find(seat => state.campaign.seatParts[seat] === lane)
    assert.ok(roomSeat != null, `${lane} 线应有决策座位`)
    assert.ok(laneState.pendingChoice, `${lane} 线开局应停在第一处待决选择`)
    const view = mod.viewState(state, roomSeat)
    assert.equal(view.pendingChoice.id, laneState.pendingChoice.id)
    assert.deepEqual(view.legalMoves.map(move => move.optionId),
      laneState.pendingChoice.options.map(option => option.id),
      `${lane} 线真人视图必须列出待决选项`)
  }
  // 清醒噩梦的介绍 1 正是用户截图里没有按钮的那一个。
  const laneB = state.parallel.lanes.B
  const roomSeatB = decisions.find(seat => state.campaign.seatParts[seat] === 'B')
  assert.match(laneB.pendingChoice.prompt, /马赫斯瓦兰/)
  assert.deepEqual(laneB.pendingChoice.options.map(option => option.id), ['bringDoctor', 'leaveDoctor'])
  assert.deepEqual(mod.viewState(state, roomSeatB).legalMoves.map(move => move.optionId), ['bringDoctor', 'leaveDoctor'])
})

test('P9.5 G2 2 人 1+1 并行真实开局', () => {
  const state = beginParallel(hubSetup(engine, { seats: 2, mode: 'parallel', seed: 'p95-1x1', preferredInvestigators: ['06004', '06005'] }))
  assert.deepEqual(state.campaign.seatParts, ['A', 'B'])
  assert.deepEqual(state.parallel.lanes.A.laneRuntime.roomSeats, [0])
  assert.deepEqual(state.parallel.lanes.B.laneRuntime.roomSeats, [1])
  assert.equal(state.parallel.lanes.A.scenario.id, SCENARIO.A1)
  assert.equal(state.parallel.lanes.B.scenario.id, SCENARIO.B1)
  assert.equal(state.parallel.lanes.A.numInvestigators, 1)
  assert.equal(state.parallel.lanes.B.numInvestigators, 1)
  assert.equal(state.parallel.lanes.A.campaign.leadSeat, 0)
  assert.equal(state.parallel.lanes.B.campaign.leadSeat, 0, '房间座位 1 → 线内座位 0')
  const decisions = pr.parallelDecisionSeats(state)
  assert.deepEqual(decisions, [0, 1])
  // 两条线各一套牌组（真实 hub 准备流程写入）。
  for (const lane of ['A', 'B']) {
    const record = state.parallel.lanes[lane].campaign.investigators[0]
    assert.ok(record?.deck?.length > 0, `${lane} 线应有合法牌组`)
  }
})

test('P9.5 G2 3 人并行入口置灰并给「两组人数相等」原因', () => {
  const state = engine.createGameState({ campaignId: CAMPAIGN, campaignHub: true, seed: 'p95-3p' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }])
  settlePendingChoices(engine, state)
  const parallelMove = legalMovesFor(state, 0).find(move => move.action === 'hubSetMode' && move.mode === 'parallel')
  assert.ok(parallelMove)
  assert.equal(parallelMove.disabled, true)
  assert.match(parallelMove.explanation, /两组人数相等|奇数/)
  const option = modeOptions({ playerCount: 3, parts: tdeManifest.parts }).find(item => item.mode === 'parallel')
  assert.equal(option.enabled, false)
  assert.match(option.reason, /两组人数相等|奇数/)
  // 纯策略层：3 人并行计划不可用。
  assert.equal(modePlan({ mode: 'parallel', playerCount: 3 }).ok, false)
  assert.equal(state.campaign.mode, undefined, '置灰动作不能被落库')
})

test('P9.5 G2 pick 3 人 2+1 可开局；waiting 座位不能行动也拿不到本线私密视图', () => {
  const state = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'p95-pick21', assignParts: ['A', 'B', 'A'] })
  assert.deepEqual(state.campaign.seatParts, ['A', 'B', 'A'])
  assert.deepEqual(state.campaign.activeParts, ['A'])
  assert.equal(state.campaign.currentPart, 'A')
  hubBegin(engine, state)
  assert.equal(state.scenario.id, SCENARIO.A1)
  assert.equal(state.uiState, 'inScenario')
  // A 线 2 人在场，座位映射 0、2 → 线内 0、1。
  assert.deepEqual(state.laneRuntime.roomSeats, [0, 2])
  assert.deepEqual(state.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(Object.keys(state.campaign.investigators), ['0', '1'])
  assert.equal(mod.decisionSeat(state), 0)
  // waiting 座位（房间座位 1，B 线）：没有合法动作、提交被拒绝。
  assert.equal(mod.actingSeats(state).includes(1), false)
  assert.deepEqual(mod.legalMoves(state, 1), [])
  assert.throws(() => mod.applyMove(state, 1, { action: 'resource' }), /另一条线|不是你的行动时机/)
  // waiting 座位看到的是公开视图（与无座位观战同一投影）：没有手牌/牌库/legalMoves。
  const waitingView = mod.viewState(state, 1)
  const publicView = mod.viewState(state, null)
  assert.deepEqual(waitingView, publicView, 'waiting 座位只能拿到公开投影')
  assert.equal(waitingView.parallel, undefined, '分选 waiting 座位不是并行容器视图')
  assert.equal(waitingView.legalMoves.length, 0)
  assert.ok(waitingView.investigators.every(inv => (inv.hand || []).length === 0))
  assert.ok(waitingView.investigators.every(inv => (inv.deck || []).length === 0))
  assert.ok(waitingView.locations.every(location => location.name !== 'B 线未公开'), '未公开内容不投影')
  // 本线自己的座位视图保留自己的手牌。
  const ownView = mod.viewState(state, 0)
  assert.ok(ownView.investigators.some(inv => (inv.hand || []).length > 0))
  // B 线快照只存在于 parts，不进入活动线记录。
  assert.ok(state.campaign.parts?.B, '非活动线记录写进 parts.B 快照')
  assert.equal(JSON.stringify(state.campaign.records || {}).includes('清醒噩梦'), false)
})

test('P9.5 G2 分选两线不均/某线 0 人显式拒绝；并行 3:1 开始置灰并给人数原因', () => {
  // 纯策略：0 人线 = 分选非法；改线会把另一线清空时拒绝并给原因。
  assert.equal(modePlan({ mode: 'pick', playerCount: 2, seatParts: ['A', 'A'] }).ok, false)
  assert.match(modePlan({ mode: 'pick', playerCount: 2, seatParts: ['A', 'A'] }).reason, /两线各至少 1/)
  const rejected = assignSeatPart({ mode: 'pick', seatParts: ['A', 'B'], seat: 1, part: 'A' })
  assert.equal(rejected.ok, false)
  assert.match(rejected.reason, /B 线没有座位|两线/)

  // 真实 hub：2 人分选，座位 2 改到 A 会把 B 线清空 → 改线动作置灰。
  const pick = engine.createGameState({ campaignId: CAMPAIGN, campaignHub: true, seed: 'p95-pick-uneven' },
    [{ seat: 0 }, { seat: 1 }])
  settlePendingChoices(engine, pick)
  applyHub(pick, legalFor(engine, pick).find(move => move.action === 'hubSetMode' && move.mode === 'pick'))
  applyHub(pick, findMove(engine, pick, 'hubGoSetup'))
  assert.deepEqual(pick.campaign.seatParts, ['A', 'B'])
  // 座位 1（AI，准备期间出牌顺序：房主 completed 后由 AI 自己操作）检查改线动作。
  play(engine, pick, pickInvestigator(pick, 0), 0)
  play(engine, pick, findMove(engine, pick, 'hubAutoDeck', 0), 0)
  play(engine, pick, findMove(engine, pick, 'hubDoneSeat', 0), 0)
  const change = legalFor(engine, pick, 1).find(move => move.action === 'hubSetSeatPart' && move.seat === 1 && move.part === 'A')
  assert.ok(change, '座位 1 应有改线动作')
  assert.equal(change.disabled, true)
  assert.match(change.explanation, /没有座位|两线/)
  // 被置灰的改线不能落库（若强行提交也必须在 dispatch 层被拒）。
  assert.throws(() => play(engine, pick, change, 1), /没有座位|两线|不可执行/)
  assert.deepEqual(pick.campaign.seatParts, ['A', 'B'])

  // 并行 3:1：开始按钮置灰并显示「两线人数必须相等（A 3 / B 1）」；大厅边界同样拒绝。
  const parallel = hubSetupAdvanced({ seats: 4, assignParts: ['A', 'A', 'A', 'B'], seed: 'p95-par-31' })
  assert.equal(laneBalance(parallel.campaign.seatParts).balanced, false)
  const begin = legalMovesFor(parallel, 0).find(move => move.action === 'hubBeginScenario')
  assert.ok(begin)
  assert.equal(begin.disabled, true)
  assert.match(begin.explanation, /两线人数必须相等（A 3 \/ B 1）/)
  assert.throws(() => mod.applyMove(parallel, 0, clean(begin)), /两线人数必须相等|相等/)
  assert.equal(parallel.parallel, undefined, '不平衡不得启动双线')
})

test('P9.5 G2 缺牌组时开局返回明确阻塞原因，不静默待机', () => {
  const state = hubSetupAdvanced({ seats: 4, skipDeck: [3], seed: 'p95-nodeck' })
  assert.notEqual(state.hubReady, true, '缺牌组的准备不得判定为就绪')
  assert.equal(state.campaign.seatParts.length, 4)
  // 准备未完成：hub 不提供可用的「开始当前关卡」。
  const begin = legalMovesFor(state, 0).find(move => move.action === 'hubBeginScenario')
  assert.equal(begin, undefined, '缺牌组时不能出现可点的开始动作')
  // 直接走大厅边界也必须给出可读原因，而不是静默待机。
  assert.throws(() => mod.applyMove(state, 0, { action: 'hubBeginScenario' }),
    /还没有合法牌组|不能启动并行双线/)
  assert.equal(state.parallel, undefined)
})

test('P9.5 G2 先存牌组、后改线仍可开局（record/牌组随座位搬线）', () => {
  // fixture.hubSetup 的 assignParts 在选人/建组之后改线：dispatch 应把该座位的 campaign record
  // （含已保存牌组）从旧线搬到新线，否则 launchParallelLanes 会报「座位 N 还没有合法牌组」。
  const state = hubSetup(engine, {
    seats: 4, mode: 'parallel', seed: 'p95-move-after-deck', assignParts: ['A', 'B', 'A', 'B'],
  })
  assert.deepEqual(state.campaign.seatParts, ['A', 'B', 'A', 'B'])
  // 每个座位的牌组都落在它最终所属线的记录里。
  for (let seat = 0; seat < 4; seat += 1) {
    const part = state.campaign.seatParts[seat]
    const snapshot = state.campaign.parts?.[part]?.investigators?.[seat]
    const top = state.campaign.investigators?.[seat]
    const record = snapshot ?? (state.campaign.currentPart === part ? top : null)
    assert.ok(record?.deck?.length > 0, `座位 ${seat}（${part} 线）的牌组应随改线落到本线记录`)
  }
  const launched = beginParallel(state)
  assert.equal(launched.parallel.lanes.A.scenario.id, SCENARIO.A1)
  assert.equal(launched.parallel.lanes.B.scenario.id, SCENARIO.B1)
  assert.deepEqual(launched.parallel.lanes.A.laneRuntime.roomSeats, [0, 2])
  assert.deepEqual(launched.parallel.lanes.B.laneRuntime.roomSeats, [1, 3])
})

// ---------------------------------------------------------------------------
// G4（门禁 4）：双线数据（记录/袋/XP/创伤/胜利/故事）互不串线
// ---------------------------------------------------------------------------
test('P9.5 G4 双线混乱袋按 manifest.partChaosBags 初始化且内容不同', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-bags' }))
  const { A, B } = state.parallel.lanes
  const expectedA = [...tdeChaos.baseBagFor('A', A.difficulty)]
  const expectedB = [...tdeChaos.baseBagFor('B', B.difficulty)]
  // A 袋：无 skull / elderthing；固定 cultist + 2 tablet。
  const bagA = tokensOf(A.chaosBag)
  const bagB = tokensOf(B.chaosBag)
  assert.equal(A.chaosBag.length, expectedA.length)
  assert.equal(B.chaosBag.length, expectedB.length)
  assert.equal(bagA.skull, undefined, 'A 线袋不含 skull')
  assert.equal(bagA.elderthing, undefined, 'A 线袋不含 elderthing')
  assert.equal(bagA.tablet, 2)
  assert.equal(bagA.cultist, 1)
  assert.equal(bagB.tablet, undefined, 'B 线袋不含 tablet')
  assert.equal(bagB.skull, 2)
  assert.equal(bagB.elderthing, 2)
  assert.equal(bagB.cultist, 1)
  // 与 manifest.partChaosBags（真实内容）逐枚一致，且不是 manifest.chaosBags 的 A 袋兜底。
  assert.deepEqual(bagA, tokensOf(expectedA))
  assert.deepEqual(bagB, tokensOf(expectedB))
  assert.notDeepEqual(A.chaosBag, B.chaosBag)
  assert.notDeepEqual([...B.chaosBag], [...expectedA], 'B 线不得回落到 A 袋')
  assert.deepEqual(A.chaosBag, expectedA, 'A 线袋逐枚来自 manifest.partChaosBags.A')
  // 两条线各自的袋互相独立。
  A.chaosBag.push('bless')
  assert.equal(B.chaosBag.includes('bless'), false)
  A.chaosBag.pop()
})

test('P9.5 G4 双线 records/XP/trauma/victory/storySections/bag 互不串线', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-isolation' }))
  const { A, B } = state.parallel.lanes
  const before = {
    B: {
      records: clone(B.campaign.records), xp: B.campaign.xp, trauma: clone(B.campaign.trauma),
      victory: B.campaign.victory, storySections: clone(B.campaign.storySections), bag: [...B.chaosBag],
    },
  }
  // 通过真实作用域 API 在 A 线写记录（A 是 lane 的活动线）。
  recordInPart(A.campaign, 'A', 'dreamQuestMarker', true)
  A.campaign.xp += 7
  A.campaign.victory += 3
  A.campaign.trauma[0] = { physical: 1, mental: 2 }
  A.campaign.storySections.dreamQuestIntro = { text: 'A 线私密剧情' }
  tdeChaos.addChaosToken(A, 'bless', 1, { permanent: true })
  // B 线逐字段不变。
  assert.deepEqual(B.campaign.records, before.B.records)
  assert.equal(B.campaign.xp, before.B.xp)
  assert.deepEqual(B.campaign.trauma, before.B.trauma)
  assert.equal(B.campaign.victory, before.B.victory)
  assert.deepEqual(B.campaign.storySections, before.B.storySections)
  assert.deepEqual(B.chaosBag, before.B.bag)
  assert.equal(partRecord(A.campaign, 'A', 'dreamQuestMarker'), true)
  assert.equal(partRecord(B.campaign, 'B', 'dreamQuestMarker'), undefined)
  // 容器不聚合任何一线数据。
  assert.equal(Boolean(state.campaign.records?.dreamQuestMarker), false)
  assert.equal(JSON.stringify(state.campaign).includes('A 线私密剧情'), false)
  // 反向：B 线写自己的记录，A 线不变。
  const aRecords = clone(A.campaign.records)
  recordInPart(B.campaign, 'B', 'webOfDreamsMarker', true)
  assert.equal(partRecord(B.campaign, 'B', 'webOfDreamsMarker'), true)
  assert.deepEqual(A.campaign.records, aRecords)
  // 两条线的运行时不是同一对象（卡表/记录不共享）。
  assert.notEqual(A.campaign.records, B.campaign.records)
  assert.notEqual(A.campaign, B.campaign)
  assert.notEqual(A.investigators, B.investigators)
})

test('P9.5 G4 跨线写入只走 recordInPart/inPart/mutateBothBags（A 写 B；B 写 A）', () => {
  // 真实 TDE hub（分选 3 人 2+1）的 parts 快照：活动线 A，另一线 B。
  const state = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'p95-crossline', assignParts: ['A', 'B', 'A'] })
  assert.deepEqual(state.campaign.seatParts, ['A', 'B', 'A'])
  assert.equal(state.campaign.currentPart, 'A')
  const activeRecords = clone(state.campaign.records)
  // A 线写 B 线记录：只落 parts.B 快照，活动线 A 不变。
  recordInPart(state.campaign, 'B', 'crossLineNote', true)
  assert.equal(state.campaign.parts.B.records.crossLineNote, true)
  assert.deepEqual(state.campaign.records, activeRecords)
  assert.equal(partRecord(state.campaign, 'B', 'crossLineNote'), true)
  // inPart 切到 B 作用域：回调里写的是 B 快照，返回后 A 线数据原样还原。
  const scope = inPart(state, 'B', inner => {
    assert.deepEqual(inner.campaign.records, state.campaign.parts.B.records)
    inner.campaign.records.secondNote = 2
    return inner.campaign.parts?.B ? 'scoped' : 'scoped'
  })
  assert.equal(scope, 'scoped')
  assert.equal(state.campaign.parts.B.records.secondNote, 2)
  assert.deepEqual(state.campaign.records, activeRecords)
  // 反向：把活动线切到 B（真实 setPart）后写 A 线快照（B 线是当前线，A 写进 parts.A）。
  const bState = clone(state)
  setPart(bState, 'B')
  assert.equal(bState.campaign.currentPart, 'B')
  const bCurrentRecords = clone(bState.campaign.records)
  recordInPart(bState.campaign, 'A', 'fromBLine', true)
  assert.equal(bState.campaign.parts.A.records.fromBLine, true)
  assert.deepEqual(bState.campaign.records, bCurrentRecords, 'B 线写 A 线记录不动当前线')
  assert.equal(partRecord(bState.campaign, 'A', 'fromBLine'), true)
  // 两袋同时改：当前线（A）写顶层，另一线（B）写 parts.B.chaosBag，state.chaosBag 跟当前线同步。
  const bagBeforeA = [...partChaosBag(state, 'A')]
  const bagBeforeB = [...partChaosBag(state, 'B')]
  assert.equal(bagBeforeA.length, 0)
  assert.equal(bagBeforeB.length, 0)
  const next = mutateBothBags(state, (bag, part) => {
    bag.push(part === 'A' ? 'skull' : 'tablet')
    return bag
  })
  assert.deepEqual(next.A, ['skull'])
  assert.deepEqual(next.B, ['tablet'])
  assert.deepEqual(partChaosBag(state, 'A'), ['skull'])
  assert.deepEqual(partChaosBag(state, 'B'), ['tablet'])
  assert.deepEqual(state.chaosBag, ['skull'])
  // 反向（B 为活动线）也对称。
  const flipped = { campaign: { currentPart: 'B', chaosBag: ['elderthing'], parts: { A: { ...clone(state.campaign.parts.A), chaosBag: ['cultist'] } } }, chaosBag: ['elderthing'] }
  mutateBothBags(flipped, bag => [...bag, 'bless'])
  assert.deepEqual(flipped.campaign.chaosBag, ['elderthing', 'bless'])
  assert.deepEqual(flipped.campaign.parts.A.chaosBag, ['cultist', 'bless'])
})

// ---------------------------------------------------------------------------
// G5（门禁 5）：投影脱敏（viewState / campaignView / viewEvents / 观战）
// ---------------------------------------------------------------------------
test('P9.5 G5 viewState 按 lane+roomSeat 脱敏：A 座位看不到 B 线手牌/未公开剧情', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-privacy' }))
  // 在另一条线制造只有 B 线知道的记录/故事/手牌。
  state.parallel.lanes.B.campaign.records.secretBRecord = true
  state.parallel.lanes.B.campaign.storySections.secretBStory = { text: 'B 线未公开剧情 SECRET_B_STORY' }
  const viewA = mod.viewState(state, 0)
  const viewB = mod.viewState(state, 3)
  assert.equal(viewA.parallel.lane, 'A')
  assert.equal(viewB.parallel.lane, 'B')
  assert.equal(viewA.scenario.id, SCENARIO.A1)
  assert.equal(viewB.scenario.id, SCENARIO.B1)
  // 本线调查员集合：A 座位只看到 A 线两张；B 座位只看到 B 线两张。
  const aNames = new Set(state.parallel.lanes.A.investigators.map(inv => inv.name))
  const bNames = new Set(state.parallel.lanes.B.investigators.map(inv => inv.name))
  assert.deepEqual(new Set(viewA.investigators.map(inv => inv.name)), aNames)
  assert.deepEqual(new Set(viewB.investigators.map(inv => inv.name)), bNames)
  // 手牌：只有观察者自己的手牌可见。
  assert.ok(viewA.investigators.filter(inv => inv.hand.length > 0).length <= 1)
  assert.ok(viewA.investigators.filter(inv => inv.hand.length > 0).every(inv => inv.seat === 0))
  // A 座位视图不包含 B 线的记录/剧情/卡组内容（parallel.other 只允许公开摘要字段）。
  // P10：真实 TDE 内容已注册为 playable，`cards`/`investigatorDefs` 是分发给所有座位的公共静态
  // 展示表（卡面数据，不是某条线的私有状态），现在会正常包含 B 线卡面；隐私断言只看线状态，先剔除静态表。
  const viewAOnly = {
    ...viewA, cards: undefined, investigatorDefs: undefined, cardsPatch: undefined,
    parallel: { ...viewA.parallel, other: undefined },
  }
  const viewAText = JSON.stringify(viewAOnly)
  assert.equal(viewAText.includes('SECRET_B_STORY'), false)
  assert.equal(viewAText.includes('secretBRecord'), false)
  assert.equal(viewAText.includes(SCENARIO.B1), false, 'A 线路由里不应出现 B 线关卡内容')
  assert.equal(viewAText.includes(CHAPTER_NAME.B1), false)
  // 另一线只给公开摘要：关卡/阶段/回合/座位/等待，不含手牌/牌库/记录。
  assert.deepEqual(viewA.parallel.other.seats, [2, 3])
  assert.equal(viewA.parallel.other.lane, 'B')
  assert.equal('investigators' in viewA.parallel.other, false)
  assert.equal('records' in viewA.parallel.other, false)
  // B 座位视图同样看不到 A 线的记录。
  state.parallel.lanes.A.campaign.records.secretARecord = true
  const viewB2 = mod.viewState(state, 2)
  assert.equal(JSON.stringify({ ...viewB2, parallel: { ...viewB2.parallel, other: undefined } }).includes('secretARecord'), false)
  // AI 描述只读本线：B 座位的描述不能出现 A 线关卡。
  const describeB = mod.describeState(state, 2)
  assert.equal(describeB.includes(SCENARIO.A1), false)
  assert.equal(describeB.includes(CHAPTER_NAME.A1), false)
  // 并行容器不再把另一线塞进活动线记录。
  assert.equal(state.parallel.lanes.A.campaign.seatParts[0], 'A')
})

test('P9.5 G5 campaignView 按 part 与观察者脱敏；非 TDE 投影零变化', () => {
  const state = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'p95-campaign-view', assignParts: ['A', 'B', 'A'] })
  // parts.B 快照里有另一线调查员（含牌组）与未到达剧情；A 是活动线，数据在顶层。
  const bRecord = state.campaign.parts.B.investigators[1]
  assert.ok(bRecord?.deck?.length > 0)
  state.campaign.parts.B.storySections = { secretBranch: { text: '未到达分支' } }
  state.campaign.parts.B.storySections.secondBranch = { text: '另一个未到达分支' }
  const observerA = campaignView(state.campaign, 0)
  assert.equal(observerA.partsRedacted, true)
  const summaryB = observerA.parts.B.investigators.find(record => record.seat === 1)
  assert.ok(summaryB, '另一线调查员以公开摘要出现')
  assert.equal(summaryB.deck, undefined, '另一线牌组内容不投影')
  assert.equal(summaryB.purchases, undefined)
  assert.equal(summaryB.deckSize, bRecord.deck.length, '只给张数')
  assert.equal('storySections' in observerA.parts.B, false, '剧情正文不投影')
  assert.equal(observerA.parts.B.storySectionCount, 2)
  assert.equal(JSON.stringify(observerA).includes('未到达分支'), false)
  // 观察者自己的牌组（活动线 A 的顶层记录）保留。
  const ownA = observerA.investigators[0]
  assert.ok(Array.isArray(ownA.deck) && ownA.deck.length > 0)
  // B 线座位看 B 快照：自己的牌组保留，但 A 线顶层别人的牌组被删。
  const observerB = campaignView(state.campaign, 1)
  const ownB = observerB.parts.B.investigators.find(record => record.seat === 1)
  assert.ok(Array.isArray(ownB.deck) && ownB.deck.length > 0)
  assert.equal(observerB.investigators[0].deck, undefined)
  // 非 TDE：campaignView 不写 partsRedacted，也不丢牌组（零变化）。
  const core = engine.createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'p95-cv-core' }, [{ seat: 0 }])
  settlePendingChoices(engine, core)
  const coreView = campaignView(core.campaign, 0)
  assert.equal('partsRedacted' in coreView, false)
  assert.equal(coreView.parts, undefined)
  assert.deepEqual(Object.keys(coreView).sort(), Object.keys(core.campaign).sort())
  const coreRecord = Object.values(core.campaign.investigators || {})[0]
  if (coreRecord) assert.deepEqual(coreView.investigators[coreRecord.seat].deck, coreRecord.deck)
})

test('P9.5 G5 观战视图只有公开摘要：无手牌/牌库/待决选择/合法动作', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-spectator' }))
  const spectator = mod.viewState(state, null)
  assert.equal(spectator.parallel.public, true)
  assert.equal(spectator.parallel.lanes.length, 2)
  assert.equal(spectator.parallel.lanes[0].seats.length, 2)
  assert.deepEqual(spectator.parallel.lanes.map(lane => lane.lane), ['A', 'B'])
  assert.ok(spectator.investigators.every(inv => (inv.hand || []).length === 0), '观战不见任何手牌')
  assert.ok(spectator.investigators.every(inv => (inv.deck || []).length === 0), '观战不见牌库内容')
  assert.ok(spectator.investigators.every(inv => (inv.beneath || []).length === 0))
  assert.equal(spectator.legalMoves.length, 0)
  assert.equal(spectator.pendingChoice, null)
  assert.equal(spectator.encounterDeck.length, 0)
  assert.equal(typeof spectator.encounterDeckSize, 'number', '只给张数')
  // 观战只投影 A 线公开牌桌 + 两线摘要；B 线私密剧情/记录不出现。
  state.parallel.lanes.B.campaign.storySections.secretSpectatorStory = { text: 'SECRET_SPECTATOR' }
  const again = mod.viewState(state, null)
  assert.equal(JSON.stringify({ ...again, parallel: { ...again.parallel, lanes: undefined } }).includes('SECRET_SPECTATOR'), false)
})

test('P9.5 G5 viewEvents 按 roomSeat 脱敏私密事件与演出快照手牌', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-events' }))
  const acting = actingByLane(state)
  const events = actParallel(state, acting.A, { action: 'resource' })
  assert.ok(events.length > 0)
  // 演出快照：座位换回房间座位；viewEvents 按观察者清空别人的手牌。
  const tables = events.flatMap(event => [event.tableState, event.presentation?.tableState].filter(Boolean))
  assert.ok(tables.length > 0, '动作事件应带演出快照')
  for (const table of tables) {
    assert.ok(table.investigators.every(inv => [0, 1].includes(inv.seat)), 'A 线演出快照座位应是房间座位 0/1')
    assert.equal([0, 1].includes(table.currentSeat), true)
  }
  // 合成一条私密事件（真实 API 的数据层）：privateSeat=2 只有房间座位 2 可见。
  const privateEvent = { seq: 1, type: 'info', privateSeat: 2, text: 'B 线私密信息' }
  const publicEvent = { seq: 2, type: 'info', text: '公开信息' }
  const seenBy0 = mod.viewEvents([privateEvent, publicEvent], 0)
  const seenBy2 = mod.viewEvents([privateEvent, publicEvent], 2)
  assert.equal(seenBy0.length, 1)
  assert.equal(seenBy0[0].seq, 2)
  assert.equal(seenBy2.length, 2)
  // 挑选指令对非观察者只留 action 摘要（不泄露选了哪张牌）。
  const chooseEvent = { seq: 3, type: 'move', seat: 2, move: { action: 'choose', optionId: '1' } }
  assert.deepEqual(mod.viewEvents([chooseEvent], 0)[0].move, { action: 'choose' })
})

// 缺口：事件 lane 标记（见文件末尾）。

// ---------------------------------------------------------------------------
// G6（门禁 6）：存档迁移与并行容器 save→restore
// ---------------------------------------------------------------------------
test('P9.5 G6 并行容器 save→restore 往返一致，两线继续可行动', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-save' }))
  const acting = actingByLane(state)
  actParallel(state, acting.A, { action: 'resource' })
  const acting2 = actingByLane(state)
  if (acting2.B != null) actParallel(state, acting2.B, { action: 'resource' })
  const beforeRevision = state.revision
  const saved = serializeContainer(world, state)
  assert.ok(saved.length > 1_000_000, '容器单文件含两份运行时（约 2–6MB）')
  // 同内容 → 同字节；恢复后再次序列化逐字节一致。
  assert.equal(serializeContainer(world, state), saved)
  const restored = restoreContainer(world, saved)
  assert.equal(serializeContainer(world, restored), saved)
  assert.equal(restored.revision, beforeRevision)
  assert.equal(restored.parallel.lanes.A.scenario.id, SCENARIO.A1)
  assert.equal(restored.parallel.lanes.B.scenario.id, SCENARIO.B1)
  assert.deepEqual(restored.parallel.lanes.A.laneRuntime.roomSeats, [0, 1])
  assert.deepEqual(restored.parallel.lanes.B.laneRuntime.roomSeats, [2, 3])
  // 恢复后两条线都还能继续行动（不是只读快照）。
  const restoredActing = actingByLane(restored)
  for (const [laneName, seat] of [['A', restoredActing.A], ['B', restoredActing.B]]) {
    assert.ok(seat != null, `${laneName} 线恢复后应有可行动座位`)
    const laneBefore = restored.parallel.lanes[laneName].investigators
      .find(inv => inv.seat === restored.parallel.lanes[laneName].laneRuntime.roomSeats.indexOf(seat)).resources
    actParallel(restored, seat, { action: 'resource' })
    const laneAfter = restored.parallel.lanes[laneName].investigators
      .find(inv => inv.seat === restored.parallel.lanes[laneName].laneRuntime.roomSeats.indexOf(seat)).resources
    assert.equal(laneAfter, laneBefore + 1, `${laneName} 线恢复后可继续行动`)
  }
  // 坏档明确失败，不静默修补。
  assert.throws(() => restoreContainer(world, '{"campaign":{}}'), /不是并行双运行时状态/)
  const missingLane = JSON.parse(saved)
  delete missingLane.parallel.lanes.B
  assert.throws(() => restoreContainer(world, JSON.stringify(missingLane)), /不是并行双运行时状态|缺少 B 线/)
})

test('P9.5 G6 非 TDE save-migration 原样返回；TDE 并行当前版本原样返回、旧线可迁移', () => {
  // 非 TDE：版本已当前 → 同对象 + no changes（迁移对非 TDE no-op）。
  const core = engine.createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'p95-migrate-core' }, [{ seat: 0 }])
  settlePendingChoices(engine, core)
  const coreSame = migrateState(core)
  assert.equal(coreSame.state, core)
  assert.deepEqual(coreSame.changes, [])

  // TDE 并行容器版本已当前 → 原对象。
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-migrate' }))
  const same = migrateState(state)
  assert.equal(same.state, state)
  assert.deepEqual(same.changes, [])

  // 旧 TDE 存档（结构 6 / 规则 n5.5）→ 两条线分别迁移；容器 revision 不被改写。
  const old = clone(state)
  const oldRevision = old.revision
  old.parallel.lanes.A.schemaVersion = 6
  old.parallel.lanes.A.rulesVersion = 'n5.5'
  old.parallel.lanes.A.investigators[0].phaseStatBonus = { skill: 'combat', amount: 1 }
  const { state: migrated, changes } = migrateState(old)
  assert.equal(migrated.parallel.lanes.A.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(migrated.parallel.lanes.A.rulesVersion, RULES_VERSION)
  assert.equal(migrated.parallel.lanes.B.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(migrated.parallel.lanes.B.rulesVersion, RULES_VERSION)
  assert.equal(migrated.revision, oldRevision, '迁移不得改写全局提交版本')
  assert.ok(changes.some(change => change.startsWith('A 线')), changes.join(' | '))
  assert.ok(migrated.parallel.lanes.A.effects.some(effect => String(effect.id).includes('migrated-phase')))
  assert.equal(old.parallel.lanes.A.schemaVersion, 6, '迁移不修改入参')
  // 迁移后的容器仍可序列化/恢复。
  assert.equal(serializeContainer(world, restoreContainer(world, serializeContainer(world, migrated))),
    serializeContainer(world, migrated))
})

// ---------------------------------------------------------------------------
// G7（门禁 7）：roomSeat↔laneSeat 双向映射
// ---------------------------------------------------------------------------
test('P9.5 G7 标准 2+2（A,A,B,B）映射：座位/待决选择/记录/事件/checkpoint', () => {
  const state = hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-seatmap' })
  // 启动前把双线队长选到「非第一个」房间座位，验证 leadSeat 映射。
  const leaderA = legalMovesFor(state, 0).find(move => move.action === 'hubSetPartLeader' && move.part === 'A' && move.leadSeat === 1)
  const leaderB = legalMovesFor(state, 0).find(move => move.action === 'hubSetPartLeader' && move.part === 'B' && move.leadSeat === 3)
  assert.ok(leaderA && leaderB)
  play(engine, state, leaderA, 0)
  play(engine, state, leaderB, 0)
  launchParallelRaw(state)
  // 待决选择（raw launch 后两条线各挂 story 选择）：seat 已换回房间座位。
  const pending = mod.pendingChoice(state)
  assert.ok(pending, '并行开局后应有 lane 待决选择')
  assert.equal(pending.lane, 'A')
  assert.equal(pending.seat, state.parallel.lanes.A.laneRuntime.roomSeats[pending.seat ?? 0] ?? 0)
  assert.equal(state.pendingChoice, null, '容器本身不挂 pendingChoice')
  // 若 A 线没有待决选择，则返回 B 线的房间座位。
  const onlyB = clone(state)
  onlyB.parallel.lanes.A.pendingChoice = null
  const pendingB = mod.pendingChoice(onlyB)
  if (pendingB) {
    assert.equal(pendingB.lane, 'B')
    assert.ok([2, 3].includes(pendingB.seat), `B 线待决选择座位应换成房间座位：${pendingB.seat}`)
  }
  settleParallelLaneChoices(engine, mod, state)
  // 记录：线内键连续 0/1，保留 roomSeat 运行期字段；队长映射到线内座位。
  for (const lane of ['A', 'B']) {
    const laneState = state.parallel.lanes[lane]
    const records = laneState.campaign.investigators
    assert.deepEqual(Object.keys(records), ['0', '1'], `${lane} 线记录键必须连续 0/1`)
    for (const [key, record] of Object.entries(records)) {
      assert.equal(record.seat, Number(key))
      assert.equal(record.roomSeat, laneState.laneRuntime.roomSeats[Number(key)])
    }
    assert.equal(laneState.campaign.leadSeat, 1, `${lane} 线队长房间座位 2/4 → 线内座位 1`)
    assert.equal(laneState.numInvestigators, 2)
    assert.equal(state.investigators.length, 4, '容器保留房间座位运行时')
  }
  // 事件：动作后演出快照的座位已换成房间座位；viewEvents 按观察者清空别人手牌。
  const acting = actingByLane(state)
  const events = actParallel(state, acting.A, { action: 'resource' })
  const tables = events.flatMap(event => [event.tableState, event.presentation?.tableState].filter(Boolean))
  for (const table of tables) {
    assert.ok(table.investigators.every(inv => [0, 1].includes(inv.seat)))
  }
  assert.ok(mod.actingSeats(state).length >= 2)
  assert.ok(mod.actingSeats(state).every(seat => state.campaign.seatParts[seat] === 'A'
    || state.campaign.seatParts[seat] === 'B'))
  assert.ok(pr.parallelDecisionSeats(state).every(seat => [0, 1, 2, 3].includes(seat)))
  // checkpoint：一个章对同时覆盖两条线的运行时。
  const session = { state, events: [], scenarioCheckpoints: [], modId: 'arkhamhorror', settings: {} }
  const checkpoint = createSessionCheckpoint(session, { move: { action: 'hubBeginScenario' }, after: state })
  assert.ok(checkpoint)
  assert.equal(checkpoint.scenarioId, `${SCENARIO.A1}|${SCENARIO.B1}`)
  assert.match(checkpoint.scenarioName, /梦境门外.*清醒噩梦/)
  assert.deepEqual(checkpoint.snapshot.state.parallel.lanes.A.laneRuntime.roomSeats, [0, 1])
  session.scenarioCheckpoints = [checkpoint]
  assert.equal(checkpointView(session, state.campaign.partLeads.A)[0].canFork, true)
  assert.equal(checkpointView(session, state.campaign.partLeads.B)[0].canFork, true)
  assert.equal(checkpointView(session, 9)[0].canFork, false)
})

test('P9.5 G7 非连续房间座位（A,B,A,B）+ pick 2+1 映射正确、线内数组连续、人数只按本线', () => {
  // 全真人 + 交替座位：房间 0/2 → A 线，房间 1/3 → B 线。
  const state = hubSetupAdvanced({
    seats: 4, assignParts: ['A', 'B', 'A', 'B'], roles: ['human', 'human', 'human', 'human'], seed: 'p95-seatmap-alt',
  })
  assert.deepEqual(state.campaign.seatParts, ['A', 'B', 'A', 'B'])
  assert.deepEqual(state.humanSeats, [0, 1, 2, 3])
  // 两条线队长分别选房间座位 2 / 3（→ 线内座位 1）。
  const leaderA = legalMovesFor(state, 0).find(move => move.action === 'hubSetPartLeader' && move.part === 'A' && move.leadSeat === 2)
  const leaderB = legalMovesFor(state, 0).find(move => move.action === 'hubSetPartLeader' && move.part === 'B' && move.leadSeat === 3)
  assert.ok(leaderA && leaderB)
  play(engine, state, leaderA, 0)
  play(engine, state, leaderB, 0)
  launchParallelRaw(state)
  const { A, B } = state.parallel.lanes
  assert.deepEqual(A.laneRuntime.roomSeats, [0, 2])
  assert.deepEqual(B.laneRuntime.roomSeats, [1, 3])
  assert.deepEqual(A.humanSeats, [0, 1], 'A 线 humanSeats 是线内座位（房间 0/2）')
  assert.deepEqual(B.humanSeats, [0, 1], 'B 线 humanSeats 是线内座位（房间 1/3）')
  assert.equal(A.campaign.leadSeat, 1, 'A 线队长房间座位 2 → 线内 1')
  assert.equal(B.campaign.leadSeat, 1, 'B 线队长房间座位 3 → 线内 1')
  assert.deepEqual(A.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(B.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(A.campaign.investigators && Object.keys(A.campaign.investigators), ['0', '1'])
  assert.equal(A.campaign.investigators[0].roomSeat, 0)
  assert.equal(A.campaign.investigators[1].roomSeat, 2)
  assert.equal(B.campaign.investigators[0].roomSeat, 1)
  assert.equal(B.campaign.investigators[1].roomSeat, 3)
  assert.equal(A.numInvestigators, 2)
  assert.equal(B.numInvestigators, 2)
  // 座位映射纯函数：双向转换与密度。
  const map = seatPartMap(['A', 'B', 'A', 'B'])
  assert.deepEqual(map.roomSeatsOfLane.A, [0, 2])
  assert.deepEqual(map.roomSeatsOfLane.B, [1, 3])
  for (const roomSeat of [0, 1, 2, 3]) {
    const lane = map.laneOfRoomSeat(roomSeat)
    const laneSeat = laneSeatOf(['A', 'B', 'A', 'B'], roomSeat)
    assert.equal(roomSeatOf(['A', 'B', 'A', 'B'], lane, laneSeat), roomSeat)
    assert.equal(map.laneSeatOfRoom[roomSeat], laneSeat)
  }
  assert.throws(() => laneSeatOf(['A', 'B'], 2), /房间座位越界/)
  assert.equal(roomSeatOf(['A', 'B'], 'A', 1), null, '越界线内座位返回 null，不静默截断')
  // pendingChoice：A 线待决选择换成房间座位 0/2。
  const pending = mod.pendingChoice(state)
  if (pending) {
    assert.equal(pending.lane, 'A')
    assert.ok([0, 2].includes(pending.seat), `A 线待决选择应换成房间座位：${pending.seat}`)
  }
  settleParallelLaneChoices(engine, mod, state)
  // 用房间座位提交，动作路由到本线对应线内座位；B 线不受影响。
  const acting = actingByLane(state)
  assert.ok([0, 2].includes(acting.A), `A 线行动座位应是房间座位：${acting.A}`)
  assert.ok([1, 3].includes(acting.B), `B 线行动座位应是房间座位：${acting.B}`)
  const bBefore = B.investigators.map(inv => inv.resources)
  const targetRoom = acting.A
  const laneSeat = A.laneRuntime.roomSeats.indexOf(targetRoom)
  const resBefore = A.investigators[laneSeat].resources
  actParallel(state, targetRoom, { action: 'resource' })
  assert.equal(A.investigators[laneSeat].resources, resBefore + 1, 'A 线座位按房间座位路由')
  assert.deepEqual(B.investigators.map(inv => inv.resources), bBefore, 'A 线行动不能改到 B 线')
  // 反向：B 线座位（房间 1/3）提交路由到 B 线线内座位，A 线不受影响。
  const aBefore = A.investigators.map(inv => inv.resources)
  const actingAfter = actingByLane(state)
  const bLaneSeat = B.laneRuntime.roomSeats.indexOf(actingAfter.B)
  const bResBefore = B.investigators[bLaneSeat].resources
  actParallel(state, actingAfter.B, { action: 'resource' })
  assert.equal(B.investigators[bLaneSeat].resources, bResBefore + 1)
  assert.deepEqual(A.investigators.map(inv => inv.resources), aBefore)
  // pick 2+1（房间 0/2 在 A）：线内数组同样连续。
  const pick = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'p95-pick-map', assignParts: ['A', 'B', 'A'] })
  hubBegin(engine, pick)
  assert.deepEqual(pick.laneRuntime.roomSeats, [0, 2])
  assert.deepEqual(pick.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(Object.keys(pick.campaign.investigators), ['0', '1'])
  assert.equal(mod.decisionSeat(pick), 0)
  assert.equal(pick.numInvestigators, 2, '运行时人数按本线缩放（不是整桌 3）')
  // 原房间座位 2 的座位在 pick 里映射为线内座位 1：mod 边界返回的合法动作与引擎线内座位一致。
  assert.deepEqual(mod.legalMoves(pick, 2), engine.legalMoves(pick, 1).map(move => move))
  assert.deepEqual(mod.legalMoves(pick, 1), [], 'waiting 座位无动作')
})

// 缺口：视图投影里 investigators/currentSeat/pendingChoice 仍是线内座位（见文件末尾）。

// ---------------------------------------------------------------------------
// G8（门禁 8）：顶层 revision 与 lane revision 双版本
// ---------------------------------------------------------------------------
test('P9.5 G8 顶层 revision 每次成功提交递增；目标 lane 独立递增；投影携带双版本', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-revision' }))
  const acting = actingByLane(state)
  const before = {
    container: state.revision,
    A: state.parallel.lanes.A.revision,
    B: state.parallel.lanes.B.revision,
  }
  // 一次 A 线提交：容器 +1、A 线 +1、B 线不变。
  mod.applyMove(state, acting.A, { action: 'resource' })
  assert.equal(state.revision, before.container + 1)
  assert.equal(state.parallel.lanes.A.revision, before.A + 1)
  assert.equal(state.parallel.lanes.B.revision, before.B)
  settleParallelLaneChoices(engine, mod, state)
  const afterA = { container: state.revision, A: state.parallel.lanes.A.revision, B: state.parallel.lanes.B.revision }
  // 一次 B 线提交：容器 +1、B 线 +1、A 线不变。
  mod.applyMove(state, acting.B, { action: 'resource' })
  assert.equal(state.revision, afterA.container + 1)
  assert.equal(state.parallel.lanes.B.revision, afterA.B + 1)
  assert.equal(state.parallel.lanes.A.revision, afterA.A)
  settleParallelLaneChoices(engine, mod, state)
  // 投影同时携带全局 revision 与 laneRevision；两者与权威状态一致。
  const viewA = mod.viewState(state, acting.A)
  assert.equal(viewA.revision, state.revision)
  assert.equal(viewA.parallel.laneRevision, state.parallel.lanes.A.revision)
  const viewB = mod.viewState(state, acting.B)
  assert.equal(viewB.revision, state.revision)
  assert.equal(viewB.parallel.laneRevision, state.parallel.lanes.B.revision)
  assert.notEqual(viewA.parallel.laneRevision, viewB.parallel.laneRevision)
  // 全局 revision 单调递增（交错提交）。
  let last = state.revision
  for (const [seat, action] of [[acting.A, 'resource'], [acting.B, 'resource'], [acting.A, 'resource']]) {
    if (seat == null) continue
    mod.applyMove(state, seat, { action })
    assert.ok(state.revision > last, '任一线提交都应推进顶层 revision')
    last = state.revision
    settleParallelLaneChoices(engine, mod, state)
    last = state.revision
  }
})

test('P9.5 G8 同线过期拒绝且无半成品；跨线全局过期可安全重基', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-stale' }))
  const acting = actingByLane(state)
  const laneA = state.parallel.lanes.A
  const roomSeat = acting.A
  const laneSeat = laneA.laneRuntime.roomSeats.indexOf(roomSeat)
  const resourcesBefore = A0 => A0.investigators[laneSeat].resources
  const resBefore = resourcesBefore(laneA)
  const containerBefore = state.revision
  const laneRevBefore = laneA.revision
  // 同线旧版本：laneRevision 已过期 → 拒绝，且状态/版本都不变。
  assert.throws(() => mod.applyMove(state, roomSeat, { action: 'resource', laneRevision: laneRevBefore - 1 }),
    /STALE_REVISION/)
  assert.equal(resourcesBefore(state.parallel.lanes.A), resBefore)
  assert.equal(state.revision, containerBefore)
  assert.equal(state.parallel.lanes.A.revision, laneRevBefore)
  // 全局版本过期但目标线版本未变：允许安全重基（大厅已校验容器版本）。
  const laneRevBBefore = state.parallel.lanes.B.revision
  mod.applyMove(state, roomSeat, { action: 'resource', revision: containerBefore - 5, laneRevision: laneRevBefore })
  assert.equal(resourcesBefore(state.parallel.lanes.A), resBefore + 1, '重基后的提交生效')
  assert.equal(state.revision, containerBefore + 1)
  assert.equal(state.parallel.lanes.A.revision, laneRevBefore + 1)
  assert.equal(state.parallel.lanes.B.revision, laneRevBBefore, 'B 线版本不被 A 线提交影响')
})

test('P9.5 G8 容器协议 commitLane/commitBoth：全局与线内双版本、重基、stale', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-dual-proto' }))
  const container = dualContainerFromLanes(state)
  const baseA = container.lanes.A.revision
  const baseB = container.lanes.B.revision
  // 目标线提交：全局 +1、目标线 +1、另一线不动。
  const commitA = commitLane(container, 'A', draft => {
    draft.campaign.xp = (draft.campaign.xp || 0) + 5
    draft.campaign.records.protocolMarker = true
    return draft.campaign.xp
  }, { baseLaneRevision: baseA })
  assert.equal(commitA.ok, true)
  assert.equal(commitA.revision, 1)
  assert.equal(container.revision, 1)
  assert.equal(container.lanes.A.revision, baseA + 1)
  assert.equal(container.lanes.B.revision, baseB)
  assert.equal(container.lanes.A.campaign.records.protocolMarker, true)
  assert.equal(container.lanes.B.campaign.records.protocolMarker, undefined)
  // 跨线同时提交：两种顺序都保留，全局各 +1。
  for (const order of [['A', 'B'], ['B', 'A']]) {
    const fresh = dualContainerFromLanes(state)
    const commits = [
      { lane: 'A', reducer: draft => { draft.campaign.victory = (draft.campaign.victory || 0) + 1 } },
      { lane: 'B', reducer: draft => { draft.campaign.victory = (draft.campaign.victory || 0) + 1 } },
    ]
    const outcome = commitBoth(fresh, order.map(lane => ({ ...commits.find(item => item.lane === lane), baseLaneRevision: fresh.lanes[lane].revision })))
    assert.equal(outcome.ok, true)
    assert.equal(fresh.revision, 2)
    assert.equal(fresh.lanes.A.campaign.victory, (state.parallel.lanes.A.campaign.victory || 0) + 1)
    assert.equal(fresh.lanes.B.campaign.victory, (state.parallel.lanes.B.campaign.victory || 0) + 1)
  }
  // 同线过期拒绝：不提交、不留半成品。
  const stale = commitLane(container, 'A', draft => { draft.campaign.xp = 999 }, { baseLaneRevision: baseA })
  assert.equal(stale.ok, false)
  assert.equal(stale.reason, 'stale-lane')
  assert.notEqual(container.lanes.A.campaign.xp, 999)
  // 全局版本过期（传旧全局值）但目标线未变：允许重基（协议不校验全局）。
  const rebased = commitLane(container, 'B', draft => { draft.campaign.records.rebased = true }, { baseLaneRevision: baseB })
  assert.equal(rebased.ok, true)
  assert.equal(container.revision, 2)
  assert.equal(container.lanes.B.campaign.records.rebased, true)
  // reducer 抛错：不提交、版本不变。
  const revNow = container.revision
  assert.throws(() => commitLane(container, 'A', () => { throw new Error('boo') }), /boo/)
  assert.equal(container.revision, revNow)
})

// ---------------------------------------------------------------------------
// G9（门禁 9）：两线交错提交串行、事件 seq、单文件保存
// ---------------------------------------------------------------------------
test('P9.5 G9 两线交错提交不丢更新，revision 单调，状态替换/checkpoint 全局串行', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-interleave' }))
  const acting = actingByLane(state)
  const laneSeatA = state.parallel.lanes.A.laneRuntime.roomSeats.indexOf(acting.A)
  const laneSeatB = state.parallel.lanes.B.laneRuntime.roomSeats.indexOf(acting.B)
  const startA = state.parallel.lanes.A.investigators[laneSeatA].resources
  const startB = state.parallel.lanes.B.investigators[laneSeatB].resources
  const revisions = [state.revision]
  // A/B/A/B 交错提交；两边不丢更新。
  for (const seat of [acting.A, acting.B, acting.A, acting.B]) {
    mod.applyMove(state, seat, { action: 'resource' })
    revisions.push(state.revision)
    settleParallelLaneChoices(engine, mod, state)
    revisions.push(state.revision)
  }
  assert.ok(revisions.every((value, index) => index === 0 || value >= revisions[index - 1]), 'revision 单调不降')
  assert.equal(state.parallel.lanes.A.investigators[laneSeatA].resources, startA + 2)
  assert.equal(state.parallel.lanes.B.investigators[laneSeatB].resources, startB + 2)
  assert.equal(state.status, 'playing')
  // checkpoint 在交错提交后生成：两条线的版本被同一快照串行捕获。
  const session = { state, events: [], scenarioCheckpoints: [] }
  const checkpoint = createSessionCheckpoint(session, { move: { action: 'hubBeginScenario' }, after: state })
  assert.ok(checkpoint)
  assert.equal(checkpoint.sourceRevision, state.revision)
  assert.equal(checkpoint.snapshot.state.parallel.lanes.A.revision, state.parallel.lanes.A.revision)
  assert.equal(checkpoint.snapshot.state.parallel.lanes.B.revision, state.parallel.lanes.B.revision)
  assert.equal(checkpoint.snapshot.state.revision, state.revision)
})

test('P9.5 G9 批量确认按座位原子提交并按全局事件 seq 串行；失败不留半成品', () => {
  const state = hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-batch' })
  launchParallelRaw(state)
  // 真实开局序列：骨架先触发 story 选择，then mulligan；逐条回答直到某条线出现 mulligan。
  let mulligan = null
  for (let guard = 0; guard < 20 && !mulligan; guard += 1) {
    for (const lane of ['A', 'B']) {
      const laneState = state.parallel.lanes[lane]
      const pending = laneState.pendingChoice
      if (!pending) continue
      if (pending.kind === 'mulligan') { mulligan = { lane, laneState, pending }; break }
      const roomSeat = laneState.laneRuntime.roomSeats[pending.seat ?? 0]
      const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0]?.id
      mod.applyMove(state, roomSeat, { action: 'choose', choiceId: pending.id, optionId })
    }
  }
  assert.ok(mulligan, '并行开局应出现换牌（mulligan）窗口')
  const { lane, laneState, pending } = mulligan
  const roomSeat = laneState.laneRuntime.roomSeats[pending.seat]
  const hand = [...laneState.investigators[pending.seat].hand]
  const candidateId = pending.options.find(option => /^\d+$/.test(option.id) && hand[Number(option.id)])
  assert.ok(candidateId, '换牌窗口应有手牌选项')
  const containerBefore = state.revision
  const targetLaneBefore = laneState.revision
  const otherLane = lane === 'A' ? 'B' : 'A'
  const otherLaneBefore = state.parallel.lanes[otherLane].revision
  const otherDataBefore = clone(state.parallel.lanes[otherLane].campaign.records)
  const session = { state, events: [{ seq: 0, type: 'seed' }], sessionId: 'p95-batch' }
  const receipt = mod.commitChoiceBatch(session, roomSeat, {
    kind: 'mulligan',
    choiceId: pending.id,
    selected: [{ index: Number(candidateId.id), code: hand[Number(candidateId.id)] }],
    finish: 'done',
  }, {
    moveError: message => Object.assign(new Error(message), { moveError: true }),
    commitMove() { throw new Error('并行批量选择不应走容器 commitMove') },
  })
  assert.equal(receipt.move.action, 'choiceBatch')
  // 原子：容器版本 +1、目标线版本前进、另一线不变、另一线数据不变。
  assert.equal(state.revision, containerBefore + 1)
  assert.ok(state.parallel.lanes[lane].revision > targetLaneBefore)
  assert.equal(state.parallel.lanes[otherLane].revision, otherLaneBefore)
  assert.deepEqual(state.parallel.lanes[otherLane].campaign.records, otherDataBefore)
  assert.equal(state.parallel.lanes[lane].investigators[pending.seat].hand.length, hand.length, '换牌后补回同数量')
  // 事件 seq 全局串行、带 lane 标记、座位换回房间座位。
  assert.ok(receipt.events.length > 0)
  const seqs = receipt.events.map(event => event.seq)
  assert.deepEqual(seqs, seqs.map((_, index) => index + 1), 'seq 从 session.events.length 起连续递增')
  assert.ok(receipt.events.every(event => event.lane === lane))
  assert.ok(receipt.events.every(event => event.seat == null || state.campaign.seatParts[event.seat] === lane))
  // 失败不落地：过期 choiceId → 抛错且容器版本/线版本不变。
  const revBeforeFailure = state.revision
  const laneRevBeforeFailure = state.parallel.lanes[lane].revision
  assert.throws(() => mod.commitChoiceBatch({ state, events: [], sessionId: 'p95-batch-fail' }, roomSeat, {
    kind: 'mulligan', choiceId: 'stale', selected: [{ index: 0, code: hand[0] }], finish: 'done',
  }, {
    moveError: message => Object.assign(new Error(message), { moveError: true }),
    commitMove() { throw new Error('不应走容器 commitMove') },
  }), /当前选择已变化/)
  assert.equal(state.revision, revBeforeFailure)
  assert.equal(state.parallel.lanes[lane].revision, laneRevBeforeFailure)
})

test('P9.5 G9 单文件存档串行化：同内容同字节、坏档明确失败、双运行时协议一致', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-serialize' }))
  const first = serializeContainer(world, state)
  const second = serializeContainer(world, state)
  assert.equal(first, second, '同内容必须同字节（单文件存档指纹稳定）')
  // 关掉/重开进程的口径：JSON 往返后同样逐字节一致。
  assert.equal(serializeContainer(world, restoreContainer(world, first)), first)
  assert.ok(first.endsWith('\n'))
  // dual-runtime 容器协议：同内容同字节、恢复后可继续提交。
  const container = dualContainerFromLanes(state)
  commitLane(container, 'A', draft => { draft.campaign.xp = 9 }, { baseLaneRevision: container.lanes.A.revision })
  const text = serializeDualRuntime(container)
  assert.equal(serializeDualRuntime(container), text)
  const restored = restoreDualRuntime(text)
  assert.equal(serializeDualRuntime(restored), text)
  const next = commitLane(restored, 'B', draft => { draft.campaign.victory = 1 }, { baseLaneRevision: restored.lanes.B.revision })
  assert.equal(next.ok, true)
  assert.equal(restored.revision, container.revision + 1)
  // 坏档必须失败（保存失败不得回成功）。
  assert.throws(() => restoreDualRuntime('{"schemaVersion":99}'), /不支持的容器版本/)
  const bad = JSON.parse(text)
  delete bad.lanes.B
  assert.throws(() => restoreDualRuntime(JSON.stringify(bad)), /lanes\.B/)
})

// ---------------------------------------------------------------------------
// G10（门禁 10）：章对屏障 + pairSealed/幕间只一次
// ---------------------------------------------------------------------------
test('P9.5 G10 容器协议：两线同 pairId 只封盘/幕间一次，重放与读档幂等', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-seal' }))
  const container = dualContainerFromLanes(state)
  // shared 里放真实 TDE campaign 容器（记录写回 A/B 快照由 recordInPart 负责）。
  container.shared.campaign = {
    currentPart: null,
    records: {},
    parts: { A: { records: {}, storySections: {} }, B: { records: {}, storySections: {} } },
  }
  let interludeRuns = 0
  const applied = []
  const applyInterlude = (shared, pairId) => {
    interludeRuns += 1
    applied.push(pairId)
    // 真实跨线效果：两条线各写一条记录 + 两袋各加一枚 token。
    recordInPart(shared.campaign, 'A', 'theBlackCatIsAtYourSide', true)
    recordInPart(shared.campaign, 'B', 'theBlackCatIsAtYourSide', true)
    mutateBothBags({ campaign: shared.campaign, chaosBag: shared.campaign.parts.A.chaosBag }, bag => [...bag, 'elderthing'])
    return { pairId }
  }
  // 只有 A 线结算：不封盘、不跑幕间。
  const awaitingA = markAwaitingPair(container, 'A', '1')
  assert.equal(awaitingA.ok, true)
  const waiting = sealPairOnce(container, '1', { applyInterlude })
  assert.equal(waiting.sealed, false)
  assert.equal(waiting.reason, 'waiting-other-lane')
  assert.equal(interludeRuns, 0)
  const revisionWhenWaiting = container.revision
  assert.equal(container.revision, revisionWhenWaiting)
  // B 线也结算到同一 pair：一次提交里封盘 + 幕间 + interludeApplied。
  markAwaitingPair(container, 'B', '1')
  const revBeforeSeal = container.revision
  const laneRevsBefore = { A: container.lanes.A.revision, B: container.lanes.B.revision }
  const sealed = sealPairOnce(container, '1', { applyInterlude })
  assert.equal(sealed.sealed, true)
  assert.equal(sealed.applied, true)
  assert.equal(interludeRuns, 1)
  assert.deepEqual(applied, ['1'])
  assert.ok(container.shared.pairSealed['1'])
  assert.ok(container.shared.interludeApplied['1'])
  assert.equal(container.lanes.A.awaitingPair, null)
  assert.equal(container.lanes.B.awaitingPair, null)
  assert.equal(container.lanes.A.revision, laneRevsBefore.A + 1)
  assert.equal(container.lanes.B.revision, laneRevsBefore.B + 1)
  assert.equal(container.revision, revBeforeSeal + 1, '封盘只提交一次全局版本')
  assert.equal(container.shared.campaign.parts.A.records.theBlackCatIsAtYourSide, true)
  assert.equal(container.shared.campaign.parts.B.records.theBlackCatIsAtYourSide, true)
  // 重复提交 / 重放：already-applied，不再跑幕间、不再推进版本。
  const again = sealPairOnce(container, '1', { applyInterlude })
  assert.equal(again.applied, false)
  assert.equal(again.reason, 'already-applied')
  assert.equal(interludeRuns, 1)
  assert.equal(container.revision, sealed.revision)
  // 读档后（同一份单文件存档）再重放封盘提交：仍幂等。
  const restored = restoreDualRuntime(serializeDualRuntime(container))
  const replayed = sealPairOnce(restored, '1', { applyInterlude })
  assert.equal(replayed.reason, 'already-applied')
  assert.equal(replayed.applied, false)
  assert.equal(interludeRuns, 1)
  // 未结算的下一对不会误封。
  assert.equal(sealPairOnce(container, '2', { applyInterlude }).reason, 'not-awaiting')
  assert.equal(interludeRuns, 1)
})

test('P9.5 G10 章对屏障：未封盘时两线都不能开下一章', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-barrier' }))
  const acting = actingByLane(state)
  const revisionBefore = state.revision
  // 两条线都没结算：拒绝。
  assert.throws(() => mod.applyMove(state, acting.A, { action: 'hubBeginScenario' }), /另一条线尚未结算到同一章对/)
  assert.equal(state.revision, revisionBefore, '被屏障拒绝的提交不能推进版本')
  // 只有 A 线结算到 pair 1：B 线（仍在运行时里）开下一章仍被拒绝（两边未到同一章对）。
  simulateScenarioFinished(state, 'A')
  const markA = pr.markLaneFinished(state, 'A', 1)
  assert.equal(markA.sealed, false)
  const revisionAfterMark = state.revision
  assert.throws(() => mod.applyMove(state, acting.B, { action: 'hubBeginScenario' }), /另一条线尚未结算到同一章对/)
  assert.equal(state.revision, revisionAfterMark)
  // B 线结算到同一 pair：封盘标记出现，章对屏障才放行（推进由 advanceParallelPair 负责）。
  simulateScenarioFinished(state, 'B')
  const markB = pr.markLaneFinished(state, 'B', 1)
  assert.equal(markB.sealed, true)
  assert.ok(state.parallel.sealed[1])
  assert.deepEqual(state.parallel.awaiting, { A: 1, B: 1 })
})

// ---------------------------------------------------------------------------
// 补充：G5 事件按线过滤 / G7 投影座位回房间座位（Lead 修复后的回归位）。
// ---------------------------------------------------------------------------
test('P9.5 G5 viewEvents 按观察者所属线过滤（lane 推断）且无 seat 事件也带 lane', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-events-lane' }))
  const acting = actingByLane(state)
  const eventsA = actParallel(state, acting.A, { action: 'resource' })
  const eventsB = actParallel(state, acting.B, { action: 'resource' })
  // 所有引擎事件在 append 前都带 lane（含无 seat 的 info / presentation）。
  assert.ok(eventsA.length > 0 && eventsA.every(event => event.lane === 'A'),
    `A 线事件应全部带 lane：${JSON.stringify(eventsA.map(event => [event.type, event.lane]))}`)
  assert.ok(eventsB.length > 0 && eventsB.every(event => event.lane === 'B'),
    `B 线事件应全部带 lane：${JSON.stringify(eventsB.map(event => [event.type, event.lane]))}`)
  // viewEvents：传 { state, seat } 时从房间座位推导观察者所属线，另一线事件不可见。
  const seenByA = mod.viewEvents([...eventsA, ...eventsB], acting.A, { state })
  assert.ok(seenByA.every(event => event.lane !== 'B'), 'A 座位不能看到 B 线事件')
  const seenByB = mod.viewEvents([...eventsA, ...eventsB], acting.B, { state })
  assert.ok(seenByB.every(event => event.lane !== 'A'), 'B 座位不能看到 A 线事件')
  // 显式 { lane } 同样生效；无 lane/无 state 时保持旧契约（不过滤）。
  assert.ok(mod.viewEvents([...eventsA, ...eventsB], acting.A, { lane: 'A' }).every(event => event.lane === 'A'))
  assert.equal(mod.viewEvents([...eventsA, ...eventsB], acting.A).length, eventsA.length + eventsB.length)
})
// G7 的视图投影：parallelView 把座位字段换回 roomSeat。
test('P9.5 G7 投影座位换回 roomSeat：investigators/currentSeat/pendingChoice/humanSeats/leadSeat', () => {
  // 标准 A,A,B,B：B 线玩家是房间座位 2/3，视图里不能再出现线内座位 0/1。
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-view-seats' }))
  const viewB = mod.viewState(state, 2)
  assert.ok([2, 3].includes(viewB.currentSeat), `B 线视图 currentSeat 应是房间座位：${viewB.currentSeat}`)
  assert.deepEqual(viewB.investigators.map(inv => inv.seat).sort(), [2, 3])
  assert.ok(viewB.humanSeats.every(seat => [2, 3].includes(seat)))
  if (viewB.pendingChoice) {
    assert.ok([2, 3].includes(viewB.pendingChoice.seat), `B 线待决选择座位应是房间座位：${viewB.pendingChoice.seat}`)
    assert.equal(state.campaign.seatParts[viewB.pendingChoice.seat], 'B')
  }
  if (viewB.campaign?.leadSeat != null) assert.ok([2, 3].includes(viewB.campaign.leadSeat))
  const viewA = mod.viewState(state, 0)
  assert.ok([0, 1].includes(viewA.currentSeat))
  assert.deepEqual(viewA.investigators.map(inv => inv.seat).sort(), [0, 1])
  // 非连续 A,B,A,B：A 线视图的座位是房间座位 0/2，B 线是 1/3。
  const alt = beginParallel(hubSetupAdvanced({
    seats: 4, assignParts: ['A', 'B', 'A', 'B'], roles: ['human', 'human', 'human', 'human'], seed: 'p95-view-seats-alt',
  }))
  const altA = mod.viewState(alt, 2)
  assert.equal(altA.parallel.lane, 'A')
  assert.deepEqual(altA.investigators.map(inv => inv.seat).sort(), [0, 2])
  assert.ok([0, 2].includes(altA.currentSeat))
  const altB = mod.viewState(alt, 3)
  assert.equal(altB.parallel.lane, 'B')
  assert.deepEqual(altB.investigators.map(inv => inv.seat).sort(), [1, 3])
  assert.ok([1, 3].includes(altB.currentSeat))
})

test('P9.5 G10 封盘后两线自动进幕间 I（2–3 节点）并开下一章；重放/读档幂等', () => {
  const state = beginParallel(hubSetup(engine, { seats: 4, mode: 'parallel', seed: 'p95-advance' }))
  sealPair(state, 1)
  const revisionBeforeAdvance = state.revision
  const advance = pr.advanceParallelPair(state, 1)
  assert.equal(advance.ok, true, JSON.stringify(advance.advanced))
  assert.equal(state.revision, revisionBeforeAdvance + 1, '封盘推进只推进一次全局版本')
  const { A, B } = state.parallel.lanes
  // 封盘后两线自动走完真实 TDE 单线幕间 I（A 2 节点 / B 3 节点），并进入下一章 A2/B2。
  assert.equal(A.uiState, 'inScenario')
  assert.equal(B.uiState, 'inScenario')
  assert.equal(A.scenario.id, SCENARIO.A2)
  assert.equal(B.scenario.id, SCENARIO.B2)
  assert.equal(A.campaign.scenarioIndex, 1)
  assert.equal(B.campaign.scenarioIndex, 1)
  assert.deepEqual(state.parallel.awaiting, { A: null, B: null })
  assert.ok(state.parallel.sealed[1])
  // 两条线仍在线内密集座位（并行 lane 的关间不恢复容器全座）。
  assert.deepEqual(A.laneRuntime.roomSeats, [0, 1])
  assert.deepEqual(B.laneRuntime.roomSeats, [2, 3])
  assert.deepEqual(A.investigators.map(inv => inv.seat), [0, 1])
  assert.deepEqual(B.investigators.map(inv => inv.seat), [0, 1])
  // 幕间 I 的单线变体按线走完：A 只经过 theBlackCat/theBlackCat1；B 经过 theBlackCat3 + youAreOnYourOwn。
  const AHistory = A.campaign.flow.history.map(item => item.nodeId)
  const BHistory = B.campaign.flow.history.map(item => item.nodeId)
  assert.ok(AHistory.includes('interlude1') && AHistory.includes('interlude1.1'), `A 线应读完幕间 I 两个节点：${AHistory.join('>')}`)
  assert.ok(BHistory.includes('interlude1.3') && BHistory.includes('interlude1.youAreOnYourOwn'),
    `B 线应读完幕间 I 三个节点：${BHistory.join('>')}`)
  // 幕间效果：B 单线分支记录 youAreOnYourOwn；A 单线分支不写该记录（跨线不串）。
  assert.equal(B.campaign.records.youAreOnYourOwn, true)
  assert.equal(A.campaign.records.youAreOnYourOwn, undefined)
  // 两线真实的下一章已开局，且各有可行动座位。
  assert.equal(A.round, 1)
  assert.equal(B.round, 1)
  assert.ok(mod.actingSeats(state).length >= 2)
  // pairSealed+幕间+interludeApplied 只提交一次；重复 advance 是 no-op。
  assert.ok(state.parallel.interludeApplied?.[1], '应写 interludeApplied[1]')
  const revisionAfterFirst = state.revision
  const replay = pr.advanceParallelPair(state, 1)
  assert.equal(replay.ok, true, '重放应幂等成功')
  assert.equal(replay.alreadyApplied, true)
  assert.equal(state.revision, revisionAfterFirst, '重放不得再提交一次')
  assert.equal(A.campaign.scenarioIndex, 1)
  assert.equal(B.campaign.scenarioIndex, 1)
  // 读档后重放同样幂等（重连/重启路径）。
  const restored = restoreContainer(world, serializeContainer(world, state))
  const replayRestored = pr.advanceParallelPair(restored, 1)
  assert.equal(replayRestored.alreadyApplied, true)
  assert.equal(restored.revision, revisionAfterFirst)
  assert.equal(restored.parallel.lanes.B.campaign.records.youAreOnYourOwn, true)
})
