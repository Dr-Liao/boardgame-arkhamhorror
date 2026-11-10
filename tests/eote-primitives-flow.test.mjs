// EotE P2-C：《地球边缘》战役流程原语（campaign.flows / campaign.epilogue / scenario.mirageVersions）的 Node 验收。
//
// 口径：
//   · `campaign.flows`：先证明**现有节点语义足够**——用真实 `walkCampaign` 驱动一张 EotE 形状的
//     合成流程图（序幕 → 检查点 I/II → 幕间 I/II/III + 可选致命幻景 → 检查点 III → 尾声），
//     检查点/幕间的分支用相邻 partGate（条件路由）表达，幻景回场用 branch + completed 条件表达；
//     再验证新增的注册期失败关闭（节点形状/条件语法/效果形状/recordSchema）。
//   · `campaign.epilogue`：记录驱动的尾声分支表（伙伴配对/研究/封印），多条可同时命中。
//   · `scenario.mirageVersions`：致命幻景 I–III 版本簿记 + 版本作用域场景局部快照。
// 全部使用轻量纯对象，不依赖八章内容与卡号。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BRANCH_NODE_TYPES, STRUCTURAL_NODE_TYPES, completedCampaignSteps, enterCampaignNode,
  validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import {
  flattenEpilogueBranches, isEpilogueBranches, isEpilogueMatrix, normalizeEpilogueBranches,
  resolveEpilogueBranches,
} from '../src/campaign/epilogue-matrix.js'
import {
  MIRAGE_VERSIONS, mirageState, mirageTotalVisits, mirageVersion, mirageVisitCount, nextMirageVersion,
  noteMirageVisit, restoreMirageVersion, saveMirageVersion, validateEoteMirage,
} from '../src/campaign/campaign-parts.js'

// ---------------------------------------------------------------------------
// 一、campaign.flows：EotE 流程形状（现有节点语义 + 注册期校验）
// ---------------------------------------------------------------------------

const SCENARIO_IDS = Object.freeze([
  'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
])
// 主线八章里致命幻景是**可选**支线：正常路径只打 7 场主线关卡。
const MAINLINE_SCENARIO_IDS = Object.freeze(SCENARIO_IDS.filter(scenarioId => scenarioId !== 'fatalMirage'))

/** EotE 形状的合成流程：节点类型与参考战役 EdgeOfTheEarth.hs#nextStep 的顺序一一对应。 */
function eoteManifest() {
  return {
    id: 'syntheticEdgeOfTheEarth',
    name: '地球边缘（合成夹具）',
    scenarioIds: [...SCENARIO_IDS],
    recordSchema: {
      dyerBelieved: 'boolean',
      missingPartnerCount: 'number',
      eliminatedPartnerCount: 'number',
      miasmaResearchLevel: 'number',
    },
    flow: {
      start: 'prologue',
      nodes: {
        prologue: {
          type: 'choice',
          prompt: '序幕：你相信戴尔的报告吗？',
          options: [
            { id: 'believedDyer', label: '相信戴尔', effects: [{ type: 'record', key: 'dyerBelieved', value: true }], next: 'iceAndDeathPart1' },
            { id: 'doubtedDyer', label: '不相信戴尔', effects: [{ type: 'record', key: 'dyerBelieved', value: false }], next: 'iceAndDeathPart1' },
          ],
        },
        iceAndDeathPart1: { type: 'scenario', scenarioId: 'iceAndDeathPart1', next: 'checkpoint1' },
        // 检查点 I：《失踪》。有失踪伙伴 → 搜救进第 II 部分；没有 → 只能放弃并跳到检查点 II。
        checkpoint1: { type: 'checkpoint', title: '检查点 I：失踪', next: 'checkpoint1Choice' },
        checkpoint1Choice: {
          type: 'partGate',
          prompt: '要回去找失踪的队员吗？',
          options: [
            { id: 'rescue', label: '去救他们', when: { compare: { left: 'missingPartnerCount', right: 0, op: '>' } }, next: 'iceAndDeathPart2' },
            { id: 'abandon', label: '他们只能靠自己了', effects: [{ type: 'increment', key: 'eliminatedPartnerCount', amount: 1 }], next: 'checkpoint2' },
          ],
          next: 'checkpoint2',
        },
        iceAndDeathPart2: { type: 'scenario', scenarioId: 'iceAndDeathPart2', next: 'checkpoint2' },
        // 检查点 II：《袭击》。逃入山脉跳过第 III 部分，坚守则进第 III 部分。
        checkpoint2: { type: 'checkpoint', title: '检查点 II：袭击', next: 'checkpoint2Choice' },
        checkpoint2Choice: {
          type: 'partGate',
          prompt: '撤离还是坚守？',
          options: [
            { id: 'flee', label: '逃入山脉', next: 'interlude1' },
            { id: 'stand', label: '坚守到底', next: 'iceAndDeathPart3' },
          ],
          next: 'interlude1',
        },
        iceAndDeathPart3: { type: 'scenario', scenarioId: 'iceAndDeathPart3', next: 'interlude1' },
        // 幕间 I：《宁静之夜》。只有至少 3 名伙伴被划掉时才出现「开门」选项。
        interlude1: { type: 'interlude', title: '幕间 I：宁静之夜', next: 'mirageChoice1' },
        mirageChoice1: {
          type: 'partGate',
          prompt: '门后传来低语……',
          options: [
            { id: 'enterMirage', label: '开门进入幻景', when: { compare: { left: 'eliminatedPartnerCount', right: 3, op: '>=' } }, next: 'fatalMirage' },
            { id: 'ignoreDoor', label: '忽略那扇门', next: 'toTheForbiddenPeaks' },
          ],
          next: 'toTheForbiddenPeaks',
        },
        // 致命幻景：结束后按「已完成的主线关卡」回到下一章（参考 campaignCompletedSteps 语义）。
        // 参考实现 nextStep 是**有序** if/else 链，用 stepReturn 的「第一条命中」表达；
        // 若用 branch（要求恰好一条命中）则必须给后两条规则手写否定，容易漏。
        fatalMirage: { type: 'scenario', scenarioId: 'fatalMirage', next: 'mirageReturn' },
        mirageReturn: {
          type: 'stepReturn',
          rules: [
            { id: 'afterCity', when: { completed: 'cityOfTheElderThings' }, next: 'theHeartOfMadnessPart1' },
            { id: 'afterPeaks', when: { completed: 'toTheForbiddenPeaks' }, next: 'cityOfTheElderThings' },
          ],
          next: 'toTheForbiddenPeaks',
        },
        toTheForbiddenPeaks: { type: 'scenario', scenarioId: 'toTheForbiddenPeaks', next: 'interlude2' },
        // 幕间 II：《无尽之夜》。进过幻景 → 可再次开门；没进过但划掉 ≥3 → 首次开门；否则直接进古城。
        interlude2: { type: 'interlude', title: '幕间 II：无尽之夜', next: 'mirageChoice2' },
        mirageChoice2: {
          type: 'partGate',
          prompt: '那扇门又出现了……',
          options: [
            { id: 'enterMirageAgain', label: '再次开门', when: { completed: 'fatalMirage' }, next: 'fatalMirage' },
            {
              id: 'enterMirageFirst',
              when: {
                all: [
                  { not: { completed: 'fatalMirage' } },
                  { compare: { left: 'eliminatedPartnerCount', right: 3, op: '>=' } },
                ],
              },
              next: 'fatalMirage',
            },
            { id: 'ignoreDoor', label: '忽略那扇门', next: 'cityOfTheElderThings' },
          ],
          next: 'cityOfTheElderThings',
        },
        cityOfTheElderThings: { type: 'scenario', scenarioId: 'cityOfTheElderThings', next: 'interlude3' },
        // 幕间 III：《最后一夜》。无论是否进过幻景，都会给出「开门/忽略」。
        interlude3: { type: 'interlude', title: '幕间 III：最后一夜', next: 'mirageChoice3' },
        mirageChoice3: {
          type: 'partGate',
          prompt: '最后一次机会……',
          options: [
            { id: 'enterMirageAgain', label: '再次开门', when: { completed: 'fatalMirage' }, next: 'fatalMirage' },
            { id: 'enterMirageFirst', label: '开门', when: { not: { completed: 'fatalMirage' } }, next: 'fatalMirage' },
            { id: 'ignoreDoor', label: '忽略那扇门', next: 'theHeartOfMadnessPart1' },
          ],
          next: 'theHeartOfMadnessPart1',
        },
        theHeartOfMadnessPart1: { type: 'scenario', scenarioId: 'theHeartOfMadnessPart1', next: 'checkpoint3' },
        checkpoint3: { type: 'checkpoint', title: '检查点 III：彼端', next: 'theHeartOfMadnessPart2' },
        theHeartOfMadnessPart2: { type: 'scenario', scenarioId: 'theHeartOfMadnessPart2', next: 'epilogue' },
        epilogue: { type: 'story', title: '尾声', text: '探险队的故事到此为止。', next: 'end' },
        end: { type: 'end' },
      },
    },
  }
}

