// P8《绯红密钥》发布验收：世界地图启程 → 逐章推进（真实 hub / HTTP 同源路径）。
//
// 覆盖 docs/campaign/theScarletKeys/README.md §4 的启程循环与 §3 P8 清单：
//   ① 清单数据：worldMapGraph 36 节点、目的地→流程节点映射（8 章 / 16 段密档 / 绿地 / 终章）、
//      manifest 新增字段可 JSON 往返并由 assertCampaignManifest 接受；
//   ② 真实 createGameState（生产组合根注册）→ 首章《谜雨》→ 幕间 I → worldMap：
//      房主合法动作只含已解锁目的地，`hubEmbark` 进入目标章节准备（时间/位置/地图记录同步）；
//   ③ 多航线：London→马拉喀什→布宜诺斯艾利斯、London→君士坦丁堡→哈瓦那、绿地支线停留；
//   ④ 时间阈值：hubAdvanceReport 结算 α/ε（真实节点 + 内容处理器）后回 map；时间 ≥35 只给
//      通古斯卡（被迫启程）→《钥匙议会》→ 尾声 → 战役结束；
//   ⑤ 四档难度各跑一次 map→章节准备；
//   ⑥ 中英记录标签、JSON 存档往返后继续启程；
//   ⑦ 失败/撤退（noResolution）回 map 可继续 + 幕间 26 取得快捷旅票后 expedite 直达未解锁节点。
//
// 披露（P8 近似/夹具口径，逐条）：
//   · approximation: 测试用 `createGameState({ campaignHub: true, campaignId: 'theScarletKeys' })`
//     与真实大厅同一条生产组合根（content/registered.js）；章内结算走调试指令 `debug.endScenario`
//     （与大厅「结束本章」同一 `finishScenario` 路径），不伪造章节数据。
//   · approximation: 为缩短到状况报告阈值的路径，少数用例直接写入 `campaign.tsk.map.time` /
//     `records.time`（真实累积来自每次旅行的 cost 与幕间 markTime；P7 的 tsk-campaign-flow /
//     tsk-interludes 用例已覆盖这两条来源）。状况报告的排队、演出与结算仍走真实
//     worldMap 节点效果与 statusReport 节点。
//   · approximation: 快捷旅票（09765）是永久剧情卡，真实路线由幕间 26 放进战役牌组；本用例也走该
//     真实路线（选择「跑一趟」/ticket 分支）取票，再验证 expedite 直达未解锁节点与放逐记账。
//     卡条目在场景内的 scenarioFlags 能力路径不在此改（hub 窗口没有 state.scenario）。
//   · 已知未覆盖（跨循环引擎读点，非本 worker 写权限）：deadHeat 的 noResolution 与钥匙议会
//     resolution1 会调用 `api.addTrauma(seat, kind, n)`，而 `applyResolutionEffects` 目前把原始
//     `addTrauma(state, seat, kind, amount, events)`（引擎签名）放进 api——真实 hub 路径会读到
//     `state.campaign` 为 undefined。本文件因此用「不触发该分支」的结局键覆盖启程/推进/终章，
//     并在回复里单列受影响的章节分支；修复点在 src/engine/campaign-flow.js（不在本 worker 允许写路径）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { actingSeats, applyMove, createGameState, legalMoves } from '../src/engine/engine.js'
import { mechanicView } from '../src/integration/mechanic-view.js'
import { viewState } from '../src/integration/observation.js'
import { statusReportState, travelTimeCost, worldMapState } from '../src/engine/tsk-map.js'
import { assertCampaignManifest } from '../content/schema.js'
import {
  campaignFlowExtras, TSK_FLOW, TSK_FLOW_NODE_ORDER, TSK_RECORD_LABELS, TSK_RECORD_SCHEMA,
} from '../content/campaigns/theScarletKeys/flow.js'
import { manifest as tskManifest } from '../content/campaigns/theScarletKeys/manifest.js'
import { TSK_STORY_KEYS } from '../content/campaigns/theScarletKeys/story-text.js'
import { recordLabel } from '../content/campaigns/theScarletKeys/records.js'
import {
  TSK_DOSSIER_INTERLUDE_IDS, TSK_ENDGAME_STEP, TSK_FORCED_ENDGAME_TIME, TSK_SCENARIO_IDS,
  TSK_TRAVEL_TRIGGERS, TSK_WORLD_MAP_IDS, campaignStoryText,
} from '../content/campaigns/theScarletKeys/parts.js'
import { CHAOS_BAGS, INITIAL_UNLOCKED, WORLD_MAP } from '../content/campaigns/theScarletKeys/shared.js'

const CAMPAIGN_ID = 'theScarletKeys'
const MAP_NODE = 'worldMap'
const MAINLINE_MAP_CHAPTERS = TSK_SCENARIO_IDS.filter(id => !['riddlesAndRain', TSK_ENDGAME_STEP].includes(id))
const CJK = /[\u3400-\u9fff]/

