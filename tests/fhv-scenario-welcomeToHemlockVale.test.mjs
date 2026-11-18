// P7 欢迎来到铁杉谷（welcomeToHemlockVale · 提示卡 10704）章节测试。
//
// 覆盖：章节结构（8 处地点 / 幕议程 / 16 条法典 / 8 位居民 / 5 处勘察候选）、gather 组与放一边、
// 序曲布置（Day 面入场、起始十字路口、毁灭 = 调查员人数、无遭遇牌库）、时间指示卡与第 1 日白天、
// 开场「勘察/赴宴」选择与其混乱标记、地点法典触发（含 14 号的逐调查员重复）、居民访问与谈判后读法典、
// 幕背面「光辉」、议程背面「Time to Get to Work!」→ 结局 1 与战役记录、混乱标记四档取值、
// 存档 JSON 往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与轻量 api 桩（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/welcomeToHemlockVale/index.js'

const clone = value => JSON.parse(JSON.stringify(value))
const quietApi = () => ({ info: () => {} })
const stateFor = (count = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: ['01001', '01002', '01003'], hand: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], chaosBag: ['skull', 'cultist', 'tablet', 'elderthing'], doom: 0,
  difficulty: 'standard', numInvestigators: count, phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = clone(chapter.scenario)
  return state
}
const setup = (count = 1, api = quietApi(), records = {}, flags = {}) => {
  const state = stateWithScenario(count, records, flags)
  const report = chapter.behavior.setupScenario(state, api)
  return { state, report }
}
// 按顺序回答 api.choose 的桩：答案可以是 id 字符串，也可以是 'first'（缺省取第一个选项）。
const choiceApi = (answers = []) => {
  let index = 0
  return {
    info: () => {},
    choose: request => {
      const answer = answers[index]
      index += 1
      if (answer == null) return request.options?.[0]?.id ?? null
      return typeof answer === 'function' ? answer(request) : answer
    },
  }
}
const itemCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
  && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'item'))
const spellCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
  && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'spell'))
const allyCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
  && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'ally'))

// ---------------------------------------------------------------------------
// 1. 章节结构：卡、地点、幕议程、法典/居民/勘察声明
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 章节结构：提示卡 10704、8 处地点、1 幕 1 议程与 16 条法典', () => {
  assert.equal(chapter.scenario.id, 'welcomeToHemlockVale')
  assert.equal(chapter.scenario.originalCode, '10704')
  assert.equal(chapter.scenario.referenceCode, '10704')
  assert.equal(chapter.scenario.isPrelude, true)
  assert.match(chapter.scenario.name, /欢迎来到铁杉谷/)
  assert.equal(chapter.manifest.id, 'welcomeToHemlockVale')
  assert.equal(chapter.manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.isPrelude, true)
  assert.equal(chapter.manifest.referenceCode, '10704')
  // 8 处地点：Day 面入场、Night 面只做身份（manifest.backCode）。
  assert.equal(Object.keys(chapter.LOCATIONS).length, 8)
  assert.equal(chapter.LOCATION_IDS.length, 8)
  for (const id of chapter.LOCATION_IDS) {
    assert.equal(chapter.LOCATIONS[id].code, chapter.LOCATION_DAY_CODES[id])
    assert.equal(chapter.LOCATION_CODE_BY_ID[id].back, chapter.LOCATION_NIGHT_CODES[id])
    assert.ok(ALL_CARDS[chapter.LOCATION_DAY_CODES[id]], `地点卡存在：${id}`)
    assert.ok(ALL_CARDS[chapter.LOCATION_NIGHT_CODES[id]], `地点背面卡存在：${id}`)
    assert.equal(chapter.LOCATIONS[id].shroud, ALL_CARDS[chapter.LOCATION_CODE_BY_ID[id].front].shroud)
  }
  // 幕/议程：唯一一张，议程印刷毁灭阈值 6。
  assert.deepEqual([...chapter.ACT_CODES], ['10682'])
  assert.deepEqual([...chapter.AGENDA_CODES], ['10681'])
  assert.equal(chapter.scenario.acts.length, 1)
  assert.equal(chapter.scenario.agendas.length, 1)
  assert.equal(chapter.scenario.acts[0].originalCode, '10682')
  assert.equal(chapter.scenario.agendas[0].originalCode, '10681')
  assert.equal(chapter.scenario.agendas[0].doomThreshold, 6)
  assert.equal(chapter.AGENDA_DOOM_THRESHOLD, 6)
  assert.equal(ALL_CARDS['10681'].doom, 6)
  // 幕没有数值目标（序曲由议程推进结束）。
  assert.equal(chapter.scenario.acts[0].objective.type, 'chapterRule')
  assert.deepEqual([...chapter.RESOLUTION_KEYS], ['resolution1'])
  assert.deepEqual(Object.keys(chapter.scenario.resolutions), ['resolution1'])
  // 提示卡与时间指示卡的卡面数据都来自 cards-data。
  assert.equal(chapter.TIME_MARKER_CODE, '10675')
  assert.equal(ALL_CARDS['10675'].name, 'Day One')
  assert.equal(ALL_CARDS['10675'].backName, 'Night One')
  assert.ok(chapter.CARD_DATA['10704'])
  assert.ok(chapter.CARD_DATA['10675'])
  assert.equal(chapter.implementedEncounterCodes.length, 0, '本序曲不建单卡条目')
})

