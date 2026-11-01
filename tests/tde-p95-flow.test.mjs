// 《食梦者》P9.5 真实 TDE 流程验收：16 种逐章对先手排列 / A-first 与 B-first 两条全流程 /
// 单线幕间 I，全部跑**真实内容**（manifest.flows.pick + attachInterludes + attachEpilogue /
// 单线 flows）与**真实引擎流程模块**（campaignGraph / validateCampaignGraph / walkCampaign /
// partManifest / setPart / recordInPart / applyCampaignEffect）。
//
// 路线图口径（§1.4 / §7.2.2 / §11.2 门禁 3）：
//   · 四对 A/B 章，每对可先 A 或先 B，同对两章都完成后才进幕间 → 16 种合法排列；
//   · pick / parallel 挂幕间 I/II/III 与 16 段尾声矩阵；singleA/singleB 只挂幕间 I 的对应分支；
//   · 切 part 是「关间/幕间边界」的事：每章 setup 用目标线，幕间后先手可换线。
//
// 做法：用真实 walkCampaign 驱动真实 campaign 状态（records / parts / chaosBag 全部由
// campaign-parts 的 setPart / recordInPart 真实切换），模拟引擎在「关卡结算后 pendingNode →
// 关间准备结束 leaveRest」两步的推进方式（与 src/engine/campaign-flow.js 的 progressCampaign 一致）。
// 断言全部可从内容数据复算：期望的章节顺序、幕间顺序、尾声编号与文本都从 TDE 数据派生，
// 不写死源码字符串，也不 mock 被验收的流程/效果模块。
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifest } from '../content/campaigns/theDreamEaters/manifest.js'
import {
  TDE_PARTS, tdeChapterPairs, partOfScenario,
} from '../content/campaigns/theDreamEaters/parts.js'
import {
  TDE_INTERLUDE_TEXT, TDE_INTERLUDE_TITLES, interludeFlowNodes,
} from '../content/campaigns/theDreamEaters/interludes.js'
import {
  TDE_EPILOGUE_A_AXIS, TDE_EPILOGUE_B_AXIS, TDE_SINGLE_LINE_EPILOGUE,
  tdeEpilogueFor,
} from '../content/campaigns/theDreamEaters/dual-story.js'
import { baseBagFor } from '../content/campaigns/theDreamEaters/tde-chaos.js'
import {
  campaignGraph, enterCampaignNode, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { partManifest } from '../src/campaign/part-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import {
  defaultPartScope, laneCounts, partScope, recordInPart, setPart,
} from '../src/campaign/campaign-parts.js'
import {
  hubSetup, legalFor, loadTdeCampaignWorld, play, settlePendingChoices,
} from './tde-p95-fixture.mjs'

const PART_IDS = Object.freeze(['A', 'B'])
const INVESTIGATOR_CODE = '06001'
const BASE_DECK = Object.freeze(['01001'])
const clone = value => structuredClone(value)
const sortedBag = bag => [...bag].sort()
const bagCounts = bag => bag.reduce((counts, token) => {
  counts[token] = (counts[token] || 0) + 1
  return counts
}, {})

// ---------------------------------------------------------------------------
// 真实战役状态（pick / singleA / singleB）：两条线的 records / investigators / chaosBag 分开，
// 非活动线整体放在 campaign.parts[part] 快照里（与引擎 setPart 语义一致）。
// ---------------------------------------------------------------------------

function investigatorRecord(seat, deck = BASE_DECK) {
  return {
    id: `inv-${seat}`, seat, code: INVESTIGATOR_CODE, name: `调查员${seat}`,
    deck: [...deck], xp: 0, earnedXp: 0, spentXp: 0,
    trauma: { physical: 0, mental: 0 }, status: 'active', purchases: [], removedCards: [],
  }
}

/** 建一份带两条线切片的战役状态；活动线由第一条座位所在线决定（setPart 真实载入）。 */
function createWorld({ mode = 'pick', seatParts = ['A', 'A', 'B'], difficulty = 'standard' } = {}) {
  const seatsByPart = { A: [], B: [] }
  seatParts.forEach((part, seat) => seatsByPart[part].push(seat))
  const campaign = {
    id: manifest.id, mode, seatParts: [...seatParts],
    activeParts: [...new Set(seatParts)],
    currentPart: null,
    parts: {}, records: {}, investigators: {}, retired: [], trauma: {},
    xp: 0, victory: 0, chaosBag: [], storySections: {}, scenarioResults: [],
    recordSchema: manifest.recordSchema,
  }
  for (const part of PART_IDS) {
    const scope = defaultPartScope()
    scope.chaosBag = baseBagFor(part, difficulty)
    for (const seat of seatsByPart[part]) {
      scope.investigators[seat] = investigatorRecord(seat)
      scope.trauma[seat] = { physical: 0, mental: 0 }
    }
    campaign.parts[part] = scope
  }
  const state = { campaign, chaosBag: [], difficulty }
  setPart(state, seatsByPart.A.length ? 'A' : 'B')
  delete campaign.parts[campaign.currentPart]
  return state
}

/** 真实的逐线读写视图（走 campaign-parts 的 partScope，与观察/效果层同一读点）。 */
function lineWorld(state, part) {
  const scope = partScope(state.campaign, part)
  const decks = {}
  const removedCards = {}
  for (const [seat, record] of Object.entries(scope.investigators || {})) {
    decks[seat] = [...(record.deck || [])]
    removedCards[seat] = clone(record.removedCards || [])
  }
  return { records: clone(scope.records), bag: clone(scope.chaosBag), decks, removedCards }
}

function setLineRecord(state, part, key, value) {
  recordInPart(state.campaign, part, key, value)
}

/** 效果记录器：把 walkCampaign 交回的效果交给真实 applyCampaignEffect 结算，并收集日志。 */
function createEffectRecorder(state) {
  const effects = []
  const logs = []
  const applyEffect = effect => {
    effects.push(effect)
    applyCampaignEffect(state, effect, text => logs.push(text))
  }
  return { effects, logs, applyEffect }
}

// ---------------------------------------------------------------------------
// 双线流程驱动：真实 walkCampaign 的两步推进（先到幕间入口停一次，关间准备后再连续读完子图）
// ---------------------------------------------------------------------------

/**
 * 走完一次真实 pick 全流程。
 * preferences: 4 个 'A'|'B'（每个章对先打哪条线）。
 * 返回章节/幕间/尾声的实际路径与最终世界状态。
 */
