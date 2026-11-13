// 死亡酷暑（deadHeat · 提示卡 09520，马拉喀什）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/TheScarletKeys/DeadHeat.hs +
//       Act/Agenda/Location/Enemy/Treachery/Story/CardDefs/TheScarletKeys/DeadHeat.hs +
//       Campaigns/TheScarletKeys/Key/Cards/TheLastBlossom.hs +
//       frontend/src/locales/{en,zh}/theScarletKeys/scenarios/deadHeat.json。
//
// 卡号归属（audit/tsk-scope.json#chapters[deadHeat]）：09520–09544b 共 28 条记录，
// 本章专属组 deadHeat（遭遇组 dead_heat）。地点/幕/议程/scenario 按批次约定不建单卡条目，
// 地点规则与剧本流程在 behavior.js；enemy/treachery/story/key 单卡条目在
// src/cards/encounter-entries/theScarletKeys/deadHeat/。
//
// 剧情正文来自内容生成物 story-text.js（经 story-access.js 读取）；生成物缺失时
// safeChapterStory 兜底为空，章节结构/manifest 仍可 import。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { DEAD_HEAT_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'deadHeat'
export const REFERENCE_CODE = '09520'

// 幕/议程牌库：幕 1 只在时间 < 15 时使用（参考 Setup「Check the Campaign Log and build
// the act and/or agenda decks accordingly」）；议程牌库固定两张。
export const ACT_CODES = Object.freeze(['09523', '09524', '09525'])
export const AGENDA_CODES = Object.freeze(['09521', '09522'])
// 2026-11-13 P1-11：废弃版杰马广场（09532）的地点卡号单独命名，behavior 用常量比较，
// 不要新增 `code === '0xxxx'` 硬编码分支（architecture-guard 的 content 分支守卫）。
export const JEMAA_EL_FNAA_ABANDONED_CODE = '09532'
// 阶段号 → 卡号（幕 1/2/3、议程 1/2）；时间分支会移除幕 1，因此按卡号而不是数组下标查。
export const ACT_CODE_BY_STAGE = Object.freeze({ 1: ACT_CODES[0], 2: ACT_CODES[1], 3: ACT_CODES[2] })
export const AGENDA_CODE_BY_STAGE = Object.freeze({ 1: AGENDA_CODES[0], 2: AGENDA_CODES[1] })

// 参考 Setup 的 5 个 gather 组（Dead Heat / Scarlet Sorcery / Spreading Corruption / Ghouls /
// Striking Fear）。Striking Fear 按参考实现只取子集（01164/01165），见 EXTERNAL_ENCOUNTER_DEPENDENCIES。
export const GATHER_GROUPS = Object.freeze([
  'deadHeat', 'ghouls', 'scarletSorcery', 'spreadingCorruption', 'strikingFear',
])
// 本章没有「整组收集后整体放一边」的遭遇组：放一边的是 DeadHeat 组的个别卡（见 SET_ASIDE_CARDS）。
// 保留常量以统一各章 definition 形状（死亡冰原等章节用它对整组放一边）。
export const GATHER_SET_ASIDE_GROUPS = Object.freeze([])

export const START_LOCATION = 'marrakeshRailwayStation'
export const RITUAL_SITE_ID = 'bahiaPalaceGardens'
// 苏生死者生成点：鞣革厂正面 [fast] 从遭遇弃牌堆生成[[苏生]]敌人并按生命值放线索。
export const RISEN_SPAWN_SITE = 'tanneries'
// 平民/杀害计数区域：地点资源 = 平民；杀害计数与获救计数记在剧本标记上（剧本提示卡旁）。
export const CIVILIAN_TRACK = Object.freeze({
  locationResource: 'resources',
  slainFlag: 'deadHeatCiviliansSlain',
  rescuedFlag: 'deadHeatRescued',
  basePerLocation: 'investigators + 1',
})