test('P7 welcomeToHemlockVale 引擎机制声明：日历/法典/居民/勘察/无遭遇牌库/保护调查员', () => {
  const mechanics = chapter.scenario.mechanics
  assert.deepEqual(Object.keys(mechanics).sort(), [
    'calendar', 'codex', 'noEncounterDeck', 'protectInvestigators', 'residents', 'survey',
  ])
  assert.deepEqual(mechanics.calendar, { maximumDay: 3, record: 'hemlockDate', periodByLocationTrait: null })
  assert.equal(mechanics.noEncounterDeck, true, '序曲没有遭遇牌库')
  assert.equal(mechanics.protectInvestigators, true, '幕 10682：调查员不能受到伤害/恐惧，也不能被击败')
  // 法典：16 条，一次性的 15 条 + 塔德杂货店（14）逐调查员可重复。
  assert.equal(mechanics.codex.length, 16)
  assert.equal(chapter.CODEX_ENTRIES.length, 16)
  for (const entry of mechanics.codex) {
    assert.deepEqual(Object.keys(entry).sort(), [...(entry.resident
      ? ['branches', 'id', 'limit', 'resident'] : ['branches', 'id', 'limit'])].sort())
    assert.equal(entry.branches.length, 1)
    assert.equal(entry.branches[0].id, chapter.CODEX_BRANCH_PRINTED)
  }
  assert.equal(chapter.CODEX_ENTRY_BY_NUMBER[14].limit, chapter.CODEX_LIMIT_UNLIMITED)
  assert.equal(chapter.CODEX_ENTRY_BY_NUMBER[13].limit, chapter.CODEX_LIMIT_SCENARIO)
  // 居民：8 位，记录键与战役日志一致（RelationshipLevel / Notes / CrossedOut）。
  assert.equal(mechanics.residents.length, 8)
  assert.deepEqual(chapter.RESIDENTS.map(row => row.id).sort(), [
    'gideonMizrah', 'judithPark', 'leahAtwood', 'motherRachel',
    'riverHawthorne', 'simeonAtwood', 'theoPeters', 'williamHemlock',
  ])
  for (const resident of mechanics.residents) {
    assert.equal(resident.record.max, chapter.RESIDENT_MAX_RELATIONSHIP)
    assert.match(resident.record.level, /RelationshipLevel$/)
    assert.match(resident.record.notes, /Notes$/)
    assert.match(resident.record.crossedOut, /CrossedOut$/)
    assert.equal(typeof resident.name, 'string')
  }
  // 勘察：五处未勘察区域。
  assert.deepEqual([...mechanics.survey.destinations], [
    'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
  ])
  assert.deepEqual([...mechanics.survey.resolutions], ['resolution1'])
  assert.deepEqual([...chapter.SURVEY_DESTINATIONS], [...mechanics.survey.destinations])
  // 记录键与战役层同口径。
  assert.ok(chapter.RECORD_WRITES.includes('welcomeToHemlockValeResolution'))
  assert.ok(chapter.RECORD_WRITES.includes('welcomeToHemlockValeSurveyChoices'))
  for (const key of chapter.RECORD_WRITES) assert.ok(chapter.RECORD_READS.includes(key) || key.endsWith('Resolution')
    || key.endsWith('ResolutionReason') || key.endsWith('SurveyChoices') || key.endsWith('TheBrilliance')
    || key.endsWith('RelationshipLevel'), `记录键有读点：${key}`)
  assert.deepEqual([...chapter.manifest.recordWrites], [...chapter.RECORD_WRITES])
})

test('P7 welcomeToHemlockVale 手册正文：8 条布置步骤、结局 1 与 16 条法典正文', () => {
  assert.equal(chapter.SETUP_STEPS.length, 8)
  assert.deepEqual([...chapter.SETUP_STEP_KEYS], [
    'gatherSets', 'dayOne', 'placeLocations', 'locationsNote', 'startAt', 'setOutOfPlay', 'placeDoom', 'codex',
  ])
  assert.match(chapter.SCENARIO_TEXT.setup, /居民|Residents/)
  assert.match(chapter.SCENARIO_TEXT.setup, /十字路口|The Crossroads/)
  assert.ok(chapter.SCENARIO_TEXT.resolutions.resolution1.body.length > 500)
  assert.equal(chapter.SCENARIO_TEXT.codex.motherRachel.number, 1)
  assert.equal(Object.keys(chapter.SCENARIO_TEXT.codex).length, 16)
  for (const entry of chapter.CODEX_ENTRIES) {
    const text = chapter.SCENARIO_TEXT.codex[entry.id]
    assert.ok(text.title.length > 0, `法典标题：${entry.id}`)
    assert.ok(text.body.length > 0, `法典正文：${entry.id}`)
  }
  // 本章暂无本地中译（story-source 只覆盖 prelude.theFirstEvening/theSecondEvening）。
  assert.equal(chapter.SCENARIO_TEXT.textLanguage, 'zh-CN')
  assert.match(chapter.SCENARIO_TEXT.textStatus, /complete|chineseGaps|zh/)
  assert.equal(chapter.SCENARIO_TEXT.chineseGaps.length, 0)
  assert.equal(chapter.SCENARIO_TEXT.tokens.easyStandard.skull, '-X。X 为当前天数。')
  assert.ok(/奖励经验|Bonus experience/.test(chapter.SCENARIO_TEXT.xp.theBrilliance))
  assert.match(chapter.SCENARIO_TEXT.rules.codex, /法典|Codex/)
})

// ---------------------------------------------------------------------------
// 2. gather 组 / 放一边 / 遭遇牌库
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 遭遇组：三组 gather + Residents 整组放一边，无遭遇牌库', () => {
  assert.deepEqual([...chapter.GATHER_GROUPS], ['theFirstDay', 'dayOfRest', 'theVale'])
  assert.deepEqual([...chapter.GATHER_SET_ASIDE_GROUPS], ['residents'])
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds].sort(),
    ['dayOfRest', 'residents', 'theFirstDay', 'theVale'])
  // Residents 20 张：11 张资产面 + 9 张敌人面。
  assert.equal(chapter.RESIDENT_ASSET_CODES.length, 11)
  assert.equal(chapter.RESIDENT_ENEMY_CODES.length, 9)
  assert.equal(chapter.SET_ASIDE_RESIDENT_CODES.length, 20)
  assert.equal(new Set(chapter.SET_ASIDE_RESIDENT_CODES).size, 20)
  for (const code of chapter.SET_ASIDE_RESIDENT_CODES) assert.ok(ALL_CARDS[code], `居民卡存在：${code}`)
  assert.deepEqual(chapter.manifest.zones.setAside.map(entry => entry.cardCode).sort(),
    [...chapter.SET_ASIDE_RESIDENT_CODES].sort())
  assert.equal(chapter.manifest.zones.setAside.every(entry => entry.count === 1), true)
  // 时间指示卡在场上、遭遇牌库为空。
  assert.deepEqual(chapter.manifest.zones.encounterDeck, [])
  assert.deepEqual(chapter.manifest.zones.inPlay, [{ cardCode: '10675', count: 1 }])
  assert.equal(chapter.ENCOUNTER_DECK.length, 0)
  // 10676 虫群随 The First Day 收集但不使用（不写进任何区域）。
  assert.deepEqual([...chapter.UNUSED_ENCOUNTER_CODES], ['10676'])
  for (const entry of Object.values(chapter.manifest.zones).flat()) {
    assert.notEqual(entry.cardCode, '10676')
  }
  // 双面地点的 manifest backCode 指向 Night 面。
  const boarding = chapter.manifest.locations.find(location => location.id === 'boardingHouse')
  assert.equal(boarding.frontCode, '10705a')
  assert.equal(boarding.backCode, '10705b')
})

