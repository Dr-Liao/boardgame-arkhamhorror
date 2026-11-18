// 消失的姐妹（theLostSister · 提示卡 10569，阿克望海岸洞穴）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLostSister.hs +
//       Act|Agenda|Location|Enemy|Treachery/CardDefs/TheFeastOfHemlockVale/TheLostSister.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheLostSister/*.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theLostSister.json（权威印刷文本）。
//
// 卡号归属（audit/fhv-scope.json#chapterGroups[theLostSister]）：10569–10587 共 21 条记录，
// 其中 10569 是本关提示卡（scenario 自身，无单卡条目），本章专属组 the_lost_sister。
// 地点/幕/议程按本批约定**建数据型条目**（input.entryPaths 提供了它们），规则数值与流程在
// 本文件与 behavior.js；敌人/诡计的单卡条目在
// src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/。
//
// 三条本关特有口径（印刷文本见 SCENARIO_TEXT）：
//   1. 黑暗地点：黑暗地点上的卡只用(黑夜)效果，其余地点只用(白日)效果；时间标记卡在本关无效。
//   2. 双面敌人：3 组双面敌人（鳖类混种/虾类混种×2）；在黑暗地点翻到黑夜面，否则翻到白日面。
//   3. 岩穴牌库（Caverns deck）：本关专属地点牌库，顶 3 张未揭示入场，其余支撑整关的扩图。
//
// 剧情/指南正文来自内容生成物 story-text.js（经 story-access.js 读取，中文翻译尚未落地，
// 因此 textLanguage 为 en；缺章节时 safeStory 兜底空对象，章节结构/manifest 仍可 import）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, flattenStory } from '../../story-access.js'
import { THE_LOST_SISTER_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'theLostSister'
export const REFERENCE_CODE = '10569'

// 幕/议程牌库：固定 3 幕 + 2 议程（Haskell setActDeck/setAgendaDeck）。
export const ACT_CODES = Object.freeze(['10572', '10573', '10574'])
export const AGENDA_CODES = Object.freeze(['10570', '10571'])
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT_CODES[0], 2: ACT_CODES[1], 3: ACT_CODES[2] })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA_CODES[0], 2: AGENDA_CODES[1] })

// Setup「Gather all cards from the following encounter sets」5 组；
// 「check the Campaign Log for the current day and gather its corresponding encounter set」
// 是第三个参数：当日组（第一日/第二日/最终日），只在开局时按天数并入遭遇牌库。
export const GATHER_GROUPS = Object.freeze([
  'theLostSister', 'blight', 'horrorsInTheRock', 'mutations', 'myconids',
])
export const DAY_GATHER_GROUPS = Object.freeze({
  1: 'theFirstDay', 2: 'theSecondDay', 3: 'theFinalDay',
})
export const DAY_NUMBERS = Object.freeze([1, 2, 3])

export const START_LOCATION = 'akwan'
export const FUNGAL_CAVE_ID = 'fungalCave'
// 未揭示的岩穴面固定为 [[Cave]][[Dark]]（Haskell locationWithUnrevealed_ "Cavern" [Cave, Dark]）。
export const UNREVEALED_CAVERN_NAME = 'Cavern'
export const UNREVEALED_CAVERN_TRAITS = Object.freeze(['Cave', 'Dark'])

// 剧情标记（Remembered）：名称取自指南 remembered 段，键是印刷句子。
export const REMEMBERED = Object.freeze({
  dogLeash: 'foundATornDogLeash',
  footprints: 'foundASetOfFootprints',
  theoArguing: 'theoIsArguingWithHelen',
  gideonHeirloom: 'gideonIsSearchingForAnHeirloom',
})
export const REMEMBERED_LABELS = Object.freeze({
  [REMEMBERED.dogLeash]: 'Found a torn dog leash.',
  [REMEMBERED.footprints]: 'Found a set of footprints.',
  [REMEMBERED.theoArguing]: 'Theo is arguing with Helen.',
  [REMEMBERED.gideonHeirloom]: 'Gideon is searching for an heirloom.',
})