// 五处马拉喀什地点（普通 + 废弃版本）：符号/连接取参考 Location/CardDefs 的印刷连接符号。
// symbol 同时写进 definition（桌面坐标/连线展示与 manifest 使用）；connections 只写普通地点，
// 废弃版本入场时由 behavior.syncConnections 按「当前在场」的相邻地点重算。
export const LOCATION_TABLE = Object.freeze([
  // [id, code, symbol, printedLinks, clues, abandonedId, abandonedCode, abandonedLinks, abandonedShroud]
  ['saadiansTombs', '09528', 'heart', ['squiggle', 'diamond'], 3, 'saadiansTombsAbandoned', '09533', ['squiggle', 'diamond'], 5],
  ['marrakeshRailwayStation', '09526', 'squiggle', ['heart', 'square', 'diamond'], 0, 'marrakeshRailwayStationAbandoned', '09531', ['heart', 'square', 'diamond'], 2],
  ['bahiaPalaceGardens', '09530', 'square', ['squiggle', 'triangle'], 2, 'bahiaPalaceGardensAbandoned', '09535', ['squiggle', 'triangle'], 4],
  ['jemaaElFnaaSquare', '09527', 'diamond', ['squiggle', 'heart', 'triangle'], 3, 'jemaaElFnaaSquareAbandoned', '09532', ['squiggle', 'heart', 'triangle'], 4],
  ['tanneries', '09529', 'triangle', ['diamond', 'square'], 1, 'tanneriesAbandoned', '09534', ['diamond', 'square'], 3],
])

const NORMAL_LOCATION_IDS = LOCATION_TABLE.map(([id]) => id)
const ABANDONED_BY_NORMAL = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , , , , abandoned]) => [id, abandoned])))
const NORMAL_BY_ABANDONED = Object.freeze(Object.fromEntries(Object.entries(ABANDONED_BY_NORMAL).map(([normal, abandoned]) => [abandoned, normal])))
export const SITE_IDS = Object.freeze([...NORMAL_LOCATION_IDS])
export const ABANDONED_LOCATION_IDS = Object.freeze(LOCATION_TABLE.map(([, , , , , abandoned]) => abandoned))
export { ABANDONED_BY_NORMAL, NORMAL_BY_ABANDONED }

const symbolById = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [id, symbol]))
const normalIdOfSymbol = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [symbol, id]))

// 普通地点的印刷连接（按符号反查）；废弃版本由 behavior 在入场时同步为「当前在场的相邻地点」。
function printedConnections(links) {
  return links.map(symbol => normalIdOfSymbol[symbol]).filter(Boolean)
}
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(
  LOCATION_TABLE.map(([id, , , links]) => [id, printedConnections(links)]),
))

function makeLocation([id, code, symbol, links, clues], extra = {}) {
  return location({
    id, code, symbol, cluesFixed: true, clues,
    links: [...links], ...extra,
  })
}

export const LOCATIONS = Object.freeze(Object.fromEntries([
  ...LOCATION_TABLE.map(row => {
    const [id, , , links] = row
    const extra = { connections: printedConnections(links) }
    if (id === START_LOCATION) extra.resign = true
    return [id, makeLocation(row, extra)]
  }),
  ...LOCATION_TABLE.map(row => {
    const [, , , , , abandonedId, abandonedCode, abandonedLinks] = row
    // 废弃版本：线索 0、帷幕取印刷值（location() 会复制 shroud），连接由 behavior 同步。
    const base = location({
      id: abandonedId, code: abandonedCode, symbol: row[2], cluesFixed: true, clues: 0,
      links: [...abandonedLinks], connections: [],
    })
    if (abandonedId === 'marrakeshRailwayStationAbandoned') base.resign = true
    base.abandoned = true
    return [abandonedId, base]
  }),
]))

