// 寂静荒野（theSilentHeath · 提示卡 10549，珍珠岭 / Pearl Ridge）· 章节数据（scenario 只含数据）。
//
// 参考（权威）：
//   Scenario/Scenarios/TheFeastOfHemlockVale/TheSilentHeath.hs +
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/TheFeastOfHemlockVale/TheSilentHeath.hs +
//   Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheSilentHeath/*.hs +
//   Location|Enemy/CardDefs/TheFeastOfHemlockVale/HorrorsInTheRock.hs（岩中恐怖地点牌库）+
//   frontend/src/locales/en/theFeastOfHemlockVale/theSilentHeath.json（权威印刷文本）。
//
// 卡号归属（input.entryPaths）：10550–10568 共 19 条记录；10549 是本关提示卡（scenario 自身，
// 不建单卡条目），本章专属组 the_silent_heath。地点/幕/议程按本批约定**建数据型条目**
// （input.entryPaths 提供了它们），规则数值与流程在本文件与 behavior.js；敌人/诡计/水晶残骸的
// 行为读点在 behavior.js，单卡条目在
// src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/。
//
// 本关三条特有口径（印刷文本见 SCENARIO_TEXT）：
//   1. 珍珠岭网格：3 张起始地点在 (0,0)/(1,-1)/(2,0)，彼此只靠印刷图标相连；幕 1 背面把
//      3 张[[岩中恐怖]]地点放进 (0,-1)/(1,0)/(2,-1)，此后正交相邻即相连（战役规则
//      「Location Adjacency」）。幕 1 背面同时把洞穴地点/遭遇卡正面朝下发给这 6 个地点。
//   2. 昼夜：按战役记录的当前天数/时段选议程 2（第 1 日 → 荒芜 v.I，其余 → v.II）、
//      时间标记卡（10675/10677/10679）与当日遭遇组；昼夜同时是 [[岩中恐怖]] 卡面
//      (Day)/(Night) 子句的读点（引擎 scenario-calendar.js 的 duringPeriod）。
//   3. 岩中恐怖「独立牌库」：6 张物理地点洗牌，随机 3 张放一边（幕 1 背面入场），其余 3 张
//      移出游戏；3 张水晶残骸另行洗暗放在一边，只经法典 Ψ/Ω/Φ 进入地点底下的暗堆。
//
// 剧情/指南正文来自内容生成物 story-text.js（经 story-access.js 读取；中文翻译尚未落地，
// 因此 textLanguage 为 en；缺章节时 safeStory 兜底空对象，章节结构/manifest 仍可 import）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { SILENT_HEATH_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theSilentHeath'
export const REFERENCE_CODE = '10549'
export const ENCOUNTER_CODE = 'the_silent_heath'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
// 两幕固定；议程 2 有 v.I/v.II 两个版本，按当前天数二选一（Setup「Desolation (v.I)/(v.II)」）。
export const ACT_CODES = Object.freeze(['10553', '10554'])
export const AGENDA_CODES = Object.freeze(['10550', '10551', '10552'])
export const ACT1_CODE = ACT_CODES[0]
export const ACT2_CODE = ACT_CODES[1]
export const AGENDA1_CODE = '10550'
export const DESOLATION_V1_CODE = '10551'
export const DESOLATION_V2_CODE = '10552'
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT1_CODE, 2: ACT2_CODE })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA1_CODE, 2: DESOLATION_V1_CODE })
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])

// ---------------------------------------------------------------------------
// 剧情资产 / 敌人 / 诡计
// ---------------------------------------------------------------------------
export const CRYSTAL_REMAINS_CODES = Object.freeze(['10566', '10567', '10568'])
export const CRYSTAL_REMAINS_CHILD = '10566'
export const CRYSTAL_REMAINS_FATHER = '10567'
export const CRYSTAL_REMAINS_MOTHER = '10568'
export const BROOD_QUEEN_CODE = '10565'
export const BROOD_SOLDIER_CODE = '10564'
export const COLORLESS_LARVA_CODE = '10563'
export const COMMANDING_RESONANCE_CODE = '10561'
export const DEFEND_THE_NEST_CODE = '10562'
export const CRYSTAL_PARASITE_CODE = '10721'
export const SET_ASIDE_ENEMY_CODES = Object.freeze([BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE])
export const ENEMY_CODES = Object.freeze([COLORLESS_LARVA_CODE, BROOD_SOLDIER_CODE, BROOD_QUEEN_CODE])
export const TREACHERY_CODES = Object.freeze([COMMANDING_RESONANCE_CODE, DEFEND_THE_NEST_CODE])