// 双面敌人（Day 面 / Night 面）：同一张物理卡的 two faces，翻面保留标记与附属。
export const HYBRID_FACES = Object.freeze({
  limulus: Object.freeze({ day: '10583a', night: '10583b' }),
  crustacean: Object.freeze({ day: '10584a', night: '10584b' }),
})
export const LIMULUS_CODES = Object.freeze(['10583a', '10583b'])
export const CRUSTACEAN_CODES = Object.freeze(['10584a', '10584b'])
export const LIMULUS_CODE = '10583a'
export const CRUSTACEAN_CODE = '10584a'
export const CAVERN_MOSS_CODE = '10585'
export const LUMINOUS_GROWTH_CODE = '10587'
export const RECLAIMED_BY_NATURE_CODE = '10586'
export const CRYSTAL_PARASITE_CODE = '10721'

// Residents（居民）遭遇组：Setup 依日期/时段放入的剧情支援。
export const RESIDENT_ASSETS = Object.freeze({
  helen: '10703', theo: '10700', gideon: '10698', william: '10696', rosa: '10702',
})

// 地点表：[id, code, symbol]。10576 悬墓 ×2、10581 露天洞穴 ×2、10716 干燥地洞 ×2 各自给
// 独立实例 id（同一张印刷卡的两份实体），其余一份。
export const LOCATION_TABLE = Object.freeze([
  ['akwan', '10575', 'circle'],
  ['hiddenCove', '10577', 'square'],
  ['weedChokedBeach', '10578', 'triangle'],
  ['rockyShoreline', '10579', 'diamond'],
  ['undergroundPools', '10580', 'squiggle'],
  ['openCave1', '10581', 'moon'],
  ['openCave2', '10581', 'moon'],
  ['suspendedGraveyard1', '10576', 'heart'],
  ['suspendedGraveyard2', '10576', 'heart'],
  ['fungalCave', '10582', 'star'],
  // Horrors in the Rock（岩中恐怖）5 种地点，共 6 张实体；其中 2 张在开局被移出游戏。
  ['dryBurrow1', '10716', 'plus'],
  ['dryBurrow2', '10716', 'plus'],
  ['alkalineForest', '10717', 't'],
  ['iridescentPassage', '10718', 'droplet'],
  ['overgrownTunnel', '10719', 'equals'],
  ['mineralTunnel', '10720', 'hourglass'],
])

export const LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const AKWAN_LOCATION_ID = START_LOCATION

// 岩穴牌库：The Lost Sister 组的岩穴地点（除真菌洞穴）8 张 + Horrors in the Rock 剩余 4 张。
export const CAVERN_LOCATION_IDS = Object.freeze([
  'hiddenCove', 'weedChokedBeach', 'rockyShoreline', 'undergroundPools',
  'openCave1', 'openCave2', 'suspendedGraveyard1', 'suspendedGraveyard2',
])
export const HORRORS_CAVERN_POOL_IDS = Object.freeze([
  'dryBurrow1', 'dryBurrow2', 'alkalineForest', 'iridescentPassage', 'overgrownTunnel', 'mineralTunnel',
])
// 「Remove 2 random Cave locations from the Horrors in the Rock encounter set from the game」。
export const HORRORS_REMOVED_COUNT = 2
export const CAVERNS_DECK_SIZE = CAVERN_LOCATION_IDS.length
  + HORRORS_CAVERN_POOL_IDS.length - HORRORS_REMOVED_COUNT
export const CAVERNS_INITIAL_PLACEMENTS = 3
// 顶 3 张的入场格：阿克望下方（左/下/右），Haskell `zip [Pos (-1) 0, Pos 0 (-1), Pos 1 0] topThree`。
export const AKWAN_CELL = Object.freeze({ x: 0, y: 0 })
export const INITIAL_CAVERN_CELLS = Object.freeze([
  Object.freeze({ x: -1, y: 0 }), Object.freeze({ x: 0, y: -1 }), Object.freeze({ x: 1, y: 0 }),
])
// 地点连接：本关所有地点「与正交相邻地点相连」（grid-map 的 orthogonal 邻接），
// 因此静态表为空表，运行期由 behavior.syncConnections（connectGrid）重算。
export const LOCATION_CONNECTIONS = Object.freeze({})
export const CONNECTION_POLICY = 'orthogonal'

