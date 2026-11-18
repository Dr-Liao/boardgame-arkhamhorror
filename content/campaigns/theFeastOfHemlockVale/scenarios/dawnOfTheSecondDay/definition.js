// 第二日黎明（dawnOfTheSecondDay · 提示卡 10677a / 混乱参考卡 10704）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/TheFeastOfHemlockVale/PreludeDawnOfTheSecondDay.hs +
//   Act|Agenda/CardDefs+End/Cards/TheFeastOfHemlockVale/DayOfRain.hs +
//   Location/CardDefs/TheFeastOfHemlockVale/TheVale.hs +
//   Campaigns/TheFeastOfHemlockVale/{Helpers,TokenHelpers}.hs +
//   frontend/src/locales/en/theFeastOfHemlockVale/base.json（prelude2 段，印刷文本）。
//
// 本序曲是「第二日（白天）」的整备/社交段：没有遭遇牌库（指南「Playing Preludes」），
// 场景由 The Vale 的 8 张白天地点、Day of Rain 的幕/议程、Residents 组与 The Second Day
// 的时间标记组成。目标不是打怪，而是读法典、经营居民关系与笔记，最后按
// 「Areas Surveyed」选择下一次勘察关卡。
//
// 本文件三条口径（均在 README/behavior 注释中标注为 approximation）：
//   1. 地图连接：TheVale.hs 的每张地点卡印有 1 个符号 + 若干「可连接符号」；Haskell
//      scenarioWith 的 6×3 模板（". triangle square / moon triangle square / …"）里每个符号
//      出现 2 次，说明 8 张地点卡各占纵向 2 格（与 EotE IceAndDeath 模板同一排版口径）。
//      移动连接只取印刷符号连接（LOCATION_CONNECTIONS = ICON_CONNECTIONS，与兄弟序曲
//      welcomeToHemlockVale 一致）；3×3 地图的正交相邻另导出 GRID_ADJACENCY，等战役
//      Location Adjacency 原语（P1 scan 仍 pending）接线后再并入，当前不擅自新增网格边。
//   2. 输入 encounterCode `dawn_of_the_second_day` 在卡表里没有对应遭遇组；本序曲实际 gather
//      的是 The Second Day / Day of Rain / Residents / The Vale 四组，manifest 按这四组声明。
//   3. 指南中文来自 story-source/；base.part2.json 尚未落地，本序曲 sections 全部回退英文
//      （textLanguage = 'en'，textStatus 已披露），不冒充官方中文。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed, SYMBOLS } from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { DAWN_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'dawnOfTheSecondDay'
// 混乱参考卡「The Vale」（01xxx 段的印刷参考卡，四档符号文本都印在它上面）。
export const REFERENCE_CODE = '10704'
// 序曲所在的时间标记卡面：Deck of the Second Day 的 Day Two（10677 的白天面）。
export const STEP_CODE = '10677a'
export const TIME_MARKER_CODE = '10677'
export const TIME_MARKER_FACE = 'front'
// 本序曲的主遭遇组（卡表 encounterCode）；输入里的 dawn_of_the_second_day 不存在，
// 这里用 The Second Day 组，并在 GATHER_GROUPS 里显式列出真正 gather 的四组。
export const ENCOUNTER_CODE = 'the_second_day'

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
// 议程：乌云（Dark Clouds，印刷毁灭阈值 6）；幕：第二个黎明（Dawn of the Second Day）。
export const ACT_CODES = Object.freeze(['10684'])
export const AGENDA_CODES = Object.freeze(['10683'])
export const ACT_CODE = ACT_CODES[0]
export const AGENDA_CODE = AGENDA_CODES[0]
export const RESOLUTION_KEYS = Object.freeze(['resolution1', 'resolution2', 'resolution3'])
// 幕背面 → 法典 17（The Curse）；议程背面 → 按「Bertie was rescued」选结局 1/2，再进入结局 3。
export const CODEX_ON_ACT_BACK = 'theCurse'
export const ACT_CODEX_THRESHOLD = 3

// ---------------------------------------------------------------------------
// gather 组
// ---------------------------------------------------------------------------
// 指南 setup：「Gather all cards from the following encounter sets: The Second Day,
// Day of Rain, Residents, and The Vale.」——卡表 encounterCode 为 snake_case。
export const GATHER_GROUPS = Object.freeze(['the_second_day', 'day_of_rain', 'residents', 'the_vale'])
// manifest 的 requiredEncounterGroupIds 用卡包清单的 camelCase 组 id。
export const GATHER_GROUP_IDS = Object.freeze(['theSecondDay', 'dayOfRain', 'residents', 'theVale'])

