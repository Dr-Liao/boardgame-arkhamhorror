// P7 最终之夜（preludeTheFinalEvening · 10679b）章节测试。
//
// 覆盖：章节结构（8 处地点 / 22 条图标连接 / 幕·议程共用 Around the Table / 4 个结局 /
// 无遭遇牌库）、序曲打印正文（base.json 的 prelude4 段）、序章三选一（真话/谎话/判处死刑）、
// 布置（六位在场居民与关系等级阈值、划掉莉亚、伯蒂显灵、马奎兹、狂乱的赴宴者、时间指示卡、
// 初始毁灭）、居民关系等级与笔记/划掉、18 条法典（分支条件、一次性、Atwood House 遗产选择）、
// 传家宝（本序曲不发放）、时间推进（第三日夜 + 前往《山谷的命运》）、结局链（无结局/R1→R4/
// R2→R3/R3 重玩或输掉/R4 经验）、待宰羔羊议程的居民胜利区、混乱标记四档与谈判分支、
// JSON 存档往返与逐条披露。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as chapter from '../content/campaigns/theFeastOfHemlockVale/scenarios/preludeTheFinalEvening/index.js'
import {
  chapterChineseGaps, chapterStory, flattenStory,
} from '../content/campaigns/theFeastOfHemlockVale/story-access.js'

const {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_IDS, LOCATION_TABLE,
  MAP_GRID, SYMBOL_BY_LOCATION, LOCATION_ID_BY_SYMBOL, REMOVED_LOCATIONS, REMOVED_LOCATION_CODES,
  START_LOCATION, START_LOCATION_WHEN_INTERRUPTED, THE_CROSSROADS_ID, THE_ATWOOD_HOUSE_ID,
  THE_COMMONS_ID, THE_OLD_MILL_ID, HEMLOCK_CHAPEL_ID, VALE_SCHOOLHOUSE_ID, BOARDING_HOUSE_ID,
  ACT_ID, AGENDA_ID, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, AGENDA_DOOM_THRESHOLD,
  SPECIAL_AGENDA_CODE, SPECIAL_AGENDA_STAGE, SPECIAL_AGENDA_DOOM_THRESHOLD, RESIDENTS,
  RESIDENT_BY_ID, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE, RESIDENT_ASSET_CODES,
  RESIDENT_ENEMY_CODES, RESIDENT_FLIP_THRESHOLDS, RESIDENT_MAX_RELATIONSHIP, SET_ASIDE_RESIDENT_IDS,
  DR_MARQUEZ_CODE, BERTIE_ASSET_CODE, BERTIE_ENEMY_CODE, FRENZIED_REVELER_CODE, CODEX_IDS,
  CODEX_BY_ID, CODEX_SPEC, CODEX_BONUS_XP, CODEX_LIMIT_UNLIMITED, THEATWOOD_HASHING_RECORD,
  SET_ASIDE_CARDS, ENCOUNTER_DECK, HEIRLOOM_CODES, PRELUDE_HEIRLOOM_REWARDS, RECORD_KEYS,
  RESOLUTION_KEYS, NO_RESOLUTION, NEXT_SCENARIO_ID, SCENARIO_TEXT, SETUP_STEPS, CARD_DATA,
  TIME_MARKER, TIME_MARKER_CODE, PRELUDE_DATE, PRELUDE_DATE_RECORD, CHAPTER_ID, REFERENCE_CODE, STEP_CODE,
  THE_FINAL_EVENING_TOKEN_MEANINGS, theFinalEveningChaosToken, isParleyAttempt, dayNumber,
  periodOfDay, behavior, layout, manifest, approximations,
} = chapter

const clone = value => JSON.parse(JSON.stringify(value))
// 正文读取口径（与 definition.js 相同）：`text(key)` 取 `prelude4.<key>` 叶子，`rawText(key)` 取原路径；
// 叶子有中译（`sections`）时用中译，否则回退英文（`sectionsEn`）。
const GUIDE = chapterStory(CHAPTER_ID)
const leaf = fullKey => flattenStory(GUIDE.sections?.[fullKey] ?? GUIDE.sectionsEn?.[fullKey] ?? '')
const enLeaf = fullKey => String(GUIDE.sectionsEn?.[fullKey] ?? '')
// 北角矿井已勘察：Leah 不会被开场划掉（多数布置测试需要她入场）。
const SURVEYED = Object.freeze({ areasSurveyedNorthPointMine: true })

const stateFor = (investigatorCount = 2, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: ['01001', '01002'], discard: [], threat: [], hand: ['01003'],
    trauma: { physical: 0, mental: 0 },
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {},
    chaosBag: [] },
  chaosBag: [], victoryDisplay: [], victory: 0, doom: 0, difficulty: 'standard',
  numInvestigators: investigatorCount, phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 2, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  return state
}
const quietApi = () => ({ info: () => {} })
/** 依次给出答案的 choose 桩；没有答案时取第一个选项。 */
const choosingApi = (answers = []) => {
  const queue = [...answers]
  const api = { info: () => {}, asked: [] }
  api.choose = request => {
    api.asked.push(request)
    const answer = queue.length ? queue.shift() : request.options?.[0]?.id
    return answer
  }
  return api
}
const setup = (count = 2, records = {}, api = quietApi()) => {
  const state = stateWithScenario(count, records)
  behavior.preScenarioSetup(state, [], api)
  const placed = behavior.setupLocations(state, [], { api })
  behavior.setupEnemies(state, [], { api })
  const report = behavior.afterDeckSetup(state, [], { api })
  return { state, placed, report }
}
const enemiesAt = (state, locationId) => (state.enemies || []).filter(enemy => enemy.location === locationId)
const assetsAt = (state, locationId) => (state.storyAssets || []).filter(asset => asset.location === locationId)
const residentEnemy = (state, residentId) => behavior.residentEnemyInPlay(state, residentId)
const residentAsset = (state, residentId) => behavior.residentAssetInPlay(state, residentId)
const withNotes = (id, notes, extra = {}) => ({
  [RESIDENT_BY_ID[id].record.notes]: [...notes], ...extra,
})

// ---------------------------------------------------------------------------
// 1. 章节结构 / 印刷正文
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 章节结构：序曲、8 处地点、单幕单议程、4 个结局、无遭遇牌库', () => {
  assert.equal(chapter.scenario.id, 'preludeTheFinalEvening')
  assert.equal(CHAPTER_ID, 'preludeTheFinalEvening')
  assert.equal(REFERENCE_CODE, '10704')
  assert.equal(STEP_CODE, '10679b')
  assert.equal(chapter.scenario.isPrelude, true)
  // 正文语言与自译层一致：有中译 → zh-CN（自译层，不冒充官方中文），否则英文回退；
  // 缺译逐条登记（`chineseGaps` = 未翻译叶子数，见 story-access）。
  const translatedLeaves = Object.values(GUIDE.sections || {}).filter(value => value != null).length
  const totalLeaves = Object.keys(GUIDE.sectionsEn || {}).length
  assert.equal(chapter.scenario.textLanguage, translatedLeaves > 0 ? 'zh-CN' : 'en')
  assert.equal(SCENARIO_TEXT.textLanguage, chapter.scenario.textLanguage)
  assert.equal(chapterChineseGaps(CHAPTER_ID).length, totalLeaves - translatedLeaves)
  assert.equal(manifest.status, 'playable')
  assert.equal(manifest.campaignId, 'theFeastOfHemlockVale')
  assert.equal(manifest.referenceCode, '10704')
  assert.equal(manifest.isPrelude, true)
  assert.equal(manifest.nextScenarioId, 'fateOfTheVale')
  assert.equal(Object.keys(LOCATIONS).length, 8)
  assert.equal(manifest.locations.length, 8)
  assert.deepEqual([...ACT_CODES], ['10688'])
  assert.deepEqual([...AGENDA_CODES], ['10688'])
  assert.equal(ACT_ID, 'act10688')
  assert.equal(AGENDA_ID, 'agenda10688')
  assert.equal(AGENDA_DOOM_THRESHOLD, 6, 'Around the Table 的印刷毁灭阈值')
  assert.equal(SPECIAL_AGENDA_DOOM_THRESHOLD, 5, '待宰羔羊的印刷毁灭阈值')
  assert.equal(manifest.acts.length, 1)
  assert.equal(manifest.agendas.length, 1)
  assert.deepEqual([...RESOLUTION_KEYS], ['resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 5)
  assert.equal(ENCOUNTER_DECK.length, 0, '序曲没有遭遇牌库')
  assert.deepEqual(manifest.zones.encounterDeck, [])
  assert.equal(chapter.scenario.mechanics.noEncounterDeck, true)
  assert.equal(behavior.id, 'preludeTheFinalEvening')
  assert.equal(behavior.isPrelude, true)
  assert.deepEqual([...chapter.implementedEncounterCodes], [], '本序曲不新建单卡条目')
  assert.equal(CARD_DATA['10679'].code, '10679')
  assert.equal(CARD_DATA['10704'].name, 'The Vale')
})

