// w6 专属验收测试：TIC 第二章「艾莲娜·哈珀失踪案」两张幕卡
//   07060 寻找哈珀特工（The Search for Agent Harper）
//   07061 营救（The Rescue）
//
// 覆盖：
//   · 两卡注册/scope/implemented、actRule 契约（objective / roundEndCheck / onReveal / resolutionByKidnapper）
//   · 07060 背面推进 → content 事件 ticHarperAccusation（经真实 advanceAct + entry-rules.actReveal 链路）
//   · 07060 轮末可选推进：skip 不推进 / advance 发起指控
//   · 07060 团队线索谈判：[fast] 谈判入口、X 选择与支付、揭示迹象牌顶 → 抽取 1 张 + 其余与遭遇顶洗回、
//     团队每轮一次、团队线索不足时入口消失、crossedOff 记录（scenarioCardsSeen 触发）
//   · 07061 绑架犯修正：失去冷漠 / 不能谈判 / +1[每调查员]生命，且不影响其他嫌疑敌人
//   · 07061 目标：1 人局「或」、≥2 人局「且」；艾莲娜在藏身处下方/附属两种形态；艾莲娜不在场不误推进
//   · 07061 背面推进 → content 事件 ticHarperRescue；六种绑架犯 → resolution2..7 与 STORY_TEXT 结局键对齐
//   · 内容层未接线时的安全降级：resolveScenarioEvent 抛 Unknown 时卡内只登记警告、不误结算
//
// 内容层接线状态（2026-11-04）：Lead 尚未在 content/.../entry-rules.js 增加 `events` 与 `roundEnded`
// 分派。本测试用「给注册表中的 behavior 打补丁」的方式模拟该接线（wireContentEvents），
// 补丁与报告里给 Lead 的接线片段逐字一致；Lead 接线后本测试无需改动。
//
// 运行：node --test tests/tic-harper-acts.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { advanceAct, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityRuleActive, entityModifierTotal } from '../src/engine/modifiers.js'
import { enemyIsAloof } from '../src/engine/enemy-aloof.js'
import { contentRegistry } from '../content/registered.js'
import { STORY_TEXT } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'
import { suspectCode } from '../src/cards/encounter-entries/_shared.js'
import entry07060 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07060.js'
import entry07061 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07061.js'

const SCENARIO_ID = 'theVanishingOfElinaHarper'
const RESCUE_MAP = {
  '07078': 'resolution2', // Brian Burnham
  '07081': 'resolution3', // Othera Gilman
  '07080': 'resolution4', // Joyce Little
  '07079': 'resolution5', // Barnabas Marsh
  '07077': 'resolution6', // Zadok Allen
  '07076': 'resolution7', // Robert Friendly
}

// 索引由主进程重建；测试进程内对「索引未含的条目」做直接注册兜底（同 w1/w2 的写法）。
for (const entry of [entry07060, entry07061]) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

// ---------------------------------------------------------------------------
// 内容层接线模拟（与 harper-report.md 给 Lead 的片段一致）
// ---------------------------------------------------------------------------
const emitted = []
let contentWired = false
function wireContentEvents() {
  const behavior = contentRegistry.getBehavior(SCENARIO_ID)
  behavior.events ||= {}
  behavior.events.ticHarperAccusation = (state, payload) => emitted.push({ id: 'ticHarperAccusation', payload })
  behavior.events.ticHarperRescue = (state, payload) => emitted.push({ id: 'ticHarperRescue', payload })
  behavior.roundEnded = (state, api) => {
    const act = state.acts?.[state.actIndex]
    const rule = registeredEntry(act?.originalCode || act?.code)?.actRule
    rule?.roundEndCheck?.(state, act, api)
  }
  contentWired = true
}
function harperFixture(count = 2, options = {}) {
  const state = chapterFixture(SCENARIO_ID, count, options)
  if (!contentWired) wireContentEvents()
  return state
}