// 桌面坐标：Haskell#deadHeatLayout 两行网格（heart/squiggle/square 与 . /diamond/triangle）。
// 废弃版本与普通版本共用同一格（同一地点被替换，不同时在场）。
const SYMBOL_POINTS = Object.freeze({
  heart: { x: 0, y: 0 }, squiggle: { x: 2, y: 0 }, square: { x: 4, y: 0 },
  diamond: { x: 2, y: 2 }, triangle: { x: 4, y: 2 },
})
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries([
  ...LOCATION_TABLE.map(([id, , symbol]) => [id, { ...(SYMBOL_POINTS[symbol] || { x: 0, y: 0 }) }]),
  ...LOCATION_TABLE.map(([, , symbol, , , abandonedId]) => [abandonedId, { ...(SYMBOL_POINTS[symbol] || { x: 0, y: 0 }) }]),
]))

// 放一边的卡（卡号按物理份数展开）：双面苋、拉辛·法瑞、哈立德、古代劫掠者×2、
// 末绽之花（09544a/09544b 同一张物理卡）、拯救平民/后果剧情卡。
export const SET_ASIDE_ENEMY_CODES = Object.freeze(['09537', '09537b', '09538', '09540', '09541'])
export const SET_ASIDE_CARDS = Object.freeze([
  '09537', '09538', '09540', '09540', '09541', '09544a', '09536',
])
export const AMARANTH_CODES = Object.freeze(['09537', '09537b'])
export const AMARANTH_FRONT_CODE = '09537'
export const AMARANTH_BACK_CODE = '09537b'
export const RAZIN_CODE = '09538'
export const THRALL_CODE = '09539'
export const ANCIENT_RAIDER_CODE = '09540'
export const KHALID_CODE = '09541'
export const FAMINE_CODE = '09542'
export const CORNERED_CODE = '09543'
export const SAVE_THE_CIVILIANS_CODE = '09536'
export const AFTERMATH_CODE = '09536b'
export const STORY_CODES = Object.freeze([SAVE_THE_CIVILIANS_CODE, AFTERMATH_CODE])
// 绯红密钥（物理 09544，稳定面 09544a / 动荡面 09544b）。
export const KEY_SPEC = Object.freeze({ id: '09544', stableFace: '09544a', unstableFace: '09544b' })
export const KEY_CARD_CODES = Object.freeze(['09544a', '09544b'])

// 遭遇牌库：gather 组里的敌人/诡计（放一边的剧本敌人不进牌库），按印刷份数展开。
// Striking Fear 只取参考实现 gather 的子集（01164/01165）。
const STRIKING_FEAR_SUBSET = new Set(['01164', '01165'])
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => Object.entries(ALL_CARDS).filter(([, card]) =>
  groups.some(group => card.encounterCode === snake(group)))
const gatherCards = cardsOfGroups(GATHER_GROUPS)
const deckCards = gatherCards.filter(([code, card]) => {
  if (!['enemy', 'treachery'].includes(card.type)) return false
  if (SET_ASIDE_ENEMY_CODES.includes(code)) return false
  if (card.encounterCode === 'striking_fear' && !STRIKING_FEAR_SUBSET.has(code)) return false
  return true
})
export const ENCOUNTER_DECK = Object.freeze(deckCards
  .flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))
export const ENCOUNTER_DECK_CODES = Object.freeze([...new Set(ENCOUNTER_DECK)])

// 遭遇定义：牌库卡 + 放一边的敌人 + 剧情卡（09536 的正面；背面 09536b 只作为翻面数据）。
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES,
  ...SET_ASIDE_ENEMY_CODES,
  SAVE_THE_CIVILIANS_CODE,
])

