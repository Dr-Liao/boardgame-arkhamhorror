// 《食梦者》P9.5 幕间跨线效果验收：真实 TDE 幕间数据（interludes.js 的 I/II/III 子图）在
// 真实引擎流程/效果模块上结算，逐条断言「记录落在正确 part、混乱袋只改目标线、牌库跨线转移」。
//
// 做法：用真实 `partManifest(manifest,'pick')` 的完整 pick 图，把 walkCampaign 的起点指到
// 目标幕间节点（真实节点数据，不另造 flow），由真实 walkCampaign 处理 node.greens /
// node.branches（exclusive/independent）/ pendingEffects / choice 选项与边缘效果，效果经真实
// `applyCampaignEffect`（part 分支：record/increment/chaos/chaosByDifficulty/addCampaignCardToDeck/
// removeCampaignCard）落到 campaign-parts 的逐线作用域。
//
// 期望值由测试独立复算：从真实节点数据取效果列表，用一个只理解幕间效果子集（record/increment/
// chaos）的「模型解释器」算出期望的 A/B 两线记录与混乱袋，再与引擎结算后的真实状态逐项比对；
// 分支选择用测试自己的条件解释器（hasRecord / lacksRecord / all / any / not / plain record）复算，
// 不调用引擎的条件函数（避免自证）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifest } from '../content/campaigns/theDreamEaters/manifest.js'
import { TDE_INTERLUDE_TEXT } from '../content/campaigns/theDreamEaters/interludes.js'
import { baseBagFor } from '../content/campaigns/theDreamEaters/tde-chaos.js'
import { validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { partManifest } from '../src/campaign/part-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import {
  defaultPartScope, partScope, recordInPart, setPart,
} from '../src/campaign/campaign-parts.js'

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
// 真实战役状态（两条线切片）
// ---------------------------------------------------------------------------

function investigatorRecord(seat, deck = BASE_DECK) {
  return {
    id: `inv-${seat}`, seat, code: INVESTIGATOR_CODE, name: `调查员${seat}`,
    deck: [...deck], xp: 0, earnedXp: 0, spentXp: 0,
    trauma: { physical: 0, mental: 0 }, status: 'active', purchases: [], removedCards: [],
  }
}

/**
 * 建一份双线状态。bags / decks 可按线（A/B）或按房间座位覆盖：
 *   bags: { A: [...], B: [...] }  decks: { 0: [...], 2: [...] }。
 */
function createWorld({
  seatParts = ['A', 'A', 'B'], difficulty = 'standard', bags = {}, decks = {}, records = {},
} = {}) {
  const seatsByPart = { A: [], B: [] }
  seatParts.forEach((part, seat) => seatsByPart[part].push(seat))
  const campaign = {
    id: manifest.id, mode: 'pick', seatParts: [...seatParts],
    activeParts: [...new Set(seatParts)], currentPart: null,
    parts: {}, records: {}, investigators: {}, retired: [], trauma: {},
    xp: 0, victory: 0, chaosBag: [], storySections: {}, scenarioResults: [],
    recordSchema: manifest.recordSchema,
  }
  for (const part of PART_IDS) {
    const scope = defaultPartScope()
    scope.chaosBag = [...(bags[part] || baseBagFor(part, difficulty))]
    for (const seat of seatsByPart[part]) {
      scope.investigators[seat] = investigatorRecord(seat, decks[seat] || BASE_DECK)
      scope.trauma[seat] = { physical: 0, mental: 0 }
    }
    for (const [key, value] of Object.entries(records[part] || {})) scope.records[key] = clone(value)
    campaign.parts[part] = scope
  }
  const state = { campaign, chaosBag: [], difficulty }
  setPart(state, seatsByPart.A.length ? 'A' : 'B')
  delete campaign.parts[campaign.currentPart]
  return state
}

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

function worldModel(state) {
  return { A: lineWorld(state, 'A'), B: lineWorld(state, 'B') }
}

function setLineRecord(state, part, key, value) {
  recordInPart(state.campaign, part, key, value)
}