function runPickFlow({ preferences, difficulty = 'standard', choosePolicy = null } = {}) {
  const state = createWorld({ mode: 'pick', seatParts: ['A', 'A', 'B'], difficulty })
  const campaign = state.campaign
  const pickManifest = partManifest(manifest, 'pick')
  const graph = validateCampaignGraph(pickManifest)
  const pairs = tdeChapterPairs()
  const lastPair = pairs.at(-1)
  // 尾声 16 段：A4 / B4 的最终态记录从真实矩阵轴取，不写死键名。
  const finalRecords = { A: TDE_EPILOGUE_A_AXIS[1].record, B: TDE_EPILOGUE_B_AXIS[0].record }
  const recorder = createEffectRecorder(state)
  const chapters = []
  const interludeEntries = []
  const interludeSnapshots = []
  const decisions = []
  const visited = []
  const endKind = []

  const chooser = (id, node, options) => {
    if (node.type === 'partGate') {
      const wanted = preferences[node.pair - 1] || 'A'
      const target = TDE_PARTS[wanted].chapters.find(chapter => chapter.pair === node.pair)?.scenarioId
      const option = options.find(item => item.id === target) || options[0]
      decisions.push({ id, type: node.type, pair: node.pair, picked: option.id })
      return option.id
    }
    const picked = choosePolicy ? choosePolicy(id, node, options) : options[0].id
    decisions.push({ id, type: node.type, picked, available: options.map(option => option.id) })
    return picked
  }

  const enterChapter = node => {
    const scenarioId = node.scenarioId
    const part = partOfScenario(scenarioId)
    const previousPart = campaign.currentPart
    if (previousPart !== part) setPart(state, part)
    chapters.push({ scenarioId, part, previousPart, activePart: campaign.currentPart })
    // 模拟该章结算：成对的最后一对章节写各自线的最终态记录（尾声矩阵的唯一输入）。
    if (scenarioId === lastPair.A.scenarioId) setLineRecord(state, 'A', finalRecords.A, true)
    if (scenarioId === lastPair.B.scenarioId) setLineRecord(state, 'B', finalRecords.B, true)
    campaign.scenarioResults.push({ scenarioId, resolution: 'resolution1' })
    visited.push(scenarioId)
    enterCampaignNode(campaign, pickManifest, graph.nodes[node.id].next)
  }

  for (let guard = 0; guard < 256; guard += 1) {
    // 引擎第一步：到关卡/幕间入口就停（幕间入口开一次关间准备窗口）。
    const node = walkCampaign(campaign, pickManifest, chooser, recorder.applyEffect)
    if (node.type === 'end') { endKind.push('end'); break }
    if (node.type === 'scenario') { enterChapter(node); continue }
    assert.equal(node.type, 'interlude', `意外节点：${node.id}/${node.type}`)
    interludeEntries.push({ id: node.id, activePart: campaign.currentPart, text: node.text })
    assert.ok(TDE_INTERLUDE_TEXT[node.textKey], `幕间入口 ${node.id} 缺少真实正文键`)
    assert.equal(node.text, TDE_INTERLUDE_TEXT[node.textKey].text, `幕间入口 ${node.id} 的正文不是真实自译正文`)
    // 引擎第二步：关间准备结束后一次读完整个幕间子图（continuousInterlude），再回到章对门。
    const after = walkCampaign(campaign, pickManifest, chooser, recorder.applyEffect, { continuousInterlude: true })
    // 幕间子图读完后、下一章 setup 前：两线记录/袋的真实快照（用于断言跨线效果与不串线）。
    interludeSnapshots.push({ id: node.id, A: lineWorld(state, 'A'), B: lineWorld(state, 'B') })
    if (after.type === 'end') { endKind.push('end'); break }
    assert.equal(after.type, 'scenario', `读开幕间后应回到关卡，实际 ${after.id}/${after.type}`)
    enterChapter(after)
  }
  assert.ok(endKind.includes('end'), '流程必须到达 end')

  return {
    state, campaign, graph, pickManifest, recorder, chapters, interludeEntries, interludeSnapshots,
    decisions, visited,
    finalRecords,
    expectedEpilogue: tdeEpilogueFor({
      A: { [finalRecords.A]: true },
      B: { [finalRecords.B]: true },
    }),
  }
}

/** 单线流程驱动（singleA / singleB）：真实 manifest.flows[mode]，无章对门、只挂幕间 I。 */
function runSingleFlow(mode, { difficulty = 'standard' } = {}) {
  const part = mode === 'singleA' ? 'A' : 'B'
  const state = createWorld({ mode, seatParts: mode === 'singleA' ? ['A', 'A'] : ['B', 'B'], difficulty })
  const campaign = state.campaign
  const singleManifest = partManifest(manifest, mode)
  const graph = validateCampaignGraph(singleManifest)
  const recorder = createEffectRecorder(state)
  const chapters = []
  const interludeEntries = []
  const visited = []
  let ended = false
  const chooser = (id, node, options) => options[0].id

  const enterChapter = node => {
    const scenarioId = node.scenarioId
    assert.equal(partOfScenario(scenarioId), part, `单线 ${mode} 出现另一条线的关卡 ${scenarioId}`)
    assert.equal(campaign.currentPart, part, `单线 ${mode} 的 currentPart 不能切线`)
    chapters.push(scenarioId)
    visited.push(scenarioId)
    campaign.scenarioResults.push({ scenarioId, resolution: 'resolution1' })
    enterCampaignNode(campaign, singleManifest, graph.nodes[node.id].next)
  }

  for (let guard = 0; guard < 128; guard += 1) {
    const node = walkCampaign(campaign, singleManifest, chooser, recorder.applyEffect)
    if (node.type === 'end') { ended = true; break }
    if (node.type === 'scenario') { enterChapter(node); continue }
    assert.equal(node.type, 'interlude', `意外节点：${node.id}/${node.type}`)
    interludeEntries.push({ id: node.id, text: node.text, textKey: node.textKey })
    const after = walkCampaign(campaign, singleManifest, chooser, recorder.applyEffect, { continuousInterlude: true })
    if (after.type === 'end') { ended = true; break }
    assert.equal(after.type, 'scenario', `读开幕间后应回到关卡，实际 ${after.id}/${after.type}`)
    enterChapter(after)
  }
  assert.ok(ended, `单线 ${mode} 必须到达 end`)
  return { state, campaign, graph, singleManifest, recorder, chapters, interludeEntries, visited }
}

/** 所有「被访问过且带正文」的流程节点，其正文都必须被真实记录（log）。 */
function assertVisitedTextsLogged(flow, recorder) {
  const nodes = flow.graph.nodes
  const seen = flow.campaign.flow.history.map(visit => visit.nodeId)
  let checked = 0
  for (const id of new Set(seen)) {
    const node = nodes[id]
    if (!node?.text) continue
    assert.ok(recorder.logs.includes(node.text), `节点 ${id} 的正文没有进入剧情日志`)
    checked += 1
  }
  assert.ok(checked >= 3, '至少应校验若干段幕间/尾声正文')
  return checked
}