/** 记录节点类型列表可被内容注册表/文档引用（P2 catalog 的 readPoint）。 */
test('flows：节点类型清单导出且冻结，EotE 流程图注册通过', () => {
  assert.ok(Object.isFrozen(STRUCTURAL_NODE_TYPES) && Object.isFrozen(BRANCH_NODE_TYPES))
  // 八循环 TSK P2 扩展：新增 `map` 节点（世界地图启程段，由战役行为接管）；EotE 图形状不变。
  assert.deepEqual([...STRUCTURAL_NODE_TYPES], ['scenario', 'story', 'choice', 'branch', 'partGate', 'stepReturn', 'interlude', 'checkpoint', 'map', 'end'])
  assert.deepEqual([...BRANCH_NODE_TYPES], ['choice', 'branch', 'partGate'])
  const graph = validateCampaignGraph(eoteManifest())
  assert.equal(graph.start, 'prologue')
  assert.equal(graph.nodes.fatalMirage.next, 'mirageReturn')
  assert.equal(graph.nodes.mirageReturn.type, 'stepReturn')
  assert.deepEqual(graph.nodes.mirageReturn.rules.map(rule => rule.id), ['afterCity', 'afterPeaks'])
  assert.equal(Object.values(graph.nodes).filter(node => node.type === 'checkpoint').length, 3)
  assert.equal(Object.values(graph.nodes).filter(node => node.type === 'scenario').length, SCENARIO_IDS.length)
})

/**
 * 按引擎的两步推进方式驱动流程（与 src/engine/campaign-flow.js#progressCampaign 等价）：
 *   · scenario 节点：结算后把 pendingNode 指向 node.next（测试里直接进入）；
 *   · interlude / checkpoint 节点：关间准备结束后进入 node.next；
 *   · 其它交互节点由 answers 表回答（未预期的询问直接失败）。
 */
function runFlow(campaign, manifest, { answers = {}, onEnterScenario } = {}) {
  const graph = validateCampaignGraph(manifest)
  const scenarios = []
  const asks = []
  for (let step = 0; step < 64; step += 1) {
    const node = walkCampaign(campaign, manifest, (id, gate, options) => {
      asks.push({ id, options: options.map(option => option.id) })
      const wanted = answers[id]
      if (!wanted) throw new Error(`流程询问了未预期的选择：${id}（${options.map(option => option.id).join('/')}）`)
      if (!options.some(option => option.id === wanted)) throw new Error(`选项不可用：${id}/${wanted}`)
      return wanted
    })
    if (node.type === 'end') return { scenarios, asks, end: node.id }
    if (node.type === 'scenario') {
      onEnterScenario?.(node, campaign)
      scenarios.push(node.scenarioId)
      campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: 'R1' })
      enterCampaignNode(campaign, manifest, graph.nodes[node.id].next)
      continue
    }
    enterCampaignNode(campaign, manifest, graph.nodes[node.id].next)
  }
  throw new Error('流程没有在 64 步内结束')
}

const casualAnswers = Object.freeze({
  prologue: 'believedDyer',
  checkpoint1Choice: 'rescue',
  checkpoint2Choice: 'stand',
  mirageChoice1: 'ignoreDoor',
  mirageChoice2: 'ignoreDoor',
  mirageChoice3: 'ignoreDoor',
})

test('flows：正常主线（搜救 + 坚守 + 忽略三扇门）一次走完七场主线关卡', () => {
  const manifest = eoteManifest()
  const campaign = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 1 }, scenarioResults: [] }
  const result = runFlow(campaign, manifest, { answers: casualAnswers })
  assert.deepEqual(result.scenarios, [...MAINLINE_SCENARIO_IDS])
  assert.equal(result.end, 'end')
  // 序幕记录、检查点记录都由节点效果真实结算。
  assert.equal(campaign.records.dyerBelieved, true)
  // 幕间 I 只有 1 名伙伴被划掉 → 门不出现（partGate 单出口自动跳过，不询问玩家）。
  assert.deepEqual(result.asks.filter(ask => ask.id.startsWith('mirageChoice')).map(ask => ask.id), ['mirageChoice3'],
    '幕间 I/II 条件不满足时不该询问；幕间 III 无条件给出开门/忽略')
  assert.equal(campaign.flow.visits.fatalMirage, undefined)
})

