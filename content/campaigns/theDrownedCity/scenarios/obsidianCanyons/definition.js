// 黑曜石峡谷（Obsidian Canyons · 提示卡 11639）· 章节数据（scenario 只含数据）。
//
// 参考（权威）：
//   Scenario/Scenarios/TheDrownedCity/ObsidianCanyons.hs +
//   Scenario/Scenarios/TheDrownedCity/ObsidianCanyons/Helpers.hs +
//   Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/TheDrownedCity/ObsidianCanyons.hs +
//   Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheDrownedCity/ObsidianCanyons/*.hs +
//   frontend/src/locales/en/theDrownedCity/obsidianCanyons.json（权威印刷文本）。
//
// 卡号归属（chapter-inventory obsidianCanyons）：11640–11672b 共 37 条记录；11639 是本关提示卡
// （scenario 自身，不建单卡条目），本章专属组 obsidian_canyons。37 张条目在
// src/cards/encounter-entries/theDrownedCity/obsidianCanyons/。
//
// 本关三条特有口径：
//   1. 正交网格（coordinateSystem:'grid' + adjacency:'orthogonal'）：3×4 → 3×5 → 4×5 三次重排；
//      每处地点与上下左右相邻的开阔天空/地点相连（behavior.configureMap + connectGrid）。
//   2. 开阔天空（Open Sky）：由 Ancient Evils / Chilling Cold / Striking Fear 的 14（v.I）/ 11（v.II）
//      张遭遇卡充当「开阔天空」牌——本实现用合成地点 id `openSkyN` 表示棋盘上的开阔天空格，
//      真实遭遇卡号列在 scenario.setAsideAliases（对应 Haskell 的 consumedForOpenSky）。
//   3. 峰顶牌库（Summit deck）：始终从**牌库底**抽牌（P7 原语 mechanics.scenarioDecks take/discard
//      from:'bottom'），缺位由牌库底补，牌库顶只按剧本指示放回。
//
// 两条分支（按 campaign.records.theExpeditionHeadedWest / theExpeditionHeadedEast）：
//   v.I 西征：幕 11645/11646/11647，议程 11642，东风（11640b）在场，开阔天空 14，远古邪恶入池；
//   v.II 东征：幕 11643/11644，议程 11641，西风（11640）在场，开阔天空 11，远古邪恶不入池。
//
// 记录键（CONTRACT §4）：obsidianClaw、rlyehMap、helpedWithTheRopes、wasHelpedWithTheRopes。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { OBSIDIAN_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'obsidianCanyons'
export const REFERENCE_CODE = '11639'
export const ENCOUNTER_CODE = 'obsidian_canyons'

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const WEST_ACT_CODES = Object.freeze(['11645', '11646', '11647'])
export const EAST_ACT_CODES = Object.freeze(['11643', '11644'])
export const ACT_CODE_BY_BRANCH = Object.freeze({ west: WEST_ACT_CODES, east: EAST_ACT_CODES })
export const WEST_AGENDA_CODE = '11642'
export const EAST_AGENDA_CODE = '11641'
export const AGENDA_CODE_BY_BRANCH = Object.freeze({ west: WEST_AGENDA_CODE, east: EAST_AGENDA_CODE })
export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2'])

// 双面风故事卡：西征 Setup 用东风（11640b）面，东征用西风（11640）面。
export const WEST_WINDS_CODE = '11640'
export const EAST_WINDS_CODE = '11640b'
export const WINDS_CODE_BY_BRANCH = Object.freeze({ west: EAST_WINDS_CODE, east: WEST_WINDS_CODE })

// ---------------------------------------------------------------------------
// 剧情资产 / 敌人 / 诡计
// ---------------------------------------------------------------------------
export const SKY_RELIC_CODE = '11663'
export const SKY_RELIC_STORY_CODE = '11663b'
export const ERODED_FRIEZE_CODE = '11664'
export const ERODED_FRIEZE_STORY_CODE = '11664b'
export const GLYPH_ORRERY_STORY_CODE = '11662b'
export const OBSIDIAN_CLAW_SPEED_CODE = '11672a'
export const OBSIDIAN_CLAW_POWER_CODE = '11672b'
export const OBSIDIAN_CLAW_CODES = Object.freeze([OBSIDIAN_CLAW_SPEED_CODE, OBSIDIAN_CLAW_POWER_CODE])
export const PRIMEVAL_TERROR_CODE = '11670'
export const STAR_VAMPIRE_CODE = '11671'
export const INESCAPABLE_CODE = '11744'
export const STAR_SPAWN_CODES = Object.freeze(['11725', '11726', '11727', '11728'])