function setLineBag(state, part, bag) {
  const campaign = state.campaign
  const copy = [...bag]
  if (campaign.currentPart === part) {
    campaign.chaosBag = copy
    state.chaosBag = copy
    return
  }
  campaign.parts[part] ||= defaultPartScope()
  campaign.parts[part].chaosBag = copy
}

// ---------------------------------------------------------------------------
// 独立的期望值模型：幕间效果的 record / increment / chaos 语义 + 独立条件解释器
// ---------------------------------------------------------------------------

/** 普通 record 条件按「任一线有该键即读到其值」复算（P9.5 引擎的跨线兜底口径）。 */
function readRecord(model, key) {
  for (const part of PART_IDS) {
    if (Object.hasOwn(model[part].records, key)) return model[part].records[key]
  }
  return undefined
}

function evalCondition(condition, model) {
  if (!condition) return true
  if (condition.all) return condition.all.every(item => evalCondition(item, model))
  if (condition.any) return condition.any.some(item => evalCondition(item, model))
  if (condition.not) return !evalCondition(condition.not, model)
  if (condition.hasRecord) {
    const { part, key } = condition.hasRecord
    return Boolean(model[part]?.records?.[key])
  }
  if (condition.part && Object.keys(condition).length === 1) {
    // 纯 part 条件（不参与幕间效果；出现即说明测试用到了未覆盖的形态）。
    throw new Error(`条件解释器不支持纯 part 条件：${JSON.stringify(condition)}`)
  }
  if (Object.hasOwn(condition, 'record')) {
    const value = readRecord(model, condition.record)
    if (Object.hasOwn(condition, 'equals')) return value === condition.equals
    if (Object.hasOwn(condition, 'atLeast')) return Number(value || 0) >= condition.atLeast
    if (Object.hasOwn(condition, 'includes')) return Array.isArray(value) && value.includes(condition.includes)
    return Boolean(value)
  }
  throw new Error(`条件解释器不支持：${JSON.stringify(condition)}`)
}

/** 把一组幕间效果作用到期望模型上（只支持 record/increment/chaos/log）。 */
function applyEffects(model, effects) {
  for (const effect of effects || []) {
    if (!effect) continue
    if (effect.type === 'log') continue
    const part = effect.part
    if (!PART_IDS.includes(part)) throw new Error(`幕间效果缺少 part：${JSON.stringify(effect)}`)
    if (effect.type === 'record') {
      model[part].records[effect.key] = clone(effect.value)
    } else if (effect.type === 'increment') {
      model[part].records[effect.key] = Number(model[part].records[effect.key] || 0) + effect.amount
    } else if (effect.type === 'chaos') {
      const bag = model[part].bag
      if (effect.amount < 0) {
        for (let count = 0; count < -effect.amount; count += 1) {
          const index = bag.indexOf(effect.token)
          if (index < 0) throw new Error(`期望模型里 ${part} 袋没有足够的 ${effect.token}`)
          bag.splice(index, 1)
        }
      } else {
        for (let count = 0; count < effect.amount; count += 1) bag.push(effect.token)
      }
    } else {
      throw new Error(`期望模型不支持的效果类型：${effect.type}`)
    }
  }
  return model
}

/** `{ type:'chaosByDifficulty', part, tokenByDifficulty }` 形式的挂起效果按难度折算成 chaos 效果。 */
function pendingEffectAsEffect(pending, difficulty) {
  if (pending.op === 'chaosByDifficulty') {
    const token = pending.tokenByDifficulty?.[difficulty]
    if (!token) throw new Error(`难度 ${difficulty} 没有对应标记`)
    return { type: 'chaos', part: pending.part, token, amount: 1 }
  }
  throw new Error(`期望模型不支持挂起效果：${pending.op}`)
}

function assertModel(state, expected, label) {
  const actual = worldModel(state)
  for (const part of PART_IDS) {
    assert.deepEqual(actual[part].records, expected[part].records, `${label}：${part} 线记录`)
    assert.deepEqual(bagCounts(actual[part].bag), bagCounts(expected[part].bag), `${label}：${part} 线混乱袋`)
  }
}