test('flows：检查点 I 无失踪伙伴时自动跳过第 II 部分（不询问、记录划掉）', () => {
  const manifest = eoteManifest()
  const campaign = { records: { missingPartnerCount: 0, eliminatedPartnerCount: 0 }, scenarioResults: [] }
  const result = runFlow(campaign, manifest, {
    answers: { prologue: 'believedDyer', checkpoint2Choice: 'stand', mirageChoice3: 'ignoreDoor' },
  })
  assert.deepEqual(result.scenarios, [
    'iceAndDeathPart1', 'iceAndDeathPart3', 'toTheForbiddenPeaks',
    'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
  ], '跳过第 II 部分时不应出现 iceAndDeathPart2')
  assert.ok(!result.asks.some(ask => ask.id === 'checkpoint1Choice'), '没有失踪伙伴时检查点 I 不应询问玩家')
  assert.equal(campaign.records.eliminatedPartnerCount, 1, '自动选择的 abandon 选项效果照常结算')
})

test('flows：检查点 II 逃入山脉跳过第 III 部分；坚守才进第 III 部分', () => {
  const manifest = eoteManifest()
  const fleeCampaign = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 1 }, scenarioResults: [] }
  const flee = runFlow(fleeCampaign, manifest, {
    answers: { ...casualAnswers, checkpoint2Choice: 'flee', mirageChoice3: 'ignoreDoor' },
  })
  assert.ok(!flee.scenarios.includes('iceAndDeathPart3'), '撤离路线不应出现第 III 部分')
  assert.equal(flee.scenarios[0], 'iceAndDeathPart1')

  const standCampaign = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 1 }, scenarioResults: [] }
  const stand = runFlow(standCampaign, manifest, { answers: casualAnswers })
  assert.ok(stand.scenarios.includes('iceAndDeathPart3'), '坚守路线必须进第 III 部分')
})

test('flows：从幕间 I 切入致命幻景后回到「当前主线下一章」（toTheForbiddenPeaks）', () => {
  const manifest = eoteManifest()
  const campaign = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 3 }, scenarioResults: [] }
  const result = runFlow(campaign, manifest, {
    answers: { ...casualAnswers, mirageChoice1: 'enterMirage', mirageChoice2: 'ignoreDoor', mirageChoice3: 'ignoreDoor' },
  })
  const mirageAt = result.scenarios.indexOf('fatalMirage')
  assert.ok(mirageAt >= 0, '应真的进入致命幻景')
  assert.equal(result.scenarios[mirageAt + 1], 'toTheForbiddenPeaks')
  assert.equal(campaign.flow.visits.fatalMirage, 1)
  // 幻景结束当时的状态（只有前三章 + 幻景已完成）下回场求值稳定：JSON 副本重复进入同一节点结果一致。
  const midCampaign = {
    records: { missingPartnerCount: 2, eliminatedPartnerCount: 3 },
    scenarioResults: ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage'].map(scenarioId => ({ scenarioId, resolution: 'R1' })),
  }
  const first = structuredClone(midCampaign)
  const second = structuredClone(midCampaign)
  enterCampaignNode(first, manifest, 'mirageReturn')
  enterCampaignNode(second, manifest, 'mirageReturn')
  assert.equal(walkCampaign(first, manifest).scenarioId, 'toTheForbiddenPeaks')
  assert.equal(walkCampaign(second, manifest).scenarioId, 'toTheForbiddenPeaks')
  assert.deepEqual(first.flow, second.flow, '同一状态重复回场结果一致（幂等）')
})

test('flows：幻景回场按已完成关卡有序链——未到峰顶 / 峰顶后 / 古城后（priority）', () => {
  const manifest = eoteManifest()
  const cases = [
    { completed: [], expected: 'toTheForbiddenPeaks' },
    { completed: ['toTheForbiddenPeaks'], expected: 'cityOfTheElderThings' },
    { completed: ['toTheForbiddenPeaks', 'cityOfTheElderThings'], expected: 'theHeartOfMadnessPart1' },
  ]
  for (const { completed, expected } of cases) {
    const campaign = {
      records: { missingPartnerCount: 2, eliminatedPartnerCount: 3 },
      scenarioResults: completed.map(scenarioId => ({ scenarioId, resolution: 'R1' })),
    }
    enterCampaignNode(campaign, manifest, 'mirageReturn')
    const node = walkCampaign(campaign, manifest, () => { throw new Error('回场规则链不应询问玩家') })
    assert.equal(node.type, 'scenario')
    assert.equal(node.scenarioId, expected, `已完成 [${completed.join(',')}] 时应回到 ${expected}`)
    // 有序链记录命中的规则 id（最后一条 = 该次回场的规则）。
    assert.equal(campaign.flow.history.at(-2).choice, expected === 'toTheForbiddenPeaks' ? null : expected === 'cityOfTheElderThings' ? 'afterPeaks' : 'afterCity')
  }
})

test('flows：completedCampaignSteps 投影合并 scenarioResults 与完成步骤记录（只读）', () => {
  const campaign = {
    records: { completedSteps: ['interlude1', 'fatalMirage'], campaignCompletedSteps: ['epilogue'] },
    scenarioResults: [{ scenarioId: 'toTheForbiddenPeaks', resolution: 'R1' }],
  }
  const before = JSON.stringify(campaign)
  assert.deepEqual([...completedCampaignSteps(campaign)].sort(),
    ['epilogue', 'fatalMirage', 'interlude1', 'toTheForbiddenPeaks'])
  assert.equal(JSON.stringify(campaign), before, '投影不得写入状态')
  assert.equal(completedCampaignSteps({}).size, 0)
  assert.equal(completedCampaignSteps(null).size, 0)
})

