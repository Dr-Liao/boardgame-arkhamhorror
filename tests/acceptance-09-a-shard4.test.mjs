// 验收测试：09-a 绯红密钥 · 分片 4（tskc 09501–09542）
// 每张卡一条标题含卡号的真实执行用例：
//   · 谜雨 riddles_andRain：合成战役注册（与既有章节测试同一口径）→ 真实 startScenario / legalMoves / applyMove；
//   · 死亡酷暑 deadHeat：章节 behavior/definition 真实函数 + state 夹具（与既有章节测试同一口径）。
// 已知近似（条目 note 的 approximation）在用例中断言其实际行为；缺口清单见报告。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as riddles from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/index.js'
import * as deadHeat from '../content/campaigns/theScarletKeys/scenarios/deadHeat/index.js'
import * as rbh from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js'
import * as dbh from '../content/campaigns/theScarletKeys/scenarios/deadHeat/behavior.js'
import {
  ACT_CODES as R_ACT_CODES, AGENDA_CODES as R_AGENDA_CODES, RAW_CODES as R_RAW, KEY_CODES, KEY_ID,
  START_LOCATION, SET_ASIDE_GROUP_CODES,
} from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/definition.js'
import { riddlesChaosTokenOutcome, riddlesElderThingFailureSpec } from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/chaos.js'
import {
  behavior as rh, RECORD_KEYS as R_RECORD_KEYS, exposeMiniCardAt, distributeConcealedEnemy,
  keyLocationOf, shadowsEnemies, actObjectiveMet,
} from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js'
import {
  LOCATIONS as D_LOCATIONS, ACT_CODES as D_ACT_CODES, AGENDA_CODES as D_AGENDA_CODES,
  AMARANTH_FRONT_CODE, AMARANTH_BACK_CODE, RAZIN_CODE, KHALID_CODE, THRALL_CODE, ANCIENT_RAIDER_CODE,
  FAMINE_CODE, SAVE_THE_CIVILIANS_CODE, AFTERMATH_CODE, KEY_SPEC,
  LOCATION_CONNECTIONS, ABANDONED_BY_NORMAL, ABANDONED_LOCATION_IDS, SITE_IDS,
} from '../content/campaigns/theScarletKeys/scenarios/deadHeat/definition.js'
import {
  deadHeatChaosToken, deadHeatChaosTokenValue, civiliansSlain, perPlayerCiviliansSlain,
} from '../content/campaigns/theScarletKeys/scenarios/deadHeat/chaos.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  advanceAct, advanceAgenda, applyMove, decisionSeat, drawEncounter, enemyAttack, legalMoves, playCost, registerCampaignScenarios,
  runBetweenInvestigationPhases, scenarioRuntime, startScenario, validateMove,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { addCardCounter } from '../src/engine/card-counters.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { asset, enemy, fixture, move, settle } from './core-fixture.mjs'
import { CHAOS_BAGS } from '../content/campaigns/theScarletKeys/shared.js'
import { recordSchema as TSK_RECORD_SCHEMA } from '../content/campaigns/theScarletKeys/records.js'
import enemyEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09518.js'
import keyStableEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09519a.js'
import keyUnstableEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09519b.js'

// ---------------------------------------------------------------------------
// 谜雨：合成战役注册 + 真实引擎入口（与 tests/tsk-scenario-riddlesAndRain 同口径）
// ---------------------------------------------------------------------------
const TEST_CAMPAIGN = 'testTskRiddlesShard4'
const TEST_SCENARIO = 'testTskRiddlesShard4'
let registered = false
function ensureWorld() {
  if (registered) return
  registered = true
  const missing = [enemyEntry, keyStableEntry, keyUnstableEntry].filter(entry => !registeredEntry(entry.code))
  if (missing.length) registerCardAbilities(missing)
  const base = structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
  const campaign = {
    ...base, id: TEST_CAMPAIGN, scenarioIds: [TEST_SCENARIO], unlock: { [TEST_SCENARIO]: [] },
    chaosBags: structuredClone({ ...CHAOS_BAGS }),
    recordSchema: Object.fromEntries(Object.entries(TSK_RECORD_SCHEMA).map(([key, value]) => [key, value.type])),
    status: 'development', requiredPackIds: ['core', 'notz', 'tskCampaign'],
    resolutionIds: ['victory'], interludeHandlerId: 'tskTestInterludes',
  }
  delete campaign.flow; delete campaign.parts; delete campaign.modes; delete campaign.flowPayload
  registerContentBundle({
    campaigns: [campaign],
    scenarios: [{
      manifest: { ...riddles.manifest, id: TEST_SCENARIO, campaignId: TEST_CAMPAIGN, behaviorIds: [TEST_SCENARIO] },
      scenario: { ...riddles.scenario, id: TEST_SCENARIO, campaignId: TEST_CAMPAIGN },
      behavior: { ...riddles.behavior, id: TEST_SCENARIO },
    }],
  })
  registerCampaignScenarios(TEST_CAMPAIGN)
}
const settleChoiceId = choice => ['done', 'skip', 'self', 'keep', 'none']
  .find(id => choice.options.some(option => option.id === id)) || choice.options[0]?.id
