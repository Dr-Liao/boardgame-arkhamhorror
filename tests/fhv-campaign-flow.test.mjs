// P7《铁杉谷盛宴》战役流程验收：流程图 / nextStep 语义 / 三天三夜路由 / 勘察选择规则 /
// 夜探分支 / 升级窗与 noUpgrade / 经验与结局分支 / 流程确定性。
//
// 覆盖（逐条对应 docs/campaign/theFeastOfHemlockVale/p7-campaign-layer-contract.md §3.2）：
//   ① 流程图：`validateFhvFlow` 注册期校验、12 个 scenario 节点、4 个整备 interlude、全节点可达；
//   ② nextStep 语义：`fhvNextStep` 与参考 `TheFeastOfHemlockVale.hs#nextStep`/`handleTime` 逐槽对照；
//   ③ 勘察选择：五个勘察关卡 + 「按未勘察区域选择」规则（欢迎序曲不过滤、其余槽位过滤）；
//   ④ 夜 1/夜 2 分支：`theTwistedHollow`/勘察、`theLongestNight`/勘察、夜 3 固定 `fateOfTheVale`；
//   ⑤ 实走三天三夜：日间勘察 → 首夜 → 第二日 → 第二夜 → 最终日 → 最终夜 → 终章 → 尾声；
//   ⑥ 跳过白日勘察的调度重抽（时钟推进 + 记录）；
//   ⑦ 升级窗/noUpgrade 与未花费经验；
//   ⑧ 结局分支（victory/defeat）与尾声记录；
//   ⑨ manifest（playable / scenarioIds 12 / flow 同一对象 / unlock 前驱闭包）；
//   ⑩ 流程确定性（raw 节点表可重复生成、JSON 往返一致、正文键可解析）。
//
// 注：story-text.js 的 zh 层目前为空（本地自译层已写 492 条但尚未 `--write` 重新生成），
// 因此本文件只断言「正文/标题与 story-text 一致且非空」，不强求中文。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { assertCampaignManifest } from '../content/schema.js'
import {
  FHV_FLOW, FHV_FLOW_NODE_ORDER, FHV_NO_UPGRADE_WINDOWS, FHV_STEP_OF_NODE, PREP_STEPS, SPECIAL_RULE_KEYS,
  SURVEY_ROUTER_ID, SURVEY_ROUTER_RULES, campaignFlowExtras, fhvNextNodeFor, rawFhvFlowNodes,
  upgradeWindowForNode, validateFhvFlow,
} from '../content/campaigns/theFeastOfHemlockVale/flow.js'
import {
  FHV_CHAPTER_RECORD_TYPES, FHV_UNLOCK, manifest as fhvManifest,
} from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import {
  FHV_AREAS, FHV_ENDGAME_SCENARIO_ID, FHV_EVENING_STEPS, FHV_HANDLE_TIME, FHV_NIGHT_BRANCHES,
  FHV_NIGHT_OPTIONS, FHV_PRELUDE_SCENARIO_IDS, FHV_SCENARIO_IDS, FHV_SLOTS, FHV_SLOT_DATE,
  FHV_SURVEY_SCENARIO_IDS, areaOfScenario, campaignStoryHeading, campaignStoryLabel,
  fhvNextStep, fhvParseDate, fhvSlot, fhvSurveyCandidates, fhvSurveyOptions, isMainlineStep, scenarioKind,
  scenarioUnitOf,
} from '../content/campaigns/theFeastOfHemlockVale/parts.js'
import {
  FHV_RECORD_DEFAULTS, FHV_RECORD_LABELS, FHV_RECORD_TYPES, FHV_RESIDENTS, surveyedAreas,
} from '../content/campaigns/theFeastOfHemlockVale/records.js'
import { CHAOS_BAGS } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { EPILOGUE_NODES, FHV_OUTCOMES, fhvEpilogueBranch } from '../content/campaigns/theFeastOfHemlockVale/epilogue.js'

// ---------------------------------------------------------------------------
// 夹具：内容层最小战役状态（不 import engine.js，不依赖大厅路线）
// ---------------------------------------------------------------------------
const MANIFEST = Object.freeze({
  id: 'theFeastOfHemlockVale',
  scenarioIds: FHV_SCENARIO_IDS,
  recordSchema: FHV_RECORD_TYPES,
  flow: FHV_FLOW,
})

function newState ({ seats = 2, difficulty = 'standard' } = {}) {
  const investigators = {}
  for (let seat = 0; seat < seats; seat += 1) {
    investigators[seat] = {
      seat, id: `inv-${seat}`, code: '10001', name: `investigator ${seat + 1}`, status: 'active',
      deck: [], xp: 0, earnedXp: 0, spentXp: 0, trauma: { physical: 0, mental: 0 }, purchases: [], removedCards: [],
    }
  }
  const campaign = {
    records: structuredClone(FHV_RECORD_DEFAULTS),
    recordSchema: FHV_RECORD_TYPES,
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
      log: [],
    },
  }
}