// ---------------------------------------------------------------------------
// 3. 序曲布置
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 布置：8 处 Day 面地点、起始十字路口、毁灭 = 人数', () => {
  const { state, report } = setup(3)
  assert.deepEqual(report.placedIds, [...chapter.LOCATION_IDS])
  assert.equal(state.locations.length, 8)
  const crossroads = state.locations.find(location => location.id === 'theCrossroads')
  assert.equal(crossroads.code, '10706a')
  assert.equal(crossroads.revealed, true, '序曲地点以 Day 面朝上入场')
  assert.equal(crossroads.daySide, true)
  // 印刷线索：只有老磨坊 1 点（固定值），其余 0。
  const clues = Object.fromEntries(state.locations.map(location => [location.id, location.clues]))
  assert.equal(clues.theOldMill, 1)
  assert.equal(clues.theCrossroads, 0)
  assert.equal(Object.entries(clues).filter(([id]) => id !== 'theOldMill').every(([, value]) => value === 0), true)
  // 全员在十字路口开始。
  assert.equal(state.investigators.every(inv => inv.location === 'theCrossroads'), true)
  assert.equal(chapter.behavior.startLocation(state), 'theCrossroads')
  // 议程上放毁灭 = 调查员人数。
  assert.equal(state.doom, 3)
  assert.equal(state.acts[0].originalCode, '10682')
  assert.equal(state.agendas[0].originalCode, '10681')
  assert.equal(state.actIndex, 0)
  assert.equal(state.agendaIndex, 0)
  // 放一边 20 张居民；遭遇牌库为空。
  assert.deepEqual([...state.scenarioZones.setAside].sort(), [...chapter.SET_ASIDE_RESIDENT_CODES].sort())
  assert.deepEqual(state.encounterDeck, [])
  // 地点带印刷符号面（引擎 locations.js#linkLocationBySymbols 的同口径读点）。
  assert.deepEqual(crossroads.symbols.front.links,
    [...chapter.LOCATION_CONNECTION_ICONS.theCrossroads])
  assert.equal(crossroads.symbol, 'diamond')
  assert.equal(crossroads.residentCode, '10700', '十字路口法典放入希奥')
})

test('P7 welcomeToHemlockVale 地点连接：只按印刷图标相连且双向对称', () => {
  const { state } = setup(1)
  const ids = new Set(state.locations.map(location => location.id))
  for (const location of state.locations) {
    assert.equal(new Set(location.connections).size, location.connections.length, `无重复连接：${location.id}`)
    for (const to of location.connections) {
      assert.ok(ids.has(to), `连接目标在场：${location.id} → ${to}`)
      const target = state.locations.find(item => item.id === to)
      assert.ok(target.connections.includes(location.id), `连接双向：${to} → ${location.id}`)
    }
  }
  const crossroads = state.locations.find(location => location.id === 'theCrossroads')
  assert.deepEqual([...crossroads.connections].sort(),
    ['boardingHouse', 'hemlockChapel', 'tadsGeneralStore', 'theAtwoodHouse', 'theCommons', 'theOldMill'])
  // 学校（黑桃）连星形/圆形，不连十字路口（菱形不在其图标里）。
  const schoolhouse = state.locations.find(location => location.id === 'valeSchoolhouse')
  assert.deepEqual([...schoolhouse.connections].sort(), ['boardingHouse', 'theCommons'])
  assert.equal(schoolhouse.connections.includes('theCrossroads'), false)
  // 桌面布局：8 个坐标、22 条边。
  assert.equal(Object.keys(chapter.layout.locations).length, 8)
  assert.equal(chapter.layout.edges.length, 22)
  assert.equal(chapter.layout.connectionMode, 'icons')
})

// ---------------------------------------------------------------------------
// 4. 时间指示卡与第 1 日白天
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 时间标记：Day One 入场、第 1 日白天与日历原语', () => {
  const calls = []
  const api = {
    info: () => {},
    mechanics: { calendar: { current: () => null, set: (day, period) => calls.push([day, period]) } },
  }
  const { state } = setup(2, api)
  const marker = chapter.timeMarkerInPlay(state)
  assert.ok(marker, '时间指示卡已入场')
  assert.equal(marker.code, '10675')
  assert.equal(marker.face, 'front')
  assert.equal(marker.name, '第一日')
  assert.equal(marker.global, true)
  // 第 1 日白天：记录、日历原语与 flag 三处读点一致。
  assert.equal(chapter.dayOf(state), 1)
  assert.equal(chapter.isNight(state), false)
  assert.equal(chapter.isDaytime(state), true)
  assert.equal(state.campaign.records.day, 1)
  assert.equal(state.campaign.records.time, 'Day')
  assert.deepEqual(calls, [[1, 'day']], '日历原语被写入一次')
  // 没有 api 时写引擎同一存档形状。
  const { state: bare } = setup(1)
  assert.deepEqual(bare.scenarioFlags.mechanics.scenarioDate, { day: 1, period: 'day' })
  assert.equal(bare.campaign.records.hemlockDate, '1:day')
  // 夜晚面：同一张卡的背面（不伪造 10675b 卡号）。
  const night = stateWithScenario(1, { hemlockDate: '1:night' })
  night.scenarioFlags.mechanics = { version: 1, scenarioDate: { day: 1, period: 'night' } }
  const nightMarker = chapter.putTimeMarkerInPlay(night, quietApi())
  assert.equal(nightMarker.face, 'back')
  assert.equal(nightMarker.name, '第一夜')
  assert.equal(chapter.isNight(night), true)
  assert.equal(chapter.isDaytime(night), false)
  // 议程毁灭阈值读点。
  const { state: doomState } = setup(1)
  doomState.doom = 5
  assert.equal(chapter.agendaDoomReached(doomState), false)
  doomState.doom = 6
  assert.equal(chapter.agendaDoomReached(doomState), true)
})