function assertLineRecord(state, part, key, value, label) {
  const scope = partScope(state.campaign, part)
  assert.deepEqual(scope.records[key], value, `${label}：${part} 线记录 ${key}`)
}

function assertLogged(recorder, textKey, label) {
  const entry = TDE_INTERLUDE_TEXT[textKey]
  assert.ok(entry, `真实幕间数据缺少正文键 ${textKey}`)
  assert.ok(recorder.logs.includes(entry.text), `${label}：正文 ${textKey} 应进入剧情日志`)
}

// ---------------------------------------------------------------------------
// 驱动：从 pick 图里的真实幕间节点出发（不另造节点、不改节点数据）
// ---------------------------------------------------------------------------

function pickGraph() {
  return validateCampaignGraph(partManifest(manifest, 'pick'))
}

function createEffectRecorder(state) {
  const effects = []
  const logs = []
  const applyEffect = effect => {
    effects.push(effect)
    applyCampaignEffect(state, effect, text => logs.push(text))
  }
  return { effects, logs, applyEffect }
}

/**
 * 从真实 pick 图的指定节点开始走：
 *   · readThrough=false（默认）只走一次，让 walkCampaign 在入口节点停住并结算该节点的效果；
 *   · readThrough=true 时继续用连续幕间语义走完子图（用于「选择 → 绿字」这种多节点路径）。
 */
function runFrom(state, from, { choosePolicy = null, readThrough = false } = {}) {
  const graph = pickGraph()
  assert.ok(graph.nodes[from], `pick 图里没有节点 ${from}`)
  const flow = { start: from, nodes: graph.nodes }
  const manifestSlice = { ...manifest, flow }
  const recorder = createEffectRecorder(state)
  const choices = []
  const chooser = (id, node, options) => {
    // choosePolicy 只回答真正的玩家选择（choice）；章对门/自动分支一律取第一个可用出口。
    const picked = node.type === 'choice' && choosePolicy ? choosePolicy(id, node, options) : options[0].id
    choices.push({ id, type: node.type, picked, available: options.map(option => option.id) })
    return picked
  }
  const historyStart = state.campaign.flow?.history?.length || 0
  let node = walkCampaign(state.campaign, manifestSlice, chooser, recorder.applyEffect)
  if (readThrough && ['interlude', 'choice', 'branch', 'story'].includes(node.type)) {
    node = walkCampaign(state.campaign, manifestSlice, chooser, recorder.applyEffect, { continuousInterlude: true })
  }
  const history = state.campaign.flow.history.slice(historyStart).map(visit => visit.nodeId)
  return { graph, recorder, choices, history, stopped: node }
}

function nodeOf(graph, id) {
  const node = graph.nodes[id]
  assert.ok(node, `pick 图里没有节点 ${id}`)
  return node
}

/** exclusive 分支：返回唯一命中的分支（测试自己的条件解释器）。 */
function exclusiveBranch(node, model) {
  const matched = node.branches.filter(branch => evalCondition(branch.when, model))
  assert.equal(matched.length, 1, `节点 ${node.id} 的 exclusive 分支应恰好命中 1 条，实际 ${matched.length}`)
  return matched[0]
}

/** independent 分支：返回全部命中的分支（测试自己的条件解释器）。 */
function independentBranches(node, model) {
  return node.branches.filter(branch => evalCondition(branch.when, model))
}

// ---------------------------------------------------------------------------
// ① 幕间 I《黑猫》：选择 → A 线记录 → 条件绿字 → 跨线效果
// ---------------------------------------------------------------------------

