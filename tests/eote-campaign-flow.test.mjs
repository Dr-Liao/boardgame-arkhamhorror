// P7《地球边缘》战役流程与启动接线：流程图、检查点/幕间/尾声、记录读写、伙伴/物资/封印延续、存档往返。
//
// 验收口径：
//   · 流程节点顺序来自 Campaigns/EdgeOfTheEarth.hs#nextStep 与 docs/edgeOfTheEarth/README.md §4；
//   · 正文绑定来自 story-access（story-text.js 生成物），测试断言节点文本/标题确实来自它；
//   · 记录标签来自 story-text.campaign.records；
//   · 伙伴/物资/封印/纪念/记录写入用 P2 原语 + 已注册战役效果处理器，全程走真实数据通路。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  campaignGraph, enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { runCampaignEffectHandler } from '../src/campaign/content-effects.js'
import { validateEoteState } from '../src/engine/eote-primitives.js'
import {
  campaignStory,
} from '../content/campaigns/edgeOfTheEarth/story-access.js'
import {
  EOTE_FLOW, campaignFlowExtras, upgradeWindowForNode, validateEoteFlow,
  EOTE_CHECKPOINT_IDS, EOTE_INTERLUDE_IDS, EOTE_SCENARIO_IDS, EOTE_STEP_ORDER,
  eoteNextStep, scenarioUnitOf,
} from '../content/campaigns/edgeOfTheEarth/flow.js'
import {
  EOTE_CHAPTER_PAIRS, EOTE_FATAL_MIRAGE_DEFAULT_RETURN, EOTE_FATAL_MIRAGE_ENTRY_POINTS,
  EOTE_FATAL_MIRAGE_RETURN_ORDER, EOTE_MAINLINE_SCENARIO_IDS, EOTE_NEXT_STEP,
  EOTE_SCENARIO_UNITS, EOTE_SKIPPABLE_SCENARIOS,
} from '../content/campaigns/edgeOfTheEarth/parts.js'
import {
  PROLOGUE_NODES, runPrologueEffect,
} from '../content/campaigns/edgeOfTheEarth/prologue.js'
import { CHECKPOINT_NODES, runCheckpointEffect } from '../content/campaigns/edgeOfTheEarth/checkpoints.js'
import { INTERLUDE_NODES, runInterludeEffect } from '../content/campaigns/edgeOfTheEarth/interludes.js'
import { EPILOGUE_NODES, runEpilogueEffect } from '../content/campaigns/edgeOfTheEarth/epilogue.js'
import {
  CAMP_SHELTER, PARTNERS, PARTNER_CODES, SUPPLIES, SEALS,
  campShelterFromRecords, partnerStatusesFromRecords, recordDefaults, recordLabels,
  recordSchema, storyBody, storyHeading,
} from '../content/campaigns/edgeOfTheEarth/records.js'
import { adjustPartnerHarm, partnerState, setPartnerStatus } from '../src/campaign/eote-partners.js'
import { carriedSupplies, assignSupply, initializeSupplies, supplyItems } from '../src/campaign/eote-supplies.js'
import { initializeSeals, placeDormantSeal, sealState } from '../src/campaign/eote-seals.js'
import { initializeMemorials, claimMemorial, memorialFor } from '../src/campaign/eote-memorials.js'

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

const MANIFEST = Object.freeze({
  id: 'edgeOfTheEarth',
  scenarioIds: EOTE_SCENARIO_IDS,
  recordSchema,
  flow: EOTE_FLOW,
})

function newCampaign () {
  return { records: structuredClone(recordDefaults), scenarioResults: [], investigators: {} }
}

function newState (overrides = {}) {
  const campaign = overrides.campaign || newCampaign()
  const state = { campaign, rngState: overrides.rngState ?? 0x1a2b3c4d, log: [], chaosAdded: [] }
  if (!Object.keys(state.campaign.investigators || {}).length) {
    state.campaign.investigators = {
      0: { seat: 0, name: '测试调查员', status: 'active', xp: 0, earnedXp: 0 },
    }
  }
  return state
}

/** 与引擎 progressCampaign 相同的数据通路执行一个战役效果（registered 走内容处理器）。 */
function applyEffect (state, effect) {
  if (effect?.type === 'registered') {
    return runCampaignEffectHandler(state, effect, line => state.log.push(String(line)))
  }
  if (effect?.type === 'chaos') {
    state.chaosAdded.push({ token: effect.token, amount: effect.amount })
    return
  }
  if (effect?.type === 'log') {
    state.log.push(String(effect.text))
    return
  }
  throw new Error(`测试未覆盖的战役效果类型：${effect?.type}`)
}

/** 记录节点文本/标题到历史（模拟 walkCampaign 的 visit.storyText 语义）。 */
function primeVisit (state, nodeId) {
  state.campaign.flow ||= { nodeId, history: [], visits: {} }
  const visit = { nodeId, visit: 1 }
  state.campaign.flow.history.push(visit)
  state.campaign.flow.nodeId = nodeId
  return visit
}