// ---------------------------------------------------------------------------
// 夹具：真实 hub 驱动（campaignHub → 首章 → 幕间 I → worldMap）
// ---------------------------------------------------------------------------
/** 回答待决选择：优先「不推进坏分支」的安全选项；interlude26 的 ticket 分支排第一。 */
const SAFE_CHOICES = ['done', 'skip', 'no', 'tell', 'continue', 'decline', 'cancel', 'ticket']
function settle (state, guardMax = 400) {
  for (let guard = 0; state.pendingChoice && guard < guardMax; guard += 1) {
    const choice = state.pendingChoice
    const safe = SAFE_CHOICES.map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const option = safe || choice.options.find(item => /^resolution\d/.test(String(item.id))) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  assert.ok(!state.pendingChoice, '待决选择未收敛')
  return state
}

const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

function act (state, seat, move) {
  assert.ok(move, `缺少合法动作（座位 ${seat}）：${legalMoves(state, seat).map(item => item.action).join(',')}`)
  applyMove(state, seat, plainMove(move))
  return settle(state)
}

const findMove = (state, seat, action) => legalMoves(state, seat).find(move => move.action === action)
const atMap = state => state.uiState === 'interlude' && state.campaign.flowStage === 'map'
  && state.campaign.flow?.nodeId === MAP_NODE

/** 沿真实 hub 流程推进：开局台面 → 首章 → 结算 → 幕间 I → worldMap。 */
function driveToMap (state, { maxSteps = 400 } = {}) {
  for (let step = 0; step < maxSteps; step += 1) {
    settle(state)
    if (atMap(state)) return state
    assert.equal(state.status, 'playing', `对局提前结束（${state.outcome}）`)
    if (state.uiState === 'campaignHub') {
      // 多人战役要先选队长（hub-replacement 等既有夹具同口径）。
      if (!state.campaign.leadConfirmed) {
        act(state, 0, findMove(state, 0, 'hubSetLeader'))
        continue
      }
      act(state, 0, findMove(state, 0, 'hubGoSetup') || findMove(state, 0, 'hubSelectScenario'))
      continue
    }
    if (state.uiState === 'scenarioResult') {
      act(state, 0, findMove(state, 0, 'hubContinue'))
      continue
    }
    if (state.uiState === 'scenarioSetup' && state.hubReady) {
      if (!state.campaign.leadConfirmed) {
        act(state, 0, findMove(state, 0, 'hubSetLeader'))
        continue
      }
      act(state, 0, findMove(state, 0, 'hubBeginScenario'))
      continue
    }
    if (state.uiState === 'scenarioSetup' || state.uiState === 'interlude') {
      const seat = actingSeats(state)[0]
      const moves = legalMoves(state, seat)
      const move = moves.find(item => item.action === 'hubAutoDeck')
        || moves.find(item => item.action === 'hubDoneSeat')
        || moves.find(item => item.action === 'hubSelectInvestigator')
        || moves.find(item => item.action === 'hubSetDeck')
      act(state, seat, move)
      continue
    }
    if (state.uiState === 'inScenario') {
      const keys = Object.keys(state.scenario.resolutions || {})
      const resolutionKey = keys.find(key => /^resolution\d/.test(key)) || keys[0]
      act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
      continue
    }
    assert.fail(`未预期的 uiState：${state.uiState}`)
  }
  assert.fail('未在预期步数内到达世界地图')
}

/** 真实建局并推进到 map 相位（每例独立的完整首章 + 幕间 I）。 */
function mapReady ({ seed, difficulty = 'standard', players = [{ seat: 0, role: 'human' }] } = {}) {
  const state = createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed, difficulty }, players)
  driveToMap(state)
  assert.equal(state.campaign.records.currentLocation, 'London')
  // P8 时间统一：序幕引言分支的 +2 时间奖励会由 syncMapRecords 并入世界地图时间轴（P7 前是两套存储）。
  assert.equal(state.campaign.records.time, 2)
  return state
}

/** 房主启程：提交 hubLegalMoves 给出的候选（plainMove 去掉展示字段）。 */
function embark (state, destination, { expedite = false } = {}) {
  const move = legalMoves(state, 0).find(item => item.action === 'hubEmbark'
    && item.destination === destination && (item.expedite === true) === expedite)
  assert.ok(move, `没有启程候选：${destination}（expedite=${expedite}）；`
    + `当前候选 ${legalMoves(state, 0).filter(item => item.action === 'hubEmbark').map(item => `${item.destination}${item.expedite ? '*' : ''}`).join('、')}`)
  act(state, 0, move)
  return move
}

/** 章节准备窗口：各座位确认 → 房主开始关卡（真实 hubBeginScenario）。 */
function confirmAndBegin (state) {
  for (let guard = 0; guard < 12 && !state.hubReady; guard += 1) {
    const seat = actingSeats(state)[0]
    act(state, seat, findMove(state, seat, 'hubDoneSeat'))
  }
  assert.equal(state.hubReady, true, '队伍未完成关间准备')
  act(state, 0, findMove(state, 0, 'hubBeginScenario'))
  assert.equal(state.uiState, 'inScenario')
  assert.ok(state.scenario?.id, '关卡未开始')
  return state.scenario.id
}

/** 结束当前章节（调试指令走同一条 finishScenario）并回到 map 相位。 */
function finishChapter (state, { resolution = null } = {}) {
  const keys = Object.keys(state.scenario.resolutions || {})
  const resolutionKey = resolution || keys.find(key => /^resolution\d/.test(key)) || keys[0]
  act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  assert.equal(state.uiState, 'scenarioResult', '章节结算后应停在 scenarioResult')
  const result = state.campaign.scenarioResults.at(-1)
  act(state, 0, findMove(state, 0, 'hubContinue'))
  driveToMap(state)
  return result
}

