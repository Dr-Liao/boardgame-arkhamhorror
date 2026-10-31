// TDE P8 战役层（record-labels / tde-chaos / parts / manifest / interludes / dual-story）的 Node 验收。
//
// 覆盖（对应用 P8-7 任务书的 8 类断言）：
//   ① 55 记录键 label 全覆盖、recordSchema 类型匹配、默认值；
//   ② A/B 两套混乱袋的 token 表、逐章符号表、袋增删换 helper；
//   ③ parts 章对归一化 + validatePartManifest + validateCampaignGraph；
//   ④ 16 种章对先手排列走 dualPartFlow / manifest.flow 全通、单线 flow 不含 gate；
//   ⑤ 三幕间正文/标签/自检、attachInterludes 不修改入参、单线只挂幕间 I；
//   ⑥ 幕间节点 effects 重放幂等（同一 visit 不重复结算）；
//   ⑦ 16 段矩阵完整（normalizeEpilogueMatrix ok=true）、每格有 textKey、特殊子步骤；
//   ⑧ manifest 通过 content schema 校验（注册期口径）。
//
// 运行：node tests/tde-campaign-layer.test.mjs（本机沙箱对 `node --test` 的子进程 spawn 受限）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifest, TDE_ENDINGS, TDE_FLOWS } from '../content/campaigns/theDreamEaters/manifest.js'
import {
  TDE_MODES, TDE_PARTS, TDE_PAIR_COUNT, TDE_SCENARIO_IDS, chaptersOfPart,
  interleavedScenarioIds, pairOfScenario, partOfScenario, tdeChapter, tdeChapterPairs,
} from '../content/campaigns/theDreamEaters/parts.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import {
  BOOLEAN_RECORDS, COUNT_RECORDS, PER_INVESTIGATOR_RECORDS, RECORD_KEYS, RECORD_LABELS,
  recordDefaults, recordLabel, recordLabelKey, recordTypeOf, recordTypes,
} from '../content/campaigns/theDreamEaters/record-labels.js'
import {
  CHAOS_TOKEN_FACES, TDE_BAG_DIFFICULTIES, TDE_CHAPTER_SYMBOLS, TDE_CHAOS_BAGS, TDE_DEFAULT_CHAOS_BAGS,
  addChaosToken, addChaosTokenToBoth, baseBagFor, chapterHasSymbol, chaosTokenCount, normalizeChaosToken,
  removeChaosToken, removeChaosTokenFromBoth, swapChaosTokens, swapChaosTokensInBoth, symbolCountsFor,
} from '../content/campaigns/theDreamEaters/tde-chaos.js'
import {
  INTERLUDE_EFFECT_TYPES, TDE_INTERLUDE_LABELS, TDE_INTERLUDE_NODES, TDE_INTERLUDE_TEXT,
  TDE_INTERLUDE_TITLES, attachInterludes, interludeFlowNodes, interludesForMode, validateInterludes,
} from '../content/campaigns/theDreamEaters/interludes.js'
import {
  TDE_EPILOGUE_A_AXIS, TDE_EPILOGUE_B_AXIS, TDE_EPILOGUE_MATRIX, TDE_EPILOGUE_STEPS,
  TDE_SINGLE_LINE_EPILOGUE, attachEpilogue, epilogueTextKey, tdeCapturedInvestigators,
  tdeEpilogueEntry, tdeEpilogueFor, tdeEpilogueMechanics, validateEpilogueMatrix,
} from '../content/campaigns/theDreamEaters/dual-story.js'
import { dualPartFlow, normalizePartPairs, partFlow, validatePartManifest } from '../src/campaign/part-flow.js'
import { enterCampaignNode, validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { normalizeEpilogueMatrix } from '../src/campaign/epilogue-matrix.js'
import { createPartsState } from '../src/campaign/campaign-parts.js'
import { assertCampaignManifest } from '../content/schema.js'

const clone = value => JSON.parse(JSON.stringify(value))

// 双线模拟用的最终态记录：A4 = 入梦者醒来，B4 = 桥梁已建成（矩阵第 5 格）。
const FINAL_RECORDS = Object.freeze({ theDreamersAwoke: true, theBridgeWasCompleted: true })

/**
 * 用偏好模拟一次完整流程：preferences 是 4 个 'A'|'B'（每个章对先打哪条线）。
 * 返回 { visited, applied, campaign }；interlude 节点视为「读完后继续」。
 */
function simulate(flow, { preferences = [], records = {}, scenarioIds = manifest.scenarioIds } = {}) {
  const campaignManifest = { scenarioIds, flow }
  const graph = validateCampaignGraph(campaignManifest)
  const campaign = { records: { ...records }, scenarioResults: [] }
  const visited = []
  const applied = []
  const chooser = (id, node, options) => {
    if (node.type === 'partGate') {
      const wanted = preferences[node.pair - 1] || 'A'
      const option = options.find(item => partOfScenario(item.id) === wanted) || options[0]
      return option.id
    }
    return options[0].id
  }
  for (let steps = 0; steps < 512; steps += 1) {
    const node = walkCampaign(campaign, campaignManifest, chooser, effect => applied.push(effect))
    if (node.type === 'end') return { visited, applied, campaign }
    if (node.type === 'interlude') {
      enterCampaignNode(campaign, campaignManifest, graph.nodes[node.id].next)
      continue
    }
    assert.equal(node.type, 'scenario', `意外节点：${node.id}/${node.type}`)
    visited.push(node.scenarioId)
    campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
    enterCampaignNode(campaign, campaignManifest, graph.nodes[node.id].next)
  }
  throw new Error('流程没有在 512 步内结束')
}

function collectNodeOptionsWhen(node) {
  const list = []
  for (const option of node.options || []) list.push(option.when)
  if (node.when) list.push(node.when)
  return list
}

// ---------------------------------------------------------------------------
// ① 记录键 / 标签 / 类型
// ---------------------------------------------------------------------------

test('记录标签：55 个键全覆盖，且与参考实现 Key.hs 顺序/英文 id 对齐', () => {
  assert.equal(RECORD_KEYS.length, 55)
  assert.equal(Object.keys(RECORD_LABELS).length, 55)
  assert.equal(new Set(RECORD_KEYS).size, 55)
  const firstKeys = ['theDreamersStrayedFromThePath', 'theInvestigatorsWereSavedByRandolphCarder', 'theCatsCollectedTheirTributeFromTheZoogs']
  const lastKeys = ['theInvestigatorsReturnedToReality', 'theInvestigatorsNeverEscaped', 'theInvestigatorsAreStillInTheDreamlands']
  assert.deepEqual(RECORD_KEYS.slice(0, 3), firstKeys)
  assert.deepEqual(RECORD_KEYS.slice(-3), lastKeys)
  assert.equal(RECORD_KEYS[6], 'stepsOfTheBridge', '第 7 个键是桥梁进度（计数）')
  assert.equal(RECORD_KEYS[22], 'evidenceOfKadath', '第 23 个键是卡达斯的证据（计数）')
  for (const key of RECORD_KEYS) {
    const label = RECORD_LABELS[key]
    assert.equal(typeof label, 'string')
    assert.ok(label.length >= 2, `${key} 的中文标签过短`)
    assert.match(label, /[\u4e00-\u9fa5]/, `${key} 的标签必须是中文`)
    assert.equal(recordLabel(key), label)
    assert.equal(recordLabelKey(key), `theDreamEaters.key.${key}`)
    assert.equal(recordLabel('nope'), 'nope', '未知键退回 id、不崩')
  }
})

test('recordTypes：2 计数 number / 2 逐调查员 string[] / 51 boolean，与 recordLabels 逐键一致', () => {
  assert.equal(Object.keys(recordTypes).length, 55)
  assert.deepEqual(Object.keys(recordTypes).sort(), Object.keys(RECORD_LABELS).sort())
  assert.deepEqual(COUNT_RECORDS, ['stepsOfTheBridge', 'evidenceOfKadath'])
  assert.deepEqual(PER_INVESTIGATOR_RECORDS, ['hasBrokenTheLawOfUlthar', 'wasCaptured'])
  assert.equal(BOOLEAN_RECORDS.length, 51)
  assert.equal(COUNT_RECORDS.filter(key => recordTypes[key] === 'number').length, 2)
  assert.equal(PER_INVESTIGATOR_RECORDS.filter(key => recordTypes[key] === 'string[]').length, 2)
  for (const key of BOOLEAN_RECORDS) assert.equal(recordTypes[key], 'boolean', `${key} 应为布尔`)
  for (const [key, type] of Object.entries(recordTypes)) {
    assert.ok(['boolean', 'number', 'string[]'].includes(type), `${key} 的类型 ${type} 不在引擎记录类型里`)
  }
  assert.equal(recordTypeOf('stepsOfTheBridge'), 'number')
  assert.equal(recordTypeOf('nope'), null)
})

test('recordDefaults 与 recordTypes 逐键匹配（0 / false / []），manifest 直接复用', () => {
  assert.equal(Object.keys(recordDefaults).length, 55)
  for (const [key, type] of Object.entries(recordTypes)) {
    const value = recordDefaults[key]
    if (type === 'number') assert.equal(value, 0)
    else if (type === 'boolean') assert.equal(value, false)
    else assert.deepEqual(value, [])
  }
  assert.equal(manifest.recordSchema, recordTypes)
  assert.equal(manifest.recordLabels, RECORD_LABELS)
  assert.equal(manifest.recordDefaults, recordDefaults)
})

// ---------------------------------------------------------------------------
// ② 混乱袋 / 逐章符号表
// ---------------------------------------------------------------------------

test('A 袋：无 Skull/ElderThing、2×Tablet，四难度张数 14/14/15/16', () => {
  const bag = TDE_CHAOS_BAGS.A
  assert.equal(bag.standard.length, 14)
  assert.equal(bag.easy.length, 14)
  assert.equal(bag.hard.length, 15)
  assert.equal(bag.expert.length, 16)
  assert.deepEqual([...bag.standard], ['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign'])
  for (const difficulty of TDE_BAG_DIFFICULTIES) {
    assert.equal(bag[difficulty].includes('skull'), false, `A/${difficulty} 不能有 Skull`)
    assert.equal(bag[difficulty].includes('elderthing'), false, `A/${difficulty} 不能有 ElderThing`)
    assert.equal(symbolCountsFor('A', difficulty).tablet, 2)
    assert.equal(symbolCountsFor('A', difficulty).cultist, 1)
    assert.equal(bag[difficulty].filter(token => token === 'autofail').length, 1)
    assert.equal(bag[difficulty].filter(token => token === 'eldersign').length, 1)
  }
  assert.deepEqual(symbolCountsFor('A', 'standard'), {
    '+1': 1, '0': 2, '-1': 2, '-2': 2, '-3': 1, '-4': 1, cultist: 1, tablet: 2, autofail: 1, eldersign: 1,
  })
})

test('B 袋：无 Tablet、2×Skull + 2×ElderThing，四难度张数 17/17/18/19', () => {
  const bag = TDE_CHAOS_BAGS.B
  assert.equal(bag.easy.length, 17)
  assert.equal(bag.standard.length, 17)
  assert.equal(bag.hard.length, 18)
  assert.equal(bag.expert.length, 19)
  assert.deepEqual([...bag.standard], ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'elderthing', 'elderthing', 'autofail', 'eldersign'])
  for (const difficulty of TDE_BAG_DIFFICULTIES) {
    assert.equal(bag[difficulty].includes('tablet'), false, `B/${difficulty} 不能有 Tablet`)
    assert.equal(symbolCountsFor('B', difficulty).skull, 2)
    assert.equal(symbolCountsFor('B', difficulty).elderthing, 2)
  }
  assert.deepEqual(TDE_DEFAULT_CHAOS_BAGS, TDE_CHAOS_BAGS.A)
  assert.deepEqual(manifest.chaosBags, TDE_CHAOS_BAGS.A, 'schema 兼容的扁平默认表 = A 袋')
  assert.equal(manifest.partChaosBags.B.standard.length, 17, '两袋完整表随 partChaosBags 下发')
})

