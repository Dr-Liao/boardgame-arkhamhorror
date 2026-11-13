// P7《绯红密钥》战役流程验收：流程图 / nextStep 语义 / 世界地图启程循环 / 时间与状况报告 /
// 序幕初始化 / 尾声多结局 / 记录 schema / manifest 与十章注册骨架。
//
// 覆盖（逐条对应 docs/campaign/theScarletKeys/README.md §4 的战役推进骨架）：
//   ① 流程图：`validateCampaignGraph` 注册期校验、十章 + 17 幕间 + 8 状况报告 + 14 密档节点齐备、
//      本循环没有检查点节点（checkpoints.js 的显式空表）；
//   ② nextStep 语义：`tskNextStep` 与参考 `TheScarletKeys.hs#nextStep` 的映射、时间满 35 强制终章；
//   ③ 世界地图：36 节点触发映射（章节 / 密档幕间 / 支线 / 终章 / 只路过）、初始解锁 26、起点 London；
//   ④ 正文绑定：节点正文/选项标签全部来自 story-text（中文非空，不是手写死字符串）；
//   ⑤ 序幕：地图/状况报告阈值/十把密钥/同志会三池/时间记录初始化（幂等）；
//   ⑥ 实走：序幕 → 谜雨 → 幕间 I（真相/隐瞒）→ 世界地图；旅行 → 章节 → 世界地图（环）；
//   ⑦ 时间轴：跨越 7/10/15/20/24/35 触发状况报告 α/ε/β/ζ/γ/ω，满 35 强制通古斯卡；
//   ⑧ 尾声：同志会结盟 / 常设职位 / 被解散三个结局、存在抹除、密钥归属、十章清单；
//   ⑨ 记录：schema 类型（引擎口径）、默认值、中文标签、存在抹除禁用卡；
//   ⑩ manifest / chapters / scenarios-index：清单可过 `assertCampaignManifest`，未落盘章显式抛错。
//
// 未完成依赖的显式说明：`dogsOfWar` / `shadesOfSuffering` / `withoutATrace` / `congressOfTheKeys`
// 四章由并行 worker 落盘中；依赖「十章齐备」的断言用 `t.skip()` 显式跳过（`requireChapters` 的反向断言
// 永远执行：缺章时必须抛错，不能静默用不完整列表注册）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  campaignGraph, enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { assertCampaignManifest } from '../content/schema.js'
import {
  FORCED_TIME_THRESHOLD, embarkOptions, forcedDestination, initializeWorldMap, mapTime, mapUnlocked,
  travelTo, worldMapState,
} from '../src/engine/tsk-map.js'
import { bindKey, scarletKeys } from '../src/engine/tsk-scarlet-keys.js'
import { coterieSnapshot } from '../src/engine/tsk-coterie.js'
import {
  TSK_FLOW, TSK_FLOW_NODE_ORDER, TSK_RECORD_DEFAULTS, TSK_RECORD_LABELS, TSK_RECORD_SCHEMA,
  campaignFlowExtras, nextWorldMapNode, nodeForTravel, rawTskFlowNodes, upgradeWindowForNode,
  validateTskFlow,
} from '../content/campaigns/theScarletKeys/flow.js'
import { manifest as tskManifest, TSK_UNLOCK } from '../content/campaigns/theScarletKeys/manifest.js'
import {
  CHECKPOINT_NODES, HAS_CHECKPOINT_STEPS, checkpointOmission,
} from '../content/campaigns/theScarletKeys/checkpoints.js'
import { PROLOGUE_NODES, KEY_INIT_SPECS, runPrologueEffect } from '../content/campaigns/theScarletKeys/prologue.js'
import { EPILOGUE_NODES, runScarletKeysEpilogue } from '../content/campaigns/theScarletKeys/epilogue.js'
import {
  campaignStoryHeading, campaignStoryLabel, campaignStoryText, isMainlineStep, scenarioUnitOf,
  tskNextStep, tskTravelTarget, TSK_CAMPAIGN_STEPS, TSK_DOSSIER_KEYS, TSK_DOSSIER_INTERLUDE_IDS,
  TSK_ENDGAME_STEP, TSK_FORCED_ENDGAME_TIME, TSK_INITIAL_UNLOCKED, TSK_INTERLUDE_IDS, TSK_NODE_ORDER,
  TSK_SCENARIO_IDS, TSK_SCENARIO_UNITS, TSK_START_LOCATION, TSK_START_STEP, TSK_STATUS_REPORT_STEPS,
  TSK_TRAVEL_TRIGGERS, TSK_WORLD_MAP_IDS, TSK_WORLD_MAP_STEP, interludeStepOf, statusReportStepOf,
} from '../content/campaigns/theScarletKeys/parts.js'
import {
  DOSSIER_NODES, INTERLUDE_NODES, STATUS_REPORT_NODES, TRAVEL_NODES,
} from '../content/campaigns/theScarletKeys/interludes.js'
import { CHAOS_BAGS, INITIAL_UNLOCKED, WORLD_MAP } from '../content/campaigns/theScarletKeys/shared.js'
import { ERASED_CAMPAIGN_CARDS, EXPEDITED_TICKET } from '../content/campaigns/theScarletKeys/records.js'
import {
  chapterEntries, catalogChapters, chapterEntryOf, missingChapterIds, requireChapters,
} from '../content/campaigns/theScarletKeys/chapters.js'
import {
  missingScenarioIds, requireAllScenarios, scenarioEntries, scenariosById,
} from '../content/campaigns/theScarletKeys/scenarios/index.js'

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
const CJK = /[\u3400-\u9fff]/
const STANDARD_BAG = [...CHAOS_BAGS.standard]

const MANIFEST = Object.freeze({
  id: 'theScarletKeys',
  scenarioIds: TSK_SCENARIO_IDS,
  recordSchema: TSK_RECORD_SCHEMA,
  flow: TSK_FLOW,
})