/** 旅行 → 章节 → 结算 → 回 map（多航线用）。 */
function runChapter (state, destination, { resolution = null } = {}) {
  embark(state, destination)
  assert.equal(state.uiState, 'scenarioSetup')
  confirmAndBegin(state)
  const scenarioId = state.scenario.id
  const result = finishChapter(state, { resolution })
  assert.equal(atMap(state), true, `${scenarioId} 结算后没有回到世界地图`)
  return { scenarioId, result }
}

/** 清算全部待处理状况报告（真实 statusReport 节点），回到 map。 */
function resolveReports (state) {
  const seen = []
  while (statusReportState(state)?.pending?.length) {
    const move = findMove(state, 0, 'hubAdvanceReport')
    assert.ok(move, '有到期状况报告但没有 hubAdvanceReport 候选')
    act(state, 0, move)
    assert.equal(atMap(state), true, '状况报告结算后没有回到世界地图')
    seen.push(move.report)
  }
  return seen
}

/**
 * 测试夹具：直接推进时间轴到指定值（真实累积由旅行 cost 与幕间 markTime 完成；P7 已覆盖）。
 * 只用于缩短「跨阈值 → 状况报告」的路径；排队/演出/结算仍走真实 worldMap 与 statusReport 节点。
 */
function setTime (state, time) {
  state.campaign.tsk.map.time = time
  state.campaign.records.time = time
}

const reportPending = state => statusReportState(state)?.pending || []
const cultistCount = state => (state.chaosBag || []).filter(token => token === 'cultist').length

// ---------------------------------------------------------------------------
// ① 清单数据（世界地图图 / 目的地映射 / manifest）
// ---------------------------------------------------------------------------
test('P8 TSK 世界地图清单：worldMapGraph 36 节点、travelNodes 覆盖 8 章/16 段密档/绿地/终章，manifest 通过校验', () => {
  const manifest = assertCampaignManifest(tskManifest)
  const graph = campaignFlowExtras.worldMapGraph
  assert.ok(Object.isFrozen(graph), 'worldMapGraph 应冻结（引擎只读）')
  assert.ok(Object.isFrozen(graph.nodes), 'worldMapGraph.nodes 应冻结')
  assert.equal(graph.nodes.length, 36)
  assert.deepEqual(graph.nodes.map(node => node.id).sort(), [...TSK_WORLD_MAP_IDS].sort())
  assert.deepEqual(graph.nodes.map(node => node.id).sort(), WORLD_MAP.map(node => node.id).sort())
  for (const node of graph.nodes) {
    assert.deepEqual(Object.keys(node).sort(), ['connections', 'id', 'type'])
    assert.ok(['standard', 'locked', 'side'].includes(node.type), `${node.id} 类型非法`)
    assert.ok(Array.isArray(node.connections) && node.connections.length > 0, `${node.id} 无连接`)
    for (const to of node.connections) assert.ok(TSK_WORLD_MAP_IDS.includes(to), `${node.id} 连接了未知节点 ${to}`)
  }
  // 连接双向对称（地图可走通）。
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  for (const node of graph.nodes) {
    for (const to of node.connections) assert.ok(byId.get(to).connections.includes(node.id), `${node.id}↔${to} 不对称`)
  }
  // JSON 往返（manifest 进存档/网络）。
  assert.deepEqual(JSON.parse(JSON.stringify(graph)), { nodes: graph.nodes.map(node => ({
    id: node.id, type: node.type, connections: [...node.connections],
  })) })

  // 目的地 → 流程图节点：8 章 + 16 段密档 + 5 处绿地支线 + 通古斯卡→终章入口。
  const travelNodes = campaignFlowExtras.travelNodes
  assert.equal(Object.keys(travelNodes).length, 36)
  assert.deepEqual(Object.keys(travelNodes).sort(), [...TSK_WORLD_MAP_IDS].sort())
  const values = Object.values(travelNodes)
  assert.deepEqual([...new Set(values.filter(value => MAINLINE_MAP_CHAPTERS.includes(value)))].sort(), [...MAINLINE_MAP_CHAPTERS].sort())
  assert.equal(values.filter(value => MAINLINE_MAP_CHAPTERS.includes(value)).length, 8)
  assert.deepEqual([...new Set(values.filter(value => TSK_DOSSIER_INTERLUDE_IDS.includes(value)))].sort(),
    [...TSK_DOSSIER_INTERLUDE_IDS].sort())
  assert.equal(values.filter(value => TSK_DOSSIER_INTERLUDE_IDS.includes(value)).length, 22,
    '22 个地图节点触发 16 段密档幕间（一档多城）')
  assert.equal(values.filter(value => value === 'sideStory').length, 5)
  assert.equal(travelNodes.Tunguska, 'endgameApproach')
  assert.equal(travelNodes.Marrakesh, 'deadHeat')
  assert.equal(travelNodes.BuenosAires, 'sanguineShadows')
  assert.equal(travelNodes.Constantinople, 'dealingsInTheDark')
  assert.equal(travelNodes.Havana, 'dancingMad')
  assert.equal(travelNodes.Kabul, 'interlude14')
  assert.equal(travelNodes.Cairo, 'sideStory')
  assert.equal(campaignFlowExtras.mapNodeId, MAP_NODE)
  assert.equal(campaignFlowExtras.endgameApproachNodeId, 'endgameApproach')
  assert.equal(TSK_FLOW.nodes[campaignFlowExtras.endgameApproachNodeId].next, TSK_ENDGAME_STEP)
  assert.equal(campaignFlowExtras.forcedEndgameTime, TSK_FORCED_ENDGAME_TIME)
  assert.equal(campaignFlowExtras.forcedEndgameNode, 'Tunguska')
  assert.deepEqual(TSK_TRAVEL_TRIGGERS, campaignFlowExtras.travelTriggers)
  // 展示名只来自 story-text（36 个节点都有名字，且中文非空）。
  assert.equal(Object.keys(campaignFlowExtras.mapNodeNames).length, 36)
  for (const id of TSK_WORLD_MAP_IDS) {
    assert.equal(campaignFlowExtras.mapNodeNames[id], campaignStoryText(`locations.${id}.name`))
    assert.match(campaignFlowExtras.mapNodeNames[id], CJK, `${id} 地图名不是中文`)
  }
  // manifest 新增字段不被注册期校验拒绝，并与 extras 同一对象（不复制）。
  assert.equal(manifest.worldMapGraph, campaignFlowExtras.worldMapGraph)
  assert.equal(manifest.travelNodes, campaignFlowExtras.travelNodes)
  assert.equal(manifest.mapNodeId, MAP_NODE)
  assert.equal(manifest.flow, TSK_FLOW)
  assert.deepEqual(Object.keys(TSK_FLOW.nodes), [...TSK_FLOW_NODE_ORDER])
  assert.equal(TSK_FLOW_NODE_ORDER.length, 143, 'TSK_FLOW 节点数应保持 P7 的 143')
})