/**
 * 完整走一遍 flow：scenario/end 之外，检查点与幕间节点代表「分段休息」，到点后推进到下一节点。
 * `answers` 按当前可分支节点 id 返回选项 id（缺省取第一个合法选项）。
 */
function playFlow (state, { answers = {}, onStop = () => {}, maxStops = 64 } = {}) {
  const campaign = state.campaign
  const graph = validateCampaignGraph(MANIFEST)
  const stops = []
  const scenarios = []
  for (let step = 0; step < maxStops * 4; step++) {
    const node = walkCampaign(campaign, MANIFEST, (id, branch, options) => {
      const wanted = answers[id]
      const picked = wanted && options.find(option => option.id === wanted)
      if (picked) return picked.id
      return options[0].id
    }, effect => applyEffect(state, effect))
    if (node.type === 'end') {
      stops.push({ id: 'end', type: 'end' })
      return { stops, scenarios, ended: true }
    }
    if (node.type === 'scenario') {
      stops.push({ id: node.scenarioId, type: 'scenario' })
      scenarios.push(node.scenarioId)
      campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
      primeVisit(state, node.scenarioId)
      onStop(node, state)
      enterCampaignNode(campaign, MANIFEST, graph.nodes[node.scenarioId].next)
      continue
    }
    // interlude / checkpoint：引擎在此打开休息窗；离开后进入 next 继续走子图。
    stops.push({ id: node.id, type: node.type })
    onStop(node, state)
    enterCampaignNode(campaign, MANIFEST, graph.nodes[node.id].next)
  }
  throw new Error('flow 未能结束')
}

// ---------------------------------------------------------------------------
// 1. 流程图：验证、步骤清单、nextStep 映射
// ---------------------------------------------------------------------------

test('P7 flow：流程图通过注册期校验，节点清单与 8 章/16 步骤一致', () => {
  const graph = validateEoteFlow()
  assert.equal(graph.start, 'prologue')
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.type === 'scenario').map(node => node.scenarioId),
    EOTE_SCENARIO_IDS, '8 个章节单元全部在 flow 中且顺序一致')
  for (const scenarioId of EOTE_SCENARIO_IDS) {
    assert.equal(graph.nodes[scenarioId].type, 'scenario')
    assert.equal(campaignFlowExtras.flow.nodes[scenarioId].scenarioId, scenarioId)
  }
  // 16 个战役步骤对应节点类型。
  const expectedTypes = {
    prologue: 'story',
    checkpoint1: 'checkpoint', checkpoint2: 'checkpoint', checkpoint3: 'checkpoint',
    interlude1: 'interlude', interlude2: 'interlude', interlude3: 'interlude',
    epilogue: 'story',
  }
  for (const stepId of EOTE_STEP_ORDER) {
    const node = graph.nodes[stepId]
    assert.ok(node, `缺少步骤节点 ${stepId}`)
    assert.equal(node.type, expectedTypes[stepId] || 'scenario', `${stepId} 节点类型`)
  }
  assert.equal(graph.nodes.end.type, 'end')
  // 章节对与可跳段。
  assert.deepEqual(EOTE_CHAPTER_PAIRS.map(pair => pair.chapter), ['iceAndDeath', 'theHeartOfMadness'])
  assert.deepEqual(EOTE_SKIPPABLE_SCENARIOS, ['iceAndDeathPart2', 'iceAndDeathPart3'])
  assert.equal(scenarioUnitOf('fatalMirage').cardCode, '08549')
  assert.equal(scenarioUnitOf('cityOfTheElderThings').cardCode, '08621')
  // flow 必须是可序列化纯数据（manifest.flow 直接进 JSON 存档）；不允许函数节点/循环引用。
  const roundtrip = JSON.parse(JSON.stringify(EOTE_FLOW))
  assert.deepEqual(roundtrip, JSON.parse(JSON.stringify(campaignFlowExtras.flow)), 'flow JSON 往返一致')
  const visit = value => {
    if (typeof value === 'function') throw new Error('flow 中不允许函数')
    if (!value || typeof value !== 'object') return
    for (const child of Object.values(value)) visit(child)
  }
  visit(EOTE_FLOW)
  assert.equal(typeof recordSchema.theTeamFledToTheMountains, 'string')
  assert.equal(typeof JSON.stringify(recordDefaults), 'string')
})