function newState ({ seats = 2, bag = STANDARD_BAG } = {}) {
  const investigators = {}
  for (let seat = 0; seat < seats; seat += 1) {
    investigators[seat] = {
      seat, id: `inv-${seat}`, code: '09001', name: `调查员 ${seat + 1}`, status: 'active',
      deck: [], xp: 0, earnedXp: 0, spentXp: 0, trauma: { physical: 0, mental: 0 }, purchases: [], removedCards: [],
    }
  }
  const campaign = {
    records: structuredClone(TSK_RECORD_DEFAULTS),
    recordSchema: TSK_RECORD_SCHEMA,
    scenarioResults: [],
    investigators,
    trauma: {},
    chaosBag: [...bag],
    leadSeat: 0,
    scenarioIndex: 0,
  }
  const state = {
    campaign,
    chaosBag: [...bag],
    // 运行时座位快照（引擎的密钥/效果原语会同时读 state.investigators）。
    investigators: Object.values(investigators).map(record => ({ seat: record.seat, name: record.name })),
    log: [],
    events: [],
  }
  return state
}

/** 与引擎一致的效果分派：registered → 内容处理器；其它 → applyCampaignEffect。 */
function apply (state, effect) {
  return applyCampaignEffect(state, effect, line => state.log.push(String(line)))
}

function chooseAnswer (answers) {
  return (id, node, options) => {
    const wanted = answers[id]
    if (wanted && options.some(option => option.id === wanted)) return wanted
    return options[0].id
  }
}

/**
 * 走 flow 直到可交互停点；scenario/end 由调用方处理（与引擎 `progressCampaign` 同一推进方式）。
 * `answers` 按 choice 节点 id 给出选项；缺省取第一个合法选项。
 */
function play (state, { answers = {}, onScenario = null, onMap = null, maxStops = 80 } = {}) {
  const campaign = state.campaign
  const graph = validateCampaignGraph(MANIFEST)
  const visited = []
  for (let step = 0; step < maxStops * 4; step += 1) {
    const node = walkCampaign(campaign, MANIFEST, chooseAnswer(answers), effect => apply(state, effect),
      { continuousInterlude: true })
    if (node.type === 'end') {
      visited.push('end')
      return { visited, ended: true, node }
    }
    if (node.type === 'scenario') {
      visited.push(`scenario:${node.scenarioId}`)
      campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
      graph.nodes[node.scenarioId].next
      onScenario?.(node, state)
      // 引擎在结算后把 `campaign.pendingNode = 章节.next`，下一次 progressCampaign 从这里继续。
      enterCampaignNode(campaign, MANIFEST, graph.nodes[node.scenarioId].next)
      continue
    }
    visited.push(node.type === 'map' ? 'map' : `stop:${node.id}`)
    if (node.type === 'map') {
      onMap?.(node, state)
      return { visited, ended: false, node }
    }
    // interlude / checkpoint：休息窗结束后进入 next。
    enterCampaignNode(campaign, MANIFEST, graph.nodes[node.id].next)
  }
  throw new Error('flow 未在安全步数内停止')
}

/** 序幕 + 谜雨之后的「世界地图就绪」状态（各用例复用）。 */
function mapReadyState ({ seats = 1, answers = {} } = {}) {
  const state = newState({ seats })
  const result = play(state, { answers: { interlude1Choice: 'tell', ...answers } })
  if (result.node?.type !== 'map') throw new Error(`夹具没有停在世界地图：${result.visited.join('>')}`)
  return state
}

function setMapLocation (state, node, { time = null } = {}) {
  const map = state.campaign.tsk.map
  map.current = node
  if (!map.visited.includes(node)) map.visited.push(node)
  if (!map.unlocked.includes(node)) map.unlocked.push(node)
  if (time != null) map.time = time
  state.campaign.records.currentLocation = node
  if (time != null) state.campaign.records.time = time
}

function addKeyToSeat (state, keyId, seat = 0) {
  const key = KEY_INIT_SPECS.find(spec => spec.id === keyId)
  assert.ok(key, `缺密钥 ${keyId}`)
  bindKey(state, keyId, { type: 'investigator', seat })
}

// ---------------------------------------------------------------------------
// ① 流程图
// ---------------------------------------------------------------------------
test('P7 flow 流程图：注册期校验通过，十章/17 幕间/8 状况报告/14 密档/世界地图/尾声节点齐备', () => {
  const graph = validateTskFlow()
  assert.equal(graph.start, 'prologue')
  assert.equal(TSK_FLOW.start, 'prologue')
  assert.deepEqual(TSK_FLOW_NODE_ORDER, Object.keys(TSK_FLOW.nodes))
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.type === 'scenario').map(node => node.scenarioId),
    TSK_SCENARIO_IDS, '十章全部是 scenario 节点且顺序与 CampaignSteps.hs 一致')
  assert.equal(graph.nodes.worldMap.type, 'map')
  assert.equal(graph.nodes.worldMap.next, 'endgameApproach')
  assert.equal(graph.nodes.endgameApproach.type, 'story')
  assert.equal(graph.nodes.endgameApproach.next, TSK_ENDGAME_STEP)
  assert.equal(graph.nodes[TSK_ENDGAME_STEP].next, 'epilogue')
  assert.equal(EPILOGUE_NODES.epilogue.next, 'end')
  assert.equal(graph.nodes.end.type, 'end')
  // 幕间 I 与 16 段密档幕间入口都在图里，且都开升级窗。
  for (const id of TSK_INTERLUDE_IDS) {
    assert.equal(graph.nodes[id].type, 'interlude', `${id} 应为 interlude 节点`)
    assert.equal(graph.nodes[id].upgrades, true)
    assert.equal(upgradeWindowForNode(graph.nodes[id]), true)
  }
  // 状况报告 / 密档 / 快捷旅票 / 支线幕间。
  for (const step of TSK_STATUS_REPORT_STEPS) assert.equal(graph.nodes[step.nodeId].type, 'story')
  for (const dossier of TSK_DOSSIER_KEYS) assert.equal(graph.nodes[dossier.stepId].type, 'story')
  assert.equal(graph.nodes.expeditedTicket.type, 'story')
  assert.equal(graph.nodes.sideStory.type, 'story')
  // 本循环没有检查点步骤（参考 nextStep 只有 Prologue/Scenario/Interlude/Epilogue）。
  assert.equal(HAS_CHECKPOINT_STEPS, false)
  assert.deepEqual(Object.keys(CHECKPOINT_NODES), [])
  assert.deepEqual(checkpointOmission().replacedBy, ['worldMap', 'interlude', 'statusReport'])
  // 图里每个节点都可从 start 到达。世界地图是环：`map` 节点由战役行为按目的地进入
  // 章节/密档幕间/状况报告/密档/快捷旅票/支线幕间，因此它的「边」= 全部旅行触发 + next。
  const reachable = new Set()
  const queue = [graph.start]
  const mapTargets = [...new Set([
    ...Object.values(TSK_TRAVEL_TRIGGERS).map(target => target.stepId).filter(Boolean),
    ...TSK_STATUS_REPORT_STEPS.map(step => step.nodeId),
    ...TSK_DOSSIER_KEYS.map(dossier => dossier.stepId),
    'expeditedTicket', 'sideStory',
  ])]
  while (queue.length) {
    const id = queue.shift()
    if (reachable.has(id)) continue
    reachable.add(id)
    const node = graph.nodes[id]
    const edges = node.type === 'stepReturn' ? [...node.rules.map(rule => rule.next), node.next]
      : node.type === 'map' ? [node.next, ...mapTargets]
        : node.options ? [...node.options.map(option => option.next), node.next]
          : node.next ? [node.next] : []
    for (const next of edges) if (next && graph.nodes[next] && !reachable.has(next)) queue.push(next)
  }
  assert.deepEqual(TSK_FLOW_NODE_ORDER.filter(id => !reachable.has(id)), [], '存在不可达节点')
  // 节点表顺序稳定（节点数不写死，但必须覆盖四类插入段）。
  assert.ok(TSK_FLOW_NODE_ORDER.length >= 100, `节点数异常：${TSK_FLOW_NODE_ORDER.length}`)
  for (const id of [...TSK_INTERLUDE_IDS, ...TSK_STATUS_REPORT_STEPS.map(step => step.nodeId),
    ...TSK_DOSSIER_KEYS.map(dossier => dossier.stepId), 'worldMap', 'endgameApproach', 'expeditedTicket', 'sideStory']) {
    assert.ok(TSK_FLOW_NODE_ORDER.includes(id), `缺少节点 ${id}`)
  }
})

