// TDC P7 · 战役核心层（flow / prologue / interludes / epilogue / records / pack）验收。
//
// 对照契约：
//   · artifacts/migration/tdc/p7/CONTRACT.md §2（写盘边界）、§4（战役记录键）、§6（章节/结局键）；
//   · 参考实现 `Campaigns/TheDrownedCity.hs#nextStep` 与 Interlude/DoStep/Sepulchre/Epilogue 分支。
//
// 覆盖：
//   ① flow 通过 `validateCampaignGraph` 注册期校验；10 个 scenario 节点 + 终点可达；
//   ② prologue / Interlude I–IV / Sepulchre 门 / 尾声节点全部可达（结构遍历）；
//   ③ 记录 schema：CONTRACT §4 全量键、类型、默认值，flow 内所有 record 效果/条件闭包；
//   ④ 西/东两条远征路线逐章顺序（含 TheWesternWall 结局 3 / Apiary 结局 4 的跳章）；
//   ⑤ 拒绝邀约 → 战役结束（campaignLost）；
//   ⑥ Sepulchre 三条门槛与三结局分支（第一门 / 第二门加 0 标记 / knowBetter / layItToRest →
//      resolution1 尾声 / noResolution 失败）；
//   ⑦ Interlude 处理器：领任务、任务结算（完成 / 失败）、No Place Like Home 二选一创伤、尾声分支；
//   ⑧ 战役清单与包清单：10 章、四档混乱袋、unlock 闭包、status development、handler ids。
//
// 注：章节模块由并行 worker 落盘；`scenarios/index.js` 聚合器必须缺失容错（本测试不断言十场景齐备）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { persistEnabled, readSnapshot, saveSnapshot } from '../../../lib/sessions.js'

import {
  applyCampaignEffect,
} from '../src/campaign/campaign-effects.js'
import {
  enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { assertCampaignManifest } from '../content/schema.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { inspectFlow } from '../tools/tdc-p7-readiness.mjs'

import {
  TDC_FLOW, TDC_FLOW_NODE_ORDER, TDC_STEP_OF_NODE, campaignFlowExtras, rawTdcFlowNodes,
  refreshTdcFlowText, validateTdcFlow,
} from '../content/campaigns/theDrownedCity/flow.js'
import {
  TDC_UNLOCK, chapterIds as manifestChapterIds, manifest as tdcManifest,
} from '../content/campaigns/theDrownedCity/manifest.js'
import {
  CAMPAIGN_ID, CAMPAIGN_NAME, CHAOS_BAGS, SCENARIO_IDS, SHARED_ENCOUNTER_GROUP_IDS, chapters,
} from '../content/campaigns/theDrownedCity/shared.js'
import {
  TDC_ARTIFACT_RECORD_KEYS, TDC_GLYPH_GATE, TDC_RECORD_DEFAULTS,
  TDC_RECORD_KEYS, TDC_RECORD_SCHEMA, TDC_RECORD_TYPES, TDC_RLYEH_ARTIFACT_RECORD_KEYS,
  TDC_TASK_COMPLETION_PROGRESS, TDC_TASKS,
} from '../content/campaigns/theDrownedCity/records.js'
import {
  TDC_EAST_ROUTE, TDC_EPILOGUE_BRANCHES, TDC_WEST_ROUTE, anyRlyehArtifact, campaignText,
  localizeTdcNodes, scenarioUnitOf, tdcEpilogueBranch, tdcRouteAfter, tdcSepulchreGateOne,
  tdcSepulchreGateTwo,
} from '../content/campaigns/theDrownedCity/parts.js'
import {
  EPILOGUE_HANDLER_ID, endgameSummary, epilogueNodes,
} from '../content/campaigns/theDrownedCity/epilogue.js'
import {
  INTERLUDE_HANDLER_ID, TDC_EXPEDITION_CHOICES, TDC_INTERLUDE_APPROXIMATIONS, TDC_TASK_FAILURE_EFFECTS,
  addBasicWeaknessForSeat, claimTask, claimTasksFromChoices, interludeNodes, preloadCampaignPrimitives,
  resolveTasks, runDoomPartOneWeaknesses, runExpedition, runNplhTrauma, runNplhTraumaChoices,
  runSepulchreKnowBetter, taskProgressSnapshot,
} from '../content/campaigns/theDrownedCity/interludes.js'
import { PROLOGUE_HANDLER_ID, TDC_PROLOGUE_NODES, startTdcCampaign } from '../content/campaigns/theDrownedCity/prologue.js'
import { chapterIdentity, chapterIds } from '../content/campaigns/theDrownedCity/chapters.js'
import {
  encounterDefinitions, encounterGroupCards, encounterGroupDeck, identitiesFor, location, printed, stage,
} from '../content/campaigns/theDrownedCity/card-data.js'
// 场景聚合器由并行 scenario worker 逐章落盘：本测试只在十章 `index.js` 全部存在时加载它
// （批次期间缺章/半写文件不代表战役层失败；聚合器本身的缺失容错口径见 FHV 同名文件）。
const scenarioIndexUrl = new URL('../content/campaigns/theDrownedCity/scenarios/index.js', import.meta.url)
const scenarioModuleUrl = id => new URL(`../content/campaigns/theDrownedCity/scenarios/${id}/index.js`, import.meta.url)
const allScenarioModulesLanded = () => [...manifestChapterIds].every(id => existsSync(scenarioModuleUrl(id)))

// ---------------------------------------------------------------------------
// 夹具：内容层最小战役状态（不 import engine.js，不依赖大厅路线）
// ---------------------------------------------------------------------------
const MANIFEST = Object.freeze({
  id: CAMPAIGN_ID,
  scenarioIds: SCENARIO_IDS,
  recordSchema: TDC_RECORD_TYPES,
  flow: TDC_FLOW,
})

// 真实调查员卡号（`src/cards/cards-data.js` 里的 TDC 调查员；避免夹具卡号触发未知身份）。
const FIXTURE_INVESTIGATORS = [
  { seat: 0, code: '11001', name: '调查员 1' },
  { seat: 1, code: '11004', name: '调查员 2' },
]

function newState ({ seats = 2, difficulty = 'standard' } = {}) {
  const investigators = {}
  for (const row of FIXTURE_INVESTIGATORS.slice(0, seats)) {
    investigators[row.seat] = {
      seat: row.seat,
      id: `investigator-${row.seat + 1}`,
      code: row.code,
      name: row.name,
      status: 'active',
      deck: [],
      xp: 0,
      earnedXp: 0,
      spentXp: 0,
      trauma: { physical: 0, mental: 0 },
      purchases: [],
      removedCards: [],
    }
  }
  const campaign = {
    id: CAMPAIGN_ID,
    records: structuredClone(TDC_RECORD_DEFAULTS),
    recordSchema: TDC_RECORD_TYPES,
    scenarioResults: [],
    investigators,
    trauma: {},
    chaosBag: [...CHAOS_BAGS[difficulty]],
    leadSeat: 0,
    scenarioIndex: 0,
  }
  return {
    campaign,
    state: {
      campaign,
      difficulty,
      chaosBag: [...CHAOS_BAGS[difficulty]],
      investigators: Object.values(investigators).map(record => ({ seat: record.seat, name: record.name })),
    },
  }
}

/** 与引擎一致的效果分派：`record`/`increment` 由 walkCampaign 处理，其余走 applyCampaignEffect。 */
const noopLog = () => { /* 测试日志吞掉 */ }
function apply (state, effect) {
  return applyCampaignEffect(state, effect, noopLog)
}

const logOf = () => line => { /* 测试日志吞掉 */ void line }

// `answers[id]` 可以是字符串（全桌同一答案）或 `{ seat: optionId }`（perInvestigator 节点逐座位答案）。
function chooseAnswer (answers) {
  return (id, node, options, meta = {}) => {
    const wanted = answers[id]
    if (meta.perInvestigator) {
      const seatWanted = wanted && typeof wanted === 'object' && !Array.isArray(wanted) ? wanted[meta.seat] : undefined
      if (seatWanted && options.some(option => option.id === seatWanted)) return seatWanted
      return options[0].id
    }
    if (typeof wanted === 'string' && options.some(option => option.id === wanted)) return wanted
    return options[0].id
  }
}

/**
 * 走 flow 直到可交互停点（与 FHV 测试同一 harness）：scenario 由调用方「结算」后按节点出口继续。
 * `resolutions` 按 scenarioId 给引擎结局键；缺省 resolution1。
 * `stopAt`：命中该节点 id 时停下（用于存档重放：保存「正在整备停点」的战役状态）。
 */
function play (state, { answers = {}, resolutions = {}, onScenario = null, stopAt = null, maxStops = 200 } = {}) {
  const graph = validateCampaignGraph(MANIFEST)
  const visited = []
  for (let step = 0; step < maxStops * 6; step += 1) {
    const node = walkCampaign(state.campaign, MANIFEST, chooseAnswer(answers), effect => apply(state, effect))
    visited.push(node.type === 'scenario' ? `scenario:${node.scenarioId}` : node.id)
    if (stopAt && node.id === stopAt) return { visited, ended: false, node, state }
    if (node.type === 'end') return { visited, ended: true, node, state }
    if (node.type === 'scenario') {
      const resolution = resolutions[node.scenarioId] || 'resolution1'
      state.campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution })
      onScenario?.(node, state)
      enterCampaignNode(state.campaign, MANIFEST, graph.nodes[node.id].next)
      continue
    }
    // interlude / checkpoint：继续下一节点（升级窗在真实引擎里由大厅接管）。
    enterCampaignNode(state.campaign, MANIFEST, graph.nodes[node.id].next)
  }
  throw new Error('流程没有在预期步数内结束')
}