// 时间标记卡（The First/Second/Final Day 遭遇组的 story 卡，Setup 放在议程牌库旁）。
export const TIME_MARKER_CODES = Object.freeze({ 1: '10675', 2: '10677', 3: '10679' })
export const TIME_MARKER_CODE_BY_DAY = TIME_MARKER_CODES

// Residents（居民）遭遇组：Setup 依日期/时段放入的剧情支援（10694 莉亚 / 10702 罗莎·马尔克斯 /
// 10693 母亲瑞秋）。它们属于共享组 residents，单卡条目不在本章。
export const RESIDENT_ASSETS = Object.freeze({
  leah: '10694', rosa: '10702', motherRachel: '10693',
})
export const RESIDENT_LOCATIONS = Object.freeze({
  leah: 'pearlEstateRuins', rosa: 'crystalGrove', motherRachel: 'ashenSlope',
})

// ---------------------------------------------------------------------------
// gather 组（Setup：The Silent Heath / Agents of the Colour / Blight /
// Horrors in the Rock / Refractions / Transfiguration / Striking Fear + 当日组）
// ---------------------------------------------------------------------------
export const GATHER_GROUPS = Object.freeze([
  'theSilentHeath', 'agentsOfTheColour', 'blight', 'horrorsInTheRock',
  'refractions', 'transfiguration', 'strikingFear',
])
export const DAY_GATHER_GROUPS = Object.freeze({
  1: 'theFirstDay', 2: 'theSecondDay', 3: 'theFinalDay',
})
export const DAY_NUMBERS = Object.freeze([1, 2, 3])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'pearlEstateRuins'
// 起始地点表：[id, code, 印刷符号, 该符号连接的其它符号]（Haskell Location/CardDefs 的 symbolLabel）。
// 三个起始地点在这个网格里互不相邻，所以印刷图标就是它们开局的唯一连接（规则：图标连接 + 正交相邻）。
export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['pearlEstateRuins', '10556', 'equals', Object.freeze(['triangle', 'circle'])]),
  Object.freeze(['crystalGrove', '10555', 'triangle', Object.freeze(['equals', 'circle'])]),
  Object.freeze(['ashenSlope', '10557', 'circle', Object.freeze(['equals', 'triangle'])]),
])
export const START_LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
// 洞穴地点（单面、放一边，仅由法典/暗堆进入场地）。
export const CAVE_TABLE = Object.freeze([
  Object.freeze(['saltChamber', '10558', 'saltChamber']),
  Object.freeze(['larvalTunnel', '10559', 'larvalTunnel']),
  Object.freeze(['crystalNursery', '10560', 'crystalNursery']),
])
export const CAVE_LOCATION_IDS = Object.freeze(CAVE_TABLE.map(([id]) => id))
export const CAVE_LOCATION_BY_ID = Object.freeze(Object.fromEntries(CAVE_TABLE.map(([id, code, codex]) => [id, { code, codex }])))
// 岩中恐怖「独立牌库」：5 种 6 张物理地点（10716 干燥地洞 ×2）。每张物理卡给独立实例 id，
// 因为同一关内可能同时抽到两张干燥地洞并分别放进不同格子。
export const HORRORS_TABLE = Object.freeze([
  Object.freeze(['dryBurrow1', '10716']),
  Object.freeze(['dryBurrow2', '10716']),
  Object.freeze(['alkalineForest', '10717']),
  Object.freeze(['iridescentPassage', '10718']),
  Object.freeze(['overgrownTunnel', '10719']),
  Object.freeze(['mineralTunnel', '10720']),
])
export const HORRORS_POOL_IDS = Object.freeze(HORRORS_TABLE.map(([id]) => id))
export const HORRORS_SET_ASIDE_COUNT = 3
export const HORRORS_REMOVED_COUNT = 3
export const HORRORS_SET_ASIDE_CODES = Object.freeze(['10716', '10716', '10717', '10718', '10719', '10720'])

