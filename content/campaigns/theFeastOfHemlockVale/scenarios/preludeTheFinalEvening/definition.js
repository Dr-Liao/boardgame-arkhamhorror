// 最终之夜（preludeTheFinalEvening · 提示卡 10679b，参考卡 10704「小山谷」）· 章节数据。
//
// 参考：
//   · Scenario/Scenarios/TheFeastOfHemlockVale/PreludeTheFinalEvening.hs（Layout / PreScenarioSetup /
//     Setup / RunMessage 的 codex 1–16 + Θ + Ω / ScenarioResolution）；
//   · Campaigns/TheFeastOfHemlockVale/{Helpers,TokenHelpers,Key}.hs（居民关系等级、划掉居民、
//     序曲混乱标记、法典编号 Θ=100 / Ω=101）；
//   · Location/CardDefs/TheFeastOfHemlockVale/{TheVale,DayOfTheFeast}.hs（符号与连接图标）；
//   · Agenda/CardDefs/TheFeastOfHemlockVale/DayOfTheFeast.hs（Around the Table / Lambs to the Slaughter）；
//   · frontend/src/locales/en/theFeastOfHemlockVale/base.json 的 `prelude4` 段（印刷正文，经
//     story-text.js → story-access.js 读取）。
//
// 这是序曲（isPrelude）：没有遭遇牌库（hasEncounterDeckL .~ False）、没有胜利点需求，调查员在
// 十字路口/旅舍之间走访居民、读法典、为《山谷的命运》做准备。卡面数据一律从 card-data.js 的
// printed()/location()/stage()/encounterDefinitions() 读取，不抄第二份卡文。
//
// 卡号归属（input.cards 为空：本序曲不新建任何单卡条目）：
//   · The Final Day：10679（时间指示卡「第三日/第三夜」）、10680 异界幻象 ×3（序曲不建遭遇牌库，不用）；
//   · Day of the Feast：10688 围坐桌边（幕+议程同一张卡）、10689 待宰羔羊（放一边的特别议程）、
//     10690b 十字路口（傍晚面）、10691b 老磨坊（傍晚面）、10692 狂乱的赴宴者 ×2；
//   · The Vale：10705a 旅舍 / 10707a 教堂 / 10709a 阿特伍德宅 / 10710a 塔德杂货店 /
//     10711a 山谷学校 / 10712a 社群大厅（均为 (Day) 面）；
//   · Residents：10693–10703 资产面 / 10693b–10701b 敌人面（共享遭遇组 worker 的单卡条目）；
//   · Heirlooms：10713–10715（本序曲不发放，见 PRELUDE_HEIRLOOM_REWARDS）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  SYMBOLS, encounterDefinitions, identitiesFor, location, stage,
} from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { THE_FINAL_EVENING_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'preludeTheFinalEvening'
// 序曲提示卡：10679b 是「第三夜」时间指示卡的背面（frontend step）。章节参考卡固定为
// 10704「小山谷」（The Vale），混乱符号也印在这张卡上。
export const REFERENCE_CODE = '10704'
export const STEP_CODE = '10679b'
export const IS_PRELUDE = true
// 输入 JSON 的 encounterCode 是合成值（本序曲没有自己的遭遇组）；真实 gather 组见 GATHER_GROUPS。
export const ENCOUNTER_CODE = 'prelude_the_final_evening'

// 时间：最终之夜 = 第三日的夜里（The Final Day 的时间指示卡翻到「第三夜」面）。
export const DAY_NUMBER = 3
export const PRELUDE_DATE = Object.freeze({ day: DAY_NUMBER, period: 'night' })
export const PRELUDE_DATE_RECORD = 'hemlockDate'
export const TIME_MARKER_CODE = '10679'
export const TIME_MARKER = Object.freeze({
  code: TIME_MARKER_CODE, face: 'back', day: DAY_NUMBER, period: 'night',
  name: 'Night Three', nameZh: '第三夜',
})

// ---------------------------------------------------------------------------
// 遭遇组
// ---------------------------------------------------------------------------
// 参考 Setup：gather TheFinalDay / DayOfTheFeast / TheVale + gatherAndSetAside Residents。
export const GATHER_GROUPS = Object.freeze(['theFinalDay', 'dayOfTheFeast', 'theVale', 'residents'])
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['residents'])
// 放一边：整组 Residents（20 张双面居民）+ 特别议程「待宰羔羊」。
export const RESIDENT_ASSET_CODES = Object.freeze([
  '10693', '10694', '10695', '10696', '10697', '10698', '10699', '10700', '10701', '10702', '10703',
])
export const RESIDENT_ENEMY_CODES = Object.freeze([
  '10693b', '10694b', '10695b', '10696b', '10697b', '10698b', '10699b', '10700b', '10701b',
])
export const SPECIAL_AGENDA_CODE = '10689'
export const FRENZIED_REVELER_CODE = '10692'
export const SET_ASIDE_CARDS = Object.freeze([...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES, SPECIAL_AGENDA_CODE])
// 序曲没有遭遇牌库（参考 hasEncounterDeckL .~ False）；10680 异界幻象随 The Final Day 一并收进来
// 但不使用，因此不算进任何区域（见 approximations）。
export const ENCOUNTER_DECK = Object.freeze([])
export const UNUSED_ENCOUNTER_CODES = Object.freeze(['10680'])