// 幕/议程阶段数据。幕 1「找到苋」按轮末共同支付线索推进（objective.clues + behavior.roundEndActIndex）；
// 幕 2/3 的推进由 behavior 的强制效果/目标判定（平民杀害计数、苋或拉辛是否在场）驱动。
export const ACT_STAGES = Object.freeze({
  1: Object.freeze({ ...stage(ACT_CODE_BY_STAGE[1]), objective: { type: 'clues', perInvestigator: 2, atLocation: RITUAL_SITE_ID } }),
  2: Object.freeze(stage(ACT_CODE_BY_STAGE[2])),
  3: Object.freeze(stage(ACT_CODE_BY_STAGE[3])),
})
export const AGENDA_STAGES = Object.freeze({
  1: Object.freeze(stage(AGENDA_CODE_BY_STAGE[1])),
  2: Object.freeze(stage(AGENDA_CODE_BY_STAGE[2])),
})
// scenario 里的幕/议程实例必须是可变副本：identities.js 会把原卡身份写回定义对象。
export const ACTS = Object.freeze([1, 2, 3].map(number => structuredClone(ACT_STAGES[number])))
export const AGENDAS = Object.freeze([1, 2].map(number => structuredClone(AGENDA_STAGES[number])))

const safeChapterStory = id => {
  try {
    return chapterStory(id)
  } catch {
    return { sections: { resolutions: {} } }
  }
}
const SECTIONS = safeChapterStory(CHAPTER_ID).sections || {}
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')
export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN', textStatus: 'translated (self-translated)',
  heading: text(SECTIONS.heading),
  intro: blocks(SECTIONS.intro?.title, SECTIONS.intro?.intro1),
  introBranches: Object.freeze({
    lessThan15: text(SECTIONS.intro?.intro2),
    between15And24: text(SECTIONS.intro?.intro3),
    moreThan24: text(SECTIONS.intro?.intro4),
  }),
  setup: blocks(SECTIONS.setup),
  specialRules: Object.freeze((SECTIONS.specialRules || []).map(rule => ({
    title: text(rule?.title), body: text(rule?.body),
  })).filter(rule => rule.title || rule.body)),
  rules: Object.freeze({
    civilians: { title: text(SECTIONS.rules?.civilians?.title), body: text(SECTIONS.rules?.civilians?.body) },
    choosingARandomLocation: { title: text(SECTIONS.rules?.choosingARandomLocation?.title), body: text(SECTIONS.rules?.choosingARandomLocation?.body) },
    replacingLocations: { title: text(SECTIONS.rules?.replacingLocations?.title), body: text(SECTIONS.rules?.replacingLocations?.body) },
  }),
  resolutions: Object.freeze(Object.fromEntries(Object.entries(SECTIONS.resolutions || {})
    .map(([key, value]) => [key, flattenResolution(value)]))),
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '死亡酷暑 · Dead Heat',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  specialRules: SCENARIO_TEXT.specialRules,
  rules: SCENARIO_TEXT.rules,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...ABANDONED_LOCATION_IDS],
  acts: ACTS,
  agendas: AGENDAS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1 || '',
    resolution2: SCENARIO_TEXT.resolutions.resolution2 || '',
    resolution3: SCENARIO_TEXT.resolutions.resolution3 || '',
    resolution4: SCENARIO_TEXT.resolutions.resolution4 || '',
    resolution5: SCENARIO_TEXT.resolutions.resolution5 || '',
  },
  tokenMeanings: {
    easy: { ...DEAD_HEAT_TOKEN_MEANINGS.easy }, standard: { ...DEAD_HEAT_TOKEN_MEANINGS.standard },
    hard: { ...DEAD_HEAT_TOKEN_MEANINGS.hard }, expert: { ...DEAD_HEAT_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries([
  '09520', '09521', '09522', '09523', '09524', '09525',
  ...NORMAL_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...ABANDONED_LOCATION_IDS.map(id => LOCATIONS[id].code),
  ...STORY_CODES, ...SET_ASIDE_ENEMY_CODES, THRALL_CODE, FAMINE_CODE, CORNERED_CODE, ...KEY_CARD_CODES,
].map(code => [code, ALL_CARDS[code]])))
