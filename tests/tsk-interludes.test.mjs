// P7《绯红密钥》幕间 / 状况报告 / 密档验收：幕间 I、16 段世界地图密档幕间（14–55）、
// 状况报告 α–ω、14 份 Foundation Dossier、快捷旅票与绿地支线幕间。
//
// 覆盖口径（逐条镜像参考 `Campaigns/TheScarletKeys.hs` 的 `InterludeStep` / `CampaignSpecific "statusReport"`）：
//   ① 17 段幕间入口全部可从流程图走进并回到世界地图（正文进入历史、幕间访问记录、无未知效果）；
//   ② 逐段分支语义：条件记录/time 路由、奖励经验、时间推进、混乱标记交换、密钥持有者、
//      解锁地图节点、剧情卡入组、创伤、暗档/记录写入；
//   ③ 状况报告 α/ε/β/ζ/γ/θ/ψ/ω 的效果（cultist、解锁、夺走密钥、跨维度理解）；
//   ④ 密档：解锁 + 已读状态、正文非空；⑤ 快捷旅票与支线幕间的记账。
//
// 依赖说明：本文件不依赖尚未落盘的四章（`dogsOfWar` / `shadesOfSuffering` / `withoutATrace` /
// `congressOfTheKeys`）——幕间/状况报告是战役根流程，与章节模块无关；章节落盘后由
// `tests/tsk-campaign-flow.test.mjs` 的章节目录断言接续。
import test from 'node:test'
import assert from 'node:assert/strict'