// ---------------------------------------------------------------------------
// ② 真实 hub：首章 → 幕间 I → worldMap → deadHeat
// ---------------------------------------------------------------------------
test('P8 TSK 真实 hub：首章→幕间 I→worldMap，启程候选只含已解锁目的地，hubEmbark 到 deadHeat 进入准备并开局', () => {
  const state = mapReady({ seed: 'p8-hub-embark' })
  assert.equal(state.hubFlow, true)
  assert.equal(state.campaign.flow?.nodeId, MAP_NODE)
  assert.equal(state.campaign.flowStage, 'map')
  assert.equal(state.uiState, 'interlude')
  assert.deepEqual(worldMapState(state), {
    version: 1, current: 'London', visited: ['London'], forcedNode: 'Tunguska',
    // P8 时间统一：序幕引言分支 +2 已并入世界地图时间轴。
    unlocked: ['London', ...INITIAL_UNLOCKED], time: 2,
  })

  // 候选：全部是已解锁目的地 + 队长动作；地图相位不再出现「准备下一关/开始当前关卡」。
  const moves = legalMoves(state, 0)
  const actions = new Set(moves.map(move => move.action))
  assert.ok(actions.has('hubEmbark'))
  assert.ok(!actions.has('hubBeginScenario'), '地图相位不应出现「开始当前关卡」')
  assert.ok(!actions.has('hubDoneSeat'), '地图相位不应出现「准备下一关」')
  assert.ok(!actions.has('hubSelectScenario'), '地图相位不应出现「选择当前关卡」')
  const embarks = moves.filter(move => move.action === 'hubEmbark')
  assert.equal(embarks.length, INITIAL_UNLOCKED.length)
  assert.deepEqual([...new Set(embarks.map(move => move.destination))].sort(), [...INITIAL_UNLOCKED].sort())
  for (const move of embarks) {
    assert.equal(move.expedite, undefined, '未持票时不应有 expedite 候选')
    assert.equal(move.from, 'London')
    // P8 时间统一：序幕引言 +2 已并入世界地图时间轴。
    assert.equal(move.time, 2)
    assert.equal(typeof move.cost, 'number')
    assert.equal(move.cost, travelTimeCost(campaignFlowExtras.worldMapGraph, { from: 'London', to: move.destination }))
    assert.match(move.label, /^启程：.+（耗时 \d+ 时间）$/, `label 格式不符：${move.label}`)
    assert.match(move.label, CJK)
  }
  // 未解锁节点不可选（Tunguska 要等 β 状况报告；Kabul 要等 ζ；HongKong 要等 ψ）。
  for (const locked of ['Tunguska', 'Kabul', 'HongKong', 'KualaLumpur', 'Manokwari']) {
    assert.ok(!embarks.some(move => move.destination === locked), `${locked} 未解锁却出现在候选里`)
  }
  // 观察投影：地图目的地与 canEmbark 只在 map + interlude 出现。
  const view = mechanicView(state, 0)
  assert.equal(view?.tsk?.map?.canEmbark, true)
  assert.equal(view?.tsk?.map?.phase, 'embark')
  assert.equal(view?.tsk?.map?.current, 'London')
  assert.equal(view?.tsk?.map?.destinations.length, 36)
  const projected = view.tsk.map.destinations.find(item => item.destination === 'Marrakesh')
  assert.deepEqual(Object.keys(projected).sort(), ['cost', 'destination', 'forcedBlocked', 'name', 'sideStory', 'unlocked'])
  assert.equal(projected.name, '马拉喀什')
  assert.equal(projected.cost, 1)
  assert.equal(projected.unlocked, true)
  assert.equal(projected.sideStory, false)
  assert.equal(projected.forcedBlocked, false)
  // 观察投影（大厅 HTTP 读点）与 mechanicView 同源。
  const observation = viewState(state, 0)
  assert.equal(observation.mechanics?.tsk?.map?.canEmbark, true)
  assert.equal(observation.mechanics?.tsk?.map?.destinations.length, 36)
  assert.equal(observation.mechanics.tsk.map.destinations.find(item => item.destination === 'Marrakesh').name, '马拉喀什')

  // 提交 Marrakesh：London → 马拉喀什 耗时 1；进入 deadHeat 准备窗口。
  const move = embark(state, 'Marrakesh')
  assert.equal(move.cost, 1)
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flowStage, 'scenario')
  assert.equal(state.campaign.flow?.nodeId, 'deadHeat')
  assert.equal(state.hubSelectedScenarioId, 'deadHeat')
  assert.equal(state.hubReady, false)
  assert.equal(state.campaign.records.currentLocation, 'Marrakesh')
  assert.equal(state.campaign.records.time, 3)
  assert.deepEqual(state.campaign.records.mapVisitedLocations, ['London', 'Marrakesh'])
  assert.equal(state.campaign.tsk.map.current, 'Marrakesh')
  assert.equal(state.campaign.tsk.map.time, 3)
  assert.equal(worldMapState(state).time, 3)
  assert.equal(mechanicView(state, 0)?.tsk?.map?.canEmbark, undefined, '章节准备窗口不应标 canEmbark')

  // 准备 → 开始关卡：真实 startScenario 进入死亡酷暑。
  confirmAndBegin(state)
  assert.equal(state.scenario.id, 'deadHeat')
  assert.equal(state.uiState, 'inScenario')

  // 结束本章（resolution1，带 time +1 的章节记录）→ hubContinue 回 map。
  const result = finishChapter(state)
  assert.equal(result.scenarioId, 'deadHeat')
  assert.equal(result.resolution, 'resolution1')
  assert.equal(atMap(state), true)
  assert.equal(state.campaign.records.currentLocation, 'Marrakesh')
  assert.ok(state.campaign.records.chaptersCompleted.includes('deadHeat'))
  // 回到 map 后仍可继续启程（真实闭环）。
  assert.ok(legalMoves(state, 0).some(candidate => candidate.action === 'hubEmbark'))
})