// 地点专属的符文翻译（运行时写 campaign.records.discoveredGlyphs）。
export const GLYPH_BY_LOCATION = Object.freeze({
  easternAthenaeum: Object.freeze({ rune: 'rune_b', word: 'Plant' }),
  westernAthenaeum: Object.freeze({ rune: 'rune_c', word: 'Elder Thing' }),
  glyphOrrery: Object.freeze({ rune: 'rune_d', word: 'Wave' }),
})
export const SKY_RELIC_GLYPH = Object.freeze({ rune: 'rune_f', word: 'Stars' })
export const ERODED_FRIEZE_GLYPH = Object.freeze({ rune: 'rune_e', word: 'Darkness' })

// ---------------------------------------------------------------------------
// gather 组
// ---------------------------------------------------------------------------
export const COMMON_GATHER_GROUPS = Object.freeze([
  'obsidianCanyons', 'cosmicLegacy', 'elderMist', 'rlyeh', 'nightgaunts',
])
export const WEST_GATHER_GROUPS = Object.freeze([
  ...COMMON_GATHER_GROUPS, 'theInescapable', 'starSpawn', 'chillingCold', 'strikingFear', 'ancientEvils',
])
export const EAST_GATHER_GROUPS = Object.freeze([
  ...COMMON_GATHER_GROUPS, 'theInescapable', 'starSpawn', 'chillingCold', 'strikingFear',
])
export const GATHER_GROUPS = Object.freeze([...new Set([...WEST_GATHER_GROUPS, ...EAST_GATHER_GROUPS])])

// ---------------------------------------------------------------------------
// 地点（21 张物理地点；11656/11657/11659/11661 各有多张，按物理实例给独立 id）
// ---------------------------------------------------------------------------
export const LOCATION_SPECS = Object.freeze([
  Object.freeze(['rlyehStreets', '11648', Object.freeze({ start: true, central: true, immovable: true, cannotLeavePlay: true, cluesByResources: true })]),
  Object.freeze(['centralSpire', '11649', Object.freeze({ central: true, immovable: true, cannotLeavePlay: true, entryToll: true, cluesByResources: true })]),
  Object.freeze(['floatingSpire', '11650', Object.freeze({ central: true, immovable: true, cannotLeavePlay: true, entryToll: true, cluesByResources: true })]),
  Object.freeze(['westernWall', '11651', Object.freeze({ central: true, immovable: true, cannotLeavePlay: true, resign: true, revealErodedFrieze: true })]),
  Object.freeze(['ancientDome', '11652', Object.freeze({ central: true, immovable: true, cannotLeavePlay: true, resign: true, revealErodedFrieze: true })]),
  Object.freeze(['easternAthenaeum', '11653', Object.freeze({ summit: true, glyph: 'rune_b', glyphWord: 'Plant', glyphLocation: 'easternAthenaeum' })]),
  Object.freeze(['westernAthenaeum', '11654', Object.freeze({ summit: true, glyph: 'rune_c', glyphWord: 'Elder Thing', glyphLocation: 'westernAthenaeum', glyphOnLastClue: true })]),
  Object.freeze(['obsidianCliffs', '11655', Object.freeze({ summit: true })]),
  Object.freeze(['suspendedReef1', '11656', Object.freeze({ summit: true, suspendedReef: true })]),
  Object.freeze(['suspendedReef2', '11656', Object.freeze({ summit: true, suspendedReef: true })]),
  Object.freeze(['suspendedReef3', '11656', Object.freeze({ summit: true, suspendedReef: true })]),
  Object.freeze(['hangingShip1', '11657', Object.freeze({ summit: true, hangingShip: true })]),
  Object.freeze(['hangingShip2', '11657', Object.freeze({ summit: true, hangingShip: true })]),
  Object.freeze(['ancientCanyons', '11658', Object.freeze({ summit: true })]),
  Object.freeze(['dazzlingSkyline1', '11659', Object.freeze({ summit: true })]),
  Object.freeze(['dazzlingSkyline2', '11659', Object.freeze({ summit: true })]),
  Object.freeze(['dazzlingSkyline3', '11659', Object.freeze({ summit: true })]),
  Object.freeze(['aerialWaterfall', '11660', Object.freeze({ summit: true })]),
  Object.freeze(['magneticSpires1', '11661', Object.freeze({ summit: true, magneticSpires: true })]),
  Object.freeze(['magneticSpires2', '11661', Object.freeze({ summit: true, magneticSpires: true })]),
  Object.freeze(['glyphOrrery', '11662', Object.freeze({ summit: true, glyph: 'rune_d', glyphWord: 'Wave', glyphLocation: 'glyphOrrery', glyphOrrery: true })]),
])
export const LOCATION_IDS = Object.freeze(LOCATION_SPECS.map(([id]) => id))
export const LOCATION_OPTIONS = Object.freeze(Object.fromEntries(LOCATION_SPECS.map(([id, , options]) => [id, options])))
export const LOCATION_CODE = Object.freeze(Object.fromEntries(LOCATION_SPECS.map(([id, code]) => [id, code])))
export const START_LOCATION = 'rlyehStreets'
export const START_LOCATION_IDS = Object.freeze([START_LOCATION])
export const SUMMIT_LOCATION_IDS = Object.freeze(LOCATION_IDS.filter(id => LOCATION_OPTIONS[id].summit))
export const IMMOVABLE_LOCATION_IDS = Object.freeze(LOCATION_IDS.filter(id => LOCATION_OPTIONS[id].immovable))