/** 与引擎一致的效果分派：`record`/`increment` 由 walkCampaign 处理，其余走 applyCampaignEffect。 */
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
 * 走 flow 直到可交互停点。`answers` 按 choice/stepReturn 节点 id 给选项（缺省取第一个可用项）；
 * scenario 由调用方「结算」后按节点出口继续（与引擎 `finishScenario` 的 pendingNode 同一推进方式）。
 * 选择记录在 `campaign.flow.history[].choice`（引擎同口径），由 `choicesOf` 读取。
 */
function play (state, { answers = {}, onScenario = null, maxStops = 120 } = {}) {
  const graph = validateCampaignGraph(MANIFEST)
  const visited = []
  for (let step = 0; step < maxStops * 4; step += 1) {
    const node = walkCampaign(state.campaign, MANIFEST, chooseAnswer(answers), effect => apply(state, effect),
      { continuousInterlude: true })
    if (node.type === 'end') {
      visited.push('end')
      return { visited, ended: true, node, choices: choicesOf(state) }
    }
    if (node.type === 'scenario') {
      visited.push(`scenario:${node.scenarioId}`)
      state.campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
      onScenario?.(node, state)
      enterCampaignNode(state.campaign, MANIFEST, graph.nodes[node.scenarioId].next)
      continue
    }
    visited.push(`stop:${node.id}`)
    enterCampaignNode(state.campaign, MANIFEST, graph.nodes[node.id].next)
  }
  throw new Error('flow did not stop within the safety budget')
}

/** 战役图上的选择记录（`<nodeId>:<optionId>` 或 `surveyRouter:<slot>`，按发生顺序）。 */
function choicesOf (state) {
  return (state.campaign.flow?.history || [])
    .filter(visit => visit.choice)
    .map(visit => `${visit.nodeId}:${visit.choice}`)
}

function collectRecordKeys (condition, out = []) {
  if (!condition || typeof condition !== 'object') return out
  if (typeof condition.record === 'string') out.push(condition.record)
  if (condition.hasRecord?.key) out.push(condition.hasRecord.key)
  for (const child of condition.all || []) collectRecordKeys(child, out)
  for (const child of condition.any || []) collectRecordKeys(child, out)
  if (condition.not) collectRecordKeys(condition.not, out)
  return out
}

// 一条完整的三天三夜路线（时间轴全覆盖：日间勘察 + 两个夜探分支 + 终章）。
const FULL_RUN = Object.freeze({
  surveyChoiceDay1: 'writtenInRock',
  firstEveningCodex: 'skipCodex',
  firstEveningMeal: 'dontEatAnymore',
  firstEveningChoice: 'gatherMoreInformation',
  surveyChoiceNight1: 'hemlockHouse',
  surveyChoiceDay2: 'theSilentHeath',
  secondEveningCodex: 'skipCodex',
  secondEveningChoice: 'followDrMarquez',
  surveyChoiceDay3: 'theLostSister',
})