test('baseBagFor / normalizeChaosToken：按线与难度取副本、符号别名归一', () => {
  const hard = baseBagFor('A', 'hard')
  assert.deepEqual(hard, TDE_CHAOS_BAGS.A.hard)
  hard.push('skull')
  assert.equal(TDE_CHAOS_BAGS.A.hard.includes('skull'), false, '返回副本，不污染冻结的基础袋')
  assert.deepEqual(baseBagFor('B', 'nope'), TDE_CHAOS_BAGS.B.standard, '未知难度回落 standard')
  assert.throws(() => baseBagFor('C'), /未知战役线/)
  assert.equal(normalizeChaosToken('elderThing'), 'elderthing')
  assert.equal(normalizeChaosToken('ElderSign'), 'eldersign')
  assert.equal(normalizeChaosToken('auto_fail'), 'autofail')
  assert.equal(normalizeChaosToken('+1'), '+1')
  assert.ok(CHAOS_TOKEN_FACES.includes('elderthing') && CHAOS_TOKEN_FACES.includes('autofail'))
})

test('逐章符号表：8 章、A/B 分区、A1 无 ElderThing、B1 无 Tablet', () => {
  assert.equal(Object.keys(TDE_CHAPTER_SYMBOLS).length, 8)
  for (const chapter of chapters) {
    const entry = TDE_CHAPTER_SYMBOLS[chapter.id]
    assert.ok(entry, `缺少 ${chapter.id} 的符号表`)
    assert.equal(entry.part, chapter.part)
    assert.deepEqual(entry.symbols, [...new Set(entry.symbols)], '符号不重复')
    assert.ok(entry.symbols.includes('skull') && entry.symbols.includes('cultist'))
    assert.equal(chapterHasSymbol(chapter.id, 'eldersign'), false, 'ElderSign 走默认、不进符号表')
  }
  assert.deepEqual([...TDE_CHAPTER_SYMBOLS.beyondTheGatesOfSleep.symbols], ['skull', 'cultist', 'tablet'])
  assert.equal(chapterHasSymbol('beyondTheGatesOfSleep', 'elderthing'), false)
  assert.equal(chapterHasSymbol('wakingNightmare', 'tablet'), false)
  assert.equal(chapterHasSymbol('wakingNightmare', 'elderthing'), true)
  assert.equal(TDE_CHAPTER_SYMBOLS.aThousandShapesOfHorror.symbols.length, 4)
})