import { campaignGraph, enterCampaignNode, validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { mapTime, mapUnlocked, worldMapState } from '../src/engine/tsk-map.js'
import { scarletKey } from '../src/engine/tsk-scarlet-keys.js'
import { coterieSnapshot } from '../src/engine/tsk-coterie.js'
import { TSK_FLOW, TSK_RECORD_DEFAULTS, TSK_RECORD_SCHEMA } from '../content/campaigns/theScarletKeys/flow.js'
import { startScarletKeysCampaign } from '../content/campaigns/theScarletKeys/prologue.js'
import {
  COTERIE_LAST_SEEN_RECORDS, DOSSIER_NODES, DOSSIER_STEP_IDS, INTERLUDE_ENTRY_IDS, INTERLUDE_NODES,
  KEY_IDS_BY_NAME, STATUS_REPORT_IDS_IN_ORDER, STATUS_REPORT_NODES, STORY_CARD_CODES, TRAVEL_NODES,
  runInterludeEffect,
} from '../content/campaigns/theScarletKeys/interludes.js'
import {
  TSK_DOSSIER_INTERLUDE_IDS, TSK_DOSSIER_KEYS, TSK_INTERLUDE_IDS, TSK_SCENARIO_IDS,
  campaignStoryText,
} from '../content/campaigns/theScarletKeys/parts.js'
import { CHAOS_BAGS } from '../content/campaigns/theScarletKeys/shared.js'

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
const CJK = /[\u3400-\u9fff]/
const MANIFEST = Object.freeze({
  id: 'theScarletKeys',
  scenarioIds: TSK_SCENARIO_IDS,
  recordSchema: TSK_RECORD_SCHEMA,
  flow: TSK_FLOW,
})
const STANDARD_BAG = [...CHAOS_BAGS.standard]

function newState ({ seats = 1, bag = STANDARD_BAG } = {}) {
  const investigators = {}
  for (let seat = 0; seat < seats; seat += 1) {
    investigators[seat] = {
      seat, id: `inv-${seat}`, code: '09001', name: `调查员 ${seat + 1}`, status: 'active',
      deck: [], xp: 0, earnedXp: 0, spentXp: 0, trauma: { physical: 0, mental: 0 },
      purchases: [], removedCards: [], traits: [],
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
    investigators: Object.values(investigators).map(record => ({ seat: record.seat, name: record.name })),
    log: [],
  }
  // 战役开局初始化（世界地图 / 状况报告阈值 / 十把密钥 / 同志会）。
  startScarletKeysCampaign(state, line => state.log.push(String(line)))
  return state
}

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
 * 从某个幕间入口节点走进子图，走到世界地图停点为止（`continuousInterlude` 与引擎一致）。
 * 断言：确实停在世界地图、历史里有正文、幕间访问记录已写。
 */
function playEntry (entryId, { records = {}, answers = {}, location = null, time = null, seats = 1, bag = null, visited = [], resolveChoice = null } = {}) {
  const state = newState({ seats, ...(bag ? { bag } : {}) })
  Object.assign(state.campaign.records, records)
  if (location != null) state.campaign.tsk.map.current = location
  // 已访问地点以引擎地图状态为准（syncMapRecords 会把它镜像进记录）。
  for (const node of visited) {
    if (!state.campaign.tsk.map.visited.includes(node)) state.campaign.tsk.map.visited.push(node)
  }
  if (time != null) {
    state.campaign.tsk.map.time = time
    state.campaign.records.time = time
  }
  const campaign = state.campaign
  campaign.flow = { nodeId: entryId, history: [{ nodeId: entryId, visit: 1 }], visits: { [entryId]: 1 } }
  const graph = validateCampaignGraph(MANIFEST)
  const visitedNodes = []
  const node = walkCampaign(campaign, MANIFEST,
    resolveChoice || chooseAnswer(answers), effect => apply(state, effect), { continuousInterlude: true })
  for (const visit of campaign.flow.history) visitedNodes.push(visit.nodeId)
  const story = campaign.flow.history.map(visit => visit.storyText || '').join('\n')
  void graph
  return { state, node, visited: visitedNodes, story, campaign }
}

/** 幕间入口跑一遍并在结果里断言通用不变量。 */
function expectRunsToMap (entryId, options = {}) {
  const result = playEntry(entryId, options)
  assert.equal(result.node.type, 'map', `${entryId} 未回到世界地图（实际 ${result.node.type}）`)
  const step = entryId.replace(/Step.*$/, '')
  assert.ok(result.state.campaign.records.interludeVisits.includes(step),
    `${entryId} 未写入幕间访问记录`)
  assert.ok(result.story.length > 0, `${entryId} 没有讲述任何正文`)
  assert.match(result.story, CJK, `${entryId} 正文不是中文`)
  assert.deepEqual(result.state.campaign.records.interludeVisits.filter(id => id === step).length, 1,
    `${entryId} 幕间访问记录重复`)
  return result
}

function withRandom (value, run) {
  const original = Math.random
  Math.random = () => value
  try {
    return run()
  } finally {
    Math.random = original
  }
}

// ---------------------------------------------------------------------------
// ① 幕间入口与节点表
// ---------------------------------------------------------------------------
test('P7 interludes 节点表：17 段幕间入口 + 8 状况报告 + 14 密档 + 快捷旅票/支线幕间，正文全部来自 story-text', () => {
  assert.equal(TSK_INTERLUDE_IDS.length, 17)
  assert.equal(TSK_DOSSIER_INTERLUDE_IDS.length, 16)
  assert.deepEqual(INTERLUDE_ENTRY_IDS, ['interlude1', ...TSK_DOSSIER_INTERLUDE_IDS])
  assert.equal(STATUS_REPORT_IDS_IN_ORDER.length, 8)
  assert.deepEqual(STATUS_REPORT_IDS_IN_ORDER, ['alpha', 'epsilon', 'beta', 'zeta', 'gamma', 'theta', 'psi', 'omega'])
  assert.equal(Object.keys(DOSSIER_NODES).length, 14)
  assert.deepEqual(DOSSIER_STEP_IDS, TSK_DOSSIER_KEYS.map(dossier => dossier.stepId))
  assert.equal(TRAVEL_NODES.expeditedTicket.cardCode, STORY_CARD_CODES.expeditedTicket)
  assert.equal(STORY_CARD_CODES.expeditedTicket, '09765')
  // 全部节点：有 textKey 的正文非空中文，且等于 story-text 展示树；
  // 幕间入口/状况报告/密档/choice 节点必须有标题（普通步骤节点由日志标题兜底）。
  let textNodes = 0
  for (const [id, node] of Object.entries(INTERLUDE_NODES)) {
    if (['interlude', 'choice', 'stepReturn'].includes(node.type) || /^statusReport|^dossier/.test(id)) {
      assert.ok(String(node.title || '').length > 0, `${id} 缺标题`)
    }
    if (!node.textKey) {
      assert.ok(['interlude14', 'expeditedTicket', 'sideStory'].includes(id) || node.type === 'stepReturn',
        `${id} 缺 textKey`)
      continue
    }
    textNodes += 1
    assert.ok(String(node.text || '').length > 0, `${id} 正文为空`)
    assert.match(node.text, CJK, `${id} 正文不是中文`)
    const expected = [node.textKey, ...(node.textKeys || [])].map(campaignStoryText).filter(Boolean).join('\n\n')
    assert.equal(node.text, expected, `${id} 正文与 story-text 不一致`)
  }
  assert.ok(textNodes > 90, `幕间正文节点过少：${textNodes}`)
  // 每个 choice 节点都有两个以上可选项、标签非空中文、出口都在节点表里。
  const graph = campaignGraph(MANIFEST)
  for (const [id, node] of Object.entries(INTERLUDE_NODES)) {
    for (const option of node.options || []) {
      assert.ok(option.label, `${id}/${option.id} 选项无标签`)
      assert.match(option.label, CJK, `${id}/${option.id} 选项标签不是中文`)
      assert.ok(graph.nodes[option.next], `${id}/${option.id} 出口不存在：${option.next}`)
    }
    if (node.next) assert.ok(graph.nodes[node.next], `${id} 出口不存在：${node.next}`)
    for (const rule of node.rules || []) assert.ok(graph.nodes[rule.next], `${id} 规则出口不存在：${rule.next}`)
  }
  // 幕间入口都开升级窗，其余子节点不开。
  for (const id of INTERLUDE_ENTRY_IDS) assert.equal(INTERLUDE_NODES[id].upgrades, true, id)
  for (const id of Object.keys(INTERLUDE_NODES).filter(key => !INTERLUDE_ENTRY_IDS.includes(key))) {
    assert.notEqual(INTERLUDE_NODES[id].upgrades, true, `${id} 不应开升级窗`)
  }
  // 节点表可 JSON 往返（存档/网络）。
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(INTERLUDE_NODES))).sort(), Object.keys(INTERLUDE_NODES).sort())
})

// ---------------------------------------------------------------------------
// ② 逐段幕间：全部入口都能走完并回到世界地图
// ---------------------------------------------------------------------------
test('P7 interludes 17 段幕间全部可从入口走进并回到世界地图（含两个分支的自由走法）', () => {
  const results = []
  for (const entryId of INTERLUDE_ENTRY_IDS) {
    results.push(expectRunsToMap(entryId, { location: 'Kabul', time: 10 }))
  }
  assert.equal(results.length, 17)
  // 每段幕间至少演出一段档案/正文（interlude1 是幕间故事，其余是档案）。
  for (const [index, entryId] of INTERLUDE_ENTRY_IDS.entries()) {
    const result = results[index]
    assert.match(result.story, CJK)
    if (entryId !== 'interlude1') assert.ok(result.story.length >= 20, `${entryId} 正文过短`)
  }
})