// ---------------------------------------------------------------------------
// ① 流程图
// ---------------------------------------------------------------------------
test('P7 campaign 流程图：注册期校验通过，12 个场景步 + 4 个整备 interlude + 全节点可达', () => {
  const graph = validateFhvFlow()
  assert.equal(graph.start, 'prologue')
  assert.equal(FHV_FLOW.start, 'prologue')
  assert.deepEqual(FHV_FLOW_NODE_ORDER, Object.keys(FHV_FLOW.nodes))
  // 12 个 ScenarioStep 全是 scenario 节点（节点表插入顺序与 CampaignSteps.hs 不同，按集合比较）。
  const scenarioNodeIds = Object.values(graph.nodes).filter(node => node.type === 'scenario').map(node => node.scenarioId)
  assert.deepEqual([...scenarioNodeIds].sort(), [...FHV_SCENARIO_IDS].sort())
  assert.equal(scenarioNodeIds.length, 12)
  assert.equal(FHV_SCENARIO_IDS.length, 12)
  assert.deepEqual(FHV_PRELUDE_SCENARIO_IDS,
    ['welcomeToHemlockVale', 'dawnOfTheSecondDay', 'dawnOfTheFinalDay', 'preludeTheFinalEvening'])
  assert.deepEqual(FHV_SURVEY_SCENARIO_IDS,
    ['writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths'])
  // 四段序曲整备：唯一开升级窗的位置。
  for (const spec of PREP_STEPS) {
    const node = graph.nodes[spec.nodeId]
    assert.equal(node.type, 'interlude', `${spec.nodeId} should be interlude`)
    assert.equal(node.upgrades, true)
    assert.equal(upgradeWindowForNode(node), true)
  }
  assert.equal(campaignFlowExtras.upgradeWindowNodes.length, 4)
  assert.deepEqual(campaignFlowExtras.upgradeWindows, { interlude: true, checkpoint: false, scenario: false, map: false })
  // 从序曲直接进入的勘察/夜章/终章不开窗（参考 `noUpgrade`）。
  const noUpgradeIds = FHV_NO_UPGRADE_WINDOWS.map(row => row.stepId)
  assert.deepEqual(noUpgradeIds, [...FHV_SURVEY_SCENARIO_IDS, 'theTwistedHollow', 'theLongestNight', FHV_ENDGAME_SCENARIO_ID])
  for (const stepId of noUpgradeIds) {
    const node = graph.nodes[stepId]
    assert.equal(node.type, 'scenario')
    assert.equal(node.noUpgrade, true, `${stepId} should be marked noUpgrade`)
    assert.notEqual(upgradeWindowForNode(node), true)
  }
  // 两段纯叙事夜是 story/choice 节点（参考的 CampaignSpecificStep）。
  assert.equal(graph.nodes.preludeTheFirstEvening.type, 'story')
  assert.equal(graph.nodes.preludeTheSecondEvening.type, 'story')
  assert.equal(graph.nodes.firstEveningCodex.type, 'choice')
  assert.equal(graph.nodes.secondEveningCodex.type, 'choice')
  // 路由节点：6 条时间槽规则 + 兜底出口。
  assert.equal(graph.nodes[SURVEY_ROUTER_ID].type, 'stepReturn')
  assert.equal(SURVEY_ROUTER_RULES.length, FHV_SLOTS.length)
  assert.deepEqual(SURVEY_ROUTER_RULES.map(rule => rule.next), FHV_SLOTS.map(slot => FHV_HANDLE_TIME[slot]))
  // 尾声与结局节点。
  assert.equal(graph.nodes.epilogue.next, 'end')
  assert.equal(graph.nodes.end.type, 'end')
  assert.equal(graph.nodes.end.next, undefined)
  // 全节点可达（含 choice/stepReturn 的全部出口）。
  const reachable = new Set()
  const queue = [graph.start]
  while (queue.length) {
    const id = queue.shift()
    if (!id || reachable.has(id) || !graph.nodes[id]) continue
    reachable.add(id)
    const node = graph.nodes[id]
    const edges = node.type === 'stepReturn' ? [...node.rules.map(rule => rule.next), node.next]
      : node.options ? [...node.options.map(option => option.next), node.next]
        : node.next ? [node.next] : []
    for (const next of edges) if (next && !reachable.has(next)) queue.push(next)
  }
  assert.deepEqual(FHV_FLOW_NODE_ORDER.filter(id => !reachable.has(id)), [], 'unreachable nodes')
  assert.equal(FHV_FLOW_NODE_ORDER.length, 35)
  // 最终夜之后的失败分支路由（参考 Resolution 3 的「输掉战役」）。
  assert.equal(graph.nodes.finalEveningOutcome.type, 'stepReturn')
  assert.equal(graph.nodes.finalEveningOutcome.next, 'finalEveningPrep')
  assert.deepEqual(graph.nodes.finalEveningOutcome.rules.map(rule => rule.next),
    ['epilogue', 'epilogue'])
  assert.equal(graph.nodes.preludeTheFinalEvening.next, 'finalEveningOutcome')
  // 节点 → 步骤反查表覆盖全部流程节点。
  for (const id of FHV_FLOW_NODE_ORDER) assert.ok(FHV_STEP_OF_NODE[id], `missing step mapping: ${id}`)
})