// ---------------------------------------------------------------------------
// 地点：The Vale 的八个地点 + 符号连接（prelude/scenario 用 The Vale 时「只按印刷图标连接」）
// ---------------------------------------------------------------------------
// 印刷地图（指南第 6 页 / Haskell#Layout 的 6 行 3 列）：每个符号占上下两格。
export const MAP_GRID = Object.freeze([
  Object.freeze(['.', 'triangle', 'square']),
  Object.freeze(['moon', 'triangle', 'square']),
  Object.freeze(['moon', 'diamond', 'star']),
  Object.freeze(['heart', 'diamond', 'star']),
  Object.freeze(['heart', 'circle', 'spade']),
  Object.freeze(['.', 'circle', 'spade']),
])
// card-data.js 的 SYMBOLS 没有 spade（黑桃），这里只补这一个，其余复用共享表。
export const PRELUDE_SYMBOLS = Object.freeze({
  ...SYMBOLS,
  spade: Object.freeze({ id: 'spade', label: '黑桃', glyph: '♠' }),
})
// 地点表：[id, code, 符号, 每位调查员线索, 遭遇组, 正/背面]
export const LOCATION_TABLE = Object.freeze([
  ['theCrossroads', '10690b', 'diamond', 0, 'dayOfTheFeast', 'evening'],
  ['boardingHouse', '10705a', 'circle', 0, 'theVale', 'day'],
  ['hemlockChapel', '10707a', 'triangle', 0, 'theVale', 'day'],
  ['theOldMill', '10691b', 'heart', 1, 'dayOfTheFeast', 'evening'],
  ['theAtwoodHouse', '10709a', 'moon', 0, 'theVale', 'day'],
  ['tadsGeneralStore', '10710a', 'square', 0, 'theVale', 'day'],
  ['valeSchoolhouse', '10711a', 'spade', 0, 'theVale', 'day'],
  ['theCommons', '10712a', 'star', 0, 'theVale', 'day'],
])
export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const SYMBOL_BY_LOCATION = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , symbol]) => [id, symbol])))
export const LOCATION_ID_BY_SYMBOL = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , symbol]) => [symbol, id])))
// 印刷连接图标（Location/CardDefs 的最后一个参数）。图标指向的符号 → 在场地点的 id。
export const LOCATION_CONNECTION_ICONS = Object.freeze({
  theCrossroads: Object.freeze(['triangle', 'square', 'star', 'circle', 'heart', 'moon']),
  boardingHouse: Object.freeze(['diamond', 'spade']),
  hemlockChapel: Object.freeze(['diamond', 'moon']),
  theOldMill: Object.freeze(['diamond', 'moon']),
  theAtwoodHouse: Object.freeze(['diamond', 'triangle', 'heart']),
  tadsGeneralStore: Object.freeze(['diamond', 'star']),
  valeSchoolhouse: Object.freeze(['star', 'circle']),
  theCommons: Object.freeze(['diamond', 'square', 'spade']),
})
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => [
  id, Object.freeze(LOCATION_CONNECTION_ICONS[id]
    .map(icon => LOCATION_ID_BY_SYMBOL[icon])
    .filter(Boolean)
    .filter(target => target !== id)),
])))

/** 符号在地图上的坐标（两格取中点）：x 为列、y 为行（上→下）。 */
function symbolCoordinate(symbol) {
  const cells = []
  MAP_GRID.forEach((row, y) => row.forEach((cell, x) => { if (cell === symbol) cells.push([x, y]) }))
  if (!cells.length) throw new RangeError(`地图上没有符号：${symbol}`)
  const sum = cells.reduce((total, [x, y]) => [total[0] + x, total[1] + y], [0, 0])
  return { x: sum[0] / cells.length, y: sum[1] / cells.length }
}
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(
  LOCATION_IDS.map(id => [id, Object.freeze(symbolCoordinate(SYMBOL_BY_LOCATION[id]))])))

// 被移出游戏的两张地点：The Vale 的十字路口与老磨坊（参考 Setup「crossroadsAndOldMill」）。
export const REMOVED_LOCATIONS = Object.freeze([
  Object.freeze({ id: 'theCrossroadsVale', name: 'The Crossroads', frontCode: '10706a', backCode: '10706b' }),
  Object.freeze({ id: 'theOldMillVale', name: 'The Old Mill', frontCode: '10708a', backCode: '10708b' }),
])
export const REMOVED_LOCATION_CODES = Object.freeze(
  REMOVED_LOCATIONS.flatMap(row => [row.frontCode, row.backCode]))