// ---------------------------------------------------------------------------
// ① 16 种逐章对先手排列
// ---------------------------------------------------------------------------

test('P9.5 G3 16 种逐章对先手排列都经过幕间 I/II/III 并按对屏障到达 end', () => {
  const pairs = tdeChapterPairs()
  assert.equal(pairs.length, 4, '真实 TDE 是 4 个章对')
  // 真实 pick 图：campaignGraph 直接消费 manifest.flows.pick（含幕间子图与尾声矩阵）。
  const pickManifest = partManifest(manifest, 'pick')
  const pickGraph = campaignGraph(pickManifest)
  assert.equal(pickGraph, pickManifest.flow, 'pick 图应来自 manifest.flows.pick')
  assert.deepEqual(validateCampaignGraph(pickManifest), pickGraph)
  for (const entryId of ['interlude1', 'interlude2', 'interlude3']) {
    assert.equal(pickGraph.nodes[entryId]?.type, 'interlude', `${entryId} 应是幕间入口`)
  }
  assert.equal(pickGraph.nodes.epilogueMatrix?.type, 'branch', '尾声矩阵挂在 pick 图上')
  const sequences = new Set()
  for (let mask = 0; mask < 16; mask += 1) {
    const preferences = pairs.map((entry, index) => ((mask >> index) & 1 ? 'B' : 'A'))
    const run = runPickFlow({ preferences })
    const label = `排列 ${preferences.join('')}`
    // 每对两章都打，且先手与偏好一致；逐对屏障成立。
    assert.equal(run.chapters.length, 8, `${label} 应打完 8 章`)
    assert.equal(new Set(run.chapters.map(chapter => chapter.scenarioId)).size, 8, `${label} 每章恰好一次`)
    for (const [index, entry] of pairs.entries()) {
      const first = preferences[index] === 'A' ? entry.A : entry.B
      const second = preferences[index] === 'A' ? entry.B : entry.A
      const firstPart = partOfScenario(first.scenarioId)
      const secondPart = partOfScenario(second.scenarioId)
      const firstAt = run.chapters.findIndex(chapter => chapter.scenarioId === first.scenarioId)
      const secondAt = run.chapters.findIndex(chapter => chapter.scenarioId === second.scenarioId)
      assert.equal(firstAt, index * 2, `${label} 第 ${entry.pair} 对先手应是 ${first.scenarioId}`)
      assert.equal(secondAt, index * 2 + 1, `${label} 第 ${entry.pair} 对后手应是 ${second.scenarioId}`)
      // 每章 setup 用目标线：进入该章时 currentPart 必须已切到它的 part。
      assert.equal(run.chapters[firstAt].activePart, firstPart, `${label} ${first.scenarioId} 的 setup 线`)
      assert.equal(run.chapters[secondAt].activePart, secondPart, `${label} ${second.scenarioId} 的 setup 线`)
      // 同对第二段必须换到另一条线（pick 的章内换线）。
      assert.notEqual(run.chapters[secondAt].previousPart, secondPart,
        `${label} 第 ${entry.pair} 对第二段应换线`)
    }
    // 三个幕间在真实流程里按顺序各只进一次。
    const entryIds = run.interludeEntries.map(entry => entry.id)
    assert.deepEqual(entryIds, ['interlude1', 'interlude2', 'interlude3'], `${label} 幕间入口顺序`)
    // 真实幕间标题/正文来自 TDE 数据。
    for (const entry of run.interludeEntries) {
      const number = Number(/^interlude(\d)$/.exec(entry.id)[1])
      assert.match(TDE_INTERLUDE_TITLES[number], /^幕间 (I|II|III)：/, `${label} ${entry.id} 标题`)
    }
    // 幕间边界必须切开章对：interlude n 出现在第 n 对之后、第 n+1 对之前。
    const historyIds = run.campaign.flow.history.map(visit => visit.nodeId)
    for (let pair = 1; pair < 4; pair += 1) {
      const entry = `interlude${pair}`
      const nextPairFirst = run.chapters[pair * 2].scenarioId
      const entryAt = historyIds.indexOf(entry)
      const nextFirstAt = historyIds.indexOf(nextPairFirst)
      assert.ok(entryAt >= 0 && entryAt < nextFirstAt, `${label} ${entry} 必须在第 ${pair + 1} 对之前`)
      assert.ok(historyIds.indexOf(pairs[pair - 1].A.scenarioId) < entryAt, `${label} ${entry} 在第 ${pair} 对之后`)
    }
    // 真实尾声矩阵：两条线的最终态记录 → 1/16 段，并走完特殊子步骤到 end。
    const epilogue = run.expectedEpilogue
    assert.ok(epilogue, `${label} 真实尾声矩阵应能由两线最终态记录定位`)
    assert.ok(historyIds.includes(`epilogueStory${epilogue.number}`), `${label} 应进入 Epilogue ${epilogue.number}`)
    // 真实尾声矩阵的最终落点：Epilogue 5 杀 A 线 → Part 17 → end。
    if (epilogue.mechanics.killPart) {
      assert.ok(historyIds.includes('epilogueKillCampaignA'), `${label} Epilogue ${epilogue.number} 应触发杀 A 线`)
    }
    assert.ok(historyIds.includes('epiloguePart17'), `${label} 应进入 Part 17`)
    assert.equal(historyIds.at(-1), 'end', `${label} 最终到达 end`)
    // 两条线的最终态记录不串线：A 轴记录只在 A 线，B 轴记录只在 B 线。
    const worldA = lineWorld(run.state, 'A').records
    const worldB = lineWorld(run.state, 'B').records
    assert.equal(worldA[run.finalRecords.A], true, `${label} A 轴最终态记录应落在 A 线`)
    assert.equal(worldB[run.finalRecords.B], true, `${label} B 轴最终态记录应落在 B 线`)
    assert.equal(Object.hasOwn(worldA, run.finalRecords.B), false, `${label} B 轴记录不能写进 A 线`)
    assert.equal(Object.hasOwn(worldB, run.finalRecords.A), false, `${label} A 轴记录不能写进 B 线`)
    // 被访问过的幕间/尾声节点正文全部进入日志（真实文本被处理过）。
    assert.ok(assertVisitedTextsLogged(run, run.recorder) >= 8)
    sequences.add(run.chapters.map(chapter => chapter.scenarioId).join(','))
  }
  assert.equal(sequences.size, 16, '16 种排列必须互不相同')
})