// ---------------------------------------------------------------------------
// ② nextStep 语义
// ---------------------------------------------------------------------------
test('P7 campaign nextStep：镜照参考 handleTime（三天三夜六槽）与固定夜章出口', () => {
  assert.deepEqual(fhvNextStep('prologue'), ['welcomeToHemlockVale'])
  // handleTime 六槽（参考 nextStep 的 (day, time) 分支）。
  assert.deepEqual(FHV_HANDLE_TIME, {
    day1: 'preludeTheFirstEvening', night1: 'dawnOfTheSecondDay',
    day2: 'preludeTheSecondEvening', night2: 'dawnOfTheFinalDay',
    day3: 'preludeTheFinalEvening', night3: 'preludeTheFinalEvening',
  })
  for (const slot of FHV_SLOTS) {
    assert.deepEqual(fhvNextStep('writtenInRock', { slot }), [FHV_HANDLE_TIME[slot]], slot)
    const date = FHV_SLOT_DATE[slot]
    assert.deepEqual(fhvNextStep('hemlockHouse', { records: { hemlockDate: `${date.day}:${date.period}` } }),
      [FHV_HANDLE_TIME[slot]], `${slot} from records`)
  }
  // 固定夜章出口：扭曲空洞 → 第二日黎明；最长一夜 → 最终日黎明；终章 → 尾声。
  assert.deepEqual(fhvNextStep('theTwistedHollow'), ['dawnOfTheSecondDay'])
  assert.deepEqual(fhvNextStep('theLongestNight'), ['dawnOfTheFinalDay'])
  assert.deepEqual(fhvNextStep(FHV_ENDGAME_SCENARIO_ID), ['epilogue'])
  assert.deepEqual(fhvNextStep('epilogue'), [])
  assert.deepEqual(fhvNextStep('nope'), [])
  // Day3 任何时段都进入最终夜（参考 `(Day3, _)`）。
  assert.deepEqual(fhvNextStep('theThingInTheDepths', { day: 3, period: 'day' }), ['preludeTheFinalEvening'])
  assert.deepEqual(fhvNextStep('theThingInTheDepths', { day: 3, period: 'night' }), ['preludeTheFinalEvening'])
  // 时间轴日期字符串 ↔ 槽位（引擎 scenario-calendar 的 `day:period` 形状）。
  for (const slot of FHV_SLOTS) {
    const date = FHV_SLOT_DATE[slot]
    assert.deepEqual(fhvParseDate({ hemlockDate: `${date.day}:${date.period}` }), date)
    assert.equal(fhvSlot({ hemlockDate: `${date.day}:${date.period}` }), slot)
  }
  assert.equal(fhvParseDate({ hemlockDate: '9:day' }), null)
  assert.equal(fhvSlot({}), null)
  // 纯函数路由读点。
  assert.equal(fhvNextNodeFor('writtenInRock', { hemlockDate: '1:night' }), 'dawnOfTheSecondDay')
  // 主线判定：12 步 + 2 段纯叙事夜 + 序幕/尾声。
  for (const id of FHV_SCENARIO_IDS) assert.equal(isMainlineStep(id), true, id)
  for (const id of FHV_EVENING_STEPS) assert.equal(isMainlineStep(id), true, id)
  assert.equal(isMainlineStep('surveyRouter'), false)
  assert.equal(isMainlineStep('end'), false)
})

// ---------------------------------------------------------------------------
// ③ 勘察选择规则
// ---------------------------------------------------------------------------
test('P7 campaign 勘察选择：五个关卡按未勘察区域过滤，欢迎序曲五区全开', () => {
  // 空记录：五区全可选。
  for (const slot of ['day1', 'night1', 'day2', 'night2', 'day3']) {
    assert.deepEqual(fhvSurveyCandidates(slot, {}), [...FHV_SURVEY_SCENARIO_IDS], slot)
  }
  // 区域记录（集合口径）。
  const bySet = { areasSurveyed: ['northPointMine'] }
  assert.deepEqual(fhvSurveyCandidates('day2', bySet), FHV_SURVEY_SCENARIO_IDS.filter(id => id !== 'writtenInRock'))
  assert.deepEqual(surveyedAreas(bySet), ['northPointMine'])
  // 区域记录（章节布尔键口径，含两个同义键）。
  assert.deepEqual(surveyedAreas({ areaNorthPointMineSurveyed: true }), ['northPointMine'])
  assert.deepEqual(surveyedAreas({ areasSurveyedNorthPointMine: true }), ['northPointMine'])
  assert.deepEqual(surveyedAreas({ hemlockHarborSurveyed: true, pearlRidgeSurveyed: true }),
    ['hemlockHarbor', 'pearlRidge'])
  assert.deepEqual(surveyedAreas({ areasSurveyedSouthernFields: true, areasSurveyedWesternWoods: true }),
    ['westernWoods', 'southernFields'])
  // 欢迎序曲（day1）不过滤：已勘察区域仍然出现（参考 EndOfScenario 无 `survey` 过滤）。
  assert.deepEqual(fhvSurveyCandidates('day1', bySet), [...FHV_SURVEY_SCENARIO_IDS])
  assert.deepEqual(fhvSurveyOptions('day1', bySet).map(option => option.surveyed), [true, false, false, false, false])
  // 其余槽位过滤（参考 `unless (k elem areas)`）。
  for (const slot of ['night1', 'day2', 'night2', 'day3']) {
    assert.deepEqual(fhvSurveyCandidates(slot, bySet), FHV_SURVEY_SCENARIO_IDS.filter(id => id !== 'writtenInRock'), slot)
  }
  // 流程图里的过滤条件与上面的规则一致（`when` 在已勘察时不可用）。
  const graph = validateFhvFlow()
  const campaign = { records: { ...structuredClone(FHV_RECORD_DEFAULTS), areasSurveyed: ['northPointMine'] } }
  const available = node => node.options
    .filter(option => !option.when || flowCondition(option.when, campaign))
    .map(option => option.id)
  assert.deepEqual(available(graph.nodes.surveyChoiceNight1),
    [...FHV_SURVEY_SCENARIO_IDS.filter(id => id !== 'writtenInRock'), 'reschedule'])
  assert.deepEqual(available(graph.nodes.surveyChoiceDay1), [...FHV_SURVEY_SCENARIO_IDS, 'reschedule'])
  // 区域 ↔ 关卡身份表。
  assert.deepEqual(FHV_AREAS.map(area => area.scenarioId), [
    'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
    'theTwistedHollow', 'theLongestNight',
  ])
  assert.equal(areaOfScenario('theTwistedHollow').id, 'westernWoods')
  assert.equal(areaOfScenario('fateOfTheVale'), null)
  assert.equal(scenarioKind('writtenInRock'), 'survey')
  assert.equal(scenarioKind('fateOfTheVale'), 'endgame')
  assert.equal(scenarioUnitOf('nope'), null)
})