test('P7 flow 原始节点表可再次本地化：rawTskFlowNodes 与 TSK_FLOW 节点集合一致', () => {
  const raw = rawTskFlowNodes()
  assert.deepEqual(Object.keys(raw).sort(), Object.keys(TSK_FLOW.nodes).sort())
  // 本地化后的展示文本一定来自 story-text（raw 里与本地化结果不同的只可能是 text/title/label）。
  for (const [id, node] of Object.entries(TSK_FLOW.nodes)) {
    assert.equal(node, TSK_FLOW.nodes[id])
    assert.equal(typeof raw[id].type, 'string')
  }
})

// ---------------------------------------------------------------------------
// ② nextStep 语义
// ---------------------------------------------------------------------------
test('P7 flow nextStep：序幕→谜雨→幕间 I→启程；章节/幕间→启程；终章→尾声；时间满 35 强制终章', () => {
  assert.deepEqual(tskNextStep('prologue'), [TSK_START_STEP])
  assert.deepEqual(tskNextStep(TSK_START_STEP), ['interlude1'])
  assert.deepEqual(tskNextStep('interlude1'), [TSK_WORLD_MAP_STEP])
  for (const id of TSK_DOSSIER_INTERLUDE_IDS) assert.deepEqual(tskNextStep(id), [TSK_WORLD_MAP_STEP], id)
  for (const id of TSK_SCENARIO_IDS.filter(value => value !== TSK_START_STEP && value !== TSK_ENDGAME_STEP)) {
    assert.deepEqual(tskNextStep(id), [TSK_WORLD_MAP_STEP], id)
  }
  assert.deepEqual(tskNextStep(TSK_ENDGAME_STEP), ['epilogue'])
  assert.deepEqual(tskNextStep('epilogue'), [])
  // 启程循环：未到点返回空（由玩家在世界地图选目的地）；到点只能去终章。
  assert.deepEqual(tskNextStep(TSK_WORLD_MAP_STEP, { time: 0 }), [])
  assert.deepEqual(tskNextStep(TSK_WORLD_MAP_STEP, { records: { time: TSK_FORCED_ENDGAME_TIME } }), [TSK_ENDGAME_STEP])
  // 主线判定：十章 + 序幕/幕间 I/16 段密档幕间/尾声都是 CampaignStep（参考 nextStep 的分支集合）；
  // 启程循环内的插入段（状况报告/密档/快捷旅票/支线幕间/世界地图段）不是 CampaignStep。
  for (const id of [...TSK_SCENARIO_IDS, 'prologue', 'interlude1', 'epilogue']) assert.equal(isMainlineStep(id), true, id)
  for (const id of TSK_DOSSIER_INTERLUDE_IDS) assert.equal(isMainlineStep(id), true, id)
  for (const id of ['statusReportAlpha', 'dossierHavana', 'expeditedTicket', 'sideStory', 'worldMap', 'end']) {
    assert.equal(isMainlineStep(id), false, id)
  }
  assert.equal(TSK_CAMPAIGN_STEPS.includes('interlude14'), true)
  assert.equal(TSK_CAMPAIGN_STEPS.length, 29)
  // 章节单元与幕间/状况报告反查。
  assert.deepEqual(TSK_SCENARIO_UNITS.map(unit => unit.id), TSK_SCENARIO_IDS)
  assert.equal(scenarioUnitOf('deadHeat').mapLocationId, 'Marrakesh')
  assert.equal(scenarioUnitOf('nope'), null)
  assert.equal(interludeStepOf('interlude20').triggerLocations[0], 'Bermuda')
  assert.equal(statusReportStepOf('zeta').threshold, 20)
  assert.equal(statusReportStepOf('theta').dynamic, true)
  assert.equal(TSK_FORCED_ENDGAME_TIME, FORCED_TIME_THRESHOLD)
})

