// 欢迎来到铁杉谷（welcomeToHemlockVale · 提示卡 10704「山谷 / The Vale」）· 章节数据。
//
// 参考：
//   · Scenario/Scenarios/TheFeastOfHemlockVale/PreludeWelcomeToHemlockVale.hs（Layout / PreScenarioSetup /
//     Setup / codex 1–16 / ScenarioResolution / EndOfScenario）；
//   · Campaigns/TheFeastOfHemlockVale/{Helpers,TokenHelpers,Key}.hs（居民关系、日/时段、序曲混乱标记）；
//   · Act|Agenda|Location|Story/CardDefs/TheFeastOfHemlockVale/{DayOfRest,TheVale,TheFirstDay}.hs（符号与连接图标）；
//   · frontend/src/locales/en/theFeastOfHemlockVale/base.json 的 `prelude1` 段（印刷正文，经
//     story-text.js → story-access.js 读取）。
//
// 这是序曲（isPrelude）：没有遭遇牌库（hasEncounterDeckL .~ False）、没有胜利点需求，调查员在十字路口
// 与七处地点之间走访居民、读法典、为第一次勘察做准备。卡面数据一律从 card-data.js 的
// printed()/location()/stage()/encounterDefinitions() 读取，不抄第二份卡文。
//
// 卡号归属（input.cards 为空：本序曲不新建任何单卡条目）：
//   · The First Day：10675 时间指示卡「第一日/第一夜」、10676 虫群 ×3（本序曲没有遭遇牌库，收集但不使用）；
//   · Day of Rest：10681 议程「欢迎来到毒堇谷！」、10682 幕「第一日黎明」；
//   · The Vale：10705a–10712a 八处地点的 (Day) 面 + 10705b–10712b 的 (Night) 面（共享遭遇组）；
//   · Residents：10693–10703 资产面 / 10693b–10701b 敌人面（共享遭遇组 worker 的单卡条目）；
//   · 提示卡 10704「山谷」：本序曲的参考卡与混乱符号面。
//
// ⚠️ 已披露的口径（与 behavior.js 文件头一致）：
//   1. 正文语言：story-text.js 现有的 welcomeToHemlockVale 章节没有任何中译叶子（本地
//      story-source/base.part1.json 只覆盖 `prelude.theFirstEvening/theSecondEvening`，即另外两段序曲），
//      因此 SCENARIO_TEXT 逐键回退英文并在 chineseGaps 披露，不伪造译文。
//   2. 地点连接：印刷连接图标只画在卡面（`参考资源` 的 Location/CardDefs 给出符号表），
//      cards-data 没有连接字段；本文件按符号表重建，并同时把 `symbols.front/back` 交给引擎的
//      locations.js#linkLocationBySymbols（与印刷图标同口径）。
//   3. 时间指示卡：Day One / Night One 是同一张卡的两面（cards-data 只有 10675，没有 10675b），
//      章内用 `face: 'front'|'back'` 表示，不伪造第二个卡号。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  SYMBOLS, encounterDefinitions, identitiesFor, location, printed, stage,
} from '../../card-data.js'
import { chapterChineseGaps, chapterLeaves } from '../../story-access.js'
import {
  CALENDAR_RECORD, PRELUDE_DATE, WELCOME_TOKEN_MEANINGS, dayOf, isNight,
} from './chaos.js'

export const CHAPTER_ID = 'welcomeToHemlockVale'
// 序曲提示卡：10704「山谷 / The Vale」既是参考卡，也印着本序曲的混乱符号。
export const REFERENCE_CODE = '10704'
export const IS_PRELUDE = true
export const ENCOUNTER_CODE = 'the_vale'

// 时间指示卡：10675 正面「第一日 / Day One」、背面「第一夜 / Night One」。
export const TIME_MARKER_CODE = '10675'
export const TIME_MARKER = Object.freeze({
  code: TIME_MARKER_CODE, face: 'front', day: PRELUDE_DATE.day, period: PRELUDE_DATE.period,
  name: 'Day One', nameZh: '第一日', backName: 'Night One', backNameZh: '第一夜',
})

// ---------------------------------------------------------------------------
// 遭遇组
// ---------------------------------------------------------------------------
// 参考 Setup：gather TheFirstDay / DayOfRest / TheVale + gatherAndSetAside Residents。
export const GATHER_GROUPS = Object.freeze(['theFirstDay', 'dayOfRest', 'theVale'])
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['residents'])
// 序曲没有遭遇牌库（参考 hasEncounterDeckL .~ False）：10676 虫群 ×3 随 The First Day 一并收进来但不使用，
// 因此不进任何区域（见 behavior.js 的 setup 注释）。
export const ENCOUNTER_DECK = Object.freeze([])
export const UNUSED_ENCOUNTER_CODES = Object.freeze(['10676'])