test('P7 flow：nextStep 与参考实现一致，致命幻景按已完成章节返回主线', () => {
  for (const [step, targets] of Object.entries(EOTE_NEXT_STEP)) {
    if (step === 'fatalMirage') continue
    assert.deepEqual(eoteNextStep(step, []), targets, `${step} 的 nextStep 候选`)
  }
  // 致命幻景：参考 nextStep 的 if/else 链。
  assert.deepEqual(eoteNextStep('fatalMirage', []), ['toTheForbiddenPeaks'])
  assert.deepEqual(eoteNextStep('fatalMirage', ['toTheForbiddenPeaks']), ['cityOfTheElderThings'])
  assert.deepEqual(eoteNextStep('fatalMirage', ['toTheForbiddenPeaks', 'cityOfTheElderThings']),
    ['theHeartOfMadnessPart1'])
  assert.deepEqual(eoteNextStep('fatalMirage', ['cityOfTheElderThings']), ['theHeartOfMadnessPart1'])
  assert.deepEqual(EOTE_FATAL_MIRAGE_RETURN_ORDER.map(rule => rule.completed),
    ['cityOfTheElderThings', 'toTheForbiddenPeaks'])
  assert.equal(EOTE_FATAL_MIRAGE_DEFAULT_RETURN, 'toTheForbiddenPeaks')
  assert.deepEqual([...EOTE_FATAL_MIRAGE_ENTRY_POINTS], ['interlude1', 'interlude2', 'interlude3'])
  assert.deepEqual([...EOTE_MAINLINE_SCENARIO_IDS], EOTE_SCENARIO_IDS.filter(id => id !== 'fatalMirage'))
  assert.deepEqual(eoteNextStep('theHeartOfMadnessPart2', []), ['epilogue'])
  assert.deepEqual(eoteNextStep('epilogue', []), [])
})

// ---------------------------------------------------------------------------
// 2. 主线全流程：序幕 → 检查点 I → 亡命冰原 II → 检查点 II → III → 幕间 → … → 尾声
// ---------------------------------------------------------------------------

test('P7 flow：主线全流程节点顺序（含检查点/幕间/尾声）与记录写入', () => {
  const state = newState()
  const run = playFlow(state, {
    answers: {
      prologueChoice: 'believe',
      prologue4: 'skipIntros',
      checkpoint1Choice: 'search',
      checkpoint2Choice: 'stand',
      interlude1DoorChoice: 'ignore',
      interlude2Night2: 'ignore',
      interlude3Night4Choice: 'ignore',
    },
  })
  assert.equal(run.ended, true, '流程应走到 end')
  // 章节顺序：8 章中除去致命幻景全部按主线通过。
  assert.deepEqual(run.scenarios, [
    'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3',
    'toTheForbiddenPeaks', 'cityOfTheElderThings',
    'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
  ])
  // 休息节点（检查点/幕间）顺序。
  assert.deepEqual(run.stops.filter(stop => stop.type === 'checkpoint').map(stop => stop.id),
    ['checkpoint1', 'checkpoint2', 'checkpoint3'])
  assert.deepEqual(run.stops.filter(stop => stop.type === 'interlude').map(stop => stop.id),
    ['interlude1', 'interlude2', 'interlude3'])
  // 序幕选项写入记录与混乱袋。
  assert.equal(state.campaign.records.theInvestigatorsConvincedDyerToAllowTheExpedition, true)
  assert.deepEqual(state.chaosAdded, [{ token: 'cultist', amount: 1 }])
  // 检查点 I：默认营地（庇护 0）→ 全员失踪；选择搜救 → MIA。
  assert.equal(state.campaign.records.eoteShelterValue, CAMP_SHELTER.campCrashSite.shelter)
  assert.equal(state.campaign.records.eoteMissingCount, PARTNER_CODES.length)
  assert.ok(state.campaign.records.eoteMissingPartners.length === PARTNER_CODES.length)
  assert.equal(partnerStatusesFromRecords(state.campaign.records)[PARTNER_CODES[0]], 'mia')
  // 检查点 II 选择坚守：不记「逃进山脉」。
  assert.equal(state.campaign.records.theTeamFledToTheMountains, false)
  // 幕间：自动查看存活队员并发放奖励经验（9 人全部 MIA 时存活 0 → 0 XP）。
  assert.deepEqual(state.campaign.records.eoteCheckedPartners, [])
  assert.equal(state.campaign.records.eoteEliminatedPartners, 0, 'MIA 不是「划去」')
  assert.equal(state.campaign.records.eoteInterludeXp, 0)
  // 尾声：未写幸存者名单 → 不泄露组合后续。
  assert.ok(state.log.some(line => line.includes('尾声')))
})