test('flows：completedSteps 记录驱动回场（campaignCompletedSteps 语义，不只靠 scenarioResults）', () => {
  const manifest = eoteManifest()
  const ruleManifest = structuredClone(manifest)
  // 内容层把非关卡步骤也写进 completedSteps 记录时，stepReturn 同样读取（与参考 campaignCompletedSteps 对齐）。
  ruleManifest.flow.nodes.mirageReturn.rules = [
    { id: 'afterCity', when: { completedStep: 'cityOfTheElderThings' }, next: 'theHeartOfMadnessPart1' },
    { id: 'afterPeaks', when: { completedStep: ['toTheForbiddenPeaks', 'theForbiddenPeaksScouted'] }, next: 'cityOfTheElderThings' },
  ]
  const campaign = {
    records: { missingPartnerCount: 2, eliminatedPartnerCount: 3, completedSteps: ['iceAndDeathPart1', 'theForbiddenPeaksScouted'] },
    scenarioResults: [],
  }
  // 只完成「侦察」不算峰顶完成 → 兜底回峰顶。
  enterCampaignNode(campaign, ruleManifest, 'mirageReturn')
  assert.equal(walkCampaign(campaign, ruleManifest).scenarioId, 'toTheForbiddenPeaks')
  // 把峰顶写进完成步骤（含额外步骤）→ 回古城。
  const afterPeaks = { records: { ...campaign.records, completedSteps: ['toTheForbiddenPeaks', 'theForbiddenPeaksScouted'] }, scenarioResults: [] }
  enterCampaignNode(afterPeaks, ruleManifest, 'mirageReturn')
  assert.equal(walkCampaign(afterPeaks, ruleManifest).scenarioId, 'cityOfTheElderThings')
  // 场景结局自动并入完成步骤集合（无需内容重复抄写）。
  const byResult = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 3 }, scenarioResults: [{ scenarioId: 'cityOfTheElderThings', resolution: 'R1' }] }
  enterCampaignNode(byResult, ruleManifest, 'mirageReturn')
  assert.equal(walkCampaign(byResult, ruleManifest).scenarioId, 'theHeartOfMadnessPart1')
})

test('flows：致命幻景可在三段幕间重复切入三次，回场点逐次正确且 visit 计数递增', () => {
  const manifest = eoteManifest()
  const campaign = { records: { missingPartnerCount: 0, eliminatedPartnerCount: 3 }, scenarioResults: [] }
  const state = { campaign }
  const result = runFlow(campaign, manifest, {
    answers: {
      prologue: 'believedDyer',
      checkpoint2Choice: 'flee',
      mirageChoice1: 'enterMirage',
      mirageChoice2: 'enterMirageAgain',
      mirageChoice3: 'enterMirageAgain',
    },
    onEnterScenario: node => {
      if (node.scenarioId !== 'fatalMirage') return
      const version = nextMirageVersion(state)
      noteMirageVisit(state, version)
      saveMirageVersion(state, version, { enteredAt: version })
      assert.equal(mirageVersion(state), version)
    },
  })
  assert.deepEqual(result.scenarios, [
    'iceAndDeathPart1',
    'fatalMirage', 'toTheForbiddenPeaks',
    'fatalMirage', 'cityOfTheElderThings',
    'fatalMirage', 'theHeartOfMadnessPart1',
    'theHeartOfMadnessPart2',
  ])
  assert.equal(campaign.flow.visits.fatalMirage, 3)
  assert.equal(mirageTotalVisits(state), 3)
  assert.deepEqual(MIRAGE_VERSIONS.map(version => mirageVisitCount(state, version)), [1, 1, 1])
  assert.equal(nextMirageVersion(state), null, '三次用尽后不再有下一版本')
  assert.deepEqual([...Array(3)].map((_, index) => mirageState(state).snapshots[String(index + 1)]),
    [{ enteredAt: 1 }, { enteredAt: 2 }, { enteredAt: 3 }])
})

test('flows：JSON 往返后流程图仍可校验并继续推进（structuredClone）', () => {
  const manifest = eoteManifest()
  const restoredManifest = structuredClone(manifest)
  assert.deepEqual(validateCampaignGraph(restoredManifest), validateCampaignGraph(manifest))
  const campaign = { records: { missingPartnerCount: 2, eliminatedPartnerCount: 1 }, scenarioResults: [] }
  const first = walkCampaign(campaign, manifest, () => 'believedDyer')
  assert.equal(first.scenarioId, 'iceAndDeathPart1')
  campaign.scenarioResults.push({ scenarioId: 'iceAndDeathPart1', resolution: 'R1' })
  enterCampaignNode(campaign, manifest, 'checkpoint1')
  const copy = structuredClone(campaign)
  // 引擎两步推进：离开检查点 → 在条件路由上选「搜救」→ 第 II 部分；两份状态回答一致则逐字段一致。
  enterCampaignNode(copy, restoredManifest, 'checkpoint1Choice')
  enterCampaignNode(campaign, manifest, 'checkpoint1Choice')
  const chooseRescue = () => 'rescue'
  assert.equal(walkCampaign(copy, restoredManifest, chooseRescue).scenarioId, 'iceAndDeathPart2')
  assert.equal(walkCampaign(campaign, manifest, chooseRescue).scenarioId, 'iceAndDeathPart2')
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(campaign)))
})

// --- 注册期失败关闭 ---------------------------------------------------------

function brokenManifest(mutate) {
  const manifest = eoteManifest()
  mutate(manifest.flow.nodes, manifest)
  return () => validateCampaignGraph(manifest)
}

test('flows：注册期拒绝未知节点类型/未知出口/重复选项/缺选项/缺出口', () => {
  assert.throws(brokenManifest(nodes => { nodes.checkpoint3.type = 'cutscene' }), /未知战役节点/)
  assert.throws(brokenManifest(nodes => { nodes.checkpoint1.next = 'missingNode' }), /战役出口不存在：checkpoint1\/missingNode/)
  assert.throws(brokenManifest(nodes => { nodes.prologue.options[1].id = 'believedDyer' }), /重复战役选项/)
  assert.throws(brokenManifest(nodes => { nodes.prologue.options = [] }), /战役选择没有选项/)
  assert.throws(brokenManifest(nodes => { delete nodes.prologue.options[0].next }), /战役选项缺少出口/)
  assert.throws(brokenManifest(nodes => { nodes.checkpoint1.next = { to: 'checkpoint2' } }), /战役出口必须是节点 id/)
  assert.throws(brokenManifest(nodes => { nodes.end.next = 'checkpoint1' }), /结局节点不能有出口/)
  assert.throws(brokenManifest(nodes => { nodes.end.next = 'checkpoint1'; nodes.end.type = 'end' }), /结局节点不能有出口/)
})

test('flows：检查点/幕间写 options 会被引擎忽略，注册期直接拒绝（失败关闭）', () => {
  // src/engine/campaign-flow.js#progressCampaign 在 leaveRest 时只进 node.next；
  // 这两类节点上的 options 永远不会被读取，静默忽略比报错更危险。
  assert.throws(brokenManifest(nodes => {
    nodes.checkpoint1.options = [{ id: 'branch', next: 'checkpoint2' }]
  }), /非分支节点不能声明选项/)
  assert.throws(brokenManifest(nodes => {
    nodes.interlude1.options = [{ id: 'mirage', next: 'fatalMirage' }]
  }), /非分支节点不能声明选项/)
})