test('P9.5 G4 幕间 I：黑猫四选一写 A 线记录并按条件命中对应绿字（含双线 chaos）', () => {
  const graph = pickGraph()
  const choiceNode = nodeOf(graph, 'interlude1.2')
  const branchNode = nodeOf(graph, 'interlude1.branch')
  assert.equal(choiceNode.type, 'choice')
  assert.equal(branchNode.type, 'branch')
  assert.equal(choiceNode.options.length, 4, 'I.2 是四选一')
  for (const option of choiceNode.options) {
    const state = createWorld()
    const before = worldModel(state)
    const run = runFrom(state, 'interlude1.2', {
      readThrough: true,
      choosePolicy: () => option.id,
    })
    // 选择效果：恰好一条 A 线记录。
    const optionRecords = (option.effects || []).filter(effect => effect.type === 'record')
    assert.ok(optionRecords.length >= 1, `选项 ${option.id} 应写记录`)
    const expected = clone(before)
    applyEffects(expected, option.effects)
    // 命中绿字：用测试自己的条件解释器从真实分支数据复算（选择记录在 A 线）。
    const matched = branchNode.options.filter(branch => evalCondition(branch.when, expected))
    assert.equal(matched.length, 1, `选项 ${option.id} 应恰好命中 1 条绿字`)
    assert.ok(run.history.includes(matched[0].next), `选项 ${option.id} 应进入绿字节点 ${matched[0].next}`)
    const greenNode = nodeOf(graph, matched[0].next)
    applyEffects(expected, greenNode.effects)
    assertModel(state, expected, `黑猫选择 ${option.id}`)
    // A 线记录 / 绿字正文真实落库、落日志。
    for (const effect of optionRecords) {
      if (effect.value === false) continue
      assertLineRecord(state, 'A', effect.key, true, `黑猫选择 ${option.id}`)
      assert.equal(Object.hasOwn(lineWorld(state, 'B').records, effect.key), false,
        `选项 ${option.id} 的记录不能写进 B 线`)
    }
    assertLogged(run.recorder, greenNode.textKey, `黑猫选择 ${option.id}`)
    assertLogged(run.recorder, choiceNode.textKey, `黑猫选择 ${option.id}`)
    // 四条绿字的效果互斥：只能结算命中的那一条。
    for (const other of branchNode.options) {
      if (other === matched[0]) continue
      const otherNode = graph.nodes[other.next]
      if (!otherNode?.effects) continue
      for (const effect of otherNode.effects) {
        if (effect.type !== 'record' || effect.value === false) continue
        const otherRecords = lineWorld(state, effect.part).records
        if (Object.hasOwn(otherRecords, effect.key)) {
          assert.fail(`选项 ${option.id} 误结算了另一条绿字的效果 ${effect.key}`)
        }
      }
    }
  }
})

test('P9.5 G4 幕间 I：选择记录随活动线切换仍写 A 线（currentPart=B 时走 parts 快照）', () => {
  // 真实 pick 流程在 A1→B1 后 currentPart 是 B：此时黑猫选择仍要写 A 线记录。
  const state = createWorld({ bags: { A: baseBagFor('A', 'standard'), B: baseBagFor('B', 'standard') } })
  setPart(state, 'B')
  const graph = pickGraph()
  const choiceNode = nodeOf(graph, 'interlude1.2')
  const option = choiceNode.options[0]
  const before = worldModel(state)
  const run = runFrom(state, 'interlude1.2', { readThrough: true, choosePolicy: () => option.id })
  const expected = clone(before)
  applyEffects(expected, option.effects)
  const matched = nodeOf(graph, 'interlude1.branch').options
    .filter(branch => evalCondition(branch.when, expected))
  assert.equal(matched.length, 1)
  applyEffects(expected, nodeOf(graph, matched[0].next).effects)
  assertModel(state, expected, 'currentPart=B 时的黑猫选择')
  assert.equal(state.campaign.currentPart, 'B', '结算幕间不能偷换活动线')
  for (const effect of option.effects) {
    if (effect.type !== 'record') continue
    assertLineRecord(state, 'A', effect.key, effect.value, 'A 线快照写入')
    assert.equal(Object.hasOwn(state.campaign.records, effect.key), false, '不能写进活动线（B）顶层的 records')
  }
  assertLogged(run.recorder, nodeOf(graph, matched[0].next).textKey, '黑猫绿字')
})

// ---------------------------------------------------------------------------
// ② 幕间 II《入梦者》的 pendingEngine 分支（exclusive / independent）
// ---------------------------------------------------------------------------