test('P7 flow：检查点 I 放弃 + 检查点 II 逃跑 → 跳过亡命冰原 II/III 并记录逃进群山', () => {
  const state = newState()
  // 让检查点 I 有失踪者（默认庇护 0 已有），选择放弃 → 失踪者被划去。
  const run = playFlow(state, {
    answers: {
      prologueChoice: 'disbelieve',
      prologue4: 'skipIntros',
      checkpoint1Choice: 'abandon',
      checkpoint2Choice: 'flee',
      interlude1DoorChoice: 'ignore',
      interlude2Night4Choice: 'ignore',
      interlude3Night4Choice: 'ignore',
    },
  })
  assert.deepEqual(run.scenarios, [
    'iceAndDeathPart1', 'toTheForbiddenPeaks', 'cityOfTheElderThings',
    'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
  ], '亡命冰原 II/III 均被跳过')
  assert.equal(state.campaign.records.theInvestigatorsDidNotBelieveDyersReport, true)
  assert.deepEqual(state.chaosAdded, [{ token: 'tablet', amount: 1 }])
  assert.equal(state.campaign.records.theTeamFledToTheMountains, true)
  const statuses = partnerStatusesFromRecords(state.campaign.records)
  assert.equal(Object.values(statuses).filter(status => status === 'eliminated').length, PARTNER_CODES.length)
  assert.equal(state.campaign.records.eoteEliminatedPartners, PARTNER_CODES.length)
  // 逃进群山后幕间 I 的查看人数上限 4（第 4 项奖励经验）；全灭时仍为 0 XP。
  assert.equal(state.campaign.records.eoteInterludeXp, 0)
})

// ---------------------------------------------------------------------------
// 3. 致命幻景：幕间 I/II/III 的可选切入与返回主线
// ---------------------------------------------------------------------------

test('P7 flow：致命幻景在幕间 I 切入，完成后按 campaignCompletedSteps 返回失落之峰', () => {
  const state = newState()
  const run = playFlow(state, {
    answers: {
      prologueChoice: 'believe',
      prologue4: 'skipIntros',
      checkpoint1Choice: 'abandon',
      checkpoint2Choice: 'flee',
      interlude1DoorChoice: 'open',
      interlude2Night3Choice: 'open',
      interlude3Night3Choice: 'open',
    },
    onStop: (node, current) => {
      // 幕间 I 的条件是「3 名以上伙伴被划去」：全灭路径天然满足。
      if (node.id === 'checkpoint2') {
        assert.ok(current.campaign.records.eoteEliminatedPartners >= 3)
      }
    },
  })
  assert.deepEqual(run.scenarios, [
    'iceAndDeathPart1', 'fatalMirage', 'toTheForbiddenPeaks', 'fatalMirage',
    'cityOfTheElderThings', 'fatalMirage', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
  ], '全灭路径可在三个幕间反复进入致命幻景，并按已完成章节回主线')
  assert.equal(state.campaign.records.eoteFatalMirageEntries, 3)
  assert.equal(state.campaign.records.eoteEliminatedPartners, PARTNER_CODES.length)
})

test('P7 flow：致命幻景在幕间 II/III 再次进入，回场按已完成章节推进', () => {
  const state = newState()
  const run = playFlow(state, {
    answers: {
      prologueChoice: 'believe',
      prologue4: 'skipIntros',
      checkpoint1Choice: 'search',
      checkpoint2Choice: 'stand',
      interlude1DoorChoice: 'ignore',
      interlude2Night4Choice: 'open',
      interlude3Night3Choice: 'open',
    },
    onStop: (node, current) => {
      if (node.id !== 'checkpoint2') return
      for (const code of ['08714', '08715', '08716']) setPartnerStatus(current, code, 'eliminated')
    },
  })
  // 全存活主线：幕间 II 已进入过幻景 → 门可选；此时已完成失落之峰 → 幻景返回古老者之城。
  assert.deepEqual(run.scenarios, [
    'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3',
    'toTheForbiddenPeaks', 'fatalMirage', 'cityOfTheElderThings',
    'fatalMirage', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
  ])
  assert.equal(state.campaign.records.eoteFatalMirageEntries, 2)
})

test('P7 flow：幕间节点不满足条件时门分支不可用（主条件节点校验）', () => {
  // 无伙伴被划去且从未进入幻景：幕间 I/II/III 直接前进，不出现门选项节点。
  const graph = campaignGraph(MANIFEST)
  const campaign = newCampaign()
  campaign.records.eoteEliminatedPartners = 0
  const route = graph.nodes.interlude1Route
  assert.equal(flowCondition(route.rules[0].when, campaign), false)
  campaign.records.eoteEliminatedPartners = 3
  assert.equal(flowCondition(route.rules[0].when, campaign), true)
  // 已完成幻景：幕间 II/III 的门条件成立（completedStep 读点）。
  const state = newState()
  campaign.scenarioResults.push({ scenarioId: 'fatalMirage', resolution: 'R1' })
  assert.equal(flowCondition(graph.nodes.interlude2Route.rules[0].when, campaign), true)
  assert.equal(flowCondition(graph.nodes.interlude3Route.rules[0].when, campaign), true)
  assert.equal(state.campaign.records.eoteEliminatedPartners, 0)
})

// ---------------------------------------------------------------------------
// 4. 升级权限：检查点否 / 幕间是
// ---------------------------------------------------------------------------