// ---------------------------------------------------------------------------
// ② 两条真实全流程：A-first / B-first（幕间后换先手、parts 切换）
// ---------------------------------------------------------------------------

test('P9.5 G3 A-first / B-first 两条全流程：8 章 setup、3 幕间与幕间后换线都成立', () => {
  const pairs = tdeChapterPairs()
  const expected = {
    'A-first': pairs.flatMap(entry => [entry.A.scenarioId, entry.B.scenarioId]),
    'B-first': pairs.flatMap(entry => [entry.B.scenarioId, entry.A.scenarioId]),
  }
  const runs = {}
  for (const [label, order] of Object.entries(expected)) {
    const preferences = pairs.map((entry, index) => (order[index * 2] === entry.A.scenarioId ? 'A' : 'B'))
    const run = runPickFlow({ preferences })
    runs[label] = run
    // 全流程顺序：A1→B1→A2→B2→A3→B3→A4→B4 / B 开头同理。
    assert.deepEqual(run.chapters.map(chapter => chapter.scenarioId), order, `${label} 全流程章节顺序`)
    // 每章 setup 进入：8 章各作为 scenario 节点进入一次。
    const scenarioVisits = run.campaign.flow.history
      .map(visit => run.graph.nodes[visit.nodeId])
      .filter(node => node?.type === 'scenario')
    assert.equal(scenarioVisits.length, 8, `${label} 应进入 8 次关卡 setup`)
    assert.deepEqual(scenarioVisits.map(node => node.scenarioId), order, `${label} 关卡进入顺序`)
    // 幕间后换先手：每次幕间之后进入的下一章线别 = 与幕间前最后打完的章不同线。
    for (let pair = 1; pair <= 3; pair += 1) {
      const before = run.chapters[pair * 2 - 1]
      const after = run.chapters[pair * 2]
      assert.notEqual(after.part, before.part, `${label} 幕间 ${pair} 后应换线`)
      assert.equal(after.previousPart, before.part, `${label} 幕间 ${pair} 后下一章 setup 前切线`)
    }
    // 幕间选择真实处理：I.2 四选一、II.1 三选一、III.1 条件二选一都发生过。
    const choiceIds = run.decisions.filter(decision => decision.type === 'choice').map(decision => decision.id)
    for (const choiceId of ['interlude1.2', 'interlude2.1', 'interlude3.1']) {
      assert.ok(choiceIds.includes(choiceId), `${label} 应处理幕间选择 ${choiceId}`)
    }
    // 黑猫选择写 A 线记录，随后命中 A 线记录对应的条件绿字节点（真实分支接线）。
    const choiceNode = run.graph.nodes['interlude1.2']
    const chosenOption = choiceNode.options[0]
    const choiceRecord = chosenOption.effects.find(effect => effect.type === 'record' && effect.part === 'A')
    assert.ok(choiceRecord, 'I.2 第一项应写一条 A 线记录')
    const branch = run.graph.nodes['interlude1.branch']
    const matched = branch.options.find(option => option.when?.record === choiceRecord.key && option.when.equals === true)
    assert.ok(matched, 'I.3 的条件绿字应引用该选择写下的记录')
    assert.ok(run.campaign.flow.history.some(visit => visit.nodeId === matched.next),
      `${label} 黑猫选择后应进入对应绿字节点 ${matched.next}`)
    const greenNode = run.graph.nodes[matched.next]
    assert.ok(run.recorder.logs.includes(TDE_INTERLUDE_TEXT[greenNode.textKey].text),
      `${label} 绿字正文应进入剧情日志`)
    // 跨线：黑猫「在你们身边」只写 A 线（取幕间 I 读完、下一章 setup 前的真实快照）。
    const afterInterludeOne = run.interludeSnapshots[0]
    assert.equal(afterInterludeOne.id, 'interlude1')
    assert.equal(afterInterludeOne.A.records[choiceRecord.key], true, `${label} 选择记录在 A 线`)
    assert.equal(Object.hasOwn(afterInterludeOne.B.records, choiceRecord.key), false, `${label} 选择记录不写进 B 线`)
    const sideNode = run.graph.nodes[matched.next]
    for (const effect of sideNode.effects || []) {
      if (effect.type !== 'record') continue
      const line = effect.part === 'A' ? afterInterludeOne.A : afterInterludeOne.B
      const other = effect.part === 'A' ? afterInterludeOne.B : afterInterludeOne.A
      assert.equal(line.records[effect.key], effect.value, `${label} 绿字效果 ${effect.key} 落在 ${effect.part} 线`)
      if (effect.value !== false) {
        assert.equal(Object.hasOwn(other.records, effect.key), false, `${label} ${effect.key} 不串线`)
      }
    }
    // 幕间 II 的跨线转移真的发生：II.1 选择写 B 线，II.3 把黑猫从 A 线移到 B 线。
    const afterInterludeTwo = run.interludeSnapshots[1]
    assert.equal(afterInterludeTwo.id, 'interlude2')
    const catKey = sideNode.effects.find(effect => effect.type === 'record' && effect.part === 'A')?.key
    assert.ok(catKey, '幕间 II 应继续使用黑猫在身边的记录键')
    assert.equal(afterInterludeTwo.A.records[catKey], false, `${label} 幕间 II 划掉 A 线黑猫`)
    assert.equal(afterInterludeTwo.B.records[catKey], true, `${label} 幕间 II 把黑猫转到 B 线`)
    // 尾声：真实矩阵选段 + 特殊子步骤（cell 5 杀 A 线）按数据走完。
    const epilogue = run.expectedEpilogue
    assert.ok(run.campaign.flow.history.some(visit => visit.nodeId === `epilogueStory${epilogue.number}`))
    if (epilogue.mechanics.killPart) {
      assert.ok(run.campaign.flow.history.some(visit => visit.nodeId === 'epilogueKillCampaignA'))
    }
    assert.ok(run.campaign.flow.history.some(visit => visit.nodeId === 'epiloguePart17'))
    assert.equal(run.campaign.flow.history.at(-1).nodeId, 'end')
    assert.equal(run.campaign.flowStage, undefined, '纯流程驱动不写引擎 flowStage')
  }
  // 两条全流程的章节序列不同。
  assert.notDeepEqual(
    runs['A-first'].chapters.map(chapter => chapter.scenarioId),
    runs['B-first'].chapters.map(chapter => chapter.scenarioId),
  )
})

// ---------------------------------------------------------------------------
// ③ 真实引擎：pick 3 人 2+1 / 2 人 1+1 从 A1/B1 切线与幕间 I 连续读完
// ---------------------------------------------------------------------------