test('P9.5 G4 幕间 II：requestedAid / warnedTheOthers 三条 exclusive 分支的黑猫与 chaos 只改目标线', () => {
  const graph = pickGraph()
  for (const nodeId of ['interlude2.3.requestedAid', 'interlude2.3.warnedTheOthers']) {
    const node = nodeOf(graph, nodeId)
    assert.equal(node.branchesMode, 'exclusive', `${nodeId} 是 exclusive 分支`)
    assert.equal(node.branches.length, 3)
    // 三条分支的用例：两条线都没有黑猫 / A 线有黑猫 / B 线有黑猫。
    const cases = [
      { key: 'none', records: {}, bags: {} },
      {
        key: 'A',
        records: { A: { theBlackCatIsAtYourSide: true } },
        bags: { A: [...baseBagFor('A', 'standard'), 'elderthing'] },
      },
      {
        key: 'B',
        records: { B: { theBlackCatIsAtYourSide: true } },
        bags: { B: [...baseBagFor('B', 'standard'), 'tablet'] },
      },
    ]
    for (const entry of cases) {
      const state = createWorld({ bags: entry.bags, records: entry.records })
      const before = worldModel(state)
      // 用测试自己的条件解释器从 before 复算命中的分支。
      const matched = exclusiveBranch(node, before)
      const run = runFrom(state, nodeId)
      const expected = clone(before)
      applyEffects(expected, node.effects)
      applyEffects(expected, matched.then)
      assertModel(state, expected, `${nodeId}（${entry.key}）`)
      assertLogged(run.recorder, node.textKey, `${nodeId}（${entry.key}）`)
      // 明确的跨线事实：两条线都没有黑猫 → 写目标线；目标线已有 → 原样保留；
      // 另一条线有时 → 勾销它并把黑猫写到目标线（记录转移只由真实分支数据决定）。
      const catKey = 'theBlackCatIsAtYourSide'
      const catEffects = matched.then.filter(effect => effect.type === 'record' && effect.key === catKey)
      const targetPart = nodeId.endsWith('requestedAid') ? 'B' : 'A'
      if (entry.key === 'none') {
        assertLineRecord(state, targetPart, catKey, true, `${nodeId}（none）`)
        assert.equal(Object.hasOwn(lineWorld(state, targetPart === 'A' ? 'B' : 'A').records, catKey), false,
          `${nodeId}（none）另一线不应有黑猫记录`)
        assert.ok(matched.then.some(effect => effect.type === 'chaos'),
          `${nodeId}（none）应同时给双线加 chaos 标记`)
      } else {
        // 目标线本就有黑猫：分支 then 为空或只做勾销；最终记录由数据驱动（见上面的 assertModel）。
        if (entry.key !== targetPart) {
          assert.ok(catEffects.some(effect => effect.part === entry.key && effect.value === false),
            `${nodeId}（${entry.key}）应勾销原有黑猫记录`)
          assert.ok(catEffects.some(effect => effect.part === targetPart && effect.value === true),
            `${nodeId}（${entry.key}）应把黑猫转到 ${targetPart} 线`)
        }
      }
    }
  }
})

test('P9.5 G4 幕间 II：sharedKnowledge 的 independent 分支两条线各自结算', () => {
  const graph = pickGraph()
  const node = nodeOf(graph, 'interlude2.3.sharedKnowledge')
  assert.equal(node.branchesMode, 'independent', 'sharedKnowledge 是 independent 分支')
  const state = createWorld({
    records: {
      A: { theBlackCatIsAtYourSide: true },
      B: { theBlackCatIsAtYourSide: true },
    },
    bags: {
      A: [...baseBagFor('A', 'standard'), 'elderthing'],
      B: [...baseBagFor('B', 'standard'), 'tablet'],
    },
  })
  const before = worldModel(state)
  const matched = independentBranches(node, before)
  assert.equal(matched.length, 2, '两条 independent 分支都应命中')
  const run = runFrom(state, 'interlude2.3.sharedKnowledge')
  const expected = clone(before)
  applyEffects(expected, node.effects)
  for (const branch of matched) applyEffects(expected, branch.then)
  assertModel(state, expected, 'sharedKnowledge 双线独立结算')
  assertLineRecord(state, 'A', 'theDreamersKnowOfAnotherPath', true, 'sharedKnowledge 无条件效果在 A 线')
  assert.equal(Object.hasOwn(lineWorld(state, 'B').records, 'theDreamersKnowOfAnotherPath'), false, '不写 B 线')
  assertLogged(run.recorder, node.textKey, 'sharedKnowledge')
})