// ---------------------------------------------------------------------------
// ③ 多航线
// ---------------------------------------------------------------------------
test('P8 TSK 多航线：London→马拉喀什→布宜诺斯艾利斯、London→君士坦丁堡→哈瓦那、绿地支线停留均进入章节并回到 map', () => {
  // 航线 A：London → 马拉喀什（deadHeat）→ 布宜诺斯艾利斯（sanguineShadows）。
  const routeA = mapReady({ seed: 'p8-route-a' })
  const a1 = runChapter(routeA, 'Marrakesh')
  assert.equal(a1.scenarioId, 'deadHeat')
  const a2 = runChapter(routeA, 'BuenosAires')
  assert.equal(a2.scenarioId, 'sanguineShadows')
  assert.deepEqual(routeA.campaign.records.chaptersCompleted, ['riddlesAndRain', 'deadHeat', 'sanguineShadows'])
  assert.deepEqual(routeA.campaign.records.mapVisitedLocations.slice(-2), ['Marrakesh', 'BuenosAires'])
  assert.equal(routeA.campaign.tsk.map.current, 'BuenosAires')
  assert.ok(routeA.campaign.tsk.map.time >= 4, '跨洲航线的耗时没有累计到地图时间')

  // 航线 B：London → 君士坦丁堡（dealingsInTheDark）→ 哈瓦那（dancingMad）。
  const routeB = mapReady({ seed: 'p8-route-b' })
  const b1 = runChapter(routeB, 'Constantinople')
  assert.equal(b1.scenarioId, 'dealingsInTheDark')
  const b2 = runChapter(routeB, 'Havana')
  assert.equal(b2.scenarioId, 'dancingMad')
  assert.deepEqual(routeB.campaign.records.chaptersCompleted, ['riddlesAndRain', 'dealingsInTheDark', 'dancingMad'])
  assert.equal(routeB.campaign.tsk.map.current, 'Havana')

  // 航线 C：London → 卡伊罗（绿地支线，不开始章节，直接回 map）→ 君士坦丁堡章节。
  const routeC = mapReady({ seed: 'p8-route-c' })
  embark(routeC, 'Cairo')
  assert.equal(atMap(routeC), true, '绿地支线应直接回到世界地图')
  assert.equal(routeC.campaign.records.currentLocation, 'Cairo')
  assert.ok(routeC.campaign.records.sideStoriesCompleted.includes('Cairo'))
  assert.ok(routeC.campaign.flow.history.some(visit => visit.nodeId === 'sideStory'))
  assert.equal(routeC.campaign.tsk.map.current, 'Cairo')
  assert.ok(routeC.campaign.tsk.map.time >= 1)
  const c = runChapter(routeC, 'Constantinople')
  assert.equal(c.scenarioId, 'dealingsInTheDark')
  assert.equal(atMap(routeC), true)
})