// ---------------------------------------------------------------------------
// ④ 夜探分支
// ---------------------------------------------------------------------------
test('P7 campaign 夜探分支：夜 1 扭曲空洞/勘察、夜 2 最长一夜/勘察、夜 3 固定终章', () => {
  assert.deepEqual(FHV_NIGHT_OPTIONS, {
    night1: ['theTwistedHollow', 'survey'],
    night2: ['theLongestNight', 'survey'],
    night3: ['fateOfTheVale'],
  })
  assert.equal(FHV_NIGHT_BRANCHES.night1.fixed.scenarioId, 'theTwistedHollow')
  assert.equal(FHV_NIGHT_BRANCHES.night2.fixed.scenarioId, 'theLongestNight')
  const graph = validateFhvFlow()
  assert.deepEqual(graph.nodes.firstEveningChoice.options.map(option => option.id),
    ['searchForBertie', 'gatherMoreInformation'])
  assert.deepEqual(graph.nodes.secondEveningChoice.options.map(option => option.id),
    ['followDrMarquez', 'gatherMoreInformation'])
  assert.equal(graph.nodes.firstEveningChoice.options[0].next, 'theTwistedHollow')
  assert.equal(graph.nodes.firstEveningChoice.options[1].next, 'surveyChoiceNight1')
  assert.equal(graph.nodes.secondEveningChoice.options[0].next, 'theLongestNight')
  assert.equal(graph.nodes.secondEveningChoice.options[1].next, 'surveyChoiceNight2')
  // 夜探的「再查一处」分支向战役混乱袋加标记（参考 addChaosToken）。
  const chaosTokens = effects => effects.filter(effect => effect.type === 'chaos').map(effect => effect.token)
  assert.deepEqual(chaosTokens(graph.nodes.firstEveningChoice.options[1].effects), ['tablet', 'elderthing'])
  assert.deepEqual(chaosTokens(graph.nodes.secondEveningChoice.options[1].effects), ['skull', 'cultist', 'elderthing'])
  // 夜 3 没有分支：最终夜整备直接进终章。
  assert.equal(graph.nodes.finalEveningPrep.next, FHV_ENDGAME_SCENARIO_ID)
  assert.equal(graph.nodes.theTwistedHollow.next, 'dawnOfTheSecondDay')
  // 最长一夜之后先过疲劳，再到最终日黎明。
  assert.equal(graph.nodes.theLongestNight.next, 'fatigue')
  assert.equal(graph.nodes.fatigue.next, 'dawnOfTheFinalDay')
  assert.equal(graph.nodes.fatigue.effects[0].event, 'fatigue')
})

// ---------------------------------------------------------------------------
// ⑤ 实走三天三夜
// ---------------------------------------------------------------------------
test('P7 campaign 实走：欢迎→首夜→第二日→第二夜→最终日→最终夜→终章→尾声（时间轴全覆盖）', () => {
  const { state } = newState()
  const run = play(state, { answers: FULL_RUN })
  assert.deepEqual(run.visited, [
    'scenario:welcomeToHemlockVale', 'scenario:writtenInRock',
    'scenario:hemlockHouse', 'scenario:dawnOfTheSecondDay', 'scenario:theSilentHeath',
    'scenario:theLongestNight', 'scenario:dawnOfTheFinalDay', 'scenario:theLostSister',
    'scenario:preludeTheFinalEvening', 'scenario:fateOfTheVale', 'end',
  ])
  assert.equal(run.ended, true)
  // 战役图上的选择顺序（勘察选择 / 时间路由 / 序曲夜 / 夜探）。
  assert.deepEqual(run.choices, [
    'surveyChoiceDay1:writtenInRock', 'surveyRouter:day1',
    'firstEveningCodex:skipCodex', 'firstEveningMeal:dontEatAnymore', 'firstEveningChoice:gatherMoreInformation',
    'surveyChoiceNight1:hemlockHouse', 'surveyRouter:night1',
    'surveyChoiceDay2:theSilentHeath', 'surveyRouter:day2',
    'secondEveningCodex:skipCodex', 'secondEveningChoice:followDrMarquez',
    'surveyChoiceDay3:theLostSister', 'surveyRouter:day3',
  ])
  const records = state.campaign.records
  // 时钟最终停在最终夜（preludeTheFinalEvening 入场把时钟拨到 3:night）。
  assert.equal(records.hemlockDate, '3:night')
  assert.equal(records.day, 3)
  assert.equal(records.time, 'night')
  // 勘察选择与夜探分支都落在记录里（顺序即实走顺序）。
  assert.deepEqual(records.surveyChoices,
    ['day1:writtenInRock', 'night1:hemlockHouse', 'day2:theSilentHeath', 'day3:theLostSister'])
  assert.deepEqual(records.nightBranches, ['night1:gatherMoreInformation', 'night2:followDrMarquez:theLongestNight'])
  // 12 个场景里这一局走了 10 个（勘察/夜探是互斥选择，一局打不完）。
  assert.equal(state.campaign.scenarioResults.length, 10)
  assert.ok(state.log.some(line => /时钟推进到第 1 日夜晚/.test(line)))
  assert.ok(state.log.some(line => /序曲整备（day1）/.test(line)))
  assert.ok(state.log.some(line => /疲劳/.test(line)))
})