function engineSettle(engine, state) {
  settlePendingChoices(engine, state)
}

/** 结算待决选择，同时记录每次 engine 询问的 kind/source（用于断言幕间选择真实发生）。 */
function engineSettleRecording(engine, state, pending) {
  for (let guard = 0; state.pendingChoice && guard < 400; guard += 1) {
    const choice = state.pendingChoice
    pending.push({ kind: choice.kind, source: choice.source })
    const optionId = choice.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || choice.options[0].id
    engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId })
  }
  assert.equal(state.pendingChoice, null, `待决选择未收敛：${state.pendingChoice?.kind}`)
}

function engineLegalActions(engine, state) {
  return legalFor(engine, state).map(move => move.action)
}

/** 用真实引擎的调试入口结束当前关卡（引擎结算路径：finishScenario → ScenarioEnded → 关间）。 */
function engineFinishScenario(engine, state, { resolutionKey = null, pending = null } = {}) {
  const settle = () => (pending ? engineSettleRecording(engine, state, pending) : engineSettle(engine, state))
  settle()
  const resolutionKeys = Object.keys(state.scenario.resolutions || {})
  const key = resolutionKey && resolutionKeys.includes(resolutionKey)
    ? resolutionKey
    : resolutionKeys.find(item => item !== 'noResolution') || resolutionKeys[0]
  const before = state.campaign.scenarioResults.length
  engine.applyMove(state, 0, { action: 'debug', kind: 'endScenario', resolutionKey: key })
  settle()
  assert.equal(state.campaign.scenarioResults.length, before + 1, '关卡结算应写入 scenarioResults')
}

function engineContinueHub(engine, state, pending = null) {
  const settle = () => (pending ? engineSettleRecording(engine, state, pending) : engineSettle(engine, state))
  settle()
  const move = legalFor(engine, state).find(item => item.action === 'hubContinue')
  assert.ok(move, `应可进入关间；实际可行动作 ${engineLegalActions(engine, state).join(',')}`)
  play(engine, state, move)
  settle()
}

function engineBeginScenario(engine, state, pending = null) {
  const settle = () => (pending ? engineSettleRecording(engine, state, pending) : engineSettle(engine, state))
  settle()
  const move = legalFor(engine, state).find(item => item.action === 'hubBeginScenario')
  assert.ok(move, `应可开始关卡；实际可行动作 ${engineLegalActions(engine, state).join(',')}`)
  assert.ok(!move.disabled, `开始关卡被禁用：${move.explanation}`)
  play(engine, state, move)
  settle()
}

/** 关间准备窗口：全部座位确认，直到引擎一次读完幕间子图并进入下一关 setup。返回准备窗口轮数。 */
function engineFinishInterlude(engine, state, { maxRounds = 16, pending = null } = {}) {
  const settle = () => (pending ? engineSettleRecording(engine, state, pending) : engineSettle(engine, state))
  let rounds = 0
  while (state.campaign.flowStage === 'interlude' && rounds < maxRounds) {
    rounds += 1
    for (let guard = 0; guard < 32; guard += 1) {
      settle()
      const done = legalFor(engine, state).find(move => move.action === 'hubDoneSeat')
      if (!done) break
      play(engine, state, done, engine.decisionSeat(state))
    }
    settle()
  }
  assert.notEqual(state.campaign.flowStage, 'interlude',
    `幕间没有在 ${maxRounds} 轮关间准备内读完（flow=${state.campaign.flow?.nodeId}）`)
  return rounds
}

function assertBagEquals(state, part, expected, label) {
  const campaign = state.campaign
  const bag = campaign.currentPart === part ? state.chaosBag : campaign.parts?.[part]?.chaosBag
  assert.deepEqual(bagCounts(bag || []), bagCounts(expected), `${label}：${part} 线混乱袋`)
}