test('P9.5 G4 幕间 II：被俘绿字按 A 线 wasCaptured 集合择一，searching 绿字双线写记录', () => {
  const graph = pickGraph()
  const greensNode = nodeOf(graph, 'interlude2.2')
  const capturedGreen = greensNode.greens.find(green => green.when.capturedInvestigators === 'someNotCaptured')
  const allCapturedGreen = greensNode.greens.find(green => green.when.capturedInvestigators === 'allCaptured')
  assert.ok(capturedGreen && allCapturedGreen, 'II.2 有待/全被俘两段绿字')

  // 至少一人未被俘：只有 inv-0 被俘。
  {
    const state = createWorld()
    setLineRecord(state, 'A', 'wasCaptured', ['inv-0'])
    const run = runFrom(state, 'interlude2.2')
    assertLogged(run.recorder, capturedGreen.textKey, '至少一人未被俘')
    assert.ok(!run.recorder.logs.includes(TDE_INTERLUDE_TEXT[allCapturedGreen.textKey].text),
      '不能同时读「全员被俘」绿字')
    assert.deepEqual(lineWorld(state, 'A').records.wasCaptured, ['inv-0'], '绿字不修改被俘记录')
  }
  // 全员被俘：A 线两名调查员都被俘。
  {
    const state = createWorld()
    setLineRecord(state, 'A', 'wasCaptured', ['inv-0', 'inv-1'])
    const run = runFrom(state, 'interlude2.2')
    assertLogged(run.recorder, allCapturedGreen.textKey, '全员被俘')
    assert.ok(!run.recorder.logs.includes(TDE_INTERLUDE_TEXT[capturedGreen.textKey].text))
  }
  // searchingForTheTruth：A 线「黑猫有预感 + 伦道夫未遭俘虏」→ 绿字 + 双线记录。
  {
    const searchingNode = nodeOf(graph, 'interlude2.searching')
    const state = createWorld()
    setLineRecord(state, 'A', 'theBlackCatHasAHunch', true)
    setLineRecord(state, 'A', 'randolphEludedCapture', true)
    const before = worldModel(state)
    const branch = searchingNode.options.filter(option => evalCondition(option.when, before))
    assert.equal(branch.length, 1)
    assert.equal(branch[0].id, 'searching', 'A 线两条记录都为真时应命中 searching')
    const run = runFrom(state, 'interlude2.searching')
    assert.equal(run.stopped.id, 'interlude2.searchingStory', '应进入 searchingForTheTruth 节点')
    assertLogged(run.recorder, nodeOf(graph, 'interlude2.searchingStory').textKey, 'searchingForTheTruth')
    assertLineRecord(state, 'A', 'theBlackCatIsSearchingForTheTruth', true, '双线记录 A 线')
    assertLineRecord(state, 'B', 'theBlackCatIsSearchingForTheTruth', true, '双线记录 B 线')
  }
  // 条件不成立（只有预感、没有未遭俘虏）→ 不写 searching 记录。
  {
    const state = createWorld()
    setLineRecord(state, 'A', 'theBlackCatHasAHunch', true)
    const run = runFrom(state, 'interlude2.searching')
    assert.equal(run.stopped.id, 'interlude2.3', '条件不成立应继续 II.3')
    assert.equal(Object.hasOwn(lineWorld(state, 'A').records, 'theBlackCatIsSearchingForTheTruth'), false)
    assert.equal(Object.hasOwn(lineWorld(state, 'B').records, 'theBlackCatIsSearchingForTheTruth'), false)
  }
})