test('P7 campaign 实走：夜探固定分支（扭曲空洞）走第二天，勘察分支走夜 1 勘察', () => {
  const twisted = newState()
  const run = play(twisted.state, {
    answers: {
      surveyChoiceDay1: 'writtenInRock',
      firstEveningCodex: 'skipCodex',
      firstEveningMeal: 'keepEating',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'hemlockHouse',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'theSilentHeath',
    },
  })
  assert.ok(run.visited.includes('scenario:theTwistedHollow'))
  assert.equal(twisted.state.campaign.records.finishedTheirMeal, true)
  assert.deepEqual(twisted.state.campaign.records.nightBranches,
    ['night1:searchForBertie:theTwistedHollow', 'night2:followDrMarquez:theLongestNight'])
  // 扭曲空洞之后直接进第二天黎明（夜探固定分支）。
  const idx = run.visited.indexOf('scenario:theTwistedHollow')
  assert.equal(run.visited[idx + 1], 'scenario:dawnOfTheSecondDay')
})

// ---------------------------------------------------------------------------
// ⑥ 跳过白日勘察的调度重抽
// ---------------------------------------------------------------------------
test('P7 campaign 调度重抽：跳过本次勘察把时钟推到下一段并继续路线', () => {
  const { state } = newState()
  const run = play(state, {
    answers: {
      surveyChoiceDay1: 'reschedule',
      firstEveningCodex: 'skipCodex',
      firstEveningMeal: 'dontEatAnymore',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'reschedule',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'reschedule',
    },
  })
  assert.ok(!run.visited.includes('scenario:writtenInRock'), 'skipping the day survey must not play a survey')
  assert.ok(!run.visited.includes('scenario:hemlockHouse'), 'skipping the day survey must not play a survey')
  assert.deepEqual(run.choices.slice(0, 3), [
    'surveyChoiceDay1:reschedule', 'firstEveningCodex:skipCodex', 'firstEveningMeal:dontEatAnymore',
  ])
  assert.deepEqual(state.campaign.records.rescheduledSurveys, ['day1->night1', 'day2->night2', 'day3->night3'])
  assert.ok(state.log.some(line => /跳过本次白日勘察/.test(line)))
  assert.equal(run.ended, true)
})

// ---------------------------------------------------------------------------
// ⑦ 升级窗 / 未花费经验
// ---------------------------------------------------------------------------
test('P7 campaign 升级窗与经验：整备节点开窗、未花费经验快照、序曲法典奖励', () => {
  const { state } = newState({ seats: 2 })
  play(state, {
    answers: {
      surveyChoiceDay1: 'writtenInRock',
      firstEveningCodex: 'theta',
      firstEveningMeal: 'keepEating',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'reschedule',
      secondEveningCodex: 'alone',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'reschedule',
    },
  })
  const records = state.campaign.records
  // 法典 theta：蕾切尔嬷嬷关系 +1、每人 +1 经验（未花费经验快照随之更新）。
  assert.equal(records.motherRachelRelationshipLevel, 1)
  assert.equal(records.relationships.motherRachel, 1)
  assert.equal(records.unspentXp, 4)
  assert.deepEqual(Object.values(state.campaign.investigators).map(record => record.xp), [2, 2])
  // 两段纯叙事夜的法典选择都记账。
  assert.deepEqual(records.codexRead, ['theta', 'alone'])
  // 升级窗判据：唯一开窗的是四个整备 interlude。
  const graph = validateFhvFlow()
  const windows = Object.entries(graph.nodes).filter(([, node]) => upgradeWindowForNode(node)).map(([id]) => id)
  assert.deepEqual(windows, PREP_STEPS.map(spec => spec.nodeId))
})