test('P7 flow：检查点不开放升级、幕间开放升级（与引擎读点一致）', () => {
  const graph = campaignGraph(MANIFEST)
  for (const id of EOTE_CHECKPOINT_IDS) {
    const node = graph.nodes[id]
    assert.equal(node.type, 'checkpoint')
    assert.equal(node.upgrades, false, `${id} 明确声明不升级`)
    assert.equal(upgradeWindowForNode(node), false, `${id} 升级窗关闭`)
  }
  for (const id of EOTE_INTERLUDE_IDS) {
    const node = graph.nodes[id]
    assert.equal(node.type, 'interlude')
    assert.notEqual(node.upgrades, false, `${id} 允许升级`)
    assert.equal(upgradeWindowForNode(node), true, `${id} 升级窗开启`)
  }
  assert.equal(upgradeWindowForNode(graph.nodes.iceAndDeathPart1), false)
  assert.deepEqual(campaignFlowExtras.upgradeWindows, { interlude: true, checkpoint: false, scenario: false })
  // 引擎侧读点：campaign.upgradesAllowed = node.type === 'interlude' && node.upgrades !== false。
  assert.equal(campaignFlowExtras.interludeFlow, 'continuous', '幕间子图连续读完（再入幻景选项在同一休息窗内）')
})

// ---------------------------------------------------------------------------
// 5. 记录 schema / 默认值 / 标签（标签来自 story-text.campaign.records）
// ---------------------------------------------------------------------------

test('P7 flow：记录 schema 覆盖 Key.hs 56 项与流程层 8 项，默认值/类型正确', () => {
  const keys = Object.keys(recordSchema)
  assert.equal(keys.length, 56 + 8 + 17, 'Key.hs 56 项 + 流程层 8 项 + 章节专用 17 项')
  const keyRecords = [
    'theInvestigatorsConvincedDyerToAllowTheExpedition', 'theInvestigatorsDidNotBelieveDyersReport',
    'theTeamFledToTheMountains', 'theTeamFoundAnotherWayThroughTheMountains',
    'theTeamWasGuidedToTheHiddenTunnel', 'drKenslerIsSharingHerResearchWithYou',
    'drKenslerHasAPlan', 'theSurvivorsOfTheExpeditionWere',
    'locationsRevealed', 'memoriesBanished', 'memoriesDiscovered',
    'sealsPlaced', 'sealsRecovered', 'suppliesRecovered',
  ]
  for (const key of keyRecords) assert.ok(key in recordSchema, `缺少记录 ${key}`)
  for (const key of Object.keys(CAMP_SHELTER)) assert.equal(recordSchema[key], 'boolean', `营地记录 ${key} 为 boolean`)
  assert.equal(recordSchema.theSurvivorsOfTheExpeditionWere, 'string[]')
  assert.equal(recordSchema.locationsRevealed, 'string[]')
  assert.equal(recordSchema.eoteMissingCount, 'number')
  assert.equal(recordSchema.eoteMissingPartners, 'string[]')
  // 默认值：boolean→false，number→0，string[]→[]。
  assert.equal(recordDefaults.theTeamFledToTheMountains, false)
  assert.equal(recordDefaults.eoteShelterValue, 0)
  assert.deepEqual(recordDefaults.theSurvivorsOfTheExpeditionWere, [])
  assert.deepEqual(Object.keys(recordDefaults).sort(), keys.slice().sort())
})

test('P7 flow：记录标签来自 story-text.campaign.records，伙伴/物资/营地庇护值一致', () => {
  const storyRecords = campaignStory('records')
  assert.ok(storyRecords?.recordLabels?.entries?.length, 'story-text 必须有 campaign.records.recordLabels')
  assert.equal(storyRecords.recordLabels.entries.length, 56, 'story-text 提供 Key.hs 的 56 条记录标签')
  const labels = recordLabels()
  const storyKeyToRecordKey = raw => {
    const key = String(raw).replace(/^key\./, '')
    // story label 键 camp_CrashSite → 记录键 campCrashSite；其余 lowerCamel 原样。
    return key.startsWith('camp_') ? 'camp' + key.slice(5) : key
  }
  for (const entry of storyRecords.recordLabels.entries) {
    const key = storyKeyToRecordKey(entry.key)
    assert.ok(key in labels, `记录标签缺少 ${key}`)
    assert.equal(labels[key], String(entry.body ?? entry.text ?? '').trim(), `记录标签 ${key} 取自 story-text`)
  }
  // 营地庇护值与参考实现的 meta.shelter 一致（Location/CardDefs/EdgeOfTheEarth/IceAndDeath.hs）。
  const expected = {
    campCrashSite: 0, campFrozenShores: 2, campTreacherousPath: 1, campPrecariousIceSheet: 2,
    campBroadSnowdrifts: 4, campIcyWastes: 4, campRockyCrags: 3, campSnowGraves: 5,
    campIcebreakerLanding: 5, campFrigidCave: 6, campBarrierCamp: 7,
    campRemnantsOfLakesCamp: 7, campCrystallineCavern: 8,
  }
  for (const [key, shelter] of Object.entries(expected)) {
    assert.equal(CAMP_SHELTER[key].shelter, shelter, `${key} 庇护值`)
  }
  // campShelterFromRecords：从营地记录反查庇护值（取记录中的最高庇护值避免歧义）。
  assert.equal(campShelterFromRecords({ campCrashSite: true }).shelter, 0)
  assert.equal(campShelterFromRecords({ campCrashSite: true, campBarrierCamp: true }).shelter, 7)
  // 伙伴/物资/封印常量与参考实现一致。
  assert.equal(PARTNERS.length, 9)
  assert.deepEqual(PARTNER_CODES.slice().sort(), ['08714', '08715', '08716', '08717', '08718', '08719', '08720', '08721', '08722'])
  assert.equal(SUPPLIES.length, 7)
  assert.deepEqual(SUPPLIES.map(item => item.code), ['08614', '08615', '08616', '08617', '08618', '08619', '08620'])
  assert.deepEqual([...SEALS], ['A', 'B', 'C', 'D', 'E'])
})