test('flows：注册期校验条件语法（未知字段/记录类型操作符/比较操作数/挂起效果/步骤）', () => {
  assert.throws(brokenManifest(nodes => {
    nodes.mirageChoice1.options[0].when = { record: 'eliminatedPartnerCount', atleast: 3 }
  }), /未知条件字段 atleast/)
  // 声明了 recordSchema 后按记录类型校验操作符：布尔记录只能 equals。
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { record: 'dyerBelieved', atLeast: 1 }
  }), /布尔记录 dyerBelieved 只支持 equals/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { record: 'dyerBelieved', equals: 'yes' }
  }), /equals 必须是布尔值/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { record: 'notDeclaredRecord', equals: true }
  }), /未声明的记录/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { record: 'dyerBelieved', equals: true, includes: 'x' }
  }), /只能声明 equals\/atLeast\/includes 之一/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { compare: { left: 'dyerBelieved', right: {}, op: '>' } }
  }), /未知战役比较操作数/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { compare: { left: 'dyerBelieved', right: 0, op: '!=' } }
  }), /未知比较运算符/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].when = { completedStep: [] }
  }), /completedStep 必须是非空步骤 id/)
  assert.throws(brokenManifest(nodes => {
    nodes.interlude1.pendingEffects = [{ op: 'inventedInterludeOp' }]
  }), /未知挂起效果/)
  assert.throws(brokenManifest(nodes => {
    nodes.interlude1.greens = [{ when: { record: 'dyerBelieved', equals: true }, effects: [{ type: 'record' }] }]
  }), /record 效果缺少 key/)
})

test('flows：stepReturn 注册期校验（规则形状/顺序 id/兜底出口/未知出口）', () => {
  assert.throws(brokenManifest(nodes => { nodes.mirageReturn.rules = [] }), /缺少 rules/)
  assert.throws(brokenManifest(nodes => { delete nodes.mirageReturn.next }), /缺少兜底出口/)
  assert.throws(brokenManifest(nodes => { nodes.mirageReturn.rules[1].next = 'absentNode' }), /战役出口不存在：mirageReturn\/absentNode/)
  assert.throws(brokenManifest(nodes => { nodes.mirageReturn.rules[1].id = 'afterCity' }), /规则 id 重复/)
  assert.throws(brokenManifest(nodes => { nodes.mirageReturn.rules[0].whenCondition = { completed: 'x' } }), /含未知字段/)
  assert.throws(brokenManifest(nodes => { delete nodes.mirageReturn.rules[0].when }), /缺少 when/)
})

test('flows：注册期校验效果形状与 recordSchema 类型（record / increment）', () => {
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].effects = [{ type: 'record', key: 'dyerBelieved' }]
  }), /record 效果缺少 value/)
  assert.throws(brokenManifest(nodes => {
    nodes.prologue.options[0].effects = [{ type: 'record', key: 'dyerBelieved', value: 'yes' }]
  }), /战役记录 dyerBelieved 类型应为 boolean/)
  assert.throws(brokenManifest(nodes => {
    nodes.checkpoint1Choice.options[1].effects = [{ type: 'increment', key: 'dyerBelieved', amount: 1 }]
  }), /战役记录 dyerBelieved 不是数值/)
  assert.throws(brokenManifest(nodes => {
    nodes.checkpoint1Choice.options[1].effects = [{ type: 'increment', key: 'eliminatedPartnerCount', amount: 'one' }]
  }), /增量必须是有限数值/)
  assert.throws(brokenManifest(nodes => {
    nodes.checkpoint1.effects = 'not-an-array'
  }), /效果必须是数组/)
})

// ---------------------------------------------------------------------------
// 二、campaign.epilogue：记录驱动的尾声分支表（EotE 伙伴配对/研究/封印）
// ---------------------------------------------------------------------------

const EOTE_RECORDS = Object.freeze({
  ellsworthAlive: 'boolean', claypoolAlive: 'boolean',
  kenslerAlive: 'boolean', sinhaAlive: 'boolean',
  dyerAlive: 'boolean', danforthAlive: 'boolean',
  takadaAlive: 'boolean', cookieAlive: 'boolean',
  eliyahAlive: 'boolean',
  kenslerUnderstandsMiasma: 'boolean', danforthConfrontedDemons: 'boolean', sealUsedImproperly: 'boolean',
  survivingPartners: 'number', recoveredSeals: 'string[]',
})

const PAIR_IDS = Object.freeze(['ellsworthAndClaypool', 'kenslerAndSinha', 'dyerAndDanforth', 'takadaAndCookie'])

/** EotE 尾声分支表：伙伴配对 4 段 + 埃利亚沙单独 1 段 + 研究/丹佛斯/封印/总计。 */
function eoteEpilogueTable() {
  return {
    records: { ...EOTE_RECORDS },
    rows: [
      { id: 'ellsworthAndClaypool', when: { all: [{ record: 'ellsworthAlive', equals: true }, { record: 'claypoolAlive', equals: true }] }, title: '埃尔斯沃斯与克莱普尔', textKey: 'eote.epilogue.ellsworthAndClaypool', section: 'partners' },
      { id: 'kenslerAndSinha', when: { all: [{ record: 'kenslerAlive', equals: true }, { record: 'sinhaAlive', equals: true }] }, title: '肯斯勒与辛哈', textKey: 'eote.epilogue.kenslerAndSinha', section: 'partners' },
      { id: 'dyerAndDanforth', when: { all: [{ record: 'dyerAlive', equals: true }, { record: 'danforthAlive', equals: true }] }, title: '戴尔与丹佛斯', textKey: 'eote.epilogue.dyerAndDanforth', section: 'partners' },
      { id: 'takadaAndCookie', when: { all: [{ record: 'takadaAlive', equals: true }, { record: 'cookieAlive', equals: true }] }, title: '高田与曲奇', textKey: 'eote.epilogue.takadaAndCookie', section: 'partners' },
      {
        id: 'eliyahAlone',
        when: {
          all: [
            { record: 'eliyahAlive', equals: true },
            {
              not: {
                any: [
                  { record: 'ellsworthAlive', equals: true }, { record: 'claypoolAlive', equals: true },
                  { record: 'kenslerAlive', equals: true }, { record: 'sinhaAlive', equals: true },
                  { record: 'dyerAlive', equals: true }, { record: 'danforthAlive', equals: true },
                  { record: 'takadaAlive', equals: true }, { record: 'cookieAlive', equals: true },
                ],
              },
            },
          ],
        },
        title: '埃利亚沙',
        textKey: 'eote.epilogue.eliyahAlone',
        section: 'partners',
      },
      { id: 'kenslerResearch', when: { record: 'kenslerUnderstandsMiasma', equals: true }, title: '肯斯勒的研究', textKey: 'eote.epilogue.kenslerResearch', section: 'research' },
      { id: 'danforthBroken', when: { record: 'danforthConfrontedDemons', equals: true }, title: '丹佛斯的心魔', textKey: 'eote.epilogue.danforthBroken', section: 'danforth' },
      { id: 'sealImproper', when: { record: 'sealUsedImproperly', equals: true }, title: '封印的代价', textKey: 'eote.epilogue.sealImproper', section: 'seal' },
      { id: 'manySurvivors', when: { record: 'survivingPartners', atLeast: 5 }, title: '大多数伙伴生还', textKey: 'eote.epilogue.manySurvivors', section: 'summary' },
      { id: 'recoveredSealsRow', when: { record: 'recoveredSeals', includes: 'seal_a' }, title: '封印已回收', textKey: 'eote.epilogue.recoveredSeals', section: 'seal' },
    ],
  }
}