export const RESIDENT_ASSET_CODES = Object.freeze([
  '10693', '10694', '10695', '10696', '10697', '10698', '10699', '10700', '10701', '10702', '10703',
])
export const RESIDENT_ENEMY_CODES = Object.freeze([
  '10693b', '10694b', '10695b', '10696b', '10697b', '10698b', '10699b', '10700b', '10701b',
])
// 「Set each card from the Residents encounter set aside, out of play.」
export const SET_ASIDE_RESIDENT_CODES = Object.freeze([...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES])

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 幕：Dawn of the First Day（10682）—— 调查员不能受到伤害/恐惧，也不能被击败；目标是「和当地人交上朋友、
// 为第一次勘察做好准备」。没有线索阈值，本序曲由议程推进结束（见 behavior.agendaReveal）。
// 议程：Welcome to Hemlock Vale!（10681）—— 印刷毁灭阈值 6；背面「Time to Get to Work!」= 所有调查员撤退（→R1）。
export const ACT_CODE = '10682'
export const AGENDA_CODE = '10681'
export const ACT_CODES = Object.freeze([ACT_CODE])
export const AGENDA_CODES = Object.freeze([AGENDA_CODE])
export const AGENDA_DOOM_THRESHOLD = Number(ALL_CARDS[AGENDA_CODE]?.doom) || 6
// 幕没有数值目标：objective.type = 'chapterRule' 让引擎不按线索/敌人推进（actObjectiveContext 只读展示）。
export const ACT_OBJECTIVE = Object.freeze({ type: 'chapterRule', chapterFlow: 'befriendTheLocals' })

export const ACT_STAGES = Object.freeze({
  dawnOfTheFirstDay: Object.freeze({
    ...stage(ACT_CODE, { stage: 1 }),
    objective: { ...ACT_OBJECTIVE },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  welcomeToHemlockVale: Object.freeze(stage(AGENDA_CODE, { stage: 1 })),
})
// 可变副本：identities.js 会把原卡身份写回幕/议程定义（与其它 FHV 章节同口径）。
export const ACTS = Object.freeze([structuredClone(ACT_STAGES.dawnOfTheFirstDay)])
export const AGENDAS = Object.freeze([structuredClone(AGENDA_STAGES.welcomeToHemlockVale)])

// ---------------------------------------------------------------------------
// 地点：The Vale 的八个地点（(Day) 面入场）+ 印刷图标连接
// ---------------------------------------------------------------------------
// 印刷地图（指南第 6 页 / Haskell#Layout 的 6 行 3 列；每个符号占上下两格，这里压成 3×3）：
//   .        教堂(三角)   杂货店(方形)
//   阿特伍德宅(月) 十字路口(菱形) 集会厅(星形)
//   老磨坊(心)    旅舍(圆形)    学校(黑桃)
// [id, (Day) 面卡号, (Night) 面卡号, 连接符号, 法典编号, 法典放入场的居民]
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['theCrossroads', '10706a', '10706b', 'diamond', 10, 'theoPeters']),
  Object.freeze(['boardingHouse', '10705a', '10705b', 'circle', 9, 'riverHawthorne']),
  Object.freeze(['hemlockChapel', '10707a', '10707b', 'triangle', 11, 'motherRachel']),
  Object.freeze(['theOldMill', '10708a', '10708b', 'heart', 12, 'leahAtwood']),
  Object.freeze(['theAtwoodHouse', '10709a', '10709b', 'moon', 13, 'simeonAtwood']),
  Object.freeze(['tadsGeneralStore', '10710a', '10710b', 'square', 14, 'judithPark']),
  Object.freeze(['valeSchoolhouse', '10711a', '10711b', 'spade', 15, 'williamHemlock']),
  Object.freeze(['theCommons', '10712a', '10712b', 'star', 16, 'gideonMizrah']),
])

export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
// 老磨坊印的是 `[reaction] After you discover a clue at The Old Mill: ([codex] 12)`——没有 [action] 法典；
// 其余七处都是 `[action]: … ([codex] N)`。behavior 的地点行动读点按这张表区分两种触发时机。
export const REACTION_CODEX_LOCATIONS = Object.freeze(['theOldMill'])
export const LOCATION_DAY_CODES = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, day]) => [id, day])))
export const LOCATION_NIGHT_CODES = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , night]) => [id, night])))
export const LOCATION_CODE_BY_ID = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, day, night]) => [id, { front: day, back: night }])))
export const SYMBOL_BY_LOCATION = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , , symbol]) => [id, symbol])))
export const LOCATION_ID_BY_SYMBOL = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , , symbol]) => [symbol, id])))
// card-data.js 的 SYMBOLS 没有黑桃（spade），这里只补这一个，其余复用共享表。
export const PRELUDE_SYMBOLS = Object.freeze({
  ...SYMBOLS,
  spade: Object.freeze({ id: 'spade', label: '黑桃', glyph: '♠' }),
})