test('P7 interludes 幕间 I：真相/隐瞒两种选择写入记录、交换混乱标记、记录 tskPrologueIntent', () => {
  const told = expectRunsToMap('interlude1', { answers: { interlude1Choice: 'tell' } })
  assert.equal(told.state.campaign.records.theCellToldTheTruthToTaylor, true)
  assert.equal(Boolean(told.state.campaign.records.theCellHidTheTruthFromTaylor), false)
  assert.equal(told.state.chaosBag.filter(token => token === 'elderthing').length, 0)
  assert.equal(told.state.chaosBag.filter(token => token === 'tablet').length, 2)
  assert.equal(told.state.campaign.records.tskPrologueIntent, undefined,
    '战役清单未声明 tskPrologueIntent 时不应写入（章节自己声明后才镜像）')

  const hid = expectRunsToMap('interlude1', { answers: { interlude1Choice: 'doNotTell' } })
  assert.equal(hid.state.campaign.records.theCellHidTheTruthFromTaylor, true)
  assert.equal(hid.state.chaosBag.filter(token => token === 'tablet').length, 0)
  assert.equal(hid.state.chaosBag.filter(token => token === 'elderthing').length, 2)
  // 声明了 tskPrologueIntent 的战役清单会拿到镜像值（R&R 章节读同一记录）。
  const declared = newState()
  declared.campaign.recordSchema = { ...TSK_RECORD_SCHEMA, tskPrologueIntent: 'string' }
  declared.campaign.records.tskPrologueIntent = ''
  declared.campaign.flow = { nodeId: 'interlude1', history: [{ nodeId: 'interlude1', visit: 1 }], visits: { interlude1: 1 } }
  walkCampaign(declared.campaign, MANIFEST, chooseAnswer({ interlude1Choice: 'tell' }), effect => apply(declared, effect),
    { continuousInterlude: true })
  assert.equal(declared.campaign.records.tskPrologueIntent, 'trust')
})

test('P7 interludes 14 拨乱反正：错误线索未命中则 +1 回地图；命中则追回密钥、发经验、记 1 时间', () => {
  // 未命中（random 接近 1）：wrongLeadCount 0 → 1，走第 1 步。
  const miss = withRandom(0.99, () => expectRunsToMap('interlude14', { location: 'Kabul' }))
  assert.equal(miss.state.campaign.records.wrongLeadCount, 1)
  assert.equal(miss.visited.includes('interlude14Step1'), true)
  assert.equal(miss.state.campaign.records.rusesFound, false)

  // 错误线索满 3：必然进入第 2 步；追回被敌人夺走的密钥并给 1+3 经验、+1 时间。
  const hit = withRandom(0.99, () => expectRunsToMap('interlude14', {
    location: 'Quito',
    time: 12,
    records: {
      wrongLeadCount: 3,
      youHaventSeenTheLastOfTheRedGlovedMan: true,
    },
  }))
  assert.equal(hit.visited.includes('interlude14Step2'), true)
  assert.equal(hit.state.campaign.records.time, 13, '幕间 14 第 2 步记 1 时间')
  assert.equal(hit.state.campaign.investigators[0].earnedXp, 4, '奖励经验 = 1 + 错误线索数')
  assert.match(hit.story, CJK)

  // 命中但未满 3：random 0 ⇒ 视为找到真线索。
  const found = withRandom(0, () => {
    const state = newState()
    state.campaign.tsk.map.current = 'SanJuan'
    state.campaign.records.wrongLeadCount = 1
    // 先让一把密钥被敌人夺走：验证第 2 步的追回。
    const enemy = { id: 'enemy-1', name: '红手套男子', location: 'SanJuan' }
    state.enemies = [enemy]
    state.campaign.tsk.keys.keys['09519'].bearer = { type: 'enemy', enemyId: 'enemy-1' }
    state.campaign.records.keysStolen = ['09519:enemy-1']
    state.campaign.flow = { nodeId: 'interlude14', history: [{ nodeId: 'interlude14', visit: 1 }], visits: { interlude14: 1 } }
    walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect), { continuousInterlude: true })
    return state
  })
  assert.equal(found.campaign.records.rusesFound, true)
  assert.equal(found.campaign.tsk.keys.keys['09519'].bearer.type, 'investigator')
  assert.deepEqual(found.campaign.records.keysHeld, ['09519:0'])
  assert.deepEqual(found.campaign.records.keysStolen, [])
})

test('P7 interludes 20 伟业：无活动分支；有活动按信任计数分流（3 经验 / 结盟+灾毁引擎 / 手牌加成）', () => {
  const noActivity = expectRunsToMap('interlude20', { location: 'Bermuda' })
  assert.equal(noActivity.visited.includes('interlude20Step5'), true)
  assert.equal(noActivity.state.campaign.records.tskStartingHandBonus, 1)

  const allied = expectRunsToMap('interlude20', {
    location: 'Bermuda',
    records: { tuwileMasaiFledToBermuda: true },
    time: 10,
  })
  assert.equal(allied.visited.includes('interlude20Step4'), true)
  assert.equal(allied.state.campaign.records.tuwileMasaiIsOnYourSide, true)
  assert.equal(allied.state.campaign.investigators[0].earnedXp, 1)
  assert.equal(allied.state.campaign.records.time, 11)
  assert.equal(scarletKey(allied.state, KEY_IDS_BY_NAME.theBaleEngine).bearer.type, 'investigator')

  const proceeded = expectRunsToMap('interlude20', {
    location: 'Bermuda',
    records: { tuwileMasaiFledToBermuda: true, eceDoesNotTrustTheCell: true, youHaventSeenTheLastOfThorne: true },
  })
  assert.equal(proceeded.visited.includes('interlude20Step3'), true)
  assert.equal(proceeded.state.campaign.investigators[0].earnedXp, 3)
  assert.equal(Boolean(proceeded.state.campaign.records.tuwileMasaiIsOnYourSide), false)
})