test('chaos helper：加/删/换当前袋，数量不足抛错', () => {
  const state = { campaign: { chaosBag: [...TDE_CHAOS_BAGS.A.standard] }, chaosBag: [...TDE_CHAOS_BAGS.A.standard] }
  addChaosToken(state, 'elderThing', 1, { permanent: true })
  assert.equal(chaosTokenCount(state, 'elderthing'), 1)
  assert.equal(state.campaign.chaosBag.filter(token => token === 'elderthing').length, 1, 'permanent 同步战役袋')
  removeChaosToken(state, 'tablet', 1, { permanent: true })
  assert.equal(chaosTokenCount(state, 'tablet'), 1)
  swapChaosTokens(state, 'tablet', 'skull', { permanent: true })
  assert.equal(chaosTokenCount(state, 'tablet'), 0)
  assert.equal(chaosTokenCount(state, 'skull'), 1)
  assert.throws(() => removeChaosToken(state, 'tablet', 1), /没有足够标记/)
  assert.throws(() => addChaosToken(state, '+1', 0), /正整数/)
})

test('双袋 helper：加/换/删同时作用于 A、B 两条线（幕间跨线等价物）', () => {
  const parts = createPartsState({ mode: 'pick', seatParts: ['A', 'B'], currentPart: 'A' })
  const state = {
    campaign: {
      ...parts, records: {}, investigators: {}, retired: [], trauma: {}, xp: 0, victory: 0,
      chaosBag: [...TDE_CHAOS_BAGS.A.standard], storySections: {},
      parts: {
        B: {
          records: {}, investigators: {}, retired: [], trauma: {}, xp: 0, victory: 0,
          chaosBag: [...TDE_CHAOS_BAGS.B.standard], storySections: {},
        },
      },
    },
    chaosBag: [...TDE_CHAOS_BAGS.A.standard],
  }
  addChaosTokenToBoth(state, 'elderthing')
  assert.equal(state.campaign.chaosBag.filter(token => token === 'elderthing').length, 1)
  assert.equal(state.campaign.parts.B.chaosBag.filter(token => token === 'elderthing').length, 3)
  const swapped = swapChaosTokensInBoth(state, 'elderthing', 'tablet')
  assert.deepEqual({ A: swapped.A, B: swapped.B }, { A: true, B: true })
  assert.equal(state.campaign.chaosBag.filter(token => token === 'tablet').length, 3)
  const removed = removeChaosTokenFromBoth(state, 'tablet', 1)
  assert.deepEqual(removed, { A: 1, B: 1 })
})

// ---------------------------------------------------------------------------
// ③ parts / manifest 结构
// ---------------------------------------------------------------------------