// 印刷连接图标（Location/CardDefs 的最后一个参数）。图标 → 符号 → 场地点的 id。
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
// 对称连接表（只由图标推出来，双向都成立；测试会断言对称性）。
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_IDS.map(id => [
  id, Object.freeze(LOCATION_CONNECTION_ICONS[id]
    .map(icon => LOCATION_ID_BY_SYMBOL[icon])
    .filter(Boolean)
    .filter(target => target !== id)),
])))

// 桌面展示坐标：3 列 × 3 行（左上角空格），与印刷地图的符号位置一致。
export const LOCATION_GRID = Object.freeze([
  Object.freeze([null, 'hemlockChapel', 'tadsGeneralStore']),
  Object.freeze(['theAtwoodHouse', 'theCrossroads', 'theCommons']),
  Object.freeze(['theOldMill', 'boardingHouse', 'valeSchoolhouse']),
])
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(
  LOCATION_GRID.flatMap((row, y) => row.flatMap((id, x) => (id ? [[id, Object.freeze({ x, y })]] : [])))))

// 印刷线索（(Day) 面）：老磨坊 1（固定值，卡面带 cluesFixed），其余 0。
function makeLocation([id, dayCode, , symbol, codexNumber, residentId]) {
  const card = ALL_CARDS[dayCode]
  if (!card) throw new RangeError(`Unknown Feast of Hemlock Vale location: ${dayCode}`)
  return location({
    id, code: dayCode,
    clues: Number(card.clues) || 0,
    ...(card.cluesFixed ? { cluesFixed: true } : {}),
    symbol,
    symbols: {
      front: { symbol, links: [...LOCATION_CONNECTION_ICONS[id]] },
      back: { symbol, links: [...LOCATION_CONNECTION_ICONS[id]] },
    },
    connections: [...LOCATION_CONNECTIONS[id]],
    nightCode: LOCATION_NIGHT_CODES[id],
    codexNumber,
    residentCode: RESIDENT_CODE_BY_ID[residentId] || null,
    hemlockVale: true,
    ...(id === 'theCrossroads' ? { central: true } : {}),
  })
}

export const START_LOCATION = 'theCrossroads'
export const REMOVED_LOCATION_CODES = Object.freeze([])

// ---------------------------------------------------------------------------
// 居民（战役日志的八位居民；其余三张居民卡 10701–10703 只随组放一边）
// ---------------------------------------------------------------------------
// 每个居民是双面卡：资产面（在场时）与敌人面（剧情/关系过低时翻面）。中文名取 cards-data 的印刷
// nameZh（与场上居民资产、法典标题一致）；记录键与战役层 `records.js#FHV_RESIDENTS` 的 Campaign Log
// 口径逐字对齐（级别 `<id>RelationshipLevel`、笔记 `<id>Notes`、划掉 `leahCrossedOut` 这类短键），
// 关系等级上限 5（日志五格）。
export const RESIDENT_MAX_RELATIONSHIP = 5
// 在场居民资产的谈判能力（印刷在 10693–10700 的 [action] 上）：由 behavior.residentParleySpec 读取，
// 成功/结算后进入对应法典条目。talents/costs 只是数据，检定由 behavior 或共享组条目发起。
export const RESIDENT_PARLEY = Object.freeze({
  motherRachel: Object.freeze({ skills: Object.freeze(['willpower']), difficulty: 2, actions: 1 }),
  leahAtwood: Object.freeze({ skills: Object.freeze(['combat']), difficulty: 2, actions: 1 }),
  simeonAtwood: Object.freeze({ skills: Object.freeze(['agility']), difficulty: 2, actions: 1 }),
  williamHemlock: Object.freeze({ skills: Object.freeze(['intellect']), difficulty: 2, actions: 1 }),
  riverHawthorne: Object.freeze({ skills: Object.freeze(['willpower', 'intellect']), difficulty: 3, actions: 1 }),
  gideonMizrah: Object.freeze({ skills: Object.freeze([]), difficulty: 0, actions: 2 }),
  judithPark: Object.freeze({ skills: Object.freeze([]), difficulty: 0, actions: 1, spendResources: 'dayNumber' }),
  theoPeters: Object.freeze({ skills: Object.freeze([]), difficulty: 0, actions: 1, discardCards: 'dayNumber' }),
})