// 桌面展示坐标：真实坐标在运行期写入剧本网格（mechanicState.grid），这里给每个可能入场的
// 地点一个确定性展示槽位（阿克望居中，岩穴按抽到的顺序围绕，未入场的排在右侧两列）。
// 只影响展示；规则连接仍由运行期网格决定（layout.edges 为空）。
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id], index) => {
  if (id === START_LOCATION) return [id, { x: 0, y: 0 }]
  const ring = [[-2, 0], [0, -2], [2, 0], [-2, 2], [2, 2], [-4, 0], [0, -4], [4, 0], [-4, 2], [4, 2], [-4, 4], [0, 4], [4, 4], [-6, 2], [6, 2]]
  const point = ring[index - 1] || [6 + ((index % 2) * 2), 2 + index]
  return [id, { x: point[0], y: point[1] }]
})))

function makeLocation([id, code], extra = {}) {
  const card = ALL_CARDS[code]
  const clues = Number(card?.clues) || 0
  return location({
    id, code, symbol: LOCATION_TABLE.find(row => row[0] === id)?.[2],
    clues, ...extra,
    printedName: card?.nameZh || card?.name || code,
    printedTraits: [...(card?.traits || [])],
    unrevealedTraits: [...UNREVEALED_CAVERN_TRAITS],
    unrevealedName: id === START_LOCATION ? (card?.nameZh || card?.name || code) : UNREVEALED_CAVERN_NAME,
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(row => {
  const [id] = row
  const extra = { connections: [] }
  if (id === START_LOCATION) Object.assign(extra, { resign: true, revealed: true, dark: false, coastal: true })
  if (id === FUNGAL_CAVE_ID) Object.assign(extra, { victory: 1, hasVictory: true, lair: true })
  const base = makeLocation(row, extra)
  // 黑暗状态按「当前面」判定：未揭示的岩穴面固定 [[Cave]][[Dark]]，已揭示面取印刷特性。
  base.dark = (base.traits || []).includes('Dark')
  return [id, base]
})))

// 放一边（out of play）：鳖类混种 1、水晶寄生虫 ×2、虾类混种 ×2、真菌洞穴。
export const SET_ASIDE_ENEMY_CODES = Object.freeze([LIMULUS_CODE, CRYSTAL_PARASITE_CODE, CRUSTACEAN_CODE])
export const SET_ASIDE_CARDS = Object.freeze([
  LIMULUS_CODE, CRYSTAL_PARASITE_CODE, CRYSTAL_PARASITE_CODE,
  CRUSTACEAN_CODE, CRUSTACEAN_CODE, '10582',
])

// 遭遇牌库（固定 5 组）：敌人/诡计，去掉放一边的剧本敌人，按印刷份数展开。
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => {
  const codes = new Set(groups.map(snake))
  return Object.entries(ALL_CARDS).filter(([, card]) => codes.has(card.encounterCode))
}
const FIXED_GROUPS = ['theLostSister', 'blight', 'horrorsInTheRock', 'mutations', 'myconids']
export const ENCOUNTER_DECK = Object.freeze(cardsOfGroups(FIXED_GROUPS)
  .filter(([code, card]) => ['enemy', 'treachery'].includes(card.type))
  .filter(([code]) => !SET_ASIDE_ENEMY_CODES.includes(code)
    && !LIMULUS_CODES.includes(code) && !CRUSTACEAN_CODES.includes(code))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 当日组（第一日/第二日/最终日）的卡：开局按 campaign.records.day（缺省 1）并入遭遇牌库。
export function dayGroupCards(day) {
  const group = DAY_GATHER_GROUPS[Number(day) || 1] || DAY_GATHER_GROUPS[1]
  return cardsOfGroups([group])
    .filter(([, card]) => ['enemy', 'treachery'].includes(card.type))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
}
export const DAY_TREACHERY_CODES = Object.freeze(Object.fromEntries(DAY_NUMBERS
  .map(day => [day, [...new Set(dayGroupCards(day))]])))
export function encounterDeckForDay(day) {
  return [...ENCOUNTER_DECK, ...dayGroupCards(day)]
}

const definitionCodes = [
  ...ENCOUNTER_DECK_CODES,
  ...Object.values(DAY_GATHER_GROUPS).flatMap(group => cardsOfGroups([group])
    .filter(([, card]) => ['enemy', 'treachery'].includes(card.type)).map(([code]) => code)),
  ...SET_ASIDE_ENEMY_CODES, ...LIMULUS_CODES, ...CRUSTACEAN_CODES,
  ...Object.values(RESIDENT_ASSETS),
]
const definitions = encounterDefinitions(definitionCodes)

// 遭遇定义补两条本关读点所需的数值（cards-data 不含 per-investigator 血量标志时按印刷文补）。
for (const code of LIMULUS_CODES) {
  if (definitions.enemies[code]) {
    definitions.enemies[code].healthPerInvestigatorBonus = 3
  }
}
for (const code of CRUSTACEAN_CODES) {
  if (definitions.enemies[code]) definitions.enemies[code].healthByDay = true
}

// 幕/议程阶段：objective 只声明印刷目标，判定在 behavior.checkObjectives。
//   幕 1「失踪的姐妹」：最后线索从[[洞穴]]被发现时扩图；两个 Remembered 都记下则推进。
//   幕 2「追踪」：有调查员进入真菌洞穴时立即推进。
//   幕 3「直面甲壳」：鳖类混种被击败时立即推进。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[1]),
    objective: { type: 'remembered', memories: [REMEMBERED.dogLeash, REMEMBERED.footprints] },
    forced: { type: 'lastClueDiscovered', trait: 'Cave', effect: 'placeCavernCardAdjacent' },
  }),
  2: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[2]),
    objective: { type: 'enters', locationId: FUNGAL_CAVE_ID },
    action: { type: 'moveDarkEnemy', cluesPerInvestigator: 1 },
  }),
  3: Object.freeze({
    ...stage(ACT_CODE_BY_STAGE[3]),
    objective: { type: 'defeatEnemy', enemyCodes: [...LIMULUS_CODES] },
    action: { type: 'moveDarkEnemy', cluesPerInvestigator: 1 },
  }),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(AGENDA_CODE_BY_STAGE[1]) }),
  2: Object.freeze({ ...stage(AGENDA_CODE_BY_STAGE[2]) }),
})
export const ACTS = Object.freeze([1, 2, 3].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1, 2].map(number => structuredClone(AGENDA_STAGES[number])))