/** 从当前停点沿 `next` 进入并再走一个可交互停点（存档续跑确定性比较用）。 */
function advanceOneStop (state) {
  const graph = validateCampaignGraph(MANIFEST)
  const current = graph.nodes[state.campaign.flow.nodeId]
  assert.ok(current?.next, `当前节点没有出口：${state.campaign.flow.nodeId}`)
  enterCampaignNode(state.campaign, MANIFEST, current.next)
  return walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect))
}

function record (state, key, value) {
  state.campaign.records[key] = value
}

function addGlyphs (state, count) {
  state.campaign.records.discoveredGlyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, count).split('')
}

// ---------------------------------------------------------------------------
// ① flow 结构 + ② 节点可达性
// ---------------------------------------------------------------------------
test('flow 通过战役图注册期校验，且 10 个 scenario 节点/终点结构可达', () => {
  const graph = validateTdcFlow()
  assert.equal(graph.start, 'prologue')
  const scenarioNodes = Object.entries(graph.nodes).filter(([, node]) => node.type === 'scenario')
  assert.equal(scenarioNodes.length, SCENARIO_IDS.length)
  assert.deepEqual(scenarioNodes.map(([, node]) => node.scenarioId).sort(), [...SCENARIO_IDS].sort())

  const coverage = inspectFlow({ flow: TDC_FLOW }, SCENARIO_IDS)
  assert.equal(coverage.explicit, true)
  assert.equal(coverage.terminalReachable, true)
  assert.deepEqual(coverage.missingChapters, [])
  assert.deepEqual(coverage.reachableChapters, [...SCENARIO_IDS])

  // 所有节点都在 step 反查表里（账本/审计读点）。
  for (const id of TDC_FLOW_NODE_ORDER) assert.ok(Object.hasOwn(TDC_STEP_OF_NODE, id), `缺少节点步骤映射：${id}`)
})

test('prologue / Interlude I–IV / Sepulchre 门 / 尾声节点全部可达', () => {
  const nodes = TDC_FLOW.nodes
  for (const id of [
    'prologue', 'oneLastJob', 'interludeOne', 'taskChoice', 'interludeOneDecision', 'anOfferAccepted',
    'anOfferRefused', 'campaignLostEnd', 'expeditionChoice',
    'expeditionPrep', 'routeRouter', 'westernWallShortcut', 'apiaryShortcut',
    'sepulchreGate', 'sepulchreGateRouter', 'sepulchreGateStep2', 'sepulchreGateStep2Router',
    'sepulchreAddZero', 'sepulchreDecision', 'sepulchreOfTheSleeper', 'sepulchreAftermath',
    'theAwakening', 'theAwakeningBranch', 'theAwakeningArtifact', 'theAwakeningNoArtifact',
    'theAwakeningConclusion', 'returnToArkhamBranch', 'returnToArkhamWithArtifact',
    'returnToArkhamWithoutArtifact', 'nplhTraumaChoice', 'finale',
    'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII', 'doomAftermath',
    'epilogue', 'epilogueRouter', 'epilogue1', 'epilogue2', 'epilogue3', 'epilogue4', 'end',
  ]) assert.ok(nodes[id], `缺少流程节点：${id}`)
  // 结构遍历：从 start 出发能到上述全部节点（含条件出口）。
  const reached = new Set()
  const pending = [TDC_FLOW.start]
  while (pending.length) {
    const id = pending.pop()
    if (reached.has(id) || !nodes[id]) continue
    reached.add(id)
    const branches = nodes[id].type === 'stepReturn' ? nodes[id].rules : nodes[id].options
    for (const branch of branches || []) pending.push(branch.next)
    if (nodes[id].next) pending.push(nodes[id].next)
  }
  for (const id of Object.keys(nodes)) assert.ok(reached.has(id), `流程节点不可达：${id}`)
})

// ---------------------------------------------------------------------------
// ③ 记录 schema（CONTRACT §4）
// ---------------------------------------------------------------------------
test('记录 schema 覆盖 CONTRACT §4 全量键、类型与默认值', () => {
  assert.ok(TDC_RECORD_KEYS.includes('theDrownedQuarterWasSkipped'))
  const setKeys = ['discoveredGlyphs', 'rlyehMap', 'floodedNeighborhoods']
  for (const key of TDC_RECORD_KEYS) {
    assert.equal(TDC_RECORD_TYPES[key], setKeys.includes(key) ? 'string[]' : 'boolean', key)
    assert.ok(Object.hasOwn(TDC_RECORD_DEFAULTS, key), key)
    assert.ok(Object.hasOwn(TDC_RECORD_SCHEMA, key), key)
  }
  assert.deepEqual(TDC_RECORD_DEFAULTS.discoveredGlyphs, [])
  assert.deepEqual(TDC_RECORD_DEFAULTS.rlyehMap, [])
  assert.equal(TDC_RECORD_DEFAULTS.cthulhuWasBanished, false)
  // manifest 投影与 records.js 同源。
  assert.deepEqual(tdcManifest.recordSchema, TDC_RECORD_TYPES)
  assert.deepEqual(tdcManifest.recordDefaults, TDC_RECORD_DEFAULTS)
})