// ---------------------------------------------------------------------------
// ③ 幕间 III《伟大的存在》：银钥匙跨线转移 / 弱化只加 A 袋 / AtYourSide 分支
// ---------------------------------------------------------------------------

test('P9.5 G4 幕间 III：银钥匙 06189 从 B 线牌库移除并加入 A 线牌库，记录跨线划掉', () => {
  const graph = pickGraph()
  const keyNode = nodeOf(graph, 'interlude3.silverKey')
  const storyNode = nodeOf(graph, 'interlude3.silverKeyStory')
  assert.equal(storyNode.type, 'story')
  const addEffect = (storyNode.effects || []).find(effect => effect.type === 'addCampaignCardToDeck')
  const removeEffect = (storyNode.pendingEffects || []).find(effect => effect.op === 'removeCampaignCard')
  assert.ok(addEffect, '银钥匙应有「加入战役牌库」效果')
  assert.ok(removeEffect, '银钥匙应有「从另一线移除」挂起效果')
  assert.equal(addEffect.code, removeEffect.code, '加入与移除必须是同一张卡')
  assert.equal(addEffect.part, 'A')
  assert.equal(removeEffect.part, 'B')
  const silverKeyCode = addEffect.code
  // B 线记录持有银钥匙、B 线牌库里有实体卡；A 线没有。
  const state = createWorld({
    decks: { 2: [silverKeyCode, ...BASE_DECK] },
    records: { B: { theInvestigatorsPossessTheSilverKey: true } },
  })
  const before = worldModel(state)
  assert.ok(Object.values(before.B.decks).some(deck => deck.includes(silverKeyCode)), '前置：银钥匙在 B 线牌库')
  assert.equal(Object.values(before.A.decks).some(deck => deck.includes(silverKeyCode)), false, '前置：A 线没有银钥匙')
  const run = runFrom(state, 'interlude3.silverKey')
  // 记录：B 线划掉、A 线持有。
  assertLineRecord(state, 'B', 'theInvestigatorsPossessTheSilverKey', false, '银钥匙记录从 B 线划掉')
  assertLineRecord(state, 'A', 'theInvestigatorsPossessTheSilverKey', true, '银钥匙记录转到 A 线')
  // 牌库：B 线实体卡移除并记账，A 线实体卡加入。
  const after = worldModel(state)
  assert.equal(Object.values(after.B.decks).some(deck => deck.includes(silverKeyCode)), false, 'B 线牌库不再有银钥匙')
  assert.equal(Object.values(after.A.decks).some(deck => deck.includes(silverKeyCode)), true, 'A 线牌库加入银钥匙')
  const bRemoved = Object.values(after.B.removedCards).flat()
  assert.ok(bRemoved.some(entry => entry.code === silverKeyCode), 'B 线 removedCards 记下银钥匙移除')
  assert.equal(Object.values(after.A.removedCards).flat().some(entry => entry.code === silverKeyCode), false)
  // 混乱袋不受银钥匙影响。
  assert.deepEqual(bagCounts(lineWorld(state, 'A').bag), bagCounts(before.A.bag))
  assert.deepEqual(bagCounts(lineWorld(state, 'B').bag), bagCounts(before.B.bag))
  assertLogged(run.recorder, storyNode.textKey, '银钥匙剧情')
  // 银钥匙分支由 B 线记录命中（跨线普通 record 条件）。
  assert.ok(run.history.includes('interlude3.silverKeyStory'), '应走 possessSilverKey 分支')
  assert.equal(keyNode.options.length, 2)
})