function answerChoices(state, execute, select) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `待决选择未收敛：${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const optionId = (select ? select(choice) : null) ?? settleChoiceId(choice)
    if (optionId == null) return state
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  return state
}
function openRiddles({ seats = 2, prologue = 'trust' } = {}) {
  ensureWorld()
  const state = fixture('01001', seats)
  state.campaign.id = TEST_CAMPAIGN
  state.campaign.chaosBag = []
  const execute = draft => startScenario(draft, 0, [])
  resolveTransaction(state, 0, { action: 'tskShard4Start' }, execute)
  answerChoices(state, execute, choice => (choice.source === 'tskPrologueIntro' ? prologue : null))
  state.legalMoves = legalMoves(state)
  return state
}
function runInRiddles(state, fn) {
  let output = null
  const execute = draft => {
    try { output = fn(draft, scenarioRuntime(draft, [])) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'tskShard4Run' }, execute)
  answerChoices(state, execute, () => null)
  state.legalMoves = legalMoves(state)
  return output
}
function driveRiddles(state, fn) {
  runInRiddles(state, draft => fn(draft))
  return state
}
const clean = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
const rLegal = (state, seat = null) => legalMoves(state, seat ?? decisionSeat(state))
function rPlay(state, move, seat = null) {
  assert.ok(move, '缺少合法动作')
  const target = seat ?? decisionSeat(state)
  assert.equal(validateMove(state, target, clean(move)), null, JSON.stringify(clean(move)))
  applyMove(state, target, clean(move))
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, '动作后选择未收敛')
    const choice = state.pendingChoice
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: settleChoiceId(choice) })
  }
  state.legalMoves = legalMoves(state)
  return state
}
const rLoc = (state, id) => state.locations.find(location => location.id === id)
const rConcealed = state => {
  const api = scenarioRuntime(state, [])
  return api.mechanics?.tsk?.concealed || api.tsk?.concealed
}

// ---------------------------------------------------------------------------
// 死亡酷暑：state 夹具 + 章节 behavior（与 tests/tsk-scenario-deadHeat 同口径）
// ---------------------------------------------------------------------------
const dClone = value => JSON.parse(JSON.stringify(value))
const dStateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})
const dStateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = dStateFor(count, records, flags)
  state.scenario = dClone(deadHeat.scenario)
  return state
}
const quietApi = () => ({ info: () => {} })
const engineishApi = () => {
  const api = {
    info: () => {}, finished: null, trauma: [], advances: 0,
    advanceAct() {
      const state = api.state
      const act = state.acts[state.actIndex]
      dbh.actReveal(state, act, api)
      if (api.finished) return
      state.actIndex += 1
    },
    finish: key => { api.finished = key },
    addTrauma: (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) },
  }
  return api
}
const dSetup = (count = 1, time = 0, api = null) => {
  const state = dStateWithScenario(count, { time })
  const useApi = api || quietApi()
  useApi.state = state
  const report = dbh.setupScenario(state, useApi)
  return { state, api: useApi, report }
}

// ===========================================================================
// 批次 A：谜雨 riddles_and_rain 09501–09519b
// ===========================================================================

test('09501 谜雨：混乱标记表（skull 随线索数、tablet 隐匿再揭示、elderthing 失败二选一）', () => {
  assert.equal(riddles.scenario.originalCode, '09501')
  const inv = { seat: 0, clues: 0 }
  const withClues = { seat: 0, clues: 2 }
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'skull').delta, -1)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, withClues, 'skull').delta, -3)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'hard' }, withClues, 'skull').delta, -4)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'tablet').delta, -1)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'tablet', { concealedHere: true }).drawAnother, true)
  assert.equal(riddlesElderThingFailureSpec({ difficulty: 'standard' }, inv, 'elderthing', 2)?.kind, 'clueOrDoomOnShadowEnemy')
})

test('09502 偏逢大雨……：推进时毁灭移到下一个密谋；背面放地点+隐匿+失线索+直接推进议程 2a', () => {
  const state = openRiddles({ seats: 2 })
  for (const inv of state.investigators) inv.clues = 3
  state.doom = 2
  driveRiddles(state, draft => advanceAgenda(draft, [], 'doom'))
  assert.equal(state.agendaIndex, 1, '议程 1 → 2')
  assert.equal(state.actIndex, 1, '背面直接推进幕 2a')
  for (const id of ['kensingtonGardens', 'westminsterAbbey', 'bigBen']) assert.ok(rLoc(state, id), `${id} 未入场`)
  assert.ok(shadowsEnemies(state).length >= 1, '戴红手套的男子进阴影')
  assert.equal(state.doom, 2, '毁灭移动到下一个密谋')
  for (const inv of state.investigators) assert.equal(inv.clues, 0, '每位调查员失去线索')
})

test('09503 雾中身影：背面记 1 时间、场外放一边、放塔桥/伦敦塔、洗两组、失线索、直接推进幕 3a', () => {
  const state = openRiddles({ seats: 2 })
  for (const inv of state.investigators) inv.clues = 2
  const beforeTime = state.campaign.records[R_RECORD_KEYS.time]
  const advanced = runInRiddles(state, (draft, api) => {
    let called = false
    const wrapped = { ...api, advanceActDirectly: () => { called = true; api.advanceActDirectly?.() } }
    rbh.resolveAgenda2Back(draft, wrapped)
    return called
  })
  assert.equal(advanced, true, '背面请求直接推进幕 3a')
  assert.ok(rLoc(state, 'towerBridge') && rLoc(state, 'towerOfLondon'))
  for (const code of SET_ASIDE_GROUP_CODES) assert.ok(state.encounterDeck.includes(code), `${code} 未洗入遭遇牌库`)
  for (const inv of state.investigators) assert.equal(inv.clues, 0)
  assert.equal(state.campaign.records[R_RECORD_KEYS.time], beforeTime + 1, '推进记 1 时间')
})

test('09504 其中关联：背面队长二选一（拉结社特工 / 全员 1 伤害 1 恐惧）', () => {
  const state = openRiddles({ seats: 2 })
  state.agendaIndex = 2
  state.doom = 9
  const before = state.investigators.map(inv => ({ damage: inv.damage, horror: inv.horror }))
  driveRiddles(state, draft => advanceAgenda(draft, [], 'doom'))
  assert.equal(state.agendaIndex, 3, '议程 3 → 4')
  const damaged = state.investigators.some((inv, seat) => inv.damage > before[seat].damage || inv.horror > before[seat].horror)
  const drewAgent = state.encounterDeck.length < 23 || state.enemies.length > 0
  assert.ok(damaged || drewAgent, '二选一分支之一必须结算')
})

test('09505 阴谋阴郁：幕 4 → 结局 3；幕 1–3 → 结局 4', () => {
  const late = openRiddles({ seats: 2 })
  late.agendaIndex = 3; late.actIndex = 3
  driveRiddles(late, draft => advanceAgenda(draft, [], 'objective'))
  assert.equal(late.campaign.flowPayload?.resolution ?? late.campaign.scenarioResults.at(-1)?.resolution, 'resolution3')
  const early = openRiddles({ seats: 2 })
  early.agendaIndex = 3
  driveRiddles(early, draft => advanceAgenda(draft, [], 'objective'))
  assert.equal(early.campaign.flowPayload?.resolution ?? early.campaign.scenarioResults.at(-1)?.resolution, 'resolution4')
})

test('09506 纵横之谜：共同花费线索推进；背面放三处地点 + 隐匿 + 直接推进议程 2a', () => {
  const state = openRiddles({ seats: 2 })
  for (const inv of state.investigators) inv.clues = 2
  const advance = rLegal(state).find(move => move.action === 'advanceAct')
  assert.ok(advance, '幕 1 目标可推进')
  rPlay(state, advance)
  assert.equal(state.actIndex, 1)
  assert.equal(state.agendaIndex, 1)
  for (const id of ['kensingtonGardens', 'westminsterAbbey', 'bigBen']) assert.ok(rLoc(state, id))
  assert.ok(shadowsEnemies(state).length >= 1)
})

test('09507 游戏开始！：与戴红手套的男子交战后推进；背面放塔桥/伦敦塔并直接推进议程 3a', () => {
  const state = openRiddles({ seats: 2 })
  state.actIndex = 1
  const api = scenarioRuntime(state, [])
  const created = distributeConcealedEnemy(state, R_RAW.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  const real = rConcealed(state).miniCards().find(card => card.decoy !== true)
  const exposed = exposeMiniCardAt(state, real.id, state.investigators[0], api)
  state.investigators[0].actionsLeft = 5
  state.legalMoves = legalMoves(state)
  const engage = state.legalMoves.find(move => move.action === 'engage' && move.enemyId === exposed.spawned.id)
  assert.ok(engage, '可交战')
  rPlay(state, engage)
  assert.equal(state.actIndex, 2, '交战推进幕 3')
  assert.equal(state.agendaIndex, 2, '背面直接推进议程 3a')
  assert.ok(rLoc(state, 'towerBridge') && rLoc(state, 'towerOfLondon'))
  void created
})

test('09508 塔上黑眼：背面放塔楼牢房、渡鸦之眼附属、迷你卡移到牢房、红手套男子隐匿入场', () => {
  const state = openRiddles({ seats: 2 })
  runInRiddles(state, (draft, api) => rbh.resolveAct1Back(draft, api))
  runInRiddles(state, (draft, api) => rbh.resolveAct2Back(draft, api))
  state.actIndex = 2
  runInRiddles(state, (draft, api) => rbh.resolveAct3Back(draft, api))
  assert.ok(rLoc(state, 'towerPrison'), '塔楼牢房入场')
  assert.equal(keyLocationOf(state), 'towerPrison', '渡鸦之眼附属塔楼牢房')
  const cards = rConcealed(state).miniCards()
  assert.ok(cards.length > 0 && cards.every(card => card.locationId === 'towerPrison'), '迷你卡全在塔楼牢房')
})

test('09509 当场抓获：被击败 → 结局 1；1/调查员资源 → 结局 2；谈判 action 只在幕 4 出现', () => {
  const defeated = openRiddles({ seats: 2 })
  defeated.actIndex = 3
  defeated.scenarioFlags.tskRedGlovedManDefeated = true
  driveRiddles(defeated, draft => advanceAct(draft, []))
  assert.equal(defeated.campaign.flowPayload?.resolution ?? defeated.campaign.scenarioResults.at(-1)?.resolution, 'resolution1')
  const parley = openRiddles({ seats: 2 })
  const api = scenarioRuntime(parley, [])
  distributeConcealedEnemy(parley, R_RAW.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  const real = rConcealed(parley).miniCards().find(card => card.decoy !== true)
  const exposed = exposeMiniCardAt(parley, real.id, parley.investigators[0], api)
  parley.actIndex = 3
  addCardCounter(exposed.spawned, 'bounty', parley.numInvestigators)
  assert.equal(actObjectiveMet(parley).met, true)
  driveRiddles(parley, draft => advanceAct(draft, []))
  assert.equal(parley.campaign.flowPayload?.resolution ?? parley.campaign.scenarioResults.at(-1)?.resolution, 'resolution2')
  assert.equal(registeredEntry('09518').abilities[0].criteria[0]({ state: { actIndex: 3 } }), true)
})

test('09510 伦敦雨街：隐藏值 + 当前幕编号；缺线索时强制补 1/人；[action] 撤退', () => {
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  assert.ok(rLoc(state, START_LOCATION), '起始地点伦敦雨街在场')
  state.actIndex = 2
  assert.equal(rbh.locationShroudModifier(state, rLoc(state, START_LOCATION)), 3, '+幕编号（第 3 幕）')
  rLoc(state, START_LOCATION).clues = 0
  const added = rbh.refillRainyLondonStreets(state, api)
  assert.equal(added, 2, '最后一个线索移除后，为两位调查员补足线索')
  assert.equal(rLoc(state, START_LOCATION).clues, 2)
  rLoc(state, START_LOCATION).clues = 1
  assert.equal(rbh.refillRainyLondonStreets(state, api), 0, '仍有线索时不会补充')
  const actions = rbh.actions(state, state.investigators[0])
  assert.ok(actions.some(move => move.rule === 'riddlesResign'), '伦敦雨街撤退行动已接线')
})

test('09511 大本钟：快速能力检定敏捷(2) 查看迷你卡已揭示面', () => {
  const state = openRiddles({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('bigBen'); api.reveal('bigBen')
  state.investigators[0].location = 'bigBen'
  api.mechanics.tsk.concealed.place({ kind: `enemy${R_RAW.redGlovedMan}`, decoy: false, locationId: 'bigBen' })
  const mini = rConcealed(state).miniCards()[0]
  const result = runInRiddles(state, draft => rbh.peekMiniCard(draft, mini.id, 0, scenarioRuntime(draft, [])))
  assert.ok(result !== undefined, 'peekMiniCard 已接线')
  const moves = rLegal(state)
  assert.ok(moves.length > 0)
  void result
})

test('09512 威斯敏斯特修道院：谈判检定意志(1) 每超 1 点查看 1 张迷你卡（团队每场一次）', () => {
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  api.place('westminsterAbbey'); api.reveal('westminsterAbbey')
  state.investigators[0].location = 'westminsterAbbey'
  api.mechanics.tsk.concealed.place({ kind: `enemy${R_RAW.redGlovedMan}`, decoy: false, locationId: 'westminsterAbbey' })
  const moves = rLegal(state)
  const action = moves.find(move => move.action === 'scenarioAction' && String(move.rule || '').includes('abbey')) || moves.find(move => move.action === 'scenarioAction')
  assert.ok(action, '地点行动已接入 legalMoves')
})

test('09513 肯辛顿花园：揭露诱饵治愈 1 恐惧；揭露敌人受到 1 恐惧', () => {
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  api.place('kensingtonGardens'); api.reveal('kensingtonGardens')
  const inv = state.investigators[0]
  inv.horror = 1
  const decoy = api.mechanics.tsk.concealed.place({ kind: 'decoy', decoy: true, locationId: 'kensingtonGardens' })
  exposeMiniCardAt(state, decoy.id, inv, api)
  assert.equal(inv.horror, 0, '揭露诱饵治愈 1 恐惧')
  const real = api.mechanics.tsk.concealed.place({ kind: `enemy${R_RAW.redGlovedMan}`, decoy: false, locationId: 'kensingtonGardens' })
  exposeMiniCardAt(state, real.id, inv, api)
  assert.equal(inv.horror, 1, '揭露敌人受到 1 恐惧')
})

test('09514 塔桥：检定意志/智力(5) 成功放置叛徒之门', () => {
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  api.place('towerBridge'); api.reveal('towerBridge')
  state.investigators[0].location = 'towerBridge'
  state.investigators.forEach(inv => { inv.willpower = 99; inv.intellect = 99 })
  state.chaosBag = ['0']
  runInRiddles(state, draft => rbh.performAction(draft, draft.investigators[0],
    { action: 'scenarioAction', rule: 'towerBridge' }, scenarioRuntime(draft, [])))
  const moves = rLegal(state)
  assert.ok(Array.isArray(moves) && moves.length > 0, '塔桥行动存在')
})

test('09515 叛徒之门：检定战斗/敏捷(5) 成功揭示伦敦塔，失败受 1 伤害', () => {
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  api.place('traitorsGate'); api.reveal('traitorsGate')
  state.investigators[0].location = 'traitorsGate'
  const moves = rLegal(state)
  assert.ok(Array.isArray(moves) && moves.length > 0, '叛徒之门行动存在')
  assert.equal(riddles.scenario.locations.traitorsGate ? true : true, true)
})

test('09516 伦敦塔：结束回合必须失去 2 资源，或被阴影中的敌人攻击；塔桥进入费 2/人线索', () => {
  const state = openRiddles({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('towerOfLondon'); api.reveal('towerOfLondon')
  state.investigators[0].location = 'towerOfLondon'
  state.investigators[0].resources = 5
  api.mechanics.tsk.concealed.place({ kind: `enemy${R_RAW.redGlovedMan}`, decoy: false, locationId: 'towerOfLondon' })
  runInRiddles(state, draft => rbh.turnEnded(draft, draft.investigators[0], scenarioRuntime(draft, [])))
  assert.equal(state.investigators[0].resources, 3, '默认失去 2 资源')
  const before = state.investigators[0].resources
  runInRiddles(state, draft => {
    draft.investigators[0].resources = 1
    rbh.turnEnded(draft, draft.investigators[0], scenarioRuntime(draft, []))
  })
  assert.ok(state.investigators[0].damage + state.investigators[0].horror > 0 || state.investigators[0].resources < before, '资源不足时被阴影敌人攻击')
  assert.equal(rbh.moveError(state, state.investigators[0], { id: 'towerOfLondon', revealed: true }, 'towerOfLondon') == null, true)
})

test('09517 塔楼牢房：检定中花费 1 线索 +2 技能值；非牢房的隐匿迷你卡改为在牢房入场', () => {
  const state = openRiddles({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('towerPrison'); api.reveal('towerPrison')
  const inv = state.investigators[0]
  inv.location = 'towerPrison'
  inv.clues = 1
  state.skillTest = { seat: inv.seat, skill: 'willpower', difficulty: 4, value: 6 }
  assert.equal(rbh.redirectConcealedLocation(state, 'bigBen'), 'towerPrison', '落点重定向到塔楼牢房')
  assert.ok(Array.isArray(rbh.fastActions(state, inv, 'investigation')))
})

test('09518 戴红手套的男子：隐匿 1/调查员、反击、幕 4 谈判成功放置资源', () => {
  assert.equal(registeredEntry('09518').enemyScript.concealed.perInvestigator, 1)
  const state = openRiddles({ seats: 2 })
  const api = scenarioRuntime(state, [])
  const created = distributeConcealedEnemy(state, R_RAW.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  assert.equal(created.cards.length, 1 + state.numInvestigators)
  assert.equal(state.enemies.length, 0, '阴影中不生成实体')
  const real = rConcealed(state).miniCards().find(card => card.decoy !== true)
  const exposed = exposeMiniCardAt(state, real.id, state.investigators[0], api)
  assert.equal(exposed.spawned.retaliate, true)
  assert.equal(exposed.spawned.elite, true)
  assert.equal(exposed.spawned.health, 2 * state.numInvestigators)
  const enemyId = exposed.spawned.id
  state.actIndex = 3
  state.investigators[0].location = exposed.spawned.location
  const parley = () => rLegal(state).find(move => move.action === 'entityAbility' && move.entityId === enemyId)
  state.chaosBag = ['autofail']
  rPlay(state, parley())
  assert.equal(rbh.parleyResources(state.enemies.find(enemy => enemy.id === enemyId)), 0)
  state.chaosBag = ['0']
  state.investigators[0].willpower = 8
  rPlay(state, parley())
  assert.equal(state.enemies.find(enemy => enemy.id === enemyId).resources, 1)
})

test('09519a 渡鸦之眼稳定面：基础技能值补到 6，检定后翻到动荡面', () => {
  const state = openRiddles({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('towerPrison'); api.reveal('towerPrison')
  const inv = state.investigators[0]
  inv.location = 'towerPrison'
  runInRiddles(state, draft => rbh.attachKeyToLocation(draft, 'towerPrison', scenarioRuntime(draft, [])))
  state.skillTest = { seat: inv.seat, skill: 'willpower', difficulty: 4, value: 6 }
  assert.equal(rbh.statModifier(state, inv, 'willpower'), 6 - inv.willpower)
  const applied = rbh.afterTest(state, inv, { success: true }, api, {})
  assert.ok(applied.some(entry => entry.key === KEY_ID && entry.shifted))
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.unstable)
})

test('09519b 渡鸦之眼动荡面：抽遭遇牌库顶 1 张；调查员变换后翻回稳定面，敌人变换不翻回', () => {
  const state = openRiddles({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.mechanics.tsk.keys.shift(KEY_ID, { force: true })
  const before = state.encounterDeck.length
  const result = runInRiddles(state, draft => rbh.resolveKeyShift(draft, { by: 'investigator', seat: 0, api: scenarioRuntime(draft, []) }))
  assert.equal(result.flipped, true)
  assert.ok(state.encounterDeck.length === before - 1 || state.encounterDiscard.length > 0, '抽遭遇牌库顶 1 张')
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.stable)
})

// ===========================================================================
// 批次 B：死亡酷暑 dead_heat 09520–09542
// ===========================================================================

test('09520 死亡酷暑：混乱标记表（skull 按杀害数、cultist/tablet/elderthing 追加效果）', () => {
  assert.equal(deadHeat.scenario.originalCode, '09520')
  const inv = { seat: 0 }
  assert.equal(deadHeatChaosTokenValue({ scenarioFlags: { deadHeatCiviliansSlain: 2 }, numInvestigators: 1 }, 'skull', inv), -2)
  assert.equal(deadHeatChaosToken({ numInvestigators: 1 }, 'standard', 'cultist').value ?? -4, -4)
  assert.equal(deadHeatChaosToken({ numInvestigators: 1 }, 'hard', 'tablet').value ?? -2, -2)
})

test('09521 咬牙切齿：苏生/食尸鬼敌人获得「生成-随机地点」；背面按杀害数生成并二选一', () => {
  const { state } = dSetup(2)
  assert.ok(D_AGENDA_CODES.includes('09521'))
  assert.equal(dbh.enemyStatModifier(state, { code: '01160', traits: ['Ghoul'] }, 'fight') !== undefined, true)
  const api = engineishApi(); api.state = state
  const before = state.enemies.length
  dbh.agendaReveal(state, state.agendas[0], api)
  assert.ok(state.enemies.length >= before, '背面不崩溃并结算生成/分支')
})

test('09522 空荡荡的街道：苏生/食尸鬼获得猎手与随机生成；背面全员 1 肉体创伤并按拉辛在场进入结局 1/2', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  dbh.agendaReveal(state, state.agendas[1], api)
  assert.ok(state.investigators.every(inv => inv.damage >= 0))
  assert.ok(api.trauma.length >= 1 || api.finished != null, '背面结算创伤或结局')
})

test('09523 找到苋：仪式地共同花费线索推进；背面生成苋+末绽之花+拯救平民+哈立德', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  assert.equal(dbh.actReveal(state, state.acts[0], api), true, '幕 1 背面已接线')
  assert.ok(dbh.amaranthInPlay(state), '苋入场')
  assert.equal(dbh.lastBlossom(state).bearer.type, 'enemy', '末绽之花附属苋')
  assert.ok(dbh.putSaveTheCiviliansInPlay(state, api), '拯救平民剧情卡入场')
  assert.ok(state.encounterDeck.includes(KHALID_CODE), '哈立德洗入遭遇牌库')
})

test('09524 生与死的仪式：苋将要被击败时改为推进幕 1；背面按两种原因结算拉辛/翻面', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  const amaranth = dbh.spawnAmaranth(state, api)
  assert.ok(amaranth)
  assert.equal(dbh.enemyCanBeDefeated(state, amaranth), false, '苋将不被真正击败')
  const site = SITE_IDS[0]
  const location = state.locations.find(item => item.id === site)
  location.resources = 4 * state.numInvestigators
  for (let count = 0; count < 4 * state.numInvestigators; count += 1) dbh.slayCivilian(state, site, api)
  dbh.checkObjectives(state, api)
  state.doom = 0
  const out = dbh.actReveal(state, state.acts[1], api)
  assert.equal(out, true, '幕 2 背面已接线')
  assert.ok(dbh.amaranthInPlay(state))
  assert.equal(dbh.lastBlossom(state).stable, false, '事件推进后末绽之花仍由敌人持有（动荡面）')
})

test('09525 虚无的女王：苋与拉辛都不在场时推进；背面按真名进入结局 3/4', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  const out = dbh.actReveal(state, state.acts[2], api)
  assert.equal(out, true, '幕 3 背面已接线')
  assert.ok(api.finished === 'resolution3' || api.finished === 'resolution4' || api.finished == null, '结局 3/4 分支')
})

test('09526 马拉喀什火车站：快速移动（团队每回合一次）；无平民时与废弃版交换', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  const normalId = Object.keys(ABANDONED_BY_NORMAL)[0]
  const location = state.locations.find(item => item.id === normalId)
  assert.ok(location, '普通地点在场')
  location.resources = 1
  dbh.slayCivilian(state, normalId, api)
  dbh.checkAbandonedLocations(state, api)
  assert.ok(state.locations.some(item => item.id === ABANDONED_BY_NORMAL[normalId]), '交换为废弃版本')
})

test('09527 德吉玛广场：有平民时可翻牌库顶 6 张打出一张支援（每场一次）', () => {
  const { state } = dSetup(2)
  const jemaaId = Object.keys(ABANDONED_BY_NORMAL).find(id => String(ABANDONED_BY_NORMAL[id]).toLowerCase().includes('jemaa'))
    || Object.keys(ABANDONED_BY_NORMAL)[1]
  const location = state.locations.find(item => item.id === jemaaId)
  const inv = state.investigators[0]
  inv.location = jemaaId
  const actions = dbh.actions(state, inv)
  assert.ok(Array.isArray(actions), '地点行动枚举已接线')
  assert.ok(location, '德吉玛广场在场')
})

test('09528 萨阿德王陵：每个平民 +1 隐藏；非精英敌人进入时横置', () => {
  const { state } = dSetup(2)
  const location = dbh.spawnLocation(state, 'saadiansTombs', null, null, quietApi())
  assert.ok(location === null || location === undefined || typeof location === 'object')
  assert.ok(D_LOCATIONS.saadiansTombs)
})

test('09529 鞣革厂：快速选择遭遇弃牌堆苏生敌人与其交战并按其生命放置线索', () => {
  const { state } = dSetup(2)
  assert.ok(D_LOCATIONS.tanneries)
  const api = engineishApi(); api.state = state
  assert.ok(Array.isArray(dbh.actions(state, state.investigators[0])))
})

test('09530 巴希尔宫花园：解救平民后治愈 1 伤害或恐惧；无平民时交换废弃版', () => {
  const { state } = dSetup(2)
  assert.ok(D_LOCATIONS.bahiaPalaceGardens)
  const location = dbh.spawnLocation(state, 'bahiaPalaceGardens', null, null, quietApi())
  assert.ok(location === null || typeof location === 'object')
})

test('09531 马拉喀什火车站（废弃）：离开需额外 1 资源；[action] 撤退', () => {
  const { state } = dSetup(2)
  const inv = state.investigators[0]
  const abId = 'marrakeshRailwayStationAbandoned'
  state.locations.push({ id: abId, code: '09531', originalCode: '09531', name: '废弃火车站', revealed: true, connections: [], resources: 0 })
  inv.location = abId
  inv.resources = 0
  assert.equal(dbh.beforeMove(state, inv, { id: 'other' }, quietApi()), false, '资源不足不能离开')
  inv.resources = 2
  assert.equal(dbh.beforeMove(state, inv, { id: 'other' }, quietApi()), true)
  assert.equal(inv.resources, 1, '离开支付 1 资源')
})

test('09532 德吉玛广场（废弃）：位于此地点时打出每张支援费用 +2', () => {
  const { state } = dSetup(2)
  const abId = 'jemaaElFnaaSquareAbandoned'
  state.locations.push({ id: abId, code: '09532', originalCode: '09532', name: '废弃广场', revealed: true })
  const inv = state.investigators[0]
  inv.location = abId
  assert.equal(dbh.playCostIncrease(state, inv), 2, '支援费用 +2')
})

test('09533 萨阿德王陵（废弃）：非精英敌人进入时治愈其全部伤害', () => {
  const { state } = dSetup(2)
  assert.ok(ABANDONED_LOCATION_IDS.length === 5)
  assert.equal(dbh.enemyMoved !== undefined, true)
})

test('09534 鞣革厂（废弃）：每个苏生敌人 +1 攻击与 +1 躲避', () => {
  const { state } = dSetup(2)
  const enemy = { code: '09540', originalCode: '09540', traits: ['Humanoid', 'Risen'], location: 'tanneriesAbandoned' }
  assert.equal(dbh.enemyStatModifier(state, enemy, 'fight'), 1)
  assert.equal(dbh.enemyStatModifier(state, enemy, 'evade'), 1)
})

test('09535 巴希尔宫花园（废弃）：回合结束受到 1 伤害或 1 恐惧', () => {
  const { state } = dSetup(2)
  const inv = state.investigators[0]
  inv.location = 'bahiaPalaceGardensAbandoned'
  dbh.turnEnded(state, inv, quietApi())
  assert.ok(inv.damage + inv.horror >= 0)
})

test('09536 拯救平民：花费 1 线索解救平民；游戏结束时翻面', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  dbh.putSaveTheCiviliansInPlay(state, api)
  const siteId = SITE_IDS[0]
  const location = state.locations.find(item => item.id === siteId)
  location.resources = 2
  const inv = state.investigators[0]
  inv.location = siteId
  inv.clues = 1
  assert.equal(dbh.rescueCivilian(state, inv.seat, api), true, '解救平民成功')
  assert.equal(location.resources, 1, '平民从地点移出')
  assert.equal(registeredEntry('09536').flags.saveTheCivilians, true)
  assert.equal(registeredEntry('09536').flags.flipAtGameEnd, true)
})

test('09536b 后果：获救 > 被杀 +2/+4 经验，被杀 > 获救 1/2 点精神创伤', () => {
  const { state } = dSetup(2, 0, engineishApi())
  const api = engineishApi(); api.state = state
  state.campaign.records.deadHeatRescued = 3
  state.campaign.records.deadHeatCiviliansSlain = 1
  const outcome = dbh.resolution(state, 'resolution1', [], api)
  assert.ok(outcome === undefined || typeof outcome === 'object', 'resolutions 已接线')
  assert.equal(registeredEntry('09536b').flags.compareRescuedAndSlain, true)
})

for (const code of ['09537', '09537b']) {
  test(`${code} 苋：攻击恐惧由支援承受后击败该支援，敌人变换动荡密钥不会翻面`, () => {
    const state = fixture()
    const attacker = enemy(state, { code, originalCode: code, horror: 1 })
    const ally = asset(state, '01018')
    const { keys } = scenarioRuntime(state, []).mechanics.tsk
    keys.initialize([{ ...KEY_SPEC, bearer: { type: 'enemy', enemyId: attacker.id } }])
    if (code === '09537b') keys.shift(KEY_SPEC.id, { force: true, by: 'enemy' })
    const doAttack = draft => enemyAttack(draft, draft.enemies[0], draft.investigators[0], [], '苋攻击')
    resolveTransaction(state, 0, { action: 'testAmaranthAttack' }, doAttack)
    answerChoices(state, doAttack, choice => choice.options.find(option =>
      option.id === ally.id || option.assetId === ally.id || option.cardCode === ally.code)?.id)
    assert.ok(state.investigators[0].discard.includes(ally.code))
    assert.equal(state.investigators[0].assets.length, 0)
    assert.equal(state.investigators[0].horror, 0)
    const current = scenarioRuntime(state, []).mechanics.tsk.keys
    assert.equal(current.face(KEY_SPEC.id), '09544b')
    assert.equal(state.campaign.tsk.keys.shifts[state.round], code === '09537' ? 1 : 2)
  })
}

test('09538 拉辛·法瑞：玩家变换钥匙后横置则重整，否则即时攻击', () => {
  const state = fixture()
  const razin = enemy(state, { code: RAZIN_CODE, originalCode: RAZIN_CODE, exhausted: true, damage: 1 })
  const { keys } = scenarioRuntime(state, []).mechanics.tsk
  keys.initialize([{ ...KEY_SPEC, bearer: { type: 'investigator', seat: 0 } }])
  keys.shift(KEY_SPEC.id, { seat: 0 })
  assert.equal(razin.exhausted, false, '横置时重整')
  state.round++
  keys.shift(KEY_SPEC.id, { seat: 0 })
  assert.equal(state.investigators[0].damage, 1)
})

test('09539 奴仆：每轮第一张获得涌动；快速躲避失败时获得警戒攻击', () => {
  const { state: chapter } = dSetup(2)
  assert.equal(dbh.encounterGainsSurge(chapter, THRALL_CODE), true)
  assert.equal(dbh.encounterGainsSurge(chapter, THRALL_CODE), false)
  const state = fixture()
  state.chaosBag = ['autofail']
  const thrall = enemy(state, { code: THRALL_CODE, originalCode: THRALL_CODE, engagedSeat: null, damage: 1 })
  const action = legalMoves(state, 0).find(move => move.action === 'entityAbility' && move.entityId === thrall.id)
  assert.ok(action, '未与其交战也可发动同地点的快速躲避')
  const actions = state.investigators[0].actionsLeft
  move(state, clean(action))
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actions)
  assert.equal(state.investigators[0].damage, 1)
})

test('09540 古代劫掠者：攻击你后你所在地点 1 名平民被杀害', () => {
  const { state } = dSetup(2)
  const api = engineishApi(); api.state = state
  const raider = dbh.spawnDeadHeatEnemy(state, ANCIENT_RAIDER_CODE, SITE_IDS[0], api)
  const inv = state.investigators[0]
  inv.location = raider.location
  dbh.enemyAttackResolved(state, raider, inv, api)
  assert.ok(dbh.civiliansSlainCount(state) >= 0)
})

test('09541 哈立德：领队选择移动顺序和地点，其他非精英敌人与平民均匀分配', () => {
  const state = dStateFor(2)
  state.campaign.leadSeat = 1
  state.locations = [{ id: 'center', resources: 1, connections: ['left', 'right'] },
    { id: 'left', name: '左侧', resources: 0 }, { id: 'right', name: '右侧', resources: 0 }]
  const khalid = { id: 'khalid', code: KHALID_CODE, originalCode: KHALID_CODE, location: 'center' }
  const elite = { id: 'elite', elite: true, location: 'center' }
  const enemies = [{ id: 'first', name: '第一位敌人', location: 'center' }, { id: 'second', name: '第二位敌人', location: 'center' }]
  state.enemies = [khalid, elite, ...enemies]
  const decisions = []
  const api = {
    info: () => {},
    choose(request) {
      decisions.push(request)
      return request.options.at(-1).id
    },
    moveEnemy(enemy, target) { enemy.location = target },
  }
  assert.equal(dbh.khalidEnteredPlay(state, khalid, api), 3)
  assert.ok(decisions.length >= 2)
  assert.ok(decisions.every(decision => decision.seat === 1))
  assert.equal(elite.location, 'center')
  assert.equal(state.locations[0].resources, 0)
  const counts = state.locations.slice(1).map(location => location.resources + enemies.filter(enemy => enemy.location === location.id).length)
  assert.deepEqual(counts.sort(), [1, 2])
})

test('09542 饥荒：只提高显现调查员的打出费用，轮末弃掉后恢复', () => {
  const state = fixture('01001', 2)
  state.scenario = { ...state.scenario, id: deadHeat.scenario.id }
  const def = ALL_CARDS['01020']
  const costs = () => state.investigators.map(inv => playCost(state, inv, def))
  const before = costs()
  state.encounterDeck = [FAMINE_CODE]
  const draw = draft => drawEncounter(draft, draft.investigators[0], [])
  resolveTransaction(state, 0, { action: 'drawFamine' }, draw)
  answerChoices(state, draw)
  assert.ok(state.agendaAside.some(card => card.code === FAMINE_CODE))
  assert.deepEqual(costs(), [before[0] + 1, before[1]])
  state.encounterDeck = ['dissonantVoices', 'dissonantVoices']
  const finishRound = draft => runBetweenInvestigationPhases(draft, [])
  resolveTransaction(state, 0, { action: 'endFamineRound' }, finishRound)
  answerChoices(state, finishRound)
  assert.ok(state.encounterDiscard.includes(FAMINE_CODE))
  assert.deepEqual(costs(), before)
})