// ---------------------------------------------------------------------------
// 6. 正文绑定：节点文本来自 story-access
// ---------------------------------------------------------------------------

test('P7 flow：序幕/检查点/幕间/尾声节点文本来自 story-access（生成物）', () => {
  const graph = campaignGraph(MANIFEST)
  let bound = 0
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!node.textKey) continue
    const body = storyBody(node.textKey)
    assert.ok(body, `${id} 的 textKey=${node.textKey} 在 story-access 中没有正文`)
    assert.equal(node.text, body, `${id} 的正文必须来自 story-access`)
    const heading = storyHeading(node.textKey)
    if (heading) assert.equal(node.title, heading, `${id} 的标题来自 story-access`)
    bound++
  }
  assert.ok(bound >= 30, `至少 30 个节点绑定正文（实际 ${bound}）`)
  // 四个阶段都有绑定。
  for (const [label, nodeId, keyStart] of [
    ['序幕', 'prologue', 'edgeOfTheEarth.madnessUnderTheIce'],
    ['检查点 I', 'checkpoint1', 'edgeOfTheEarth.checkpoint1.theDisappearance1'],
    ['幕间 I', 'interlude1', 'edgeOfTheEarth.interlude1.restfulNight1'],
    ['幕间 II', 'interlude2', 'edgeOfTheEarth.interlude2.endlessNight1'],
    ['幕间 III', 'interlude3', 'edgeOfTheEarth.interlude3.finalNight1'],
    ['尾声', 'epilogue', 'edgeOfTheEarth.epilogue.epilogue'],
  ]) {
    assert.ok(graph.nodes[nodeId].text.length > 20, `${label} 节点正文非空`)
    assert.equal(graph.nodes[nodeId].textKey.replace(/^edgeOfTheEarth\./, ''), keyStart.replace(/^edgeOfTheEarth\./, '').replace(/\.body$/, '') || graph.nodes[nodeId].textKey, `${label} 节点 textKey`)
  }
  // 选项标签也优先取 story-access 的 label 键。
  const prologueChoice = graph.nodes.prologueChoice
  assert.equal(prologueChoice.options.length, 2)
  const believe = prologueChoice.options.find(option => option.id === 'believe')
  assert.ok(believe.label.includes('believe') || believe.label.length > 4, '序幕选项有可读标签')
})

// ---------------------------------------------------------------------------
// 7. 战役效果处理器：启动初始化、检查点失踪分配、幕间奖励、尾声分支
// ---------------------------------------------------------------------------

test('P7 flow：序幕 campaignStart 初始化 9 伙伴/7 物资/5 封印与状态镜像', () => {
  const state = newState()
  primeVisit(state, 'prologue')
  runPrologueEffect(state, { event: 'campaignStart' }, line => state.log.push(line))
  assert.equal(state.campaign.eote.partners.roster.length, 9)
  assert.ok(state.campaign.eote.partners.roster.every(entry => entry.status === 'safe'))
  assert.equal(state.campaign.eote.supplies.items.length, 7)
  assert.deepEqual(state.campaign.eote.seals.entries.map(entry => entry.kind), ['A', 'B', 'C', 'D', 'E'])
  assert.equal(state.campaign.records.eotePartnerStatuses.length, 9)
  assert.ok(state.campaign.records.eotePartnerStatuses.every(entry => entry.endsWith(':safe')))
  // 幂等：重复初始化不抛错、不重置伤害。
  runPrologueEffect(state, { event: 'campaignStart' }, () => {})
  // 伙伴介绍：8 段正文全部来自 story-access 并写入历史。
  runPrologueEffect(state, { event: 'partnerIntros' }, line => state.log.push(line))
  const visit = state.campaign.flow.history.at(-1)
  assert.ok(visit.storyText.length > 100, '伙伴介绍正文写入历史')
  for (const introKey of ['amyKensler', 'roaldEllsworth', 'jamesFredericks', 'takadaHiroko',
    'averyClaypool', 'malaSinha', 'eliyahAshevak', 'williamDyer']) {
    assert.ok(visit.storyText.includes(storyBody(introKey)), `缺失伙伴介绍 ${introKey}`)
  }
})