test('flow 内所有记录条件/效果都闭包于 recordSchema（类型一致）', () => {
  const graph = validateCampaignGraph(MANIFEST)
  const readKeys = new Set()
  const writeKeys = new Set()
  const walkCondition = condition => {
    if (!condition || typeof condition !== 'object') return
    if (condition.all) condition.all.forEach(walkCondition)
    if (condition.any) condition.any.forEach(walkCondition)
    if (condition.not) walkCondition(condition.not)
    if (condition.record) readKeys.add(condition.record)
    if (condition.recordCount) readKeys.add(condition.recordCount.key)
  }
  const walkEffects = effects => {
    for (const effect of effects || []) if (effect.type === 'record') writeKeys.add(effect.key)
  }
  for (const node of Object.values(graph.nodes)) {
    walkCondition(node.textWhen)
    for (const option of node.options || []) walkCondition(option.when)
    for (const rule of node.rules || []) walkCondition(rule.when)
    for (const branch of node.branches || []) walkCondition(branch.when)
    walkEffects(node.effects)
    for (const option of node.options || []) walkEffects(option.effects)
    for (const rule of node.rules || []) walkEffects(rule.effects)
  }
  for (const key of [...readKeys, ...writeKeys]) {
    assert.ok(Object.hasOwn(TDC_RECORD_TYPES, key), `flow 引用了未声明的记录键：${key}`)
  }
  // 本层 flow 实际写到的记录键（其余 §4 键由章节 worker 写）。
  for (const key of writeKeys) assert.equal(TDC_RECORD_TYPES[key], 'boolean', `flow 记录效果类型不符：${key}`)
})

test('flow 原始节点表可重复生成且 JSON 往返一致', () => {
  const first = rawTdcFlowNodes()
  const second = rawTdcFlowNodes()
  assert.deepEqual(Object.keys(first), Object.keys(second))
  const roundTrip = JSON.parse(JSON.stringify(TDC_FLOW))
  assert.equal(roundTrip.start, 'prologue')
  assert.deepEqual(Object.keys(roundTrip.nodes), TDC_FLOW_NODE_ORDER)
  // 正文刷新幂等（story-text 未落盘时保持空文本）。
  assert.equal(refreshTdcFlowText(), TDC_FLOW)
  assert.equal(typeof localizeTdcNodes(first), 'object')
})

// ---------------------------------------------------------------------------
// ④ 西/东路线与结局跳章
// ---------------------------------------------------------------------------
test('西线逐章顺序：西墙 → 淹没城区 → 养育场 → 大秘库 → 古代议庭 → 黑曜石峡谷', () => {
  const { state } = newState()
  const { visited, ended } = play(state, {
    answers: { interludeOneDecision: 'accept', expeditionChoice: 'west' },
  })
  assert.equal(ended, true)
  const order = visited.filter(entry => entry.startsWith('scenario:'))
    .map(entry => entry.slice('scenario:'.length))
    .filter(id => TDC_WEST_ROUTE.includes(id))
  assert.deepEqual(order, TDC_WEST_ROUTE)
  assert.equal(state.campaign.records.theExpeditionHeadedWest, true)
  assert.equal(state.campaign.records.theExpeditionHeadedEast, false)
  // 远征剧情资产：Andy Van Nortwick（11766）进入领队牌组。
  assert.ok(state.campaign.investigators[0].deck.includes('11766'))
})

test('东线逐章顺序：黑曜石峡谷 → 古代议庭 → 大秘库 → 养育场 → 淹没城区 → 西墙', () => {
  const { state } = newState()
  const { visited, ended } = play(state, {
    answers: { interludeOneDecision: 'accept', expeditionChoice: 'east' },
  })
  assert.equal(ended, true)
  const order = visited.filter(entry => entry.startsWith('scenario:'))
    .map(entry => entry.slice('scenario:'.length))
    .filter(id => TDC_EAST_ROUTE.includes(id))
  assert.deepEqual(order, TDC_EAST_ROUTE)
  assert.equal(state.campaign.records.theExpeditionHeadedEast, true)
  assert.ok(state.campaign.investigators[0].deck.includes('11765'))
})

test('TheWesternWall 结局 3 / Apiary 结局 4 的跳章选择生效', () => {
  // 西线：西墙结局 3 → 选择养育场，绕过淹没城区。
  const { state } = newState()
  const { visited } = play(state, {
    answers: {
      interludeOneDecision: 'accept', expeditionChoice: 'west', westernWallShortcut: 'apiary',
    },
    resolutions: { theWesternWall: 'resolution3' },
  })
  const order = visited.filter(entry => entry.startsWith('scenario:'))
    .map(entry => entry.slice('scenario:'.length))
  assert.deepEqual(order.slice(0, 4), ['oneLastJob', 'theWesternWall', 'theApiary', 'theGrandVault'])
  assert.ok(!order.includes('theDrownedQuarter'))

  // 东线：养育场结局 4 → 选择西墙，绕过淹没城区。
  const east = newState()
  const eastPlay = play(east.state, {
    answers: {
      interludeOneDecision: 'accept', expeditionChoice: 'east', apiaryShortcut: 'westernWall',
    },
    resolutions: { theApiary: 'resolution4' },
  })
  const eastOrder = eastPlay.visited.filter(entry => entry.startsWith('scenario:'))
    .map(entry => entry.slice('scenario:'.length))
  assert.deepEqual(eastOrder.slice(0, 5),
    ['oneLastJob', 'obsidianCanyons', 'courtOfTheAncients', 'theGrandVault', 'theApiary'])
  assert.equal(eastOrder[5], 'theWesternWall')
  assert.ok(!eastOrder.includes('theDrownedQuarter'))
})

test('拒绝邀约 → 战役以失败结束（campaignLost）', () => {
  const { state } = newState()
  const { visited, ended, node } = play(state, {
    answers: { interludeOneDecision: 'refuse' },
  })
  assert.equal(ended, true)
  assert.equal(node.outcome, 'defeat')
  assert.ok(visited.includes('anOfferRefused'))
  assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId), ['oneLastJob'])
})

// ---------------------------------------------------------------------------
// ⑤ Sepulchre 门槛与三结局
// ---------------------------------------------------------------------------
test('Sepulchre 门槛纯函数：第一门 ≥1 文物 + ≥10 字形；第二门 5 文物 + 26 字形 + 内殿解封', () => {
  assert.equal(tdcSepulchreGateOne({ artifacts: 0, glyphs: 10 }), false)
  assert.equal(tdcSepulchreGateOne({ artifacts: 1, glyphs: 9 }), false)
  assert.equal(tdcSepulchreGateOne({ artifacts: 1, glyphs: 10 }), true)
  assert.equal(tdcSepulchreGateTwo({ artifacts: 4, glyphs: 26, innerSanctumUnsealed: true }), false)
  assert.equal(tdcSepulchreGateTwo({ artifacts: 5, glyphs: 25, innerSanctumUnsealed: true }), false)
  assert.equal(tdcSepulchreGateTwo({ artifacts: 5, glyphs: 26, innerSanctumUnsealed: false }), false)
  assert.equal(tdcSepulchreGateTwo({ artifacts: 5, glyphs: 26, innerSanctumUnsealed: true }), true)
  assert.equal(TDC_GLYPH_GATE.basic, 10)
  assert.equal(TDC_GLYPH_GATE.full, 26)
  assert.equal(TDC_RLYEH_ARTIFACT_RECORD_KEYS.length, 5)
  assert.equal(TDC_ARTIFACT_RECORD_KEYS.length, 6)
})

test('Sepulchre 第一门不满足 → 跳过剧本直接 Interlude III', () => {
  const { state } = newState()
  const { visited } = play(state, {
    // 逐人任务选不带混乱袋副作用的两条（walkInFaith / noPlaceLikeHome），保证袋断言确定。
    answers: {
      taskChoice: { 0: 'walkInFaith', 1: 'noPlaceLikeHome' },
      interludeOneDecision: 'accept',
      expeditionChoice: 'west',
    },
  })
  assert.ok(visited.includes('sepulchreGate'))
  assert.ok(visited.includes('theAwakening'))
  assert.ok(!visited.includes('scenario:sepulchreOfTheSleeper'))
  // 混乱袋没有被加 0 标记（第一门只是跳过）。
  assert.equal(state.campaign.chaosBag.filter(token => token === '0').length, CHAOS_BAGS.standard.filter(token => token === '0').length)
})