// ---------------------------------------------------------------------------
// 居民（Residents 组 10693–10703）：8 名有 Relationship Level 的居民 + 3 张剧情盟友
// ---------------------------------------------------------------------------
// [id, code]；记录键与《汉洛克庄园》《最长一夜》一致（`<resident>RelationshipLevel` /
// `<resident>Notes` / `<resident>CrossedOut`），上限 5 格。
export const RESIDENT_TABLE = Object.freeze([
  Object.freeze(['motherRachel', '10693']),
  Object.freeze(['leahAtwood', '10694']),
  Object.freeze(['simeonAtwood', '10695']),
  Object.freeze(['williamHemlock', '10696']),
  Object.freeze(['riverHawthorne', '10697']),
  Object.freeze(['gideonMizrah', '10698']),
  Object.freeze(['judithPark', '10699']),
  Object.freeze(['theoPeters', '10700']),
])
export const RESIDENT_KEYS = Object.freeze(RESIDENT_TABLE.map(([id]) => id))
export const RESIDENT_CODES = Object.freeze(Object.fromEntries(RESIDENT_TABLE.map(([id, code]) => [id, code])))
export const RESIDENT_CODE_LIST = Object.freeze(RESIDENT_TABLE.map(([, code]) => code))
// 同样属于 Residents 组、但没有关系等级的牌（剧情盟友/助手）。
export const SUPPORT_RESIDENT_CODES = Object.freeze(['10701', '10702', '10703'])
export const RESIDENT_ASSET_CODES = Object.freeze([...RESIDENT_CODE_LIST, ...SUPPORT_RESIDENT_CODES])
export const RESIDENT_MAX_LEVEL = 5
export const RESIDENT_RECORDS = Object.freeze(Object.fromEntries(RESIDENT_KEYS.map(id => [id, Object.freeze({
  level: `${id}RelationshipLevel`,
  notes: `${id}Notes`,
  crossedOut: `${id}CrossedOut`,
  max: RESIDENT_MAX_LEVEL,
})])))
// 引擎 `mechanics.codex[].resident` 的字段名是 relationship/notes/crossedOut（scenario-calendar.js）。
export const CODEX_RESIDENT_RECORDS = Object.freeze(Object.fromEntries(RESIDENT_KEYS.map(id => [id, Object.freeze({
  relationship: RESIDENT_RECORDS[id].level,
  notes: RESIDENT_RECORDS[id].notes,
  crossedOut: RESIDENT_RECORDS[id].crossedOut,
})])))
// `mechanics.residents`（resident-record.js 的居民清单投影）。
export const RESIDENTS_SPEC = Object.freeze(RESIDENT_KEYS.map(id => {
  const code = RESIDENT_CODES[id]
  const card = ALL_CARDS[code] || {}
  return Object.freeze({
    id, name: card.nameZh || card.name || id, nameEn: card.name || id,
    record: Object.freeze({ ...RESIDENT_RECORDS[id] }),
  })
}))

// 值得注意的放一边/移除细节：
//   · 开局 Judith Park 直接放在 The Crossroads（资产面朝上），其余居民放一边；
//   · 战役日志里被划掉的居民移出游戏（不再入场，也不留在放一边区）。
export const JUDITH_CODE = RESIDENT_CODES.judithPark
export const HEMLOCK_CURSE_CODE = '10685'
// The Second Day 组的大雨倾盆：序曲没有遭遇牌库，这张诡计不进场（仍属于 gather 组）。
export const UNUSED_TREACHERY_CODE = '10678'

// ---------------------------------------------------------------------------
// 地点（The Vale 组的白天面 10705a–10712a）
// ---------------------------------------------------------------------------
// [id, code, 印刷符号, 可连接符号]。符号/连接取自 TheVale.hs 的 CardDefs。
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['boardingHouse', '10705a', 'circle', Object.freeze(['diamond', 'spade'])]),
  Object.freeze(['theCrossroads', '10706a', 'diamond', Object.freeze(['triangle', 'square', 'star', 'circle', 'heart', 'moon'])]),
  Object.freeze(['hemlockChapel', '10707a', 'triangle', Object.freeze(['diamond', 'moon'])]),
  Object.freeze(['theOldMill', '10708a', 'heart', Object.freeze(['diamond', 'moon'])]),
  Object.freeze(['theAtwoodHouse', '10709a', 'moon', Object.freeze(['diamond', 'triangle', 'heart'])]),
  Object.freeze(['tadsGeneralStore', '10710a', 'square', Object.freeze(['diamond', 'star'])]),
  Object.freeze(['valeSchoolhouse', '10711a', 'spade', Object.freeze(['star', 'circle'])]),
  Object.freeze(['theCommons', '10712a', 'star', Object.freeze(['diamond', 'square', 'spade'])]),
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const START_LOCATION = 'boardingHouse'
// 每个地点是 6×3 模板里的纵向双格（左上角坐标来自 PreludeDawnOfTheSecondDay.hs 的 layout）。
export const LOCATION_CELLS = Object.freeze({
  hemlockChapel: Object.freeze({ x: 1, y: 0 }),
  tadsGeneralStore: Object.freeze({ x: 2, y: 0 }),
  theAtwoodHouse: Object.freeze({ x: 0, y: 1 }),
  theCrossroads: Object.freeze({ x: 1, y: 2 }),
  theCommons: Object.freeze({ x: 2, y: 2 }),
  theOldMill: Object.freeze({ x: 0, y: 3 }),
  boardingHouse: Object.freeze({ x: 1, y: 4 }),
  valeSchoolhouse: Object.freeze({ x: 2, y: 4 }),
})
export const LOCATION_GRID_TEMPLATE = Object.freeze([
  '.     triangle square',
  'moon  triangle square',
  'moon  diamond  star',
  'heart diamond  star',
  'heart circle   spade',
  '.     circle   spade',
])