// ---------------------------------------------------------------------------
// 5. 开场选择（勘察 / 赴宴）与混乱标记
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 开场：勘察加 [tablet]、赴宴加 [elder_thing]（幂等）', () => {
  const surveyState = stateWithScenario(1)
  const surveyApi = choiceApi(['survey'])
  const survey = chapter.preScenarioSetup(surveyState, [], surveyApi)
  assert.equal(survey.branch, 'survey')
  assert.equal(surveyState.campaign.records.welcomeToHemlockValeIntro, 'survey')
  assert.equal(surveyState.campaign.records.welcomeToHemlockValeChaosToken, 'tablet')
  assert.equal(surveyState.chaosBag.filter(token => token === 'tablet').length, 2, '原袋 1 枚 + 开场 1 枚')

  const feastState = stateWithScenario(1)
  const feast = chapter.preScenarioSetup(feastState, [], choiceApi(['feast']))
  assert.equal(feast.branch, 'feast')
  assert.equal(feastState.campaign.records.welcomeToHemlockValeChaosToken, 'elderthing')
  assert.equal(feastState.chaosBag.filter(token => token === 'elderthing').length, 2)
  // 重复进入不会重复加标记。
  chapter.preScenarioSetup(feastState, [], choiceApi(['feast']))
  assert.equal(feastState.chaosBag.filter(token => token === 'elderthing').length, 2)
  // 开场正文按选择给出分支（Intro 3 含「elderThing」与「Skip to Intro 4」）。
  const intro = chapter.introduction(chapter.scenario, feastState.campaign.records, feastState)
  assert.equal(intro.version, 3)
  assert.ok(intro.paragraphs.length >= 2)
  assert.ok(intro.sections.some(section => /引言 4|开场 4|Intro 4/.test(section.paragraphs.join(' '))))
  assert.ok(intro.paragraphs.join(' ').includes('[elderThing]'))
  // 无 api 时默认「勘察」分支。
  const bare = stateWithScenario(1)
  assert.equal(chapter.preScenarioSetup(bare, [], {}).branch, 'survey')
  assert.equal(chapter.introChaosToken('feast'), 'elderthing')
  assert.equal(chapter.introChaosToken('survey'), 'tablet')
})

// ---------------------------------------------------------------------------
// 6. 法典触发（地点）
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 法典：地点条目把居民放入场并按印刷效果结算', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  // 十字路口：[action] → codex 10。
  const crossroadsActions = chapter.actions(state, inv)
  assert.deepEqual(crossroadsActions.map(move => move.rule).sort(), ['welcomeCodex', 'welcomeCrossroadsMove'])
  assert.equal(crossroadsActions.find(move => move.rule === 'welcomeCodex').codexNumber, 10)
  // 结算 codex 10：希奥入场 + 抽 1 张（选择 draw）。
  const deckBefore = inv.deck.length
  const receipt = chapter.resolveCodexEntry(state, 10, 0, choiceApi(['draw']))
  assert.equal(receipt.number, 10)
  assert.equal(receipt.resident, 'theoPeters')
  assert.equal(receipt.choice, 'draw')
  assert.equal(inv.deck.length, deckBefore - 1)
  assert.equal(inv.hand.length, 1)
  const theo = chapter.residentInPlay(state, 'theoPeters')
  assert.ok(theo)
  assert.equal(theo.location, 'theCrossroads')
  assert.equal(state.scenarioZones.setAside.includes('10700'), false, '入场后从一边移出')
  // 一次性：同一条目不能结算第二次。
  assert.equal(chapter.resolveCodexEntry(state, 10, 0), false)
  assert.deepEqual(chapter.resolvedCodexKeys(state), ['theCrossroads'])
  // 换到没有法典的地点后，actions 里没有法典项。
  inv.location = 'theOldMill'
  assert.equal(chapter.codexEntryAvailableAt(state, 'theOldMill', 0).number, 12)
  // 地点 → 法典编号映射与印刷卡面一致。
  const expected = {
    theCrossroads: 10, boardingHouse: 9, hemlockChapel: 11, theOldMill: 12,
    theAtwoodHouse: 13, tadsGeneralStore: 14, valeSchoolhouse: 15, theCommons: 16,
  }
  assert.deepEqual({ ...chapter.LOCATION_CODEX_NUMBERS }, expected)
})

test('P7 welcomeToHemlockVale 法典：14 号塔德杂货店对每位调查员各可结算一次', () => {
  const { state } = setup(2)
  const [first, second] = state.investigators
  first.location = 'tadsGeneralStore'
  second.location = 'tadsGeneralStore'
  first.deck = [itemCode, '01001']
  second.deck = [itemCode, '01002']
  const entry = chapter.codexEntryForLocation('tadsGeneralStore')
  assert.equal(entry.limit, chapter.CODEX_LIMIT_UNLIMITED)
  assert.equal(chapter.codexAvailable(state, entry, 0), true)
  // 花费 1 资源检索物品并免费打出。
  const receipt = chapter.resolveCodexEntry(state, 14, 0, choiceApi(['spend']))
  assert.equal(receipt.number, 14)
  assert.equal(receipt.played, itemCode)
  assert.equal(first.resources, 4)
  assert.ok(first.assets.some(asset => asset.code === itemCode), '物品免费进入游戏区域')
  assert.equal(first.deck.includes(itemCode), false)
  assert.equal(first.hand.length, 0)
  // 同一位调查员不能重复；另一位还可以。
  assert.equal(chapter.codexAvailable(state, entry, 0), false)
  assert.equal(chapter.resolveCodexEntry(state, 14, 0), false)
  assert.equal(chapter.codexAvailable(state, entry, 1), true)
  assert.equal(chapter.resolveCodexEntry(state, 14, 1, choiceApi(['skip'])).number, 14)
  assert.deepEqual(state.scenarioFlags.welcomeCodexSeats['tadsGeneralStore'], [0, 1])
})