// ---------------------------------------------------------------------------
// ⑧ 结局分支
// ---------------------------------------------------------------------------
test('P7 campaign 结局：牺牲/山谷命运记录分支出 victory|defeat 并写入尾声记录', () => {
  const base = () => structuredClone(FHV_RECORD_DEFAULTS)
  assert.equal(fhvEpilogueBranch(base()).outcome, 'defeat')
  assert.equal(fhvEpilogueBranch({ ...base(), [FHV_OUTCOMES.marquezSacrificed]: true }).id, 'marquezSacrificed')
  assert.equal(fhvEpilogueBranch({ ...base(), [FHV_OUTCOMES.investigatorsSacrificed]: true }).outcome, 'victory')
  assert.equal(fhvEpilogueBranch({ ...base(), [FHV_OUTCOMES.valeBurned]: true }).outcome, 'defeat')
  assert.equal(fhvEpilogueBranch({ ...base(), [FHV_OUTCOMES.valeSaved]: true }).outcome, 'victory')
  assert.equal(fhvEpilogueBranch({ ...base(), [FHV_OUTCOMES.devoured]: true }).outcome, 'defeat')
  // 完整实走：终章后进入尾声，写 campaignOutcome 与尾声法典清单。
  const { state } = newState()
  const run = play(state, {
    answers: {
      surveyChoiceDay1: 'writtenInRock',
      firstEveningCodex: 'skipCodex',
      firstEveningMeal: 'dontEatAnymore',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'hemlockHouse',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'reschedule',
    },
  })
  assert.equal(run.ended, true)
  assert.equal(run.node.outcome, 'campaignComplete')
  assert.equal(state.campaign.records.campaignOutcome, 'defeat')
  assert.equal(state.campaign.records.campaignOutcomeBranch, 'otherwise')
  assert.equal(state.campaign.records.fhvResolution, 'defeat')
  assert.deepEqual(state.campaign.records.epilogueCodex, ['atwoods'])
  assert.ok(Array.isArray(state.campaign.records.survivingResidents))
  assert.equal(EPILOGUE_NODES.end.type, 'end')
  // 尾声的 effects 指向尾声处理器。
  assert.equal(EPILOGUE_NODES.epilogue.effects[0].handler, 'fhvEpilogue')
  // 失败分支：最终夜章节写下「输掉战役」后，流程直接进尾声（`finalEveningOutcome` 的规则命中）。
  const lost = newState()
  lost.state.campaign.records.preludeTheFinalEveningNextStep = 'lost'
  const failed = play(lost.state, {
    answers: {
      surveyChoiceDay1: 'reschedule',
      firstEveningCodex: 'skipCodex',
      firstEveningMeal: 'dontEatAnymore',
      firstEveningChoice: 'searchForBertie',
      surveyChoiceDay2: 'reschedule',
      secondEveningCodex: 'skipCodex',
      secondEveningChoice: 'followDrMarquez',
      surveyChoiceDay3: 'reschedule',
    },
  })
  assert.ok(failed.visited.includes('scenario:preludeTheFinalEvening'))
  assert.ok(!failed.visited.includes('scenario:fateOfTheVale'), '输掉战役时不再进终章')
  assert.equal(failed.visited.at(-1), 'end')
  assert.equal(failed.choices.at(-1), 'finalEveningOutcome:campaignLost')
})