test('P9.5 真实引擎 pick 3 人 2+1：A1→B1 切线、幕间 I 连续读完并切到 A2', async () => {
  const { engine } = await loadTdeCampaignWorld()
  const state = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'tde-p95-flow-3pick' })
  assert.equal(state.campaign.mode, 'pick')
  assert.deepEqual(state.campaign.seatParts, ['A', 'B', 'A'], '3 人分选默认 2+1 交替分线')
  assert.equal(laneCounts(state.campaign.seatParts).A, 2)
  assert.equal(laneCounts(state.campaign.seatParts).B, 1)
  const pairs = tdeChapterPairs()
  const difficulty = state.difficulty || 'standard'

  // A1：单运行时进入 A 线第一章，A 袋按 partChaosBags.A 初始化。
  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[0].A.scenarioId, '首关应是 A1')
  assert.equal(state.campaign.currentPart, 'A', 'A1 在 A 线运行')
  assert.equal(state.laneRuntime.part, 'A', 'lane adapter 切到 A 线')
  assert.deepEqual([...state.laneRuntime.roomSeats], state.campaign.seatParts
    .map((part, seat) => (part === 'A' ? seat : -1)).filter(seat => seat >= 0), 'A 线房间座位映射')
  assertBagEquals(state, 'A', baseBagFor('A', difficulty), 'A1 开局')
  assert.equal(bagCounts(state.chaosBag).skull, undefined, 'A 袋没有 skull')
  assert.equal(bagCounts(state.chaosBag).elderthing, undefined, 'A 袋没有 elderthing')

  engineFinishScenario(engine, state)
  engineContinueHub(engine, state)
  assert.equal(state.campaign.flow.nodeId, pairs[0].B.scenarioId, 'A1 完成后章对门只剩 B1')
  assert.equal(state.hubSelectedScenarioId, pairs[0].B.scenarioId, '下一关选中 B1')
  assert.equal(state.campaign.currentPart, 'A', 'A1 结算后仍停在 A 线，直到 B1 setup')

  // B1：进入前切 part，B 袋按 partChaosBags.B 初始化（切袋发生在 setup 之前）。
  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[0].B.scenarioId, '第二关应是 B1')
  assert.equal(state.campaign.currentPart, 'B', 'B1 切到 B 线')
  assert.deepEqual([...state.laneRuntime.roomSeats], [1], 'B 线房间座位映射')
  assertBagEquals(state, 'B', baseBagFor('B', difficulty), 'B1 开局')
  assert.equal(bagCounts(state.chaosBag).skull, 2, 'B 袋 2 张 skull')
  assert.equal(bagCounts(state.chaosBag).tablet, undefined, 'B 袋没有 tablet')

  // 同对两章完成 → 幕间 I 入口（一个关间准备窗口）。
  engineFinishScenario(engine, state)
  engineContinueHub(engine, state)
  assert.equal(state.campaign.flowStage, 'interlude', '同对两章完成后进入幕间')
  assert.equal(state.campaign.flow.nodeId, 'interlude1', '幕间 I 入口')
  assert.equal(state.uiState, 'interlude')
  assert.ok(state.log.includes(TDE_INTERLUDE_TEXT.theBlackCat.text), '幕间 I 首段正文进入日志')

  // 关间准备结束 → 一次读完幕间 I 子图（含 I.2 选择、I.3 条件绿字、跨线效果）→ A2 setup。
  engineFinishInterlude(engine, state)
  assert.equal(state.campaign.flowStage, 'scenario', '幕间 I 读完后回到关卡节点')
  assert.equal(state.hubSelectedScenarioId, pairs[1].A.scenarioId, '幕间 I 后先手是 A2')
  assert.equal(state.campaign.currentPart, 'B', 'A2 setup 前仍停在上一章线（B）')
  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[1].A.scenarioId, '进入 A2')
  assert.equal(state.campaign.currentPart, 'A', 'A2 切回 A 线 —— 幕间后换线')
  assert.deepEqual([...state.laneRuntime.roomSeats], state.campaign.seatParts
    .map((part, seat) => (part === 'A' ? seat : -1)).filter(seat => seat >= 0))

  // 黑猫选择（I.2 首项：带去消息）→ A 线记录 + A 线黑猫在身边；效应只落目标线。
  const interludeNodes = interludeFlowNodes('pick')
  const choiceNode = interludeNodes.find(node => node.id === 'interlude1.2')
  const chosen = choiceNode.options[0]
  const choiceRecord = chosen.effects.find(effect => effect.type === 'record')
  assert.equal(state.campaign.records[choiceRecord.key], true, '黑猫选择写进 A 线（当前活动线）')
  const greenNode = interludeNodes.find(node => node.id === 'interlude1.deliveredNews')
  assert.ok(state.log.includes(TDE_INTERLUDE_TEXT[greenNode.textKey].text), '命中「带去消息」绿字')
  const sideRecord = greenNode.effects.find(effect => effect.type === 'record' && effect.part === 'A')
  assert.equal(state.campaign.records[sideRecord.key], true, '绿字把黑猫留在 A 线')
  assert.equal(bagCounts(state.chaosBag).elderthing, (bagCounts(baseBagFor('A', difficulty)).elderthing || 0) + 1,
    '绿字只给 A 袋加 elderthing')
  const bBag = bagCounts(state.campaign.parts.B.chaosBag)
  assert.equal(bBag.elderthing, (bagCounts(baseBagFor('B', difficulty)).elderthing || 0) + 1,
    'B 袋只被绿字的跨线效果加 1 张 elderthing')
  assert.equal(bBag.tablet, undefined, 'B 袋没有 tablet（跨线 tablet 未触发）')
  // 幕间正文/标题真实来自 TDE 数据。
  const entryNode = interludeNodes.find(node => node.id === 'interlude1')
  assert.equal(entryNode.title, TDE_INTERLUDE_TITLES[1], '幕间 I 标题接线')
  assert.match(TDE_INTERLUDE_TITLES[1], /^幕间 I：/)
})

test('P9.5 真实引擎 pick 2 人 1+1：两线各 1 座，A1/B1 各自开局后进入幕间 I', async () => {
  const { engine } = await loadTdeCampaignWorld()
  const state = hubSetup(engine, { seats: 2, mode: 'pick', seed: 'tde-p95-flow-2pick' })
  assert.equal(state.campaign.mode, 'pick')
  assert.deepEqual(state.campaign.seatParts, ['A', 'B'], '2 人分选 1+1')
  assert.deepEqual(laneCounts(state.campaign.seatParts), { A: 1, B: 1 })
  const pairs = tdeChapterPairs()

  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[0].A.scenarioId)
  assert.equal(state.campaign.currentPart, 'A')
  assert.deepEqual([...state.laneRuntime.roomSeats], [0])
  engineFinishScenario(engine, state)
  engineContinueHub(engine, state)
  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[0].B.scenarioId)
  assert.equal(state.campaign.currentPart, 'B')
  assert.deepEqual([...state.laneRuntime.roomSeats], [1])
  engineFinishScenario(engine, state)
  engineContinueHub(engine, state)
  assert.equal(state.campaign.flowStage, 'interlude')
  assert.equal(state.campaign.flow.nodeId, 'interlude1')
  engineFinishInterlude(engine, state)
  assert.equal(state.hubSelectedScenarioId, pairs[1].A.scenarioId, '1+1 分选同样在幕间 I 后回到 A2')
  engineBeginScenario(engine, state)
  assert.equal(state.scenario.id, pairs[1].A.scenarioId)
  assert.equal(state.campaign.currentPart, 'A')
})

// ---------------------------------------------------------------------------
// ③b 真实引擎全流程：8 章 + 3 幕间 + 银钥匙跨线 + 尾声矩阵到 end
// ---------------------------------------------------------------------------