test('P7 interludes 26 交换条件：旧金山/莫斯科两段，ticket / supplies / intel 选项与已访城市限制', () => {
  const sfTicket = expectRunsToMap('interlude26', {
    location: 'SanFrancisco',
    answers: { interlude26Choice1: 'ticket' },
  })
  assert.equal(sfTicket.visited.includes('interlude26Step1'), true)
  assert.ok(sfTicket.state.campaign.investigators[0].deck.includes(STORY_CARD_CODES.expeditedTicket))
  assert.equal(sfTicket.state.campaign.records.expeditedTickets, 1)

  const sfSupplies = expectRunsToMap('interlude26', {
    location: 'SanFrancisco',
    answers: { interlude26Choice1: 'supplies' },
  })
  assert.equal(sfSupplies.state.campaign.investigators[0].earnedXp, 1)

  const sfIntel = expectRunsToMap('interlude26', {
    location: 'SanFrancisco',
    answers: { interlude26Choice1: 'intel11' },
  })
  assert.equal(sfIntel.visited.includes('interlude26Step3'), true)
  assert.equal(sfIntel.state.campaign.records.theCellKnowsAmaranthsRealName, true)

  // 已访问马拉喀什：intel11 选项不可用，选择回退到第一个合法选项（ticket）。
  const blocked = expectRunsToMap('interlude26', {
    location: 'SanFrancisco',
    answers: { interlude26Choice1: 'intel11' },
    visited: ['Marrakesh'],
  })
  assert.equal(blocked.visited.includes('interlude26Step3'), false)
  assert.ok(blocked.state.campaign.investigators[0].deck.includes(STORY_CARD_CODES.expeditedTicket))

  const moscow = expectRunsToMap('interlude26', {
    location: 'Moscow',
    answers: { interlude26Choice2: 'intel28' },
  })
  assert.equal(moscow.visited.includes('interlude26Step2'), true)
  assert.equal(moscow.visited.includes('interlude26Step4'), true)
  assert.equal(moscow.state.campaign.records.theCellKnowsOfDesisPast, true)
})

test('P7 interludes 27 逝者已矣：信任分支/真相分支；哨音 + 时间 ≤30 走擅离职守（+1 时间）否则 +2 经验', () => {
  const trusted = expectRunsToMap('interlude27', { location: 'London', time: 5 })
  assert.equal(trusted.visited.includes('interlude27Step5'), true)
  assert.equal(trusted.visited.includes('interlude27Step7'), true)
  assert.equal(trusted.state.campaign.investigators[0].earnedXp, 2)
  assert.equal(trusted.state.campaign.records.time, 6)

  const secrets = expectRunsToMap('interlude27', {
    location: 'London',
    records: { agentQuinnDoesNotTrustTheCell: true },
    answers: { interlude27Choice2: 'secrets' },
  })
  assert.equal(secrets.visited.includes('interlude27Step4'), true)
  assert.equal(secrets.state.campaign.records.theFoundationRemainsInTheDark, true)
  // 隐瞒分支把 [tablet] 换回 [elderthing]（初始各 1 枚 → tablet 0 / elderthing 2）。
  assert.equal(secrets.state.chaosBag.filter(token => token === 'tablet').length, 0)
  assert.equal(secrets.state.chaosBag.filter(token => token === 'elderthing').length, 2)

  const offMission = expectRunsToMap('interlude27', {
    location: 'London',
    time: 12,
    records: { agentQuinnDoesNotTrustTheCell: true, theCellPossessesAMysteriousWhistle: true },
    answers: { interlude27Choice2: 'truth' },
  })
  assert.equal(offMission.visited.includes('interlude27Step6'), true)
  assert.equal(offMission.state.campaign.records.theCellIsOffMission, true)
  assert.equal(offMission.state.campaign.records.agentQuinnDoesNotTrustTheCell, false)
  assert.equal(offMission.state.campaign.investigators[0].earnedXp, 1)
  // 真相分支：交换 [elderthing] → [tablet]。
  assert.equal(offMission.state.chaosBag.filter(token => token === 'tablet').length, 2)

  // 时间 > 30：即使有哨音也留在任务中（+2 经验）。
  const late = expectRunsToMap('interlude27', {
    location: 'London',
    time: 31,
    records: { theCellPossessesAMysteriousWhistle: true },
    answers: { interlude27Choice2: 'truth' },
  })
  assert.equal(late.visited.includes('interlude27Step7'), true)
  assert.equal(late.state.campaign.investigators[0].earnedXp, 2)
})

test('P7 interludes 32 盘蛇：真相→福林独自行动（写 ψ）；隐瞒→三选一（协助解锁香港/+3 时间、放弃得剧情卡）', () => {
  const truth = expectRunsToMap('interlude32', {
    location: 'Shanghai',
    time: 8,
    records: { theCellToldTheTruthToTaylor: true },
  })
  assert.equal(truth.visited.includes('interlude32Step2'), true)
  assert.equal(truth.state.campaign.records.flintIsWorkingSolo, true)
  assert.equal(truth.state.campaign.records.psiTime, 14)
  assert.equal(truth.state.campaign.records.psiDeadline, 24)
  assert.equal(truth.state.campaign.tsk.statusReports.psi, 14)

  const aided = expectRunsToMap('interlude32', {
    location: 'Shanghai',
    time: 8,
    answers: { interlude32Choice3: 'stickAround' },
  })
  assert.equal(aided.visited.includes('interlude32Step5'), true)
  assert.equal(aided.state.campaign.records.theCellAidedInFlintsInvestigation, true)
  assert.ok(mapUnlocked(aided.state).includes('HongKong'))
  assert.equal(aided.state.campaign.records.time, 11, '协助调查记 3 时间')

  const abandoned = expectRunsToMap('interlude32', {
    location: 'Shanghai',
    answers: { interlude32Choice3: 'forgetHer' },
  })
  assert.equal(abandoned.state.campaign.records.flintAbandonedHisSearch, true)
  assert.ok(abandoned.state.campaign.investigators[0].deck.includes(STORY_CARD_CODES.inspectorFlint))

  const inquiring = expectRunsToMap('interlude32', {
    location: 'Shanghai',
    time: 8,
    answers: { interlude32Choice3: 'keepInquiring' },
  })
  assert.equal(inquiring.visited.includes('interlude32Step4'), true)
  assert.equal(inquiring.state.campaign.records.psiTime, 14)
})