test('P7 preludeTheFinalEvening 印刷正文：序章/11 条布置/5 条战役规则/18 条法典/5 段结局来自 story-access', () => {
  // 印刷正文逐条来自 story-access：章节字段与指南叶子逐字一致（有中译取中译），英文源正文不得缺失。
  const wired = [
    [SCENARIO_TEXT.heading, 'prelude4.intro.title', 'Final Evening'],
    [SCENARIO_TEXT.intro, 'prelude4.intro.intro1', 'Intro 1'],
    [SCENARIO_TEXT.intro2, 'prelude4.intro.intro2', 'Intro 2'],
    [SCENARIO_TEXT.introBranches.intro3, 'prelude4.intro.intro3', 'Intro 3'],
    [SCENARIO_TEXT.introBranches.intro4, 'prelude4.intro.intro4', 'Intro 4'],
    [SCENARIO_TEXT.introBranches.intro5, 'prelude4.intro.intro5', 'Intro 5'],
    [SCENARIO_TEXT.introConditions.doneNothingWrongTruth, 'prelude4.intro.doneNothingWrongTruth', 'Relationship Level is 3'],
    [SCENARIO_TEXT.tokens.easyStandard.skull, 'tokens.easyStandard.skull', 'current day number'],
    [SCENARIO_TEXT.resolutions.resolution4.body, 'prelude4.resolutions.resolution4.body', 'Resolution 4'],
  ]
  for (const [value, key, needle] of wired) {
    assert.equal(value, leaf(key), `${key} 与指南叶子一致`)
    assert.ok(enLeaf(key).includes(needle), `${key} 的英文源正文`)
  }
  assert.equal(SETUP_STEPS.length, 11)
  assert.deepEqual(SETUP_STEPS.map(step => step.key), [
    'gatherSets', 'dayThree', 'buildActAgenda', 'placeLocations', 'crossroadsAndOldMill',
    'frenziedRevelers', 'residents', 'removeResidents', 'placeResidents', 'startAt', 'placeDoom',
  ])
  assert.equal(SCENARIO_TEXT.setup, SETUP_STEPS.map(step => step.text).join('\n\n'))
  assert.ok(enLeaf('prelude4.setup.dayThree').includes('Day Three'))
  assert.equal(SCENARIO_TEXT.specialRules.length, 5, '法典/三天三夜/居民关系/地点相邻/昼夜')
  assert.equal(SCENARIO_TEXT.campaignRules.length, 8)
  for (const index of [0, 1, 2, 3, 5]) {
    const rule = SCENARIO_TEXT.specialRules.find(item => item.key === `campaignRule${index}`)
    assert.ok(rule, `战役规则 ${index} 应在面板规则里`)
    assert.equal(rule.title, leaf(`specialRules[${index}].title`), `战役规则 ${index} 标题`)
    assert.equal(rule.body, leaf(`specialRules[${index}].body`), `战役规则 ${index} 正文`)
  }
  assert.equal(SCENARIO_TEXT.rules.codex, leaf('additionalRulesAndClarifications.theCodex'))
  assert.ok(enLeaf('additionalRulesAndClarifications.theCodex').includes('Codex'))
  assert.equal(SCENARIO_TEXT.rules.locationAdjacency, leaf('additionalRulesAndClarifications.locationAdjacency'))
  assert.ok(enLeaf('additionalRulesAndClarifications.locationAdjacency').includes('connection icons'))
  assert.equal(SCENARIO_TEXT.rules.residents, leaf('additionalRulesAndClarifications.residentsAndRelationshipLevels'))
  assert.ok(enLeaf('additionalRulesAndClarifications.residentsAndRelationshipLevels').includes('Relationship Level'))
  assert.ok(SCENARIO_TEXT.rules.threeDays.length > 0)
  assert.equal(Object.keys(SCENARIO_TEXT.codex).length, 18)
  assert.equal(SCENARIO_TEXT.codex.motherRachel.believed, leaf('prelude4.codex.motherRachel.believed'))
  assert.ok(enLeaf('prelude4.codex.motherRachel.believed').includes('Lambs to the Slaughter'))
  assert.ok(SCENARIO_TEXT.codex.theAtwoodHouse.label.letFight.length > 0)
  assert.equal(SCENARIO_TEXT.codexLabels.askMine, leaf('prelude4.codex.leahAtwood.label.askMine'))
  assert.ok(enLeaf('prelude4.codex.leahAtwood.label.askMine').includes('North Point Mine'))
  assert.ok(SCENARIO_TEXT.resolutionLabels.replay.length > 0)
  assert.ok(SCENARIO_TEXT.resolutionLabels.loseTheCampaign.length > 0)
  assert.equal(Object.keys(SCENARIO_TEXT.resolutions).length, 5)
  // 缺译披露：有缺译时 textStatus 标注英文回退；已收敛时标 translated。
  assert.equal(SCENARIO_TEXT.chineseGaps.length, chapterChineseGaps(CHAPTER_ID).length)
  if (SCENARIO_TEXT.chineseGaps.length > 0) assert.equal(SCENARIO_TEXT.textStatus.includes('en fallback'), true)
  else assert.equal(SCENARIO_TEXT.textStatus, 'translated')
})

// ---------------------------------------------------------------------------
// 2. 地图 / 符号连接
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 地图：6×3 印刷符号格、8 个符号各占两格、坐标取中点', () => {
  assert.equal(MAP_GRID.length, 6)
  assert.deepEqual(MAP_GRID[2], ['moon', 'diamond', 'star'])
  assert.deepEqual(MAP_GRID[5], ['.', 'circle', 'spade'])
  assert.equal(Object.keys(SYMBOL_BY_LOCATION).length, 8)
  const symbols = Object.values(SYMBOL_BY_LOCATION)
  for (const symbol of symbols) {
    const cells = MAP_GRID.flat().filter(cell => cell === symbol)
    assert.equal(cells.length, 2, `符号 ${symbol} 占两格`)
    assert.ok(LOCATION_ID_BY_SYMBOL[symbol], `符号 ${symbol} 有对应地点`)
  }
  assert.deepEqual(LOCATION_COORDINATES[THE_CROSSROADS_ID], { x: 1, y: 2.5 })
  assert.deepEqual(LOCATION_COORDINATES[HEMLOCK_CHAPEL_ID], { x: 1, y: 0.5 })
  assert.deepEqual(LOCATION_COORDINATES[THE_ATWOOD_HOUSE_ID], { x: 0, y: 1.5 })
  assert.deepEqual(LOCATION_COORDINATES[BOARDING_HOUSE_ID], { x: 1, y: 4.5 })
  for (const [, , symbol] of LOCATION_TABLE) assert.ok(chapter.PRELUDE_SYMBOLS[symbol], `符号表含 ${symbol}`)
})

test('P7 preludeTheFinalEvening 连接：只按印刷图标连接（十字路口连全部、共 11 对）', () => {
  const names = Object.keys(LOCATION_CONNECTIONS)
  assert.deepEqual(names.sort(), [...LOCATION_IDS].sort())
  assert.equal(LOCATION_CONNECTIONS[THE_CROSSROADS_ID].length, 6, '十字路口连其余六处')
  assert.deepEqual([...LOCATION_CONNECTIONS[BOARDING_HOUSE_ID]].sort(),
    [THE_CROSSROADS_ID, VALE_SCHOOLHOUSE_ID].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS[THE_ATWOOD_HOUSE_ID]].sort(),
    [THE_CROSSROADS_ID, HEMLOCK_CHAPEL_ID, THE_OLD_MILL_ID].sort())
  assert.deepEqual([...LOCATION_CONNECTIONS[VALE_SCHOOLHOUSE_ID]].sort(),
    [THE_COMMONS_ID, BOARDING_HOUSE_ID].sort())
  let pairs = 0
  for (const [from, targets] of Object.entries(LOCATION_CONNECTIONS)) {
    for (const to of targets) {
      assert.ok(LOCATION_CONNECTIONS[to].includes(from), `${from} ↔ ${to} 双向`)
      pairs += 1
    }
  }
  assert.equal(pairs, 22, '11 对双向链接')
  assert.equal(layout.locations[THE_CROSSROADS_ID].x, 1)
  assert.equal(layout.edges.length, 22)
  // 移出游戏的 The Vale 十字路口/老磨坊：只登记卡号，不入场也不进 manifest。
  assert.deepEqual([...REMOVED_LOCATION_CODES].sort(), ['10706a', '10706b', '10708a', '10708b'].sort())
  assert.equal(REMOVED_LOCATIONS.length, 2)
  assert.equal(manifest.locations.some(row => row.frontCode === '10706a'), false)
  assert.deepEqual([...manifest.removedLocationCodes].sort(), [...REMOVED_LOCATION_CODES].sort())
})

test('P7 preludeTheFinalEvening 地点数值：帷幕来自印刷，老磨坊 1 线索/人、其余 0', () => {
  assert.equal(LOCATIONS[THE_CROSSROADS_ID].shroud, 3)
  assert.equal(LOCATIONS[THE_OLD_MILL_ID].shroud, 4)
  assert.equal(LOCATIONS[THE_COMMONS_ID].shroud, 1)
  assert.equal(LOCATIONS[THE_ATWOOD_HOUSE_ID].shroud, 4)
  assert.equal(LOCATIONS['tadsGeneralStore'].shroud, 2)
  assert.equal(LOCATIONS[THE_OLD_MILL_ID].cluesPerInvestigator, 1)
  for (const id of LOCATION_IDS.filter(id => id !== THE_OLD_MILL_ID)) {
    assert.equal(LOCATIONS[id].cluesPerInvestigator, 0, `${id} 序曲没有线索`)
  }
  assert.equal(LOCATIONS[THE_CROSSROADS_ID].name, '十字路口')
  assert.equal(LOCATIONS[THE_CROSSROADS_ID].nameEn, 'The Crossroads')
  assert.equal(LOCATIONS[THE_CROSSROADS_ID].symbol, 'diamond')
  assert.equal(scenario.startLocation, THE_CROSSROADS_ID)
})