const PARTNER_RECORDS = Object.freeze(['ellsworthAlive', 'claypoolAlive', 'kenslerAlive', 'sinhaAlive', 'dyerAlive', 'danforthAlive', 'takadaAlive', 'cookieAlive'])

function allPartnersAlive(extra = {}) {
  return { ...Object.fromEntries(PARTNER_RECORDS.map(key => [key, true])), eliyahAlive: false, ...extra }
}

test('epilogue：分支表完整（唯一 id / 已声明记录 / 类型匹配）并可扁平展开', () => {
  const table = eoteEpilogueTable()
  assert.equal(isEpilogueBranches(table), true)
  assert.equal(isEpilogueBranches({ a: [], b: [], entries: {} }), false)
  const normalized = normalizeEpilogueBranches(table)
  assert.deepEqual(normalized.errors, [])
  assert.equal(normalized.ok, true)
  assert.equal(normalized.rows.length, 10)
  assert.deepEqual(Object.keys(normalized.records).sort(), Object.keys(EOTE_RECORDS).sort())
  const flat = flattenEpilogueBranches(table)
  assert.equal(flat.length, 10)
  assert.deepEqual(flat[0], { id: 'ellsworthAndClaypool', title: '埃尔斯沃斯与克莱普尔', textKey: 'eote.epilogue.ellsworthAndClaypool', section: 'partners' })
  assert.equal(flat.at(-1).id, 'recoveredSealsRow')
  // 双轴矩阵形状不受影响（TDE 既有形状仍在）。
  assert.equal(isEpilogueMatrix({ a: [{ id: 'a1' }], b: [{ id: 'b1' }], entries: { 'a1|b1': {} } }), true)
})

test('epilogue：四对伙伴同时生还时四段全播放，埃利亚沙不播放，未命中行给原因', () => {
  const table = eoteEpilogueTable()
  const campaign = {
    records: allPartnersAlive({ kenslerUnderstandsMiasma: true, danforthConfrontedDemons: true, sealUsedImproperly: true, survivingPartners: 7, recoveredSeals: ['seal_a', 'seal_c'] }),
  }
  const result = resolveEpilogueBranches(table, campaign)
  assert.equal(result.ok, true)
  assert.deepEqual(result.branches.map(branch => branch.id), [
    ...PAIR_IDS, 'kenslerResearch', 'danforthBroken', 'sealImproper', 'manySurvivors', 'recoveredSealsRow',
  ])
  for (const branch of result.branches) assert.ok(branch.evidence.length > 0, `${branch.id} 应带命中证据`)
  assert.deepEqual(result.branches[0].evidence, [
    { record: 'ellsworthAlive', value: true }, { record: 'claypoolAlive', value: true },
  ])
  const skipped = new Map(result.skipped.map(row => [row.id, row.reason]))
  assert.match(skipped.get('eliyahAlone'), /ellsworthAlive|记录/)
})

test('epilogue：伙伴全灭只剩埃利亚沙时只播放他的段落（否定条件生效）', () => {
  const table = eoteEpilogueTable()
  const dead = Object.fromEntries(PARTNER_RECORDS.map(key => [key, false]))
  const campaign = { records: { ...dead, eliyahAlive: true, survivingPartners: 1 } }
  const result = resolveEpilogueBranches(table, campaign)
  assert.deepEqual(result.branches.map(branch => branch.id), ['eliyahAlone'])
  // 埃利亚沙也阵亡时不播放任何伙伴段落。
  const noOne = resolveEpilogueBranches(table, { records: { ...dead, eliyahAlive: false } })
  assert.deepEqual(noOne.branches, [])
  assert.equal(noOne.ok, true, '没有命中的尾声不是错误')
  assert.ok(noOne.skipped.length === 10)
})

test('epilogue：研究/封印/计数行与伙伴行可以同时命中（多条并播，顺序稳定）', () => {
  const table = eoteEpilogueTable()
  const campaign = { records: { ...allPartnersAlive({ kenslerUnderstandsMiasma: true }), survivingPartners: 4, recoveredSeals: [] } }
  const first = resolveEpilogueBranches(table, campaign)
  assert.deepEqual(first.branches.map(branch => branch.id), [...PAIR_IDS, 'kenslerResearch'])
  const second = resolveEpilogueBranches(structuredClone(table), structuredClone(campaign))
  assert.deepEqual(second, first, '同一输入重复求值结果稳定（幂等）')
})

test('epilogue：求值不修改战场状态与分支表（只读）', () => {
  const table = eoteEpilogueTable()
  const campaign = { records: allPartnersAlive({ survivingPartners: 6 }) }
  const tableBefore = structuredClone(table)
  const recordsBefore = structuredClone(campaign.records)
  resolveEpilogueBranches(table, campaign)
  assert.deepEqual(table, tableBefore)
  assert.deepEqual(campaign.records, recordsBefore)
})

test('epilogue：JSON 往返（structuredClone）后仍可校验并求值', () => {
  const table = structuredClone(eoteEpilogueTable())
  assert.equal(normalizeEpilogueBranches(table).ok, true)
  const campaign = { records: structuredClone(allPartnersAlive({ kenslerUnderstandsMiasma: true })) }
  const result = resolveEpilogueBranches(table, campaign)
  assert.deepEqual(result.branches.map(branch => branch.id), [...PAIR_IDS, 'kenslerResearch'])
})