const SYMBOL_BY_LOCATION = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [id, symbol])))
const ID_BY_SYMBOL = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [symbol, id])))
export const LOCATION_SYMBOLS = SYMBOL_BY_LOCATION
// card-data.js 的共享 SYMBOLS 表没有黑桃（spade）；The Vale 的学校用 ♠，这里补一条显示元数据。
export const PRELUDE_SYMBOLS = Object.freeze({
  ...SYMBOLS,
  spade: Object.freeze({ id: 'spade', label: '黑桃', glyph: '♠' }),
})

// 印刷图标连接（CardDefs 的 connectedLocationSymbols），双向化并按 id 排序。
function printedIconConnections() {
  const edges = new Map(LOCATION_IDS.map(id => [id, new Set()]))
  for (const [id, , , links] of LOCATION_TABLE) {
    for (const symbol of links) {
      const other = ID_BY_SYMBOL[symbol]
      if (!other || other === id) continue
      edges.get(id).add(other)
      edges.get(other).add(id)
    }
  }
  return Object.freeze(Object.fromEntries([...edges].map(([id, set]) => [id, Object.freeze([...set].sort())])))
}

// 6×3 模板是「每张地点卡纵向占 2 格」的棋盘；共享一条边的双格相邻。
function dominoCells(cell) {
  return [[cell.x, cell.y], [cell.x, cell.y + 1]]
}
function sharesSide(a, b) {
  const cellsA = dominoCells(a), cellsB = dominoCells(b)
  return cellsA.some(([x, y]) => cellsB.some(([bx, by]) => (x === bx && Math.abs(y - by) === 1)
    || (y === by && Math.abs(x - bx) === 1)))
}
export const GRID_ADJACENCY = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => [id, Object.freeze(
  LOCATION_IDS.filter(other => other !== id && sharesSide(LOCATION_CELLS[id], LOCATION_CELLS[other])).sort(),
)])))

export const ICON_CONNECTIONS = printedIconConnections()
// 规则连接暂只取印刷图标（CardDefs 的 connectedLocationSymbols，双向化）：
// 战役规则「Location Adjacency」在 P1 机制扫描里仍是 pending 共享原语（audit/fhv-mechanism-scan.json
// #rulebook.locationAdjacency），兄弟序曲 welcomeToHemlockVale 也按图标连接实现。GRID_ADJACENCY
// 单独导出 3×3 地图的正交相邻，供 P8 接线后并入；本序曲不擅自新增网格边（已在近似里披露）。
export const LOCATION_CONNECTIONS = ICON_CONNECTIONS

// layout.js 的展示坐标：使用左上格 + 卡片高度信息（layout 只做投影，不创建规则连接）。
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => {
  const cell = LOCATION_CELLS[id]
  return [id, { x: cell.x, y: cell.y }]
})))