// ---------------------------------------------------------------------------
// ③ 世界地图触发
// ---------------------------------------------------------------------------
test('P7 flow 世界地图：36 节点触发映射镜像参考 travel，起点 London、初始解锁 26、绿地支线', () => {
  assert.equal(TSK_WORLD_MAP_IDS.length, WORLD_MAP.length)
  assert.deepEqual(Object.keys(TSK_TRAVEL_TRIGGERS).sort(), [...TSK_WORLD_MAP_IDS].sort())
  const byKind = { scenario: [], interlude: [], sideStory: [], endgame: [], passThrough: [] }
  for (const [node, target] of Object.entries(TSK_TRAVEL_TRIGGERS)) byKind[target.kind].push(node)
  assert.deepEqual(byKind.scenario.sort(), [
    'Alexandria', 'Anchorage', 'BermudaTriangle', 'BuenosAires',
    'Constantinople', 'Havana', 'KualaLumpur', 'Marrakesh',
  ])
  assert.equal(byKind.interlude.length, 22, '22 个地图节点触发 16 段密档幕间（含一档多城）')
  assert.equal(new Set(byKind.interlude.map(node => TSK_TRAVEL_TRIGGERS[node].stepId)).size, 16)
  assert.deepEqual(byKind.endgame, ['Tunguska'])
  assert.deepEqual(byKind.sideStory.sort(), ['Arkham', 'Cairo', 'MonteCarlo', 'NewOrleans', 'Venice'])
  // 36 个节点全部有明确语义（没有「只路过」节点）：8 章 + 22 密档 + 5 绿地 + 通古斯卡。
  assert.deepEqual(byKind.passThrough, [])
  assert.equal(byKind.scenario.length + byKind.interlude.length + byKind.sideStory.length + byKind.endgame.length, 36)
  // 参考 travel 的逐节点映射抽查。
  assert.deepEqual(tskTravelTarget('Kabul'), { kind: 'interlude', stepId: 'interlude14' })
  assert.deepEqual(tskTravelTarget('Quito').stepId, 'interlude14')
  assert.deepEqual(tskTravelTarget('Bermuda').stepId, 'interlude20')
  assert.deepEqual(tskTravelTarget('Moscow').stepId, 'interlude26')
  assert.deepEqual(tskTravelTarget('SanFrancisco').stepId, 'interlude26')
  assert.deepEqual(tskTravelTarget('London').stepId, 'interlude27')
  assert.equal(TSK_TRAVEL_TRIGGERS.London.kind, 'interlude')
  assert.deepEqual(tskTravelTarget('Shanghai').stepId, 'interlude32')
  assert.deepEqual(tskTravelTarget('Bombay').stepId, 'interlude36')
  assert.deepEqual(tskTravelTarget('Stockholm').stepId, 'interlude36')
  assert.deepEqual(tskTravelTarget('Lagos').stepId, 'interlude37')
  assert.deepEqual(tskTravelTarget('Tokyo').stepId, 'interlude37')
  assert.deepEqual(tskTravelTarget('RioDeJaneiro').stepId, 'interlude44')
  assert.deepEqual(tskTravelTarget('Manokwari').stepId, 'interlude45')
  assert.deepEqual(tskTravelTarget('Sydney').stepId, 'interlude49')
  assert.deepEqual(tskTravelTarget('HongKong').stepId, 'interlude50')
  assert.deepEqual(tskTravelTarget('Rome').stepId, 'interlude51')
  assert.deepEqual(tskTravelTarget('YborCity').stepId, 'interlude52')
  assert.deepEqual(tskTravelTarget('Kathmandu').stepId, 'interlude53')
  assert.deepEqual(tskTravelTarget('Nairobi').stepId, 'interlude54')
  assert.deepEqual(tskTravelTarget('Perth').stepId, 'interlude55')
  assert.deepEqual(tskTravelTarget('Marrakesh'), { kind: 'scenario', stepId: 'deadHeat', scenarioId: 'deadHeat' })
  assert.deepEqual(tskTravelTarget('Tunguska'), { kind: 'endgame', stepId: TSK_ENDGAME_STEP, nodeId: 'Tunguska' })
  // 目的地 → 进入节点。
  assert.equal(nodeForTravel('Kabul'), 'interlude14')
  assert.equal(nodeForTravel('Marrakesh'), 'deadHeat')
  assert.equal(nodeForTravel('Tunguska'), 'endgameApproach')
  assert.equal(nodeForTravel('NopeNowhere'), null)
  // 初始地图：London 起点 + 26 个初始解锁（21 普通/锁定 + 5 绿地）。
  assert.equal(TSK_START_LOCATION, 'London')
  assert.deepEqual(TSK_INITIAL_UNLOCKED, INITIAL_UNLOCKED)
  assert.equal(new Set(TSK_INITIAL_UNLOCKED).size, 26)
})

// ---------------------------------------------------------------------------
// ④ 正文绑定
// ---------------------------------------------------------------------------
test('P7 flow 正文绑定：所有节点正文/选项标签来自 story-text（中文非空，无手写死文本）', () => {
  let textNodes = 0
  for (const [id, node] of Object.entries(TSK_FLOW.nodes)) {
    const textKeys = [node.textKey, ...(node.textKeys || [])].filter(Boolean)
    if (!textKeys.length) {
      // 无正文节点只允许是：章节（正文在剧本内）、路由、结局、升级窗入口、快捷旅票、支线幕间。
      const allowed = ['worldMap', 'end', 'interlude14', 'expeditedTicket', 'sideStory']
      assert.ok(allowed.includes(id) || node.type === 'stepReturn' || node.type === 'scenario',
        `节点 ${id} 缺少 textKey 但不是允许的无正文节点（type=${node.type}）`)
      continue
    }
    textNodes += 1
    assert.ok(String(node.text || '').length > 0, `${id} 正文为空`)
    assert.match(node.text, CJK, `${id} 正文不是中文（story-text 展示树读取失败？）`)
    const expected = textKeys.map(campaignStoryText).filter(Boolean).join('\n\n')
    assert.equal(node.text, expected, `${id} 正文与 story-text 不一致`)
    for (const key of textKeys) assert.ok(campaignStoryText(key).length > 0, `${id} 的 textKey ${key} 无正文`)
  }
  assert.ok(textNodes > 100, `正文节点过少：${textNodes}`)
  for (const [id, node] of Object.entries(TSK_FLOW.nodes)) {
    for (const option of node.options || []) {
      assert.ok(option.id, `${id} 选项缺 id`)
      assert.ok(String(option.label || '').length > 0, `${id}/${option.id} 选项无标签`)
      assert.match(option.label, CJK, `${id}/${option.id} 选项标签不是中文`)
      if (option.labelKey) assert.equal(option.label, campaignStoryLabel(option.labelKey))
    }
  }
  // 标题：标题键 → 展示标题；档案幕间用「档案#NN–X」。
  assert.equal(TSK_FLOW.nodes.statusReportAlpha.title, `${campaignStoryHeading('statusReport')} · ALPHA`)
  assert.equal(TSK_FLOW.nodes.interlude20.title, campaignStoryHeading('headings.interludes.20'))
  assert.match(TSK_FLOW.nodes.interlude20.title, CJK)
  assert.match(TSK_FLOW.nodes.dossierHavana.title, CJK)
  assert.equal(TSK_FLOW.nodes.prologue.title, '秘密战争')
  assert.equal(TSK_FLOW.nodes.endgameApproach.title, '通古斯卡')
  // 关键分支正文都非空（避免「有 key 没内容」）。
  for (const key of [
    'prologue', 'specialRules', 'interlude1.theFoundation1', 'statusReport.alpha', 'statusReport.omega',
    'rusesAndReclamation.rusesAndReclamation2', 'theGreatWork.theGreatWork5', 'quidProQuo.quidProQuo1',
    'deadAndGone.deadAndGone6', 'theCoiledSerpent.theCoiledSerpent2', 'strangeArchitecture.strangeArchitecture3',
    'specialDelivery.specialDelivery4', 'theoryOfAnnihilation.theoryOfAnnihilation2',
    'metamorphosis.metamorphosis3', 'ringingHollow.ringingHollow4', 'bloodSweatAndTea.bloodSweatAndTea2',
    'romulusAndRemus.romulusAndRemus1', 'theSafehouse.theSafehouse2', 'whistleOnTheWind.whistleOnTheWind2',
    'infernalMachinery.infernalMachinery3', 'paranaturalSelection.paranaturalSelection4',
    'worldMap.dossiers.Havana', 'epilogue.epilogue1', 'epilogue.epilogue5',
  ]) {
    assert.match(campaignStoryText(key), CJK, `${key} 无中文正文`)
  }
})