// ---------------------------------------------------------------------------
// 3. 居民 / 放一边
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 居民：11 位双面卡、9 个敌人面、5 个关系等级上限', () => {
  assert.equal(RESIDENTS.length, 11)
  assert.equal(RESIDENT_ASSET_CODES.length, 11)
  assert.equal(RESIDENT_ENEMY_CODES.length, 9)
  assert.equal(RESIDENT_MAX_RELATIONSHIP, 5)
  for (const resident of RESIDENTS) {
    assert.equal(resident.record.max, RESIDENT_MAX_RELATIONSHIP)
    assert.ok(RESIDENT_BY_ASSET_CODE[resident.assetCode], `${resident.id} 资产面`)
    if (resident.enemyCode) assert.ok(RESIDENT_BY_ENEMY_CODE[resident.enemyCode], `${resident.id} 敌人面`)
  }
  assert.deepEqual({ ...RESIDENT_FLIP_THRESHOLDS }, {
    leahAtwood: 2, simeonAtwood: 3, gideonMizrah: 3, judithPark: 2, theoPeters: 2,
  })
  assert.deepEqual([...SET_ASIDE_RESIDENT_IDS], ['williamHemlock', 'riverHawthorne', 'helenPeters'])
  assert.equal(RESIDENT_BY_ASSET_CODE[DR_MARQUEZ_CODE].id, 'drRosaMarquez')
  assert.equal(RESIDENT_BY_ENEMY_CODE[BERTIE_ENEMY_CODE].id, 'bertieMusgrave')
  assert.equal(chapter.scenario.mechanics.residents.length, 11)
  for (const row of chapter.scenario.mechanics.residents) {
    assert.equal(row.record.max, RESIDENT_MAX_RELATIONSHIP)
    assert.ok(row.name && row.nameEn)
  }
})

test('P7 preludeTheFinalEvening 放一边：整组 Residents 20 面 + 特别议程，序曲牌库为空', () => {
  assert.equal(SET_ASIDE_CARDS.length, 21)
  assert.ok(SET_ASIDE_CARDS.includes(SPECIAL_AGENDA_CODE))
  for (const code of [...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES]) {
    assert.ok(SET_ASIDE_CARDS.includes(code), `${code} 放一边`)
  }
  assert.deepEqual(manifest.zones.setAside.find(row => row.cardCode === SPECIAL_AGENDA_CODE),
    { cardCode: '10689', count: 1 })
  assert.equal(manifest.zones.setAside.length, 21)
  assert.deepEqual(manifest.zones.inPlay, [{ cardCode: TIME_MARKER_CODE, count: 1 }])
  assert.deepEqual([...chapter.UNUSED_ENCOUNTER_CODES], ['10680'])
  assert.equal(chapter.GATHER_GROUPS.length, 4)
  assert.deepEqual([...chapter.GATHER_SET_ASIDE_GROUPS], ['residents'])
  assert.deepEqual([...manifest.requiredEncounterGroupIds].sort(),
    ['dayOfTheFeast', 'residents', 'theFinalDay', 'theVale'].sort())
})

// ---------------------------------------------------------------------------
// 4. 序章（PreScenarioSetup）
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 序章：没有「马奎兹有计划」直接 Intro 5 → [tablet]+[elder_thing]', () => {
  const api = choosingApi()
  const state = stateWithScenario(2)
  behavior.preScenarioSetup(state, [], api)
  assert.deepEqual(api.asked, [], '没有计划时不问三选一')
  assert.equal(state.scenarioFlags.preludeIntro, 'sentencedToDeath')
  assert.deepEqual(state.scenarioFlags.preludeIntroTokens, ['tablet', 'elderthing'])
  assert.equal(state.campaign.records[RECORD_KEYS.interrupted], true)
  assert.equal(state.campaign.records[RECORD_KEYS.believed], undefined)
  // afterChaosBagSetup 才真正入袋（一次性）
  const added = behavior.afterChaosBagSetup(state, [], quietApi())
  assert.equal(added, 2)
  assert.deepEqual(behavior.chaosBagCounts(state), { tablet: 1, elderthing: 1 })
  assert.deepEqual(state.campaign.chaosBag, ['tablet', 'elderthing'], '标记持续到战役结束')
  assert.equal(behavior.afterChaosBagSetup(state, [], quietApi()), 0, '只入袋一次')
})

test('P7 preludeTheFinalEvening 序章：有计划 + 关系等级 3 → 三个选项；真话移除马奎兹并记录', () => {
  const records = { [RECORD_KEYS.drMarquezHasAPlan]: true, motherRachelRelationshipLevel: 3 }
  const api = choosingApi(['doneNothingWrongTruth'])
  const state = stateWithScenario(2, records)
  state.investigators[0].deck.push(DR_MARQUEZ_CODE)
  state.investigators[1].hand.push(DR_MARQUEZ_CODE)
  behavior.preScenarioSetup(state, [], api)
  assert.equal(api.asked.length, 1)
  assert.deepEqual(api.asked[0].options.map(option => option.id),
    ['doneNothingWrongTruth', 'doneNothingWrongLie', 'sentencedToDeath'])
  assert.equal(state.campaign.records[RECORD_KEYS.believed], true)
  assert.equal(state.campaign.records[RECORD_KEYS.interrupted], undefined)
  assert.equal(state.investigators[0].deck.includes(DR_MARQUEZ_CODE), false)
  assert.equal(state.investigators[1].hand.includes(DR_MARQUEZ_CODE), false)
  assert.deepEqual(state.scenarioFlags.preludeIntroTokens, ['cultist'])
  behavior.afterChaosBagSetup(state, [], quietApi())
  assert.deepEqual(behavior.chaosBagCounts(state), { cultist: 1 })
})

test('P7 preludeTheFinalEvening 序章：关系等级不足时不给「你没有任何错」；谎话加 [cultist]+[elder_thing]', () => {
  const low = stateWithScenario(2, { [RECORD_KEYS.drMarquezHasAPlan]: true, motherRachelRelationshipLevel: 2 })
  const plan = behavior.introPlan(low)
  assert.equal(plan.hasPlan, true)
  assert.deepEqual(plan.options, ['sentencedToDeath'])
  const records = { [RECORD_KEYS.drMarquezHasAPlan]: true, motherRachelRelationshipLevel: 3 }
  const api = choosingApi(['doneNothingWrongLie'])
  const state = stateWithScenario(2, records)
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records[RECORD_KEYS.lied], true)
  behavior.afterChaosBagSetup(state, [], quietApi())
  assert.deepEqual(behavior.chaosBagCounts(state), { cultist: 1, elderthing: 1 })
  assert.equal(behavior.applyIntroTokens(state, quietApi()), 0)
})

// ---------------------------------------------------------------------------
// 5. 布置（Setup）
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 布置：8 处地点入场，老磨坊 1 线索/人、其余 0', () => {
  const { state, placed } = setup(3)
  assert.equal(placed.length, 8)
  assert.deepEqual(placed, ['boardingHouse', THE_CROSSROADS_ID, HEMLOCK_CHAPEL_ID,
    THE_ATWOOD_HOUSE_ID, 'tadsGeneralStore', VALE_SCHOOLHOUSE_ID, THE_COMMONS_ID, THE_OLD_MILL_ID])
  assert.equal(state.locations.length, 8)
  assert.equal(state.locations.find(loc => loc.id === THE_OLD_MILL_ID).clues, 3, '1 线索 × 3 人')
  assert.equal(state.locations.find(loc => loc.id === THE_COMMONS_ID).clues, 0)
  assert.equal(state.locations.every(loc => loc.revealed), true)
  assert.equal(state.acts.length, 1)
  assert.equal(state.agendas.length, 1)
  assert.equal(state.agendas[0].id, AGENDA_ID)
  assert.equal(state.agendas[0].doomThreshold, AGENDA_DOOM_THRESHOLD)
  assert.equal(state.acts[0].id, ACT_ID)
  assert.equal(state.acts[0].type, 'act')
  assert.deepEqual(state.scenarioZones.removed, [...REMOVED_LOCATION_CODES])
})

test('P7 preludeTheFinalEvening 布置：关系等级默认 0 → 五位居民以敌人面进场，蕾切尔仍是资产', () => {
  const { state } = setup(2, SURVEYED)
  const rachel = residentAsset(state, 'motherRachel')
  assert.ok(rachel, '蕾切尔嬷嬷资产面在十字路口')
  assert.equal(rachel.location, THE_CROSSROADS_ID)
  for (const [id, locationId] of [['leahAtwood', HEMLOCK_CHAPEL_ID], ['simeonAtwood', VALE_SCHOOLHOUSE_ID],
    ['gideonMizrah', THE_COMMONS_ID], ['judithPark', THE_OLD_MILL_ID], ['theoPeters', 'tadsGeneralStore']]) {
    const enemy = residentEnemy(state, id)
    assert.ok(enemy, `${id} 敌人面`)
    assert.equal(enemy.location, locationId)
    assert.equal(enemy.code, RESIDENT_BY_ID[id].enemyCode)
    assert.equal(residentAsset(state, id), null)
  }
  assert.equal(state.storyAssets.filter(asset => asset.residentId).length, 1, '只有蕾切尔资产面')
})

test('P7 preludeTheFinalEvening 布置：关系等级高于阈值 → 资产面；蕾切尔不受阈值影响', () => {
  const records = {
    leahAtwoodRelationshipLevel: 3, simeonAtwoodRelationshipLevel: 4, gideonMizrahRelationshipLevel: 4,
    judithParkRelationshipLevel: 3, theoPetersRelationshipLevel: 3, motherRachelRelationshipLevel: 5,
  }
  const { state } = setup(2, { ...records, ...SURVEYED })
  for (const id of ['motherRachel', 'leahAtwood', 'simeonAtwood', 'gideonMizrah', 'judithPark', 'theoPeters']) {
    assert.ok(residentAsset(state, id), `${id} 资产面`)
    assert.equal(residentEnemy(state, id), null)
  }
  assert.equal(state.storyAssets.filter(asset => asset.residentId).length, 6)
  assert.equal(state.enemies.length, 1, '只剩狂乱的赴宴者')
})