// ---------------------------------------------------------------------------
// ⑨ manifest
// ---------------------------------------------------------------------------
test('P7 campaign manifest：playable、12 个 scenarioIds、flow 同一对象、unlock 前驱闭包', () => {
  const manifest = assertCampaignManifest(fhvManifest)
  assert.equal(manifest.id, 'theFeastOfHemlockVale')
  assert.equal(manifest.status, 'playable')
  assert.deepEqual(manifest.scenarioIds, FHV_SCENARIO_IDS)
  assert.deepEqual(manifest.requiredPackIds, ['core', 'fhvCampaign', 'fhvInvestigators', 'fhvPlayer'])
  assert.equal(manifest.interludeHandlerId, 'fhvInterludes')
  assert.deepEqual(manifest.resolutionIds, ['victory', 'defeat'])
  assert.deepEqual(manifest.chaosBags, CHAOS_BAGS)
  assert.equal(manifest.flow, campaignFlowExtras.flow)
  assert.deepEqual(manifest.unlock, FHV_UNLOCK)
  // unlock 前驱必须出现在更早的 scenarioIds 位置（schema 同口径）。
  for (const [scenarioId, prior] of Object.entries(manifest.unlock)) {
    for (const id of prior) {
      assert.ok(manifest.scenarioIds.indexOf(id) < manifest.scenarioIds.indexOf(scenarioId),
        `${scenarioId} prior ${id} must come earlier`)
    }
  }
  assert.deepEqual(manifest.unlock.welcomeToHemlockVale, [])
  assert.deepEqual(manifest.unlock.fateOfTheVale, ['preludeTheFinalEvening'])
  // 记录 schema：流程层键 + 章级键的并集都在；类型全是引擎四种之一。
  for (const [key, type] of Object.entries(manifest.recordSchema)) {
    assert.ok(['boolean', 'number', 'string', 'string[]'].includes(type), `${key} has invalid type: ${type}`)
  }
  assert.deepEqual(Object.keys(manifest.recordSchema).sort(),
    [...new Set([...Object.keys(FHV_RECORD_TYPES), ...Object.keys(FHV_CHAPTER_RECORD_TYPES)])].sort())
  assert.ok(Object.keys(FHV_CHAPTER_RECORD_TYPES).length >= 5)
  assert.deepEqual(Object.keys(manifest.recordDefaults).sort(), Object.keys(manifest.recordSchema).sort())
  // 居民清单 / 传家宝（引擎读点）。
  assert.equal(manifest.residents.length, FHV_RESIDENTS.length)
  for (const row of manifest.residents) {
    assert.equal(typeof row.name, 'string')
    assert.equal(row.record.max, 5)
    assert.equal(manifest.recordSchema[row.record.level], 'number')
    assert.equal(manifest.recordSchema[row.record.notes], 'string[]')
  }
  assert.deepEqual(manifest.heirloomCodes, ['10713', '10714', '10715'])
  // 勘察/夜探语义随 flow 片段一起导出。
  assert.deepEqual(manifest.surveyScenarios, FHV_SURVEY_SCENARIO_IDS)
  assert.equal(manifest.endgameScenarioId, 'fateOfTheVale')
  assert.equal(manifest.epilogueStep, 'epilogue')
  assert.equal(manifest.surveyRouterNodeId, SURVEY_ROUTER_ID)
  assert.equal(manifest.interludeFlow, 'continuous')
  assert.equal(manifest.chaosBagTransitions.length, 7)
  // 引擎读图：manifest.flow 与 FHV_FLOW 等价。
  const graph = validateCampaignGraph(manifest)
  assert.equal(graph.start, 'prologue')
  assert.equal(Object.keys(graph.nodes).length, FHV_FLOW_NODE_ORDER.length)
  // 流程里的 record 条件都已在 schema 声明（注册期闭包要求在 manifest 上也成立）。
  for (const node of Object.values(graph.nodes)) {
    const conditions = [
      ...(node.options || []).map(option => option.when),
      ...(node.rules || []).map(rule => rule.when),
      ...(node.greens || []).map(green => green.when),
      ...(node.branches || []).map(branch => branch.when),
      node.textWhen,
    ].filter(Boolean)
    for (const condition of conditions) {
      for (const key of collectRecordKeys(condition)) {
        assert.ok(Object.hasOwn(manifest.recordSchema, key), `undeclared record ${key}`)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// ⑩ 确定性
// ---------------------------------------------------------------------------
test('P7 campaign 流程确定性：raw 节点表可重复生成，FHV_FLOW 可 JSON 往返', () => {
  const first = rawFhvFlowNodes()
  const second = rawFhvFlowNodes()
  assert.deepEqual(Object.keys(first).sort(), Object.keys(FHV_FLOW.nodes).sort())
  assert.deepEqual(Object.keys(first), Object.keys(second))
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  const roundTrip = JSON.parse(JSON.stringify(FHV_FLOW))
  assert.deepEqual(Object.keys(roundTrip.nodes).sort(), [...FHV_FLOW_NODE_ORDER].sort())
  assert.equal(roundTrip.start, 'prologue')
  assert.deepEqual(roundTrip.nodes.surveyChoiceNight1.options.map(option => option.id),
    [...FHV_SURVEY_SCENARIO_IDS, 'reschedule'])
  // 正文键都来自 story-text（可解析且非空），节点里没有手写死剧情。
  for (const [id, node] of Object.entries(FHV_FLOW.nodes)) {
    for (const key of [node.textKey, ...(node.textKeys || [])].filter(Boolean)) {
      assert.ok(String(node.text || '').length > 0, `${id} has empty text (${key})`)
    }
    for (const option of node.options || []) {
      assert.ok(String(option.label || '').length > 0, `${id}/${option.id} has no label`)
      if (option.labelKey) assert.equal(option.label, campaignStoryLabel(option.labelKey))
    }
  }
  // 标题：序曲标题来自 headings/*（与生成物一致，非空）。
  assert.equal(FHV_FLOW.nodes.preludeTheFirstEvening.title, campaignStoryHeading('headings.preludeTheFirstEvening'))
  assert.ok(FHV_FLOW.nodes.preludeTheFirstEvening.title.length > 0)
  assert.equal(FHV_FLOW.nodes.fatigue.title, campaignStoryHeading('fatigue.title'))
  assert.equal(SPECIAL_RULE_KEYS.length, 16)
  assert.ok(FHV_FLOW.nodes.prologue.text.length > 100)
  assert.ok(FHV_FLOW.nodes.epilogue.text.length > 10)
  assert.equal(FHV_FLOW.nodes.firstEveningCodex.options.length, 7)
  assert.equal(FHV_FLOW.nodes.secondEveningCodex.options.length, 12)
  assert.ok(FHV_RECORD_LABELS.day.length > 0)
})