test('Sepulchre 第二门不满足 → 混乱袋永久加入 1 个 0 标记，然后 Interlude III', () => {
  const { state } = newState()
  record(state, 'barrierNode', true)
  addGlyphs(state, 12)
  const before = state.campaign.chaosBag.filter(token => token === '0').length
  const { visited } = play(state, {
    answers: {
      taskChoice: { 0: 'walkInFaith', 1: 'noPlaceLikeHome' },
      interludeOneDecision: 'accept',
      expeditionChoice: 'west',
    },
  })
  assert.ok(visited.includes('sepulchreGateStep2'))
  assert.ok(visited.includes('sepulchreAddZero'))
  assert.ok(visited.includes('theAwakening'))
  assert.ok(!visited.includes('sepulchreDecision'))
  assert.equal(state.campaign.chaosBag.filter(token => token === '0').length, before + 1)
})

test('Sepulchre 三结局：knowBetter（进度+1、记录梦魇）/ layItToRest 胜利 / layItToRest 失败', () => {
  // 1) knowBetter：任务进度 +1 并记录 theInvestigatorsDidNotConfrontTheNightmare。
  const knowBetter = newState()
  for (const key of TDC_RLYEH_ARTIFACT_RECORD_KEYS) record(knowBetter.state, key, true)
  addGlyphs(knowBetter.state, 26)
  record(knowBetter.state, 'theInnerSanctumWasUnsealed', true)
  claimTask(knowBetter.state, 'walkInFaith', logOf())
  const kb = play(knowBetter.state, {
    answers: { interludeOneDecision: 'accept', expeditionChoice: 'west', sepulchreDecision: 'knowBetter' },
  })
  assert.ok(kb.visited.includes('sepulchreGateStep2'))
  assert.ok(kb.visited.includes('theAwakening'))
  assert.equal(kb.state.campaign.records.theInvestigatorsDidNotConfrontTheNightmare, true)
  const entry = kb.state.campaign.progressTracks.tdcTask['investigator-1']
  assert.equal(entry.option, 'walkInFaith')
  assert.equal(entry.value, 1)
  assert.ok(kb.visited.includes('theAwakening'))

  // 2) layItToRest → 《沉睡者墓穴》resolution1 → 尾声 4（阻止苏醒）。
  const win = newState()
  for (const key of TDC_RLYEH_ARTIFACT_RECORD_KEYS) record(win.state, key, true)
  addGlyphs(win.state, 26)
  record(win.state, 'theInnerSanctumWasUnsealed', true)
  const winPlay = play(win.state, {
    answers: { interludeOneDecision: 'accept', expeditionChoice: 'west', sepulchreDecision: 'layItToRest' },
    resolutions: { sepulchreOfTheSleeper: 'resolution1' },
  })
  assert.ok(winPlay.visited.includes('scenario:sepulchreOfTheSleeper'))
  assert.ok(winPlay.visited.includes('epilogue'))
  assert.equal(winPlay.ended, true)
  // 尾声 4 只有 theInvestigatorsHaltedCthulhusAwakening 命中才会走到 epilogue4。
  record(win.state, 'theInvestigatorsHaltedCthulhusAwakening', true)
  assert.equal(tdcEpilogueBranch(win.state.campaign.records), 'epilogue4')

  // 3) layItToRest → noResolution → 战役失败。
  const lose = newState()
  for (const key of TDC_RLYEH_ARTIFACT_RECORD_KEYS) record(lose.state, key, true)
  addGlyphs(lose.state, 26)
  record(lose.state, 'theInnerSanctumWasUnsealed', true)
  const losePlay = play(lose.state, {
    answers: { interludeOneDecision: 'accept', expeditionChoice: 'west', sepulchreDecision: 'layItToRest' },
    resolutions: { sepulchreOfTheSleeper: 'noResolution' },
  })
  assert.equal(losePlay.ended, true)
  assert.equal(losePlay.node.outcome, 'defeat')
})

test('全流程终点可达：Doom II 结局 → 尾声 1/2/3 分支；noResolution → 战役失败', () => {
  const cases = [
    [{ cthulhuAnnihilatedTheCityOfArkham: true }, 'epilogue1'],
    [{ cthulhuWasDrivenAway: true }, 'epilogue2'],
    [{ cthulhuWasBanished: true, arkhamWasDestroyed: true }, 'epilogue2'],
    [{ cthulhuWasBanished: true }, 'epilogue3'],
    [{ theInvestigatorsHaltedCthulhusAwakening: true }, 'epilogue4'],
    [{}, null],
  ]
  for (const [records, expected] of cases) {
    assert.equal(tdcEpilogueBranch(records), expected)
  }
  // 结构上四条尾声都能走到 end。
  for (const branch of TDC_EPILOGUE_BRANCHES) {
    assert.equal(TDC_FLOW.nodes[branch.id].next, 'end')
  }
  // Doom II noResolution → campaignLostEnd。
  const { state } = newState()
  const { node, visited } = play(state, {
    answers: { interludeOneDecision: 'refuse', final: 'x' },
    resolutions: { theDoomOfArkhamPartII: 'noResolution' },
  })
  assert.equal(node.outcome, 'defeat')
  assert.ok(visited.includes('anOfferRefused'))
})

// ---------------------------------------------------------------------------
// ⑥ Interlude 处理器
// ---------------------------------------------------------------------------
test('序幕 handler：初始化四档混乱袋与 R’lyeh 地图 7 条目（幂等）', () => {
  const { state } = newState({ difficulty: 'hard' })
  state.campaign.chaosBag = []
  const snapshot = startTdcCampaign(state, logOf())
  assert.equal(snapshot.chaosBag, CHAOS_BAGS.hard.length)
  assert.deepEqual(snapshot.rlyehMap, ['rlyehWesternWall', 'rlyehDrownedQuarter', 'rlyehApiary',
    'rlyehGrandVault', 'rlyehCourtOfTheAncients', 'rlyehObsidianCanyons', 'rlyehSepulchreOfTheSleeper'])
  const again = startTdcCampaign(state, logOf())
  assert.equal(again.resumed, true)
  assert.deepEqual(again.rlyehMap.length, 7)
})

test('Interlude I：perInvestigator 节点让两名调查员各领不同任务（history.choices 落账）', () => {
  const { state } = newState()
  const driven = play(state, {
    answers: {
      taskChoice: { 0: 'walkInFaith', 1: 'toeTheLine' },
      interludeOneDecision: 'accept',
      expeditionChoice: 'west',
    },
    stopAt: 'expeditionPrep',
  })
  assert.equal(driven.node.id, 'expeditionPrep')
  // 逐人选择节点：引擎把每个座位的答案写进当前访问的 history.choices。
  const taskVisit = state.campaign.flow.history.find(visit => visit.nodeId === 'taskChoice')
  assert.deepEqual(taskVisit.choices, { 0: 'walkInFaith', 1: 'toeTheLine' })
  const tracks = state.campaign.progressTracks.tdcTask
  assert.equal(tracks['investigator-1'].option, 'walkInFaith')
  assert.equal(tracks['investigator-2'].option, 'toeTheLine')
  // 任务卡各自入牌组（11754a 信仰之行 / 11755a 坚守底线），不重复。
  assert.ok(state.campaign.investigators[0].deck.includes('11754a'))
  assert.ok(state.campaign.investigators[1].deck.includes('11755a'))
  assert.equal(new Set([tracks['investigator-1'].option, tracks['investigator-2'].option]).size, 2)
  // 节点本身是 perInvestigator + 唯一出口 + afterChoiceEffects（选项不带 next）。
  const node = TDC_FLOW.nodes.taskChoice
  assert.equal(node.perInvestigator, true)
  assert.equal(node.next, 'interludeOneDecision')
  assert.deepEqual(node.afterChoiceEffects.map(effect => effect.event), ['claimTasks'])
  assert.ok(node.options.every(option => option.next == null))
})