function makeLocation(id, code, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Obsidian Canyons location: ${code}`)
  return location({
    id, code,
    clues: card.clues,
    connections: extra.connections ? [...extra.connections] : [],
    ...extra,
    printedName: card.nameZh || card.name || code,
    printedTraits: [...(card.traits || [])],
  })
}

// 静态连接：正交网格在运行期由 behavior.configureMap/connectGrid 计算；印刷文本没有图标连接，
// 因此边界表留空（layout 只画展示连线）。
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_SPECS.map(([id, code, options]) => {
  const extra = { ...options }
  if (id === START_LOCATION) Object.assign(extra, { revealed: true })
  return [id, makeLocation(id, code, extra)]
})))

// 起始网格（幕 1 地点摆放示意图，3 行 × 4 列，拉莱耶街道在左下）。
export const START_CELL = Object.freeze({ x: 0, y: 0 })
export const INITIAL_OPEN_SKY_CELLS = Object.freeze([
  Object.freeze({ x: 1, y: 0 }), Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 2, y: 1 }), Object.freeze({ x: 1, y: 2 }),
])
export const INITIAL_FILL_CELLS = Object.freeze([
  Object.freeze({ x: 2, y: 0 }), Object.freeze({ x: 3, y: 0 }),
  Object.freeze({ x: 1, y: 1 }), Object.freeze({ x: 3, y: 1 }),
  Object.freeze({ x: 0, y: 2 }), Object.freeze({ x: 2, y: 2 }), Object.freeze({ x: 3, y: 2 }),
])

// 幕 2 摆放示意图：3 行 × 5 列，中央尖塔在中间行最左（Haskell actTwoLayout）。
export const ACT_TWO_LAYOUT = Object.freeze({
  rows: 3, columns: 5, anchorId: 'centralSpire', anchorCell: Object.freeze({ x: 0, y: 1 }),
  openSkyCells: Object.freeze([{ x: 1, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }]),
  fillCells: Object.freeze([{ x: 0, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 1 },
    { x: 4, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]),
})
// 幕 3 摆放示意图：4 行 × 5 列，漂浮尖塔在左上。
export const ACT_THREE_LAYOUT = Object.freeze({
  rows: 4, columns: 5, anchorId: 'floatingSpire', anchorCell: Object.freeze({ x: 0, y: 3 }),
  openSkyCells: Object.freeze([{ x: 1, y: 3 }, { x: 3, y: 3 }, { x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }]),
  fillCells: Object.freeze([{ x: 2, y: 3 }, { x: 4, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
    { x: 4, y: 2 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }]),
})
export const WINDOWS = Object.freeze({
  west: Object.freeze({ rows: Object.freeze([1, 3]), direction: 'left' }),
  east: Object.freeze({ rows: Object.freeze([2, 4]), direction: 'right' }),
})

// 桌面包展示槽位：真实坐标运行期写入网格，这里给全部候选地点确定性槽位。
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(
  LOCATION_IDS.map((id, index) => [id, { x: index % 7, y: -Math.floor(index / 7) }])))

// ---------------------------------------------------------------------------
// 两条远征分支
// ---------------------------------------------------------------------------
const expandCodes = codes => codes.flatMap(code => Array(Math.max(1, Number(ALL_CARDS[code]?.quantity) || 1)).fill(code))
const OPEN_SKY_WEST_CODES = Object.freeze(expandCodes(['01167', '01168', '01163', '01164', '01165', '01166']))
const OPEN_SKY_EAST_CODES = Object.freeze(expandCodes(['01167', '01168', '01163', '01164', '01165']))
export const OPEN_SKY_POOL_IDS = Object.freeze(Array.from({ length: OPEN_SKY_WEST_CODES.length }, (_, index) => `openSky${index + 1}`))

export const EXPEDITIONS = Object.freeze({
  west: Object.freeze({
    id: 'west',
    label: 'Setup (v.I) – Western Expedition',
    storyCode: EAST_WINDS_CODE,
    actCodes: WEST_ACT_CODES,
    agendaCode: WEST_AGENDA_CODE,
    openSkyCodes: OPEN_SKY_WEST_CODES,
    openSkyPoolIds: Object.freeze([...OPEN_SKY_POOL_IDS]),
    removedLocationIds: Object.freeze(['ancientDome']),
    asideLocationIds: Object.freeze(['floatingSpire', 'aerialWaterfall', 'glyphOrrery', 'westernWall']),
    removeStarSpawn: 2,
    inescapable: 'spawn',
    windsRows: WINDOWS.west.rows,
    windsDirection: WINDOWS.west.direction,
  }),
  east: Object.freeze({
    id: 'east',
    label: 'Setup (v.II) — Eastern Expedition',
    storyCode: WEST_WINDS_CODE,
    actCodes: EAST_ACT_CODES,
    agendaCode: EAST_AGENDA_CODE,
    openSkyCodes: OPEN_SKY_EAST_CODES,
    openSkyPoolIds: Object.freeze(OPEN_SKY_POOL_IDS.slice(0, OPEN_SKY_EAST_CODES.length)),
    removedLocationIds: Object.freeze(['westernWall', 'floatingSpire']),
    asideLocationIds: Object.freeze(['aerialWaterfall', 'glyphOrrery', 'ancientDome']),
    removeStarSpawn: 3,
    inescapable: 'aside',
    windsRows: WINDOWS.east.rows,
    windsDirection: WINDOWS.east.direction,
  }),
})

export const SET_ASIDE_LOCATION_IDS = Object.freeze(['aerialWaterfall', 'glyphOrrery'])
export const BRANCH_ASIDE_LOCATIONS = Object.freeze({ west: EXPEDITIONS.west.asideLocationIds, east: EXPEDITIONS.east.asideLocationIds })
export const BRANCH_REMOVED_LOCATIONS = Object.freeze({ west: EXPEDITIONS.west.removedLocationIds, east: EXPEDITIONS.east.removedLocationIds })

export const SET_ASIDE_CARDS = Object.freeze([SKY_RELIC_CODE, ERODED_FRIEZE_CODE, OBSIDIAN_CLAW_SPEED_CODE])
export const STAR_SPAWN_SET_ASIDE_CODES = Object.freeze(expandCodes(STAR_SPAWN_CODES))
export const INESCAPABLE_SET_CODES = Object.freeze([INESCAPABLE_CODE, ...expandCodes(['11745'])])

// ---------------------------------------------------------------------------
// 遭遇牌库（固定部分；星之眷族/穷途异魔按分支在 behavior 里结算）
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

export const ENCOUNTER_DECK = Object.freeze(expand(cardsOfGroups(COMMON_GATHER_GROUPS)
  .filter(([, card]) => deckCardTypes.includes(card.type))
  .filter(([code]) => code !== ERODED_FRIEZE_CODE)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

/** 分支遭遇牌库：固定 28 张 + 穷途异魔诡计（v.I）+ 未被移除的星之眷族。 */
export function encounterDeckForBranch(branch, { starSpawnRemaining = [], creatureWasDefeated = false } = {}) {
  const expedition = EXPEDITIONS[branch] || EXPEDITIONS.west
  const extra = []
  if (expedition.inescapable === 'spawn' && !creatureWasDefeated) extra.push(...expandCodes(['11745']))
  extra.push(...starSpawnRemaining)
  return [...ENCOUNTER_DECK, ...extra.sort()]
}

// ---------------------------------------------------------------------------
// 遭遇定义（数值/关键词取印刷数据）
// ---------------------------------------------------------------------------
const definitionCodes = [
  ...ENCOUNTER_DECK_CODES,
  ...STAR_SPAWN_CODES, INESCAPABLE_CODE, ...expandCodes(['11745']),
  ERODED_FRIEZE_CODE, SKY_RELIC_CODE,
  ...OBSIDIAN_CLAW_CODES,
  WEST_WINDS_CODE, EAST_WINDS_CODE, GLYPH_ORRERY_STORY_CODE, SKY_RELIC_STORY_CODE, ERODED_FRIEZE_STORY_CODE,
]
const definitions = encounterDefinitions(definitionCodes)

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  11645: Object.freeze({ ...stage('11645'), objective: Object.freeze({ type: 'scenario', kind: 'allAt', location: 'centralSpire' }) }),
  11646: Object.freeze({ ...stage('11646'), objective: Object.freeze({ type: 'scenario', kind: 'allAt', location: 'floatingSpire' }) }),
  11647: Object.freeze({ ...stage('11647'), objective: Object.freeze({ type: 'scenario', kind: 'allResigned' }) }),
  11643: Object.freeze({ ...stage('11643'), objective: Object.freeze({ type: 'scenario', kind: 'allAt', location: 'centralSpire' }) }),
  11644: Object.freeze({ ...stage('11644'), objective: Object.freeze({ type: 'scenario', kind: 'allResigned' }) }),
})
export const AGENDA_STAGES = Object.freeze({
  11642: Object.freeze({ ...stage('11642'), backEffect: 'discardUntilEnemy' }),
  11641: Object.freeze({ ...stage('11641'), backEffect: 'none' }),
})
export const STAGE_CARDS = Object.freeze({ ...ACT_STAGES, ...AGENDA_STAGES })
export const ACTS = Object.freeze(Object.values(ACT_STAGES))
export const AGENDAS = Object.freeze(Object.values(AGENDA_STAGES))

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export const RESOLUTIONS = Object.freeze({
  noResolution: Object.freeze({ id: 'noResolution', label: 'No Resolution',
    nextByBranch: Object.freeze({ west: 'sepulchreOfTheSleeper', east: 'courtOfTheAncients' }) }),
  resolution1: Object.freeze({ id: 'resolution1', label: 'Resolution 1', next: 'sepulchreOfTheSleeper', claimObsidianClaw: true }),
  resolution2: Object.freeze({ id: 'resolution2', label: 'Resolution 2', next: 'courtOfTheAncients', claimObsidianClaw: true }),
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '黑曜石峡谷 · Obsidian Canyons',
  nameEn: 'Obsidian Canyons',
  encounterCode: ENCOUNTER_CODE,
  locations: LOCATIONS,
  startLocation: START_LOCATION,
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [
    ...SET_ASIDE_CARDS, ...STAR_SPAWN_SET_ASIDE_CODES, ...INESCAPABLE_SET_CODES,
    ...EXPEDITIONS.west.openSkyCodes,
  ],
  coordinateSystem: 'grid',
  adjacency: 'orthogonal',
  acts: ACTS,
  agendas: AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: { ...RESOLUTIONS },
  tokenMeanings: {
    easy: { ...OBSIDIAN_TOKEN_MEANINGS.easy },
    standard: { ...OBSIDIAN_TOKEN_MEANINGS.standard },
    hard: { ...OBSIDIAN_TOKEN_MEANINGS.hard },
    expert: { ...OBSIDIAN_TOKEN_MEANINGS.expert },
  },
  // 峰顶独立牌库（summit）与网格坐标由 behavior 的 api.mechanics.scenarioDecks / map.place
  // 建立；registry 的 scenario.mechanics 只接受固定字段，故这里不声明。
  textLanguage: 'en',
  textStatus: 'printed-text (en; story/guide zh 由 narrative-guides worker 落 story-text.js)',
}

// 章节定义内的 stage/agenda 对象是 Object.freeze 的只读数据；身份绑定要在可写克隆上做。
scenario.acts = (scenario.acts || []).map(entry => structuredClone(entry))
scenario.agendas = (scenario.agendas || []).map(entry => structuredClone(entry))
export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE,
  ...LOCATION_IDS.map(id => LOCATION_CODE[id]),
  ...Object.keys(ACT_STAGES), ...Object.keys(AGENDA_STAGES),
  WEST_WINDS_CODE, EAST_WINDS_CODE, GLYPH_ORRERY_STORY_CODE, SKY_RELIC_STORY_CODE, ERODED_FRIEZE_STORY_CODE,
  SKY_RELIC_CODE, ERODED_FRIEZE_CODE, ...OBSIDIAN_CLAW_CODES,
  ...ENCOUNTER_DECK_CODES, ...STAR_SPAWN_CODES, INESCAPABLE_CODE,
].filter(Boolean).map(code => [code, ALL_CARDS[code]])))