test('parts：A/B 各 4 章、4 个章对，与 shared.js 的 8 章一一对应', () => {
  assert.equal(TDE_PAIR_COUNT, 4)
  assert.deepEqual(TDE_MODES, ['singleA', 'singleB', 'pick', 'parallel'])
  assert.equal(chaptersOfPart('A').length, 4)
  assert.equal(chaptersOfPart('B').length, 4)
  assert.deepEqual(chaptersOfPart('A').map(chapter => chapter.pair), [1, 2, 3, 4])
  assert.deepEqual(chaptersOfPart('B').map(chapter => chapter.pair), [1, 2, 3, 4])
  assert.deepEqual(TDE_SCENARIO_IDS, chapters.map(chapter => chapter.id))
  assert.deepEqual(interleavedScenarioIds(), TDE_SCENARIO_IDS)
  const pairs = tdeChapterPairs()
  assert.equal(pairs.length, 4)
  assert.equal(pairs[0].A.scenarioId, 'beyondTheGatesOfSleep')
  assert.equal(pairs[0].B.scenarioId, 'wakingNightmare')
  assert.equal(pairs[3].A.scenarioId, 'whereTheGodsDwell')
  assert.equal(pairs[3].B.scenarioId, 'weaverOfTheCosmos')
  for (const chapter of chapters) {
    assert.equal(partOfScenario(chapter.id), chapter.part)
    assert.equal(pairOfScenario(chapter.id), chapter.pair)
    assert.equal(tdeChapter(chapter.id).nameEn, chapter.nameEn)
  }
  assert.equal(partOfScenario('nope'), null)
  assert.equal(pairOfScenario('nope'), null)
})

test('manifest：身份/状态/包依赖/模式/两袋/记录 schema 齐备', () => {
  assert.equal(manifest.id, 'theDreamEaters')
  assert.equal(manifest.name, '食梦者')
  assert.equal(manifest.nameEn, 'The Dream Eaters')
  assert.equal(manifest.status, 'development')
  assert.deepEqual([...manifest.requiredPackIds], ['core', 'tdeCampaign', 'tdeInvestigators', 'tdePlayer'])
  assert.deepEqual([...manifest.modes], ['singleA', 'singleB', 'pick', 'parallel'])
  assert.equal(manifest.interludeHandlerId, 'tdeInterlude')
  assert.deepEqual([...manifest.resolutionIds], ['victory', 'defeat'])
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.minRulesVersion, 'n6.0')
  assert.equal(manifest.parts.A.name, '梦寻')
  assert.equal(manifest.parts.B.name, '梦网')
  assert.equal(manifest.parts.A.chapters.length, 4)
  assert.equal(Object.keys(manifest.unlock).length, 8)
  for (const chapter of chapters) {
    const previous = tdeChapterPairs().find(pair => pair.pair === chapter.pair - 1)
    assert.deepEqual(manifest.unlock[chapter.id], previous ? [previous.A.scenarioId, previous.B.scenarioId] : [])
  }
  assert.equal(manifest.epilogueMatrix, TDE_EPILOGUE_MATRIX)
  assert.equal(manifest.singleLineEpilogue, TDE_SINGLE_LINE_EPILOGUE)
})

test('manifest 通过 content schema 与 parts 声明校验（注册期口径）', () => {
  assertCampaignManifest(manifest)
  const validation = validatePartManifest(manifest)
  assert.equal(validation.ok, true, validation.problems.join(' | '))
  assert.equal(validation.pairs.length, 4)
  // 注册期（content/registry.js）对所有战役调用 validateCampaignGraph(campaign)。
  const graph = validateCampaignGraph(manifest)
  assert.equal(graph.start, 'gate1')
  // 双线条件 + 记录条件可以混用（章对 gate 的 when 只读 completed）
  assert.equal(manifest.flow.nodes.gate1.type, 'partGate')
  assert.deepEqual(manifest.flow.nodes.gate1.options.map(option => option.id),
    ['beyondTheGatesOfSleep', 'wakingNightmare'])
})

test('战役结局表：A/B 各 4 个最终态记录，标签复用中文记录名', () => {
  assert.equal(TDE_ENDINGS.length, 8)
  assert.deepEqual(TDE_ENDINGS.map(ending => ending.id),
    [...TDE_EPILOGUE_A_AXIS.map(entry => entry.id), ...TDE_EPILOGUE_B_AXIS.map(entry => entry.id)])
  for (const ending of TDE_ENDINGS) {
    assert.ok(ending.label.startsWith('结局：'))
    assert.ok(['A', 'B'].includes(ending.part))
    assert.equal(recordTypes[ending.record], 'boolean', `${ending.record} 必须是单一最终态布尔记录`)
  }
  assert.deepEqual(TDE_ENDINGS.slice(0, 4).map(ending => ending.record),
    TDE_EPILOGUE_A_AXIS.map(entry => entry.record))
  assert.equal(TDE_ENDINGS[4].record, 'theBridgeWasCompleted')
})

// ---------------------------------------------------------------------------
// ④ 16 段尾声矩阵与特殊子步骤
// ---------------------------------------------------------------------------

test('16 段矩阵：完整（normalizeEpilogueMatrix ok）、每格 textKey、编号按参考实现表', () => {
  const validation = normalizeEpilogueMatrix(TDE_EPILOGUE_MATRIX)
  assert.deepEqual(validation, { ok: true, expected: 16, found: 16, missing: [], extra: [], broken: false })
  assert.deepEqual(validateEpilogueMatrix(), validation)
  assert.equal(TDE_EPILOGUE_A_AXIS.length, 4)
  assert.equal(TDE_EPILOGUE_B_AXIS.length, 4)
  const seenNumbers = new Set()
  for (const a of TDE_EPILOGUE_A_AXIS) {
    for (const b of TDE_EPILOGUE_B_AXIS) {
      const entry = tdeEpilogueEntry(a.id, b.id)
      assert.ok(entry, `缺少 ${a.id}|${b.id}`)
      assert.equal(entry.textKey, epilogueTextKey(entry.number))
      assert.match(entry.textKey, /^theDreamEaters\.flavorText\.epilogue(1[0-6]|[1-9])$/)
      assert.equal(entry.pendingTranslation, true)
      assert.ok(!seenNumbers.has(entry.number), '16 格编号不重复')
      seenNumbers.add(entry.number)
    }
  }
  assert.equal(seenNumbers.size, 16)
  // 参考实现的表：行 A 轴、列 B 轴，1..16 依次编号。
  assert.equal(tdeEpilogueEntry('nyarlathotepsInvasionHasBegun', 'theBridgeWasCompleted').number, 1)
  assert.equal(tdeEpilogueEntry('nyarlathotepsInvasionHasBegun', 'theInvestigatorsAreStillInTheDreamlands').number, 4)
  assert.equal(tdeEpilogueEntry('theDreamersAwoke', 'theBridgeWasCompleted').number, 5)
  assert.equal(tdeEpilogueEntry('theDreamersStayedInTheDreamlandsForever', 'theInvestigatorsNeverEscaped').number, 11)
  assert.equal(tdeEpilogueEntry('theDreamersTraveledBeneathTheMonastery', 'theInvestigatorsAreStillInTheDreamlands').number, 16)
  assert.equal(tdeEpilogueEntry('nope', 'theBridgeWasCompleted'), null)
})