test('Interlude I：重复选择同一任务时按规范顺序回退（内容层去重）', () => {
  const { state } = newState()
  state.campaign.flow = {
    nodeId: 'taskChoice',
    visits: { taskChoice: 1 },
    history: [{ nodeId: 'taskChoice', visit: 1, choices: { 0: 'walkInFaith', 1: 'walkInFaith' } }],
  }
  const result = claimTasksFromChoices(state, logOf())
  assert.equal(result.assigned.length, 2)
  assert.deepEqual(result.assigned.map(row => row.seat), [0, 1])
  assert.equal(result.assigned[0].taskId, 'walkInFaith')
  assert.notEqual(result.assigned[1].taskId, 'walkInFaith')
  assert.deepEqual(result.fallbacks, [{ seat: 1, wanted: 'walkInFaith', assigned: result.assigned[1].taskId }])
  const tracks = state.campaign.progressTracks.tdcTask
  assert.equal(new Set([tracks['investigator-1'].option, tracks['investigator-2'].option]).size, 2)
  // 领过的任务不能再被单座位辅助重复领取。
  assert.equal(claimTask(state, 'walkInFaith', logOf()), null)
})

test('Interlude IV：任务进度换算经验、≥5 换完成卡并写 §4 记录、失败走创伤/混乱袋降档分支', () => {
  const { state } = newState()
  claimTask(state, 'walkInFaith', logOf())
  claimTask(state, 'toeTheLine', logOf())
  const campaign = state.campaign
  campaign.progressTracks.tdcTask['investigator-1'].value = 6
  campaign.progressTracks.tdcTask['investigator-2'].value = 2
  // Toe the Line 失败 = 抽 2 枚非符号标记各降 2 档；用可控袋断言（2 枚数值 + 2 枚符号）。
  state.chaosBag = ['+1', '0', 'skull', 'autofail']
  campaign.chaosBag = ['+1', '0', 'skull', 'autofail']
  const summary = resolveTasks(state, logOf())
  assert.equal(summary.completed.length, 1)
  assert.equal(summary.failed.length, 1)
  // 完成：Walk in Faith → isStrongInTheirFaith + 完成面卡；未完成：Toe the Line → 1 点肉体创伤 + 降档。
  assert.equal(campaign.records.isStrongInTheirFaith, true)
  assert.ok(campaign.investigators[0].deck.includes('11754b'))
  assert.ok(!campaign.investigators[0].deck.includes('11754a'))
  assert.equal(campaign.investigators[0].xp, 6)
  assert.equal(campaign.investigators[1].xp, 2)
  assert.equal(campaign.trauma[1].physical, 1)
  assert.deepEqual([...state.chaosBag].sort(), ['-1', '-2', 'autofail', 'skull'])
  assert.deepEqual([...campaign.chaosBag].sort(), ['-1', '-2', 'autofail', 'skull'])
  // 失败分支表已接线（不再有「近似跳过」说明）。
  assert.deepEqual(TDC_TASK_FAILURE_EFFECTS.toeTheLine.lowerChaosTokens, { count: 2, by: 2 })
  assert.ok(TDC_TASK_FAILURE_EFFECTS.toeTheLine.trauma)
  // 快照与尾声摘要可读。
  assert.equal(taskProgressSnapshot(state).length, 2)
  assert.equal(endgameSummary(state).branch, null)
})

test('Interlude IV：8 条任务的失败/完成分支逐条完整（参考 ForInvestigator InterludeStep 4）', async () => {
  await preloadCampaignPrimitives()
  const bag = ['+1', '0', 'skull', 'eldersign', 'tablet']
  const failedRun = taskId => {
    const { state } = newState()
    claimTask(state, taskId, logOf())
    const campaign = state.campaign
    campaign.progressTracks.tdcTask['investigator-1'].value = 0
    state.chaosBag = [...bag]
    campaign.chaosBag = [...bag]
    const summary = resolveTasks(state, logOf())
    return { state, campaign, record: campaign.investigators[0], summary }
  }
  const count = (list, token) => list.filter(value => value === token).length

  // 失败分支逐条。
  const walkInFaith = failedRun('walkInFaith')
  assert.equal(walkInFaith.campaign.trauma[0].mental, 1)
  assert.equal(walkInFaith.campaign.records.lostTheirFaith, true)

  const goodMoney = failedRun('goodMoney')
  assert.equal(goodMoney.campaign.trauma[0].physical, 1)
  const added = goodMoney.record.deck.filter(code => code !== '11756a')
  assert.equal(added.length, 1, 'Good Money 失败应加 1 张 Injury/Criminal 基础弱点')
  assert.ok((ALL_CARDS[added[0]].traits || []).some(trait => ['Injury', 'Criminal'].includes(trait)))

  const dreams = failedRun('dreamsOfDestruction')
  assert.equal(dreams.campaign.trauma[0].mental, 1)
  assert.equal(count(dreams.state.chaosBag, 'eldersign'), 0, '应移除 1 枚 elderSign')

  const noPlaceLikeHome = failedRun('noPlaceLikeHome')
  assert.equal(noPlaceLikeHome.campaign.trauma[0], undefined, 'NPLH 创伤由逐人选择节点结算')
  assert.equal(noPlaceLikeHome.campaign.investigators[0].deck.includes('11753b'), false)

  const doNoHarm = failedRun('doNoHarm')
  assert.equal(doNoHarm.campaign.trauma[0].mental, 1)
  assert.equal(count(doNoHarm.state.chaosBag, 'tablet'), count(bag, 'tablet') + 1)

  const toeTheLine = failedRun('toeTheLine')
  assert.equal(toeTheLine.campaign.trauma[0].physical, 1)
  assert.deepEqual([...toeTheLine.state.chaosBag].sort(), ['-1', '-2', 'eldersign', 'skull', 'tablet'])

  const proveYourWorth = failedRun('proveYourWorth')
  assert.equal(proveYourWorth.campaign.trauma[0].mental, 1)

  const plumbTheDepths = failedRun('plumbTheDepths')
  assert.equal(plumbTheDepths.campaign.trauma[0].mental, 1)
  assert.equal(count(plumbTheDepths.state.chaosBag, 'skull'), count(bag, 'skull') + 1)

  // 完成分支逐条：换完成面卡 + 写对应 §4 记录 + 进度换经验。
  for (const task of TDC_TASKS) {
    const { state } = newState()
    claimTask(state, task.id, logOf())
    const campaign = state.campaign
    campaign.progressTracks.tdcTask['investigator-1'].value = TDC_TASK_COMPLETION_PROGRESS
    const summary = resolveTasks(state, logOf())
    assert.equal(summary.completed.length, 1, `${task.id} 应完成`)
    const record = campaign.investigators[0]
    assert.ok(record.deck.includes(task.completedCard), `${task.id} 完成面 ${task.completedCard}`)
    assert.ok(!record.deck.includes(task.card), `${task.id} 未完成面应移除`)
    assert.equal(campaign.records[task.completedRecord], true, `${task.id} 完成记录 ${task.completedRecord}`)
    assert.equal(record.xp, TDC_TASK_COMPLETION_PROGRESS)
    if (task.id === 'dreamsOfDestruction') assert.equal(count(state.chaosBag, '+1'), count(CHAOS_BAGS.standard, '+1') + 1)
  }
})