// 事务包装：章节夹具/剧本结算都要求 action 走 resolveTransaction；ScenarioEnded 视为正常结束。
function transaction(state, execute, select = () => null) {
  const run = (draft) => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(state, 0, { action: 'ticHarperActs' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

const codeOf = card => (typeof card === 'string' ? card : card?.originalCode || card?.code)
const actRuleOf = code => registeredEntry(code).actRule
const entityParley = state => legalMoves(state, 0).find(command =>
  command.action === 'entityAbility' && command.entityId === state.acts[state.actIndex].id
  && command.actionKind === 'parley')

// ---------------------------------------------------------------------------
// 1) 注册与 actRule 契约
// ---------------------------------------------------------------------------
test('07060/07061 注册：code/scope/implemented 与 actRule 契约', () => {
  for (const code of ['07060', '07061']) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册（索引或直接注册失败）`)
    assert.equal(entry.code, code)
    assert.equal(entry.scope, 'act')
    assert.equal(entry.implemented, true)
  }
  const rule60 = actRuleOf('07060')
  assert.equal(typeof rule60.objective, 'function')
  assert.equal(rule60.objective({}, { code: '07060' }), false, '07060 目标不可自动推进')
  assert.equal(typeof rule60.roundEndCheck, 'function', '轮末可选推进由内容层 roundEnded 分派')
  assert.equal(typeof rule60.onReveal, 'function')
  assert.equal(registeredEntry('07060').abilities.length, 1)
  assert.equal(registeredEntry('07060').abilities[0].kind, 'free')
  assert.equal(registeredEntry('07060').abilities[0].actionKind, 'parley')
  assert.deepEqual({ ...registeredEntry('07060').abilities[0].limit }, { scope: 'perRound', owner: 'group', count: 1, label: 'perRound/group×1' })

  const rule61 = actRuleOf('07061')
  assert.equal(typeof rule61.objective, 'function')
  assert.equal(typeof rule61.onReveal, 'function')
  assert.deepEqual({ ...rule61.resolutionByKidnapper }, RESCUE_MAP)
  const modifierTargets = registeredEntry('07061').modifiers.map(modifier => modifier.target).sort()
  assert.deepEqual(modifierTargets, ['cannot:parley', 'enemyHealth', 'loses:aloof'])
})

// ---------------------------------------------------------------------------
// 2) 07060 背面：真实 advanceAct → actReveal → onReveal → 事件契约
// ---------------------------------------------------------------------------
test('07060 背面推进发出 ticHarperAccusation 事件（payload 契约）', () => {
  const state = harperFixture(2)
  emitted.length = 0
  transaction(state, draft => advanceAct(draft, []))
  const call = emitted.find(item => item.id === 'ticHarperAccusation')
  assert.ok(call, '推进 07060 必须触发指控事件')
  assert.equal(call.payload.actCode, '07060')
  assert.equal(call.payload.actId, 'act07060')
  assert.equal(call.payload.scenarioId, SCENARIO_ID)
  assert.equal(state.actIndex, 1, '幕指针仍由引擎推进（内容层事件负责装入 07061）')
})

// ---------------------------------------------------------------------------
// 3) 07060 轮末可选推进（内容层 roundEnded → actRule.roundEndCheck）
// ---------------------------------------------------------------------------
test('07060 轮末可选推进：skip 不推进 / advance 发起指控', () => {
  const state = harperFixture(1)
  const roundEnded = draft => contentRegistry.getBehavior(SCENARIO_ID).roundEnded(draft, scenarioRuntime(draft, []))
  emitted.length = 0
  transaction(state, roundEnded, () => 'skip')
  assert.equal(state.actIndex, 0, '选择暂不推进')
  assert.equal(emitted.length, 0)
  transaction(state, roundEnded, () => 'advance')
  assert.equal(state.actIndex, 1, '选择推进')
  assert.ok(emitted.some(item => item.id === 'ticHarperAccusation'), '推进时发起指控')
})

// ---------------------------------------------------------------------------
// 4) 07060 团队线索谈判（真实引擎执行）
// ---------------------------------------------------------------------------
test('07060 团队线索谈判：花费 X[每调查员]、揭示并抽取 1 张、其余与遭遇顶洗回、团队每轮一次', () => {
  const state = harperFixture(2)
  const leadsBefore = [...state.scenarioFlags.mechanics.scenarioDecks.leads.deck]
  const topTwo = leadsBefore.slice(-2).reverse() // 牌堆顶 = 数组末位
  state.investigators[0].clues = 3
  state.investigators[1].clues = 3
  state.clues = 6
  const command = entityParley(state)
  assert.ok(command, '团队线索充足时应出现 [fast] 谈判入口')
  move(state, command)
  settle(state, choice => (choice.kind === 'effect' ? '2' : choice.options[0]?.id))
  assert.equal(state.clues, 2, 'X=2 × 2 人 = 4 个团队线索')
  assert.deepEqual(state.investigators.map(inv => inv.clues), [1, 1], '线索由两位调查员分摊')
  assert.deepEqual(state.scenarioFlags.harperDrawnLeads, [topTwo[0]], '抽取牌堆顶 1 张并记入已取得')
  const deck = state.scenarioFlags.mechanics.scenarioDecks.leads.deck
  assert.equal(deck.includes(topTwo[0]), false, '抽到的迹象离开迹象牌堆')
  assert.equal(deck.length, leadsBefore.length, '其余 1 张 + 遭遇牌库顶 1 张洗回：数量不变')
  for (const code of topTwo) assert.ok(state.scenarioFlags.crossedOff.includes(code), `揭示的 ${code} 应被划掉`)
  assert.equal(entityParley(state), undefined, '团队每轮仅限一次')
})

test('07060 团队线索不足时谈判入口不出现', () => {
  const state = harperFixture(2)
  state.investigators[0].clues = 0
  state.investigators[1].clues = 0
  state.clues = 0
  assert.equal(entityParley(state), undefined, '连 X=1 都付不起时不应给出死按钮')
})

// ---------------------------------------------------------------------------
// 5) 07061 绑架犯修正（轻量 state：直接读引擎修正/规则读点）
// ---------------------------------------------------------------------------
function kidnapperState({ count = 3, record = 'BrianBurnham' } = {}) {
  return {
    numInvestigators: count,
    campaign: { records: { harperSuspect: record } },
    acts: [{ id: 'act07061', code: '07061', originalCode: '07061' }], actIndex: 0,
    agendas: [], agendaIndex: 0,
    victoryDisplay: [], locations: [], enemies: [], investigators: [],
  }
}

test('07061 修正：绑架犯失去冷漠/不能谈判/+1[每调查员]生命，其他嫌疑不受影响', () => {
  const state = kidnapperState({ count: 3 })
  const kidnapper = { id: 'e1', code: '07078', originalCode: '07078', aloof: true }
  const otherSuspect = { id: 'e2', code: '07076', originalCode: '07076', aloof: true }
  assert.equal(entityRuleActive(state, kidnapper, 'loses:aloof'), true)
  assert.equal(entityRuleActive(state, kidnapper, 'cannot:parley'), true)
  assert.equal(entityModifierTotal(state, kidnapper, 'enemyHealth'), 3, '+1[每调查员]生命（3 人局）')
  assert.equal(enemyIsAloof(state, kidnapper), false, '失去冷漠：自动交战/攻击读点')
  assert.equal(entityRuleActive(state, otherSuspect, 'loses:aloof'), false)
  assert.equal(entityRuleActive(state, otherSuspect, 'cannot:parley'), false)
  assert.equal(entityModifierTotal(state, otherSuspect, 'enemyHealth'), 0)
  assert.equal(enemyIsAloof(state, otherSuspect), true, '非绑架犯仍然是冷漠的嫌疑敌人')
  // records 里写印刷卡号也识别（printedRole 双向）
  state.campaign.records.harperSuspect = '07078'
  assert.equal(entityRuleActive(state, kidnapper, 'loses:aloof'), true)
  // 不是当前幕时修正不生效
  state.acts = [{ id: 'act07060', code: '07060', originalCode: '07060' }]
  assert.equal(entityRuleActive(state, kidnapper, 'loses:aloof'), false)
})

test('07061 修正：真实章节 state 下同样生效（fixture 换当前幕为 07061）', () => {
  const state = harperFixture(2, { records: { harperSuspect: 'OtheraGilman' } })
  const stage = structuredClone(state.scenario.stageCards['07061'])
  state.acts = [stage]
  state.actIndex = 0
  const kidnapper = { id: 'e1', code: '07081', originalCode: '07081', aloof: true }
  state.enemies.push(kidnapper)
  assert.equal(entityRuleActive(state, kidnapper, 'loses:aloof'), true)
  assert.equal(entityRuleActive(state, kidnapper, 'cannot:parley'), true)
  assert.equal(entityModifierTotal(state, kidnapper, 'enemyHealth'), 2, '2 人局 +2 生命')
})

// ---------------------------------------------------------------------------
// 6) 07061 目标：1 人「或」/ ≥2 人「且」
// ---------------------------------------------------------------------------
function objectiveState({ count = 1, victory = [], clues = 0, elina = 'beneath', withLocation = true } = {}) {
  const hideout = {
    id: 'loc1', code: '07070', originalCode: '07070', clues,
    beneath: elina === 'beneath' ? ['07083'] : [],
    attachments: elina === 'attached' ? [{ id: 'a1', code: '07083', originalCode: '07083' }] : [],
  }
  return {
    numInvestigators: count,
    campaign: { records: { harperSuspect: 'BrianBurnham' } },
    acts: [{ id: 'act07061', code: '07061', originalCode: '07061' }], actIndex: 0,
    agendas: [], agendaIndex: 0,
    victoryDisplay: victory.map(code => ({ code, originalCode: code })),
    locations: withLocation ? [hideout] : [], enemies: [], investigators: [],
  }
}
const rescueObjective = state => actRuleOf('07061').objective(state, state.acts[state.actIndex])

test('07061 目标：1 人局任一条件 / ≥2 人局两条件都必须满足', () => {
  assert.equal(rescueObjective(objectiveState({ count: 1, victory: ['07078'], clues: 1 })), true, '1 人：绑架犯在胜利区')
  assert.equal(rescueObjective(objectiveState({ count: 1, victory: [], clues: 0 })), true, '1 人：藏身处无线索')
  assert.equal(rescueObjective(objectiveState({ count: 1, victory: [], clues: 1 })), false, '1 人：两者都不满足')
  assert.equal(rescueObjective(objectiveState({ count: 2, victory: ['07078'], clues: 1 })), false, '2 人：只有胜利区不够')
  assert.equal(rescueObjective(objectiveState({ count: 2, victory: [], clues: 0 })), false, '2 人：只有无线索不够')
  assert.equal(rescueObjective(objectiveState({ count: 2, victory: ['07078'], clues: 0 })), true, '2 人：两条件都满足')
  assert.equal(rescueObjective(objectiveState({ count: 2, victory: [], clues: 0, elina: 'attached' })), false,
    '艾莲娜以地点附属形态也在场（只是另一个条件不满足）')
  assert.equal(rescueObjective(objectiveState({ count: 1, victory: [], clues: 0, withLocation: false })), false,
    '艾莲娜的地点不在场时不误推进')
})

test('07061 目标：艾莲娜按「地点下方」或「地点附属」两种形态都能定位', () => {
  assert.equal(actRuleOf('07061').objective(objectiveState({ count: 1, clues: 0, elina: 'beneath' })), true)
  assert.equal(actRuleOf('07061').objective(objectiveState({ count: 1, clues: 0, elina: 'attached' })), true)
  assert.equal(actRuleOf('07061').objective(objectiveState({ count: 1, clues: 2, elina: 'attached' })), false)
})

// ---------------------------------------------------------------------------
// 7) 07061 背面事件契约 + 六种绑架犯 → resolution2..7
// ---------------------------------------------------------------------------
test('07061 背面推进发出 ticHarperRescue 事件（经真实 advanceAct → actReveal 链路）', () => {
  const state = harperFixture(2, { records: { harperSuspect: 'BrianBurnham' } })
  const stage = structuredClone(state.scenario.stageCards['07061'])
  stage.id = 'act07061'
  state.acts = [stage]
  state.actIndex = 0
  emitted.length = 0
  transaction(state, draft => advanceAct(draft, []))
  const call = emitted.find(item => item.id === 'ticHarperRescue')
  assert.ok(call, '推进 07061 必须触发营救结局事件')
  assert.equal(call.payload.actCode, '07061')
  assert.equal(call.payload.actId, 'act07061')
  assert.equal(call.payload.scenarioId, SCENARIO_ID)
  assert.equal(call.payload.kidnapper, '07078', 'payload 同时给出绑架犯卡号（内容层可直接查表）')
})

test('07061 六种绑架犯 → resolution2..7，且每个结局键在 content 剧本文本中存在', () => {
  const map = actRuleOf('07061').resolutionByKidnapper
  const resolutions = STORY_TEXT.zh.scenarios[SCENARIO_ID].resolutions
  for (const [code, key] of Object.entries(RESCUE_MAP)) {
    assert.equal(map[code], key, `${code} → ${key}`)
    assert.ok(resolutions[key], `STORY_TEXT 缺少 ${key}`)
  }
  // 内容层 handler 契约：records 里写角色名或卡号都能取回卡号再查表。
  const keyForRecord = record => RESCUE_MAP[suspectCode(record)]
  assert.equal(keyForRecord('BrianBurnham'), 'resolution2')
  assert.equal(keyForRecord('07081'), 'resolution3')
  assert.equal(keyForRecord('RobertFriendly'), 'resolution7')
})

// ---------------------------------------------------------------------------
// 8) 内容层未接线时的安全降级
// ---------------------------------------------------------------------------
test('内容层未接线（events 缺失）时 onReveal 只登记警告、不抛错也不误结算', () => {
  const behavior = contentRegistry.getBehavior(SCENARIO_ID)
  const saved = behavior.events
  delete behavior.events
  try {
    const state = harperFixture(1)
    const act60 = { id: 'act07060', code: '07060', originalCode: '07060' }
    const act61 = { id: 'act07061', code: '07061', originalCode: '07061' }
    assert.doesNotThrow(() => actRuleOf('07060').onReveal(state, act60, scenarioRuntime(state, [])))
    assert.doesNotThrow(() => actRuleOf('07061').onReveal(state, act61, scenarioRuntime(state, [])))
    assert.equal(state.resolution, null, '未接线时不得自行判定结局')
  } finally {
    behavior.events = saved
  }
})

// ---------------------------------------------------------------------------
// 9) 章节夹具就位（内容接线状态证据）
// ---------------------------------------------------------------------------
test('Harper 章节夹具就位：07060 当前幕 + 私有答案/迹象牌堆 + 结局键', () => {
  const state = harperFixture(2)
  assert.equal(codeOf(state.acts[state.actIndex]), '07060')
  const decks = state.scenarioFlags.mechanics.scenarioDecks
  assert.deepEqual(Object.keys(decks).sort(), ['harperAnswers', 'leads'])
  assert.equal(decks.harperAnswers.deck.length, 2, '真嫌疑 + 真窝点')
  assert.equal(decks.leads.deck.length, 10, '其余 5 嫌疑 + 5 窝点')
  assert.deepEqual(Object.keys(state.scenario.resolutions).sort(),
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5', 'resolution6', 'resolution7'])
})