test('P9.5 G4 幕间 III：弱化 chaosByDifficulty 只加 A 袋、双线 searching 记录被划掉', () => {
  const graph = pickGraph()
  const entryNode = nodeOf(graph, 'interlude3')
  assert.ok(entryNode.greens.length >= 2, 'III.1 有「弱化」与「搜查真相」两段条件绿字')
  const growGreen = entryNode.greens.find(green => (green.pendingEffects || []).some(effect => effect.op === 'chaosByDifficulty'))
  const searchGreen = entryNode.greens.find(green => (green.effects || []).some(effect => effect.type === 'record'))
  assert.ok(growGreen && searchGreen)
  for (const difficulty of ['standard', 'expert']) {
    const state = createWorld({
      difficulty,
      records: {
        A: {
          theDreamersGrowWeaker: true,
          randolphCarterDidNotSurviveTheVoyage: true,
          theBlackCatIsSearchingForTheTruth: true,
        },
        B: { theBlackCatIsSearchingForTheTruth: true },
      },
    })
    const before = worldModel(state)
    const run = runFrom(state, 'interlude3')
    const expected = clone(before)
    applyEffects(expected, (growGreen.effects || []))
    for (const pending of growGreen.pendingEffects) applyEffects(expected, [pendingEffectAsEffect(pending, difficulty)])
    applyEffects(expected, (searchGreen.effects || []))
    assertModel(state, expected, `III.1 弱化（${difficulty}）`)
    // 弱化的标记只进 A 袋。
    const token = growGreen.pendingEffects[0].tokenByDifficulty[difficulty]
    assert.equal(bagCounts(lineWorld(state, 'A').bag)[token],
      (bagCounts(baseBagFor('A', difficulty))[token] || 0) + 1, `弱化给 A 袋加 ${token}`)
    assert.deepEqual(bagCounts(lineWorld(state, 'B').bag), bagCounts(before.B.bag), '弱化不改 B 袋')
    assertLogged(run.recorder, growGreen.textKey, `弱化绿字（${difficulty}）`)
    // 双线 searching 记录被划掉。
    assertLineRecord(state, 'A', 'theBlackCatIsSearchingForTheTruth', false, 'III 划掉 A 线 searching')
    assertLineRecord(state, 'B', 'theBlackCatIsSearchingForTheTruth', false, 'III 划掉 B 线 searching')
    assertLogged(run.recorder, searchGreen.textKey, '搜查真相绿字')
  }
})

test('P9.5 G4 幕间 III：奈亚拉托提普/阿特拉克·纳克亚分支的黑猫与 chaos 只改目标线', () => {
  const graph = pickGraph()
  for (const nodeId of ['interlude3.nyarlathotep', 'interlude3.atlachNacha']) {
    const node = nodeOf(graph, nodeId)
    assert.equal(node.branchesMode, 'exclusive')
    assert.equal(node.branches.length, 3)
    const cases = [
      { key: 'none', records: {}, bags: {} },
      {
        key: 'A',
        records: { A: { theBlackCatIsAtYourSide: true } },
        bags: { A: [...baseBagFor('A', 'standard'), 'elderthing'] },
      },
      {
        key: 'B',
        records: { B: { theBlackCatIsAtYourSide: true } },
        bags: { B: [...baseBagFor('B', 'standard'), 'tablet'] },
      },
    ]
    for (const entry of cases) {
      const state = createWorld({ bags: entry.bags, records: entry.records })
      const before = worldModel(state)
      const matched = exclusiveBranch(node, before)
      const run = runFrom(state, nodeId)
      const expected = clone(before)
      applyEffects(expected, node.effects)
      applyEffects(expected, matched.then)
      assertModel(state, expected, `${nodeId}（${entry.key}）`)
      assertLogged(run.recorder, node.textKey, `${nodeId}（${entry.key}）`)
      // 两条线都没有黑猫时把黑猫写到该节点对应的线（奈亚拉托提普 → A，阿特拉克 → B）；
      // 分支 then 里的记录效果逐条落库（勾销/转移都由真实分支数据决定）。
      const catKey = 'theBlackCatIsAtYourSide'
      for (const effect of matched.then) {
        if (effect.type !== 'record' || effect.key !== catKey) continue
        assertLineRecord(state, effect.part, catKey, effect.value, `${nodeId}（${entry.key}）`)
      }
      if (entry.key === 'none') {
        const targetPart = nodeId.endsWith('nyarlathotep') ? 'A' : 'B'
        assertLineRecord(state, targetPart, catKey, true, `${nodeId}（none）`)
      }
    }
  }
})