// ---------------------------------------------------------------------------
// ④ 时间阈值 / 状况报告 / 强制终章 / 尾声
// ---------------------------------------------------------------------------
test('P8 TSK 状况报告与终局：hubAdvanceReport 结算 α/ε 后回 map；时间满 35 只给通古斯卡→钥匙议会→尾声', () => {
  const state = mapReady({ seed: 'p8-reports-endgame' })

  // 时间 9 → 莫斯科（真实幕间 26，消耗 1 时间）→ 时间 10 跨过 α(7)/ε(10)。
  setTime(state, 9)
  embark(state, 'Moscow')
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow?.nodeId, 'interlude26')
  // 幕间 26：座位确认 + 分支选择（ticket 分支，取得快捷旅票）。
  for (let guard = 0; guard < 20 && !atMap(state); guard += 1) {
    settle(state)
    if (atMap(state)) break
    const seat = actingSeats(state)[0]
    const moves = legalMoves(state, seat)
    const move = moves.find(item => item.action === 'hubDoneSeat') || moves.find(item => item.action === 'hubSelectInvestigator') || moves[0]
    assert.ok(move, `幕间 26 卡住：${moves.map(item => item.action).join(',')}`)
    act(state, seat, move)
  }
  assert.equal(atMap(state), true)
  assert.equal(state.campaign.records.expeditedTickets, 1, '幕间 26 的 ticket 分支应发放快捷旅票')
  assert.deepEqual(reportPending(state), ['alpha', 'epsilon'])

  // 待处理报告优先：旅行候选置灰并说明原因。
  let moves = legalMoves(state, 0)
  const reportMove = moves.find(move => move.action === 'hubAdvanceReport')
  assert.equal(reportMove.report, 'alpha')
  assert.match(reportMove.label, /阅读状况报告 α/)
  const blocked = moves.filter(move => move.action === 'hubEmbark')
  assert.ok(blocked.length > 0)
  for (const move of blocked) {
    assert.equal(move.disabled, true, '先结算状况报告时旅行候选应置灰')
    assert.match(String(move.explanation), /状况报告/)
  }
  // 置灰候选即便提交也不能跳过报告结算（dispatch 侧再校验一次）。
  assert.throws(() => applyMove(state, 0, plainMove(blocked[0])), /状况报告/)
  assert.deepEqual(reportPending(state), ['alpha', 'epsilon'], '被拒绝的启程不应改动报告队列')

  // α：混乱袋 +1 [cultist]，回到 map；仍有 ε。
  const beforeCultists = cultistCount(state)
  act(state, 0, reportMove)
  assert.equal(atMap(state), true)
  assert.deepEqual(state.campaign.records.statusReportsSeen, ['alpha'])
  assert.equal(reportPending(state)[0], 'epsilon')
  assert.equal(cultistCount(state), beforeCultists + 1)

  // ε：红色同志会开始注入（记录/正文），回到 map 后无待处理报告。
  const epsilonMove = findMove(state, 0, 'hubAdvanceReport')
  assert.equal(epsilonMove.report, 'epsilon')
  assert.match(epsilonMove.label, /阅读状况报告 ε/)
  act(state, 0, epsilonMove)
  assert.equal(atMap(state), true)
  assert.deepEqual(state.campaign.records.statusReportsSeen, ['alpha', 'epsilon'])
  assert.deepEqual(reportPending(state), [])
  assert.equal(state.campaign.records.statusReportsRead, 2)
  // 报告清算后可继续启程。
  assert.ok(legalMoves(state, 0).some(move => move.action === 'hubEmbark' && !move.disabled))

  // 时间 34 → 旅行（≥1 时间）跨 35：参考 Helpers.hs#markTime，旅行结算后立即重定向到通古斯卡，
  // 并先结算达标报告（Ω），同一动作内进入强制终章准备窗口（不再先跑 Constantinople）。
  setTime(state, 34)
  embark(state, 'Constantinople')
  assert.ok(state.campaign.tsk.map.time >= TSK_FORCED_ENDGAME_TIME)
  assert.equal(state.campaign.tsk.map.current, 'Tunguska', '跨过 35 后地图当前节点应被强制改到通古斯卡')
  assert.equal(state.campaign.records.currentLocation, 'Tunguska')
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.flow?.nodeId, TSK_ENDGAME_STEP)
  assert.equal(state.hubSelectedScenarioId, TSK_ENDGAME_STEP)
  assert.equal(state.campaign.records.tskEndgameForced, true)
  assert.deepEqual(reportPending(state), [], 'Ω 等达标报告应在强制启程同一动作内结算')
  assert.ok((state.campaign.records.statusReportsSeen || []).includes('omega'), 'Ω 报告应记为已读')

  confirmAndBegin(state)
  assert.equal(state.scenario.id, TSK_ENDGAME_STEP)
  // 钥匙议会：resolution2（特别小组成为空洞）不触发 addTrauma，走真实结算 → 尾声 → 结束。
  act(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'resolution2' })
  assert.equal(state.uiState, 'scenarioResult')
  act(state, 0, findMove(state, 0, 'hubContinue'))
  assert.equal(state.status, 'over')
  assert.equal(state.uiState, 'campaignResult')
  const nodeIds = state.campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(nodeIds.includes('endgameApproach'), '强制终章应经过 endgameApproach')
  assert.ok(nodeIds.includes('epilogue'), '终章后应进入尾声')
  assert.ok(nodeIds.includes('end'), '尾声后应到达 end')
  assert.ok(String(state.campaign.records.campaignOutcome || '').length > 0, '尾声未写最终结局记录')
})