test('P7 preludeTheFinalEvening 布置：阈值边界（等于阈值即翻面）与 3 人时第二张狂乱的赴宴者', () => {
  const equal = setup(2, { ...SURVEYED, leahAtwoodRelationshipLevel: RESIDENT_FLIP_THRESHOLDS.leahAtwood })
  assert.ok(residentEnemy(equal.state, 'leahAtwood'), '关系等级 = 阈值 → 敌人面')
  const above = setup(2, { ...SURVEYED, leahAtwoodRelationshipLevel: RESIDENT_FLIP_THRESHOLDS.leahAtwood + 1 })
  assert.ok(residentAsset(above.state, 'leahAtwood'), '关系等级 = 阈值 + 1 → 资产面')
  const two = setup(2, SURVEYED)
  assert.equal(enemiesAt(two.state, THE_COMMONS_ID).filter(enemy => enemy.code === FRENZIED_REVELER_CODE).length, 1)
  assert.equal(enemiesAt(two.state, HEMLOCK_CHAPEL_ID).filter(enemy => enemy.code === FRENZIED_REVELER_CODE).length, 0)
  const three = setup(3, SURVEYED)
  assert.equal(enemiesAt(three.state, THE_COMMONS_ID).filter(enemy => enemy.code === FRENZIED_REVELER_CODE).length, 1)
  assert.equal(enemiesAt(three.state, HEMLOCK_CHAPEL_ID).filter(enemy => enemy.code === FRENZIED_REVELER_CODE).length, 1)
})

test('P7 preludeTheFinalEvening 布置：北角矿井未勘察 → 划掉莉亚并移出游戏', () => {
  const { state } = setup(2)
  assert.equal(state.campaign.records.leahCrossedOut, true)
  assert.equal(residentEnemy(state, 'leahAtwood'), null, '划掉的居民不进敌人面')
  assert.equal(residentAsset(state, 'leahAtwood'), null)
  assert.ok(residentEnemy(state, 'simeonAtwood'))
  const surveyed = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true })
  assert.equal(surveyed.state.campaign.records.leahCrossedOut, undefined)
  assert.ok(residentEnemy(surveyed.state, 'leahAtwood'), '已勘察 → 莉亚照常入场')
})

test('P7 preludeTheFinalEvening 布置：伯蒂显灵 → 敌人在十字路口；被打断 → 马奎兹归调查员', () => {
  const records = { [RECORD_KEYS.bertieHadAnEpiphany]: true, [RECORD_KEYS.interrupted]: true }
  const api = choosingApi(['1'])
  const { state } = setup(2, records, api)
  const bertie = residentEnemy(state, 'bertieMusgrave')
  assert.ok(bertie)
  assert.equal(bertie.location, THE_CROSSROADS_ID)
  assert.equal(bertie.code, BERTIE_ENEMY_CODE)
  const marquez = state.investigators[1].assets.find(asset => asset.code === DR_MARQUEZ_CODE
    || asset.originalCode === DR_MARQUEZ_CODE)
  assert.ok(marquez, '马奎兹由座位 1 控制')
  assert.equal(marquez.controllerSeat, 1)
  assert.equal(state.storyAssets.some(asset => asset.code === DR_MARQUEZ_CODE), false)
  // 没有显灵时伯蒂留在放一边。
  const plain = setup(2)
  assert.equal(residentEnemy(plain.state, 'bertieMusgrave'), null)
  assert.ok(plain.state.scenarioZones.setAsideResidents.includes('bertieMusgrave'))
})

test('P7 preludeTheFinalEvening 布置：时间指示卡（第三夜）、初始毁灭 = 人数、日历记录', () => {
  const { state, report } = setup(3, SURVEYED)
  const marker = state.storyAssets.find(asset => asset.code === TIME_MARKER_CODE)
  assert.ok(marker, '时间指示卡入场')
  assert.equal(marker.face, 'back')
  assert.equal(marker.name, 'Night Three')
  assert.equal(marker.day, 3)
  assert.equal(marker.period, 'night')
  assert.equal(state.doom, 3, '毁灭 = 调查员人数')
  assert.equal(report.doom, 3)
  assert.deepEqual(state.scenarioFlags.mechanics.scenarioDate, { day: 3, period: 'night' })
  assert.equal(state.campaign.records[PRELUDE_DATE_RECORD], '3:night')
  assert.deepEqual(behavior.scenarioDateOf(state), { day: 3, period: 'night' })
  assert.deepEqual(report.date, { day: 3, period: 'night' })
  assert.equal(state.scenarioFlags.mechanics.version, 1, 'mechanicState 存档形状')
})

test('P7 preludeTheFinalEvening 布置：开场地点随「盛宴被打断」切换（引擎 startLocation 读点）', () => {
  assert.equal(behavior.startLocation(stateWithScenario(2)), START_LOCATION)
  assert.equal(behavior.startLocation(stateWithScenario(2, { [RECORD_KEYS.interrupted]: true })),
    START_LOCATION_WHEN_INTERRUPTED)
  const interruptedPlan = behavior.setupPlan(stateWithScenario(2, { [RECORD_KEYS.interrupted]: true }))
  assert.equal(interruptedPlan.startLocation, BOARDING_HOUSE_ID)
  assert.equal(START_LOCATION_WHEN_INTERRUPTED, 'boardingHouse')
})

// ---------------------------------------------------------------------------
// 6. 居民关系等级 / 笔记 / 划掉（道别）
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 关系等级：增减一格、上限 5、双写引擎读点', () => {
  const state = stateWithScenario(2)
  assert.equal(behavior.relationshipLevel(state, 'leahAtwood'), 0)
  assert.equal(behavior.changeRelationship(state, 'leahAtwood', 1), 1)
  assert.equal(state.campaign.records.leahAtwoodRelationshipLevel, 1)
  assert.equal(state.campaign.records.relationships.leahAtwood, 1, 'P7 各章通用口径')
  behavior.changeRelationship(state, 'leahAtwood', 9)
  assert.equal(behavior.relationshipLevel(state, 'leahAtwood'), RESIDENT_MAX_RELATIONSHIP)
  behavior.changeRelationship(state, 'leahAtwood', -2)
  assert.equal(behavior.relationshipLevel(state, 'leahAtwood'), RESIDENT_MAX_RELATIONSHIP - 2)
  assert.equal(behavior.setRelationshipLevel(state, 'leahAtwood', 0), 0)
  assert.equal(behavior.relationshipLevel(state, 'leahAtwood'), 0)
  assert.equal(behavior.relationshipLevel(state, 'nobody'), 0)
})

test('P7 preludeTheFinalEvening 笔记与划掉：笔记集合、划掉后笔记作废且关系不再变', () => {
  const state = stateWithScenario(2)
  assert.equal(behavior.addResidentNote(state, 'gideonMizrah', RECORD_KEYS.gideonFoundHisTreasure), true)
  assert.equal(behavior.addResidentNote(state, 'gideonMizrah', RECORD_KEYS.gideonFoundHisTreasure), false,
    '同一条笔记只记一次')
  assert.deepEqual(behavior.residentNotes(state, 'gideonMizrah'), [RECORD_KEYS.gideonFoundHisTreasure])
  assert.equal(behavior.hasResidentNote(state, 'gideonMizrah', RECORD_KEYS.gideonFoundHisTreasure), true)
  behavior.changeRelationship(state, 'gideonMizrah', 2)
  assert.equal(behavior.crossOutResident(state, 'gideonMizrah'), true)
  assert.equal(behavior.crossOutResident(state, 'gideonMizrah'), false, '已划掉不重复')
  assert.equal(behavior.isResidentCrossedOut(state, 'gideonMizrah'), true)
  assert.equal(state.campaign.records.gideonCrossedOut, true)
  assert.equal(behavior.changeRelationship(state, 'gideonMizrah', 1), null, '划掉后不能变')
  assert.equal(behavior.addResidentNote(state, 'gideonMizrah', 'another'), false)
  assert.equal(behavior.relationshipLevel(state, 'gideonMizrah'), 2, '划掉只作废笔记，关系数值保留')
})

test('P7 preludeTheFinalEvening 道别：在场居民可被取得控制权，不在场的不可', () => {
  const { state } = setup(2, {
    ...SURVEYED, leahAtwoodRelationshipLevel: 4, simeonAtwoodRelationshipLevel: 4,
    gideonMizrahRelationshipLevel: 4, judithParkRelationshipLevel: 4, theoPetersRelationshipLevel: 4,
  })
  assert.equal(behavior.takeControlOfResident(state, 'leahAtwood', 0), true)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === RESIDENT_BY_ID.leahAtwood.assetCode))
  assert.equal(behavior.residentAssetInPlay(state, 'leahAtwood').controllerSeat, 0)
  assert.equal(state.storyAssets.some(asset => asset.code === RESIDENT_BY_ID.leahAtwood.assetCode), false)
  assert.equal(behavior.takeControlOfResident(state, 'williamHemlock', 0), false, '放一边的居民不在场')
})