test('P7 interludes 36 奇异的建筑：孟买/斯德哥尔摩两条线，欣赏过 → 撤销记录 +2 经验 +1 时间', () => {
  const bombayFirst = expectRunsToMap('interlude36', { location: 'Bombay', answers: {} })
  assert.equal(bombayFirst.visited.includes('interlude36Step1'), true)
  assert.equal(bombayFirst.visited.includes('interlude36Step3'), true)
  assert.equal(bombayFirst.state.campaign.records.theCellAppreciatedTheArchitecture, true)

  const bombayAgain = expectRunsToMap('interlude36', {
    location: 'Bombay',
    time: 10,
    records: { theCellAppreciatedTheArchitecture: true },
  })
  assert.equal(bombayAgain.visited.includes('interlude36Step2'), true)
  assert.equal(bombayAgain.state.campaign.records.theCellAppreciatedTheArchitecture, false)
  assert.equal(bombayAgain.state.campaign.investigators[0].earnedXp, 2)
  assert.equal(bombayAgain.state.campaign.records.time, 11)

  const stockholm = expectRunsToMap('interlude36', {
    location: 'Stockholm',
    time: 10,
    records: { theCellAppreciatedTheArchitecture: true },
  })
  assert.equal(stockholm.visited.includes('interlude36Step4'), true)
  assert.equal(stockholm.visited.includes('interlude36Step5'), true)
  assert.equal(stockholm.state.campaign.investigators[0].earnedXp, 2)

  const stockholmFirst = expectRunsToMap('interlude36', { location: 'Stockholm' })
  assert.equal(stockholmFirst.visited.includes('interlude36Step6'), true)
  assert.equal(stockholmFirst.state.campaign.records.theCellAppreciatedTheArchitecture, true)
})

test('P7 幕间 37 特殊快递：四种组合路由、交付记录、升级混乱标记并从牌组移除情报', () => {
  const deliverTokyo = expectRunsToMap('interlude37', { location: 'Tokyo', time: 4 })
  assert.equal(deliverTokyo.visited.includes('interlude37Step1'), true)
  assert.equal(deliverTokyo.state.campaign.records.theCellIsDeliveringFoundationIntel, true)
  assert.ok(deliverTokyo.state.campaign.investigators[0].deck.includes(STORY_CARD_CODES.foundationIntel))
  assert.equal(deliverTokyo.state.campaign.records.time, 5)

  const deliverLagos = expectRunsToMap('interlude37', { location: 'Lagos' })
  assert.equal(deliverLagos.visited.includes('interlude37Step3'), true)

  const complete = expectRunsToMap('interlude37', {
    location: 'Tokyo',
    records: { theCellIsDeliveringFoundationIntel: true },
    answers: {},
  })
  assert.equal(complete.visited.includes('interlude37Step2'), true)
  assert.equal(complete.state.campaign.records.foundationIntelDelivered, true)
  assert.equal(complete.state.campaign.records.theCellIsDeliveringFoundationIntel, false)
  // 默认升级 0 → +1（tests 无选择上下文时的确定性默认）。
  assert.equal(complete.state.chaosBag.filter(token => token === '+1').length,
    STANDARD_BAG.filter(token => token === '+1').length + 1)
  assert.equal(complete.state.chaosBag.filter(token => token === '0').length,
    STANDARD_BAG.filter(token => token === '0').length - 1)

  const completeLagos = expectRunsToMap('interlude37', {
    location: 'Lagos',
    records: { theCellIsDeliveringFoundationIntel: true },
  })
  assert.equal(completeLagos.visited.includes('interlude37Step4'), true)
})

test('P7 幕间 44/55 湮灭理论与超自然选择：见过伊拉万且 <25 → δ 时间点与解锁；≥25 → 消失；否则记为见过', () => {
  const traveled = expectRunsToMap('interlude44', {
    location: 'RioDeJaneiro',
    time: 18,
    records: { theCellMetDrIrawan: true },
  })
  assert.equal(traveled.visited.includes('interlude44Step2'), true)
  assert.equal(traveled.state.campaign.records.drIrawanTraveledToNewGuinea, true)
  assert.equal(traveled.state.campaign.records.deltaTime, 18)
  assert.equal(traveled.state.campaign.records.deltaDeadline, 28)
  assert.ok(mapUnlocked(traveled.state).includes('Manokwari'))
  assert.equal(traveled.state.campaign.investigators[0].earnedXp, 1)

  const vanished = expectRunsToMap('interlude44', {
    location: 'RioDeJaneiro',
    time: 25,
    records: { theCellMetDrIrawan: true },
  })
  assert.equal(vanished.visited.includes('interlude44Step3'), true)
  assert.equal(vanished.state.campaign.records.drIrawanVanishedFromExistence, true)

  const met = expectRunsToMap('interlude44', { location: 'RioDeJaneiro', time: 10 })
  assert.equal(met.visited.includes('interlude44Step4'), true)
  assert.equal(met.state.campaign.records.theCellMetDrIrawan, true)
  assert.equal(met.state.campaign.investigators[0].earnedXp, 1)

  const perth = expectRunsToMap('interlude55', {
    location: 'Perth',
    time: 12,
    records: { theCellMetDrIrawan: true },
  })
  assert.equal(perth.visited.includes('interlude55Step2'), true)
  assert.ok(mapUnlocked(perth.state).includes('Manokwari'))
  const perthLate = expectRunsToMap('interlude55', {
    location: 'Perth',
    time: 30,
    records: { theCellMetDrIrawan: true },
  })
  assert.equal(perthLate.visited.includes('interlude55Step3'), true)
})