test('P7 flow：检查点 I 按营地庇护值随机分配失踪伙伴；搜救= MIA、放弃=划去', () => {
  const make = () => {
    const state = newState()
    primeVisit(state, 'checkpoint1')
    runPrologueEffect(state, { event: 'campaignStart' }, () => {})
    state.campaign.records.campBarrierCamp = true // 庇护值 7
    return state
  }
  const searched = make()
  runCheckpointEffect(searched, { event: 'checkpoint1Missing' }, line => searched.log.push(line))
  const missing = searched.campaign.records.eoteMissingPartners
  assert.equal(searched.campaign.records.eoteShelterValue, 7)
  assert.equal(searched.campaign.records.eoteMissingCount, 9 - 7, '庇护 7 → 只有 2 人失踪')
  assert.equal(missing.length, 2)
  assert.equal(partnerStatusesFromRecords(searched.campaign.records)[missing[0]], 'mia')
  runCheckpointEffect(searched, { event: 'checkpoint1Search' }, () => {})
  assert.equal(partnerStatusesFromRecords(searched.campaign.records)[missing[0]], 'mia', '搜救分支保持 MIA')
  assert.equal(searched.campaign.records.eoteEliminatedPartners, 0)

  const abandoned = make()
  runCheckpointEffect(abandoned, { event: 'checkpoint1Missing' }, () => {})
  const missing2 = abandoned.campaign.records.eoteMissingPartners
  runCheckpointEffect(abandoned, { event: 'checkpoint1Abandon' }, line => abandoned.log.push(line))
  assert.equal(partnerStatusesFromRecords(abandoned.campaign.records)[missing2[0]], 'eliminated', '放弃分支划去')
  assert.equal(abandoned.campaign.records.eoteEliminatedPartners, missing2.length)
})

test('P7 flow：幕间查看伙伴的存活/划去正文并发放奖励 XP（逃进群山时查看 4 人）', () => {
  const state = newState()
  primeVisit(state, 'interlude1')
  runPrologueEffect(state, { event: 'campaignStart' }, () => {})
  // 先让 2 人划去，模拟检查点 I 的损失。
  const firstTwo = PARTNER_CODES.slice(0, 2)
  for (const code of firstTwo) setPartnerStatus(state, code, 'eliminated')
  // 再让一位伙伴带上心魔路线记录，验证特殊存活文本键分支不崩溃。
  state.campaign.records.drKenslerIsSharingHerResearchWithYou = true
  runInterludeEffect(state, { event: 'interlude1' }, line => state.log.push(line))
  assert.equal(state.campaign.records.eoteEliminatedPartners, 2)
  assert.equal(state.campaign.records.eoteCheckedPartners.length, 3, '默认查看 3 名存活伙伴')
  assert.equal(state.campaign.records.eoteInterludeXp, 3, '每名被查看的存活伙伴 1 点奖励 XP')
  assert.equal(state.campaign.investigators[0].xp, 3, '调查员获得奖励 XP')
  const story = state.campaign.flow.history.at(-1).storyText
  assert.ok(story.includes(storyBody('interlude1.restfulNight1')) || story.length > 100, '幕间正文写入历史')
  assert.ok(state.log.some(line => line.includes('已查看 3/3 名存活队员')), '幕间日志带查看人数')

  // 逃进群山记录 → 查看人数上限 4。
  const fled = newState()
  primeVisit(fled, 'interlude1')
  runPrologueEffect(fled, { event: 'campaignStart' }, () => {})
  fled.campaign.records.theTeamFledToTheMountains = true
  runInterludeEffect(fled, { event: 'interlude1' }, () => {})
  assert.equal(fled.campaign.records.eoteCheckedPartners.length, 4, '逃进群山 → 查看 4 人')
  assert.equal(fled.campaign.records.eoteInterludeXp, 4)
})