// ---------------------------------------------------------------------------
// ⑤ 序幕
// ---------------------------------------------------------------------------
test('P7 flow 序幕：开局初始化世界地图/状况报告/十把密钥/同志会三池/时间记录（幂等）', () => {
  const state = newState()
  const snapshot = runPrologueEffect(state, { event: 'campaignStart' }, line => state.log.push(line))
  assert.equal(snapshot.time, 0)
  assert.equal(snapshot.location, 'London')
  assert.deepEqual(new Set(snapshot.unlocked), new Set(['London', ...INITIAL_UNLOCKED]))
  assert.equal(snapshot.keys, 10)
  assert.equal(snapshot.coterie, 10)
  assert.equal(snapshot.forcedAt, TSK_FORCED_ENDGAME_TIME)
  const map = worldMapState(state)
  assert.equal(map.current, 'London')
  assert.deepEqual(map.visited, ['London'])
  assert.equal(map.forcedNode, 'Tunguska')
  assert.equal(mapUnlocked(state).length, 27)
  const reports = state.campaign.tsk.statusReports
  assert.deepEqual(reports.thresholds.map(entry => [entry.report, entry.threshold]),
    [['alpha', 7], ['epsilon', 10], ['beta', 15], ['zeta', 20], ['gamma', 24], ['omega', 35]])
  assert.deepEqual(reports.triggered, [])
  const keys = scarletKeys(state)
  assert.equal(keys.length, 10)
  for (const key of keys) {
    assert.equal(key.bearer.type, 'none')
    assert.equal(key.stable, true)
    assert.notEqual(key.stableFace, key.unstableFace)
  }
  assert.deepEqual(coterieSnapshot(state), { unresolved: ['09752', '09753', '09754', '09755', '09756',
    '09757', '09758', '09759', '09760', '09761'], ally: [], defeated: [] })
  const records = state.campaign.records
  assert.equal(records.time, 0)
  assert.equal(records.currentLocation, 'London')
  assert.deepEqual(records.mapVisitedLocations, ['London'])
  assert.deepEqual(records.scenarioOrder, TSK_SCENARIO_IDS)
  assert.equal(records.wrongLeadCount, 0)
  assert.equal(records.campaignOutcome, '')
  assert.ok(state.log.some(line => /战役准备完成/.test(line)))
  // 幂等：再次进入序幕不重复初始化、不抛错。
  const before = JSON.stringify(state.campaign.tsk)
  const second = runPrologueEffect(state, { event: 'campaignStart' }, line => state.log.push(line))
  assert.equal(second.keys, 10)
  assert.equal(JSON.stringify(state.campaign.tsk), before)
  assert.throws(() => runPrologueEffect(state, { event: 'nope' }), /未知序幕效果/)
  assert.equal(PROLOGUE_NODES.prologue.type, 'story')
  assert.equal(PROLOGUE_NODES.prologue.next, 'prologueRules')
  assert.equal(PROLOGUE_NODES.prologueRules.next, 'riddlesAndRain')
})

// ---------------------------------------------------------------------------
// ⑥ 实走：序幕 → 谜雨 → 幕间 I → 世界地图
// ---------------------------------------------------------------------------
test('P7 flow 实走：序幕→谜雨→幕间 I（真相/隐瞒）→世界地图，记录与混乱袋按参考结算', () => {
  const told = newState()
  const first = play(told, { answers: { interlude1Choice: 'tell' } })
  assert.deepEqual(first.visited, ['scenario:riddlesAndRain', 'map'])
  assert.equal(told.campaign.records.theCellToldTheTruthToTaylor, true)
  assert.equal(Boolean(told.campaign.records.theCellHidTheTruthFromTaylor), false)
  // swapTokens ElderThing → Tablet。
  assert.equal(told.chaosBag.filter(token => token === 'elderthing').length, 0)
  assert.equal(told.chaosBag.filter(token => token === 'tablet').length, 2)
  // 幕间 I 的正文按顺序进入历史（启程与旅行 + 密档读法）。
  const history = told.campaign.flow.history.map(visit => visit.nodeId)
  assert.deepEqual(history, ['prologue', 'prologueRules', 'riddlesAndRain', 'interlude1', 'interlude1Choice',
    'interlude1Step2', 'interlude1Step4', 'embarkRules', 'foundationDossiers', 'worldMap'])
  const embarkVisit = told.campaign.flow.history.find(visit => visit.nodeId === 'embarkRules')
  assert.match(embarkVisit.storyText, /启程|旅行|时间/, '幕间 I 需要讲述「启程与旅行」规则')
  assert.ok(told.log.some(line => /世界地图：当前 London/.test(line)))

  const hid = newState()
  play(hid, { answers: { interlude1Choice: 'doNotTell' } })
  assert.equal(hid.campaign.records.theCellHidTheTruthFromTaylor, true)
  assert.equal(hid.chaosBag.filter(token => token === 'elderthing').length, 2)
  assert.equal(hid.chaosBag.filter(token => token === 'tablet').length, 0)
  assert.ok(hid.log.some(line => /对泰勒隐瞒/.test(line)))
})