// 剧情正文（指南）：story-text.js 的键是相对指南文件根的路径。
const safeStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: {}, sectionsEn: {} }
  }
}
// story-text.js 的键是「相对指南文件根的扁平路径」（`intro.intro1`、`specialRules[0].title`、
// `resolutions.resolution1.body`），这里还原成嵌套视图，章节只按结构与 JSON 走。
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

const introBranchKey = (day, night) => {
  if (night) return 'intro5'
  if (Number(day) === 2) return 'intro3'
  if (Number(day) === 3) return 'intro4'
  return 'intro2'
}
export const INTRO_BRANCHES = Object.freeze(Object.fromEntries(
  [{ day: 1, night: false }, { day: 2, night: false }, { day: 3, night: false }, { day: 1, night: true }]
    .map(({ day, night }) => [introBranchKey(day, night), text(SECTIONS.intro?.[introBranchKey(day, night)])]),
))

// Setup 的 20 个印刷步骤（顺序即面板展示顺序）；`when` 是显示条件，实际布置在 behavior。
export const SETUP_STEPS = Object.freeze([
  { key: 'gatherSets', text: text(SECTIONS.setup?.gatherSets) },
  { key: 'currentDaySet', text: text(SECTIONS.setup?.currentDaySet) },
  { key: 'currentDayMarker', text: text(SECTIONS.setup?.currentDayMarker) },
  { key: 'putAkwan', text: text(SECTIONS.setup?.putAkwan) },
  { key: 'cavernsDeck', text: text(SECTIONS.setup?.cavernsDeck) },
  { key: 'gatherCavernsLocations', text: text(SECTIONS.setup?.gatherCavernsLocations) },
  { key: 'setAsideFungalCave', text: text(SECTIONS.setup?.setAsideFungalCave) },
  { key: 'removeTwoCaves', text: text(SECTIONS.setup?.removeTwoCaves) },
  { key: 'shuffleCavernsDeck', text: text(SECTIONS.setup?.shuffleCavernsDeck) },
  { key: 'putTopThree', text: text(SECTIONS.setup?.putTopThree) },
  { key: 'dayResidents', text: text(SECTIONS.setup?.dayResidents), when: 'day' },
  { key: 'helenPeters', text: text(SECTIONS.setup?.helenPeters) },
  { key: 'theoPeters', text: text(SECTIONS.setup?.theoPeters), when: 'day1or2' },
  { key: 'gideonMizrah', text: text(SECTIONS.setup?.gideonMizrah), when: 'day2or3' },
  { key: 'williamHemlock', text: text(SECTIONS.setup?.williamHemlock), when: 'day3' },
  { key: 'removeResidents', text: text(SECTIONS.setup?.removeResidents), when: 'day' },
  { key: 'nightResidents', text: text(SECTIONS.setup?.nightResidents), when: 'night' },
  { key: 'helenPetersNight', text: text(SECTIONS.setup?.helenPetersNight), when: 'night' },
  { key: 'removeResidentsNight', text: text(SECTIONS.setup?.removeResidentsNight), when: 'night' },
  { key: 'setAsideEnemies', text: text(SECTIONS.setup?.setAsideEnemies) },
])

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'printed-text (en; zh translation pending in story-text.js)',
  heading: text(SECTIONS.intro?.title),
  intro: text(SECTIONS.intro?.intro1),
  campaignLogCheck: text(SECTIONS.intro?.body),
  introBranches: INTRO_BRANCHES,
  introLeadIn: Object.freeze({
    nightSkip: text(SECTIONS.intro?.nightSkip),
    day1: text(SECTIONS.intro?.day1),
    day2: text(SECTIONS.intro?.day2),
    day3: text(SECTIONS.intro?.day3),
  }),
  setup: SETUP_STEPS.map(step => step.text).filter(Boolean).join('\n\n'),
  setupSteps: SETUP_STEPS,
  specialRules: Object.freeze([
    { id: 'darkLocations', title: text(SECTIONS.specialRules?.[0]?.title || SECTIONS.darkLocations?.title),
      body: text(SECTIONS.specialRules?.[0]?.body || SECTIONS.darkLocations?.body) },
    { id: 'doubleSidedEnemies', title: text(SECTIONS.specialRules?.[1]?.title || SECTIONS.doubleSidedEnemies?.title),
      body: text(SECTIONS.specialRules?.[1]?.body || SECTIONS.doubleSidedEnemies?.body) },
  ]),
  rules: Object.freeze({
    darkLocations: { title: text(SECTIONS.darkLocations?.title), body: text(SECTIONS.darkLocations?.body) },
    doubleSidedEnemies: { title: text(SECTIONS.doubleSidedEnemies?.title), body: text(SECTIONS.doubleSidedEnemies?.body) },
  }),
  remembered: Object.freeze(Object.fromEntries(Object.entries(REMEMBERED)
    .map(([key, id]) => [key, text(SECTIONS.remembered?.[id])]))),
  tooltips: Object.freeze({
    akwanResign: text(SECTIONS.tooltips?.akwan?.resign),
    hiddenCoveRemember: text(SECTIONS.tooltips?.hiddenCove?.remember),
    undergroundPoolsRemember: text(SECTIONS.tooltips?.undergroundPools?.remember),
  }),
  codex: Object.freeze({
    labelBottom: text(SECTIONS.codex?.label?.bottom),
    williamHemlock: Object.freeze({ title: text(SECTIONS.codex?.williamHemlock?.title), body: text(SECTIONS.codex?.williamHemlock?.body) }),
    gideonMizrah: Object.freeze({ title: text(SECTIONS.codex?.gideonMizrah?.title), body: text(SECTIONS.codex?.gideonMizrah?.body) }),
    theoPeters: Object.freeze({
      title: text(SECTIONS.codex?.theoPeters?.title),
      arguing: text(SECTIONS.codex?.theoPeters?.arguing),
      otherwise: text(SECTIONS.codex?.theoPeters?.otherwise),
      passed: text(SECTIONS.codex?.theoPeters?.passed),
    }),
    lobstrosity: Object.freeze({
      title: text(SECTIONS.codex?.lobstrosity?.title),
      reconciled: text(SECTIONS.codex?.lobstrosity?.reconciled),
      otherwise: text(SECTIONS.codex?.lobstrosity?.otherwise),
    }),
    drRosaMarquez: Object.freeze({ title: text(SECTIONS.codex?.drRosaMarquez?.title), body: text(SECTIONS.codex?.drRosaMarquez?.body) }),
  }),
  xp: Object.freeze({
    noResolution: text(SECTIONS.resolutions?.xp?.noResolutionBonus),
    helen: text(SECTIONS.resolutions?.xp?.helenBonus),
    gideon: text(SECTIONS.resolutions?.xp?.gideonBonus),
  }),
  resolutions: Object.freeze(Object.fromEntries(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4']
    .map(key => [key, blocks(SECTIONS.resolutions?.[key]?.title, SECTIONS.resolutions?.[key]?.body)]))),
  resolutionBranches: Object.freeze({
    proceedToResolution2: text(SECTIONS.resolutions?.resolution1?.proceedToResolution2),
    skipToResolution3: text(SECTIONS.resolutions?.resolution1?.skipToResolution3),
  }),
})