// ---------------------------------------------------------------------------
// 7. 法典（Codex）
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 法典声明：18 条、引擎 normalizeCodex 形状、限次与居民记录键', () => {
  assert.equal(CODEX_IDS.length, 18)
  assert.equal(chapter.scenario.mechanics.codex.length, 18)
  assert.equal(CODEX_SPEC.length, 18)
  assert.equal(CODEX_BY_ID.drRosaMarquez.number, 100, 'Θ = 100')
  assert.equal(CODEX_BY_ID.bertieMusgrave.number, 101, 'Ω = 101')
  assert.equal(CODEX_BY_ID.theAtwoodHouse.limit, CODEX_LIMIT_UNLIMITED, '印刷「You may trigger this codex again」')
  for (const entry of chapter.scenario.mechanics.codex) {
    assert.ok(entry.branches.length >= 1)
    for (const branch of entry.branches) {
      assert.equal(typeof branch.id, 'string')
      if (!entry.resident) assert.equal(Object.keys(branch).length, 1, `${entry.id} 地点条目不能带条件`)
    }
    if (entry.resident) {
      for (const key of [entry.resident.relationship, entry.resident.notes, entry.resident.crossedOut]) {
        assert.equal(typeof key, 'string')
      }
    }
  }
  // 笔记条件严格来自该居民自己的笔记（印刷「Only refer to that character's Notes」）。
  const leahBranch = CODEX_SPEC.find(entry => entry.id === 'leahAtwood').branches
  assert.deepEqual(leahBranch[0].notes, [RECORD_KEYS.leahSawSomethingInTheMine])
  assert.deepEqual(leahBranch[1].withoutNotes, [RECORD_KEYS.leahSawSomethingInTheMine])
  assert.equal(behavior.codexReadable(stateWithScenario(2), 'leahAtwood'), true)
})

test('P7 preludeTheFinalEvening 法典分支：相信/撒谎/否则 与 烟花/笔记条件', () => {
  const plain = stateWithScenario(2)
  assert.equal(behavior.codexBranch(plain, 'motherRachel'), 'otherwise')
  assert.equal(behavior.codexBranch(stateWithScenario(2, { [RECORD_KEYS.believed]: true }), 'motherRachel'), 'believed')
  assert.equal(behavior.codexBranch(stateWithScenario(2, { [RECORD_KEYS.lied]: true }), 'motherRachel'), 'lied')
  assert.equal(behavior.codexBranch(plain, 'simeonAtwood'), 'otherwise')
  assert.equal(behavior.codexBranch(stateWithScenario(2, { [RECORD_KEYS.valeIsFullOfFireworks]: true }), 'simeonAtwood'), 'fireworks')
  const sawMine = stateWithScenario(2, withNotes('leahAtwood', [RECORD_KEYS.leahSawSomethingInTheMine]))
  assert.equal(behavior.codexBranch(sawMine, 'leahAtwood'), 'sawMine')
  assert.equal(behavior.codexBranch(plain, 'gideonMizrah'), 'otherwise')
  assert.equal(behavior.codexBranch(stateWithScenario(2,
    withNotes('gideonMizrah', [RECORD_KEYS.gideonToldTheTaleOfTheAnnabelleLee, RECORD_KEYS.gideonFoundHisTreasure])),
  'gideonMizrah'), 'toldTale')
  assert.equal(behavior.codexBranch(stateWithScenario(2, withNotes('judithPark', [RECORD_KEYS.youBackedJudithUp])),
    'judithPark'), 'backedUp')
  const theoBoth = stateWithScenario(2, withNotes('theoPeters',
    [RECORD_KEYS.theoIsHavingSecondThoughts, RECORD_KEYS.theoReconciledWithHelen]))
  assert.equal(behavior.codexBranch(theoBoth, 'theoPeters'), 'both')
  assert.equal(behavior.codexBranch(stateWithScenario(2, withNotes('theoPeters', [RECORD_KEYS.theoIsHavingSecondThoughts])),
    'theoPeters'), 'secondThoughts')
  assert.equal(behavior.codexBranch(plain, 'theoPeters'), 'otherwise')
  assert.equal(behavior.codexBranch(plain, ATWOOD_HOUSE_ENTRY_KEY), 'otherwise')
})

const ATWOOD_HOUSE_ENTRY_KEY = 'theAtwoodHouse'

test('P7 preludeTheFinalEvening 法典 1：撒谎 → 蕾切尔翻面并受 2 点伤害；否则 → 只翻面', () => {
  const lied = setup(2, { [RECORD_KEYS.lied]: true }).state
  assert.equal(behavior.codexEntry(lied, 0, 'motherRachel', quietApi()), true)
  const rachel = residentEnemy(lied, 'motherRachel')
  assert.ok(rachel, '蕾切尔翻到敌人面')
  assert.equal(rachel.damageTaken, 2)
  assert.equal(lied.campaign.records[RECORD_KEYS.codexRead].includes('motherRachel'), true)
  assert.equal(behavior.codexEntry(lied, 0, 'motherRachel', quietApi()), false, '一次性')

  const plain = setup(2).state
  assert.equal(behavior.codexEntry(plain, 0, 'motherRachel', quietApi()), true)
  assert.ok(residentEnemy(plain, 'motherRachel'))
  assert.equal(residentEnemy(plain, 'motherRachel').damageTaken, 0)
})

test('P7 preludeTheFinalEvening 法典 1（相信）：其余居民翻面、放一边居民以敌人面进场、换议程', () => {
  const state = setup(2, {
    ...SURVEYED, [RECORD_KEYS.believed]: true, leahAtwoodRelationshipLevel: 5, simeonAtwoodRelationshipLevel: 5,
    gideonMizrahRelationshipLevel: 5, judithParkRelationshipLevel: 5, theoPetersRelationshipLevel: 5,
  }).state
  assert.equal(state.storyAssets.filter(asset => asset.residentId).length, 6, '六位居民资产面')
  assert.equal(state.doom, 2)
  assert.equal(behavior.codexEntry(state, 0, 'motherRachel', quietApi()), true)
  // 蕾切尔是「相信」的一方：她保持资产面，其余五位居民全部翻面
  for (const id of ['leahAtwood', 'simeonAtwood', 'gideonMizrah', 'judithPark', 'theoPeters']) {
    assert.ok(residentEnemy(state, id), `${id} 翻到敌人面`)
  }
  assert.ok(residentAsset(state, 'motherRachel'), '蕾切尔仍以资产面在场')
  assert.equal(residentEnemy(state, 'motherRachel'), null)
  // 放一边的两位赫姆洛克以敌人面进入空地点
  assert.ok(residentEnemy(state, 'williamHemlock') || residentEnemy(state, 'riverHawthorne'))
  assert.equal(state.scenarioZones.setAsideResidents.includes('williamHemlock'), false)
  // 毁灭清空 + 换上待宰羔羊
  assert.equal(state.doom, 0)
  assert.equal(state.agendas[0].code, SPECIAL_AGENDA_CODE)
  assert.equal(state.agendas[0].doomThreshold, SPECIAL_AGENDA_DOOM_THRESHOLD)
  assert.equal(state.scenarioZones.setAside.includes(SPECIAL_AGENDA_CODE), false)
  assert.equal(state.scenarioFlags.preludeLambsAgenda, true)
})

test('P7 preludeTheFinalEvening 法典 2：见过矿井 → 问出来关系归零 / 不问则招募', () => {
  const base = () => setup(2, {
    ...withNotes('leahAtwood', [RECORD_KEYS.leahSawSomethingInTheMine], { leahAtwoodRelationshipLevel: 4 }),
    [RECORD_KEYS.areasSurveyedNorthPointMine]: true,
  }).state
  const ask = base()
  assert.equal(behavior.codexEntry(ask, 0, 'leahAtwood', choosingApi(['askMine'])), true)
  assert.equal(behavior.relationshipLevel(ask, 'leahAtwood'), 0)
  const silent = base()
  assert.equal(behavior.codexEntry(silent, 0, 'leahAtwood', choosingApi(['sayNothing'])), true)
  assert.equal(behavior.relationshipLevel(silent, 'leahAtwood'), 5)
  assert.equal(silent.investigators[0].assets.some(asset => asset.code === RESIDENT_BY_ID.leahAtwood.assetCode), true,
    '取得莉亚的控制权')
  assert.equal(behavior.bonusXp(silent), 1)
  assert.equal(silent.investigators.every(inv => inv.scenarioXpBonus === 1), true)
})

test('P7 preludeTheFinalEvening 法典 2/3/6/7：否则分支各 +1 关系与 +1 奖励经验', () => {
  const state = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  behavior.changeRelationship(state, 'simeonAtwood', 0)
  for (const [entry, residentId] of [['leahAtwood', 'leahAtwood'], ['simeonAtwood', 'simeonAtwood'],
    ['gideonMizrah', 'gideonMizrah'], ['judithPark', 'judithPark']]) {
    const before = behavior.relationshipLevel(state, residentId)
    const xpBefore = behavior.bonusXp(state)
    assert.equal(behavior.codexEntry(state, 0, entry, quietApi()), true)
    assert.equal(behavior.relationshipLevel(state, residentId), before + 1)
    assert.equal(behavior.bonusXp(state), xpBefore + 1)
  }
  // 印刷「Turn it into a fountain of fireworks」：Simeon 的烟花分支 +2 关系、+2 经验并取得控制权。
  const fireworks = setup(2, { [RECORD_KEYS.valeIsFullOfFireworks]: true }).state
  assert.equal(behavior.codexEntry(fireworks, 0, 'simeonAtwood', quietApi()), true)
  assert.equal(behavior.relationshipLevel(fireworks, 'simeonAtwood'), 2)
  assert.equal(behavior.bonusXp(fireworks), 2)
})