test('查表 helper：两条线最终态记录 → 1/16 段；缺一条线返回 null', () => {
  const cell = tdeEpilogueFor({
    A: { theDreamersAwoke: true },
    B: { theInvestigatorsReturnedToReality: true },
  })
  assert.equal(cell.number, 6)
  assert.equal(cell.a, 'theDreamersAwoke')
  assert.equal(cell.b, 'theInvestigatorsReturnedToReality')
  assert.equal(cell.entry.textKey, 'theDreamEaters.flavorText.epilogue6')
  assert.equal(tdeEpilogueFor({ A: { theDreamersAwoke: true }, B: {} }), null)
  assert.equal(tdeEpilogueFor({ A: { theBridgeWasCompleted: true }, B: { theInvestigatorsNeverEscaped: true } }), null,
    'A 轴只认 A 线记录')
  assert.equal(tdeCapturedInvestigators({ A: { wasCaptured: ['inv-1', 'inv-2'] } }).length, 2)
  assert.deepEqual(tdeCapturedInvestigators({}), [])
})

test('特殊结局子步骤：Part 5 杀 A 线、Part 13 让 A 线发疯、Part 17 破乌撒之法', () => {
  const kill = tdeEpilogueMechanics(5)
  assert.equal(kill.killPart, 'A')
  assert.equal(kill.insanePart, null)
  assert.equal(TDE_EPILOGUE_STEPS.killCampaignA.investigatorStatus, 'killed')
  const insane = tdeEpilogueMechanics(13)
  assert.equal(insane.insanePart, 'A')
  assert.equal(insane.killPart, null)
  assert.equal(TDE_EPILOGUE_STEPS.driveCampaignAInsane.investigatorStatus, 'insane')
  for (const number of [1, 6, 9, 16]) {
    const mechanics = tdeEpilogueMechanics(number)
    assert.equal(mechanics.killPart, null)
    assert.equal(mechanics.insanePart, null)
    assert.equal(mechanics.brokeTheLawOfUlthar, true)
    assert.equal(mechanics.finalStep, 17)
  }
  assert.equal(TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.record, 'wasCaptured')
  assert.equal(TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.textKey, 'theDreamEaters.flavorText.brokeTheLawOfUlthar')
  assert.equal(TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.pendingTranslation, true)
  assert.equal(TDE_SINGLE_LINE_EPILOGUE.hasText, false)
  assert.equal(TDE_SINGLE_LINE_EPILOGUE.endsWith, 'gameOver')
  assert.match(TDE_SINGLE_LINE_EPILOGUE.note, /不播放任何尾声正文/)
  assert.equal(TDE_EPILOGUE_MATRIX.matrixTextKey, 'theDreamEaters.flavorText.epilogueMatrix')
})

test('epilogue flow 接线：16 个 option、5/13 特殊节点、Part 17 终点', () => {
  const attached = attachEpilogue(dualPartFlow(TDE_PARTS))
  const graph = validateCampaignGraph({ scenarioIds: manifest.scenarioIds, flow: attached })
  const branch = graph.nodes.epilogueMatrix
  assert.equal(branch.type, 'branch')
  assert.equal(branch.options.length, 16)
  assert.equal(new Set(branch.options.map(option => option.id)).size, 16)
  for (const option of branch.options) {
    assert.equal(graph.nodes[option.next].type, 'story')
    assert.equal(option.when.all.length, 2, '每格同时读 A/B 两条线的最终态记录')
  }
  for (let number = 1; number <= 16; number += 1) {
    const node = graph.nodes[`epilogueStory${number}`]
    assert.ok(node, `缺少 epilogueStory${number}`)
    assert.equal(node.textKey, epilogueTextKey(number))
    assert.equal(node.pendingTranslation, true)
  }
  assert.equal(graph.nodes.epilogueStory5.next, 'epilogueKillCampaignA')
  assert.equal(graph.nodes.epilogueStory13.next, 'epilogueDriveCampaignAInsane')
  assert.equal(graph.nodes.epilogueStory6.next, 'epiloguePart17')
  assert.equal(graph.nodes.epilogueKillCampaignA.next, 'epiloguePart17')
  assert.equal(graph.nodes.epilogueDriveCampaignAInsane.next, 'epiloguePart17')
  assert.equal(graph.nodes.epiloguePart17.next, 'end')
  assert.equal(graph.nodes.epiloguePart17.record, 'wasCaptured')
  assert.equal(graph.nodes.epiloguePart17.textKey, 'theDreamEaters.flavorText.brokeTheLawOfUlthar')
  // 最后一对章对 gate 的出口已被改接尾声入口
  const lastGate = Object.values(graph.nodes).find(node => node.type === 'partGate' && node.next === 'epilogueMatrix')
  assert.ok(lastGate, '最后一对 gate 必须接 epilogueMatrix')
  assert.equal(graph.nodes.end.type, 'end')
  // 幂等：重复接线不改变结构
  assert.equal(attachEpilogue(attached), attached)
})

// ---------------------------------------------------------------------------
// ⑤ 三幕间：正文/标签/节点图/接线
// ---------------------------------------------------------------------------