// 真实网格坐标（引擎 mechanicState.grid 由 behavior 写入；layout 只是展示投影）：
//   Haskell Setup placeInGrid：Pearl (0,0)、Ashen (2,0)、Crystal Grove (1,-1)；
//   幕 1 背面：Pos (0,-1)/(1,0)/(2,-1)。
export const LOCATION_CELLS = Object.freeze({
  pearlEstateRuins: Object.freeze({ x: 0, y: 0 }),
  crystalGrove: Object.freeze({ x: 1, y: -1 }),
  ashenSlope: Object.freeze({ x: 2, y: 0 }),
})
export const HORRORS_SET_ASIDE_CELLS = Object.freeze([
  Object.freeze({ x: 0, y: -1 }), Object.freeze({ x: 1, y: 0 }), Object.freeze({ x: 2, y: -1 }),
])

// 桌面展示坐标：真实坐标在运行期写入剧本网格，这里给每个可能入场的地点一个确定性槽位。
// 岩中恐怖 6 张里只有 3 张会入场（随机），展示槽位覆盖全部候选；洞穴地点按法典位置展示。
export const LOCATION_COORDINATES = Object.freeze({
  pearlEstateRuins: { x: 0, y: 0 },
  crystalGrove: { x: 1, y: -1 },
  ashenSlope: { x: 2, y: 0 },
  dryBurrow1: { x: 0, y: -1 },
  dryBurrow2: { x: 1, y: 0 },
  alkalineForest: { x: 2, y: -1 },
  iridescentPassage: { x: -1, y: -1 },
  overgrownTunnel: { x: 0, y: 1 },
  mineralTunnel: { x: 1, y: 1 },
  saltChamber: { x: -1, y: 0 },
  larvalTunnel: { x: 3, y: 0 },
  crystalNursery: { x: 1, y: -2 },
})

// 连接表：只含印刷图标给出的边（三个起始地点两两相连）。正交相邻由 behavior.syncConnections
// 在运行期按网格重算（connectGrid 保留 location.symbolLinks 与 cell.connections）。
const symbolById = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [id, symbol]))
const idBySymbol = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [symbol, id]))
export const SYMBOL_BY_LOCATION = Object.freeze({ ...symbolById })
function iconConnections(links) {
  return links.map(symbol => idBySymbol[symbol]).filter(Boolean)
}
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , , links]) => [id, Object.freeze(iconConnections(links))]),
))
export const CONNECTION_POLICY = 'orthogonal'