test('P7 preludeTheFinalEvening 法典 6/7：吉迪恩的传说 + 宝藏 → 记录完成；朱迪思被支持 → 白打武器', () => {
  const gideon = setup(2, withNotes('gideonMizrah',
    [RECORD_KEYS.gideonToldTheTaleOfTheAnnabelleLee, RECORD_KEYS.gideonFoundHisTreasure])).state
  assert.equal(behavior.codexEntry(gideon, 0, 'gideonMizrah', quietApi()), true)
  assert.equal(gideon.campaign.records[RECORD_KEYS.gideonFinishedTheTaleOfAnnabelleLee], true)
  assert.equal(behavior.relationshipLevel(gideon, 'gideonMizrah'), 1)
  assert.equal(behavior.bonusXp(gideon), 2)

  const judith = setup(2, withNotes('judithPark', [RECORD_KEYS.youBackedJudithUp])).state
  judith.investigators[0].hand.push('01020')
  judith.cards = { 1020: {}, '01020': { type: 'asset' } }
  assert.equal(behavior.codexEntry(judith, 0, 'judithPark', choosingApi(['01020'])), true)
  assert.equal(judith.investigators[0].hand.includes('01020'), false, '武器已打出')
  assert.equal(judith.investigators[0].assets.some(asset => asset.code === '01020'), true)
  assert.equal(behavior.relationshipLevel(judith, 'judithPark'), 1)
  assert.equal(behavior.bonusXp(judith), 2)
})

test('P7 preludeTheFinalEvening 法典 4/5：一位赫姆洛克入主，另一位关系归零并在阿特伍德宅翻面', () => {
  const state = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  // 法典 13 先把威廉带进场（资产面），然后才能读法典 4 取得控制权。
  behavior.obtainSetAsideResident(state, 'williamHemlock')
  behavior.placeResidentAsset(state, 'williamHemlock', THE_ATWOOD_HOUSE_ID, quietApi())
  behavior.changeRelationship(state, 'riverHawthorne', 3)
  assert.equal(behavior.codexEntry(state, 0, 'williamHemlock', quietApi()), true)
  assert.equal(behavior.relationshipLevel(state, 'williamHemlock'), 1)
  assert.equal(behavior.relationshipLevel(state, 'riverHawthorne'), 0)
  const river = residentEnemy(state, 'riverHawthorne')
  assert.ok(river, '里弗以敌人面在阿特伍德宅')
  assert.equal(river.location, THE_ATWOOD_HOUSE_ID)
  assert.equal(state.investigators.some(inv => inv.assets.some(asset => asset.code === RESIDENT_BY_ID.williamHemlock.assetCode)), true)
  assert.equal(behavior.bonusXp(state), 2)
})

test('P7 preludeTheFinalEvening 法典 8：西奥两种记录 → +2 经验；否则只取得控制权', () => {
  const both = setup(2, withNotes('theoPeters',
    [RECORD_KEYS.theoIsHavingSecondThoughts, RECORD_KEYS.theoReconciledWithHelen],
    { theoPetersRelationshipLevel: 4 })).state
  assert.equal(behavior.codexEntry(both, 0, 'theoPeters', quietApi()), true)
  assert.equal(behavior.relationshipLevel(both, 'theoPeters'), 5)
  assert.equal(behavior.bonusXp(both), 2)
  const plain = setup(2, { theoPetersRelationshipLevel: 4 }).state
  assert.equal(behavior.codexEntry(plain, 0, 'theoPeters', quietApi()), true)
  assert.equal(behavior.relationshipLevel(plain, 'theoPeters'), 4, '否则分支不改关系')
  assert.equal(behavior.bonusXp(plain), 0)
  assert.equal(plain.investigators[0].assets.some(asset => asset.code === RESIDENT_BY_ID.theoPeters.assetCode), true)
})

test('P7 preludeTheFinalEvening 法典 9–16：抽牌/资源、敌人搬家、躲避居民、移动加行动', () => {
  // 9 旅舍：抽 3 张或得 3 资源
  const boarding = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  boarding.investigators[0].deck = ['01001', '01002', '01003', '01004']
  assert.equal(behavior.codexEntry(boarding, 0, 'boardingHouse', choosingApi(['draw'])), true)
  assert.equal(boarding.investigators[0].hand.length, 4, '原 1 张 + 抽 3 张')
  const resources = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  assert.equal(behavior.codexEntry(resources, 0, 'boardingHouse', choosingApi(['resource'])), true)
  assert.equal(resources.investigators[0].resources, 8)
  // 11 教堂：抽 1 或 1 资源
  const chapel = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  assert.equal(behavior.codexEntry(chapel, 0, 'hemlockChapel', choosingApi(['resource'])), true)
  assert.equal(chapel.investigators[0].resources, 6)
  // 10 十字路口：把敌人移到十字路口、横置并解除交战
  const crossroads = setup(2, SURVEYED)
  const target = residentEnemy(crossroads.state, 'theoPeters')
  crossroads.state.investigators[0].location = 'tadsGeneralStore'
  target.engagedSeat = 0
  assert.equal(behavior.codexEntry(crossroads.state, 0, 'theCrossroads', choosingApi([target.id])), true)
  assert.equal(target.location, THE_CROSSROADS_ID)
  assert.equal(target.exhausted, true)
  assert.equal(target.engagedSeat, null)
  // 14 杂货店：3 资源
  const store = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  assert.equal(behavior.codexEntry(store, 0, 'tadsGeneralStore', quietApi()), true)
  assert.equal(store.investigators[0].resources, 8)
  // 12 老磨坊 / 15 学校：躲避相邻[[居民]]敌人
  const mill = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true })
  mill.state.investigators[0].location = THE_OLD_MILL_ID
  const judith = residentEnemy(mill.state, 'judithPark')
  assert.equal(behavior.codexEntry(mill.state, 0, 'theOldMill', quietApi()), true)
  assert.equal(judith.exhausted, true, '检定任意技能 (2) 成功 → 自动躲避')
  const school = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true })
  school.state.investigators[0].location = VALE_SCHOOLHOUSE_ID
  const simeon = residentEnemy(school.state, 'simeonAtwood')
  assert.equal(behavior.codexEntry(school.state, 0, 'valeSchoolhouse', quietApi()), true)
  assert.equal(simeon.exhausted, true)
  // 16 社群大厅：立刻移动到别处并 +1 行动
  const commons = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true })
  commons.state.investigators[0].location = THE_COMMONS_ID
  assert.equal(behavior.codexEntry(commons.state, 0, 'theCommons', choosingApi([BOARDING_HOUSE_ID])), true)
  assert.equal(commons.state.investigators[0].location, BOARDING_HOUSE_ID)
  assert.equal(commons.state.investigators[0].extraActions, 1)
})

test('P7 preludeTheFinalEvening 法典 Θ/Ω：抽 5 张指定调查员；弃 3 张并记录伯蒂遇难', () => {
  const theta = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  theta.investigators[1].deck = ['01001', '01002', '01003', '01004', '01005', '01006']
  assert.equal(behavior.codexEntry(theta, 0, 'drRosaMarquez', choosingApi(['1'])), true)
  assert.equal(theta.investigators[1].hand.length, 6, '座位 1 抽 5 张')
  const omega = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  omega.investigators[0].hand = ['01001', '01002', '01003', '01004']
  assert.equal(behavior.codexEntry(omega, 0, 'bertieMusgrave', quietApi()), true)
  assert.equal(omega.investigators[0].hand.length, 1)
  assert.equal(omega.investigators[0].discard.length, 3)
  assert.equal(omega.campaign.records[RECORD_KEYS.bertiePerished], true)
})

test('P7 preludeTheFinalEvening 法典屏障：划掉的居民读不到、已读不再触发', () => {
  const state = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  assert.equal(behavior.codexReadable(state, 'leahAtwood'), true)
  behavior.crossOutResident(state, 'leahAtwood')
  assert.equal(behavior.codexReadable(state, 'leahAtwood'), false)
  assert.equal(behavior.codexEntry(state, 0, 'leahAtwood', quietApi()), false)
  assert.equal(behavior.codexReadable(state, 'boardingHouse'), true)
  assert.equal(behavior.codexEntry(state, 0, 'boardingHouse', choosingApi(['draw'])), true)
  assert.equal(behavior.codexReadable(state, 'boardingHouse'), false)
  assert.equal(behavior.codexEntry(state, 0, 'boardingHouse', choosingApi(['draw'])), false)
  assert.equal(behavior.codexEntry(state, 0, 'noSuchEntry', quietApi()), false)
})

// ---------------------------------------------------------------------------
// 8. 法典 13 / 传家宝（遗产）选择
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 传家宝：本序曲不发放 Heirlooms（10713–10715 留给白天序曲）', () => {
  assert.deepEqual([...HEIRLOOM_CODES], ['10713', '10714', '10715'])
  assert.deepEqual([...PRELUDE_HEIRLOOM_REWARDS], [])
  assert.deepEqual([...scenario.heirloomRewards], [])
  assert.equal(SET_ASIDE_CARDS.some(code => HEIRLOOM_CODES.includes(code)), false)
  assert.equal(manifest.zones.setAside.some(row => HEIRLOOM_CODES.includes(row.cardCode)), false)
})