// ---------------------------------------------------------------------------
// 7. 居民访问 / 谈判后读法典
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 居民访问：地点法典放入居民，谈判成功后读居民法典', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  inv.location = 'boardingHouse'
  // 旅舍法典 9 放入瑞玟（不选择抽牌/资源时默认抽牌）。
  const visit = chapter.resolveCodexEntry(state, 9, 0, choiceApi(['draw']))
  assert.equal(visit.resident, 'riverHawthorne')
  const river = chapter.residentInPlay(state, 'riverHawthorne')
  assert.equal(river.location, 'boardingHouse')
  // 谈判规格来自印刷卡面（10697：意志或智力 3）。
  const spec = chapter.residentParleySpec(river, state)
  assert.deepEqual(spec.skills, ['willpower', 'intellect'])
  assert.equal(spec.difficulty, 3)
  assert.equal(spec.codexNumber, 5)
  assert.equal(chapter.residentParleySpec('10693', state).difficulty, 2)
  assert.deepEqual(chapter.residentParleySpec('10693', state).skills, ['willpower'])
  // 谈判成功后读居民法典 5：+3 资源、关系等级 +1。
  const resourcesBefore = inv.resources
  const receipt = chapter.completeResidentParley(state, '10697', 0, quietApi())
  assert.equal(receipt.number, 5)
  assert.equal(inv.resources, resourcesBefore + 3)
  assert.equal(chapter.residentLevel(state, 'riverHawthorne'), 1)
  assert.equal(state.campaign.records.riverHawthorneRelationshipLevel, 1)
  // 不在同一地点时不能读该居民的条目。
  const { state: other } = setup(1)
  const otherInv = other.investigators[0]
  otherInv.location = 'theCrossroads'
  chapter.putResidentInPlay(other, 'gideonMizrah', quietApi(), { location: 'theCommons' })
  assert.equal(chapter.codexAvailable(other, 6, 0), false)
  // 事件回派：api.resolveScenarioEvent 的口径（共享组条目用）。
  const eventState = setup(1).state
  eventState.investigators[0].location = 'theCommons'
  chapter.putResidentInPlay(eventState, 'gideonMizrah', quietApi(), { location: 'theCommons' })
  const eventReceipt = chapter.events.welcomeToHemlockValeResidentParley(eventState,
    { code: '10698', seat: 0 }, choiceApi([]))
  assert.equal(eventReceipt.number, 6)
  assert.equal(chapter.residentLevel(eventState, 'gideonMizrah'), 1)
  // 关系等级上限 5（日志五格）。
  for (let i = 0; i < 10; i += 1) chapter.addResidentRelationship(eventState, 'gideonMizrah', 1)
  assert.equal(chapter.residentLevel(eventState, 'gideonMizrah'), 5)
})

test('P7 welcomeToHemlockVale 老磨坊：发现线索后的反应读法典 12 并让莉亚入场', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  inv.location = 'theOldMill'
  const mill = state.locations.find(location => location.id === 'theOldMill')
  // 反应可选：选「跳过」不结算。
  assert.equal(chapter.afterInvestigate(state, inv, mill, { success: true }, choiceApi(['skip'])), false)
  assert.equal(chapter.codexResolved(state, 12), false)
  // 选「读法典」：莉亚·阿特伍德在老磨坊入场、抽 1 张（默认抽牌）。
  const handBefore = inv.hand.length
  assert.equal(chapter.afterInvestigate(state, inv, mill, { success: true }, choiceApi(['read'])), true)
  const leah = chapter.residentInPlay(state, 'leahAtwood')
  assert.equal(leah.location, 'theOldMill')
  assert.equal(chapter.residentLevel(state, 'leahAtwood'), 0, '地点法典只放入居民，不提升关系等级')
  assert.equal(inv.hand.length, handBefore + 1)
  assert.equal(chapter.codexResolved(state, 12), true)
  // 一次性：第二次成功调查不再触发。
  assert.equal(chapter.afterInvestigate(state, inv, mill, { success: true }, choiceApi(['read'])), false)
  // 失败调查不触发；其它地点的反应不接管。
  const otherState = setup(1).state
  otherState.investigators[0].location = 'theOldMill'
  assert.equal(chapter.afterInvestigate(otherState, otherState.investigators[0],
    otherState.locations.find(location => location.id === 'theOldMill'), { success: false }, choiceApi(['read'])), false)
  assert.equal(chapter.afterInvestigate(state, inv,
    state.locations.find(location => location.id === 'boardingHouse'), { success: true }, choiceApi(['read'])), false)
})

// ---------------------------------------------------------------------------
// 8. 幕与议程推进
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 幕背面「光辉」：每位调查员 1 点奖励经验且不结束序曲', () => {
  const { state } = setup(2)
  assert.equal(chapter.checkObjectives(state, quietApi()), false, '幕没有数值目标，不会自动推进')
  assert.equal(chapter.isBrillianceRevealed(state), false)
  const api = { info: () => {}, finished: null, finish(key) { this.finished = key } }
  assert.equal(chapter.actReveal(state, state.acts[0], api), true)
  assert.equal(api.finished, null, '翻幕背面不会结束序曲')
  assert.equal(chapter.isBrillianceRevealed(state), true)
  assert.equal(state.campaign.records.welcomeToHemlockValeBonusXp, 2)
  assert.equal(state.campaign.records.welcomeToHemlockValeTheBrilliance, true)
  // 幂等：再次翻面不再加经验。
  chapter.actReveal(state, state.acts[0], api)
  assert.equal(state.campaign.records.welcomeToHemlockValeBonusXp, 2)
  // 非本章幕不接管。
  assert.equal(chapter.actReveal(state, { originalCode: '99999' }, api), false)
})