export const RESOLUTION_KEYS = Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '消失的姐妹 · The Lost Sister',
  nameEn: 'The Lost Sister',
  referenceCode: REFERENCE_CODE,
  intro: SCENARIO_TEXT.intro,
  introBranches: SCENARIO_TEXT.introBranches,
  setup: SCENARIO_TEXT.setup,
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  remembered: SCENARIO_TEXT.remembered,
  codex: SCENARIO_TEXT.codex,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [FUNGAL_CAVE_ID],
  setAsideEnemies: [...SET_ASIDE_ENEMY_CODES],
  cavernLocationIds: [...CAVERN_LOCATION_IDS],
  horrorsCavernPoolIds: [...HORRORS_CAVERN_POOL_IDS],
  connectByGrid: CONNECTION_POLICY,
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  dayEncounterDecks: Object.freeze(Object.fromEntries(DAY_NUMBERS.map(day => [day, dayGroupCards(day)]))),
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  tokenMeanings: {
    easy: { ...THE_LOST_SISTER_TOKEN_MEANINGS.easy },
    standard: { ...THE_LOST_SISTER_TOKEN_MEANINGS.standard },
    hard: { ...THE_LOST_SISTER_TOKEN_MEANINGS.hard },
    expert: { ...THE_LOST_SISTER_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  REFERENCE_CODE, ...ACT_CODES, ...AGENDA_CODES,
  ...LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ENCOUNTER_DECK_CODES, ...SET_ASIDE_ENEMY_CODES, ...LIMULUS_CODES, ...CRUSTACEAN_CODES,
  ...Object.values(RESIDENT_ASSETS),
].map(code => [code, ALL_CARDS[code]])))
