// 谜雨（riddlesAndRain · 09501）· 章节测试（P7）。
//
// 证据分三层：
//   1. 章节数据/剧情：manifest / identities / 地点连接 / 幕议程印刷数值 / story-access 正文；
//   2. 真实引擎路径：用合成战役把本章注册进 contentRegistry → startScenario 走真实设置
//      （preScenarioSetup 的序幕选择、地点布置、遭遇牌库、密钥、TSK 扩展容器）；
//      幕/议程背面用 engine.advanceAct / advanceAgenda 驱动，剧本行动走 legalMoves + applyMove；
//   3. 原语/记录：隐匿迷你卡、渡鸦之眼 Shift、混乱标记、时间/结局记录与 JSON 存档往返。
//
// 口径：不注册任何伪造内容——合成战役只把本章数据换 id 后注册（与 TDE/TIC 开发态章节测试同构），
// 引擎、原语、存档迁移全部用生产实现。
import test from 'node:test'
import assert from 'node:assert/strict'

import * as chapter from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/index.js'
import {
  ACT_CODES, AGENDA_CODES, ENCOUNTER_DECK, KEY_CODES, KEY_ID, LOCATIONS,
  LOCATION_CONNECTIONS, LOCATION_COORDINATES, RAW_CODES, SCENARIO_TEXT, SET_ASIDE_ALIASES,
  SET_ASIDE_GROUP_CODES, SET_ASIDE_LOCATION_IDS, START_LOCATION,
} from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/definition.js'
import {
  FLAG_KEYS, RECORD_KEYS, actObjectiveMet, behavior, distributeConcealedEnemy, exposeMiniCardAt, keyLocationOf,
  markTime, shadowsEnemies, timePassed,
} from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js'
import { riddlesChaosTokenOutcome, riddlesElderThingFailureSpec } from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/chaos.js'
import { CHAOS_BAGS } from '../content/campaigns/theScarletKeys/shared.js'
import { recordSchema as TSK_RECORD_SCHEMA } from '../content/campaigns/theScarletKeys/records.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  advanceAct, advanceAgenda, applyMove, decisionSeat, legalMoves, registerCampaignScenarios,
  scenarioRuntime, startScenario, validateMove,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { addCardCounter, cardCounterOf } from '../src/engine/card-counters.js'
import { fixture } from './core-fixture.mjs'
import enemyEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09518.js'
import keyStableEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09519a.js'
import keyUnstableEntry from '../src/cards/encounter-entries/theScarletKeys/riddlesAndRain/09519b.js'

// ---------------------------------------------------------------------------
// 合成战役注册（章节 status 仍是 development，不进生产组合根）
// ---------------------------------------------------------------------------
const TEST_CAMPAIGN = 'testTskRiddlesAndRain'
const TEST_SCENARIO = 'testTskRiddlesAndRain'
let registered = false