function makeLocation([id, code, symbol, clues, group, side]) {
  const point = LOCATION_COORDINATES[id]
  return location({
    id, code, clues, x: point.x, y: point.y,
    symbol,
    symbols: { front: { symbol, links: [...LOCATION_CONNECTION_ICONS[id]] },
      back: { symbol, links: [...LOCATION_CONNECTION_ICONS[id]] } },
    connections: [...LOCATION_CONNECTIONS[id]],
    encounterGroup: group,
    locationSide: side,
    hemlockVale: true,
    ...(id === 'theCrossroads' ? { central: true } : {}),
  })
}
export const LOCATIONS = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(row => [row[0], makeLocation(row)])))

export const START_LOCATION = 'theCrossroads'
export const START_LOCATION_WHEN_INTERRUPTED = 'boardingHouse'
export const BOARDING_HOUSE_ID = START_LOCATION_WHEN_INTERRUPTED
export const THE_CROSSROADS_ID = START_LOCATION
export const THE_ATWOOD_HOUSE_ID = 'theAtwoodHouse'
export const THE_COMMONS_ID = 'theCommons'
export const THE_OLD_MILL_ID = 'theOldMill'
export const VALE_SCHOOLHOUSE_ID = 'valeSchoolhouse'
export const HEMLOCK_CHAPEL_ID = 'hemlockChapel'

// ---------------------------------------------------------------------------
// 幕 / 议程：Around the Table 同时是当前幕与当前议程；Lambs to the Slaughter 放一边
// ---------------------------------------------------------------------------
// 参考 `setAgendaDeck [Agendas.aroundTheTable]` + setup「It is both the current act and current agenda」，
// 以及 `setAside [Agendas.lambsToTheSlaughter]`。印刷卡只有议程面，幕实例用同一卡号另给 id，
// 让 scenario.acts / scenario.agendas 各自有稳定身份（披露见 approximations）。
export const STAGE_CARD_CODE = '10688'
export const ACT_CODES = Object.freeze([STAGE_CARD_CODE])
export const AGENDA_CODES = Object.freeze([STAGE_CARD_CODE])
export const ACT_ID = `act${STAGE_CARD_CODE}`
export const AGENDA_ID = `agenda${STAGE_CARD_CODE}`
export const AGENDA_DOOM_THRESHOLD = Number(ALL_CARDS[STAGE_CARD_CODE]?.doom) || 6
export const SPECIAL_AGENDA_STAGE_CODE = SPECIAL_AGENDA_CODE
export const SPECIAL_AGENDA_DOOM_THRESHOLD = Number(ALL_CARDS[SPECIAL_AGENDA_CODE]?.doom) || 5
export const SPECIAL_AGENDA_RESIDENT_VICTORY_PER_INVESTIGATOR = 1
export const SPECIAL_AGENDA_RESIDENT_VICTORY_BASE = 1

// 同一张印刷卡的两个实例：幕实例换 id/type，正文与印刷数值不变。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(STAGE_CARD_CODE, { stage: 1, id: ACT_ID, type: 'act' }),
    singleStageCard: true }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(STAGE_CARD_CODE, { stage: 1 })),
})
export const SPECIAL_AGENDA_STAGE = Object.freeze(stage(SPECIAL_AGENDA_CODE, { stage: 3 }))
export const ACTS = Object.freeze([{ ...ACT_STAGES[1] }])
export const AGENDAS = Object.freeze([{ ...AGENDA_STAGES[1] }])
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: STAGE_CARD_CODE })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: STAGE_CARD_CODE })