test('P7 welcomeToHemlockVale 议程背面：所有调查员撤退 → 结局 1 与战役记录', () => {
  const { state } = setup(2)
  state.doom = 6
  assert.equal(chapter.agendaDoomReached(state), true)
  const api = {
    info: () => {}, finished: null,
    finish(key) { this.finished = key },
    resign(seat) { state.investigators[seat].resigned = true },
  }
  assert.equal(chapter.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(api.finished, 'resolution1')
  assert.equal(state.investigators.every(inv => inv.resigned === true), true)
  const records = state.campaign.records
  assert.equal(records.welcomeToHemlockValeResolution, 'resolution1')
  assert.equal(records.welcomeToHemlockValeResolutionReason, 'agendaBack')
  assert.deepEqual(records.welcomeToHemlockValeSurveyChoices, [...chapter.SURVEY_DESTINATIONS])
  assert.equal(records.day, 1)
  assert.equal(records.time, 'Day')
  // 结局钩子：序曲没有胜利点，「光辉」之外没有额外经验。
  // R1 的 [autoFail] 由战役层 flow.js#chaosBagTransitions（触发本章的结局记录）加入，章内不重复加。
  const resolution = chapter.resolution(state, 'resolution1', null, quietApi())
  assert.equal(resolution.award, true)
  assert.equal(resolution.bonus, 0)
  assert.equal(state.chaosBag.filter(token => token === 'autofail').length, 0)
  const receipt = chapter.scenarioResolution(state, 'resolution1', quietApi())
  assert.equal(receipt.resolution, 'resolution1')
  assert.deepEqual(receipt.surveyChoices, [...chapter.SURVEY_DESTINATIONS])
  // 非本章议程不接管。
  assert.equal(chapter.agendaReveal(state, { originalCode: '99999' }, api), false)
})

test('P7 welcomeToHemlockVale 全员撤退：直接进入结局 1（不落到无结局）', () => {
  const { state } = setup(1)
  const api = { info: () => {}, finished: null, finish(key) { this.finished = key } }
  assert.equal(chapter.allResigned(state, api), true)
  assert.equal(api.finished, 'resolution1')
  assert.equal(state.campaign.records.welcomeToHemlockValeResolutionReason, 'resigned')
  // 无 api.finish 时只写 state.resolution（内容层直调口径）。
  const { state: bare } = setup(1)
  chapter.allResigned(bare, { info: () => {} })
  assert.equal(bare.resolution, 'resolution1')
})

// ---------------------------------------------------------------------------
// 9. 混乱标记（10704 正/背面）
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 混乱标记：四档取值、手牌阈值与谈判追加效果', () => {
  const day2 = stateWithScenario(1, { hemlockDate: '2:day' })
  day2.scenarioFlags.mechanics = { version: 1, scenarioDate: { day: 2, period: 'day' } }
  const hand = ['a', 'b', 'c']
  day2.investigators[0].hand = hand
  assert.equal(chapter.dayOf(day2), 2)
  assert.equal(chapter.skullValue(day2), 2)
  assert.equal(chapter.welcomeChaosToken(day2, day2.investigators[0], 'skull').delta, -2)
  day2.difficulty = 'hard'
  assert.equal(chapter.skullValue(day2), 3, '困难：天数 +1')
  assert.equal(chapter.welcomeChaosToken(day2, day2.investigators[0], 'skull').delta, -3)
  // 石板：简单/普通 <3 张 → 0，否则 -2；困难/专家 <2 张 → -2，否则 -4。
  day2.difficulty = 'standard'
  day2.investigators[0].hand = ['a', 'b']
  assert.equal(chapter.tabletValue(day2, day2.investigators[0]), 0)
  day2.investigators[0].hand = [...hand]
  assert.equal(chapter.tabletValue(day2, day2.investigators[0]), -2)
  day2.difficulty = 'expert'
  day2.investigators[0].hand = ['a']
  assert.equal(chapter.tabletValue(day2, day2.investigators[0]), -2)
  day2.investigators[0].hand = [...hand]
  assert.equal(chapter.tabletValue(day2, day2.investigators[0]), -4)
  // 异教徒：简单/普通 +1（谈判自动成功）；困难/专家 -1（谈判改 +1）。
  const standard = stateWithScenario(1)
  standard.investigators[0].hand = [...hand]
  const easyCultist = chapter.welcomeChaosToken(standard, standard.investigators[0], 'cultist')
  assert.equal(easyCultist.delta, 1)
  assert.deepEqual(easyCultist.onDraw, [])
  const parleyCultist = chapter.welcomeChaosToken({ ...standard, skillTest: { actionKind: 'parley' } },
    standard.investigators[0], 'cultist')
  assert.equal(parleyCultist.delta, 1)
  assert.equal(parleyCultist.onDraw[0].mode, 'parleyAutoSuccess')
  // 谈判判定也读 testTarget.actionKind 与 currentActionKind（引擎的三个读点）。
  assert.equal(chapter.isParleyTest({ skillTest: { testTarget: { actionKind: 'parley' } } }), true)
  assert.equal(chapter.isParleyTest({ currentActionKind: 'parley' }), true)
  assert.equal(chapter.isParleyTest({ skillTest: { actionKind: 'fight' }, currentActionKind: 'fight' }), false)
  const hard = stateWithScenario(1)
  hard.difficulty = 'hard'
  assert.equal(chapter.welcomeChaosToken(hard, hard.investigators[0], 'cultist').delta, -1)
  assert.equal(chapter.welcomeChaosToken({ ...hard, skillTest: { actionKind: 'parley' } },
    hard.investigators[0], 'cultist').delta, 1)
  // 古神：-1 / -3；谈判尝试「再揭示一个标记」由 drawAnother 交给引擎揭示循环。
  assert.equal(chapter.welcomeChaosToken(hard, hard.investigators[0], 'elderthing').delta, -3)
  assert.equal(chapter.welcomeChaosToken(hard, hard.investigators[0], 'elderthing').drawAnother, false)
  assert.equal(chapter.welcomeChaosToken({ ...hard, skillTest: { actionKind: 'parley' } },
    hard.investigators[0], 'elderthing').drawAnother, true)
  // 未登记的标记交回引擎默认表。
  assert.equal(chapter.welcomeChaosToken(standard, standard.investigators[0], 'bless'), null)
  // 印刷文本与提示卡 10704 一致。
  for (const token of ['skull', 'cultist', 'tablet', 'elderthing']) {
    assert.ok(ALL_CARDS['10704'].text.includes(chapter.WELCOME_TOKEN_MEANINGS.easy[token].text))
    assert.ok(ALL_CARDS['10704'].backText.includes(chapter.WELCOME_TOKEN_MEANINGS.hard[token].text))
  }
  assert.deepEqual(chapter.TOKEN_FACES, { front: 'easyStandard', back: 'hardExpert' })
})