test('epilogue：坏表失败关闭——重复 id / 未知记录 / 类型不符 / 非记录条件全部拒绝', () => {
  const cases = [
    ['重复 id', table => { table.rows[1].id = table.rows[0].id }, /重复/],
    ['未知记录', table => { table.rows[0].when.all[0].record = 'nobodyAlive' }, /未声明的记录/],
    ['布尔记录用 atLeast', table => { table.rows[0].when = { record: 'ellsworthAlive', atLeast: 1 } }, /只支持 equals/],
    ['布尔 equals 非布尔', table => { table.rows[0].when = { record: 'ellsworthAlive', equals: 'yes' } }, /equals 必须是布尔值/],
    ['非记录条件', table => { table.rows[0].when = { completed: 'cityOfTheElderThings' } }, /只允许记录条件/],
    ['空 rows', table => { table.rows = [] }, /rows 必须是非空数组/],
    ['缺 records', table => { delete table.records }, /缺少 records 声明|必须是 \{ records, rows \}/],
    ['坏 id', table => { table.rows[0].id = '1bad' }, /id 不合法/],
    ['未知记录类型', table => { table.records.survivingPartners = 'object' }, /类型未知/],
    ['集合记录用 equals', table => { table.rows[0].when = { record: 'recoveredSeals', equals: true } }, /只支持 includes/],
    ['数值记录 includes', table => { table.rows[0].when = { record: 'survivingPartners', includes: 'x' } }, /不支持 includes/],
    ['空条件对象', table => { table.rows[0].when = {} }, /不能是空对象/],
  ]
  for (const [label, mutate, pattern] of cases) {
    const table = eoteEpilogueTable()
    mutate(table)
    const normalized = normalizeEpilogueBranches(table)
    assert.equal(normalized.ok, false, `${label} 应被拒绝`)
    assert.ok(normalized.errors.some(error => pattern.test(error)), `${label} 的错误应匹配 ${pattern}：${normalized.errors.join('；')}`)
  }
  // 坏表 resolve 失败关闭：不播放任何分支。
  const broken = eoteEpilogueTable()
  broken.rows[0].id = broken.rows[1].id
  const result = resolveEpilogueBranches(broken, { records: allPartnersAlive() })
  assert.equal(result.ok, false)
  assert.deepEqual(result.branches, [])
  assert.deepEqual(result.skipped, [])
  assert.ok(result.errors.length > 0)
})

test('epilogue：求值需要战役状态，缺参直接报错', () => {
  assert.throws(() => resolveEpilogueBranches(eoteEpilogueTable(), null), /需要战役状态/)
  assert.throws(() => resolveEpilogueBranches(eoteEpilogueTable(), []), /需要战役状态/)
})

// ---------------------------------------------------------------------------
// 三、scenario.mirageVersions：致命幻景 I–III 版本簿记与场景局部快照
// ---------------------------------------------------------------------------

const ROUTE_RECORDS = Object.freeze({ dyerBelieved: true, eliminatedPartnerCount: 3 })

function mirageCampaignState() {
  return {
    campaign: {
      id: 'syntheticEdgeOfTheEarth',
      records: structuredClone(ROUTE_RECORDS),
      parts: { A: { records: { untouched: true } } },
      scenarioResults: [{ scenarioId: 'toTheForbiddenPeaks', resolution: 'R1' }],
      xp: 3,
      trauma: { 0: { physical: 1, mental: 0 } },
    },
    scenarioFlags: {},
  }
}

test('mirage：读函数不创建容器，未进入过时全部是空值', () => {
  const state = mirageCampaignState()
  const before = JSON.stringify(state)
  assert.equal(mirageState(state), null)
  assert.equal(mirageVersion(state), null)
  assert.equal(mirageTotalVisits(state), 0)
  assert.equal(mirageVisitCount(state, 1), 0)
  assert.equal(nextMirageVersion(state), 1)
  assert.equal(restoreMirageVersion(state, 1), null)
  assert.equal(JSON.stringify(state), before, '读函数不得写入状态')
  validateEoteMirage(state)
})

test('mirage：三次进入按 I→II→III 递增，主线状态不变，读档校验通过', () => {
  const state = mirageCampaignState()
  const mainlineBefore = { records: structuredClone(state.campaign.records), parts: structuredClone(state.campaign.parts), results: structuredClone(state.campaign.scenarioResults), xp: state.campaign.xp, trauma: structuredClone(state.campaign.trauma) }
  assert.deepEqual(noteMirageVisit(state, 1), { version: 1, visits: 1, total: 1, repeated: false })
  assert.deepEqual(noteMirageVisit(state, 2), { version: 2, visits: 1, total: 2, repeated: false })
  assert.deepEqual(noteMirageVisit(state, 3), { version: 3, visits: 1, total: 3, repeated: false })
  assert.equal(mirageVersion(state), 3)
  assert.deepEqual(MIRAGE_VERSIONS.map(version => mirageVisitCount(state, version)), [1, 1, 1])
  assert.equal(nextMirageVersion(state), null)
  // mirageState 是只读投影：改动返回值不影响权威状态。
  const projection = mirageState(state)
  projection.visits['1'] = 99
  projection.snapshots = {}
  assert.equal(mirageVisitCount(state, 1), 1)
  assert.deepEqual(state.campaign.eote.mirage, { version: 3, visits: { 1: 1, 2: 1, 3: 1 } })
  // 主线字段原样保留。
  assert.deepEqual(state.campaign.records, mainlineBefore.records)
  assert.deepEqual(state.campaign.parts, mainlineBefore.parts)
  assert.deepEqual(state.campaign.scenarioResults, mainlineBefore.results)
  assert.equal(state.campaign.xp, mainlineBefore.xp)
  assert.deepEqual(state.campaign.trauma, mainlineBefore.trauma)
  const restored = structuredClone(state)
  validateEoteMirage(restored)
  assert.equal(mirageVersion(restored), 3)
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(restored))), JSON.stringify(restored))
  assert.throws(() => noteMirageVisit(state, 1), /最多进入 3 次/)
})

test('mirage：重复记录当前版本幂等；顺序错误抛错且不写状态', () => {
  const state = mirageCampaignState()
  assert.deepEqual(noteMirageVisit(state, 1), { version: 1, visits: 1, total: 1, repeated: false })
  const snapshot = JSON.stringify(state)
  assert.deepEqual(noteMirageVisit(state, 1), { version: 1, visits: 1, total: 1, repeated: true })
  assert.equal(JSON.stringify(state), snapshot, '幂等重复记录不得改状态')
  assert.throws(() => noteMirageVisit(state, 3), /版本顺序错误/)
  assert.equal(JSON.stringify(state), snapshot, '非法顺序不得留下部分写入')
  assert.deepEqual(noteMirageVisit(state, 2), { version: 2, visits: 1, total: 2, repeated: false })
})