test('P9.5 G3 真实引擎 pick 3 人 2+1 全流程：8 章 + 3 幕间 + 银钥匙跨线 + 尾声到 end', async () => {
  const { engine } = await loadTdeCampaignWorld()
  const state = hubSetup(engine, { seats: 3, mode: 'pick', seed: 'tde-p95-flow-full' })
  const pairs = tdeChapterPairs()
  const difficulty = state.difficulty || 'standard'
  const graph = validateCampaignGraph(partManifest(manifest, 'pick'))
  const b4ScenarioId = pairs[3].B.scenarioId
  const pending = []
  const chapters = []
  const interludeEntries = []
  const interludeRounds = []
  const catKeys = []
  const silverKeyHeldByLine = []
  const silverStoryEarly = graph.nodes['interlude3.silverKeyStory']
  const silverKeyCodeEarly = silverStoryEarly.effects.find(effect => effect.type === 'addCampaignCardToDeck').code
  // 黑猫「在你们身边」记录键取自真实 I.3 绿字效果数据。
  const catKey = graph.nodes['interlude1.deliveredNews'].effects
    .find(effect => effect.type === 'record' && effect.part === 'A').key

  const begin = () => {
    engineBeginScenario(engine, state, pending)
    chapters.push({ scenarioId: state.scenario.id, part: state.campaign.currentPart })
  }

  begin()
  for (let guard = 0; guard < 160; guard += 1) {
    if (state.status !== 'playing') break
    if (state.uiState === 'inScenario') {
      // B4 取「桥梁已建成」结局（resolution2），让 16 段尾声矩阵有合法的 B 轴最终态记录。
      engineFinishScenario(engine, state, {
        resolutionKey: state.scenario.id === b4ScenarioId ? 'resolution2' : null,
        pending,
      })
      continue
    }
    if (state.uiState === 'scenarioResult') { engineContinueHub(engine, state, pending); continue }
    if (state.campaign.flowStage === 'interlude') {
      const entryId = state.campaign.flow.nodeId
      interludeEntries.push(entryId)
      const entryNode = graph.nodes[entryId]
      assert.ok(state.log.includes(entryNode.text), `幕间 ${entryId} 的正文应进入日志`)
      // 幕间入口是一个关间准备窗口；结束后引擎应一次读完整个幕间子图。
      // 关间准备前先记下两条线的银钥匙持有一手（用于判断 removeCampaignCard 是移除还是 no-op）。
      silverKeyHeldByLine.push({
        id: entryId,
        A: Object.values(partScope(state.campaign, 'A').investigators || {})
          .some(record => (record.deck || []).includes(silverKeyCodeEarly)),
        B: Object.values(partScope(state.campaign, 'B').investigators || {})
          .some(record => (record.deck || []).includes(silverKeyCodeEarly)),
      })
      interludeRounds.push(engineFinishInterlude(engine, state, { pending }))
      catKeys.push({
        id: entryId,
        A: Boolean(partScope(state.campaign, 'A').records[catKey]),
        B: Boolean(partScope(state.campaign, 'B').records[catKey]),
      })
      continue
    }
    if (state.uiState === 'scenarioSetup') { begin(); continue }
    assert.fail(`未知局外状态：${state.uiState} / flowStage=${state.campaign.flowStage} 可行动作 ${engineLegalActions(engine, state).join(',')}`)
  }
  assert.equal(state.status, 'over', `战役应结束；实际 uiState=${state.uiState} 可行动作 ${engineLegalActions(engine, state).join(',')}`)

  // 8 章，按 A-first 的逐章对顺序各进入一次 setup；进入时线别正确切线。
  const expectedChapters = pairs.flatMap(entry => [
    { scenarioId: entry.A.scenarioId, part: 'A' },
    { scenarioId: entry.B.scenarioId, part: 'B' },
  ])
  assert.deepEqual(chapters, expectedChapters, '全流程应在真实引擎里 A1→B1→…→A4→B4')
  // 三个幕间按顺序各进一次，且每个只开一轮关间准备（连续读完整子图）。
  assert.deepEqual(interludeEntries, ['interlude1', 'interlude2', 'interlude3'])
  assert.deepEqual(interludeRounds, [1, 1, 1], '每个幕间应在一轮关间准备内连续读完')
  // 真实引擎的幕间选择以 campaignBranch 询问（source = 幕间节点 id）。
  const choiceSources = pending.filter(choice => choice.kind === 'campaignBranch').map(choice => choice.source)
  for (const expected of ['interlude1.2', 'interlude2.1', 'interlude3.1']) {
    assert.ok(choiceSources.includes(expected), `幕间选择 ${expected} 应由引擎真实询问`)
  }
  assert.ok(choiceSources.some(source => String(source).startsWith('gate')), '章对门先手也由引擎真实询问')
  // 黑猫记录始终只在一条线上（跨线转移，不双写）。
  for (const entry of catKeys) {
    assert.notEqual(entry.A, entry.B, `${entry.id} 读完后黑猫只应在一条线上（A=${entry.A} / B=${entry.B}）`)
  }

  const worldA = lineWorld(state, 'A')
  const worldB = lineWorld(state, 'B')
  // 黑猫 I.2 选择写 A 线（首选项 = 真实数据里的第一条选项）。
  const chosenOption = graph.nodes['interlude1.2'].options[0]
  const choiceRecord = chosenOption.effects.find(effect => effect.type === 'record')
  assert.equal(worldA.records[choiceRecord.key], true, '黑猫选择记录在 A 线')
  assert.equal(Object.hasOwn(worldB.records, choiceRecord.key), false, '黑猫选择记录不写进 B 线')
  // 幕间 II 的 II.1 首选项写 B 线（A 线只为默认值/被勾销，不能为真）。
  const iiChoice = graph.nodes['interlude2.1'].options.find(option => option.id === 'requestAid')
  const iiRecord = iiChoice.effects.find(effect => effect.type === 'record')
  assert.equal(worldB.records[iiRecord.key], true, 'II.1 黑猫口信记录在 B 线')
  assert.notEqual(worldA.records[iiRecord.key], true, 'II.1 记录不写进 A 线')

  // 银钥匙：从 B 线牌库移除、加入 A 线牌库，记录跨线划掉（卡号取自真实幕间数据）。
  const silverStory = graph.nodes['interlude3.silverKeyStory']
  const silverAdd = silverStory.effects.find(effect => effect.type === 'addCampaignCardToDeck')
  const silverRemove = silverStory.pendingEffects.find(effect => effect.op === 'removeCampaignCard')
  const silverRecordA = silverStory.effects.find(effect => effect.type === 'record' && effect.part === 'A')
  const silverRecordB = silverStory.effects.find(effect => effect.type === 'record' && effect.part === 'B')
  assert.equal(silverAdd.code, silverRemove.code, '银钥匙加入/移除是同一张卡')
  const silverKeyCode = silverAdd.code
  const decksA = Object.values(partScope(state.campaign, 'A').investigators || {}).map(record => record.deck || [])
  const decksB = Object.values(partScope(state.campaign, 'B').investigators || {}).map(record => record.deck || [])
  assert.equal(decksA.some(deck => deck.includes(silverKeyCode)), true, 'A 线牌库应加入银钥匙')
  assert.equal(decksB.some(deck => deck.includes(silverKeyCode)), false, 'B 线牌库应移除银钥匙')
  // 银钥匙转移前 A 线牌库必须没有；B 线把银钥匙作为剧情资产（setAside storyAsset）持有，
  // 真实章节数据不把它放进战役牌库——所以 removeCampaignCard 在真实存档里应是 no-op，
  // 只有在牌库持有时才记 removedCards（有/无两种都由转移前快照决定，不写死实现细节）。
  const heldBeforeTransfer = silverKeyHeldByLine.find(entry => entry.id === 'interlude3')
  assert.equal(heldBeforeTransfer.A, false, '银钥匙转移前不在 A 线牌库')
  const removedB = Object.values(partScope(state.campaign, 'B').investigators || {})
    .flatMap(record => record.removedCards || [])
  assert.equal(removedB.some(entry => entry.code === silverKeyCode), heldBeforeTransfer.B,
    heldBeforeTransfer.B ? 'B 线牌库持有银钥匙时应记下移除'
      : 'B 线牌库未持有时 removeCampaignCard 不应凭空记一条移除')
  assert.equal(worldA.records[silverRecordA.key], silverRecordA.value ?? true, '银钥匙记录转到 A 线')
  assert.equal(worldB.records[silverRecordB.key], silverRecordB.value, '银钥匙记录从 B 线划掉')

  // 混乱袋按线初始化且互不串线：除幕间数据里出现过的 token 外，两条线的张数与基础袋一致。
  const mutatedTokens = new Set()
  const collectNodeTokens = node => {
    for (const effect of node.effects || []) if (effect.type === 'chaos') mutatedTokens.add(effect.token)
    for (const green of node.greens || []) {
      for (const effect of green.effects || []) if (effect.type === 'chaos') mutatedTokens.add(effect.token)
      for (const pendingEffect of green.pendingEffects || []) {
        for (const token of Object.values(pendingEffect.tokenByDifficulty || {})) mutatedTokens.add(token)
      }
    }
    for (const branch of node.branches || []) {
      for (const effect of branch.then || []) if (effect.type === 'chaos') mutatedTokens.add(effect.token)
    }
    for (const pendingEffect of node.pendingEffects || []) {
      for (const token of Object.values(pendingEffect.tokenByDifficulty || {})) mutatedTokens.add(token)
    }
  }
  for (const node of Object.values(graph.nodes)) collectNodeTokens(node)
  const baseCounts = { A: bagCounts(baseBagFor('A', difficulty)), B: bagCounts(baseBagFor('B', difficulty)) }
  const finalCounts = { A: bagCounts(worldA.bag), B: bagCounts(worldB.bag) }
  for (const part of ['A', 'B']) {
    for (const token of new Set([...Object.keys(baseCounts[part]), ...Object.keys(finalCounts[part])])) {
      if (token === 'skull') continue // B2 的结局数据会给 B 线加 skull；单独断言。
      if (mutatedTokens.has(token)) continue
      assert.equal(finalCounts[part][token] || 0, baseCounts[part][token] || 0,
        `${part} 线的 ${token} 张数不应被跨线效果改变`)
    }
  }
  assert.equal(finalCounts.A.skull || 0, 0, 'A 袋永远没有 skull（B 袋的符号没有串线）')
  assert.ok((finalCounts.B.skull || 0) >= baseCounts.B.skull,
    'B 袋保留自己的 skull（A 线初始化不会覆盖 B 袋）')

  // 尾声矩阵：由两条线的最终态记录定位 1/16，走特殊子步骤与 Part 17 到 end。
  const expectedEpilogue = tdeEpilogueFor({ A: worldA.records, B: worldB.records })
  assert.ok(expectedEpilogue, '两条线最终态记录应能定位 1/16 段尾声')
  const historyIds = state.campaign.flow.history.map(visit => visit.nodeId)
  assert.ok(historyIds.includes(`epilogueStory${expectedEpilogue.number}`),
    `应进入 Epilogue ${expectedEpilogue.number}`)
  if (expectedEpilogue.mechanics.killPart) {
    assert.ok(historyIds.includes('epilogueKillCampaignA'), 'Epilogue 5 应触发杀 A 线')
  }
  assert.ok(historyIds.includes('epiloguePart17'), '尾声最后进入 Part 17')
  assert.equal(historyIds.at(-1), 'end', '战役流程终点是 end')
})

