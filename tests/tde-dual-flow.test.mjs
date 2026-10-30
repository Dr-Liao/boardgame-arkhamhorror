// TDE P5 批次 1：双线战役流程（part-flow + partGate）与观察投影的 Node 验收。
//
// 路线图 §7.2.2：四对 A/B、每对可先 A 或先 B、同对两章都完成才进幕间 → 16 种合法排列；
// §11.2 门禁 3/5：16 排列全部跑轻量 flow 测试、另一线数据在投影里脱敏。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  dualPartFlow, normalizePartPairs, partFlow, partGateOptions, singlePartFlow, validatePartManifest,
} from '../src/campaign/part-flow.js'
import { enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { createPartsState, partScopedView } from '../src/campaign/campaign-parts.js'
import { campaignView } from '../src/campaign/campaign.js'
import {
  TDE_INTERACTIONS, TDE_INTERACTION_IDS, tdeInteraction, tdeInteractionsForScenario, validateInteractionInventory,
} from '../content/campaigns/theDreamEaters/interactions.js'

const PARTS = Object.freeze({
  A: { name: '梦寻', chapters: [
    { scenarioId: 'a1', name: '梦境门外' }, { scenarioId: 'a2', name: '寻觅卡达斯' },
    { scenarioId: 'a3', name: '月之暗面' }, { scenarioId: 'a4', name: '神居之所' }] },
  B: { name: '梦网', chapters: [
    { scenarioId: 'b1', name: '清醒噩梦' }, { scenarioId: 'b2', name: '万千骇形' },
    { scenarioId: 'b3', name: '无归之地' }, { scenarioId: 'b4', name: '编织宇宙' }] },
})
const SCENARIO_IDS = [...PARTS.A.chapters, ...PARTS.B.chapters].map(chapter => chapter.scenarioId)
const manifestFor = flow => ({ id: 'dualTest', scenarioIds: SCENARIO_IDS, parts: PARTS, sequences: undefined, flow })

function chapterOf(options, letter) {
  return options.find(option => option.id.startsWith(letter.toLowerCase()))
}

/**
 * 用偏好模拟一次完整八章流程：preferences 是 4 个 'A'|'B'（每个章对先打哪条线）。
 * 返回按实际打通顺序排列的关卡 id 列表。
 */
function simulate(flow, preferences) {
  const manifest = manifestFor(flow)
  const graph = validateCampaignGraph(manifest)
  const campaign = { records: {}, scenarioResults: [] }
  const visited = []
  for (let steps = 0; steps < 64; steps += 1) {
    const node = walkCampaign(campaign, manifest, (id, gate, options) => {
      const pair = gate.pair
      const wanted = preferences[pair - 1] || 'A'
      const option = chapterOf(options, wanted) || options[0]
      return option.id
    })
    if (node.type === 'end') return visited
    if (node.type === 'interlude') {
      enterCampaignNode(campaign, manifest, graph.nodes[node.id].next)
      continue
    }
    assert.equal(node.type, 'scenario', `意外节点：${node.id}/${node.type}`)
    visited.push(node.scenarioId)
    campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
    // 引擎在结算时把 pendingNode 指向本关出口（chapter → 本对 gate）；测试里显式前进一步。
    enterCampaignNode(campaign, manifest, graph.nodes[node.id].next)
  }
  throw new Error('流程没有在 64 步内结束')
}

test('part-flow：章对归一化、流程图合法、单线只跑本线 4 章', () => {
  const pairs = normalizePartPairs(PARTS)
  assert.deepEqual(pairs.map(pair => [pair.pair, pair.A.scenarioId, pair.B.scenarioId]),
    [[1, 'a1', 'b1'], [2, 'a2', 'b2'], [3, 'a3', 'b3'], [4, 'a4', 'b4']])
  const dual = dualPartFlow(PARTS)
  const graph = validateCampaignGraph({ scenarioIds: SCENARIO_IDS, flow: dual })
  assert.equal(graph.start, 'gate1')
  assert.equal(graph.nodes.gate1.type, 'partGate')
  assert.deepEqual(graph.nodes.gate1.options.map(option => option.id), ['a1', 'b1'])
  assert.equal(graph.nodes.gate1.next, 'interlude1')
  assert.equal(graph.nodes.gate4.next, 'end')
  assert.equal(graph.nodes.interlude3.next, 'gate4')
  // 单线：4 章 + 3 个幕间 + end。
  for (const part of ['A', 'B']) {
    const flow = singlePartFlow(PARTS, part)
    const single = validateCampaignGraph({ scenarioIds: SCENARIO_IDS, flow })
    const chapters = Object.values(single.nodes).filter(node => node.type === 'scenario').map(node => node.scenarioId)
    assert.deepEqual(chapters, PARTS[part].chapters.map(chapter => chapter.scenarioId))
    assert.equal(Object.values(single.nodes).filter(node => node.type === 'interlude').length, 3)
    assert.equal(single.nodes[chapters.at(-1)].next, 'end')
  }
  assert.throws(() => partFlow(PARTS, { mode: 'nope' }), /未知开局模式/)
})

test('part-flow：16 种章对先手排列全部可达，且逐对屏障成立', () => {
  const flow = dualPartFlow(PARTS)
  const sequences = new Set()
  for (let mask = 0; mask < 16; mask += 1) {
    const preferences = [0, 1, 2, 3].map(index => ((mask >> index) & 1 ? 'B' : 'A'))
    const visited = simulate(flow, preferences)
    assert.equal(visited.length, 8, `排列 ${preferences.join('')} 应打完 8 章`)
    assert.equal(new Set(visited).size, 8, '每章只打一次')
    sequences.add(visited.join(','))
    // 逐对屏障：第 p 对的两章都必须出现在第 p+1 对之前。
    for (let pair = 1; pair <= 4; pair += 1) {
      const ids = [PARTS.A.chapters[pair - 1].scenarioId, PARTS.B.chapters[pair - 1].scenarioId]
      const positions = ids.map(id => visited.indexOf(id))
      assert.ok(positions.every(position => position >= 0), `第 ${pair} 对必须都打完`)
      if (pair < 4) {
        const nextStart = Math.min(...[PARTS.A.chapters[pair].scenarioId, PARTS.B.chapters[pair].scenarioId]
          .map(id => visited.indexOf(id)))
        assert.ok(Math.max(...positions) < nextStart, `第 ${pair} 对必须在下一对之前完成`)
      }
      // 同一对的第一章就是该排列的先手。
      assert.equal(visited[Math.min(...positions)], preferences[pair - 1] === 'B' ? ids[1] : ids[0])
    }
  }
  assert.equal(sequences.size, 16, '16 种排列必须互不相同')
})

test('partGate：只剩一边时自动进入，两边都完成时走幕间，两边都未完成才问玩家', () => {
  const flow = dualPartFlow(PARTS)
  const manifest = manifestFor(flow)
  const campaign = { records: {}, scenarioResults: [] }
  // 第一次进入：两边都未完成 → 需要玩家选择。
  const asked = []
  const first = walkCampaign(campaign, manifest, (id, gate, options) => {
    asked.push({ id, pair: gate.pair, options: options.map(option => option.id) })
    return options[0].id
  })
  assert.equal(first.scenarioId, 'a1')
  assert.deepEqual(asked[0].options, ['a1', 'b1'])
  // a1 完成后回到 gate1：只剩 b1 → 不再询问（choices 里不会记录第二次询问）。
  campaign.scenarioResults.push({ scenarioId: 'a1', resolution: 'R1' })
  enterCampaignNode(campaign, manifest, 'gate1')
  let asks = 0
  const second = walkCampaign(campaign, manifest, (id, gate, options) => {
    asks += 1
    return options[0].id
  })
  assert.equal(second.scenarioId, 'b1')
  assert.equal(asks, 0, '只剩一个出口时不应再问玩家')
  // b1 完成后回到 gate1：两边都完成 → 自动进幕间 1。
  campaign.scenarioResults.push({ scenarioId: 'b1', resolution: 'R1' })
  enterCampaignNode(campaign, manifest, 'gate1')
  const third = walkCampaign(campaign, manifest, () => { throw new Error('不应询问') })
  assert.equal(third.type, 'interlude')
  assert.equal(third.id, 'interlude1')
})

test('part-flow：声明校验拒绝错位的章对与未登记关卡', () => {
  assert.equal(validatePartManifest({ scenarioIds: SCENARIO_IDS, parts: PARTS }).ok, true)
  const badPairs = validatePartManifest({ scenarioIds: SCENARIO_IDS, parts: {
    A: PARTS.A, B: { name: '梦网', chapters: PARTS.B.chapters.slice(0, 3) },
  } })
  assert.equal(badPairs.ok, false)
  assert.match(badPairs.problems[0], /章对数不一致/)
  const unknown = validatePartManifest({ scenarioIds: ['a1', 'b1'], parts: PARTS })
  assert.equal(unknown.ok, false)
  assert.ok(unknown.problems.some(problem => /未登记的关卡/.test(problem)))
  const duplicate = validatePartManifest({ scenarioIds: SCENARIO_IDS, parts: {
    A: { name: '梦寻', chapters: [{ scenarioId: 'a1' }, { scenarioId: 'a1' }] },
    B: { name: '梦网', chapters: [{ scenarioId: 'b1' }, { scenarioId: 'b2' }] },
  } })
  assert.equal(duplicate.ok, false)
  assert.ok(duplicate.problems.some(problem => /同一关卡/.test(problem) || /恰好一章/.test(problem)))
  assert.equal(validatePartManifest({ parts: PARTS }).ok, false)
  assert.equal(validatePartManifest({ scenarioIds: SCENARIO_IDS, parts: PARTS, modes: ['nope'] }).ok, false)
})

test('双线条件可以嵌进普通条件（part/mode + completed/record）', () => {
  const campaign = {
    mode: 'pick', currentPart: 'A', activeParts: ['A'],
    records: { evidence: 2 },
    scenarioResults: [{ scenarioId: 'a1', resolution: 'R1' }],
  }
  assert.equal(flowCondition({ mode: 'pick' }, campaign), true)
  assert.equal(flowCondition({ mode: 'parallel' }, campaign), false)
  assert.equal(flowCondition({ part: 'A' }, campaign), true)
  assert.equal(flowCondition({ part: 'B' }, campaign), false)
  assert.equal(flowCondition({ activeParts: ['A'] }, campaign), true)
  assert.equal(flowCondition({ modeIn: ['pick', 'parallel'] }, campaign), true)
  // 同一叶子里的普通条件与 part 条件是与关系。
  assert.equal(flowCondition({ mode: 'pick', completed: 'a1' }, campaign), true)
  assert.equal(flowCondition({ mode: 'parallel', completed: 'a1' }, campaign), false)
  assert.equal(flowCondition({ mode: 'pick', record: 'evidence', atLeast: 2 }, campaign), true)
  assert.equal(flowCondition({ mode: 'pick', record: 'evidence', atLeast: 3 }, campaign), false)
  assert.equal(flowCondition({ all: [{ mode: 'pick' }, { completed: 'a1' }] }, campaign), true)
  assert.equal(flowCondition({ not: { part: 'B' } }, campaign), true)
})

test('流程与 parts 状态可存档往返：中途 JSON 恢复后继续得到同一结局', () => {
  const flow = dualPartFlow(PARTS)
  const manifest = manifestFor(flow)
  const campaign = Object.assign({ records: {}, investigators: {}, scenarioResults: [] }, createPartsState({
    mode: 'pick', seatParts: ['A', 'B', 'A'], currentPart: 'A',
  }))
  const preferences = ['B', 'A', 'B', 'A']
  const graph = validateCampaignGraph(manifest)
  const run = (state, until) => {
    const visited = []
    while (visited.length < until) {
      const node = walkCampaign(state, manifest, (id, gate, options) => {
        const wanted = preferences[gate.pair - 1]
        return (chapterOf(options, wanted) || options[0]).id
      })
      if (node.type === 'interlude') { enterCampaignNode(state, manifest, graph.nodes[node.id].next); continue }
      assert.equal(node.type, 'scenario')
      visited.push(node.scenarioId)
      state.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
      enterCampaignNode(state, manifest, graph.nodes[node.id].next)
    }
    return visited
  }
  const firstHalf = run(campaign, 3)
  // 牌组/记录这类逐线数据随 parts 快照往返。
  campaign.records.evidence = 3
  campaign.investigators[0] = { id: 'inv-0', seat: 0, code: '06001', name: '托米', status: 'active', deck: ['01001', '01002'] }
  const restored = JSON.parse(JSON.stringify(campaign))
  const secondHalf = run(restored, 8 - 3)
  const direct = run(JSON.parse(JSON.stringify(campaign)), 5)
  assert.deepEqual([...firstHalf, ...secondHalf], [...firstHalf, ...direct])
  assert.equal(restored.records.evidence, 3)
  assert.deepEqual(restored.seatParts, ['A', 'B', 'A'])
  assert.deepEqual(restored.parts, {})
})

test('观察投影：非活动线快照只给公开摘要，牌组/购入/故事正文不外泄', () => {
  const campaign = Object.assign({
    id: 'dualTest', records: { evidence: 2 }, scenarioResults: [],
  }, createPartsState({ mode: 'pick', seatParts: ['A', 'B'], currentPart: 'A' }))
  campaign.investigators = {
    0: { id: 'inv-0', seat: 0, code: '06001', name: '托米', status: 'active', deck: ['01001'], xp: 4, purchases: [{ code: '01002' }] },
  }
  campaign.parts = {
    B: {
      records: { stepsOfTheBridge: 3 },
      investigators: { 1: { id: 'inv-1', seat: 1, code: '06005', name: '派翠丝', status: 'active', deck: ['01010', '01011'], xp: 2, purchases: [{ code: '01012' }] } },
      retired: [],
      trauma: { 1: { physical: 1, mental: 0 } },
      xp: 2,
      victory: 3,
      chaosBag: ['+1', '0', 'skull'],
      storySections: { interlude2: { title: '未到达', paragraphs: ['不应泄露'] } },
    },
  }
  const view = partScopedView(structuredClone(campaign))
  assert.equal(view.partsRedacted, true)
  const b = view.parts.B
  assert.deepEqual(b.records, { stepsOfTheBridge: 3 })
  assert.equal(b.xp, 2)
  assert.equal(b.victory, 3)
  assert.deepEqual(b.chaosBag, ['+1', '0', 'skull'])
  assert.equal(b.storySectionCount, 1)
  assert.equal('storySections' in b, false, '故事正文不能投影')
  assert.equal(b.investigators[0].deckSize, 2)
  assert.equal('deck' in b.investigators[0], false, '牌组不能投影')
  assert.equal('purchases' in b.investigators[0], false)
  // campaignView 是真实读点：同一份战役经投影后仍脱敏。
  const viaCampaign = campaignView(structuredClone(campaign), 0)
  assert.equal(viaCampaign.partsRedacted, true)
  assert.equal('storySections' in viaCampaign.parts.B, false)
  assert.deepEqual(viaCampaign.investigators[0].deck, ['01001'], '自己的牌组保留')
  // 未声明 parts 的战役投影逐字节不变（不写 partsRedacted）。
  const plain = campaignView({ records: {}, investigators: {}, scenarioResults: [] }, 0)
  assert.equal('partsRedacted' in plain, false)
  assert.equal('parts' in plain, false)
})

test('并行准备：观察者只看得到自己那条线快照里的牌组', () => {
  const campaign = Object.assign({
    id: 'dualTest', records: {}, scenarioResults: [], investigators: {},
  }, createPartsState({ mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'], currentPart: null }))
  campaign.parts = {
    A: {
      records: {},
      investigators: {
        0: { id: 'inv-0', seat: 0, code: '06001', name: '托米', status: 'active', deck: ['01001'], xp: 0, purchases: [{ code: '01002' }], startingDeckReady: true },
        2: { id: 'inv-2', seat: 2, code: '06002', name: '曼迪', status: 'active', deck: ['01020'], xp: 0 },
      },
      storySections: { hidden: { title: '未到达', paragraphs: ['不应泄露'] } },
    },
    B: {
      records: {},
      investigators: {
        1: { id: 'inv-1', seat: 1, code: '06005', name: '派翠丝', status: 'active', deck: ['01010', '01011'], xp: 1, purchases: [{ code: '01012' }] },
      },
      storySections: { other: { paragraphs: ['不应泄露'] } },
    },
  }
  const own = campaignView(structuredClone(campaign), 0)
  const mine = own.parts.A.investigators.find(record => record.seat === 0)
  const teammate = own.parts.A.investigators.find(record => record.seat === 2)
  const other = own.parts.B.investigators.find(record => record.seat === 1)
  assert.deepEqual(mine.deck, ['01001'])
  assert.deepEqual(mine.purchases, [{ code: '01002' }])
  assert.equal('deck' in teammate, false, '同线队友的牌组不能投影')
  assert.equal(teammate.deckSize, 1)
  assert.equal('deck' in other, false, '另一条线的牌组不能投影')
  assert.equal('purchases' in other, false)
  assert.equal('storySections' in own.parts.A, false)
  assert.equal(own.parts.A.storySectionCount, 1)
  const guest = campaignView(structuredClone(campaign), 1)
  assert.deepEqual(guest.parts.B.investigators.find(record => record.seat === 1).deck, ['01010', '01011'])
  assert.equal('deck' in guest.parts.A.investigators.find(record => record.seat === 0), false)
})

test('交互清单定稿：10 条覆盖 P2 的两条 interaction 机制，状态全部 pending', () => {
  assert.equal(TDE_INTERACTIONS.length, 10)
  assert.equal(new Set(TDE_INTERACTION_IDS).size, 10)
  assert.deepEqual([...TDE_INTERACTION_IDS], [
    'campaignOption', 'laneSelection', 'swarmPanel', 'infestationBag', 'alarmLevel',
    'hiddenHand', 'veiledFlip', 'markerProgress', 'verticalStack', 'dreamGateEpilogue',
  ])
  const validation = validateInteractionInventory()
  assert.equal(validation.ok, true, validation.problems.join(' | '))
  for (const entry of TDE_INTERACTIONS) {
    assert.equal(entry.status, 'pending', 'P5 批次 1 不宣称交互已验收')
    assert.ok(entry.blockers.length > 0, `${entry.id} 必须写清未完成原因`)
  }
  assert.equal(tdeInteraction('campaignOption').hook, 'hub')
  assert.equal(tdeInteraction('swarmPanel').mechanismIds[0], 'swarming')
  assert.equal(tdeInteraction('dreamGateEpilogue').mechanismIds.includes('epilogueMatrix'), true)
  assert.deepEqual(tdeInteractionsForScenario('wakingNightmare').map(entry => entry.id), ['infestationBag'])
  assert.deepEqual(tdeInteractionsForScenario('weaverOfTheCosmos').map(entry => entry.id), ['verticalStack', 'dreamGateEpilogue'])
  // 清单只登记机制 id，不重复实现；未知 id 返回 null。
  assert.equal(tdeInteraction('nope'), null)
})