test('P7 preludeTheFinalEvening 法典 13（遗产选择）：站在里弗一边 → 里弗在阿特伍德宅资产面进场', () => {
  const records = withNotes('riverHawthorne', [RECORD_KEYS.riverIsReclaimingTheirLegacy])
  const state = setup(2, { ...records, [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  assert.equal(behavior.codexBranch(state, ATWOOD_HOUSE_ENTRY_KEY), 'otherwise')
  assert.equal(behavior.codexEntry(state, 0, ATWOOD_HOUSE_ENTRY_KEY, choosingApi(['sideRiver'])), true)
  const river = residentAsset(state, 'riverHawthorne')
  assert.ok(river, '里弗资产面入场')
  assert.equal(river.location, THE_ATWOOD_HOUSE_ID)
  assert.equal(state.scenarioFlags.preludeAtwoodHouseSettled, true)
  assert.equal(behavior.codexReadable(state, ATWOOD_HOUSE_ENTRY_KEY), false, '选边后不再触发')
  assert.equal(chapter.hemlocksHashingItOut(state), false)
})

test('P7 preludeTheFinalEvening 法典 13：站在威廉一边需要「威廉已释怀」；两支都没记录时只能让他们打', () => {
  const william = setup(2, {
    ...withNotes('williamHemlock', [RECORD_KEYS.williamIsResolved]),
    [RECORD_KEYS.areasSurveyedNorthPointMine]: true,
  }).state
  const api = choosingApi(['sideWilliam'])
  assert.equal(behavior.codexEntry(william, 0, ATWOOD_HOUSE_ENTRY_KEY, api), true)
  assert.deepEqual(api.asked[0].options.map(option => option.id), ['sideWilliam', 'letFight'])
  const asset = residentAsset(william, 'williamHemlock')
  assert.equal(asset.location, THE_ATWOOD_HOUSE_ID)

  const neither = setup(2, { [RECORD_KEYS.areasSurveyedNorthPointMine]: true }).state
  const plainApi = choosingApi(['letFight'])
  assert.equal(behavior.codexEntry(neither, 0, ATWOOD_HOUSE_ENTRY_KEY, plainApi), true)
  assert.deepEqual(plainApi.asked[0].options.map(option => option.id), ['letFight'])
  assert.equal(neither.campaign.records[THEATWOOD_HASHING_RECORD], undefined)
  assert.equal(behavior.codexReadable(neither, ATWOOD_HOUSE_ENTRY_KEY), true, '可以再次触发')
})

test('P7 preludeTheFinalEvening 法典 13：有记录时「让他们打」→ 记住一决胜负，再读一次走停战', () => {
  const records = {
    ...withNotes('riverHawthorne', [RECORD_KEYS.riverIsReclaimingTheirLegacy]),
    [RECORD_KEYS.areasSurveyedNorthPointMine]: true,
    riverHawthorneRelationshipLevel: 1,
    williamHemlockRelationshipLevel: 1,
  }
  const state = setup(2, records).state
  assert.equal(behavior.codexEntry(state, 0, ATWOOD_HOUSE_ENTRY_KEY, choosingApi(['letFight'])), true)
  assert.equal(state.campaign.records[THEATWOOD_HASHING_RECORD], true)
  assert.equal(behavior.hemlocksHashingItOut(state), true)
  assert.equal(behavior.codexBranch(state, ATWOOD_HOUSE_ENTRY_KEY), 'hashingItOut')
  // 再触发：赫姆洛克停战
  const api = choosingApi(['riverHawthorne'])
  assert.equal(behavior.codexEntry(state, 0, ATWOOD_HOUSE_ENTRY_KEY, api), true)
  assert.equal(state.campaign.records[RECORD_KEYS.theHemlocksMadeATruce], true)
  assert.equal(behavior.relationshipLevel(state, 'williamHemlock'), 2)
  assert.equal(behavior.relationshipLevel(state, 'riverHawthorne'), 2)
  assert.equal(behavior.bonusXp(state), 2)
  const heir = state.investigators.some(inv => inv.assets.some(asset =>
    [RESIDENT_BY_ID.riverHawthorne.assetCode, RESIDENT_BY_ID.williamHemlock.assetCode].includes(asset.code)))
  assert.equal(heir, true, '取得一位继承人的控制权')
  assert.equal(behavior.codexReadable(state, ATWOOD_HOUSE_ENTRY_KEY), false)
})

// ---------------------------------------------------------------------------
// 9. 时间推进 / 结局
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 时间推进：第三日夜、日历记录、下一段《山谷的命运》', () => {
  assert.deepEqual({ ...PRELUDE_DATE }, { day: 3, period: 'night' })
  assert.equal(TIME_MARKER.day, 3)
  assert.equal(TIME_MARKER.period, 'night')
  assert.equal(TIME_MARKER.face, 'back')
  assert.equal(NEXT_SCENARIO_ID, 'fateOfTheVale')
  assert.equal(chapter.RESOLUTION_ORDER.resolution4, 'fateOfTheVale')
  const state = setup(2).state
  assert.equal(dayNumber(state), 3)
  assert.equal(periodOfDay(state), 'night')
  // 结局 4 重写下一步记录
  behavior.resolution(state, 'resolution4', [], quietApi())
  assert.equal(state.campaign.records[RECORD_KEYS.nextStep], 'fateOfTheVale')
  assert.equal(behavior.scenarioSummary(state).nextStep, 'fateOfTheVale')
})

test('P7 preludeTheFinalEvening 结局链：无结局 → 相信了走 R2→R3，否则直接 R4', () => {
  assert.deepEqual({ ...chapter.RESOLUTION_ORDER }, {
    noResolution: 'resolution2/4', resolution1: 'resolution4', resolution2: 'resolution3',
    resolution3: 'replay/lose', resolution4: 'fateOfTheVale',
  })
  const believed = setup(2, { [RECORD_KEYS.believed]: true }).state
  const first = behavior.resolution(believed, NO_RESOLUTION, [], choosingApi(['replay']))
  assert.deepEqual(first.chain, ['resolution2', 'resolution3'])
  assert.equal(first.resolution, 'resolution3')
  assert.equal(first.replay, true)
  assert.equal(believed.campaign.records[RECORD_KEYS.believed], false, '划掉「调查员相信了」')
  assert.equal(believed.campaign.records[RECORD_KEYS.replayRequested], true)

  const plain = setup(2).state
  const second = behavior.resolution(plain, NO_RESOLUTION, [], quietApi())
  assert.deepEqual(second.chain, ['resolution4'])
  assert.equal(second.nextStep, 'fateOfTheVale')
})

test('P7 preludeTheFinalEvening 结局 1 → 结局 4：蕾切尔被击败后直接走到 R4 并记录经验', () => {
  const state = setup(2).state
  behavior.codexEntry(state, 0, 'motherRachel', quietApi())
  const rachel = residentEnemy(state, 'motherRachel')
  rachel.defeated = true
  behavior.enemyDefeated(state, rachel, quietApi())
  assert.equal(state.scenarioFlags.preludeMotherRachelDefeated, true)
  assert.equal(state.resolution, 'resolution1', '幕目标读点')
  const outcome = behavior.resolution(state, 'resolution1', [], quietApi())
  assert.deepEqual(outcome.chain, ['resolution1', 'resolution4'])
  assert.equal(outcome.nextStep, 'fateOfTheVale')
  assert.equal(state.campaign.records[RECORD_KEYS.resolution], 'resolution4')
  assert.equal(typeof outcome.xp, 'number')
})

test('P7 preludeTheFinalEvening 结局 3：选择输掉战役 → 全员死亡并记录', () => {
  const state = setup(2, { [RECORD_KEYS.believed]: true }).state
  const outcome = behavior.resolution(state, 'resolution2', [], choosingApi(['loseTheCampaign']))
  assert.deepEqual(outcome.chain, ['resolution2', 'resolution3'])
  assert.equal(outcome.lost, true)
  assert.equal(outcome.nextStep, 'lost')
  assert.equal(state.investigators.every(inv => inv.killed), true)
  assert.equal(state.campaign.records[RECORD_KEYS.campaignLost], true)
  assert.equal(state.campaign.records[RECORD_KEYS.nextStep], 'lost')
  // P8 修复：结局钩子不再把引擎状态写成 `'lost'`（引擎只认 `'playing'`，结算页会因此没有
  // 任何合法动作）。战役失败由记录的 `nextStep = 'lost'` 交给 `finalEveningOutcome → epilogue`
  // 收口，`endCampaign` 再写 `status: 'over'` / `outcome: 'defeat'`。
  assert.equal(state.status, 'playing')
})

test('P7 preludeTheFinalEvening 结局 4 经验：胜利区 X + 本序曲奖励经验（按人记录）', () => {
  const state = setup(2).state
  behavior.codexEntry(state, 0, 'boardingHouse', choosingApi(['draw']))
  behavior.codexEntry(state, 0, ATWOOD_HOUSE_ENTRY_KEY, choosingApi(['letFight']))
  behavior.addBonusXpToAll(state, 2, quietApi())
  state.victoryDisplay.push({ id: 'x', victory: 1 })
  assert.equal(behavior.victoryXp(state), 1)
  assert.equal(behavior.bonusXp(state), 2)
  assert.equal(behavior.resolutionExperience(state), 3)
  const outcome = behavior.resolution(state, 'resolution4', [], quietApi())
  assert.equal(outcome.xp, 3)
  assert.equal(state.investigators.every(inv => inv.scenarioXpBonus === 2), true, '奖励经验已按人计入未花费经验')
})

test('P7 preludeTheFinalEvening 无结局：全员撤退 → noResolution，按是否相信决定下一段', () => {
  const state = setup(2).state
  const result = behavior.allResigned(state, quietApi())
  assert.equal(result.resolution, NO_RESOLUTION)
  assert.equal(result.next, 'resolution4')
  assert.equal(state.resolution, NO_RESOLUTION)
  const believedState = setup(2, { [RECORD_KEYS.believed]: true }).state
  assert.equal(behavior.allResigned(believedState, quietApi()).next, 'resolution2')
})

test('P7 preludeTheFinalEvening 议程目标：待宰羔羊需要 1 + 1/人 张居民在胜利区', () => {
  const state = setup(3, { ...SURVEYED, [RECORD_KEYS.believed]: true }).state
  behavior.codexEntry(state, 0, 'motherRachel', quietApi())
  assert.equal(state.agendas[0].code, SPECIAL_AGENDA_CODE)
  assert.equal(behavior.residentVictoryTarget(state), 4)
  const resident = residentEnemy(state, 'judithPark')
  behavior.afterTest(state, state.investigators[0],
    { success: true, value: 4, difficulty: 2 },
    quietApi(), { test: { actionKind: 'evade', target: { kind: 'enemy', id: resident.id } } })
  assert.equal(state.victoryDisplay.length, 1)
  assert.equal(behavior.residentsInVictoryDisplay(state).length, 1)
  assert.equal(behavior.checkObjectives(state, quietApi()), false)
  for (const id of ['leahAtwood', 'simeonAtwood', 'theoPeters']) {
    behavior.addEnemyToVictoryDisplay(state, residentEnemy(state, id), quietApi())
  }
  assert.equal(behavior.residentsInVictoryDisplay(state).length, 4)
  assert.equal(behavior.checkObjectives(state, quietApi()), true)
  assert.equal(state.resolution, 'resolution3')
})

test('P7 preludeTheFinalEvening 待宰羔羊：不能触发法典；未达目标翻面 → 全员撤退无结局', () => {
  const state = setup(3, { ...SURVEYED, [RECORD_KEYS.believed]: true }).state
  behavior.codexEntry(state, 0, 'motherRachel', quietApi())
  assert.equal(state.agendas[0].code, SPECIAL_AGENDA_CODE)
  assert.equal(behavior.codexReadable(state, 'boardingHouse'), false, '「你不能触发 [codex] 抄本条目」')
  assert.equal(behavior.codexEntry(state, 0, 'boardingHouse', quietApi()), false)
  assert.equal(behavior.agendaReveal(state, state.agendas[0], quietApi()), true)
  assert.equal(state.investigators.every(inv => inv.resigned), true)
  assert.equal(state.resolution, NO_RESOLUTION)
})

test('P7 preludeTheFinalEvening 议程背面：每位调查员被击败并承受 1 点创伤 → 无结局', () => {
  const state = setup(2).state
  assert.equal(behavior.agendaReveal(state, state.agendas[0], quietApi()), true)
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.equal(state.investigators.every(inv => inv.trauma.mental === 1 || inv.trauma.physical === 1), true)
  assert.equal(state.resolution, NO_RESOLUTION)
  assert.equal(behavior.actReveal(state, state.acts[0], quietApi()), true, '幕与议程是同一张卡')
})

// ---------------------------------------------------------------------------
// 10. 混乱标记
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening 混乱标记：[skull] 当前天数（3）/ 困难天数 +1（4）', () => {
  const state = setup(2).state
  assert.equal(theFinalEveningChaosToken(state, state.investigators[0], 'skull').delta, -3)
  const hard = stateWithScenario(2)
  hard.difficulty = 'hard'
  behavior.setPreludeDate(hard, quietApi())
  assert.equal(theFinalEveningChaosToken(hard, hard.investigators[0], 'skull').delta, -4)
  assert.equal(chapter.theFinalEveningChaosTokenValue(hard, 'skull', hard.investigators[0]), -4)
  assert.deepEqual({ ...THE_FINAL_EVENING_TOKEN_MEANINGS.hard.skull },
    { text: '-X。X 为当前天数加 1。', delta: 0, rider: 'dayNumberPlusOne' })
  assert.equal(THE_FINAL_EVENING_TOKEN_MEANINGS.easy.skull.text, '-X。X 为当前天数。')
})