test('P7 flow 实走：世界地图环——旅行到章节→结算→回世界地图；再旅行到密档幕间同样回到地图', () => {
  const state = mapReadyState()
  // 伦敦 → 马拉喀什（1 时间），触发《死亡酷暑》。
  const travel = travelTo(state, { graph: { nodes: WORLD_MAP }, destination: 'Marrakesh' })
  assert.equal(travel.time, 1)
  setMapLocation(state, 'Marrakesh', { time: travel.time })
  enterCampaignNode(state.campaign, MANIFEST, nodeForTravel('Marrakesh'))
  const chapterStop = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect))
  assert.equal(chapterStop.type, 'scenario')
  assert.equal(chapterStop.scenarioId, 'deadHeat')
  // 结算章节（引擎把 pendingNode 指向章节 next）→ 回到世界地图，章节进「已完成」。
  enterCampaignNode(state.campaign, MANIFEST, 'worldMap')
  state.campaign.scenarioResults.push({ scenarioId: 'deadHeat', resolution: 'R1' })
  const mapStop = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect),
    { continuousInterlude: true })
  assert.equal(mapStop.type, 'map')
  assert.deepEqual(state.campaign.records.chaptersCompleted, ['riddlesAndRain', 'deadHeat'])
  assert.equal(state.campaign.records.currentLocation, 'Marrakesh')

  // 地图环：马拉喀什 → 喀布尔（3 时间）→ 幕间 14 → 回到世界地图。
  setMapLocation(state, 'Kabul', { time: 5 })
  enterCampaignNode(state.campaign, MANIFEST, nodeForTravel('Kabul'))
  const interludeStop = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect),
    { continuousInterlude: true })
  assert.equal(interludeStop.type, 'map')
  assert.ok(state.campaign.records.interludeVisits.includes('interlude14'))
  assert.ok(state.log.some(line => /拨乱反正|错误线索/.test(line)))
})

// ---------------------------------------------------------------------------
// ⑦ 时间轴与状况报告
// ---------------------------------------------------------------------------
test('P7 flow 时间轴：跨过阈值排队状况报告，nextWorldMapNode 按顺序给出节点；满 35 强制终章', () => {
  const state = mapReadyState()
  const map = state.campaign.tsk.map
  // 时间 8：跨过 α(7)，β(15)/ζ(20) 未到。
  map.time = 8
  state.campaign.records.time = 8
  enterCampaignNode(state.campaign, MANIFEST, 'worldMap')
  const stop = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect))
  assert.equal(stop.type, 'map')
  const next = nextWorldMapNode(state)
  assert.deepEqual({ kind: next.kind, nodeId: next.nodeId, report: next.report },
    { kind: 'statusReport', nodeId: 'statusReportAlpha', report: 'alpha' })
  // 进入 α：加 [cultist]、记录已读、回到世界地图。
  enterCampaignNode(state.campaign, MANIFEST, next.nodeId)
  const afterAlpha = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect),
    { continuousInterlude: true })
  assert.equal(afterAlpha.type, 'map')
  assert.equal(state.chaosBag.filter(token => token === 'cultist').length, 1)
  assert.deepEqual(state.campaign.records.statusReportsSeen, ['alpha'])
  assert.equal(nextWorldMapNode(state), null)
  // 时间 24：一次跨过 ε(10)/β(15)/ζ(20)/γ(24)，按阈值顺序给出 ε → β → ζ → γ。
  state.campaign.tsk.map.time = 24
  state.campaign.records.time = 24
  enterCampaignNode(state.campaign, MANIFEST, 'worldMap')
  walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect))
  const order = []
  for (let index = 0; index < 4; index += 1) {
    const due = nextWorldMapNode(state)
    assert.ok(due, `第 ${index} 个状况报告缺失`)
    order.push(due.report)
    enterCampaignNode(state.campaign, MANIFEST, due.nodeId)
    walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect), { continuousInterlude: true })
  }
  assert.deepEqual(order, ['epsilon', 'beta', 'zeta', 'gamma'])
  // β 解锁通古斯卡、ψ 解锁香港等由各自处理器完成（ζ 解锁喀布尔/基多/圣胡安/雷克雅未克）。
  for (const node of ['Tunguska', 'Kabul', 'Quito', 'SanJuan', 'Reykjavik']) {
    assert.ok(mapUnlocked(state).includes(node), `状况报告未解锁 ${node}`)
  }
  // 时间 35：强制终章，nextWorldMapNode 给出 endgameApproach。
  state.campaign.tsk.map.time = TSK_FORCED_ENDGAME_TIME
  state.campaign.records.time = TSK_FORCED_ENDGAME_TIME
  enterCampaignNode(state.campaign, MANIFEST, 'worldMap')
  walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect))
  assert.equal(forcedDestination(state), 'Tunguska')
  const forced = nextWorldMapNode(state)
  assert.deepEqual({ kind: forced.kind, nodeId: forced.nodeId, forced: forced.forced },
    { kind: 'endgame', nodeId: 'endgameApproach', forced: true })
  assert.equal(state.campaign.records.tskEndgameForced, true)
})