test('幕间正文：32 段英文原文全部就位、pendingTranslation 标记、locale 键正确', () => {
  assert.equal(Object.keys(TDE_INTERLUDE_TEXT).length, 32)
  for (const [name, entry] of Object.entries(TDE_INTERLUDE_TEXT)) {
    assert.equal(typeof entry.text, 'string')
    assert.ok(entry.text.length > 40, `${name} 正文过短`)
    assert.equal(entry.key, `theDreamEaters.flavorText.${name}`)
    assert.equal(entry.pendingTranslation, true)
    assert.ok(['interlude1', 'interlude2', 'interlude3'].includes(entry.group))
    assert.ok(entry.title.startsWith('Interlude'), `${name} 的标题应来自英文包 title`)
  }
  assert.equal(TDE_INTERLUDE_TITLES[1], 'Interlude I: The Black Cat')
  assert.equal(TDE_INTERLUDE_TITLES[2], 'Interlude II: The Oneironauts')
  assert.equal(TDE_INTERLUDE_TITLES[3], 'Interlude III: The Great Ones')
  assert.equal(Object.keys(TDE_INTERLUDE_LABELS).length, 21)
  for (const label of Object.values(TDE_INTERLUDE_LABELS)) {
    assert.ok(label.text.length > 5)
    assert.equal(label.pendingTranslation, true)
    assert.match(label.key, /^theDreamEaters\.label\./)
  }
  // 不写中文摘要：正文保留英文原文与卡面记号
  assert.match(TDE_INTERLUDE_TEXT.theBlackCat1.text, /Ulthar/)
  assert.match(TDE_INTERLUDE_TEXT.youDidNotAskForIt.text, /black cat/)
  assert.match(TDE_INTERLUDE_TEXT.theGreatOnes2Nyarlathotep.text, /\{elderThing\}/, '卡面记号保留')
})

test('幕间自检：节点图引用完整、选项/标签齐全、effects 只用已注册 type', () => {
  const validation = validateInterludes()
  assert.equal(validation.ok, true, validation.problems.join(' | '))
  assert.equal(validation.problems.length, 0)
  const templateIds = new Set()
  for (const groups of Object.values(TDE_INTERLUDE_NODES)) {
    for (const templates of Object.values(groups)) {
      for (const template of templates) templateIds.add(template.id)
    }
  }
  assert.ok(templateIds.has('interlude1.2') && templateIds.has('interlude2.3.branch') && templateIds.has('interlude3.silverKey'))
  const effects = []
  for (const groups of Object.values(TDE_INTERLUDE_NODES)) {
    for (const templates of Object.values(groups)) {
      for (const node of templates) {
        effects.push(...(node.effects || []))
        for (const option of node.options || []) effects.push(...(option.effects || []))
        for (const branch of node.branches || []) effects.push(...(branch.then || []))
        for (const green of node.greens || []) effects.push(...(green.effects || []))
      }
    }
  }
  assert.ok(effects.length > 20)
  for (const effect of effects) {
    assert.ok(INTERLUDE_EFFECT_TYPES.includes(effect.type), `未注册的幕间效果类型：${effect.type}`)
    assert.ok(['A', 'B'].includes(effect.part), `效果缺少 part 标注：${JSON.stringify(effect)}`)
  }
})

test('幕间选择：I.2 四选一写 A 线、II.1 三选一写 B 线、III.1 二选一写 A 线', () => {
  const nodes = interludeFlowNodes('pick')
  const byId = new Map(nodes.map(node => [node.id, node]))
  const one = byId.get('interlude1.2')
  assert.equal(one.type, 'choice')
  assert.deepEqual(one.options.map(option => option.id), ['newsOfYourPlight', 'knowledgeOfDreamlands', 'warnTheOthers', 'dontTrust'])
  assert.equal(one.options[0].effects[0].key, 'theBlackCatDeliveredNewsOfYourPlight')
  assert.equal(one.options[0].effects[0].part, 'A')
  assert.ok(one.options[0].label.includes('companions'), '选项标签应来自英文 label 段')
  assert.equal(one.pendingTranslation, true)
  const two = byId.get('interlude2.1')
  assert.equal(two.options.length, 4, '含 hasAHunch 单选项与三选一（由 when 过滤）')
  const three = byId.get('interlude3.1')
  assert.equal(three.options.length, 3)
  assert.equal(three.options[1].effects[0].key, 'theBlackCatSpokeOfNyarlathotep')
  // 条件跨线效果以数据形式挂在节点上，且标 pendingEngine
  const requested = byId.get('interlude2.3.requestedAid')
  assert.equal(requested.branchesMode, 'exclusive')
  assert.equal(requested.branches.length, 3)
  assert.equal(requested.pendingEngine, true)
  const shared = byId.get('interlude2.3.sharedKnowledge')
  assert.equal(shared.branchesMode, 'independent')
  assert.deepEqual(shared.branches[0].then[0], { type: 'record', part: 'A', key: 'theBlackCatIsAtYourSide', value: false })
  // 用现有 type 表达不了的动作用 pendingEffects 单列
  const growWeaker = byId.get('interlude3').greens.find(green => green.textKey === 'theGreatOnes1GrowWeaker')
  assert.equal(growWeaker.pendingEffects[0].op, 'chaosByDifficulty')
  assert.equal(growWeaker.pendingEffects[0].tokenByDifficulty.standard, '-4')
})