// ---------------------------------------------------------------------------
// ④ 单线 A/B：4 章 + 幕间 I 对应分支，不挂 II/III、不进尾声矩阵
// ---------------------------------------------------------------------------

test('P9.5 单线 A/B 只跑本线 4 章 + 幕间 I 对应变体，不挂幕间 II/III 与尾声', () => {
  assert.equal(TDE_SINGLE_LINE_EPILOGUE.hasText, false, '官方单线不播放尾声正文')
  for (const [mode, part] of [['singleA', 'A'], ['singleB', 'B']]) {
    const flow = manifest.flows[mode]
    assert.ok(flow, `${mode} 应有真实 flow`)
    const graph = validateCampaignGraph({ ...manifest, flow })
    const nodeIds = Object.keys(graph.nodes)
    assert.equal(nodeIds.some(id => id.startsWith('interlude2')), false, `${mode} 不挂幕间 II`)
    assert.equal(nodeIds.some(id => id.startsWith('interlude3')), false, `${mode} 不挂幕间 III`)
    assert.equal(nodeIds.some(id => /^interlude1(\.|$)/.test(id)), true, `${mode} 挂幕间 I 对应变体`)
    assert.equal(nodeIds.some(id => graph.nodes[id].type === 'partGate'), false, `${mode} 没有章对门`)
    assert.equal(nodeIds.some(id => id.startsWith('epilogue')), false, `${mode} 不接尾声矩阵`)

    const run = runSingleFlow(mode)
    assert.deepEqual(run.chapters, TDE_PARTS[part].chapters.map(chapter => chapter.scenarioId),
      `${mode} 章节顺序`)
    assert.equal(run.chapters.length, 4, `${mode} 只跑本线 4 章`)
    assert.deepEqual(run.interludeEntries.map(entry => entry.id), ['interlude1'], `${mode} 只进幕间 I 入口`)
    // 单线变体节点数：A 线 2 节点（theBlackCat → theBlackCat1），B 线 3 节点（+ youAreOnYourOwn）。
    const variant = interludeFlowNodes(mode)
    const variantIds = new Set(variant.map(node => node.id))
    const historyIds = run.campaign.flow.history.map(visit => visit.nodeId)
    const visitedVariant = historyIds.filter(id => variantIds.has(id))
    assert.equal(visitedVariant.length, variant.length, `${mode} 应读完幕间 I 的全部变体节点`)
    if (mode === 'singleA') {
      assert.equal(variant.length, 2, '单线 A 的幕间 I 是 2 节点变体')
      assert.ok(historyIds.includes('interlude1.1'))
      assert.equal(historyIds.some(id => id === 'interlude1.3'), false, '单线 A 不读 B 侧黑猫 3')
    } else {
      assert.equal(variant.length, 3, '单线 B 的幕间 I 是 3 节点变体')
      assert.ok(historyIds.includes('interlude1.3'))
      assert.ok(historyIds.includes('interlude1.youAreOnYourOwn'))
      // B 单线的「你独自前行」写 B 线记录。
      assert.equal(lineWorld(run.state, 'B').records.youAreOnYourOwn, true)
      assert.equal(Object.hasOwn(lineWorld(run.state, 'A').records, 'youAreOnYourOwn'), false, 'B 单线记录不串 A 线')
    }
    assert.ok(run.campaign.flow.history.at(-1).nodeId === 'end', `${mode} 末章后直接 end`)
  }
})