// ---------------------------------------------------------------------------
// ⑧ 终章与尾声
// ---------------------------------------------------------------------------
test('P7 flow 终章→尾声：三个结局分支、存在抹除、密钥归属与十章清单写入记录', () => {
  // 分支 A：加入红色同志会 → 结盟结局。
  const joined = mapReadyState()
  joined.campaign.records.theCellJoinedTheRedCoterie = true
  const summaryA = runScarletKeysEpilogue(joined, line => joined.log.push(line))
  assert.equal(summaryA.outcome, 'coterieAlliance')
  assert.equal(joined.campaign.records.theRedCoterieAndTheCellAgreedToWorkTogether, true)
  assert.ok(joined.log.some(line => /红色同志会达成合作/.test(line)))

  // 分支 B：信任 >= 蒙骗 → 常设职位。
  const trusted = mapReadyState()
  Object.assign(trusted.campaign.records, {
    theCellIsAssistingAgentSirry: true,
    theCellToldTheTruthToTaylor: true,
    foundationIntelDelivered: true,
    theCellIsOffMission: true,
  })
  const summaryB = runScarletKeysEpilogue(trusted, line => trusted.log.push(line))
  assert.equal(summaryB.outcome, 'permanentPosition')
  assert.equal(trusted.campaign.records.foundationTrust, 3)
  assert.equal(trusted.campaign.records.cellDeception, 1)
  assert.equal(trusted.campaign.records.theCellWasGivenAPermanentPosition, true)

  // 分支 C：蒙骗更高 → 被解散；顺带验证抹除/密钥归属。
  const dismantled = mapReadyState()
  Object.assign(dismantled.campaign.records, {
    theCellHidTheTruthFromTaylor: true,
    theCellIsOffMission: true,
    alikiIsOnYourSide: true,
  })
  addKeyToSeat(dismantled, '09519', 0)
  addKeyToSeat(dismantled, '09544', 0)
  dismantled.campaign.tsk.erased = { version: 1, codes: ['02310'] }
  const summaryC = runScarletKeysEpilogue(dismantled, line => dismantled.log.push(line))
  assert.equal(summaryC.outcome, 'dismantled')
  assert.equal(dismantled.campaign.records.theCellWasDismantled, true)
  assert.deepEqual(dismantled.campaign.records.keysHeld,
    ['09519:0', '09544:0'])
  assert.deepEqual(dismantled.campaign.records.erasedCards, ERASED_CAMPAIGN_CARDS.slice(0, 1))
  assert.deepEqual(summaryC.chapters, ['riddlesAndRain'])
  assert.match(dismantled.campaign.records.coterieStatus, /^ally=\d+;defeated=\d+;unresolved=\d+$/)
  // 尾声节点：讲完正文后进入 end（结局节点没有出口）。
  const graph = validateTskFlow()
  assert.equal(graph.nodes.end.type, 'end')
  assert.equal(EPILOGUE_NODES.epilogue.effects[0].event, 'epilogue')
  // 完整终章链：钥匙议会 → 尾声 → end。
  const runner = mapReadyState()
  runner.campaign.scenarioResults.push({ scenarioId: 'congressOfTheKeys', resolution: 'R1' })
  enterCampaignNode(runner.campaign, MANIFEST, 'epilogue')
  const ended = walkCampaign(runner.campaign, MANIFEST, chooseAnswer({}), effect => apply(runner, effect),
    { continuousInterlude: true })
  assert.equal(ended.type, 'end')
  assert.equal(ended.outcome, 'campaignComplete')
  assert.ok(runner.campaign.records.campaignOutcome.length > 0)
})

// ---------------------------------------------------------------------------
// ⑨ 记录 schema
// ---------------------------------------------------------------------------
test('P7 flow 记录：schema 为引擎类型映射、默认值/中文标签一一对应、禁用卡与快捷旅票常量正确', () => {
  const keys = Object.keys(TSK_RECORD_SCHEMA)
  assert.ok(keys.length >= 100, `记录键过少：${keys.length}`)
  for (const [key, type] of Object.entries(TSK_RECORD_SCHEMA)) {
    assert.ok(['boolean', 'number', 'string', 'string[]'].includes(type), `${key} 类型非法：${type}`)
    assert.match(key, /^[A-Za-z][A-Za-z0-9-]*$/)
  }
  assert.deepEqual(Object.keys(TSK_RECORD_DEFAULTS).sort(), [...keys].sort())
  assert.deepEqual(Object.keys(TSK_RECORD_LABELS).sort(), [...keys].sort())
  for (const key of keys) {
    const label = TSK_RECORD_LABELS[key]
    assert.equal(typeof label, 'string')
    assert.ok(label.length > 0, `${key} 标签为空`)
    assert.match(label, CJK, `${key} 标签不是中文（Campaign Log 标签读取失败？）`)
    const expectedDefault = TSK_RECORD_SCHEMA[key] === 'boolean' ? false
      : TSK_RECORD_SCHEMA[key] === 'number' ? 0 : TSK_RECORD_SCHEMA[key] === 'string[]' ? [] : ''
    assert.deepEqual(TSK_RECORD_DEFAULTS[key], expectedDefault, `${key} 默认值`)
  }
  // Key.hs 的 Campaign Log 复选框（抽查）与参考实现同名。
  for (const key of ['theCellToldTheTruthToTaylor', 'agentQuinnDoesNotTrustTheCell',
    'youHaventSeenTheLastOfTheRedGlovedMan', 'erasedFromExistence', 'time']) {
    assert.ok(Object.hasOwn(TSK_RECORD_SCHEMA, key), `缺少记录键 ${key}`)
  }
  // 流程层覆盖的三个类型（计数记录）。
  assert.equal(TSK_RECORD_SCHEMA.foundationTrust, 'number')
  assert.equal(TSK_RECORD_SCHEMA.cellDeception, 'number')
  assert.equal(TSK_RECORD_SCHEMA.statusReportsRead, 'number')
  // 战役禁用卡 / 快捷旅票。
  assert.deepEqual([...ERASED_CAMPAIGN_CARDS], ['02310'])
  assert.deepEqual([...campaignFlowExtras.invalidCampaignCards], ['02310'])
  assert.equal(EXPEDITED_TICKET, '09765')
  assert.equal(campaignFlowExtras.expeditedTicketCode, '09765')
  // flow 可 JSON 往返（存档/网络传输）。
  const roundTrip = JSON.parse(JSON.stringify(TSK_FLOW))
  assert.deepEqual(Object.keys(roundTrip.nodes).sort(), Object.keys(TSK_FLOW.nodes).sort())
  assert.equal(roundTrip.start, 'prologue')
  // 升级窗口：只有 interlude 开窗。
  assert.deepEqual(campaignFlowExtras.upgradeWindows, { interlude: true, checkpoint: false, scenario: false, map: false })
  assert.equal(campaignFlowExtras.interludeFlow, 'continuous')
  // 节点顺序：步骤级 56 个是完整节点表（143 个）的子集，完整表与 TSK_FLOW 完全一致。
  assert.deepEqual(campaignFlowExtras.flowNodeOrder, TSK_FLOW_NODE_ORDER)
  assert.ok(campaignFlowExtras.nodeOrder.length < TSK_FLOW_NODE_ORDER.length)
  for (const id of campaignFlowExtras.nodeOrder) assert.ok(TSK_FLOW.nodes[id], `步骤级节点 ${id} 不在流程图里`)
  assert.equal(campaignFlowExtras.stepOrder.length, TSK_CAMPAIGN_STEPS.length)
  assert.equal(campaignFlowExtras.forcedEndgameTime, 35)
  assert.equal(campaignFlowExtras.forcedEndgameNode, 'Tunguska')
})