// ---------------------------------------------------------------------------
// ⑤ 四档难度
// ---------------------------------------------------------------------------
test('P8 TSK 四档难度：easy/standard/hard/expert 的 worldMap→章节准备各跑一次', () => {
  const bags = []
  for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
    const state = mapReady({ seed: `p8-difficulty-${difficulty}`, difficulty })
    assert.equal(state.difficulty, difficulty)
    const move = embark(state, 'Marrakesh')
    assert.equal(move.cost, 1)
    assert.equal(state.uiState, 'scenarioSetup')
    assert.equal(state.hubSelectedScenarioId, 'deadHeat')
    assert.equal(state.campaign.flow?.nodeId, 'deadHeat')
    assert.equal(state.campaign.records.time, 3)
    assert.deepEqual(state.campaign.tsk.map.visited, ['London', 'Marrakesh'])
    // 开始关卡后混乱袋按难度初始化（TSK 四档：16/16/17/18）。
    confirmAndBegin(state)
    assert.equal(state.scenario.id, 'deadHeat')
    assert.equal(state.chaosBag.length, CHAOS_BAGS[difficulty].length, `${difficulty} 混乱袋张数不符`)
    bags.push(state.chaosBag.length)
  }
  assert.deepEqual(bags, [CHAOS_BAGS.easy.length, CHAOS_BAGS.standard.length,
    CHAOS_BAGS.hard.length, CHAOS_BAGS.expert.length])
})

// ---------------------------------------------------------------------------
// ⑥ 记录标签 + JSON 往返
// ---------------------------------------------------------------------------
test('P8 TSK 记录标签与 JSON 往返：中英记录标签一致可读，JSON.parse(JSON.stringify(state)) 后继续 hubEmbark', () => {
  // 中文标签：flow 记录的显式中文；官方 Campaign Log 键取 story-text 的中文。
  assert.equal(TSK_RECORD_LABELS.time, '时间')
  assert.equal(TSK_RECORD_LABELS.currentLocation, '当前位置')
  for (const [key, label] of Object.entries(TSK_RECORD_LABELS)) {
    assert.ok(String(label).length > 0, `${key} 标签为空`)
    assert.equal(typeof label, 'string')
  }
  assert.match(TSK_RECORD_LABELS.theCellToldTheTruthToTaylor, CJK)
  // 英文标签：story-text 的 en 键（官方 Campaign Log 标签）；recordLabel 优先中文。
  assert.equal(recordLabel('time'), '时间')
  assert.match(TSK_STORY_KEYS.key.en.time, /^Time$/i)
  // 流程层自有键没有印刷中文标签：flow 显式补中文，records 回退英文（不冒充官方中文）。
  assert.equal(TSK_RECORD_LABELS.expeditedTickets, '快捷旅票')
  assert.equal(recordLabel('expeditedTickets'), 'Expedited tickets')
  assert.match(TSK_STORY_KEYS.key.en.theCellToldTheTruthToTaylor, /truth/i)
  assert.match(TSK_STORY_KEYS.key.zh.theCellToldTheTruthToTaylor, CJK)
  assert.ok(Object.keys(TSK_RECORD_SCHEMA).every(key => ['boolean', 'number', 'string', 'string[]'].includes(TSK_RECORD_SCHEMA[key])))

  const state = mapReady({ seed: 'p8-json-roundtrip' })
  const clone = JSON.parse(JSON.stringify(state))
  assert.deepEqual(clone.campaign.flow, state.campaign.flow)
  assert.equal(clone.campaign.flow.nodeId, MAP_NODE)
  assert.deepEqual(clone.campaign.records, state.campaign.records)
  assert.deepEqual(clone.campaign.tsk.map, state.campaign.tsk.map)
  // JSON 往返后的状态仍能继续真实启程（本地图/记录/清单全部是纯数据）。
  const move = legalMoves(clone, 0).find(item => item.action === 'hubEmbark' && item.destination === 'Marrakesh')
  assert.ok(move, '往返后没有启程候选')
  applyMove(clone, 0, plainMove(move))
  settle(clone)
  assert.equal(clone.uiState, 'scenarioSetup')
  assert.equal(clone.hubSelectedScenarioId, 'deadHeat')
  assert.equal(clone.campaign.records.currentLocation, 'Marrakesh')
  assert.equal(clone.campaign.records.time, 3)
  assert.deepEqual(clone.campaign.tsk.map.visited, ['London', 'Marrakesh'])
})