// 居民 id → 资产卡号（behavior 按卡号读点）；法典编号写在 CODEX_ENTRIES 与 LOCATION_TABLE 里。
export const RESIDENTS = Object.freeze([
  Object.freeze({
    id: 'motherRachel', name: '蕾切尔嬷嬷', nameEn: 'Mother Rachel',
    assetCode: '10693', enemyCode: '10693b', codexNumber: 1,
    record: Object.freeze({ level: 'motherRachelRelationshipLevel', notes: 'motherRachelNotes',
      crossedOut: 'motherRachelCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'leahAtwood', name: '莉亚·阿特伍德', nameEn: 'Leah Atwood',
    assetCode: '10694', enemyCode: '10694b', codexNumber: 2,
    record: Object.freeze({ level: 'leahAtwoodRelationshipLevel', notes: 'leahAtwoodNotes',
      crossedOut: 'leahCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'simeonAtwood', name: '席米恩·阿特伍德', nameEn: 'Simeon Atwood',
    assetCode: '10695', enemyCode: '10695b', codexNumber: 3,
    record: Object.freeze({ level: 'simeonAtwoodRelationshipLevel', notes: 'simeonAtwoodNotes',
      crossedOut: 'simeonCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'williamHemlock', name: '威廉·汉洛克', nameEn: 'William Hemlock',
    assetCode: '10696', enemyCode: '10696b', codexNumber: 4,
    record: Object.freeze({ level: 'williamHemlockRelationshipLevel', notes: 'williamHemlockNotes',
      crossedOut: 'williamCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'riverHawthorne', name: '瑞玟·霍桑', nameEn: 'River Hawthorne',
    assetCode: '10697', enemyCode: '10697b', codexNumber: 5,
    record: Object.freeze({ level: 'riverHawthorneRelationshipLevel', notes: 'riverHawthorneNotes',
      crossedOut: 'riverCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'gideonMizrah', name: '基甸·米兹拉克', nameEn: 'Gideon Mizrah',
    assetCode: '10698', enemyCode: '10698b', codexNumber: 6,
    record: Object.freeze({ level: 'gideonMizrahRelationshipLevel', notes: 'gideonMizrahNotes',
      crossedOut: 'gideonCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'judithPark', name: '朱迪斯·帕克', nameEn: 'Judith Park',
    assetCode: '10699', enemyCode: '10699b', codexNumber: 7,
    record: Object.freeze({ level: 'judithParkRelationshipLevel', notes: 'judithParkNotes',
      crossedOut: 'judithCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
  Object.freeze({
    id: 'theoPeters', name: '希奥·彼得斯', nameEn: 'Theo Peters',
    assetCode: '10700', enemyCode: '10700b', codexNumber: 8,
    record: Object.freeze({ level: 'theoPetersRelationshipLevel', notes: 'theoPetersNotes',
      crossedOut: 'theoCrossedOut', max: RESIDENT_MAX_RELATIONSHIP }),
  }),
])
export const RESIDENT_BY_ID = Object.freeze(Object.fromEntries(RESIDENTS.map(row => [row.id, row])))
export const RESIDENT_BY_ASSET_CODE = Object.freeze(Object.fromEntries(
  RESIDENTS.map(row => [row.assetCode, row])))
export const RESIDENT_BY_ENEMY_CODE = Object.freeze(Object.fromEntries(
  RESIDENTS.map(row => [row.enemyCode, row])))
export const RESIDENT_CODE_BY_ID = Object.freeze(Object.fromEntries(
  RESIDENTS.map(row => [row.id, row.assetCode])))

// LOCATIONS 依赖 RESIDENT_CODE_BY_ID，因此放在居民表之后构造。
export const LOCATIONS = Object.fromEntries(LOCATION_TABLE.map(row => [row[0], makeLocation(row)]))

// ---------------------------------------------------------------------------
// 法典（Codex 1–16）：引擎原语 scenario-calendar.js#normalizeCodex 的声明形状
// ---------------------------------------------------------------------------
// 一次性的条目走 limit 'scenario'；14 号（塔德杂货店）印刷「任何尚未结算此效果的调查员可以再次触发本
// 法典」→ 引擎侧 'unlimited'，按调查员的一次性由 behavior 用 scenarioFlags 记录。
// 序曲 1 的 16 条都没有「按关系等级/笔记分支」的条件，因此每条只声明一个 `printed` 分支。
export const CODEX_BRANCH_PRINTED = 'printed'
export const CODEX_LIMIT_SCENARIO = 'scenario'
export const CODEX_LIMIT_UNLIMITED = 'unlimited'

const residentCodex = id => RESIDENT_BY_ID[id].record
// 每条法典的结算数据（behavior.resolveCodexEntry 的唯一事实源）：
//   · relationship：结算后增加的居民关系（居民条目 1–8）；
//   · putsResident：结算后从放一边放入场的居民（地点条目 9–16）；
//   · choices/effect：附加收益（抽 1/获得 1 资源、搜索牌库、从手牌免费打出、移动、获得资源/抽牌）。
export const CODEX_ENTRIES = Object.freeze([
  Object.freeze({ number: 1, id: 'motherRachel', kind: 'resident', resident: 'motherRachel',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'motherRachel',
    effect: Object.freeze({ kind: 'playFromHand', traits: Object.freeze(['Charm', 'Spell']) }) }),
  Object.freeze({ number: 2, id: 'leahAtwood', kind: 'resident', resident: 'leahAtwood',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'leahAtwood',
    effect: Object.freeze({ kind: 'playFromHand', traits: Object.freeze(['Tool']) }) }),
  Object.freeze({ number: 3, id: 'simeonAtwood', kind: 'resident', resident: 'simeonAtwood',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'simeonAtwood',
    effect: Object.freeze({ kind: 'searchToHand', from: 'top9', traits: Object.freeze(['Tactic', 'Trick']) }) }),
  Object.freeze({ number: 4, id: 'williamHemlock', kind: 'resident', resident: 'williamHemlock',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'williamHemlock',
    effect: Object.freeze({ kind: 'searchToHand', from: 'top9', traits: Object.freeze(['Tome', 'Talent']) }) }),
  Object.freeze({ number: 5, id: 'riverHawthorne', kind: 'resident', resident: 'riverHawthorne',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'riverHawthorne',
    effect: Object.freeze({ kind: 'gainResources', amount: 3 }) }),
  Object.freeze({ number: 6, id: 'gideonMizrah', kind: 'resident', resident: 'gideonMizrah',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'gideonMizrah',
    effect: Object.freeze({ kind: 'drawCards', amount: 3 }) }),
  Object.freeze({ number: 7, id: 'judithPark', kind: 'resident', resident: 'judithPark',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'judithPark',
    effect: Object.freeze({ kind: 'playFromHand', traits: Object.freeze(['Weapon']) }) }),
  Object.freeze({ number: 8, id: 'theoPeters', kind: 'resident', resident: 'theoPeters',
    limit: CODEX_LIMIT_SCENARIO, relationship: 'theoPeters',
    effect: Object.freeze({ kind: 'moveAnyLocation' }) }),

  Object.freeze({ number: 9, id: 'boardingHouse', kind: 'location', location: 'boardingHouse',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'riverHawthorne',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 10, id: 'theCrossroads', kind: 'location', location: 'theCrossroads',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'theoPeters',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 11, id: 'hemlockChapel', kind: 'location', location: 'hemlockChapel',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'motherRachel',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 12, id: 'theOldMill', kind: 'location', location: 'theOldMill',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'leahAtwood',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 13, id: 'theAtwoodHouse', kind: 'location', location: 'theAtwoodHouse',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'simeonAtwood',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 14, id: 'tadsGeneralStore', kind: 'location', location: 'tadsGeneralStore',
    limit: CODEX_LIMIT_UNLIMITED, putsResident: 'judithPark', perInvestigatorOnce: true,
    effect: Object.freeze({ kind: 'spendSearchPlay', amount: 1, traits: Object.freeze(['Item']) }) }),
  Object.freeze({ number: 15, id: 'valeSchoolhouse', kind: 'location', location: 'valeSchoolhouse',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'williamHemlock',
    effect: Object.freeze({ kind: 'drawOrResource' }) }),
  Object.freeze({ number: 16, id: 'theCommons', kind: 'location', location: 'theCommons',
    limit: CODEX_LIMIT_SCENARIO, putsResident: 'gideonMizrah',
    effect: Object.freeze({ kind: 'searchToHand', from: 'top9', traits: Object.freeze(['Ally']) }) }),
])
export const CODEX_IDS = Object.freeze(CODEX_ENTRIES.map(entry => entry.id))
export const CODEX_ENTRY_BY_ID = Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.id, entry])))
export const CODEX_ENTRY_BY_NUMBER = Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.number, entry])))
export const RESIDENT_CODEX_NUMBERS = Object.freeze(Object.fromEntries(
  RESIDENTS.map(row => [row.id, row.codexNumber])))
export const LOCATION_CODEX_NUMBERS = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , , , number]) => [id, number])))
// 引擎声明形状：只允许 id/limit/resident/branches 四个字段。
export const CODEX_SPEC = Object.freeze(CODEX_ENTRIES.map(entry => Object.freeze({
  id: entry.id,
  limit: entry.limit,
  ...(entry.resident ? { resident: Object.freeze({
    relationship: residentCodex(entry.resident).level,
    notes: residentCodex(entry.resident).notes,
    crossedOut: residentCodex(entry.resident).crossedOut,
  }) } : {}),
  branches: Object.freeze([Object.freeze({ id: CODEX_BRANCH_PRINTED })]),
})))

// ---------------------------------------------------------------------------
// 勘察（序曲结束时选择下一场：五处未勘察区域）
// ---------------------------------------------------------------------------
export const SURVEY_DESTINATIONS = Object.freeze([
  'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister', 'theThingInTheDepths',
])
// 五个可勘察区域在指南标签里的正文键（prelude1.label.*）。
export const SURVEY_LABEL_KEYS = Object.freeze({
  writtenInRock: 'prelude1.label.writtenInRock',
  hemlockHouse: 'prelude1.label.hemlockHouse',
  theSilentHeath: 'prelude1.label.theSilentHeath',
  theLostSister: 'prelude1.label.theLostSister',
  theThingInTheDepths: 'prelude1.label.theThingInTheDepths',
})

// ---------------------------------------------------------------------------
// 战役记录键（Campaigns/.../Key.hs + 本序曲自身写入的推进记录）
// ---------------------------------------------------------------------------
export const RECORD_KEYS = Object.freeze({
  day: 'day',
  time: 'time',
  calendar: CALENDAR_RECORD,
  intro: 'welcomeToHemlockValeIntro',
  chaosToken: 'welcomeToHemlockValeChaosToken',
  resolution: 'welcomeToHemlockValeResolution',
  resolutionReason: 'welcomeToHemlockValeResolutionReason',
  bonusXp: 'welcomeToHemlockValeBonusXp',
  surveyChoices: 'welcomeToHemlockValeSurveyChoices',
  brilliance: 'welcomeToHemlockValeTheBrilliance',
})
export const RESIDENT_LEVEL_KEYS = Object.freeze(
  RESIDENTS.map(row => row.record.level))
export const RESIDENT_NOTE_KEYS = Object.freeze(
  RESIDENTS.map(row => row.record.notes))
export const RESIDENT_CROSSED_OUT_KEYS = Object.freeze(
  RESIDENTS.map(row => row.record.crossedOut))

export const RECORD_READS = Object.freeze([
  RECORD_KEYS.day, RECORD_KEYS.time, RECORD_KEYS.calendar,
  RECORD_KEYS.intro, RECORD_KEYS.chaosToken, RECORD_KEYS.bonusXp,
  ...RESIDENT_LEVEL_KEYS,
])
export const RECORD_WRITES = Object.freeze([
  RECORD_KEYS.day, RECORD_KEYS.time, RECORD_KEYS.calendar,
  RECORD_KEYS.intro, RECORD_KEYS.chaosToken, RECORD_KEYS.resolution,
  RECORD_KEYS.resolutionReason, RECORD_KEYS.bonusXp, RECORD_KEYS.surveyChoices,
  RECORD_KEYS.brilliance,
  ...RESIDENT_LEVEL_KEYS,
])

// 结局：本序曲只有 Resolution 1（议程背面「所有调查员撤退（→R1）」）。全灭/全员撤退也同归 R1。
export const RESOLUTION_KEYS = Object.freeze(['resolution1'])
export const RESOLUTION_RECORD = Object.freeze({ resolution1: 'resolution1' })

// ---------------------------------------------------------------------------
// 印刷正文（唯一事实源：story-text.js → story-access.js；本章暂无中译，逐键回退英文）
// ---------------------------------------------------------------------------
const LEAVES = chapterLeaves(CHAPTER_ID)
const LEAF = new Map(LEAVES.map(leaf => [leaf.key, leaf]))
const hasChinese = LEAVES.some(leaf => leaf.translated)
export const CHINESE_GAPS = Object.freeze(chapterChineseGaps(CHAPTER_ID))
export const TEXT_LANGUAGE = hasChinese ? 'zh-CN' : 'en'
export const TEXT_STATUS = hasChinese
  ? 'partially self-translated (see chineseGaps)'
  : 'source text only (en; chineseGaps lists every untranslated leaf)'

const decodeEntities = value => String(value || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g,
  match => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }[match]))
// 指南正文是 HTML + FHV 的 `{'{'}codex{'}'}` 占位符；展示层用纯文本（保留段落与项目符号）。
const plain = value => decodeEntities(String(value || '')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<\/(?:p|li|h\d|ul|ol|div)>/gi, '\n\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ''))
  // FHV 指南的符号占位符：{'{'}codex{'}'} → [codex]；{day} 这类单层占位符同理。
  .replace(/\{'\{'\}/g, '[')
  .replace(/\{'\}'\}/g, ']')
  .replace(/\{(\w+)\}/g, '[$1]')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const raw = key => {
  const leaf = LEAF.get(key)
  return leaf ? (leaf.zh || leaf.en || '') : ''
}
const text = key => plain(raw(key))
const blocks = (...keys) => keys.map(text).filter(Boolean).join('\n\n')
const leafText = key => plain(raw(key))

export const SETUP_STEP_KEYS = Object.freeze([
  'gatherSets', 'dayOne', 'placeLocations', 'locationsNote', 'startAt', 'setOutOfPlay', 'placeDoom', 'codex',
])
export const SETUP_STEPS = Object.freeze(SETUP_STEP_KEYS
  .map(key => Object.freeze({ key, text: text(`prelude1.setup.${key}`) }))
  .filter(step => step.text))

const codexText = entry => Object.freeze({
  id: entry.id,
  number: entry.number,
  title: text(`prelude1.codex.${entry.id}.title`),
  body: text(`prelude1.codex.${entry.id}.body`),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: TEXT_LANGUAGE,
  textStatus: TEXT_STATUS,
  chineseGaps: CHINESE_GAPS,
  heading: text('prelude1.intro.title'),
  headingKey: 'headings.preludeTheFirstEvening',
  intro: Object.freeze({
    title: text('prelude1.intro.title'),
    intro1: text('prelude1.intro.intro1'),
    intro2: text('prelude1.intro.intro2'),
    intro3: text('prelude1.intro.intro3'),
    intro4: text('prelude1.intro.intro4'),
    labels: Object.freeze({
      survey: text('prelude1.intro.label.survey'),
      feast: text('prelude1.intro.label.feast'),
    }),
    survey: text('prelude1.label.survey'),
  }),
  setup: SETUP_STEPS.map(step => step.text).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([
    ...Object.freeze([0, 1, 2, 3].map(index => Object.freeze({
      key: `campaignRule${index}`,
      title: leafText(`specialRules[${index}].title`),
      body: leafText(`specialRules[${index}].body`),
    }))),
    Object.freeze({
      key: 'playingPreludes',
      title: text('prelude1.playingPreludes.title'),
      body: text('prelude1.playingPreludes.body'),
    }),
  ].filter(rule => rule.title || rule.body)),
  rules: Object.freeze({
    codex: text('additionalRulesAndClarifications.theCodex'),
    threeDays: text('additionalRulesAndClarifications.threeDaysThreeNights'),
    residents: text('additionalRulesAndClarifications.residentsAndRelationshipLevels'),
    locationAdjacency: text('additionalRulesAndClarifications.locationAdjacency'),
  }),
  newKeywords: Object.freeze({
    title: text('newKeywords.title'),
    body: text('newKeywords.body'),
  }),
  campaignLog: Object.freeze({
    dayTime: text('campaignLog.dayTime.title'),
    relationshipLevel: text('campaignLog.residents.relationshipLevel'),
    notes: text('campaignLog.residents.notes'),
    areasSurveyed: text('key.sections.areasSurveyed'),
  }),
  survey: Object.freeze({
    label: text('prelude1.label.survey'),
    destinations: Object.freeze(Object.fromEntries(
      Object.entries(SURVEY_LABEL_KEYS).map(([id, key]) => [id, text(key)]))),
  }),
  tokens: Object.freeze({
    easyStandard: Object.freeze({
      skull: text('tokens.easyStandard.skull'),
      cultist: text('tokens.easyStandard.cultist'),
      tablet: text('tokens.easyStandard.tablet'),
      elderThing: text('tokens.easyStandard.elderThing'),
    }),
    hardExpert: Object.freeze({
      skull: text('tokens.hardExpert.skull'),
      cultist: text('tokens.hardExpert.cultist'),
      tablet: text('tokens.hardExpert.tablet'),
      elderThing: text('tokens.hardExpert.elderThing'),
    }),
  }),
  xp: Object.freeze({ theBrilliance: text('prelude1.xp.theBrilliance') }),
  codex: Object.freeze(Object.fromEntries(CODEX_ENTRIES.map(entry => [entry.id, codexText(entry)]))),
  codexLabels: Object.freeze({ tadsGeneralStoreItem: text('prelude1.codex.label.tadsGeneralStore.item') }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS.map(key => [key, Object.freeze({
    title: text(`prelude1.resolutions.${key}.title`),
    body: text(`prelude1.resolutions.${key}.body`),
  })]))),
})

// ---------------------------------------------------------------------------
// 遭遇定义（时间指示卡 + 11 位居民资产面；没有敌人/诡计）
// ---------------------------------------------------------------------------
const definitions = encounterDefinitions([TIME_MARKER_CODE, ...RESIDENT_ASSET_CODES])

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------
export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  encounterCode: ENCOUNTER_CODE,
  isPrelude: IS_PRELUDE,
  name: '欢迎来到铁杉谷 · Welcome to Hemlock Vale!',
  nameEn: 'Prelude: Welcome to Hemlock Vale!',
  intro: [SCENARIO_TEXT.intro.intro1, SCENARIO_TEXT.intro.intro4].filter(Boolean).join('\n\n'),
  introBranches: Object.freeze({ intro2: SCENARIO_TEXT.intro.intro2, intro3: SCENARIO_TEXT.intro.intro3 }),
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  codex: SCENARIO_TEXT.codex,
  survey: SCENARIO_TEXT.survey,
  tokens: SCENARIO_TEXT.tokens,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_RESIDENT_CODES],
  removedLocations: [...REMOVED_LOCATION_CODES],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: Object.fromEntries(RESOLUTION_KEYS.map(key => [key, SCENARIO_TEXT.resolutions[key].body || ''])),
  resolutionTitles: Object.fromEntries(RESOLUTION_KEYS.map(key => [key, SCENARIO_TEXT.resolutions[key].title || key])),
  storyFaces: Object.freeze(Object.fromEntries([
    REFERENCE_CODE, TIME_MARKER_CODE,
  ].map(code => [code, Object.freeze({ ...printed(code), type: code === REFERENCE_CODE ? 'scenario' : 'story' })]))),
  tokenMeanings: {
    easy: { ...WELCOME_TOKEN_MEANINGS.easy },
    standard: { ...WELCOME_TOKEN_MEANINGS.standard },
    hard: { ...WELCOME_TOKEN_MEANINGS.hard },
    expert: { ...WELCOME_TOKEN_MEANINGS.expert },
  },
  // 引擎机制声明（mechanic-state.js#normalizeScenarioMechanics 只认下列字段）：
  //   · calendar —— 三天三夜的日/时段；setScenarioDate 写 campaign.records.hemlockDate；
  //   · codex —— 16 条法典（14 号 unlimited，其余 scenario 一次）；
  //   · residents —— 8 位居民的关系/笔记/划掉记录键（resident-record.js 读点）；
  //   · survey —— 序曲整备 + 下一场勘察选择（campaign-flow.js#finishScenario → prepareSurvey）；
  //   · noEncounterDeck —— 序曲没有遭遇牌库；
  //   · protectInvestigators —— 幕 10682「调查员不能受到伤害/恐惧，也不能被击败」。
  mechanics: {
    calendar: { maximumDay: 3, record: CALENDAR_RECORD, periodByLocationTrait: null },
    codex: CODEX_SPEC.map(entry => ({ ...entry })),
    residents: RESIDENTS.map(row => ({ id: row.id, name: row.name, nameEn: row.nameEn,
      record: { ...row.record } })),
    survey: { destinations: [...SURVEY_DESTINATIONS], resolutions: [...RESOLUTION_KEYS] },
    noEncounterDeck: true,
    protectInvestigators: true,
  },
  day: PRELUDE_DATE.day,
  time: PRELUDE_DATE.period,
  nextScenarioId: null,
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
// 双面地点：manifest 的 backCode 指向 (Night) 面（正面 = (Day) 面入场）。
for (const [id, faces] of Object.entries(LOCATION_CODE_BY_ID)) {
  if (!identities.locations[id]) continue
  identities.locations[id] = { ...identities.locations[id], originalCode: faces.front,
    linkedOriginalCode: faces.back }
}
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, TIME_MARKER_CODE, ACT_CODE, AGENDA_CODE,
  ...LOCATION_TABLE.flatMap(([, day, night]) => [day, night]),
  ...RESIDENT_ASSET_CODES, ...RESIDENT_ENEMY_CODES,
].map(code => [code, ALL_CARDS[code]])))

// 行为与测试共用的只读快照。
export const IN_PLAY_CODES = Object.freeze([TIME_MARKER_CODE])
export { dayOf, isNight }