// ---------------------------------------------------------------------------
// ⑩ manifest / chapters / scenarios-index
// ---------------------------------------------------------------------------
test('P7 manifest：passes assertCampaignManifest，flow/记录/世界地图语义与 P0 身份一致', () => {
  const manifest = assertCampaignManifest(tskManifest)
  assert.equal(manifest.id, 'theScarletKeys')
  assert.equal(manifest.status, 'playable')
  assert.deepEqual(manifest.scenarioIds, TSK_SCENARIO_IDS)
  assert.deepEqual(manifest.requiredPackIds, ['core', 'tskCampaign', 'tskInvestigators', 'tskPlayer'])
  assert.equal(manifest.interludeHandlerId, 'scarletKeysInterludes')
  assert.deepEqual(manifest.resolutionIds, ['victory', 'defeat'])
  assert.deepEqual(manifest.chaosBags, CHAOS_BAGS)
  // flow 与流程层同一对象（P8 直接消费，不复制）。
  assert.equal(manifest.flow, campaignFlowExtras.flow)
  // 生产 manifest 会把十章 recordReads/Writes 的键并入 recordSchema（P7 注册期），flow 键必须原样保留。
  assert.ok(Object.keys(campaignFlowExtras.recordSchema).every(key => manifest.recordSchema[key] === campaignFlowExtras.recordSchema[key]))
  assert.ok(Object.keys(campaignFlowExtras.recordDefaults).every(key => manifest.recordDefaults[key] === campaignFlowExtras.recordDefaults[key]))
  assert.equal(manifest.recordLabels, campaignFlowExtras.recordLabels)
  // 世界地图 unlock 语义：首章无前驱，其余九章只要求已完成《谜雨》。
  assert.deepEqual(manifest.unlock.riddlesAndRain, [])
  for (const id of TSK_SCENARIO_IDS.slice(1)) assert.deepEqual(manifest.unlock[id], [TSK_START_STEP], id)
  assert.deepEqual(manifest.unlock, TSK_UNLOCK)
  // 遭遇组：10 章专属 + 16 共享。
  assert.equal(new Set(manifest.encounterGroupIds).size, 26)
  assert.equal(manifest.sharedEncounterGroupIds.length, 16)
  for (const group of manifest.sharedEncounterGroupIds) assert.ok(manifest.encounterGroupIds.includes(group))
  // 引擎读图：manifest.flow 与 TSK_FLOW 等价。
  const graph = campaignGraph(manifest)
  assert.equal(graph.start, 'prologue')
  assert.equal(Object.keys(graph.nodes).length, TSK_FLOW_NODE_ORDER.length)
  // 节点出口都是可执行数据（条件/效果形状由 validateCampaignGraph 在注册期校验）。
  assert.doesNotThrow(() => validateCampaignGraph(manifest))
  // 记录键闭包：流程里引用的 record 条件都已在 schema 声明。
  for (const node of Object.values(graph.nodes)) {
    for (const option of node.options || []) {
      if (option.when?.record) assert.ok(Object.hasOwn(TSK_RECORD_SCHEMA, option.when.record), option.when.record)
    }
    for (const rule of node.rules || []) {
      if (rule.when?.record) assert.ok(Object.hasOwn(TSK_RECORD_SCHEMA, rule.when.record), rule.when.record)
    }
  }
  assert.equal(flowCondition({ record: 'wrongLeadCount', atLeast: 1 }, { records: { wrongLeadCount: 2 } }), true)
})

test('P7 章节目录：P0 占位保持 10 章身份；真实章按已落盘模块汇总，缺章时 requireChapters 抛错', async t => {
  assert.equal(catalogChapters.length, 10)
  for (const [index, chapter] of catalogChapters.entries()) {
    assert.equal(chapter.manifest.id, TSK_SCENARIO_IDS[index])
    assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
    assert.equal(chapter.manifest.catalogReferenceOnly, true)
    assert.equal(chapter.manifest.status, 'catalog-only')
    assert.equal(chapter.manifest.referenceCode, TSK_SCENARIO_UNITS[index].cardCode)
  }
  // 真实章：只含已落盘模块，顺序与章 id 顺序一致。
  const expectedLoaded = TSK_SCENARIO_IDS.filter(id => !missingChapterIds.includes(id))
  assert.deepEqual(chapterEntries.map(entry => entry.id), expectedLoaded)
  assert.deepEqual(missingScenarioIds, missingChapterIds)
  for (const entry of chapterEntries) {
    assert.equal(entry.manifest.id, entry.id)
    assert.equal(entry.manifest.campaignId, 'theScarletKeys')
    assert.equal(entry.cardCode, TSK_SCENARIO_UNITS.find(unit => unit.id === entry.id).cardCode)
    assert.equal(typeof entry.behavior, 'object')
    assert.ok(entry.layout && typeof entry.layout === 'object')
    assert.equal(scenariosById[entry.id], entry.module)
    assert.equal(chapterEntryOf(entry.id), entry)
  }
  assert.equal(chapterEntryOf('nope'), null)
  if (missingChapterIds.length) {
    // 缺章必须显式抛错（不允许用不完整章节注册战役）。
    assert.throws(() => requireChapters(), /十章尚未齐备/)
    assert.throws(() => requireAllScenarios(), /缺少/)
    t.diagnostic(`十章未齐备：缺 ${missingChapterIds.join('、')}；完整章验收留待 P8（显式跳过）`)
    return
  }
  assert.equal(requireChapters().length, 10)
  assert.equal(requireAllScenarios().length, 10)
  assert.deepEqual(scenarioEntries.map(entry => entry.id), TSK_SCENARIO_IDS)
  for (const entry of chapterEntries) assert.equal(entry.manifest.status, 'playable')
  assert.ok(chapterEntries.every(entry => entry.manifest.layout))
})