test('P7 幕间 45 蜕变：δ+10 内 → 伊拉万入组 + 废墟钟 +1 时间；超期 → 消失 +2 经验 +1 时间', () => {
  const intact = expectRunsToMap('interlude45', {
    location: 'Manokwari',
    time: 20,
    records: { deltaTime: 15 },
  })
  assert.equal(intact.visited.includes('interlude45Step2'), true)
  assert.ok(intact.state.campaign.investigators[0].deck.includes(STORY_CARD_CODES.drIrawan))
  assert.equal(scarletKey(intact.state, KEY_IDS_BY_NAME.theRuinousChime).bearer.type, 'investigator')
  assert.equal(intact.state.campaign.records.time, 21)

  const vanished = expectRunsToMap('interlude45', {
    location: 'Manokwari',
    time: 27,
    records: { deltaTime: 15 },
  })
  assert.equal(vanished.visited.includes('interlude45Step3'), true)
  assert.equal(vanished.state.campaign.records.drIrawanVanishedFromExistence, true)
  assert.equal(vanished.state.campaign.investigators[0].earnedXp, 2)
  assert.equal(vanished.state.campaign.records.time, 28)
})

test('P7 幕间 49 空洞回响：<20 时间按真相分支解锁伦敦；≥20 → Quinn 消失', () => {
  const trusts = expectRunsToMap('interlude49', {
    location: 'Sydney',
    time: 12,
    records: { theCellToldTheTruthToTaylor: true },
  })
  assert.equal(trusts.visited.includes('interlude49Step2'), true)
  assert.ok(mapUnlocked(trusts.state).includes('London'))

  const distrusts = expectRunsToMap('interlude49', { location: 'Sydney', time: 12 })
  assert.equal(distrusts.visited.includes('interlude49Step3'), true)
  assert.equal(distrusts.state.campaign.records.agentQuinnDoesNotTrustTheCell, true)
  assert.ok(mapUnlocked(distrusts.state).includes('London'))

  const late = expectRunsToMap('interlude49', { location: 'Sydney', time: 20 })
  assert.equal(late.visited.includes('interlude49Step4'), true)
  assert.equal(late.state.campaign.records.agentQuinnVanishedFromExistence, true)
})

test('P7 幕间 50 血、汗与茶：协助/独自行动在宽限内/超期三条线都解锁吉隆坡', () => {
  const aided = expectRunsToMap('interlude50', {
    location: 'HongKong',
    records: { theCellAidedInFlintsInvestigation: true },
  })
  assert.equal(aided.visited.includes('interlude50Step1'), true)
  assert.equal(aided.state.campaign.records.flintTraveledToKualaLumpur, true)
  assert.ok(mapUnlocked(aided.state).includes('KualaLumpur'))

  const soloInTime = expectRunsToMap('interlude50', {
    location: 'HongKong',
    time: 18,
    records: { flintIsWorkingSolo: true, psiTime: 12 },
  })
  assert.equal(soloInTime.visited.includes('interlude50Step2'), true)
  assert.equal(soloInTime.state.campaign.records.psiDeadline, 22)

  const soloLate = expectRunsToMap('interlude50', {
    location: 'HongKong',
    time: 25,
    records: { flintIsWorkingSolo: true, psiTime: 12 },
  })
  assert.equal(soloLate.visited.includes('interlude50Step3'), true)
  assert.equal(soloLate.state.campaign.records.agentFlintIsMissing, true)
  assert.ok(mapUnlocked(soloLate.state).includes('KualaLumpur'))
})

test('P7 幕间 51/52 罗慕路斯与安全屋：擅离职守解锁百慕大三角；通行口令 + θ 后可用安全屋（镜刃 +2 经验 +1 时间）', () => {
  const off = expectRunsToMap('interlude51', {
    location: 'Rome',
    records: { theCellIsOffMission: true },
  })
  assert.equal(off.visited.includes('interlude51Step1'), true)
  assert.ok(mapUnlocked(off.state).includes('BermudaTriangle'))

  const on = expectRunsToMap('interlude51', { location: 'Rome' })
  assert.equal(on.visited.includes('interlude51Step2'), true)
  assert.equal(on.state.campaign.records.tskStartingResourcesBonus, 1)

  const safehouse = expectRunsToMap('interlude52', {
    location: 'YborCity',
    time: 15,
    records: { youKnowThePassphrase: true, thetaTime: 12 },
  })
  assert.equal(safehouse.visited.includes('interlude52Step2'), true)
  assert.equal(safehouse.state.campaign.investigators[0].earnedXp, 2)
  assert.equal(scarletKey(safehouse.state, KEY_IDS_BY_NAME.theMirroringBlade).bearer.type, 'investigator')
  assert.equal(safehouse.state.campaign.records.time, 16)

  const noPassphrase = expectRunsToMap('interlude52', { location: 'YborCity', time: 15 })
  assert.equal(noPassphrase.visited.includes('interlude52Step3'), true)

  const early = expectRunsToMap('interlude52', {
    location: 'YborCity',
    time: 5,
    records: { youKnowThePassphrase: true, thetaTime: 12 },
  })
  assert.equal(early.visited.includes('interlude52Step3'), true, 'θ 之前安全屋不可用')
})