// ---------------------------------------------------------------------------
// 居民：关系等级 / 笔记 / 划掉（Campaigns/.../Helpers.hs 的 Resident 表）
// ---------------------------------------------------------------------------
// 每个居民是双面卡：资产面（在场时）与敌人面（关系等级过低或剧情翻面）。记录键与
// Campaigns/.../Key.hs 的 <名字>RelationshipLevel / <名字>Notes / <名字>CrossedOut 一一对应；
// 关系等级上限 5（战役日志的五个方框）。
export const RESIDENT_MAX_RELATIONSHIP = 5
export const RESIDENTS = Object.freeze([
  Object.freeze({
    id: 'motherRachel', name: '蕾切尔嬷嬷', nameEn: 'Mother Rachel',
    assetCode: '10693', enemyCode: '10693b', location: THE_CROSSROADS_ID, threshold: null,
    record: Object.freeze({ level: 'motherRachelRelationshipLevel', notes: 'motherRachelNotes',
      crossedOut: 'motherRachelCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'leahAtwood', name: '莉亚·阿特伍德', nameEn: 'Leah Atwood',
    assetCode: '10694', enemyCode: '10694b', location: HEMLOCK_CHAPEL_ID, threshold: 2,
    record: Object.freeze({ level: 'leahAtwoodRelationshipLevel', notes: 'leahAtwoodNotes',
      crossedOut: 'leahCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'simeonAtwood', name: '西米恩·阿特伍德', nameEn: 'Simeon Atwood',
    assetCode: '10695', enemyCode: '10695b', location: VALE_SCHOOLHOUSE_ID, threshold: 3,
    record: Object.freeze({ level: 'simeonAtwoodRelationshipLevel', notes: 'simeonAtwoodNotes',
      crossedOut: 'simeonCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'williamHemlock', name: '威廉·赫姆洛克', nameEn: 'William Hemlock',
    assetCode: '10696', enemyCode: '10696b', location: null, threshold: null,
    record: Object.freeze({ level: 'williamHemlockRelationshipLevel', notes: 'williamHemlockNotes',
      crossedOut: 'williamCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'riverHawthorne', name: '里弗·霍桑', nameEn: 'River Hawthorne',
    assetCode: '10697', enemyCode: '10697b', location: null, threshold: null,
    record: Object.freeze({ level: 'riverHawthorneRelationshipLevel', notes: 'riverHawthorneNotes',
      crossedOut: 'riverCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'gideonMizrah', name: '吉迪恩·米兹拉', nameEn: 'Gideon Mizrah',
    assetCode: '10698', enemyCode: '10698b', location: THE_COMMONS_ID, threshold: 3,
    record: Object.freeze({ level: 'gideonMizrahRelationshipLevel', notes: 'gideonMizrahNotes',
      crossedOut: 'gideonCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'judithPark', name: '朱迪思·帕克', nameEn: 'Judith Park',
    assetCode: '10699', enemyCode: '10699b', location: THE_OLD_MILL_ID, threshold: 2,
    record: Object.freeze({ level: 'judithParkRelationshipLevel', notes: 'judithParkNotes',
      crossedOut: 'judithCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'theoPeters', name: '西奥·彼得斯', nameEn: 'Theo Peters',
    assetCode: '10700', enemyCode: '10700b', location: 'tadsGeneralStore', threshold: 2,
    record: Object.freeze({ level: 'theoPetersRelationshipLevel', notes: 'theoPetersNotes',
      crossedOut: 'theoCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'bertieMusgrave', name: '伯蒂·马斯格雷夫', nameEn: 'Bertie Musgrave',
    assetCode: '10701', enemyCode: '10701b', location: THE_CROSSROADS_ID, threshold: null,
    record: Object.freeze({ level: 'bertieMusgraveRelationshipLevel', notes: 'bertieMusgraveNotes',
      crossedOut: 'bertieCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'drRosaMarquez', name: '罗莎·马奎兹博士', nameEn: 'Dr. Rosa Marquez',
    assetCode: '10702', enemyCode: null, location: null, threshold: null,
    record: Object.freeze({ level: 'drRosaMarquezRelationshipLevel', notes: 'drRosaMarquezNotes',
      crossedOut: 'drRosaMarquezCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'helenPeters', name: '海伦·彼得斯', nameEn: 'Helen Peters',
    assetCode: '10703', enemyCode: null, location: null, threshold: null,
    record: Object.freeze({ level: 'helenPetersRelationshipLevel', notes: 'helenPetersNotes',
      crossedOut: 'helenPetersCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
])
export const RESIDENT_BY_ID = Object.freeze(Object.fromEntries(RESIDENTS.map(row => [row.id, row])))
export const RESIDENT_BY_ASSET_CODE = Object.freeze(Object.fromEntries(
  RESIDENTS.map(row => [row.assetCode, row])))
export const RESIDENT_BY_ENEMY_CODE = Object.freeze(Object.fromEntries(
  RESIDENTS.filter(row => row.enemyCode).map(row => [row.enemyCode, row])))
export const DR_MARQUEZ_CODE = '10702'
export const BERTIE_ASSET_CODE = '10701'
export const BERTIE_ENEMY_CODE = '10701b'
// 参考 Setup 的 placeResident 顺序（蕾切尔先在十字路口，其余五处按地点）。
export const RESIDENT_PLACEMENT_ORDER = Object.freeze([
  'motherRachel', 'leahAtwood', 'simeonAtwood', 'gideonMizrah', 'judithPark', 'theoPeters',
])
// 印刷「关系等级 ≤ 该值时翻到敌人面」的阈值（Haskell placeResident 的第二参数）。
export const RESIDENT_FLIP_THRESHOLDS = Object.freeze(Object.fromEntries(
  RESIDENTS.filter(row => row.threshold != null).map(row => [row.id, row.threshold])))
// 开局放在一边（out of play）的居民：两位赫姆洛克继承人与海伦；伯蒂只在显灵时入场。
export const SET_ASIDE_RESIDENT_IDS = Object.freeze(['williamHemlock', 'riverHawthorne', 'helenPeters'])
// 狂乱的赴宴者：1 张在社群大厅；3–4 位调查员时第 2 张在教堂。
export const FRENZIED_REVELER_SPAWN = Object.freeze({
  primary: THE_COMMONS_ID, extra: HEMLOCK_CHAPEL_ID, extraFromInvestigators: 3, copies: 2,
})

// ---------------------------------------------------------------------------
// 序曲整备不发放传家宝：Heirlooms 组（10713–10715）由白天序曲/幕间发放，本序曲不涉及。
// ---------------------------------------------------------------------------
export const HEIRLOOM_CODES = Object.freeze(['10713', '10714', '10715'])
export const PRELUDE_HEIRLOOM_REWARDS = Object.freeze([])

// ---------------------------------------------------------------------------
// 战役记录键（Campaigns/.../Key.hs；内容层用小驼峰 ASCII）
// ---------------------------------------------------------------------------
export const RECORD_KEYS = Object.freeze({
  believed: 'theInvestigatorsBelieved',
  lied: 'theInvestigatorsLiedToMotherRachel',
  interrupted: 'theInvestigatorsInterruptedTheFeast',
  drMarquezHasAPlan: 'drMarquezHasAPlan',
  areasSurveyedNorthPointMine: 'areasSurveyedNorthPointMine',
  bertieHadAnEpiphany: 'bertieHadAnEpiphany',
  bertiePerished: 'bertiePerished',
  valeIsFullOfFireworks: 'theValeIsFullOfFireworks',
  leahSawSomethingInTheMine: 'leahSawSomethingInTheMine',
  gideonToldTheTaleOfTheAnnabelleLee: 'gideonToldTheTaleOfTheAnnabelleLee',
  gideonFoundHisTreasure: 'gideonFoundHisTreasure',
  gideonFinishedTheTaleOfAnnabelleLee: 'gideonFinishedTheTaleOfAnnabelleLee',
  youBackedJudithUp: 'youBackedJudithUp',
  theoIsHavingSecondThoughts: 'theoIsHavingSecondThoughts',
  theoReconciledWithHelen: 'theoReconciledWithHelen',
  riverIsReclaimingTheirLegacy: 'riverIsReclaimingTheirLegacy',
  williamIsResolved: 'williamIsResolved',
  theHemlocksMadeATruce: 'theHemlocksMadeATruce',
  // 序曲自身写入的推进记录（内容层新增，供战役层读取下一步）。
  resolution: 'preludeTheFinalEveningResolution',
  nextStep: 'preludeTheFinalEveningNextStep',
  codexRead: 'preludeTheFinalEveningCodexRead',
  replayRequested: 'preludeTheFinalEveningReplayRequested',
  campaignLost: 'preludeTheFinalEveningLost',
})
// 序曲结局 → 下一段（参考 ScenarioResolution 的 push 链）：
// R1 → R4、R2 → R3、R3 → 重玩或输掉战役、无结局 → R2/R4、R4 →《山谷的命运》。
export const NEXT_SCENARIO_ID = 'fateOfTheVale'
export const RESOLUTION_KEYS = Object.freeze(['resolution1', 'resolution2', 'resolution3', 'resolution4'])
export const NO_RESOLUTION = 'noResolution'
export const RESOLUTION_ORDER = Object.freeze({
  [NO_RESOLUTION]: 'resolution2/4', resolution1: 'resolution4', resolution2: 'resolution3',
  resolution3: 'replay/lose', resolution4: NEXT_SCENARIO_ID,
})
export const REPLAY_LABEL_KEY = 'replay'
export const LOSE_CAMPAIGN_LABEL_KEY = 'loseTheCampaign'

// ---------------------------------------------------------------------------
// 法典（Codex 1–16 + Θ + Ω）：引擎原语 scenario-calendar.js#normalizeCodex 的声明形状。
// ---------------------------------------------------------------------------
// 分支条件只能读「该居民的关系等级 / 笔记 / 是否划掉」，因此：
//   · Leah / Gideon / Judith / Theo 的印刷条件全部记在**该居民自己的笔记**里 → 直接声明为分支条件；
//   · Mother Rachel（相信/撒谎）与 Simeon（烟花）读的是顶层战役记录 → 单分支 `printed`，
//     由 behavior.codexBranch 依记录挑选小节（引擎仍按 limit 保证一次性）；
//   · 地点条目没有「居民记录」，只能单分支；Atwood House 的「哈希冲突」用 `printable` 记忆。
export const CODEX_LIMIT_SCENARIO = 'scenario'
export const CODEX_LIMIT_UNLIMITED = 'unlimited'
export const CODEX_BRANCH_FALLBACK = 'printed'
const residentCodex = id => RESIDENT_BY_ID[id].record

// 各编码条目：id（内容层）、kind、对应场景实体、印刷标题键（prelude4.codex.<id>.title）。
export const CODEX_ENTRIES = Object.freeze([
  Object.freeze({ id: 'motherRachel', kind: 'resident', resident: 'motherRachel', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'leahAtwood', kind: 'resident', resident: 'leahAtwood', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([
      Object.freeze({ id: 'sawMine', notes: Object.freeze([RECORD_KEYS.leahSawSomethingInTheMine]) }),
      Object.freeze({ id: 'otherwise', withoutNotes: Object.freeze([RECORD_KEYS.leahSawSomethingInTheMine]) }),
    ]) }),
  Object.freeze({ id: 'simeonAtwood', kind: 'resident', resident: 'simeonAtwood', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'williamHemlock', kind: 'resident', resident: 'williamHemlock', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'riverHawthorne', kind: 'resident', resident: 'riverHawthorne', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'gideonMizrah', kind: 'resident', resident: 'gideonMizrah', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([
      Object.freeze({ id: 'toldTale', notes: Object.freeze([
        RECORD_KEYS.gideonToldTheTaleOfTheAnnabelleLee, RECORD_KEYS.gideonFoundHisTreasure]) }),
      Object.freeze({ id: 'otherwise', withoutNotes: Object.freeze([
        RECORD_KEYS.gideonToldTheTaleOfTheAnnabelleLee, RECORD_KEYS.gideonFoundHisTreasure]) }),
    ]) }),
  Object.freeze({ id: 'judithPark', kind: 'resident', resident: 'judithPark', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([
      Object.freeze({ id: 'backedUp', notes: Object.freeze([RECORD_KEYS.youBackedJudithUp]) }),
      Object.freeze({ id: 'otherwise', withoutNotes: Object.freeze([RECORD_KEYS.youBackedJudithUp]) }),
    ]) }),
  Object.freeze({ id: 'theoPeters', kind: 'resident', resident: 'theoPeters', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([
      Object.freeze({ id: 'both', notes: Object.freeze([
        RECORD_KEYS.theoIsHavingSecondThoughts, RECORD_KEYS.theoReconciledWithHelen]) }),
      Object.freeze({ id: 'secondThoughts', notes: Object.freeze([RECORD_KEYS.theoIsHavingSecondThoughts]),
        withoutNotes: Object.freeze([RECORD_KEYS.theoReconciledWithHelen]) }),
      Object.freeze({ id: 'otherwise', withoutNotes: Object.freeze([RECORD_KEYS.theoIsHavingSecondThoughts]) }),
    ]) }),
  Object.freeze({ id: 'boardingHouse', kind: 'location', location: 'boardingHouse', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'theCrossroads', kind: 'location', location: 'theCrossroads', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'hemlockChapel', kind: 'location', location: 'hemlockChapel', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'theOldMill', kind: 'location', location: 'theOldMill', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  // 「You may trigger this codex again」：Atwood House 选「让他们自己打」后可再触发。
  Object.freeze({ id: 'theAtwoodHouse', kind: 'location', location: 'theAtwoodHouse', limit: CODEX_LIMIT_UNLIMITED,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'tadsGeneralStore', kind: 'location', location: 'tadsGeneralStore', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'valeSchoolhouse', kind: 'location', location: 'valeSchoolhouse', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'theCommons', kind: 'location', location: 'theCommons', limit: CODEX_LIMIT_SCENARIO,
    branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  // Θ = 100（Haskell pattern Theta）、Ω = 101（pattern Omega）。
  Object.freeze({ id: 'drRosaMarquez', kind: 'character', code: DR_MARQUEZ_CODE, number: 100,
    limit: CODEX_LIMIT_SCENARIO, branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
  Object.freeze({ id: 'bertieMusgrave', kind: 'character', code: BERTIE_ASSET_CODE, number: 101,
    limit: CODEX_LIMIT_SCENARIO, branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_FALLBACK })]) }),
])
export const CODEX_IDS = Object.freeze(CODEX_ENTRIES.map(entry => entry.id))
export const CODEX_BY_ID = Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.id, entry])))
export const CODEX_SPEC = Object.freeze(CODEX_ENTRIES.map(entry => Object.freeze({
  id: entry.id,
  limit: entry.limit,
  ...(entry.resident ? { resident: Object.freeze({
    relationship: residentCodex(entry.resident).level,
    notes: residentCodex(entry.resident).notes,
    crossedOut: residentCodex(entry.resident).crossedOut,
  }) } : {}),
  branches: Object.freeze(entry.branches.map(branch => Object.freeze({ ...branch }))),
})))
export const THEATWOOD_HASHING_RECORD = 'theHemlocksAreHashingItOut'
// Atwood House 的「选边」分支（参考 storyWithChooseOneM 的三个 labeled）。
export const ATWOOD_HOUSE_LABEL_KEYS = Object.freeze(['sideRiver', 'sideWilliam', 'letFight'])

// 法典奖励经验（印刷「Each investigator earns N bonus experience」）。
export const CODEX_BONUS_XP = Object.freeze({
  leahAtwood: 1, simeonAtwood: 2, williamHemlock: 2, riverHawthorne: 2, gideonMizrah: 2,
  judithPark: 2, theoPeters: 2, theAtwoodHouse: 2,
})

// ---------------------------------------------------------------------------
// 印刷正文（唯一事实源：story-text.js → story-access.js）
// ---------------------------------------------------------------------------
const safeChapterStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: {}, sectionsEn: {}, chineseGaps: [] }
  }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sections || {}
const SECTIONS_EN = STORY.sectionsEn || {}
// 本章（base.json 的 prelude4 段）中文正文尚未回填：story-text 的 chineseGaps 覆盖全部 114 条
// 叶子，逐键回退英文，不伪造译文，并在 SCENARIO_TEXT.textStatus 与 approximations 里披露。
const guideKey = key => `prelude4.${key}`
const rawText = fullKey => flattenStory(SECTIONS[fullKey] ?? SECTIONS_EN[fullKey] ?? '')
const text = key => rawText(guideKey(key))
const block = (...keys) => keys.map(text).filter(Boolean).join('\n\n')
const sectionKeys = prefix => Object.keys(SECTIONS_EN)
  .filter(key => key.startsWith(guideKey(prefix)))
  .sort()
const stripPrefix = (key, prefix) => key.slice(guideKey(prefix).length)
const hasChinese = Object.keys(SECTIONS).some(key => SECTIONS[key] != null)
// 扁平的 `a.b.c` 路径 → 嵌套对象（法典小节与分支标签需要按层读取）。
function nestKeys(flat) {
  const root = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let node = root
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
      node = node[part]
    }
    node[parts[parts.length - 1]] = value
  }
  return root
}

// Setup 的 11 条印刷步骤（顺序即面板展示顺序）。
export const SETUP_STEP_KEYS = Object.freeze([
  'gatherSets', 'dayThree', 'buildActAgenda', 'placeLocations', 'crossroadsAndOldMill',
  'frenziedRevelers', 'residents', 'removeResidents', 'placeResidents', 'setOutOfPlace',
  'startAt', 'placeDoom',
])
export const SETUP_STEPS = Object.freeze(SETUP_STEP_KEYS
  .map(key => Object.freeze({ key, text: text(`setup.${key}`) }))
  .filter(step => step.text))

const codexText = id => Object.freeze(nestKeys(Object.fromEntries(sectionKeys(`codex.${id}.`)
  .map(key => [stripPrefix(key, `codex.${id}.`), rawText(key)]))))
// 分支/选项标签：`codex.label.*`（抽牌/资源）与各条目自己的 `codex.<id>.label.*`（问矿井/选边…）。
const codexLabels = Object.freeze({
  ...Object.fromEntries(sectionKeys('codex.label.').map(key => [stripPrefix(key, 'codex.label.'), rawText(key)])),
  ...Object.fromEntries(CODEX_IDS.flatMap(id => sectionKeys(`codex.${id}.label.`)
    .map(key => [stripPrefix(key, `codex.${id}.label.`), rawText(key)]))),
})

export const SCENARIO_TEXT = Object.freeze({
  // 中文缺失 → 英文回退（story-source 未回填 prelude4）。
  textLanguage: hasChinese ? 'zh-CN' : 'en',
  textStatus: hasChinese ? 'translated' : 'pending translation (story-source zh missing; en fallback)',
  heading: text('intro.title'),
  headingKey: `headings.preludeTheFinalEvening`,
  headings: Object.freeze({ finalEvening: flattenStory(SECTIONS_EN['headings.preludeTheFinalEvening'] ?? '') }),
  intro: text('intro.intro1'),
  intro2: text('intro.intro2'),
  introLabels: Object.freeze({
    doneNothingWrongTruth: text('intro.label.doneNothingWrongTruth'),
    doneNothingWrongLie: text('intro.label.doneNothingWrongLie'),
    sentencedToDeath: text('intro.label.sentencedToDeath'),
  }),
  introConditions: Object.freeze({
    proceedToIntro2: text('intro.proceedToIntro2'),
    skipToIntro5: text('intro.skipToIntro5'),
    doneNothingWrongTruth: text('intro.doneNothingWrongTruth'),
    doneNothingWrongLie: text('intro.doneNothingWrongLie'),
    sentencedToDeath: text('intro.sentencedToDeath'),
  }),
  introBranches: Object.freeze({
    intro3: text('intro.intro3'),
    intro4: text('intro.intro4'),
    intro5: text('intro.intro5'),
  }),
  setupSteps: SETUP_STEPS,
  setup: SETUP_STEPS.map(step => step.text).join('\n\n'),
  specialRules: Object.freeze([0, 1, 2, 3, 5].map(index => Object.freeze({
    key: `campaignRule${index}`,
    title: rawText(`specialRules[${index}].title`),
    body: rawText(`specialRules[${index}].body`),
  })).filter(rule => rule.title || rule.body)),
  campaignRules: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7].map(index => Object.freeze({
    index,
    title: rawText(`specialRules[${index}].title`),
    body: rawText(`specialRules[${index}].body`),
  })).filter(rule => rule.title || rule.body)),
  rules: Object.freeze({
    codex: rawText('additionalRulesAndClarifications.theCodex'),
    threeDays: rawText('additionalRulesAndClarifications.threeDaysThreeNights'),
    residents: rawText('additionalRulesAndClarifications.residentsAndRelationshipLevels'),
    locationAdjacency: rawText('additionalRulesAndClarifications.locationAdjacency'),
  }),
  campaignLog: Object.freeze({
    dayTime: rawText('campaignLog.dayTime.title'),
    relationshipLevel: rawText('campaignLog.residents.relationshipLevel'),
    notes: rawText('campaignLog.residents.notes'),
    areasSurveyed: rawText('key.sections.areasSurveyed'),
  }),
  tokens: Object.freeze({
    easyStandard: Object.freeze({
      skull: rawText('tokens.easyStandard.skull'),
      cultist: rawText('tokens.easyStandard.cultist'),
      tablet: rawText('tokens.easyStandard.tablet'),
      elderThing: rawText('tokens.easyStandard.elderThing'),
    }),
    hardExpert: Object.freeze({
      skull: rawText('tokens.hardExpert.skull'),
      cultist: rawText('tokens.hardExpert.cultist'),
      tablet: rawText('tokens.hardExpert.tablet'),
      elderThing: rawText('tokens.hardExpert.elderThing'),
    }),
  }),
  codex: Object.freeze(Object.fromEntries(CODEX_IDS.map(id => [id, codexText(id)]))),
  codexLabels,
  codexXpLabels: Object.freeze(Object.fromEntries(sectionKeys('codex.xp.')
    .map(key => [stripPrefix(key, 'codex.xp.'), rawText(key)]))),
  resolutionLabels: Object.freeze(Object.fromEntries(sectionKeys('resolutions.label.')
    .map(key => [stripPrefix(key, 'resolutions.label.'), rawText(key)]))),
  resolutions: Object.freeze(Object.fromEntries([NO_RESOLUTION, ...RESOLUTION_KEYS].map(key => [key,
    Object.freeze({
      title: text(`resolutions.${key}.title`),
      body: text(`resolutions.${key}.body`),
    })]))),
  chineseGaps: Object.freeze([...(STORY.chineseGaps || [])]),
})

// 遭遇定义：居民双面（资产/敌人）+ 狂乱的赴宴者 + 时间指示卡（剧情卡）。
const definitions = encounterDefinitions([
  ...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES, FRENZIED_REVELER_CODE, TIME_MARKER_CODE,
])

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  stepCode: STEP_CODE,
  encounterCode: ENCOUNTER_CODE,
  isPrelude: IS_PRELUDE,
  name: '最终之夜 · The Final Evening',
  nameEn: 'Prelude: The Final Evening',
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
  setAsideAliases: [...SET_ASIDE_CARDS],
  removedLocations: REMOVED_LOCATION_CODES,
  stageCardShared: true,
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: Object.fromEntries([NO_RESOLUTION, ...RESOLUTION_KEYS]
    .map(key => [key, SCENARIO_TEXT.resolutions[key]?.body || ''])),
  tokenMeanings: {
    easy: { ...THE_FINAL_EVENING_TOKEN_MEANINGS.easy },
    standard: { ...THE_FINAL_EVENING_TOKEN_MEANINGS.standard },
    hard: { ...THE_FINAL_EVENING_TOKEN_MEANINGS.hard },
    expert: { ...THE_FINAL_EVENING_TOKEN_MEANINGS.expert },
  },
  // 引擎机制声明（mechanic-state.js#normalizeScenarioMechanics）：
  //   · calendar —— 三天三夜的日/时段（第三日夜）；setScenarioDate 写 campaign.records[hemlockDate]；
  //   · codex —— 18 条法典（一次性 / Atwood House 可重复）；
  //   · residents —— 11 位居民的关系等级/笔记/划掉记录键（resident-record.js 读点）；
  //   · noEncounterDeck —— 序曲没有遭遇牌库。
  mechanics: {
    calendar: { maximumDay: 3, record: PRELUDE_DATE_RECORD, periodByLocationTrait: null },
    codex: CODEX_SPEC.map(entry => ({ ...entry })),
    residents: RESIDENTS.map(row => ({ id: row.id, name: row.name, nameEn: row.nameEn,
      record: { ...row.record } })),
    noEncounterDeck: true,
  },
  day: DAY_NUMBER,
  time: PRELUDE_DATE.period,
  nextScenarioId: NEXT_SCENARIO_ID,
  heirloomRewards: [...PRELUDE_HEIRLOOM_REWARDS],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
// 双面地点：manifest 的 backCode 指向本卡的另一个面（The Vale 与 Day of the Feast 都是这种双面卡）。
const LOCATION_BACK_CODES = Object.freeze({
  theCrossroads: { front: '10690b', back: '10690a' },
  theOldMill: { front: '10691b', back: '10691a' },
  boardingHouse: { front: '10705a', back: '10705b' },
  hemlockChapel: { front: '10707a', back: '10707b' },
  theAtwoodHouse: { front: '10709a', back: '10709b' },
  tadsGeneralStore: { front: '10710a', back: '10710b' },
  valeSchoolhouse: { front: '10711a', back: '10711b' },
  theCommons: { front: '10712a', back: '10712b' },
})
for (const [id, faces] of Object.entries(LOCATION_BACK_CODES)) {
  identities.locations[id] = { ...identities.locations[id], originalCode: faces.front,
    linkedOriginalCode: faces.back }
}
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, TIME_MARKER_CODE, ...ACT_CODES, ...AGENDA_CODES, SPECIAL_AGENDA_CODE,
  ...LOCATION_TABLE.map(([, code]) => code), ...REMOVED_LOCATION_CODES,
  FRENZIED_REVELER_CODE, ...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES, ...HEIRLOOM_CODES,
].map(code => [code, ALL_CARDS[code]])))