test('P7 welcomeToHemlockVale 混乱标记结算：谈判自动成功落到 applyTokenEffect', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  state.skillTest = { actionKind: 'parley', autoSuccess: false }
  const autoApi = { info: () => {}, auto: 0, setTestAutoSuccess() { this.auto += 1 } }
  const outcome = chapter.resolveChaosToken(state, inv, 'cultist', autoApi)
  assert.equal(outcome.delta, 1)
  assert.equal(autoApi.auto, 1, '有 api.setTestAutoSuccess 时走 api')
  assert.equal(state.skillTest.autoSuccess, false)
  // 没有该 api 时写引擎既有读点 state.skillTest.autoSuccess。
  state.skillTest.autoSuccess = false
  chapter.resolveChaosToken(state, inv, 'cultist', { info: () => {} })
  assert.equal(state.skillTest.autoSuccess, true)
  // applyTokenEffect 同一效果的另一条入口。
  state.skillTest.autoSuccess = false
  assert.equal(chapter.applyTokenEffect(state, inv, { token: 'cultist', mode: 'parleyAutoSuccess' }, { info: () => {} }), true)
  assert.equal(state.skillTest.autoSuccess, true)
  // 非谈判不触发。
  state.skillTest = { actionKind: 'fight', autoSuccess: false }
  chapter.resolveChaosToken(state, inv, 'cultist', { info: () => {} })
  assert.equal(state.skillTest.autoSuccess, false)
})

// ---------------------------------------------------------------------------
// 10. 存档 JSON 往返
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 存档往返：布置/法典/关系/日期都按 JSON 还原', () => {
  const { state } = setup(2)
  state.investigators[0].location = 'theCrossroads'
  chapter.resolveCodexEntry(state, 10, 0, choiceApi(['draw']))
  state.doom = 4
  const saved = JSON.stringify(state)
  const loaded = JSON.parse(saved)
  assert.deepEqual(loaded.scenarioFlags.mechanics.scenarioDate, { day: 1, period: 'day' })
  assert.deepEqual(chapter.resolvedCodexKeys(loaded), ['theCrossroads'])
  assert.equal(chapter.residentInPlay(loaded, 'theoPeters').location, 'theCrossroads')
  assert.equal(chapter.timeMarkerInPlay(loaded).code, '10675')
  assert.equal(chapter.dayOf(loaded), 1)
  assert.equal(loaded.doom, 4)
  assert.equal(chapter.codexResolved(loaded, 10), true)
  assert.equal(chapter.codexAvailable(loaded, 10, 1), false)
  // 读档后仍可继续结算并写结局记录。
  loaded.investigators[1].location = 'boardingHouse'
  chapter.resolveCodexEntry(loaded, 9, 1, choiceApi(['resource']))
  assert.equal(chapter.residentInPlay(loaded, 'riverHawthorne').location, 'boardingHouse')
  chapter.completePrelude(loaded, quietApi(), { reason: 'resolution' })
  assert.equal(loaded.campaign.records.welcomeToHemlockValeResolution, 'resolution1')
  assert.equal(JSON.parse(JSON.stringify(loaded)).campaign.records.welcomeToHemlockValeResolution, 'resolution1')
})

// ---------------------------------------------------------------------------
// 11. 行动清单
// ---------------------------------------------------------------------------