test('P7 preludeTheFinalEvening 混乱标记：[cultist] 简单/普通 +1 且谈判自动成功；困难 -1 / 谈判 +1', () => {
  const state = setup(2).state
  const inv = state.investigators[0]
  assert.equal(theFinalEveningChaosToken(state, inv, 'cultist').delta, 1)
  const parley = theFinalEveningChaosToken(state, inv, 'cultist', { parley: true })
  assert.equal(parley.delta, 1)
  assert.deepEqual(parley.onDraw, [{ type: 'scenarioToken', token: 'cultist', mode: 'parley' }])
  const hard = stateWithScenario(2)
  hard.difficulty = 'expert'
  assert.equal(theFinalEveningChaosToken(hard, hard.investigators[0], 'cultist').delta, -1)
  assert.equal(theFinalEveningChaosToken(hard, hard.investigators[0], 'cultist', { parley: true }).delta, 1)
  // 谈判判定读点：skillTest.testTarget.actionKind
  const framed = stateWithScenario(2)
  framed.skillTest = { testTarget: { actionKind: 'parley' } }
  assert.equal(isParleyAttempt(framed, {}), true)
  assert.equal(isParleyAttempt(framed, { parley: false }), false, '显式上下文优先')
})

test('P7 preludeTheFinalEvening 混乱标记：[tablet] 手牌阈值；[elder_thing] 谈判再揭示', () => {
  const state = setup(2).state
  const inv = state.investigators[0]
  inv.hand = ['a', 'b', 'c']
  assert.equal(theFinalEveningChaosToken(state, inv, 'tablet').delta, -2)
  inv.hand = ['a', 'b']
  assert.equal(theFinalEveningChaosToken(state, inv, 'tablet').delta, 0, '少于 3 张 → 0')
  const hard = stateWithScenario(2)
  hard.difficulty = 'hard'
  hard.investigators[0].hand = ['a', 'b', 'c']
  assert.equal(theFinalEveningChaosToken(hard, hard.investigators[0], 'tablet').delta, -4)
  hard.investigators[0].hand = ['a']
  assert.equal(theFinalEveningChaosToken(hard, hard.investigators[0], 'tablet').delta, -2)
  assert.equal(theFinalEveningChaosToken(state, inv, 'elderthing').delta, -1)
  assert.equal(theFinalEveningChaosToken(state, inv, 'elderthing').drawAnother, false)
  assert.equal(theFinalEveningChaosToken(state, inv, 'elderthing', { parley: true }).drawAnother, true)
  assert.equal(theFinalEveningChaosToken(state, inv, 'eldersign'), null, '非本章符号交回默认表')
})

test('P7 preludeTheFinalEvening 混乱标记追加效果：[cultist] 谈判把 skillTest 置为自动成功', () => {
  const state = setup(2).state
  state.skillTest = { testTarget: { actionKind: 'parley' }, autoSuccess: false }
  assert.equal(behavior.applyTokenEffect(state, state.investigators[0],
    { token: 'cultist', mode: 'parley' }), true)
  assert.equal(state.skillTest.autoSuccess, true)
  const plain = setup(2).state
  plain.skillTest = { testTarget: { actionKind: 'fight' }, autoSuccess: false }
  assert.equal(behavior.applyTokenEffect(plain, plain.investigators[0],
    { token: 'cultist', mode: 'parley' }), false, '非谈判不自动成功')
  assert.equal(plain.skillTest.autoSuccess, false)
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'skull').delta, -3)
})

// ---------------------------------------------------------------------------
// 11. 存档往返 / 披露
// ---------------------------------------------------------------------------

test('P7 preludeTheFinalEvening JSON 往返：地点、居民、法典、日历与结局都能继续结算', () => {
  const api = choosingApi(['doneNothingWrongTruth'])
  const records = { [RECORD_KEYS.drMarquezHasAPlan]: true, motherRachelRelationshipLevel: 3 }
  const state = stateWithScenario(2, records)
  behavior.preScenarioSetup(state, [], api)
  behavior.setupLocations(state, [], { api: quietApi() })
  behavior.setupEnemies(state, [], { api: quietApi() })
  behavior.afterDeckSetup(state, [], { api: quietApi() })
  behavior.codexEntry(state, 0, 'boardingHouse', choosingApi(['draw']))
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'preludeTheFinalEvening')
  assert.deepEqual(behavior.scenarioDateOf(restored), { day: 3, period: 'night' })
  assert.equal(restored.locations.length, 8)
  assert.equal(behavior.codexWasRead(restored, 'boardingHouse'), true)
  assert.equal(behavior.codexEntry(restored, 0, 'boardingHouse', quietApi()), false, '已读标记随存档保留')
  assert.equal(behavior.relationshipLevel(restored, 'motherRachel'), 3)
  assert.equal(restored.campaign.records[RECORD_KEYS.believed], true)
  const outcome = behavior.resolution(restored, 'resolution1', [], quietApi())
  assert.equal(outcome.nextStep, 'fateOfTheVale')
  assert.equal(restored.campaign.records[RECORD_KEYS.resolution], 'resolution4')
})

test('P7 preludeTheFinalEvening 披露：无法表达的子句集中声明，命名导出与 behavior 表同一份', () => {
  assert.equal(approximations, behavior.approximations)
  assert.ok(approximations.length >= 10)
  assert.ok(approximations.some(text => text.includes('prelude4')))
  assert.ok(approximations.some(text => text.includes('Around the Table')))
  assert.ok(approximations.some(text => text.includes('10680')))
  assert.ok(approximations.some(text => text.includes('法典 1')))
  assert.ok(approximations.some(text => text.includes('传家宝')))
  assert.ok(approximations.some(text => text.includes('共享遭遇组')))
  assert.equal(behavior.scenarioSummary(stateWithScenario(2)).id, 'preludeTheFinalEvening')
  assert.deepEqual({ ...behavior.implementedEntryFlags('10692') }, {}, '共享组条目未注册时安全返回')
})