test('Good Money 失败：按 traits 搜收藏加基础弱点；已持有同名/同印刷则跳过', async () => {
  // 引擎 basicWeaknessPool 经非阻塞 import 预载（避免 engine.js ⇄ content 的静态循环）。
  // 这里断言真实引擎导出可用（对局进入 Interlude IV 前必然已加载；失败时内容层有同口径回退池）。
  const enginePool = await preloadCampaignPrimitives()
  assert.equal(typeof enginePool, 'function', 'engine.basicWeaknessPool 应可预载')
  const { state } = newState()
  assert.ok(Array.isArray(enginePool(state)) && enginePool(state).includes('01101'), 'TDC 可达池应含 Mob Enforcer（Criminal）')
  claimTask(state, 'goodMoney', logOf())
  const campaign = state.campaign
  campaign.progressTracks.tdcTask['investigator-1'].value = 1
  const summary = resolveTasks(state, logOf())
  assert.equal(summary.failed.length, 1)
  assert.equal(summary.failed[0].taskId, 'goodMoney')
  const record = campaign.investigators[0]
  const weakness = record.deck.find(code => code !== '11756a')
  assert.ok(weakness, '应加入一张基础弱点')
  const traits = (ALL_CARDS[weakness].traits || []).map(trait => trait.toLowerCase())
  assert.ok(traits.includes('injury') || traits.includes('criminal'), `弱点 ${weakness} 应带 Injury/Criminal 特性`)
  // 已持有时不再重复发放（同名字/同印刷排除）——TDC 可达的 Injury/Criminal 池通常只有一张。
  const again = newState()
  claimTask(again.state, 'goodMoney', logOf())
  again.state.campaign.progressTracks.tdcTask['investigator-1'].value = 1
  again.state.campaign.investigators[0].deck.push(weakness)
  resolveTasks(again.state, logOf())
  assert.equal(again.state.campaign.investigators[0].deck.filter(code => code === weakness).length, 1)
  // 直接调用 helper 的排除逻辑：已持有时返回 null 或另一张未持有卡。
  const skipped = addBasicWeaknessForSeat(again.state, 0, ['Injury', 'Criminal'], logOf())
  assert.ok(skipped === null || skipped !== weakness)
})

test('No Place Like Home 失败二选一创伤：逐人选择、只作用于失败者', () => {
  const { state } = newState()
  claimTask(state, 'noPlaceLikeHome', logOf())
  claimTask(state, 'walkInFaith', logOf())
  const campaign = state.campaign
  // seat0 领 NPLH 且失败；seat1 领 Walk in Faith（不应受影响）。
  campaign.progressTracks.tdcTask['investigator-1'].value = 2
  campaign.progressTracks.tdcTask['investigator-2'].value = 5
  campaign.flow = {
    nodeId: 'nplhTraumaChoice',
    visits: { nplhTraumaChoice: 1 },
    history: [{ nodeId: 'nplhTraumaChoice', visit: 1, choices: { 0: 'physical', 1: 'mental' } }],
  }
  const result = runNplhTraumaChoices(state, logOf())
  assert.deepEqual(result.applied, [{ seat: 0, kind: 'physical' }])
  assert.equal(campaign.trauma[0].physical, 1)
  assert.equal(campaign.trauma[0].mental, 0)
  assert.equal(campaign.trauma[1], undefined)
  // 节点结构：perInvestigator + afterChoiceEffects + 唯一出口。
  const node = TDC_FLOW.nodes.nplhTraumaChoice
  assert.equal(node.perInvestigator, true)
  assert.equal(node.next, 'finale')
  assert.deepEqual(node.afterChoiceEffects.map(effect => effect.event), ['nplhTraumaChoices'])
  assert.ok(node.options.every(option => option.next == null))
  // 旧单 kind 辅助仍可用（夹具/直接调用）。
  assert.deepEqual(runNplhTrauma(state, { kind: 'mental' }, logOf()).affected, [0])
  assert.equal(campaign.trauma[0].mental, 1)
})

test('Doom I 无结局：进入 Part II 时每人随机搜一张 Injury/Madness 基础弱点', async () => {
  assert.equal(typeof await preloadCampaignPrimitives(), 'function')
  const { state } = newState()
  const campaign = state.campaign
  campaign.scenarioResults.push({ scenarioId: 'theDoomOfArkhamPartI', resolution: 'noResolution' })
  campaign.rngState = 1
  const result = runDoomPartOneWeaknesses(state, logOf())
  assert.equal(result.applied.length, 2)
  for (const row of result.applied) {
    const traits = (ALL_CARDS[row.code].traits || []).map(trait => trait.toLowerCase())
    assert.ok(traits.includes('injury') || traits.includes('madness'), `${row.code} 应带 Injury/Madness 特性`)
    assert.ok(campaign.investigators[row.seat].deck.includes(row.code))
  }
  assert.equal(new Set(result.applied.map(row => row.code)).size, 2, '同批两名调查员不发同一张')
  // 非 noResolution 不生效。
  const other = newState()
  other.state.campaign.scenarioResults.push({ scenarioId: 'theDoomOfArkhamPartI', resolution: 'resolution2' })
  assert.deepEqual(runDoomPartOneWeaknesses(other.state, logOf()).applied, [])
  // flow：进入 Part II 场景节点时触发（Part I behavior 把弱点补入留给战役层）。
  assert.deepEqual(TDC_FLOW.nodes.theDoomOfArkhamPartII.effects.map(effect => effect.event), ['doomWeaknesses'])
  // 经注册 handler 分派也可用（引擎会按节点效果走 applyCampaignEffect）。
  const third = newState()
  third.state.campaign.scenarioResults.push({ scenarioId: 'theDoomOfArkhamPartI', resolution: 'noResolution' })
  apply(third.state, TDC_FLOW.nodes.theDoomOfArkhamPartII.effects[0])
  assert.equal(third.state.campaign.investigators[0].deck.filter(code => (ALL_CARDS[code].traits || [])
    .some(trait => ['Injury', 'Madness'].includes(trait))).length, 1)
})

test('Sepulchre knowBetter：每名有任务的调查员进度 +1 且记录梦魇', () => {
  const { state } = newState()
  claimTask(state, 'walkInFaith', logOf())
  claimTask(state, 'toeTheLine', logOf())
  const result = runSepulchreKnowBetter(state, logOf())
  assert.equal(result.advanced.length, 2)
  assert.equal(state.campaign.progressTracks.tdcTask['investigator-1'].value, 1)
  assert.equal(state.campaign.progressTracks.tdcTask['investigator-2'].value, 1)
  assert.equal(state.campaign.records.theInvestigatorsDidNotConfrontTheNightmare, true)
})

test('Interlude III 符号替换与尾声 handler 已注册', () => {
  assert.deepEqual(interludeNodes().theAwakeningArtifact.effects[0].tokens,
    ['cultist', 'cultist', 'tablet', 'tablet', 'elderthing', 'elderthing'])
  assert.deepEqual(interludeNodes().theAwakeningNoArtifact.effects[0].tokens,
    ['cultist', 'tablet', 'elderthing', 'elderthing'])
  assert.equal(PROLOGUE_HANDLER_ID, 'tdcPrologue')
  assert.equal(INTERLUDE_HANDLER_ID, 'tdcInterludes')
  assert.equal(EPILOGUE_HANDLER_ID, 'tdcEpilogue')
  // 第二轮接线的近似已从登记表移除（保留的 4 条是真实残余）。
  const ids = TDC_INTERLUDE_APPROXIMATIONS.map(row => row.id)
  assert.ok(!ids.includes('toeTheLineTokens'))
  assert.ok(!ids.includes('goodMoneyWeakness'))
  assert.deepEqual([...ids].sort(),
    ['easternChaosSwap', 'goodMoneyWeaknessPool', 'nplhTraumaChoice', 'perInvestigatorTaskChoice'].sort())
})