test('P7 welcomeToHemlockVale 行动：八处地点的法典与三处特殊地点行动、十字路口快速移动', () => {
  const { state } = setup(2)
  const inv = state.investigators[0]
  const rulesAt = locationId => {
    inv.location = locationId
    return chapter.actions(state, inv).map(move => move.rule)
  }
  assert.ok(rulesAt('theCrossroads').includes('welcomeCodex'))
  assert.ok(rulesAt('boardingHouse').includes('welcomeBoardingHouseHeal'))
  assert.ok(rulesAt('hemlockChapel').includes('welcomeChapelSearchSpell'))
  assert.ok(rulesAt('valeSchoolhouse').includes('welcomeSchoolhouseSearchTome'))
  for (const id of chapter.LOCATION_IDS) {
    if (id === 'theOldMill') continue // 老磨坊是「发现线索后」的反应，不是 [action]。
    assert.ok(rulesAt(id).includes('welcomeCodex'), `每处地点都有法典行动：${id}`)
  }
  // 老磨坊：没有 [action] 法典，改用 afterInvestigate 反应。
  assert.equal(rulesAt('theOldMill').includes('welcomeCodex'), false)
  assert.deepEqual([...chapter.REACTION_CODEX_LOCATIONS], ['theOldMill'])
  // 塔德杂货店的法典行动印着 Parley。
  const parleyMove = (() => { inv.location = 'tadsGeneralStore'
    return chapter.actions(state, inv).find(move => move.rule === 'welcomeCodex') })()
  assert.equal(parleyMove.actionKind, 'parley')
  // 2 位调查员时十字路口有 [fast] 移动；3 位时没有。
  inv.location = 'theCrossroads'
  const fast = chapter.actions(state, inv).find(move => move.rule === 'welcomeCrossroadsMove')
  assert.equal(fast.actions, 0)
  assert.equal(fast.fast, true)
  const three = setup(3)
  three.state.investigators[0].location = 'theCrossroads'
  assert.equal(chapter.actions(three.state, three.state.investigators[0])
    .some(move => move.rule === 'welcomeCrossroadsMove'), false)
  // 旅舍治愈每场游戏一次。
  inv.location = 'boardingHouse'
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeBoardingHouseHeal' }, choiceApi(['damage'])), true)
  assert.equal(state.scenarioFlags.welcomeLimits.welcomeBoardingHouseHeal, true)
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeBoardingHouseHeal' }, choiceApi(['damage'])), false)
  assert.equal(chapter.actions(state, inv).find(move => move.rule === 'welcomeBoardingHouseHeal').reason != null, true)
  // 教堂检索法术（顶 9 张）。
  state.investigators[0].deck = [spellCode, '01001']
  inv.location = 'hemlockChapel'
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeChapelSearchSpell' }, quietApi()), true)
  assert.equal(inv.hand.includes(spellCode), true)
  // 十字路口快速移动团队每轮一次。
  inv.location = 'theCrossroads'
  const destination = state.locations.find(location => location.id !== 'theCrossroads').id
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeCrossroadsMove' },
    choiceApi([destination])), true)
  assert.equal(inv.location, destination)
  inv.location = 'theCrossroads'
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeCrossroadsMove' },
    choiceApi([destination])), false)
  state.round = 2
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeCrossroadsMove' },
    choiceApi([destination])), true, '新一轮可以再用')
  // 学校检索书籍（整副牌库）。
  const tomeCode = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
    && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'tome'))
  state.investigators[0].location = 'valeSchoolhouse'
  state.investigators[0].deck = [tomeCode, '01001']
  assert.equal(chapter.performAction(state, inv, { rule: 'welcomeSchoolhouseSearchTome' }, quietApi()), true)
  assert.equal(state.investigators[0].hand.includes(tomeCode), true)
  assert.ok(allyCode || true)
})

// ---------------------------------------------------------------------------
// 12. 与共享遭遇组数据型条目的互操作（按卡号读 flags）
// ---------------------------------------------------------------------------

// 共享组条目（the_vale 地点 / residents 居民）是数据型条目：规则写在章节 behavior，条目只声明
// flags。这里注册这些条目，验证 behavior 确实按卡号读到 flags，而不是各自维护第二份数值。
const SHARED_ENTRY_MODULES = [
  ...['10705a', '10706a', '10707a', '10708a', '10709a', '10710a', '10711a', '10712a']
    .map(code => `../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/the_vale/${code}.js`),
  ...['10693', '10694', '10695', '10696', '10697', '10698', '10699', '10700']
    .map(code => `../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/residents/${code}.js`),
]
const { registerCardAbilities: registerShared, registeredEntry: sharedEntry } =
  await import('../src/engine/ability.js')
for (const modulePath of SHARED_ENTRY_MODULES) {
  const mod = await import(modulePath)
  if (!sharedEntry(mod.default.code)) registerShared([mod.default])
}

test('P7 welcomeToHemlockVale 共享组互操作：法典编号/检索参数/谈判规格都读条目的 flags', () => {
  // 地点：actionCodex / reactionAfterDiscoverClue 与定义表一致。
  for (const id of chapter.LOCATION_IDS) {
    const flags = sharedEntry(chapter.LOCATIONS[id].code).flags
    assert.equal(chapter.codexNumberForLocation(id), flags.codexNumber)
    if (chapter.REACTION_CODEX_LOCATIONS.includes(id)) {
      assert.equal(chapter.actionCodexNumberForLocation(id), null)
      assert.equal(chapter.reactionCodexNumberForLocation(id), flags.reactionAfterDiscoverClue.codexNumber)
    } else {
      assert.equal(chapter.actionCodexNumberForLocation(id), flags.actionCodex)
      assert.equal(chapter.reactionCodexNumberForLocation(id), null)
    }
  }
  // 居民：谈判规格（技能/难度/行动数）与条目 flags.parley 一致。
  for (const resident of chapter.RESIDENTS) {
    const flags = sharedEntry(resident.assetCode).flags
    const spec = chapter.residentParleySpec(resident.assetCode)
    assert.deepEqual(spec.skills, [...flags.parley.skills])
    assert.equal(spec.difficulty, flags.parley.difficulty)
    assert.equal(spec.actions, flags.parley.actions)
    assert.equal(spec.codexNumber, flags.codexNumber)
  }
  // 共享组居民的「谈判成功后读法典」回派：条目调用 resolveScenarioEvent('welcomeToHemlockValeResidentParley')。
  const { state } = setup(1)
  const inv = state.investigators[0]
  inv.location = 'theCrossroads'
  chapter.putResidentInPlay(state, 'theoPeters', quietApi(), { location: 'theCrossroads' })
  const receipt = chapter.events.welcomeToHemlockValeResidentParley(state,
    { code: '10700', resident: 'theoPeters', id: '10700', seat: 0 }, choiceApi([]))
  assert.equal(receipt.number, 8)
  assert.equal(chapter.residentLevel(state, 'theoPeters'), 1)
  // 地点行动读 flags 的检索参数（教堂 = 顶 9 张 [[法术]]）。
  inv.location = 'hemlockChapel'
  const chapelSearch = chapter.actions(state, inv).find(move => move.rule === 'welcomeChapelSearchSpell')
  assert.deepEqual(chapelSearch.search, { from: 'top9', count: 9, traits: ['Spell'] })
  // 塔德杂货店：flags.parley 让法典行动作为谈判结算。
  inv.location = 'tadsGeneralStore'
  assert.equal(chapter.actions(state, inv).find(move => move.rule === 'welcomeCodex').actionKind, 'parley')
})