function ensureWorld() {
  if (registered) return
  registered = true
  // 主进程会重建非玩家索引；索引尚未包含本章条目时在进程内注册一次（已注册则跳过）。
  const missing = [enemyEntry, keyStableEntry, keyUnstableEntry].filter(entry => !registeredEntry(entry.code))
  if (missing.length) registerCardAbilities(missing)
  const base = structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
  const campaign = {
    ...base,
    id: TEST_CAMPAIGN,
    scenarioIds: [TEST_SCENARIO],
    unlock: { [TEST_SCENARIO]: [] },
    chaosBags: structuredClone({ ...CHAOS_BAGS }),
    // 与生产战役清单同源：records.js 的 recordSchema（time/keysHeld/chaptersCompleted …）。
    recordSchema: Object.fromEntries(Object.entries(TSK_RECORD_SCHEMA).map(([key, value]) => [key, value.type])),
    status: 'development',
    requiredPackIds: ['core', 'notz', 'tskCampaign'],
    resolutionIds: ['victory'],
    interludeHandlerId: 'tskTestInterludes',
  }
  delete campaign.flow
  delete campaign.parts
  delete campaign.modes
  delete campaign.flowPayload
  const scenarioData = { ...chapter.scenario, id: TEST_SCENARIO, campaignId: TEST_CAMPAIGN }
  const manifest = {
    ...chapter.manifest, id: TEST_SCENARIO, campaignId: TEST_CAMPAIGN, behaviorIds: [TEST_SCENARIO],
  }
  registerContentBundle({
    campaigns: [campaign],
    scenarios: [{ manifest, scenario: scenarioData, behavior: { ...chapter.behavior, id: TEST_SCENARIO } }],
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

/** 打开本章（真实 startScenario 路径）；prologue 预写记录键可跳过序幕询问。 */
function openScenario({ seats = 2, prologue = 'trust', stats = null, bag = null } = {}) {
  ensureWorld()
  const state = fixture('01001', seats)
  state.campaign.id = TEST_CAMPAIGN
  // 夹具来自 NotZ 建局：清空继承的混乱袋，让 startScenario 用本章战役清单的四档袋重建。
  state.campaign.chaosBag = []
  const execute = draft => startScenario(draft, 0, [])
  resolveTransaction(state, 0, { action: 'tskTestStart' }, execute)
  answerChoices(state, execute, choice => (choice.source === 'tskPrologueIntro'
    ? prologue || 'trust' : null))
  if (stats) for (const inv of state.investigators) Object.assign(inv, stats)
  if (bag) state.chaosBag = [...bag]
  state.legalMoves = legalMoves(state)
  return state
}

/** 在一个真实事务里跑章节函数（返回结果）。ScenarioEnded 视为合法收束（结局写入已完成）。 */
function runInTransaction(state, fn) {
  let output = null
  const execute = draft => {
    try { output = fn(draft, scenarioRuntime(draft, [])) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'tskTestRun' }, execute)
  answerChoices(state, execute, () => null)
  state.legalMoves = legalMoves(state)
  return output
}

/** 用引擎函数驱动一次事务（advanceAct / advanceAgenda 等）。 */
function driveEngine(state, fn) {
  const execute = draft => {
    try { fn(draft) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'tskTestEngine' }, execute)
  answerChoices(state, execute, () => null)
  state.legalMoves = legalMoves(state)
  return state
}

const clean = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
const legalFor = (state, seat = null) => legalMoves(state, seat ?? decisionSeat(state))
const findMove = (state, predicate, seat = null) => legalFor(state, seat).find(predicate)
const locationOf = (state, id) => state.locations.find(location => location.id === id)
const totalClues = state => state.investigators.reduce((sum, inv) => sum + (inv.clues || 0), 0)
const concealedOf = state => {
  const api = scenarioRuntime(state, [])
  return api.mechanics?.tsk?.concealed || api.tsk?.concealed
    || { miniCards: () => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || [] }
}

function playMove(state, move, seat = null) {
  assert.ok(move, '缺少合法动作')
  const target = seat ?? decisionSeat(state)
  assert.equal(validateMove(state, target, clean(move)), null, JSON.stringify(clean(move)))
  applyMove(state, target, clean(move))
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `动作后待决选择未收敛：${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: settleChoiceId(choice) })
  }
  state.legalMoves = legalMoves(state)
  return state
}

// ---------------------------------------------------------------------------
// 1. 清单 / 身份 / 剧情
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 谜雨章节清单：playable + 09501 + 8 地点 + 4 幕 4 议程 + gather 组与机制', () => {
  assert.equal(chapter.manifest.id, 'riddlesAndRain')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '09501')
  assert.equal(chapter.manifest.locations.length, 8)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3', 'agenda4'])
  assert.deepEqual(chapter.manifest.resolutionIds.sort(),
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(chapter.manifest.startLocationId, START_LOCATION)
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'notz', 'tskCampaign'])
  // 只声明本战役 26 个遭遇组（chillingCold/lockedDoors/arkham 属核心/外部组，由所需卡包声明）。
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds].sort(), [
    'crimsonConspiracy', 'darkVeiling', 'outsiders',
    'riddlesAndRain', 'shadowOfADoubt', 'strangeHappenings',
  ])
  for (const mechanic of ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskCoterie', 'tskMap']) {
    assert.ok(chapter.manifest.requiredMechanicIds.includes(mechanic), `缺少机制 ${mechanic}`)
  }
  for (const key of Object.values(RECORD_KEYS)) assert.ok(chapter.manifest.recordWrites.includes(key), `缺记录写入 ${key}`)
  assert.equal(chapter.scenario.textLanguage, 'zh-CN')
})

test('P7 riddlesAndRain 谜雨剧情正文：setup/trackingTime/四个结局正文已接入 definition', () => {
  assert.ok(SCENARIO_TEXT.setup.length > 0, 'setup 正文为空')
  assert.ok(SCENARIO_TEXT.trackingTime.length > 0, 'Tracking Time 正文为空')
  for (const key of ['resolution1', 'resolution2', 'resolution3', 'resolution4']) {
    assert.ok(SCENARIO_TEXT.resolutions[key].length > 0, `${key} 正文为空`)
  }
  assert.match(SCENARIO_TEXT.resolutions.resolution1, /渡鸦之眼|Eye of Ravens/)
  assert.ok(chapter.scenario.intro.length > 0, 'intro 为空')
})

test('P7 riddlesAndRain 谜雨身份登记：8 地点 + 4 幕 + 4 议程 + 敌人都有印刷原卡号', () => {
  for (const category of ['locations', 'acts', 'agendas']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
    }
  }
  assert.equal(chapter.identities.locations.rainyLondonStreets.originalCode, '09510')
  assert.equal(chapter.identities.locations.towerPrison.originalCode, '09517')
  assert.equal(chapter.identities.acts.act1.originalCode, '09506')
  assert.equal(chapter.identities.agendas.agenda4.originalCode, '09505')
  assert.equal(chapter.identities.enemies['09518'].originalCode, '09518')
})

// ---------------------------------------------------------------------------
// 2. 地点布局与连接
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 伦敦街道布局：8 地点都有坐标、连接双向对称且整图连通', () => {
  for (const [id, data] of Object.entries(LOCATIONS)) {
    assert.ok(LOCATION_COORDINATES[id], `${id} 缺坐标`)
    assert.ok(Number.isFinite(LOCATION_COORDINATES[id].x) && Number.isFinite(LOCATION_COORDINATES[id].y), `${id} 坐标非数值`)
    assert.ok(data.shroud > 0, `${id} 帷幕取印刷值`)
    assert.ok(data.cluesPerInvestigator > 0, `${id} 线索取印刷值`)
    assert.deepEqual([...data.connections].sort(), [...LOCATION_CONNECTIONS[id]].sort())
  }
  for (const [from, targets] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const to of targets) assert.ok(LOCATION_CONNECTIONS[to]?.includes(from), `${from} → ${to} 不是双向连接`)
  }
  const seen = new Set([START_LOCATION])
  const queue = [START_LOCATION]
  while (queue.length) {
    const id = queue.shift()
    for (const next of LOCATION_CONNECTIONS[id]) if (!seen.has(next)) { seen.add(next); queue.push(next) }
  }
  assert.equal(seen.size, Object.keys(LOCATIONS).length, `连接图不连通：${[...seen].join(',')}`)
  for (const edge of chapter.layout.edges) {
    assert.ok(LOCATION_CONNECTIONS[edge.from]?.includes(edge.to), `展示连线 ${edge.from}>${edge.to} 不是规则连接`)
  }
})

// ---------------------------------------------------------------------------
// 3. 设置（真实 startScenario）
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 真实设置：只放伦敦雨街、其余地点放一边、遭遇牌库 23 张、密钥与 TSK 容器就绪', () => {
  const state = openScenario({ seats: 2, prologue: 'trust' })
  assert.equal(state.scenario.id, TEST_SCENARIO)
  assert.deepEqual(state.locations.map(location => location.id), [START_LOCATION])
  const start = locationOf(state, START_LOCATION)
  assert.equal(start.revealed, true, '起始地点应入场即揭示')
  assert.equal(start.clues, 2 * 2, '伦敦雨街 2 线索/调查员 × 2')
  assert.equal(start.shroud, 1, '印刷帷幕 1（+X 由 behavior 读点提供）')
  for (const inv of state.investigators) assert.equal(inv.location, START_LOCATION)

  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length)
  assert.deepEqual([...state.encounterDeck].sort(), [...ENCOUNTER_DECK].sort(), '初始遭遇牌库应与定义一致')
  const aside = state.scenarioZones.setAside
  for (const id of SET_ASIDE_LOCATION_IDS) assert.ok(aside.includes(LOCATIONS[id].originalCode), `放一边缺地点 ${id}`)
  assert.ok(aside.includes(RAW_CODES.redGlovedMan), '戴红手套的男子应放一边')
  assert.ok(aside.includes(KEY_CODES.stable), '渡鸦之眼应放一边')
  for (const code of SET_ASIDE_GROUP_CODES) assert.ok(aside.includes(code), `放一边缺 ${code}`)
  assert.equal(aside.length, SET_ASIDE_LOCATION_IDS.length + SET_ASIDE_ALIASES.length)

  const keys = state.campaign.tsk?.keys?.keys
  assert.ok(keys?.[KEY_ID], '渡鸦之眼未初始化')
  assert.equal(keys[KEY_ID].stable, true)
  assert.equal(keys[KEY_ID].stableFace, KEY_CODES.stable)
  assert.equal(keys[KEY_ID].unstableFace, KEY_CODES.unstable)
  assert.deepEqual(keys[KEY_ID].bearer, { type: 'none' })

  assert.equal(state.scenarioFlags.mechanics.tsk.version, 1, 'TSK 场景扩展容器（空洞/隐匿宿主）')
  assert.equal(state.scenarioFlags[FLAG_KEYS.prologueIntent], 'trust')
  assert.equal(state.campaign.records[RECORD_KEYS.time], 1)
  const baseBag = CHAOS_BAGS.standard
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length,
    baseBag.filter(token => token === 'tablet').length + 1)
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length,
    baseBag.filter(token => token === 'elderthing').length - 1)
})

test('P7 riddlesAndRain 序幕分支：自行前往伦敦（Intro 7）删 [tablet] 加 [elder_thing] 并记 2 时间', () => {
  const state = openScenario({ seats: 1, prologue: 'deception' })
  assert.equal(state.scenarioFlags[FLAG_KEYS.prologueIntent], 'deception')
  assert.equal(state.campaign.records[RECORD_KEYS.time], 2)
  const baseBag = CHAOS_BAGS.standard
  const count = token => state.chaosBag.filter(item => item === token).length
  assert.equal(count('tablet'), baseBag.filter(item => item === 'tablet').length - 1)
  assert.equal(count('elderthing'), baseBag.filter(item => item === 'elderthing').length + 1)
  assert.equal(state.chaosBag.length, baseBag.length)
})

test('P7 riddlesAndRain 设置分区守恒：遭遇牌库 + 放一边互不重叠，份数不超过印刷张数', () => {
  const state = openScenario({ seats: 2 })
  const aside = state.scenarioZones.setAside
  assert.deepEqual(state.encounterDeck.filter(code => aside.includes(code)), [])
  const counts = new Map()
  for (const code of [...state.encounterDeck, ...aside]) counts.set(code, (counts.get(code) || 0) + 1)
  for (const [code, count] of counts) {
    assert.ok(count <= (ALL_CARDS[code]?.quantity || 1), `${code} 需要 ${count} 张 > 印刷 ${ALL_CARDS[code]?.quantity || 1}`)
  }
  assert.ok(!aside.includes(RAW_CODES.rainyLondonStreets), '起始地点不应放一边')
})

// ---------------------------------------------------------------------------
// 4. 幕 / 议程
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 幕议程印刷数值：毁灭阈值、目标与正反面文本来自卡表', () => {
  assert.deepEqual([...ACT_CODES], ['09506', '09507', '09508', '09509'])
  assert.deepEqual([...AGENDA_CODES], ['09502', '09503', '09504', '09505'])
  const state = openScenario({ seats: 2 })
  assert.deepEqual(state.agendas.map(agenda => agenda.doomThreshold), [2, 4, 9, 7])
  assert.deepEqual(state.acts.map(act => act.objective.type), ['clues', 'chapterRule', 'clues', 'chapterRule'])
  assert.equal(state.acts[0].objective.perInvestigator, ALL_CARDS['09506'].clues)
  assert.equal(state.acts[2].objective.atLocation, 'towerOfLondon')
  assert.equal(state.acts[2].objective.perInvestigator, ALL_CARDS['09508'].clues)
  for (const [index, code] of ACT_CODES.entries()) {
    const stage = state.acts[index]
    assert.equal(stage.originalCode, code)
    assert.equal(stage.stage, `${index + 1}a`)
    assert.ok(stage.text.length > 0, `幕 ${code} 缺正面文本`)
    assert.ok(stage.backText.length > 0, `幕 ${code} 缺背面文本`)
  }
  for (const [index, code] of AGENDA_CODES.entries()) {
    assert.equal(state.agendas[index].originalCode, code)
    assert.ok(state.agendas[index].backText.length > 0, `议程 ${code} 缺背面文本`)
  }
})

test('P7 riddlesAndRain 幕 1 目标（共同花费线索）→ 背面放三处地点 + 结算隐匿 + 直接推进议程 2a', () => {
  const state = openScenario({ seats: 2 })
  for (const inv of state.investigators) inv.clues = 2
  state.legalMoves = legalMoves(state)
  const advance = findMove(state, move => move.action === 'advanceAct')
  assert.ok(advance, `缺少 advanceAct：${legalFor(state).map(move => move.action).join(',')}`)
  playMove(state, advance)
  assert.equal(state.actIndex, 1, '幕 1 背面应推进到幕 2')
  assert.equal(state.agendaIndex, 1, '幕 1 背面应直接推进到议程 2a')
  for (const id of ['kensingtonGardens', 'westminsterAbbey', 'bigBen']) assert.ok(locationOf(state, id), `${id} 未入场`)
  assert.equal(totalClues(state), 0, '线索已在推进时支付')
  assert.ok(shadowsEnemies(state).length >= 1, '幕 1 背面应把戴红手套的男子放进阴影')
  assert.equal(state.campaign.records[RECORD_KEYS.time], 1, '幕 1 背面不额外记时间')
})

test('P7 riddlesAndRain 议程 1 推进（毁灭 2）→ 背面恐慌 + 放地点 + 失去线索 + 直接推进幕 2a，毁灭移到下一密谋', () => {
  const state = openScenario({ seats: 2 })
  for (const inv of state.investigators) inv.clues = 3
  state.doom = 2
  driveEngine(state, draft => advanceAgenda(draft, [], 'doom'))
  assert.equal(state.agendaIndex, 1, '议程 1 推进应到议程 2')
  assert.equal(state.actIndex, 1, '议程 1 背面应直接推进幕 2a')
  for (const inv of state.investigators) assert.equal(inv.clues, 0, '每位调查员失去所有线索')
  for (const id of ['kensingtonGardens', 'westminsterAbbey', 'bigBen']) assert.ok(locationOf(state, id), `${id} 未入场`)
  assert.ok(shadowsEnemies(state).length >= 1, '议程 1 背面应把戴红手套的男子放进阴影')
  assert.equal(state.doom, 2, '印刷强制：毁灭移动到下一个密谋')
})

test('P7 riddlesAndRain 幕 2 背面：放塔桥/伦敦塔、把两组洗入遭遇牌库、直接推进议程 3a', () => {
  const state = openScenario({ seats: 2 })
  driveEngine(state, draft => advanceAct(draft, []))
  driveEngine(state, draft => advanceAct(draft, []))
  assert.equal(state.agendaIndex, 2, '幕 2 背面应直接推进到议程 3a')
  assert.ok(locationOf(state, 'towerBridge') && locationOf(state, 'towerOfLondon'))
  for (const code of SET_ASIDE_GROUP_CODES) {
    assert.ok(!state.scenarioZones.setAside.includes(code), `${code} 应已洗入遭遇牌库`)
    assert.ok(state.encounterDeck.includes(code), `${code} 不在遭遇牌库`)
  }
  assert.ok(state.encounterDeck.length > ENCOUNTER_DECK.length, '遭遇牌库应变大')
})

test('P7 riddlesAndRain 幕 3 背面：塔楼牢房入场、渡鸦之眼附属、迷你卡移动到塔楼牢房、议程推进到 4a', () => {
  const state = openScenario({ seats: 2 })
  runInTransaction(state, (draft, api) => behavior.resolveAct1Back(draft, api))
  assert.ok(shadowsEnemies(state).length >= 1)
  runInTransaction(state, (draft, api) => behavior.resolveAct2Back(draft, api))
  state.actIndex = 2
  runInTransaction(state, (draft, api) => behavior.resolveAct3Back(draft, api))
  assert.ok(locationOf(state, 'towerPrison'), '塔楼牢房未入场')
  assert.equal(keyLocationOf(state), 'towerPrison', '渡鸦之眼应附属到塔楼牢房')
  const cards = concealedOf(state).miniCards()
  assert.ok(cards.length > 0, '迷你卡应移动到塔楼牢房')
  assert.ok(cards.every(card => card.locationId === 'towerPrison'), '所有迷你卡都应在塔楼牢房')
  assert.equal(state.agendaIndex, 2, '幕 3 背面不推进议程（议程 3 仍在场，等毁灭推进）')
})

test('P7 riddlesAndRain 议程 4 背面：幕 4 → 结局 3；幕 1–3 → 结局 4', () => {
  const late = openScenario({ seats: 2 })
  late.agendaIndex = 3
  late.actIndex = 3
  driveEngine(late, draft => advanceAgenda(draft, [], 'objective'))
  assert.equal(late.campaign.flowPayload?.resolution ?? late.campaign.scenarioResults.at(-1)?.resolution, 'resolution3')

  const early = openScenario({ seats: 2 })
  early.agendaIndex = 3
  driveEngine(early, draft => advanceAgenda(draft, [], 'objective'))
  assert.equal(early.campaign.flowPayload?.resolution ?? early.campaign.scenarioResults.at(-1)?.resolution, 'resolution4')
})

// ---------------------------------------------------------------------------
// 5. 敌人 / 目标
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 戴红手套的男子：隐匿入场不生成实体，揭露真身才生成（反击/精英/胜利/生命来自印刷）', () => {
  const state = openScenario({ seats: 2 })
  const api = scenarioRuntime(state, [])
  const created = distributeConcealedEnemy(state, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  assert.equal(created.cards.length, 1 + 1 * state.numInvestigators, 'Concealed 1/调查员：真身 1 + 每名调查员 1 张诱饵')
  assert.equal(state.enemies.length, 0, '阴影中的敌人不应直接生成')
  const real = api.mechanics.tsk.concealed.miniCards().find(card => card.decoy !== true)
  const exposed = exposeMiniCardAt(state, real.id, state.investigators[0], api)
  assert.ok(exposed.spawned, '揭露真身应生成敌人')
  const enemy = state.enemies.find(item => (item.originalCode || item.code) === RAW_CODES.redGlovedMan)
  assert.ok(enemy, '戴红手套的男子未入场')
  assert.equal(enemy.location, exposed.locationId)
  assert.equal(enemy.retaliate, true, '反击关键词来自印刷卡文')
  assert.equal(enemy.elite, true)
  assert.equal(enemy.health, 2 * state.numInvestigators, '生命值 2/调查员')
  assert.equal(enemy.victory, 1)
  const decoy = api.mechanics.tsk.concealed.miniCards().find(card => card.decoy === true)
  assert.ok(decoy, '应仍有诱饵')
  exposeMiniCardAt(state, decoy.id, state.investigators[0], api)
  assert.equal(state.enemies.length, 1, '揭露诱饵不生成敌人')
})

test('P7 riddlesAndRain 幕 2 目标：与戴红手套的男子交战即推进；幕 4 目标：击败或 1/调查员 资源', () => {
  const state = openScenario({ seats: 2 })
  state.actIndex = 1
  const api = scenarioRuntime(state, [])
  distributeConcealedEnemy(state, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  const real = api.mechanics.tsk.concealed.miniCards().find(card => card.decoy !== true)
  const exposed = exposeMiniCardAt(state, real.id, state.investigators[0], api)
  assert.equal(actObjectiveMet(state).met, false, '尚未交战')
  assert.ok(exposed.spawned, '揭露真身应生成敌人')
  state.investigators[0].actionsLeft = 5
  state.legalMoves = legalMoves(state)
  const engage = state.legalMoves.find(move => move.action === 'engage' && move.enemyId === exposed.spawned.id)
  assert.ok(engage, `没有交战行动：${state.legalMoves.map(move => move.action).join(',')}`)
  playMove(state, engage)
  // 交战触发幕 2 目标 → 幕 2 背面「追逐开始！」把戴红手套的男子放回场外并直接推进议程 3a。
  assert.equal(state.actIndex, 2, '交战应推进到幕 3')
  assert.equal(state.agendaIndex, 2, '幕 2 背面应直接推进到议程 3a')
  assert.equal(state.enemies.some(enemy => (enemy.originalCode || enemy.code) === RAW_CODES.redGlovedMan), false,
    '幕 2 背面应把戴红手套的男子放回场外')

  // 幕 4 目标（独立状态）：击败 或 1/调查员 资源。
  const late = openScenario({ seats: 2 })
  late.actIndex = 3
  assert.equal(actObjectiveMet(late).met, false, '幕 4 未满足条件')
  late.scenarioFlags.tskRedGlovedManDefeated = true
  assert.equal(actObjectiveMet(late).reason, 'defeated')
  const parley = scenarioRuntime(late, [])
  const cards = parley.mechanics.tsk.concealed
  chapter.behavior.distributeConcealedEnemy(late, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, parley)
  const realLate = cards.miniCards().find(card => card.decoy !== true)
  const spawned = chapter.behavior.exposeMiniCardAt(late, realLate.id, late.investigators[0], parley).spawned
  delete late.scenarioFlags.tskRedGlovedManDefeated
  assert.equal(actObjectiveMet(late).met, false)
  addCardCounter(spawned, 'bounty', late.numInvestigators)
  assert.equal(actObjectiveMet(late).met, true)
  assert.equal(actObjectiveMet(late).reason, 'parleyResources')
})

test('P7 riddlesAndRain 幕 4 背面：被击败 → 结局 1；1/调查员 资源 → 结局 2', () => {
  const defeated = openScenario({ seats: 2 })
  defeated.actIndex = 3
  defeated.scenarioFlags.tskRedGlovedManDefeated = true
  driveEngine(defeated, draft => advanceAct(draft, []))
  assert.equal(defeated.campaign.flowPayload?.resolution ?? defeated.campaign.scenarioResults.at(-1)?.resolution, 'resolution1')
  assert.match(defeated.campaign.flowPayload.eyeOfRavensBearer, /^investigator:\d$/)

  const parley = openScenario({ seats: 2 })
  const api = scenarioRuntime(parley, [])
  chapter.behavior.distributeConcealedEnemy(parley, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  const real = api.mechanics.tsk.concealed.miniCards().find(card => card.decoy !== true)
  const exposed = chapter.behavior.exposeMiniCardAt(parley, real.id, parley.investigators[0], api)
  parley.actIndex = 3
  addCardCounter(exposed.spawned, 'bounty', parley.numInvestigators)
  assert.equal(actObjectiveMet(parley).met, true, '1/调查员 资源应满足幕 4 目标')
  driveEngine(parley, draft => advanceAct(draft, []))
  assert.equal(parley.campaign.flowPayload?.resolution ?? parley.campaign.scenarioResults.at(-1)?.resolution, 'resolution2')
})

// ---------------------------------------------------------------------------
// 6. 结局记录 / 时间 / 存档往返
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 结局记录：选择调查员成为渡鸦之眼持有者、恩怨未了、时间累计', () => {
  const state = openScenario({ seats: 2 })
  const result = runInTransaction(state, (draft, api) => behavior.resolution(draft, 'resolution1', [], api))
  assert.equal(result.key, 'resolution1')
  const bearer = result.bearer
  assert.match(bearer, /^investigator:\d$/, `持有者记录异常：${bearer}`)
  const seat = Number(bearer.split(':')[1])
  assert.deepEqual(state.campaign.tsk.keys.keys[KEY_ID].bearer, { type: 'investigator', seat })
  assert.equal(state.campaign.records[RECORD_KEYS.time], 1 + 1)
  assert.ok(state.campaign.records[RECORD_KEYS.keysHeld].includes('09519'), '结局 1 应把渡鸦之眼记入 keysHeld')
  assert.ok(state.campaign.records[RECORD_KEYS.chapters].includes('riddlesAndRain'))
})

test('P7 riddlesAndRain 结局 4 记 2 时间；noResolution 按指南跳到结局 4', () => {
  const state = openScenario({ seats: 1 })
  const result = runInTransaction(state, (draft, api) => behavior.resolution(draft, 'noResolution', [], api))
  assert.equal(result.key, 'resolution4')
  assert.equal(result.flowData.resolution, 'resolution4')
  assert.equal(state.campaign.records[RECORD_KEYS.time], 1 + 2, 'noResolution → 结局 4 记 2 时间')
  assert.equal(result.bearer, 'redGlovedMan')
  assert.ok(state.campaign.records[RECORD_KEYS.chapters].includes('riddlesAndRain'))
  assert.ok(!(state.campaign.records[RECORD_KEYS.keysHeld] || []).includes('09519'))
})

test('P7 riddlesAndRain 时间记录：markTime 累加，0 不改变累计', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  assert.equal(timePassed(state), 1)
  assert.equal(markTime(state, 1, api), 2)
  assert.equal(markTime(state, 3, api), 5)
  assert.equal(markTime(state, 0, api), 5)
})

test('P7 riddlesAndRain 存档 JSON 往返：TSK 战役/场景扩展、密钥、记录与迷你卡都能恢复', () => {
  const state = openScenario({ seats: 2 })
  const api = scenarioRuntime(state, [])
  distributeConcealedEnemy(state, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  markTime(state, 1, api)
  const text = JSON.stringify(state)
  assert.equal(text.includes('function'), false, '状态里不应有函数')
  const restored = JSON.parse(text)
  assert.equal(restored.campaign.tsk.keys.keys[KEY_ID].stableFace, KEY_CODES.stable)
  assert.equal(restored.scenarioFlags.mechanics.tsk.version, 1)
  assert.equal(restored.campaign.records[RECORD_KEYS.time], 2)
  assert.equal(restored.scenarioFlags.mechanics.tsk.concealed.miniCards.length, 3)
  assert.equal(restored.encounterDeck.length, state.encounterDeck.length)
})

// ---------------------------------------------------------------------------
// 7. 隐匿 / 肯辛顿花园 / 伦敦塔
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 隐匿迷你卡：按最近地点平均分配并标记阴影', () => {
  const state = openScenario({ seats: 2 })
  const api = scenarioRuntime(state, [])
  for (const id of ['bigBen', 'westminsterAbbey', 'kensingtonGardens']) {
    api.place(id)
    api.reveal(id)
  }
  const created = distributeConcealedEnemy(state, RAW_CODES.redGlovedMan, { seat: 0, locationId: START_LOCATION }, api)
  assert.ok(created.placements.length >= 2, '应分配到多个最近地点')
  const counts = created.placements.map(entry => entry.count)
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `分配不均：${counts.join(',')}`)
  for (const entry of created.placements) {
    assert.ok(api.mechanics.tsk.concealed.inShadows(entry.locationId), `${entry.locationId} 未标记阴影`)
    assert.equal(api.mechanics.tsk.concealed.at(entry.locationId).length, entry.count)
  }
})

test('P7 riddlesAndRain 肯辛顿花园：揭露诱饵治愈 1 恐惧、揭露敌人受到 1 恐惧', () => {
  const state = openScenario({ seats: 2 })
  const api = scenarioRuntime(state, [])
  api.place('kensingtonGardens')
  api.reveal('kensingtonGardens')
  const inv = state.investigators[0]
  inv.horror = 1
  const decoy = api.mechanics.tsk.concealed.place({ kind: 'decoy', decoy: true, locationId: 'kensingtonGardens' })
  exposeMiniCardAt(state, decoy.id, inv, api)
  assert.equal(inv.horror, 0, '揭露诱饵应治愈 1 恐惧')

  const real = api.mechanics.tsk.concealed.place({
    kind: `enemy${RAW_CODES.redGlovedMan}`, decoy: false, locationId: 'kensingtonGardens',
  })
  exposeMiniCardAt(state, real.id, inv, api)
  assert.equal(inv.horror, 1, '揭露敌人应受到 1 恐惧')
})

test('P7 riddlesAndRain 伦敦塔强制：结束回合要么失去 2 资源、要么被阴影中的敌人攻击', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('towerOfLondon')
  api.reveal('towerOfLondon')
  state.investigators[0].location = 'towerOfLondon'
  state.investigators[0].resources = 5
  api.mechanics.tsk.concealed.place({ kind: `enemy${RAW_CODES.redGlovedMan}`, decoy: false, locationId: 'towerOfLondon' })
  runInTransaction(state, draft => behavior.turnEnded(draft, draft.investigators[0], scenarioRuntime(draft, [])))
  assert.equal(state.investigators[0].resources, 3, '默认选择失去 2 资源')
  const before = { damage: state.investigators[0].damage, horror: state.investigators[0].horror }
  runInTransaction(state, draft => {
    draft.investigators[0].resources = 1
    behavior.turnEnded(draft, draft.investigators[0], scenarioRuntime(draft, []))
  })
  assert.ok(state.investigators[0].damage > before.damage || state.investigators[0].horror > before.horror,
    '资源不足时必须被阴影中的敌人攻击')
})

// ---------------------------------------------------------------------------
// 8. 渡鸦之眼（密钥）
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 渡鸦之眼：附属地点后稳定面把基础技能值补到 6，检定后翻到动荡面', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.place('towerPrison')
  api.reveal('towerPrison')
  const inv = state.investigators[0]
  inv.location = 'towerPrison'
  runInTransaction(state, draft => behavior.attachKeyToLocation(draft, 'towerPrison', scenarioRuntime(draft, [])))
  assert.equal(keyLocationOf(state), 'towerPrison')
  state.skillTest = { seat: inv.seat, skill: 'willpower', difficulty: 4, value: 6 }
  assert.equal(behavior.statModifier(state, inv, 'willpower'), 6 - inv.willpower)
  assert.equal(behavior.statModifier(state, inv, 'combat'), 0, '非本次检定的技能不加值')
  const applied = behavior.afterTest(state, inv, { success: true }, api, {})
  assert.ok(applied.some(entry => entry.key === KEY_ID && entry.shifted), '应结算一次变换')
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.unstable)
  assert.equal(api.mechanics.tsk.keys.get(KEY_ID).stable, false)
  delete state.skillTest
})

test('P7 riddlesAndRain 渡鸦之眼动荡面：抽遭遇牌库顶 1 张，调查员变换后翻回稳定面；敌人触发不翻回', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  api.mechanics.tsk.keys.shift(KEY_ID, { force: true })
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.unstable)
  const before = state.encounterDeck.length
  const result = runInTransaction(state, draft => behavior.resolveKeyShift(draft, {
    by: 'investigator', seat: draft.investigators[0].seat, api: scenarioRuntime(draft, []),
  }))
  assert.equal(result.flipped, true)
  assert.ok(state.encounterDeck.length === before - 1 || state.encounterDiscard.length > 0, '应抽取遭遇牌库顶 1 张')
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.stable, '调查员变换后翻回稳定面')

  api.mechanics.tsk.keys.shift(KEY_ID, { force: true })
  const enemyShift = runInTransaction(state, draft => behavior.resolveKeyShift(draft, {
    by: 'enemy', api: scenarioRuntime(draft, []),
  }))
  assert.equal(enemyShift.flipped, false)
  assert.equal(api.mechanics.tsk.keys.face(KEY_ID), KEY_CODES.unstable)
})

test('P7 riddlesAndRain 密钥/敌人条目声明即接线：flags.keyShift 与 enemyScript.concealed 被 behavior 读取', () => {
  assert.equal(registeredEntry(KEY_CODES.stable).flags.keyShift.face, 'stable')
  assert.equal(registeredEntry(KEY_CODES.stable).flags.keyShift.effect.value, 6)
  assert.equal(registeredEntry(KEY_CODES.stable).flags.keyShift.flip, 'always')
  assert.equal(registeredEntry(KEY_CODES.unstable).flags.keyShift.face, 'unstable')
  assert.equal(registeredEntry(KEY_CODES.unstable).flags.keyShift.effect.type, 'drawEncounterTop')
  assert.equal(registeredEntry(KEY_CODES.unstable).flags.keyShift.flip, 'ifInvestigator')
  assert.equal(registeredEntry(RAW_CODES.redGlovedMan).enemyScript.concealed.perInvestigator, 1)
})

// ---------------------------------------------------------------------------
// 9. 混乱标记
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 混乱标记四档：skull 随线索数、tablet 再揭示、elderthing 失败二选一', () => {
  const inv = { clues: 0 }
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'skull').delta, -1)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, { clues: 2 }, 'skull').delta, -3)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'hard' }, inv, 'skull').delta, -2)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'expert' }, { clues: 2 }, 'skull').delta, -4)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'tablet').delta, -1)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'tablet', { concealedHere: true }).drawAnother, true)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'standard' }, inv, 'tablet').drawAnother, false)
  assert.equal(riddlesChaosTokenOutcome({ difficulty: 'hard' }, inv, 'elderthing').delta, -4)
  assert.deepEqual(riddlesElderThingFailureSpec({}, { clues: 2 }, 'elderthing', 1),
    { token: 'elderthing', kind: 'clueOrDoomOnShadowEnemy', amount: 1, affordable: true })
  assert.equal(riddlesElderThingFailureSpec({}, { clues: 0 }, 'skull', 2), null)
})

test('P7 riddlesAndRain 混乱标记走真实引擎读点：resolveSpecialToken 用 behavior.resolveChaosToken 的数值', () => {
  const state = openScenario({ seats: 1 })
  const inv = state.investigators[0]
  inv.clues = 2
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', scenarioRuntime(state, [])).delta, -3, '有 2 个线索时简单/普通 -3')
  inv.clues = 0
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull', scenarioRuntime(state, [])).delta, -1)
})

test('P7 riddlesAndRain [elder_thing] 失败后果：无阴影敌人时花费线索', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  inv.clues = 2
  const applied = behavior.afterTest(state, inv, { success: false }, api,
    { resolvedTokens: ['elderthing'], test: { failedBy: 2 } })
  assert.equal(applied[0].choice, 'spendClue')
  assert.equal(inv.clues, 1, '应花费 1 个线索')
})

// ---------------------------------------------------------------------------
// 10. 地点能力（真实 legalMoves / applyMove）
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 伦敦雨街：[action] 撤退出现在 legalMoves；单人撤退即以 noResolution 收束到结局 4', () => {
  const state = openScenario({ seats: 1 })
  const resign = findMove(state, move => move.action === 'scenarioAction' && move.rule === 'riddlesResign')
  assert.ok(resign, `缺少撤退行动：${legalFor(state).map(move => move.action).join(',')}`)
  playMove(state, resign)
  assert.equal(state.investigators[0].resigned, true)
  assert.equal(state.campaign.flowPayload?.resolution ?? state.campaign.scenarioResults.at(-1)?.resolution,
    'resolution4', '全员撤退 → 结局 4')
})

test('P7 riddlesAndRain 地点能力接线：修道院谈判 / 塔桥 / 叛徒之门 / 大本钟快速 / 塔楼牢房快速', () => {
  const state = openScenario({ seats: 1 })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  for (const id of ['westminsterAbbey', 'towerBridge', 'traitorsGate', 'bigBen', 'towerPrison']) {
    api.place(id)
    api.reveal(id)
  }
  api.mechanics.tsk.concealed.place({ kind: 'decoy', decoy: true, locationId: 'bigBen' })

  inv.location = 'westminsterAbbey'
  state.legalMoves = legalMoves(state)
  assert.ok(findMove(state, move => move.rule === 'abbeyParley'), '修道院谈判未出现')
  inv.location = 'towerBridge'
  state.legalMoves = legalMoves(state)
  assert.ok(findMove(state, move => move.rule === 'towerBridgeWayIn'), '塔桥行动未出现')
  inv.location = 'traitorsGate'
  state.legalMoves = legalMoves(state)
  assert.ok(findMove(state, move => move.rule === 'traitorsGateReveal'), '叛徒之门行动未出现')
  inv.location = 'bigBen'
  assert.ok(behavior.fastActions(state, inv, 'test.beforeCommit').some(move => move.rule === 'bigBenPeek'),
    '大本钟快速行动未出现')
  inv.location = 'towerPrison'
  inv.clues = 1
  state.skillTest = { seat: inv.seat, skill: 'willpower', difficulty: 4, value: 4 }
  assert.ok(behavior.fastActions(state, inv, 'test.beforeCommit').some(move => move.rule === 'towerPrisonClue'),
    '塔楼牢房快速行动未出现')
  runInTransaction(state, draft => behavior.performAction(draft, draft.investigators[0],
    { rule: 'towerPrisonClue' }, scenarioRuntime(draft, [])))
  assert.equal(state.investigators[0].clues, 0, '应花费 1 个线索')
  assert.equal(state.skillTest.pendingBonus, 2, '本次检定技能值 +2')
  state.skillTest = null
})

test('P7 riddlesAndRain 地点能力成功分支：塔桥放置叛徒之门、叛徒之门揭示伦敦塔（真实引擎检定）', () => {
  const state = openScenario({ seats: 1, stats: { willpower: 20, intellect: 20, combat: 20, agility: 20 }, bag: ['0'] })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  api.place('towerBridge')
  api.reveal('towerBridge')
  inv.location = 'towerBridge'
  state.legalMoves = legalMoves(state)
  const wayIn = findMove(state, move => move.rule === 'towerBridgeWayIn')
  assert.ok(wayIn, '塔桥行动未出现在 legalMoves')
  playMove(state, wayIn)
  assert.ok(locationOf(state, 'traitorsGate'), '检定成功后叛徒之门应入场')

  state.investigators[0].location = 'traitorsGate'
  state.investigators[0].actionsLeft = 5
  state.legalMoves = legalMoves(state)
  const reveal = findMove(state, move => move.rule === 'traitorsGateReveal')
  assert.ok(reveal, '叛徒之门行动未出现在 legalMoves')
  playMove(state, reveal)
  const tower = locationOf(state, 'towerOfLondon')
  assert.ok(tower && tower.revealed === true, '伦敦塔应被揭示')
})

// ---------------------------------------------------------------------------
// 11. 共享组遭遇
// ---------------------------------------------------------------------------
test('P7 riddlesAndRain 遭遇牌库洗入：Crimson Conspiracy 的敌人走「Concealed 2」进阴影而不是普通生成', () => {
  const state = openScenario({ seats: 2 })
  const api = scenarioRuntime(state, [])
  state.encounterDeck = [RAW_CODES.coterieAgents[0]]
  api.drawEncounter(0)
  const cards = api.mechanics.tsk.concealed.miniCards()
  // 2026-11-13 P1-3：Concealed 2 无 [per_investigator] 图标 → 总诱饵数恒为 2（不乘人数）。
  assert.equal(cards.length, 1 + 2, 'Concealed 2：1 张真身 + 2 张诱饵')
  assert.ok(cards.some(card => card.kind === `enemy${RAW_CODES.coterieAgents[0]}`), '真身迷你卡 kind 应指向结社特工 A')
  assert.equal(state.enemies.length, 0, '结社特工不应直接生成')
  assert.ok(!state.encounterDiscard.includes(RAW_CODES.coterieAgents[0]), '阴影中的敌人不应进遭遇弃牌堆')
})

test('P7 riddlesAndRain 议程 3 背面：有结社特工时可找出来抽取（进阴影），没有时全员 1 伤害 1 恐惧', () => {
  const agent = openScenario({ seats: 2 })
  agent.encounterDiscard.push(RAW_CODES.coterieAgents[1])
  runInTransaction(agent, (draft, api) => behavior.resolveAgenda3Back(draft, api))
  assert.ok(concealedOf(agent).miniCards().length > 0, '找到结社特工后应进入阴影')

  const harm = openScenario({ seats: 2 })
  runInTransaction(harm, (draft, api) => behavior.resolveAgenda3Back(draft, api))
  assert.ok(harm.investigators.every(inv => inv.damage === 1 && inv.horror === 1), '没有结社特工时应走伤害分支')
})