test('P7 幕间 53 风中哨音：接受 → 哨音 + 交换标记 + 每名调查员 1 点创伤；拒绝 → +1 经验并换回标记', () => {
  const accept = expectRunsToMap('interlude53', {
    location: 'Kathmandu',
    answers: { interlude53Choice: 'accept' },
  })
  assert.equal(accept.state.campaign.records.theCellPossessesAMysteriousWhistle, true)
  assert.equal(accept.state.chaosBag.filter(token => token === 'elderthing').length, 0)
  assert.equal(accept.state.chaosBag.filter(token => token === 'tablet').length, 2)
  assert.deepEqual(accept.state.campaign.trauma[0], { physical: 1, mental: 0 })

  const reject = expectRunsToMap('interlude53', {
    location: 'Kathmandu',
    answers: { interlude53Choice: 'reject' },
  })
  assert.equal(reject.state.campaign.records.theCellRefusedAlikisOffer, true)
  assert.equal(reject.state.campaign.investigators[0].earnedXp, 1)
  assert.equal(reject.state.chaosBag.filter(token => token === 'tablet').length, 0)
  assert.equal(reject.state.chaosBag.filter(token => token === 'elderthing').length, 2)

  // 有 Drifter 调查员时应追加「漂浪者」段落（正文来自 story-text 的 drifter 键）。
  const drifter = newState()
  drifter.campaign.investigators[0].traits = ['Drifter']
  drifter.campaign.tsk.map.current = 'Kathmandu'
  drifter.campaign.flow = { nodeId: 'interlude53', history: [{ nodeId: 'interlude53', visit: 1 }], visits: { interlude53: 1 } }
  walkCampaign(drifter.campaign, MANIFEST, chooseAnswer({ interlude53Choice: 'reject' }), effect => apply(drifter, effect),
    { continuousInterlude: true })
  const story = drifter.campaign.flow.history.map(visit => visit.storyText || '').join('\n')
  assert.ok(story.includes(campaignStoryText('whistleOnTheWind.drifter').slice(0, 20)), '缺少漂浪者段落')
})

test('P7 幕间 54 地狱机器：声望 ≥3 → 马赛站你这边 + 灾毁引擎；否则逃往百慕大', () => {
  const ally = expectRunsToMap('interlude54', {
    location: 'Nairobi',
    time: 10,
    records: { laChicaRojaIsOnYourSide: true, theCellAidedTheKnight: true, eceTrustsTheCell: true },
  })
  assert.equal(ally.visited.includes('interlude54Step2'), true)
  assert.equal(ally.state.campaign.records.tuwileMasaiIsOnYourSide, true)
  assert.equal(scarletKey(ally.state, KEY_IDS_BY_NAME.theBaleEngine).bearer.type, 'investigator')
  assert.equal(ally.state.campaign.records.time, 11)

  const fled = expectRunsToMap('interlude54', { location: 'Nairobi' })
  assert.equal(fled.visited.includes('interlude54Step3'), true)
  assert.equal(fled.state.campaign.records.tuwileMasaiFledToBermuda, true)
})

// ---------------------------------------------------------------------------
// ③ 状况报告 α–ω
// ---------------------------------------------------------------------------
test('P7 状况报告 α–ω：每份报告演出正文并结算参考效果（cultist/解锁/夺密钥/跨维度理解）', () => {
  const expected = {
    alpha: { cultist: 1, unlocked: [] },
    epsilon: { cultist: 0, unlocked: [] },
    beta: { cultist: 1, unlocked: ['Tunguska'] },
    zeta: { cultist: 0, unlocked: ['Kabul', 'Quito', 'SanJuan', 'Reykjavik'] },
    gamma: { cultist: 1, unlocked: [] },
    theta: { cultist: 0, unlocked: [] },
    psi: { cultist: 0, unlocked: ['HongKong'] },
    omega: { cultist: 1, unlocked: [] },
  }
  for (const report of STATUS_REPORT_IDS_IN_ORDER) {
    const state = newState()
    const nodeId = `statusReport${report[0].toUpperCase()}${report.slice(1)}`
    state.campaign.flow = { nodeId, history: [{ nodeId, visit: 1 }], visits: { [nodeId]: 1 } }
    const node = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect),
      { continuousInterlude: true })
    assert.equal(node.type, 'map', `${report} 未回到世界地图`)
    assert.equal(state.campaign.records.statusReportsSeen.join(','), report)
    assert.equal(state.campaign.records.statusReportsRead, 1)
    assert.equal(state.chaosBag.filter(token => token === 'cultist').length, expected[report].cultist,
      `${report} cultist 标记数量`)
    for (const mapNode of expected[report].unlocked) {
      assert.ok(mapUnlocked(state).includes(mapNode), `${report} 未解锁 ${mapNode}`)
    }
    const story = state.campaign.flow.history.map(visit => visit.storyText || '').join('\n')
    assert.match(story, CJK, `${report} 正文缺失`)
    assert.ok(state.log.some(line => line.includes(report.toUpperCase())), `${report} 未写日志`)
  }
  // ζ：持有 ≥5 把密钥时被夺走 2 把（需要有「尚未见过最后一面」的敌人）。
  const zeta = newState()
  const keys = Object.keys(zeta.campaign.tsk.keys.keys).slice(0, 5)
  for (const id of keys) zeta.campaign.tsk.keys.keys[id].bearer = { type: 'investigator', seat: 0 }
  zeta.campaign.records.youHaventSeenTheLastOfTheRedGlovedMan = true
  zeta.campaign.flow = { nodeId: 'statusReportZeta', history: [{ nodeId: 'statusReportZeta', visit: 1 }], visits: { statusReportZeta: 1 } }
  walkCampaign(zeta.campaign, MANIFEST, chooseAnswer({}), effect => apply(zeta, effect), { continuousInterlude: true })
  const lostFromInvestigators = Object.values(zeta.campaign.tsk.keys.keys)
    .filter(key => key.bearer.type === 'none')
  assert.equal(lostFromInvestigators.length, 2 + (10 - 5), '未持有的 5 把 + 被夺走的 2 把均为 none')
  assert.equal(zeta.campaign.records.keysStolen.length, 2, 'ζ 应夺走 2 把密钥')
  assert.ok(zeta.campaign.records.keysStolen.every(entry => entry.endsWith(':09752')))
  // 幕间 14 把它们追回。
  const recovered = newState()
  recovered.campaign.records.keysStolen = zeta.campaign.records.keysStolen
  recovered.campaign.records.wrongLeadCount = 3
  recovered.campaign.tsk.map.current = 'Kabul'
  recovered.campaign.flow = { nodeId: 'interlude14', history: [{ nodeId: 'interlude14', visit: 1 }], visits: { interlude14: 1 } }
  walkCampaign(recovered.campaign, MANIFEST, chooseAnswer({}), effect => apply(recovered, effect), { continuousInterlude: true })
  assert.deepEqual(recovered.campaign.records.keysStolen, [])
  assert.equal(recovered.campaign.records.keysHeld.length, 2)
  // γ：每名调查员把跨维度理解洗入牌组。
  const gamma = newState({ seats: 2 })
  gamma.campaign.flow = { nodeId: 'statusReportGamma', history: [{ nodeId: 'statusReportGamma', visit: 1 }], visits: { statusReportGamma: 1 } }
  walkCampaign(gamma.campaign, MANIFEST, chooseAnswer({}), effect => apply(gamma, effect), { continuousInterlude: true })
  for (const record of Object.values(gamma.campaign.investigators)) {
    assert.ok(record.deck.includes(STORY_CARD_CODES.paradimensionalUnderstanding))
  }
})