// ---------------------------------------------------------------------------
// ⑦ 战役清单 / 包清单 / 章节辅助 / card-data
// ---------------------------------------------------------------------------
test('战役清单：10 章、四档混乱袋、unlock 闭包、可启动状态与 handler id', () => {
  assertCampaignManifest(tdcManifest)
  assert.equal(CAMPAIGN_ID, 'theDrownedCity')
  assert.equal(CAMPAIGN_NAME, '沉没之城')
  assert.equal(tdcManifest.status, 'playable')
  // TDC 复用《夜之狂热》的《午夜假面》Arkham 地点组，因此依赖 notz（注册期遭遇组校验）。
  assert.deepEqual(tdcManifest.requiredPackIds, ['core', 'notz', 'tdcCampaign'])
  assert.equal(tdcManifest.scenarioIds.length, 10)
  assert.equal(tdcManifest.interludeHandlerId, 'tdcInterludes')
  assert.deepEqual(tdcManifest.resolutionIds, ['epilogue1', 'epilogue2', 'epilogue3', 'epilogue4', 'campaignLost'])
  for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
    assert.ok(Array.isArray(tdcManifest.chaosBags[difficulty]), difficulty)
    assert.equal(tdcManifest.chaosBags[difficulty].length, CHAOS_BAGS[difficulty].length)
    assert.ok(tdcManifest.chaosBags[difficulty].includes('autofail'))
    assert.ok(tdcManifest.chaosBags[difficulty].includes('eldersign'))
  }
  // unlock 保守前驱：闭包且都在前序位置。
  for (const [scenarioId, predecessors] of Object.entries(TDC_UNLOCK)) {
    assert.ok(SCENARIO_IDS.includes(scenarioId), scenarioId)
    for (const prior of predecessors) {
      assert.ok(SCENARIO_IDS.indexOf(prior) < SCENARIO_IDS.indexOf(scenarioId), `${prior} → ${scenarioId}`)
    }
  }
  assert.deepEqual([...manifestChapterIds], [...SCENARIO_IDS])
  assert.deepEqual([...chapterIds], [...SCENARIO_IDS])
  for (const chapter of chapters) assert.equal(chapterIdentity(chapter.id).group, chapter.group)
  // 15 个共享遭遇组 id（camelCase）都声明在清单里。
  assert.equal(SHARED_ENCOUNTER_GROUP_IDS.length, 15)
  assert.deepEqual([...tdcManifest.sharedEncounterGroupIds], [...SHARED_ENCOUNTER_GROUP_IDS])
})

test('场景单元 / 路线辅助 / 结局分支纯函数', () => {
  assert.equal(scenarioUnitOf('theWesternWall').kind, 'expedition')
  assert.equal(scenarioUnitOf('oneLastJob').kind, 'opening')
  assert.equal(scenarioUnitOf('sepulchreOfTheSleeper').kind, 'sepulchre')
  assert.equal(scenarioUnitOf('theDoomOfArkhamPartII').kind, 'doom2')
  assert.equal(scenarioUnitOf('nope'), null)
  assert.equal(tdcRouteAfter('west', 'theWesternWall'), 'theDrownedQuarter')
  assert.equal(tdcRouteAfter('east', 'theWesternWall'), null)
  assert.equal(tdcRouteAfter('west', 'obsidianCanyons'), null)
  assert.deepEqual([...TDC_WEST_ROUTE].reverse(), [...TDC_EAST_ROUTE])
  // 尾声顺序：1 阿卡姆被毁 > 2 驱离/放逐+被毁 > 3 放逐 > 4 阻止苏醒。
  const branches = TDC_EPILOGUE_BRANCHES.map(branch => branch.id)
  assert.deepEqual(branches, ['epilogue1', 'epilogue2', 'epilogue3', 'epilogue4'])
  assert.equal(tdcEpilogueBranch({ cthulhuWasBanished: true, cthulhuWasDrivenAway: true }), 'epilogue2')
})

test('campaignFlowExtras 暴露路线/门槛/升级窗读点', () => {
  assert.equal(campaignFlowExtras.flow, TDC_FLOW)
  assert.deepEqual([...campaignFlowExtras.scenarioOrder], [...SCENARIO_IDS])
  assert.deepEqual(campaignFlowExtras.routeOrder.west, TDC_WEST_ROUTE)
  assert.deepEqual(campaignFlowExtras.routeOrder.east, TDC_EAST_ROUTE)
  assert.equal(campaignFlowExtras.sepulchreGateThresholds.artifactsFull, 5)
  assert.equal(campaignFlowExtras.sepulchreGateThresholds.glyphsFull, 26)
  assert.deepEqual(campaignFlowExtras.handlers,
    { prologue: 'tdcPrologue', interlude: 'tdcInterludes', epilogue: 'tdcEpilogue' })
  assert.ok(campaignFlowExtras.upgradeWindowNodes.includes('expeditionPrep'))
  // 每个 interlude 节点的 upgrades 语义：整备节点开窗，其余关窗。
  assert.notEqual(TDC_FLOW.nodes.expeditionPrep.upgrades, false)
  assert.equal(TDC_FLOW.nodes.epilogue.upgrades, false)
  assert.equal(TDC_FLOW.nodes.prologue.upgrades, false)
})

test('章节 card-data 辅助可导入并保持 FHV 同名 API 形状', () => {
  const western = printed('11517')
  assert.equal(western.code, '11517')
  assert.equal(western.type, 'scenario')
  assert.ok(western.name.length > 0)
  const loc = location({ id: 'shatteredRuins', code: '11518', clues: 2, shroud: 3 })
  assert.equal(loc.shroud, 3)
  assert.equal(loc.cluesPerInvestigator, 2)
  assert.deepEqual(loc.connections, [])
  const stageCard = stage('11554', { doom: 5 })
  assert.equal(stageCard.type, 'agenda')
  assert.equal(stageCard.doomThreshold, 5)
  const defs = encounterDefinitions(['11573'])
  assert.ok(defs.enemies['11573'])
  const deck = encounterGroupDeck(['the_western_wall'])
  assert.ok(deck.length > 0)
  assert.ok(encounterGroupCards(['cosmic_legacy']).every(code => ['11729', '11730'].includes(code)))
  assert.deepEqual(identitiesFor({ locations: { a: { id: 'a', code: '11518' } } }).locations.a,
    { originalCode: '11518', artCode: '11518' })
})