function makeLocation(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown The Silent Heath location: ${code}`)
  const clues = Math.max(0, Number(card.clues) || 0)
  const base = location({
    id, code, clues, ...extra,
    connections: extra.connections ? [...extra.connections] : [],
    printedName: card.nameZh || card.name || code,
    printedTraits: [...(card.traits || [])],
  })
  return base
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...LOCATION_TABLE.map(([id, code, symbol, links]) => {
    const extra = {
      symbol,
      symbols: { front: { symbol, links: [...links] }, back: { symbol, links: [...links] } },
      connections: iconConnections(links),
    }
    if (id === START_LOCATION) Object.assign(extra, { resign: true, revealed: true })
    return [id, makeLocation(id, code, extra)]
  }),
  ...CAVE_TABLE.map(([id, code, codex]) => {
    const extra = { cave: true, lair: true, codex, connections: [] }
    return [id, makeLocation(id, code, extra)]
  }),
  ...HORRORS_TABLE.map(([id, code]) => {
    const extra = { horrors: true, unrevealedName: 'Cavern', unrevealedNameEn: 'Cavern', connections: [] }
    return [id, makeLocation(id, code, extra)]
  }),
]))

// 放一边（out of play）：族群虫后 1、水晶寄生虫 ×2、水晶残骸 3（暗放）、洞穴地点 3（Setup）。
export const SET_ASIDE_CARDS = Object.freeze([
  BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE, CRYSTAL_PARASITE_CODE,
  ...CRYSTAL_REMAINS_CODES,
])
export const SET_ASIDE_LOCATION_IDS = Object.freeze([...CAVE_LOCATION_IDS])
// Setup「Shuffle the 3 Crystal Remains story asset cards facedown」：暗放牌堆（未知顺序）。
export const CRYSTAL_REMAINS_DECK = Object.freeze([...CRYSTAL_REMAINS_CODES])

// ---------------------------------------------------------------------------
// 遭遇牌库
// ---------------------------------------------------------------------------
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => {
  const codes = new Set(groups.map(snake))
  return Object.entries(ALL_CARDS).filter(([, card]) => codes.has(card.encounterCode))
}
const deckCardTypes = ['enemy', 'treachery']
const expand = rows => rows
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))

// 固定 7 组：族群虫后与两张水晶寄生虫在 Setup 放到一边（后者由 10722 着彩枯疫的强制效果
// 从放一边区生成），因此不进遭遇牌库。
export const SET_ASIDE_DECK_CODES = Object.freeze([BROOD_QUEEN_CODE, CRYSTAL_PARASITE_CODE])
export const ENCOUNTER_DECK = Object.freeze(expand(cardsOfGroups(GATHER_GROUPS)
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => !SET_ASIDE_DECK_CODES.includes(code))))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 当日组（第一日/第二日/最终日）的诡计：开局按 campaign.records.day（缺省 1）并入遭遇牌库。
export function dayGroupCards(day) {
  const group = DAY_GATHER_GROUPS[Number(day) || 1] || DAY_GATHER_GROUPS[1]
  return expand(cardsOfGroups([group]).filter(([, card]) => deckCardTypes.includes(card.type)))
}
export const DAY_TREACHERY_CODES = Object.freeze(Object.fromEntries(
  DAY_NUMBERS.map(day => [day, [...new Set(dayGroupCards(day))]]),
))
export function encounterDeckForDay(day) {
  return [...ENCOUNTER_DECK, ...dayGroupCards(day)]
}

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
const definitionCodes = [
  ...ENCOUNTER_DECK_CODES,
  ...DAY_NUMBERS.flatMap(day => dayGroupCards(day)),
  ...SET_ASIDE_ENEMY_CODES,
  ...CRYSTAL_REMAINS_CODES,
  ...Object.values(TIME_MARKER_CODES),
  ...Object.values(RESIDENT_ASSETS),
]
const definitions = encounterDefinitions(definitionCodes)
// 族群虫后：生命 = 5 + 天数 × 每调查员（卡表没有该字段，按印刷文在 behavior 生成时补）。
if (definitions.enemies[BROOD_QUEEN_CODE]) {
  Object.assign(definitions.enemies[BROOD_QUEEN_CODE], { healthPerDay: 1, fightPerOtherInsect: 1 })
}

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
// 幕 1 目标：轮末时在珀尔庄园废墟的调查员共同花费 2[per_investigator] 线索推进
// （引擎 act-agenda.js 读 objective + behavior.roundEndActIndex）。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[1]),
    objective: { type: 'clues', perInvestigator: 2, atLocation: START_LOCATION },
    warrens: true,
  }),
  2: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[2]),
    objective: { type: 'resignedWithCrystalRemains', crystalRemains: 1 },
    laidToRest: true,
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(AGENDA_CODE_BY_STAGE[1]),
    spawnBroodQueenOnDoom: 'skullOrAutoFail',
  }),
  2: Object.freeze({
    ...stage(AGENDA_CODE_BY_STAGE[2]),
    insectsLoseAloof: true,
    spawnBroodQueenOnDoom: 'symbol',
  }),
})
// 荒芜 v.II（第 2/3 日）：[[昆虫]]敌人失去冷漠与巡逻并获得猎手。
export const DESOLATION_V2_STAGE = Object.freeze({
  ...stage(DESOLATION_V2_CODE),
  insectsLoseAloof: true,
  insectsLosePatrol: true,
  insectsGainHunter: true,
  spawnBroodQueenOnDoom: 'symbol',
})
export const ACTS = Object.freeze([1, 2].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([
  structuredClone(AGENDA_STAGES[1]), structuredClone(AGENDA_STAGES[2]),
])
// 引擎 api.setActDeckCards / setAgendaDeckCards 从 state.scenario.stageCards 实例化卡牌。
export const STAGE_CARDS = Object.freeze(Object.fromEntries([
  [AGENDA1_CODE, structuredClone(AGENDA_STAGES[1])],
  [DESOLATION_V1_CODE, structuredClone(AGENDA_STAGES[2])],
  [DESOLATION_V2_CODE, structuredClone(DESOLATION_V2_STAGE)],
  [ACT1_CODE, structuredClone(ACT_STAGES[1])],
  [ACT2_CODE, structuredClone(ACT_STAGES[2])],
]))

// ---------------------------------------------------------------------------
// 剧情正文（指南）：story-text.js 的键是相对指南文件根的扁平路径。
// ---------------------------------------------------------------------------
const safeStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: {}, sectionsEn: {} }
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
const SECTIONS = nestFlat(safeStory(CHAPTER_ID).sectionsEn)
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
// 战役通用规则（网格相邻 / 昼夜）从《欢迎来到铁杉谷》的战役规则段读取：本关指南不含
// specialRules 段，但面板需要展示这两条影响本关的战役规则。
const BASE_SECTIONS = nestFlat(safeStory('welcomeToHemlockVale').sectionsEn)
const baseRule = index => ({
  title: text(BASE_SECTIONS.specialRules?.[index]?.title),
  body: text(BASE_SECTIONS.specialRules?.[index]?.body),
})

export const INTRO_BRANCHES = Object.freeze(Object.fromEntries(
  ['intro1', 'intro2', 'intro3', 'intro4', 'intro5']
    .map(key => [key, blocks(SECTIONS.intro?.[key]?.title, SECTIONS.intro?.[key]?.body)]),
))

// Setup 的 14 个印刷步骤（顺序即面板展示顺序）；`when` 是显示条件，实际布置在 behavior。
export const SETUP_STEPS = Object.freeze([
  { key: 'gatherSets', text: text(SECTIONS.setup?.gatherSets) },
  { key: 'currentDaySet', text: text(SECTIONS.setup?.currentDaySet) },
  { key: 'currentDayMarker', text: text(SECTIONS.setup?.currentDayMarker) },
  { key: 'desolationV1', text: text(SECTIONS.setup?.desolationV1), when: 'day1' },
  { key: 'desolationV2', text: text(SECTIONS.setup?.desolationV2), when: 'notDay1' },
  { key: 'locations', text: text(SECTIONS.setup?.locations) },
  { key: 'startAt', text: text(SECTIONS.setup?.startAt) },
  { key: 'setAside', text: text(SECTIONS.setup?.setAside) },
  { key: 'crystalRemains', text: text(SECTIONS.setup?.crystalRemains) },
  { key: 'horrorsInTheRock', text: text(SECTIONS.setup?.horrorsInTheRock) },
  { key: 'residents', text: text(SECTIONS.setup?.residents), when: 'day' },
  { key: 'leahAtwood', text: text(SECTIONS.setup?.leahAtwood), when: 'day1' },
  { key: 'drRosaMarquez', text: text(SECTIONS.setup?.drRosaMarquez), when: 'day2' },
  { key: 'motherRachel', text: text(SECTIONS.setup?.motherRachel), when: 'day3' },
  { key: 'removeResidents', text: text(SECTIONS.setup?.removeResidents), when: 'day' },
])

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'printed-text (en; zh translation pending in story-text.js)',
  heading: text(SECTIONS.intro?.title),
  intro: text(SECTIONS.intro?.body),
  introBranches: INTRO_BRANCHES,
  introLeadIn: Object.freeze({
    nightSkip: text(SECTIONS.intro?.nightSkip),
    day1: text(SECTIONS.intro?.day1),
    day2: text(SECTIONS.intro?.day2),
    day3: text(SECTIONS.intro?.day3),
  }),
  setup: SETUP_STEPS.map(step => step.text).filter(Boolean).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([]),
  rules: Object.freeze({
    locationAdjacency: baseRule(3),
    dayAndNight: baseRule(5),
    codex: baseRule(0),
  }),
  tooltips: Object.freeze({
    pearlEstateRuinsResign: text(SECTIONS.tooltips?.pearlEstateRuins?.resign),
  }),
  tokens: Object.freeze({
    easyStandard: Object.freeze({
      skull: text(SECTIONS.tokens?.easyStandard?.skull),
      cultist: text(SECTIONS.tokens?.easyStandard?.cultist),
      tablet: text(SECTIONS.tokens?.easyStandard?.tablet),
      elderThing: text(SECTIONS.tokens?.easyStandard?.elderThing),
    }),
    hardExpert: Object.freeze({
      skull: text(SECTIONS.tokens?.hardExpert?.skull),
      cultist: text(SECTIONS.tokens?.hardExpert?.cultist),
      tablet: text(SECTIONS.tokens?.hardExpert?.tablet),
      elderThing: text(SECTIONS.tokens?.hardExpert?.elderThing),
    }),
  }),
  codex: Object.freeze({
    motherRachel: Object.freeze({ title: text(SECTIONS.codex?.motherRachel?.title), body: text(SECTIONS.codex?.motherRachel?.body) }),
    leahAtwood: Object.freeze({ title: text(SECTIONS.codex?.leahAtwood?.title), body: text(SECTIONS.codex?.leahAtwood?.body) }),
    drRosaMarquez: Object.freeze({
      title: text(SECTIONS.codex?.drRosaMarquez?.title),
      act1: text(SECTIONS.codex?.drRosaMarquez?.act1),
      act2: text(SECTIONS.codex?.drRosaMarquez?.act2),
    }),
    larvalTunnel: Object.freeze({ title: text(SECTIONS.codex?.larvalTunnel?.title), body: text(SECTIONS.codex?.larvalTunnel?.body) }),
    saltChamber: Object.freeze({ title: text(SECTIONS.codex?.saltChamber?.title), body: text(SECTIONS.codex?.saltChamber?.body) }),
    crystalNursery: Object.freeze({ title: text(SECTIONS.codex?.crystalNursery?.title), body: text(SECTIONS.codex?.crystalNursery?.body) }),
    broodQueen: Object.freeze({ title: text(SECTIONS.codex?.broodQueen?.title), body: text(SECTIONS.codex?.broodQueen?.body) }),
  }),
  xp: Object.freeze({ bonus: text(SECTIONS.codex?.xp?.bonus) }),
  resolutions: Object.freeze(Object.fromEntries(RESOLUTION_KEYS
    .map(key => [key, blocks(SECTIONS.resolutions?.[key]?.title, SECTIONS.resolutions?.[key]?.body)]))),
  resolutionBranches: Object.freeze({
    proceedToResolution1: text(SECTIONS.resolutions?.noResolution?.proceedToResolution1),
    skipToResolution2: text(SECTIONS.resolutions?.noResolution?.skipToResolution2),
    skipToResolution4: text(SECTIONS.resolutions?.noResolution?.skipToResolution4),
  }),
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '寂静荒野 · The Silent Heath',
  nameEn: 'The Silent Heath',
  encounterCode: ENCOUNTER_CODE,
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
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_CARDS, ...HORRORS_SET_ASIDE_CODES],
  horrorsSetAsideAliases: [...HORRORS_SET_ASIDE_CODES],
  caveLocationIds: [...CAVE_LOCATION_IDS],
  horrorsPoolIds: [...HORRORS_POOL_IDS],
  connectByGrid: CONNECTION_POLICY,
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  dayEncounterDecks: Object.freeze(Object.fromEntries(DAY_NUMBERS.map(day => [day, dayGroupCards(day)]))),
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  tokenMeanings: {
    easy: { ...SILENT_HEATH_TOKEN_MEANINGS.easy },
    standard: { ...SILENT_HEATH_TOKEN_MEANINGS.standard },
    hard: { ...SILENT_HEATH_TOKEN_MEANINGS.hard },
    expert: { ...SILENT_HEATH_TOKEN_MEANINGS.expert },
  },
  // 引擎日期原语（scenario-calendar.js）的声明位置：behavior 开局写入当前日/时段，
  // 供共享卡条目（10716 干燥地洞、10721 水晶寄生虫等）的 (Day)/(Night) 子句读 duringPeriod。
  mechanics: {
    calendar: { maximumDay: 3, record: 'hemlockDate', periodByLocationTrait: null },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...Object.values(TIME_MARKER_CODES),
  ...ACT_CODES, ...AGENDA_CODES,
  ...START_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...CAVE_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...HORRORS_POOL_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES,
  ...Object.values(DAY_TREACHERY_CODES).flat(),
  ...SET_ASIDE_ENEMY_CODES, ...CRYSTAL_REMAINS_CODES, ...Object.values(RESIDENT_ASSETS),
].map(code => [code, ALL_CARDS[code]])))