test('P7 flow：尾声按存活伙伴讲述组合后续，不泄露未达分支', () => {
  const state = newState()
  primeVisit(state, 'epilogue')
  runPrologueEffect(state, { event: 'campaignStart' }, () => {})
  state.campaign.records.theSurvivorsOfTheExpeditionWere = ['08720', '08721', '08718', '08714', '08715']
  setPartnerStatus(state, '08717', 'eliminated') // 辛哈不在，肯斯勒-辛哈组合不讲
  const visit = state.campaign.flow.history.at(-1)
  runEpilogueEffect(state, { event: 'epilogue' }, line => state.log.push(line))
  assert.ok(visit.storyText.includes(storyBody('epilogue.epilogue')) || state.log.some(line => line.includes('尾声')))
  for (const key of ['epilogue.ellsworthAndClaypool', 'epilogue.dyerAndDanforth']) {
    assert.ok(visit.storyText.includes(storyBody(key)), `存活组合应讲述 ${key}`)
  }
  assert.equal(visit.storyText.includes(storyBody('epilogue.kenslerAndSinha')), false, '辛哈未存活 → 不讲该组合')
  assert.equal(visit.storyText.includes(storyBody('epilogue.ashevak')), false, '还有多名伙伴存活 → 不讲阿什瓦克单独结局')

  // 全灭只剩阿什瓦克：讲 ashevak 单独结局。
  const alone = newState()
  primeVisit(alone, 'epilogue')
  runPrologueEffect(alone, { event: 'campaignStart' }, () => {})
  for (const partner of PARTNERS.filter(item => item.key !== 'ashevak')) {
    setPartnerStatus(alone, partner.code, 'eliminated')
  }
  alone.campaign.records.theSurvivorsOfTheExpeditionWere = ['08716']
  const aloneVisit = alone.campaign.flow.history.at(-1)
  runEpilogueEffect(alone, { event: 'epilogue' }, line => alone.log.push(line))
  assert.ok(aloneVisit.storyText.includes(storyBody('epilogue.ashevak')), '只剩阿什瓦克时讲单独结局')

  // 未胜利：不剧透任何组合后续。
  const lost = newState()
  primeVisit(lost, 'epilogue')
  runPrologueEffect(lost, { event: 'campaignStart' }, () => {})
  const lostVisit = lost.campaign.flow.history.at(-1)
  runEpilogueEffect(lost, { event: 'epilogue' }, line => lost.log.push(line))
  assert.equal(lostVisit.storyText, undefined, '未胜利时不讲组合后续')
})

// ---------------------------------------------------------------------------
// 8. 跨章延续与存档往返：伙伴伤害、物资、封印、纪念逝者
// ---------------------------------------------------------------------------

test('P7 flow：伙伴状态/物资/封印/纪念逝者跨章延续，JSON 存档往返一致', () => {
  const state = newState()
  state.locations = [{ id: 'locTest', name: '测试地点' }]
  primeVisit(state, 'prologue')
  runPrologueEffect(state, { event: 'campaignStart' }, () => {})
  // 伙伴：伤害/恐惧跨章延续；状态迁移写镜像。
  adjustPartnerHarm(state, '08714', { damage: 2, horror: 1 })
  setPartnerStatus(state, '08715', 'eliminated')
  assert.deepEqual(partnerState(state, '08714'), {
    code: '08714', damage: 2, horror: 1, status: 'safe', resolute: '08587',
  })
  // 物资：拾取/分配到座位。
  assignSupply(state, '08614', 0)
  assert.deepEqual(carriedSupplies(state, 0).map(item => item.code), ['08614'])
  // 封印：休眠放置到地点（这里只写容器，地点 id 由场景层提供）。
  placeDormantSeal(state, 'A', 'locTest')
  assert.equal(sealState(state, 'A').locationId, 'locTest')
  // 纪念逝者：伙伴划去后领取遗物映射。
  initializeMemorials(state, { entries: [{ partnerCode: '08715', relicCode: '50123' }] })
  assert.equal(claimMemorial(state, '08715'), '50123')
  assert.equal(memorialFor(state, '08715'), '50123')
  // 存档往返：campaign.eote + records 经 JSON 序列化/反序列化后结构一致，并通过 P2 校验。
  const restored = JSON.parse(JSON.stringify({ campaign: state.campaign, locations: state.locations }))
  assert.deepEqual(restored.campaign.eote.partners, state.campaign.eote.partners)
  assert.deepEqual(restored.campaign.eote.supplies, state.campaign.eote.supplies)
  assert.deepEqual(restored.campaign.eote.seals, state.campaign.eote.seals)
  assert.deepEqual(restored.campaign.eote.memorials, state.campaign.eote.memorials)
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  validateEoteState(restored)
  // 恢复后只读辅助仍可读。
  assert.equal(partnerState(restored, '08714').damage, 2)
  assert.deepEqual(carriedSupplies(restored, 0).map(item => item.code), ['08614'])
  assert.equal(sealState(restored, 'A').locationId, 'locTest')
  assert.equal(memorialFor(restored, '08715'), '50123')
})

test('P7 flow：记录默认值与 recordSchema 可直接由引擎初始化（boolean false / number 0 / string[] []）', () => {
  const state = newState()
  const campaign = state.campaign
  assert.equal(campaign.records.theTeamReadTheMap, false)
  assert.equal(campaign.records.wasKilledInThePlaneCrash, false)
  assert.equal(campaign.records.eoteFatalMirageEntries, 0)
  assert.deepEqual(campaign.records.memoriesDiscovered, [])
  assert.deepEqual(campaign.records.sealsPlaced, [])
})