test('attachInterludes：不修改入参、pick 为完整三幕间、幂等', () => {
  const base = dualPartFlow(TDE_PARTS)
  const before = JSON.stringify(base)
  const attached = attachInterludes(base, { mode: 'pick' })
  assert.equal(JSON.stringify(base), before, 'attachInterludes 不能修改传入的 flow')
  assert.equal(attachInterludes(attached, { mode: 'pick' }), attached, '重复接线原样返回')
  const graph = validateCampaignGraph({ scenarioIds: manifest.scenarioIds, flow: attached })
  for (const entryId of ['interlude1', 'interlude2', 'interlude3']) {
    assert.equal(graph.nodes[entryId].type, 'interlude')
    assert.equal(graph.nodes[entryId].pendingTranslation, true)
  }
  assert.equal(graph.nodes.interlude1.textKey, 'theBlackCat')
  assert.equal(graph.nodes['interlude1.1'].textKey, 'theBlackCat1')
  assert.equal(graph.nodes['interlude1.2'].type, 'choice')
  assert.equal(graph.nodes['interlude1.3'].textKey, 'theBlackCat3')
  assert.equal(graph.nodes.interlude2.textKey, 'theOneironauts1')
  assert.equal(graph.nodes['interlude2.3'].textKey, 'nowWhereWasI')
  assert.equal(graph.nodes.interlude3.textKey, 'theGreatOnes1')
  assert.equal(graph.nodes['interlude3.3'].textKey, 'theGreatOnes2Part2')
  // 幕间出口接回章对 gate
  assert.equal(graph.nodes['interlude1.sharedKnowledge'].next, 'gate2')
  assert.equal(graph.nodes['interlude3.atlachNacha'].next, 'gate4')
  assert.deepEqual(interludesForMode('pick'), [1, 2, 3])
  assert.deepEqual(interludesForMode('singleA'), [1])
  assert.deepEqual(interludesForMode('singleB'), [1])
})

test('单线 flow：只保留幕间 I 的对应分支、没有双线 gate、末章直接 end', () => {
  const singleA = TDE_FLOWS.singleA
  const graphA = validateCampaignGraph({ scenarioIds: manifest.scenarioIds, flow: singleA })
  assert.equal(Object.values(graphA.nodes).some(node => node.type === 'partGate'), false, '单线不得有章对 gate')
  assert.equal(graphA.start, 'beyondTheGatesOfSleep')
  assert.deepEqual(Object.values(graphA.nodes)
    .filter(node => node.type === 'scenario')
    .map(node => node.scenarioId)
    .sort(), chaptersOfPart('A').map(chapter => chapter.scenarioId).sort())
  assert.equal(graphA.nodes.interlude2, undefined, '单线 A 不读幕间 II')
  assert.equal(graphA.nodes.interlude3, undefined, '单线 A 不读幕间 III')
  assert.equal(graphA.nodes['interlude1.1'].textKey, 'theBlackCat1')
  assert.equal(Object.values(graphA.nodes).some(node => node.textKey === 'theBlackCat3'), false)
  assert.equal(graphA.nodes.whereTheGodsDwell.next, 'end', '单线无尾声正文，末章直接结束')

  const singleB = TDE_FLOWS.singleB
  const graphB = validateCampaignGraph({ scenarioIds: manifest.scenarioIds, flow: singleB })
  assert.equal(Object.values(graphB.nodes).some(node => node.type === 'partGate'), false)
  assert.equal(graphB.start, 'wakingNightmare')
  assert.equal(graphB.nodes['interlude1.3'].textKey, 'theBlackCat3')
  const own = graphB.nodes['interlude1.youAreOnYourOwn']
  assert.equal(own.textKey, 'youAreOnYourOwn')
  assert.deepEqual(own.effects, [{ type: 'record', part: 'B', key: 'youAreOnYourOwn', value: true }])
  assert.equal(Object.values(graphB.nodes).some(node => node.textKey === 'theBlackCat1'), false)
  assert.equal(graphB.nodes.weaverOfTheCosmos.next, 'end')
})

// ---------------------------------------------------------------------------
// ⑥ 16 排列 / 全通 / 幂等
// ---------------------------------------------------------------------------

test('dualPartFlow：16 种章对先手排列全部可达，且逐对屏障成立', () => {
  const flow = dualPartFlow(TDE_PARTS)
  const sequences = new Set()
  for (let mask = 0; mask < 16; mask += 1) {
    const preferences = [0, 1, 2, 3].map(index => ((mask >> index) & 1 ? 'B' : 'A'))
    const { visited } = simulate(flow, { preferences })
    assert.equal(visited.length, 8, `排列 ${preferences.join('')} 应打完 8 章`)
    assert.equal(new Set(visited).size, 8)
    sequences.add(visited.join(','))
    for (let pair = 1; pair <= 4; pair += 1) {
      const ids = [TDE_PARTS.A.chapters[pair - 1].scenarioId, TDE_PARTS.B.chapters[pair - 1].scenarioId]
      const positions = ids.map(id => visited.indexOf(id))
      assert.ok(positions.every(position => position >= 0), `第 ${pair} 对必须都打完`)
      if (pair < 4) {
        const nextStart = Math.min(...[TDE_PARTS.A.chapters[pair].scenarioId, TDE_PARTS.B.chapters[pair].scenarioId]
          .map(id => visited.indexOf(id)))
        assert.ok(Math.max(...positions) < nextStart, `第 ${pair} 对必须在下一对之前完成`)
      }
      assert.equal(visited[Math.min(...positions)], preferences[pair - 1] === 'B' ? ids[1] : ids[0])
    }
  }
  assert.equal(sequences.size, 16)
})

test('manifest.flow（含三幕间 + 16 段尾声）：16 种排列全部到达 end，幕间按顺序只读一次', () => {
  const sequences = new Set()
  for (let mask = 0; mask < 16; mask += 1) {
    const preferences = [0, 1, 2, 3].map(index => ((mask >> index) & 1 ? 'B' : 'A'))
    const { visited, campaign } = simulate(manifest.flow, { preferences, records: FINAL_RECORDS })
    assert.equal(visited.length, 8)
    sequences.add(visited.join(','))
    const history = campaign.flow.history.map(visit => visit.nodeId)
    for (const entryId of ['interlude1', 'interlude2', 'interlude3']) {
      assert.equal(history.filter(nodeId => nodeId === entryId).length, 1, `${entryId} 应只进入一次`)
    }
    assert.ok(history.includes('gate1') && history.includes('gate4'))
    assert.ok(history.indexOf('interlude1') < history.indexOf('gate2'))
    assert.ok(history.indexOf('interlude3') > history.indexOf('gate3'))
    assert.ok(history.includes('epilogueMatrix'))
    assert.equal(history.filter(nodeId => nodeId === 'epilogueMatrix').length, 1)
    assert.equal(history.at(-1), 'end')
  }
  assert.equal(sequences.size, 16)
})