function makeLocation([id, code, symbol, links]) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Vale location: ${code}`)
  return location({
    id, code, cluesFixed: true, clues: Number(card.clues) || 0,
    symbol, symbols: { front: { symbol, links: [...links] }, back: { symbol, links: [...links] } },
    connections: [...LOCATION_CONNECTIONS[id]],
    printedName: card.nameZh || card.name || code,
    printedTraits: [...(card.traits || [])],
    valeDay: true,
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => [row[0], makeLocation(row)])))

// ---------------------------------------------------------------------------
// 放一边 / 在场
// ---------------------------------------------------------------------------
// Setup：Residents 整组收集 → 划掉的移出游戏 → Judith 放 Crossroads → 其余放一边。
// 另外 Hemlock Curse（Day of Rain 的弱点）与 Downpour（无遭遇牌库用不到）也在放一边区。
export const SET_ASIDE_RESIDENT_CODES = Object.freeze([...RESIDENT_ASSET_CODES])
export const SET_ASIDE_ALIASES = Object.freeze([
  ...RESIDENT_ASSET_CODES.filter(code => code !== JUDITH_CODE),
  HEMLOCK_CURSE_CODE, UNUSED_TREACHERY_CODE,
])
// 开局就在场：Day Two 时间标记 + Judith Park。
export const IN_PLAY_ALIASES = Object.freeze([TIME_MARKER_CODE, JUDITH_CODE])
export const JUDITH_LOCATION = 'theCrossroads'
// 法典里会从放一边区放入场地的居民：id → [卡号, 地点]。
export const CODEX_RESIDENT_PLACEMENTS = Object.freeze({
  motherRachel: Object.freeze({ code: '10693', location: 'hemlockChapel' }),
  simeonAtwood: Object.freeze({ code: '10695', location: 'theOldMill' }),
  theoPeters: Object.freeze({ code: '10700', location: 'valeSchoolhouse' }),
  williamHemlock: Object.freeze({ code: '10696', location: 'theAtwoodHouse' }),
  riverHawthorne: Object.freeze({ code: '10697', location: 'theAtwoodHouse' }),
  gideonMizrah: Object.freeze({ code: '10698', location: 'theCommons' }),
})

// ---------------------------------------------------------------------------
// 法典（Codex 1 / 3–17；印刷文本在 base.json 的 prelude2.codex 段）
// ---------------------------------------------------------------------------
// 每个地点/居民/剧情步骤都能读到一条；法典 2 在《最长一夜》之类的前序内容里，不在本序曲。
// 分支条件只用引擎 `mechanics.codex` 能表达的部分（居民关系/笔记）：
//   · motherRachel → 是否记录 motherRachelIntervened；
//   · simeonAtwood → 是否记录 simeonHatchedAPlan；
//   · gideonMizrah → 是否记录 gideonToldTheStoryOfCaptainHemlock；
//   · judithPark  → 是否记录 judithSavedYourAss；
//   · theoPeters  → 是否记录 theoDistractedTheBear；
//   · tad's General Store 的「running an errand」不是居民笔记，由 behavior 读 records.remembered
//     选文本（引擎分支仅用于限次）；The Atwood House 的三选一由 behavior 按关系等级判定。
export const CODEX_IDS = Object.freeze([
  'motherRachel', 'simeonAtwood', 'williamHemlock', 'riverHawthorne', 'gideonMizrah',
  'judithPark', 'theoPeters', 'boardingHouse', 'theCrossroads', 'hemlockChapel',
  'theOldMill', 'theAtwoodHouse', 'tadsGeneralStore', 'valeSchoolhouse', 'theCommons', 'theCurse',
])
export const CODEX_BY_LOCATION = Object.freeze({
  boardingHouse: 'boardingHouse',
  theCrossroads: 'theCrossroads',
  hemlockChapel: 'hemlockChapel',
  theOldMill: 'theOldMill',
  theAtwoodHouse: 'theAtwoodHouse',
  tadsGeneralStore: 'tadsGeneralStore',
  valeSchoolhouse: 'valeSchoolhouse',
  theCommons: 'theCommons',
})
// 法典编号（印刷页上的 (codex X)）。definition 导出，shared 居民/地点条目与 behavior 共用。
export const CODEX_NUMBERS = Object.freeze({
  motherRachel: 1, simeonAtwood: 3, williamHemlock: 4, riverHawthorne: 5, gideonMizrah: 6,
  judithPark: 7, theoPeters: 8, boardingHouse: 9, theCrossroads: 10, hemlockChapel: 11,
  theOldMill: 12, theAtwoodHouse: 13, tadsGeneralStore: 14, valeSchoolhouse: 15, theCommons: 16,
  theCurse: 17,
})
export const CODEX_LIMIT_SCENARIO = 'scenario'
export const CODEX_LIMIT_UNLIMITED = 'unlimited'
export const RESIDENT_CODEX_NUMBERS = Object.freeze(Object.fromEntries(
  RESIDENT_KEYS.map(id => [id, CODEX_NUMBERS[id]])))
export const LOCATION_CODEX_NUMBERS = Object.freeze(Object.fromEntries(
  Object.keys(CODEX_BY_LOCATION).map(id => [id, CODEX_NUMBERS[CODEX_BY_LOCATION[id]]])))
export const CODEX_SPEC = Object.freeze([
  Object.freeze({ id: 'motherRachel', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.motherRachel,
    branches: Object.freeze([
      Object.freeze({ id: 'motherRachel2', notes: Object.freeze(['motherRachelIntervened']) }),
      Object.freeze({ id: 'motherRachel3' }),
    ]) }),
  Object.freeze({ id: 'simeonAtwood', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.simeonAtwood,
    branches: Object.freeze([
      Object.freeze({ id: 'hatchedAPlan', notes: Object.freeze(['simeonHatchedAPlan']) }),
      Object.freeze({ id: 'otherwise' }),
    ]) }),
  Object.freeze({ id: 'williamHemlock', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.williamHemlock,
    branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'riverHawthorne', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.riverHawthorne,
    branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'gideonMizrah', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.gideonMizrah,
    branches: Object.freeze([
      Object.freeze({ id: 'gideon2', notes: Object.freeze(['gideonToldTheStoryOfCaptainHemlock']) }),
      Object.freeze({ id: 'gideon3' }),
    ]) }),
  Object.freeze({ id: 'judithPark', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.judithPark,
    branches: Object.freeze([
      Object.freeze({ id: 'judith2', notes: Object.freeze(['judithSavedYourAss']) }),
      Object.freeze({ id: 'judith1' }),
    ]) }),
  Object.freeze({ id: 'theoPeters', limit: 'scenario', resident: CODEX_RESIDENT_RECORDS.theoPeters,
    branches: Object.freeze([
      Object.freeze({ id: 'distractedTheBear', notes: Object.freeze(['theoDistractedTheBear']) }),
      Object.freeze({ id: 'otherwise' }),
    ]) }),
  Object.freeze({ id: 'boardingHouse', limit: 'unlimited', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'theCrossroads', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'hemlockChapel', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'theOldMill', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'theAtwoodHouse', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'tadsGeneralStore', limit: 'unlimited', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'valeSchoolhouse', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'theCommons', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
  Object.freeze({ id: 'theCurse', limit: 'scenario', branches: Object.freeze([Object.freeze({ id: 'body' })]) }),
])

// 剧情标记：base.json 的 remembered 段。
export const REMEMBERED = Object.freeze({ youAreRunningAnErrand: 'youAreRunningAnErrand' })

// ---------------------------------------------------------------------------
// 下一次勘察：指南 Resolution 3 的 5 个候选（Areas Surveyed 勾选后排除）
// ---------------------------------------------------------------------------
export const SURVEY_DESTINATIONS = Object.freeze([
  'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
])
export const SURVEY_LABELS = Object.freeze({
  writtenInRock: 'writtenInRock', hemlockHouse: 'hemlockHouse', theSilentHeath: 'theSilentHeath',
  theLostSister: 'theLostSister', theThingInTheDepths: 'theThingInTheDepths',
})
// 「下次开局跳过规则书第 27 页 Setting Up the Game 的步骤 1–8」= 引擎勘察整备
// （prepareSurvey/surveyOpening：不发新起手、不重抽、保留 1 张非起始支援、手牌/资源回上限、保留线索）。
export const SURVEY_SKIP_SETUP_STEPS = Object.freeze({ first: 1, last: 8, rulesReferencePage: 27 })

// ---------------------------------------------------------------------------
// 剧情文本（story-text.js 是生成物，经 story-access.js 读取）
// ---------------------------------------------------------------------------
const safeStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sectionsEn: {}, sections: {}, chineseGaps: [] }
  }
}
function nestFlat(flat) {
  const root = {}
  for (const [key, value] of Object.entries(flat || {})) {
    const path = String(key).replace(/\[(\d+)\]/g, '.$1').split('.')
    let node = root
    for (const part of path.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
      node = node[part]
    }
    node[path[path.length - 1]] = value
  }
  return root
}
const STORY = safeStory(CHAPTER_ID)
const SECTIONS = nestFlat(STORY.sectionsEn)
const P2 = SECTIONS.prelude2 || {}
const text = value => flattenStory(value)
export const TEXT_LANGUAGE = 'en'
export const TEXT_STATUS = 'printed-text (en; zh translation pending: story-source/base.part2.json missing — sections fall back to English)'
export const CHINESE_GAPS = Object.freeze([...(Array.isArray(STORY.chineseGaps) ? STORY.chineseGaps : [])])
export const PRELUDE_DAY = 2
export const PRELUDE_PERIOD = 'day'
const keyText = (...path) => {
  let node = SECTIONS
  for (const part of path) node = node?.[part]
  return text(node)
}

const SCENARIO_TEXT_VALUE = {
  textLanguage: TEXT_LANGUAGE,
  // 中文翻译来自本地 story-source/base.partN.json；part2（prelude2 段）尚未落地，
  // 因此本章 sections 全部回退英文（chineseGaps 为生成物里缺译的叶子清单）。
  textStatus: TEXT_STATUS,
  chineseGaps: CHINESE_GAPS,
  heading: text(P2.intro?.title),
  intro: text(P2.intro?.body),
  introBranches: Object.freeze({
    theHemlockCurse: text(P2.intro?.theHemlockCurse),
    gnawingHunger: text(P2.intro?.gnawingHunger),
  }),
  fatigue: Object.freeze({ title: keyText('fatigue', 'title'), body: keyText('fatigue', 'body') }),
  setupSteps: Object.freeze([
    Object.freeze({ key: 'gatherSets', text: text(P2.setup?.gatherSets) }),
    Object.freeze({ key: 'dayTwo', text: text(P2.setup?.dayTwo) }),
    Object.freeze({ key: 'placeLocations', text: text(P2.setup?.placeLocations) }),
    Object.freeze({ key: 'startAt', text: text(P2.setup?.startAt) }),
    Object.freeze({ key: 'residents', text: text(P2.setup?.residents) }),
    Object.freeze({ key: 'removeResidents', text: text(P2.setup?.removeResidents) }),
    Object.freeze({ key: 'judithPark', text: text(P2.setup?.judithPark) }),
    Object.freeze({ key: 'setOutOfPlay', text: text(P2.setup?.setOutOfPlay) }),
    Object.freeze({ key: 'placeDoom', text: text(P2.setup?.placeDoom) }),
    Object.freeze({ key: 'codex', text: text(P2.setup?.codex) }),
  ]),
  specialRules: Object.freeze([0, 1, 2, 3, 5].map(index => Object.freeze({
    title: keyText('specialRules', String(index), 'title'),
    body: keyText('specialRules', String(index), 'body'),
  }))),
  rules: Object.freeze({
    codex: Object.freeze({ title: keyText('specialRules', '0', 'title'), body: keyText('specialRules', '0', 'body') }),
    threeDaysThreeNights: Object.freeze({ title: keyText('specialRules', '1', 'title'), body: keyText('specialRules', '1', 'body') }),
    residents: Object.freeze({ title: keyText('specialRules', '2', 'title'), body: keyText('specialRules', '2', 'body') }),
    locationAdjacency: Object.freeze({ title: keyText('specialRules', '3', 'title'), body: keyText('specialRules', '3', 'body') }),
    dayAndNight: Object.freeze({ title: keyText('specialRules', '5', 'title'), body: keyText('specialRules', '5', 'body') }),
  }),
  tokens: Object.freeze({
    easyStandard: Object.freeze({
      skull: keyText('tokens', 'easyStandard', 'skull'),
      cultist: keyText('tokens', 'easyStandard', 'cultist'),
      tablet: keyText('tokens', 'easyStandard', 'tablet'),
      elderThing: keyText('tokens', 'easyStandard', 'elderThing'),
    }),
    hardExpert: Object.freeze({
      skull: keyText('tokens', 'hardExpert', 'skull'),
      cultist: keyText('tokens', 'hardExpert', 'cultist'),
      tablet: keyText('tokens', 'hardExpert', 'tablet'),
      elderThing: keyText('tokens', 'hardExpert', 'elderThing'),
    }),
  }),
  codex: Object.freeze({
    labels: Object.freeze({
      additionalActions: text(P2.codex?.label?.additionalActions),
      judith: Object.freeze({
        iCanHandleMyself: text(P2.codex?.judithPark?.label?.iCanHandleMyself),
        thanksForSavingUs: text(P2.codex?.judithPark?.label?.thanksForSavingUs),
      }),
      boardingHouse: Object.freeze({
        help: text(P2.codex?.boardingHouse?.label?.help),
        simeon: text(P2.codex?.boardingHouse?.label?.simeon),
        gideon: text(P2.codex?.boardingHouse?.label?.gideon),
      }),
      theAtwoodHouse: Object.freeze({
        william: text(P2.codex?.theAtwoodHouse?.label?.william),
        river: text(P2.codex?.theAtwoodHouse?.label?.river),
        fight: text(P2.codex?.theAtwoodHouse?.label?.fight),
      }),
      tadsGeneralStore: Object.freeze({ item: text(P2.codex?.tadsGeneralStore?.label?.item) }),
    }),
    motherRachel: Object.freeze({
      title: text(P2.codex?.motherRachel?.title), header: text(P2.codex?.motherRachel?.header),
      motherRachel1: text(P2.codex?.motherRachel?.motherRachel1),
      motherRachel2: text(P2.codex?.motherRachel?.motherRachel2),
      motherRachel3: text(P2.codex?.motherRachel?.motherRachel3),
    }),
    simeonAtwood: Object.freeze({
      title: text(P2.codex?.simeonAtwood?.title), header: text(P2.codex?.simeonAtwood?.header),
      hatchedAPlan: text(P2.codex?.simeonAtwood?.hatchedAPlan),
      otherwise: text(P2.codex?.simeonAtwood?.otherwise),
    }),
    williamHemlock: Object.freeze({
      title: text(P2.codex?.williamHemlock?.title), body: text(P2.codex?.williamHemlock?.body),
    }),
    riverHawthorne: Object.freeze({
      title: text(P2.codex?.riverHawthorne?.title), body: text(P2.codex?.riverHawthorne?.body),
    }),
    gideonMizrah: Object.freeze({
      title: text(P2.codex?.gideonMizrah?.title), header: text(P2.codex?.gideonMizrah?.header),
      gideon1: text(P2.codex?.gideonMizrah?.gideon1), gideon2: text(P2.codex?.gideonMizrah?.gideon2),
      gideon3: text(P2.codex?.gideonMizrah?.gideon3),
    }),
    judithPark: Object.freeze({
      title: text(P2.codex?.judithPark?.title), header: text(P2.codex?.judithPark?.header),
      judith1: text(P2.codex?.judithPark?.judith1), judith2: text(P2.codex?.judithPark?.judith2),
      judith3: text(P2.codex?.judithPark?.judith3), judith4: text(P2.codex?.judithPark?.judith4),
    }),
    theoPeters: Object.freeze({
      title: text(P2.codex?.theoPeters?.title), header: text(P2.codex?.theoPeters?.header),
      distractedTheBear: text(P2.codex?.theoPeters?.distractedTheBear),
      otherwise: text(P2.codex?.theoPeters?.otherwise),
    }),
    boardingHouse: Object.freeze({ title: text(P2.codex?.boardingHouse?.title), body: text(P2.codex?.boardingHouse?.body) }),
    theCrossroads: Object.freeze({ title: text(P2.codex?.theCrossroads?.title), body: text(P2.codex?.theCrossroads?.body) }),
    hemlockChapel: Object.freeze({ title: text(P2.codex?.hemlockChapel?.title), body: text(P2.codex?.hemlockChapel?.body) }),
    theOldMill: Object.freeze({ title: text(P2.codex?.theOldMill?.title), body: text(P2.codex?.theOldMill?.body) }),
    theAtwoodHouse: Object.freeze({
      title: text(P2.codex?.theAtwoodHouse?.title), body: text(P2.codex?.theAtwoodHouse?.body),
      body2: text(P2.codex?.theAtwoodHouse?.body2),
    }),
    tadsGeneralStore: Object.freeze({
      title: text(P2.codex?.tadsGeneralStore?.title), header: text(P2.codex?.tadsGeneralStore?.header),
      runningAnErrand: text(P2.codex?.tadsGeneralStore?.runningAnErrand),
      otherwise: text(P2.codex?.tadsGeneralStore?.otherwise),
    }),
    valeSchoolhouse: Object.freeze({ title: text(P2.codex?.valeSchoolhouse?.title), body: text(P2.codex?.valeSchoolhouse?.body) }),
    theCommons: Object.freeze({ title: text(P2.codex?.theCommons?.title), body: text(P2.codex?.theCommons?.body) }),
    theCurse: Object.freeze({ title: text(P2.codex?.theCurse?.title), body: text(P2.codex?.theCurse?.body) }),
    xp: Object.freeze({
      motherRachel: text(P2.codex?.xp?.motherRachel), tadsGeneralStore: text(P2.codex?.xp?.tadsGeneralStore),
      theCommons: text(P2.codex?.xp?.theCommons), theCurse: text(P2.codex?.xp?.theCurse),
      judithPark: text(P2.codex?.xp?.judithPark), gideonMizrah: text(P2.codex?.xp?.gideonMizrah),
      riverHawthorne: text(P2.codex?.xp?.riverHawthorne), williamHemlock: text(P2.codex?.xp?.williamHemlock),
      theoPeters: text(P2.codex?.xp?.theoPeters),
    }),
  }),
  noteLabels: Object.freeze({
    motherRachel: Object.freeze({ ...(SECTIONS.key?.['[motherRachelNotes]'] || {}) }),
    leahAtwood: Object.freeze({ ...(SECTIONS.key?.['[leahAtwoodNotes]'] || {}) }),
    simeonAtwood: Object.freeze({ ...(SECTIONS.key?.['[simeonAtwoodNotes]'] || {}) }),
    williamHemlock: Object.freeze({ ...(SECTIONS.key?.['[williamHemlockNotes]'] || {}) }),
    riverHawthorne: Object.freeze({ ...(SECTIONS.key?.['[riverHawthorneNotes]'] || {}) }),
    gideonMizrah: Object.freeze({ ...(SECTIONS.key?.['[gideonMizrahNotes]'] || {}) }),
    judithPark: Object.freeze({ ...(SECTIONS.key?.['[judithParkNotes]'] || {}) }),
    theoPeters: Object.freeze({ ...(SECTIONS.key?.['[theoPetersNotes]'] || {}) }),
  }),
  xp: Object.freeze({ bonus: text(P2.xp?.bonus) }),
  remembered: Object.freeze({ youAreRunningAnErrand: keyText('remembered', 'youAreRunningAnErrand') }),
  labels: Object.freeze({
    survey: text(P2.label?.survey),
    writtenInRock: text(P2.label?.writtenInRock),
    hemlockHouse: text(P2.label?.hemlockHouse),
    theSilentHeath: text(P2.label?.theSilentHeath),
    theLostSister: text(P2.label?.theLostSister),
    theThingInTheDepths: text(P2.label?.theThingInTheDepths),
    theSecondEvening: text(P2.label?.theSecondEvening),
    theThirdEvening: text(P2.label?.theThirdEvening),
  }),
  tooltips: Object.freeze({
    boardingHouse: Object.freeze({
      codex: keyText('tooltips', 'boardingHouse', 'day', 'codex'),
      heal: keyText('tooltips', 'boardingHouse', 'day', 'heal'),
    }),
    hemlockChapel: Object.freeze({
      codex: keyText('tooltips', 'hemlockChapel', 'day', 'codex'),
      search: keyText('tooltips', 'hemlockChapel', 'day', 'search'),
    }),
    valeSchoolhouse: Object.freeze({
      codex: keyText('tooltips', 'valeSchoolhouse', 'day', 'codex'),
      search: keyText('tooltips', 'valeSchoolhouse', 'day', 'search'),
    }),
  }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key => [key, Object.freeze({
    title: text(P2.resolutions?.[key]?.title),
    body: text(P2.resolutions?.[key]?.body),
  })]))),
  resolutionBranches: Object.freeze({
    resolution1ToResolution3: 'Skip to Resolution 3.',
    resolution2ToResolution3: 'Proceed to Resolution 3.',
    resolution3Survey: text(P2.label?.survey),
    resolution3SkipSetup: 'When setting up the next scenario, skip steps 1-8 of “Setting Up the Game” on page 27 of the Rules Reference.',
  }),
}
SCENARIO_TEXT_VALUE.setup = SCENARIO_TEXT_VALUE.setupSteps.map(step => step.text).filter(Boolean).join('\n\n')
export const SCENARIO_TEXT = Object.freeze(SCENARIO_TEXT_VALUE)

// 法典条目表（共享组地点/居民条目注释里引用的 definition.CODEX_ENTRIES）：
// number / id / kind / limit / branches，以及印刷标题；引擎声明用 CODEX_SPEC（同源）。
const LOCATION_CODEX_ID_SET = new Set(Object.values(CODEX_BY_LOCATION))
export const CODEX_ENTRIES = Object.freeze(CODEX_SPEC.map(entry => Object.freeze({
  number: CODEX_NUMBERS[entry.id],
  id: entry.id,
  kind: entry.resident ? 'resident' : LOCATION_CODEX_ID_SET.has(entry.id) ? 'location' : 'step',
  ...(entry.resident ? { resident: RESIDENT_KEYS.find(id => RESIDENT_RECORDS[id].level === entry.resident.relationship) } : {}),
  limit: entry.limit,
  branches: Object.freeze(entry.branches.map(branch => branch.id)),
  title: text(P2.codex?.[entry.id]?.title),
})))
export const CODEX_ENTRY_BY_ID = Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.id, entry])))
export const CODEX_ENTRY_BY_NUMBER = Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.number, entry])))
// ---------------------------------------------------------------------------
// 遭遇定义：Residents 组（storyAssets）+ Day Two 时间标记 + Downpour（未使用）
// ---------------------------------------------------------------------------
const DEFINITION_CODES = [
  ...RESIDENT_ASSET_CODES,
  TIME_MARKER_CODE,
  UNUSED_TREACHERY_CODE,
]
export const DEFINITIONS = encounterDefinitions(DEFINITION_CODES)
// 居民/时间标记是剧情资产：保证 spawnStoryAsset 能找到定义（engine card-lookup 合并 storyAssets）。
export const STORY_ASSETS = Object.freeze({ ...DEFINITIONS.storyAssets })
export const ENEMIES = Object.freeze({ ...DEFINITIONS.enemies })
export const TREACHERIES = Object.freeze({ ...DEFINITIONS.treacheries })

// ---------------------------------------------------------------------------
// 时间标记 / 场景参考卡
// ---------------------------------------------------------------------------
export const TIME_MARKER = Object.freeze({
  code: TIME_MARKER_CODE, face: TIME_MARKER_FACE, stepCode: STEP_CODE,
  name: ALL_CARDS[TIME_MARKER_CODE]?.nameZh || ALL_CARDS[TIME_MARKER_CODE]?.name || 'Day Two',
  nameEn: ALL_CARDS[TIME_MARKER_CODE]?.name || 'Day Two',
})
export const STORY_FACES = Object.freeze({
  [STEP_CODE]: Object.freeze({ ...printed(TIME_MARKER_CODE), code: STEP_CODE, originalCode: TIME_MARKER_CODE,
    type: 'scenario', face: 'a', name: TIME_MARKER.name, nameEn: TIME_MARKER.nameEn }),
  [REFERENCE_CODE]: Object.freeze({ ...printed(REFERENCE_CODE), type: 'scenario' }),
})

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
// 幕 1（10684）：调查员不能受到伤害/恐惧，也不能被击败；目标是「与当地人交谈」——
// 印刷没有数值条件，behavior 以「已读至少 3 条法典」作为推进口径（近似，见 behavior 注释）。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT_CODE),
    id: 'act1',
    reveal: { type: 'campaignRule' },
    objective: { type: 'chapterRule', chapterFlow: 'talkToTheLocals', codexThreshold: ACT_CODEX_THRESHOLD },
  }),
})
// 议程 1（10683）：毁灭阈值 6（印刷）；背面按「Bertie was rescued」读结局 1 或 2。
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA_CODE),
    id: 'agenda1',
    reveal: { type: 'campaignRule' },
  }),
})
export const ACTS = Object.freeze([structuredClone(ACT_STAGES[1])])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES[1])])

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  stepCode: STEP_CODE,
  timeMarker: TIME_MARKER,
  isPrelude: true,
  day: PRELUDE_DAY,
  time: PRELUDE_PERIOD,
  nextScenarioId: null,
  name: '第二日黎明 · Dawn of the Second Day',
  nameEn: 'Dawn of the Second Day',
  encounterCode: ENCOUNTER_CODE,
  gatherGroups: [...GATHER_GROUPS],
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  codex: SCENARIO_TEXT.codex,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  inPlayAliases: [...IN_PLAY_ALIASES],
  valeLocationIds: [...LOCATION_IDS],
  iconsConnect: true,
  acts: ACTS,
  agendas: AGENDAS,
  enemies: ENEMIES,
  treacheries: TREACHERIES,
  storyAssets: STORY_ASSETS,
  storyFaces: STORY_FACES,
  encounterDeck: [],
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key => [key,
    SCENARIO_TEXT.resolutions[key]?.body || '']))),
  tokenMeanings: {
    easy: { ...DAWN_TOKEN_MEANINGS.easy },
    standard: { ...DAWN_TOKEN_MEANINGS.standard },
    hard: { ...DAWN_TOKEN_MEANINGS.hard },
    expert: { ...DAWN_TOKEN_MEANINGS.expert },
  },
  // 引擎机制声明（mechanic-state.js 的允许字段）：
  //   noEncounterDeck：指南「During these preludes, there is no encounter deck」；
  //   protectInvestigators：幕 1 正面「Investigators cannot take damage/horror or be defeated」；
  //   calendar：进入序曲时把时间推进到第 2 日白天（campaign meta 的 Day2/Day）；
  //   codex / residents：法典与居民记录（引擎 scenario-calendar.js / resident-record.js 读点）；
  //   survey：结局 3 的「整备 + 跳过下次开局步骤 1–8」（survey-preparation.js 读点）。
  mechanics: {
    noEncounterDeck: true,
    protectInvestigators: true,
    calendar: { maximumDay: 3, record: 'hemlockDate', periodByLocationTrait: null },
    codex: CODEX_SPEC,
    residents: RESIDENTS_SPEC,
    survey: { destinations: [...SURVEY_DESTINATIONS], resolutions: ['resolution3'] },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, TIME_MARKER_CODE, ACT_CODE, AGENDA_CODE,
  ...LOCATION_TABLE.map(([, code]) => code),
  ...RESIDENT_ASSET_CODES,
  HEMLOCK_CURSE_CODE, UNUSED_TREACHERY_CODE,
].map(code => [code, ALL_CARDS[code]])))