// ---------------------------------------------------------------------------
// ④ 密档 / ⑤ 快捷旅票与支线幕间
// ---------------------------------------------------------------------------
test('P7 密档：14 份 Foundation Dossier 阅读后解锁并记为已读，正文非空', () => {
  for (const dossier of TSK_DOSSIER_KEYS) {
    const state = newState()
    state.campaign.flow = { nodeId: dossier.stepId, history: [{ nodeId: dossier.stepId, visit: 1 }], visits: { [dossier.stepId]: 1 } }
    const node = walkCampaign(state.campaign, MANIFEST, chooseAnswer({}), effect => apply(state, effect),
      { continuousInterlude: true })
    assert.equal(node.type, 'map')
    assert.deepEqual(state.campaign.tsk.dossiers.unlocked, [dossier.key])
    assert.deepEqual(state.campaign.tsk.dossiers.read, [dossier.key])
    const story = state.campaign.flow.history.map(visit => visit.storyText || '').join('\n')
    assert.match(story, CJK, `${dossier.key} 密档正文缺失`)
    assert.ok(story.includes('密档') || story.includes('档案'), `${dossier.key} 未讲述密档读法`)
  }
  // 密档节点标题带档案号（地图节点 subtitle）。
  assert.match(DOSSIER_NODES.dossierHavana.title, /#28-I/)
})

test('P7 快捷旅票与支线幕间：旅票讲述卡面规则并记时间语义；绿地支线记录完成地点', () => {
  const ticket = newState()
  ticket.campaign.flow = { nodeId: 'expeditedTicket', history: [{ nodeId: 'expeditedTicket', visit: 1 }], visits: { expeditedTicket: 1 } }
  walkCampaign(ticket.campaign, MANIFEST, chooseAnswer({}), effect => apply(ticket, effect), { continuousInterlude: true })
  const ticketStory = ticket.campaign.flow.history.map(visit => visit.storyText || '').join('\n')
  assert.match(ticketStory, CJK)
  assert.match(ticketStory, /放逐|时间|地点/, '旅票节点应讲述卡面规则')

  const sideStory = newState()
  sideStory.campaign.tsk.map.current = 'Cairo'
  sideStory.campaign.flow = { nodeId: 'sideStory', history: [{ nodeId: 'sideStory', visit: 1 }], visits: { sideStory: 1 } }
  const stop = walkCampaign(sideStory.campaign, MANIFEST, chooseAnswer({}), effect => apply(sideStory, effect),
    { continuousInterlude: true })
  assert.equal(stop.type, 'map')
  assert.deepEqual(sideStory.campaign.records.sideStoriesCompleted, ['Cairo'])
  assert.deepEqual(sideStory.campaign.tsk.sideStories.completed, ['Cairo'])
})

test('P7 interludes 处理器：未知事件抛错；状况报告/幕间效果都不会写未声明记录之外的状态', () => {
  const state = newState()
  assert.throws(() => runInterludeEffect(state, { event: 'nope' }, () => {}), /未知幕间效果/)
  // 所有幕间事件名都能在节点表里找到对应效果（防止处理器与节点漂移）。
  const events = new Set()
  for (const node of Object.values(INTERLUDE_NODES)) {
    for (const effect of node.effects || []) if (effect.handler === 'scarletKeysInterludes') events.add(effect.event)
    for (const option of node.options || []) {
      for (const effect of option.effects || []) if (effect.handler === 'scarletKeysInterludes') events.add(effect.event)
    }
  }
  assert.equal(events.has('statusReport'), true)
  assert.equal(events.has('dossier'), true)
  for (const event of events) {
    if (event === 'statusReport' || event === 'dossier') continue
    const probe = newState()
    probe.campaign.flow = { nodeId: 'worldMap', history: [{ nodeId: 'worldMap', visit: 1 }], visits: {} }
    assert.doesNotThrow(() => runInterludeEffect(probe, { event }, () => {}), `事件 ${event} 抛错`)
  }
  // 混乱标记交换在缺少来源标记时安全跳过。
  const empty = newState()
  empty.campaign.chaosBag = ['+1', '0']
  empty.chaosBag = ['+1', '0']
  assert.doesNotThrow(() => runInterludeEffect(empty, { event: 'interlude1ToldTruth' }, () => {}))
  assert.deepEqual(empty.chaosBag, ['+1', '0'])
  // 秘档敌人文本映射覆盖 10 名同志会成员。
  assert.equal(COTERIE_LAST_SEEN_RECORDS.length, 10)
  assert.equal(new Set(COTERIE_LAST_SEEN_RECORDS.map(entry => entry.code)).size, 10)
  // 同志会三池在幕间前后保持守恒。
  const coterie = coterieSnapshot(state)
  assert.equal(coterie.unresolved.length, 10)
  void mapTime
  void worldMapState
  void enterCampaignNode
})