// ---------------------------------------------------------------------------
// 权限边界（房主决定启程）
// ---------------------------------------------------------------------------
test('P8 TSK 权限边界：启程候选只给房主，非房主提交被拒绝且不写状态', () => {
  const state = mapReady({
    seed: 'p8-permissions',
    players: [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }],
  })
  assert.equal(atMap(state), true)
  assert.deepEqual(legalMoves(state, 1), [], '非房主不应获得启程/报告候选')
  const hostMove = legalMoves(state, 0).find(move => move.action === 'hubEmbark')
  assert.ok(hostMove)
  const before = JSON.stringify({ records: state.campaign.records, map: state.campaign.tsk.map })
  assert.throws(() => applyMove(state, 1, plainMove(hostMove)), /局外操作|不是/)
  assert.throws(() => applyMove(state, 0, { action: 'hubEmbark', destination: 'Kabul' }), /局外操作|不可执行|未解锁/)
  assert.equal(JSON.stringify({ records: state.campaign.records, map: state.campaign.tsk.map }), before,
    '被拒绝的启程不应改动地图/记录')
  // 房主仍可正常启程。
  embark(state, 'Marrakesh')
  assert.equal(state.uiState, 'scenarioSetup')
  assert.equal(state.campaign.tsk.map.current, 'Marrakesh')
})

// ---------------------------------------------------------------------------
// ⑦ 失败/撤退 + 快捷旅票
// ---------------------------------------------------------------------------
test('P8 TSK 失败/撤退与快捷旅票：noResolution 回 map 可继续；幕间 26 取票后 expedite 直达未解锁节点', () => {
  const state = mapReady({ seed: 'p8-failure-ticket' })

  // 失败/撤退：君士坦丁堡 noResolution（不触发内容层的 addTrauma 分支），仍回 map 并可继续。
  embark(state, 'Constantinople')
  confirmAndBegin(state)
  const failed = finishChapter(state, { resolution: 'noResolution' })
  assert.equal(failed.scenarioId, 'dealingsInTheDark')
  assert.equal(failed.resolution, 'noResolution')
  assert.equal(atMap(state), true)
  assert.ok(state.campaign.scenarioResults.some(result => result.resolution === 'noResolution'))
  assert.ok(legalMoves(state, 0).some(move => move.action === 'hubEmbark'), '失败结算后不能继续启程')

  // 幕间 26（莫斯科）拿快捷旅票：真实路线（ticket 分支 → 加入战役牌组 + expeditedTickets 记录）。
  const beforeTime = state.campaign.tsk.map.time
  embark(state, 'Moscow')
  assert.equal(state.campaign.flow?.nodeId, 'interlude26')
  for (let guard = 0; guard < 20 && !atMap(state); guard += 1) {
    settle(state)
    if (atMap(state)) break
    const seat = actingSeats(state)[0]
    const moves = legalMoves(state, seat)
    const move = moves.find(item => item.action === 'hubDoneSeat') || moves[0]
    act(state, seat, move)
  }
  assert.equal(atMap(state), true)
  assert.equal(state.campaign.records.expeditedTickets, 1)
  const record = state.campaign.investigators[0]
  assert.ok(record.deck.includes('09765'), '快捷旅票应加入持票人的战役牌组')
  // 时间成本（Moscow 的旅行耗时）已记进地图。
  assert.ok(state.campaign.tsk.map.time > beforeTime)

  // 未持票前 Kabul 未解锁：正常候选里没有；持票后 expedite 候选可以直达。
  const moves = legalMoves(state, 0)
  const normalDestinations = moves.filter(move => move.action === 'hubEmbark' && !move.expedite).map(move => move.destination)
  const expediteMoves = moves.filter(move => move.action === 'hubEmbark' && move.expedite)
  assert.ok(!normalDestinations.includes('Kabul'), 'Kabul 未解锁却出现在普通启程候选')
  const kabul = expediteMoves.find(move => move.destination === 'Kabul')
  assert.ok(kabul, '快捷旅票应能直达未解锁的 Kabul')
  assert.equal(kabul.cost, 1)
  assert.match(kabul.label, /快捷旅票·1 时间/)
  assert.ok(expediteMoves.some(move => move.destination === 'HongKong'), '快捷旅票应能直达其他未解锁节点')

  const timeBeforeTicket = state.campaign.tsk.map.time
  act(state, 0, kabul)
  assert.equal(state.uiState, 'interlude')
  assert.equal(state.campaign.flow?.nodeId, 'interlude14')
  assert.equal(state.campaign.tsk.map.current, 'Kabul')
  assert.equal(state.campaign.tsk.map.time, timeBeforeTicket + 1)
  assert.equal(state.campaign.records.time, timeBeforeTicket + 1)
  assert.equal(state.campaign.records.currentLocation, 'Kabul')
  assert.deepEqual(state.campaign.records.mapVisitedLocations.slice(-1), ['Kabul'])
  assert.ok(state.campaign.tsk.map.unlocked.includes('Kabul'), '快捷旅票应解锁到访地点')
  // 放逐：战役牌组的票被移除、记录计数递减、removedCards 留痕。
  assert.equal(state.campaign.records.expeditedTickets, 0)
  assert.ok(!state.campaign.investigators[0].deck.includes('09765'))
  assert.ok(state.campaign.investigators[0].removedCards.some(entry => entry.code === '09765'))
  // 幕间 14 继续回 map（真实 continuousInterlude 子图 + 分支选择）。
  for (let guard = 0; guard < 20 && !atMap(state); guard += 1) {
    settle(state)
    if (atMap(state)) break
    const seat = actingSeats(state)[0]
    const moves = legalMoves(state, seat)
    const move = moves.find(item => item.action === 'hubDoneSeat') || moves[0]
    act(state, seat, move)
  }
  assert.equal(atMap(state), true)
  assert.ok(state.campaign.records.interludeVisits.includes('interlude14'))
})