test('尾声实际落点：A=入梦者醒来 + B=桥梁已建成 → Epilogue 5 → 杀 A 线 → Part 17 → end', () => {
  const { campaign } = simulate(manifest.flow, { preferences: ['A', 'A', 'A', 'A'], records: FINAL_RECORDS })
  const history = campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(history.includes('epilogueStory5'), history.slice(-8).join(' > '))
  assert.ok(history.includes('epilogueKillCampaignA'))
  assert.ok(history.includes('epiloguePart17'))
  assert.equal(history.at(-1), 'end')
  assert.equal(history.includes('epilogueStory6'), false)
  // 另一格：A=醒来、B=回到现实 → Epilogue 6（无特殊击杀）
  const other = simulate(manifest.flow, {
    preferences: ['B', 'B', 'B', 'B'],
    records: { theDreamersAwoke: true, theInvestigatorsReturnedToReality: true },
  })
  const otherHistory = other.campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(otherHistory.includes('epilogueStory6'))
  assert.equal(otherHistory.includes('epilogueKillCampaignA'), false)
  assert.ok(otherHistory.includes('epiloguePart17'))
})

test('单线 flow 全通：A 线 4 章 / B 线 4 章，末章直接 end 无尾声正文', () => {
  const run = flow => {
    const { visited, campaign } = simulate(flow, { records: {} })
    const history = campaign.flow.history.map(visit => visit.nodeId)
    return { visited, history }
  }
  const a = run(TDE_FLOWS.singleA)
  assert.deepEqual(a.visited, chaptersOfPart('A').map(chapter => chapter.scenarioId))
  assert.equal(a.history.at(-1), 'end')
  assert.equal(a.history.includes('epilogueMatrix'), false)
  const b = run(TDE_FLOWS.singleB)
  assert.deepEqual(b.visited, chaptersOfPart('B').map(chapter => chapter.scenarioId))
  assert.equal(b.history.at(-1), 'end')
  assert.equal(b.history.includes('epilogueMatrix'), false)
  assert.ok(b.history.includes('interlude1.youAreOnYourOwn'))
})

test('幕间节点 effects 重放幂等：同一 visit 走两次不重复结算记录/袋', () => {
  const nodes = interludeFlowNodes('pick')
  const target = nodes.find(node => node.id === 'interlude1.deliveredNews')
  assert.ok(target.effects.some(effect => effect.type === 'chaos'))
  const flow = {
    start: target.id,
    nodes: { [target.id]: { ...target, next: 'end' }, end: { type: 'end' } },
  }
  const campaignManifest = { scenarioIds: [], flow }
  const campaign = { records: {}, scenarioResults: [] }
  const applied = []
  const walk = () => walkCampaign(campaign, campaignManifest, () => 'none', effect => applied.push(effect))
  walk()
  const afterFirst = { records: clone(campaign.records), applied: applied.length }
  assert.equal(afterFirst.records.theBlackCatIsAtYourSide, true)
  assert.equal(applied.filter(effect => effect.type === 'chaos').length, 2, '2 枚 chaos 走 applyEffect')
  assert.equal(applied.filter(effect => effect.type === 'log').length, 1, '正文走 log')
  // 同一 visit 再走（引擎按 visits.effectsApplied 去重）：不重复写记录/重复加 token
  campaign.flow.nodeId = target.id
  walk()
  assert.deepEqual(campaign.records, afterFirst.records)
  assert.equal(applied.length, afterFirst.applied)
  // 记录型效果本身也是「同值重写幂等」：连写两次结果一致
  const records = {}
  for (const effect of target.effects.filter(item => item.type === 'record')) {
    records[effect.key] = effect.value
    records[effect.key] = effect.value
  }
  assert.deepEqual(records, { theBlackCatIsAtYourSide: true })
})

// ---------------------------------------------------------------------------
// ⑦ flow 条件形状（campaign-flow 的声明式条件）
// ---------------------------------------------------------------------------

test('flow 条件：全部落在 campaign-flow 支持的字段内，且章对 gate 按 completed 过滤', () => {
  const supportedKeys = new Set(['all', 'any', 'not', 'compare', 'completed', 'resolution',
    'record', 'equals', 'atLeast', 'includes', 'part', 'parts', 'mode', 'modeIn', 'activeParts'])
  const inspect = condition => {
    if (!condition || typeof condition !== 'object') return
    for (const key of Object.keys(condition)) {
      assert.ok(supportedKeys.has(key), `未知 flow 条件字段：${key}`)
    }
    for (const key of ['all', 'any']) if (condition[key]) condition[key].forEach(inspect)
    if (condition.not) inspect(condition.not)
    if (condition.resolution) {
      assert.ok(condition.resolution.scenarioId && typeof condition.resolution.value === 'string')
    }
    if (Object.hasOwn(condition, 'record')) {
      assert.ok(Object.hasOwn(condition, 'equals') || Object.hasOwn(condition, 'atLeast') || Object.hasOwn(condition, 'includes'),
        `记录条件必须带 equals/atLeast/includes：${JSON.stringify(condition)}`)
    }
  }
  for (const flow of [manifest.flow, TDE_FLOWS.singleA, TDE_FLOWS.singleB]) {
    for (const node of Object.values(flow.nodes)) {
      if (node.type === 'scenario') assert.equal(flow.nodes[node.next] !== undefined, true)
      for (const condition of collectNodeOptionsWhen(node)) inspect(condition)
    }
  }
  // partGate 的 option when 只读 completed，保证「只剩一边自动进入」
  for (const node of Object.values(manifest.flow.nodes)) {
    if (node.type !== 'partGate') continue
    for (const option of node.options) {
      assert.equal(option.when.not.completed, option.id, 'partGate 选项排除已完成的章')
    }
  }
})