test('mirage：版本快照保存/恢复互不污染，重复保存覆盖且返回副本', () => {
  const state = mirageCampaignState()
  noteMirageVisit(state, 1)
  saveMirageVersion(state, 1, { locations: ['ice'], actIndex: 2, completed: { rescued: true } })
  const restoredOne = restoreMirageVersion(state, 1)
  assert.deepEqual(restoredOne, { locations: ['ice'], actIndex: 2, completed: { rescued: true } })
  restoredOne.locations.push('mutated')
  assert.deepEqual(restoreMirageVersion(state, 1).locations, ['ice'], '返回的是深拷贝')
  // 版本 2 的快照与版本 1 隔离。
  noteMirageVisit(state, 2)
  saveMirageVersion(state, 2, { locations: ['city'], actIndex: 1 })
  assert.deepEqual(restoreMirageVersion(state, 1).locations, ['ice'])
  assert.deepEqual(restoreMirageVersion(state, 2).locations, ['city'])
  assert.equal(restoreMirageVersion(state, 3), null)
  // 重复保存同版本覆盖。
  saveMirageVersion(state, 2, { locations: ['city', 'tunnel'], actIndex: 2 })
  assert.deepEqual(restoreMirageVersion(state, 2), { locations: ['city', 'tunnel'], actIndex: 2 })
  // 快照不改变进入次数；version 指向最近保存/进入的版本。
  assert.equal(mirageTotalVisits(state), 2)
  assert.equal(mirageVersion(state), 2)
  // 其他 EotE 子状态不被破坏。
  state.campaign.eote.partners = { kensler: { status: 'safe' } }
  saveMirageVersion(state, 1, { locations: ['ice'] })
  assert.deepEqual(state.campaign.eote.partners, { kensler: { status: 'safe' } })
})

test('mirage：JSON 往返（structuredClone）后快照仍可恢复', () => {
  const state = mirageCampaignState()
  noteMirageVisit(state, 1)
  saveMirageVersion(state, 1, { locations: ['ice'], actIndex: 2 })
  const restored = structuredClone(state)
  validateEoteMirage(restored)
  assert.deepEqual(restoreMirageVersion(restored, 1), { locations: ['ice'], actIndex: 2 })
  assert.deepEqual(restoreMirageVersion(restored, 2), null)
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(restored))), JSON.stringify(restored))
})

test('mirage：坏版本/坏快照/坏容器失败关闭，且不留部分写入', () => {
  const state = mirageCampaignState()
  for (const version of [0, 4, '1', 1.5, null, undefined]) {
    assert.throws(() => noteMirageVisit(state, version), /必须是 1–3 的整数/)
    assert.throws(() => saveMirageVersion(state, version, {}), /必须是 1–3 的整数/)
    assert.throws(() => restoreMirageVersion(state, version), /必须是 1–3 的整数/)
    assert.throws(() => mirageVisitCount(state, version), /必须是 1–3 的整数/)
  }
  assert.equal(JSON.stringify(state), JSON.stringify(mirageCampaignState()), '非法版本不得写入状态')
  const snapshot = JSON.stringify(state)
  assert.throws(() => saveMirageVersion(state, 1, 'not-an-object'), /快照必须是对象/)
  assert.throws(() => saveMirageVersion(state, 1, ['array']), /快照必须是对象/)
  assert.throws(() => saveMirageVersion(state, 1, { fn: () => 1 }), /无法序列化|纯 JSON/)
  assert.throws(() => saveMirageVersion(state, 1, { bad: undefined }), /无法序列化|纯 JSON/)
  assert.throws(() => saveMirageVersion(state, 1, { bad: Number.NaN }), /非有限数值/)
  assert.throws(() => saveMirageVersion(state, 1, { bad: new Date() }), /纯 JSON/)
  assert.equal(JSON.stringify(state), snapshot, '非法快照不得留下部分写入')
  assert.throws(() => noteMirageVisit({}, 1), /需要带 campaign 的状态/)
  assert.throws(() => mirageState({}), /需要带 campaign 的状态/)
})

test('mirage：读档校验拒绝未知字段/坏 visits/坏 snapshots/版本不符', () => {
  const cases = [
    ['未知字段', state => { state.campaign.eote = { version: 1, mirage: { mystery: true } } }, /未知字段/],
    ['坏版本', state => { state.campaign.eote = { version: 1, mirage: { version: 7 } } }, /幻景版本/],
    ['坏 visits 键', state => { state.campaign.eote = { version: 1, mirage: { visits: { 9: 1 } } } }, /未知版本键/],
    ['坏 visits 值', state => { state.campaign.eote = { version: 1, mirage: { visits: { 1: -1 } } } }, /非负整数/],
    ['坏 snapshots', state => { state.campaign.eote = { version: 1, mirage: { snapshots: { 1: 'text' } } } }, /纯 JSON|快照/],
    ['坏 snapshots 键', state => { state.campaign.eote = { version: 1, mirage: { snapshots: { 5: {} } } } }, /未知版本键/],
    ['扩展版本不符', state => { state.campaign.eote = { version: 2, mirage: {} } }, /不支持的 EotE 战役扩展版本/],
  ]
  for (const [label, mutate, pattern] of cases) {
    const state = mirageCampaignState()
    mutate(state)
    assert.throws(() => validateEoteMirage(state), pattern, label)
  }
  const plain = { campaign: { id: 'other' } }
  validateEoteMirage(plain)
  assert.deepEqual(plain, { campaign: { id: 'other' } }, '没有 EotE 扩展的旧战役保持原样')
  validateEoteMirage({})
})

test('mirage：三次幻景切入与版本快照联动（flows + mirageVersions 集成）', () => {
  const manifest = eoteManifest()
  const campaign = { records: { missingPartnerCount: 0, eliminatedPartnerCount: 3 }, scenarioResults: [] }
  const state = { campaign }
  const versions = []
  const result = runFlow(campaign, manifest, {
    answers: {
      prologue: 'believedDyer',
      checkpoint2Choice: 'flee',
      mirageChoice1: 'enterMirage',
      mirageChoice2: 'enterMirageAgain',
      mirageChoice3: 'enterMirageAgain',
    },
    onEnterScenario: node => {
      if (node.scenarioId !== 'fatalMirage') return
      const version = nextMirageVersion(state)
      versions.push(version)
      noteMirageVisit(state, version)
      saveMirageVersion(state, version, { visit: version, scenarioIndex: versions.length - 1 })
    },
  })
  assert.deepEqual(versions, [1, 2, 3])
  assert.equal(result.scenarios.filter(scenarioId => scenarioId === 'fatalMirage').length, 3)
  assert.deepEqual(MIRAGE_VERSIONS.map(version => restoreMirageVersion(state, version).visit), [1, 2, 3])
  // 主线记录（检查点 I 的 abandon 效果）与幻景版本状态并存。
  assert.equal(campaign.records.eliminatedPartnerCount, 4)
})