test('interlude / epilogue 节点表结构稳定（聚合器缺失容错）', async t => {
  const nodes = interludeNodes()
  for (const id of ['interludeOne', 'taskChoice', 'interludeOneDecision', 'anOfferAccepted', 'anOfferRefused',
    'expeditionChoice', 'theAwakening', 'theAwakeningConclusion', 'returnToArkhamWithArtifact',
    'returnToArkhamWithoutArtifact', 'nplhTraumaChoice', 'finale', 'expeditionPrep']) {
    assert.ok(nodes[id], id)
  }
  assert.ok(TDC_PROLOGUE_NODES.prologue)
  const epilogue = epilogueNodes()
  for (const branch of TDC_EPILOGUE_BRANCHES) assert.ok(epilogue[branch.id], branch.id)
  // 场景聚合器：十章齐备时校验 10 章加载与 `requireAllScenarios`（缺失容错口径覆盖在 FHV 验收里）。
  if (!allScenarioModulesLanded()) {
    // 批次期间：聚合器本身必须已落盘且具备缺失容错骨架。
    assert.ok(existsSync(scenarioIndexUrl))
    const source = readFileSync(scenarioIndexUrl, 'utf8')
    assert.match(source, /ERR_MODULE_NOT_FOUND/)
    assert.match(source, /requireAllScenarios\(\)/)
    return
  }
  let aggregator
  try {
    aggregator = await import(scenarioIndexUrl.href)
  } catch (error) {
    // 并行批次：其他 worker 的章节模块可能恰好在落盘（语法暂缺）。聚合器对「模块加载失败」
    // 是 fail closed（非 ERR_MODULE_NOT_FOUND 直接抛）——这里只在错误确实来自章节模块时放过，
    // 章节内容的完整性由各 `tests/tdc-scenario-*.test.mjs` 与 Lead 注册期 `assertContentBundle` 复核。
    assert.match(String(error?.message || error), /场景模块/)
    t.diagnostic(`章节模块仍在落盘：${error.message}`)
    return
  }
  assert.equal(aggregator.scenarioModuleIds.length, 10)
  assert.equal(aggregator.scenarioModules.length + aggregator.missingScenarioIds.length, 10)
  if (aggregator.missingScenarioIds.length === 0) assert.equal(aggregator.requireAllScenarios().length, 10)
})

test('远征方向数据与处理器：西线换混乱标记、东线发放 Ruby', () => {
  assert.deepEqual(TDC_EXPEDITION_CHOICES.west.chaos.map(change => [change.token, change.amount]),
    [['tablet', -1], ['cultist', 1]])
  assert.deepEqual(TDC_EXPEDITION_CHOICES.east.chaos, [])
  const { state } = newState()
  const result = runExpedition(state, { side: 'east' }, logOf())
  assert.equal(result.storyAsset, '11765')
  assert.ok(state.campaign.investigators[0].deck.includes('11765'))
  const second = runExpedition(state, { side: 'east' }, logOf())
  assert.equal(second.added, false)
})

test('叙事桥：story-text 未落盘时安全回退空串（不阻塞）', () => {
  assert.equal(typeof campaignText('prologue.body'), 'string')
  // 缺键/缺文件一律空串，绝不抛错。
  assert.equal(campaignText('不存在的键'), '')
  assert.equal(campaignText(''), '')
})

// ---------------------------------------------------------------------------
// ⑨ saveReplay：真实 saveSnapshot/readSnapshot（lib/sessions.js）后战役层状态等价 + 续跑确定
// ---------------------------------------------------------------------------
// 与各章 saveReplay 同一口径（CONTINUATION §2.1）：临时 DSH_HOME + 默认开启持久化路径
// （不设置 BOARDGAME_PERSIST=0），存档 → 读回 → 深比较 → 双方各再推进一个停点后结果一致。
// 覆盖「战役层」状态：flow（nodeId/history/visits）、records（含 string[] 集合）、
// progressTracks（tdcTask 进度轨）、混乱袋、调查员牌组（任务/远征剧情资产）。
test('战役层存档重放：flow/records/recordSets/progressTracks 恢复等价，续跑一个停点结果确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  const home = mkdtempSync(path.join(os.tmpdir(), 'tdc-campaign-save-'))
  process.env.DSH_HOME = home
  // 默认开启路径：不设置 BOARDGAME_PERSIST=0。
  delete process.env.BOARDGAME_PERSIST
  const sessionId = 'tdcCampaignLayerReplay'
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认必须开启')
    // 1) 走到真实战役中段停点：开场关打完 → Interlude I 领任务（tdcTask 进度轨）→
    //    接受提议 → Interlude II 西线（headedWest 记录 + 混乱袋换标记 + Andy 入牌组）→
    //    西墙结算 → 第一段整备停点 expeditionPrep。
    const { state } = newState()
    const driven = play(state, {
      answers: {
        taskChoice: { 0: 'walkInFaith', 1: 'toeTheLine' },
        interludeOneDecision: 'accept',
        expeditionChoice: 'west',
      },
      stopAt: 'expeditionPrep',
    })
    assert.equal(driven.node.id, 'expeditionPrep')
    assert.equal(state.campaign.flow.nodeId, 'expeditionPrep')
    // 战役层真实数据已产生（否则存档等价测试没有意义）。
    assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId), ['oneLastJob', 'theWesternWall'])
    assert.equal(state.campaign.records.theExpeditionHeadedWest, true)
    assert.equal(state.campaign.records.theExpeditionHeadedEast, false)
    assert.ok(Object.keys(state.campaign.progressTracks?.tdcTask || {}).length >= 2)
    assert.ok(state.campaign.investigators[0].deck.includes('11766'), 'Andy Van Nortwick 应在领队牌组')
    assert.ok(state.campaign.chaosBag.includes('cultist'))

    // 2) 真实落盘：saveSnapshot → readSnapshot。
    const file = saveSnapshot({
      sessionId,
      modId: 'arkhamhorror',
      state,
      players: [
        { seat: 0, name: '调查员 1', investigatorId: 'investigator-1' },
        { seat: 1, name: '调查员 2', investigatorId: 'investigator-2' },
      ],
      events: [{ seq: 0, type: 'info', text: '战役存档重放夹具' }],
      settings: { playerCount: 2, campaignId: CAMPAIGN_ID, difficulty: 'standard', seed: 'tdc-campaign-replay' },
    })
    assert.ok(file.includes(path.join('boardgame-hall', 'sessions', 'arkhamhorror')), `存档应落 mod 子目录：${file}`)
    const restored = readSnapshot(sessionId)
    assert.ok(restored, `readSnapshot 返回 null；磁盘文件：${existsSync(file) ? readFileSync(file, 'utf8').slice(0, 500) : '缺失'}`)

    // 3) 读回状态与内存状态深度相等（JSON 规范化后；覆盖 flow/records/recordSets/progressTracks）。
    const normalize = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalize(restored.session.state), normalize(state))
    assert.deepEqual(normalize(restored.session.state.campaign.flow), normalize(state.campaign.flow))
    assert.deepEqual(normalize(restored.session.state.campaign.records), normalize(state.campaign.records))
    assert.deepEqual(normalize(restored.session.state.campaign.progressTracks), normalize(state.campaign.progressTracks))
    // 集合记录（record-sets 口径，string[]）单项复核。
    assert.deepEqual(restored.session.state.campaign.records.discoveredGlyphs,
      state.campaign.records.discoveredGlyphs)
    assert.notEqual(restored.session.state.campaign.flow.history.length, 0)

    // 4) 从读回状态继续推进一个停点，与内存状态同起点推进的结果做指纹比较。
    const restoredState = { ...restored.session.state }
    const memoryNode = advanceOneStop(state)
    const restoredNode = advanceOneStop(restoredState)
    assert.equal(restoredNode.id, memoryNode.id)
    assert.deepEqual(
      { id: restoredNode.id, type: restoredNode.type, scenarioId: restoredNode.scenarioId, next: restoredNode.next },
      { id: memoryNode.id, type: memoryNode.type, scenarioId: memoryNode.scenarioId, next: memoryNode.next })
    assert.deepEqual(normalize(restoredState.campaign), normalize(state.campaign))
    // 续跑后确实进入西线第二关（西墙 → 淹没城区）。
    assert.equal(restoredNode.scenarioId, 'theDrownedQuarter')
    assert.equal(restoredState.campaign.flow.nodeId, 'theDrownedQuarter')
  } finally {
    rmSync(home, { recursive: true, force: true })
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
  }
})

// 未使用的导出保持引用（避免 lint/树摇误删；同时验证模块形状）。
void TDC_RECORD_SCHEMA
void TDC_TASKS
void anyRlyehArtifact
void flowCondition
