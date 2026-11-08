// 致命幻景（fatalMirage · 08549）· 章节数据。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/FatalMirage.hs +
//       Location/Act/Agenda/Enemy/Treachery/Asset/CardDefs/EdgeOfTheEarth/FatalMirage.hs。
// 三次可重入（版本 1/2/3）：首次是「幻景 1」；重入时按已完成次数切换密谋/幕版本，
// 并把上一轮发现的记忆（地点）与已放逐记忆（胜利区）带回来。剧情正文来自 story-access.js。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { FATAL_MIRAGE_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'fatalMirage'
export const REFERENCE_CODE = '08549'
// 三个版本：版本 = 第几次游玩致命幻景。
export const AGENDA_VERSION_CODES = Object.freeze({ 1: '08550', 2: '08551', 3: '08552' })
export const ACT_VERSION_CODES = Object.freeze({ 1: '08553', 2: '08554', 3: '08555' })

// 参考 Setup 共 gather 8 组（FatalMirage.hs:191-198）：本章 + 6 个 EotE 共享组 + 核心组 ChillingCold。
export const GATHER_GROUPS = Object.freeze([
  'fatalMirage', 'agentsOfTheUnknown', 'leftBehind', 'miasma',
  'namelessHorrors', 'silenceAndMystery', 'tekelili', 'chillingCold',
])

// 忒咳哩-哩（Tekeli-li!）牌库的 7 个卡面 × 印刷份数（3+3+2+2+2+2+2 = 16 张）。
// gather Tekeli-li 组后这 7 张弱点**不进入主遭遇牌库**，而是建立独立牌库（见 behavior.setupScenario）。
export const TEKELI_FACES = Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729'])
export const TEKELI_COPIES = Object.freeze(TEKELI_FACES.map(code => Number(ALL_CARDS[code]?.quantity) || 1))

// 印刷地点 08556–08574：符号 + 幻景层（tier，卡面「幻景N[per_investigator]」）。
export const LOCATION_TABLE = Object.freeze([
  ['prisonOfMemories', '08556', 'circle', 1], ['baseCamp', '08557', 'triangle', 1],
  ['deckOfTheTheodosia', '08558', 'triangle', 1], ['universityHalls', '08559', 'triangle', 1],
  ['hedgeMaze', '08560', 'diamond', 2], ['desertedStation', '08561', 'spade', 2],
  ['coastalWaters', '08562', 'square', 2], ['elderChamber', '08563', 'moon', 2],
  ['riverviewTheatre', '08564', 'trefoil', 2], ['standingStones', '08565', 'hourglass', 2],
  ['airfield', '08566', 'star', 2], ['alaskanWilds', '08567', 'heart', 2],
  ['clutteredDormitory', '08568', 't', 2], ['dyersClassroom', '08569', 'droplet', 2],
  ['infirmaryFatalMirage', '08570', 'squiggle', 2], ['drKenslersOffice', '08571', 'squiggle', 2],
  ['moaiStatues', '08572', 'equals', 2], ['ottomanFront', '08573', 'star', 2],
  ['theBlackStone', '08574', 'droplet', 2],
])

// Haskell#fatalMirageLayout（行列投影；相邻格互相连接）。
export const GRID = Object.freeze([
  '.  ottomanFront  .  desertedStation  alaskanWilds',
  'airfield  .  baseCamp  .  infirmaryFatalMirage',
  '.  coastalWaters  prisonOfMemories  riverviewTheatre  .',
  'moaiStatues  deckOfTheTheodosia  .  universityHalls  drKenslersOffice',
  '.  hedgeMaze  standingStones  elderChamber  clutteredDormitory',
  '.  dyersClassroom  .  theBlackStone  .',
])

function gridFacts(grid, table) {
  const ids = new Set(table.map(([id]) => id))
  const cells = []
  grid.forEach((line, row) => line.trim().split(/\s{2,}/).forEach((token, column) => {
    if (token && token !== '.' && ids.has(token)) cells.push({ token, row, column })
  }))
  const byId = Object.fromEntries(cells.map(cell => [cell.token, cell]))
  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1
  const coordinates = Object.fromEntries(cells.map(cell => [cell.token, { x: cell.column * 2, y: cell.row * 2 }]))
  const connections = Object.fromEntries(cells.map(cell => [cell.token,
    cells.filter(other => other.token !== cell.token && adjacent(cell, other)).map(other => other.token)]))
  return { coordinates, connections }
}

const facts = gridFacts(GRID, LOCATION_TABLE)
export const LOCATION_COORDINATES = Object.freeze(facts.coordinates)
export const LOCATION_CONNECTIONS = Object.freeze(facts.connections)

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, symbol, tier]) => {
  // 幻景地点没有未揭示面（指南「Mirage」特别规则），入场即揭示；印刷线索 = 每玩家基础值，
  // 入场时按「已入场/已放逐的目标数」逐项扣减（behavior.mirageClueTotal）。印刷事实取自卡表。
  const card = ALL_CARDS[code]
  // 记忆囚笼的帷幕是 X = 当前密谋编号（参考 withXShroud），运行时由 behavior.locationShroudModifier 给出。
  const shroud = id === 'prisonOfMemories' ? 0 : card.shroud
  const base = location({ id, code, symbol, shroud, cluesFixed: false, clues: Number(card.clues) || 0 })
  return [id, { ...base, symbol, mirage: tier, tier, storyCode: `${code}b`, connections: [...LOCATION_CONNECTIONS[id]] }]
})))

// 版本化的幕/议程阶段数据（参考 Setup：重入时只使用对应版本的幕/议程，其余移出游戏）。
// 阶段数据含 doomThreshold（15/13/11）与 stage（1a/2a/3a），由 cards-data 的印刷值生成。
export const AGENDA_STAGES = Object.freeze(Object.fromEntries(Object.entries(AGENDA_VERSION_CODES)
  .map(([version, code]) => [Number(version), Object.freeze(stage(code))])))
export const ACT_STAGES = Object.freeze(Object.fromEntries(Object.entries(ACT_VERSION_CODES)
  .map(([version, code]) => [Number(version), Object.freeze(stage(code))])))
export function agendaStageForVersion(version) { return structuredClone(AGENDA_STAGES[version] || AGENDA_STAGES[1]) }
export function actStageForVersion(version) { return structuredClone(ACT_STAGES[version] || ACT_STAGES[1]) }

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
  intro: blocks(SECTIONS.intro?.title, SECTIONS.intro?.body),
  intro2: blocks(SECTIONS.flavorText?.intro2?.body),
  setup: blocks(SECTIONS.setup?.body),
  resolutions: Object.freeze(Object.fromEntries(Object.entries(SECTIONS.resolutions || {})
    .map(([key, value]) => [key, flattenResolution(value)]))),
})

const groupCodes = Object.entries(ALL_CARDS)
  .filter(([, card]) => GATHER_GROUPS.some(group => card.encounterCode === group
    .replace(/([A-Z])/g, '_$1').toLowerCase()))
  .map(([code]) => code)
export const ENCOUNTER_DECK = Object.freeze(groupCodes.filter(code => {
  const card = ALL_CARDS[code]
  if (!['enemy', 'treachery'].includes(card.type)) return false
  if (/^0857[5-9]$/.test(code) || /^0858[0-3]$/.test(code)) return false // 记忆敌人放一边
  if (TEKELI_FACES.includes(code)) return false // 忒咳哩-哩弱点进独立牌库，不进主遭遇牌库
  return true
}))
export const MEMORY_ENEMY_CODES = Object.freeze(['08575', '08576', '08577', '08578', '08579', '08580', '08581', '08582', '08583'])
export const HORROR_SHADOW_CODE = '08584'
export const TREACHERY_CODES = Object.freeze(['08585', '08586'])
export const PARTNER_CODES = Object.freeze(['08587', '08588', '08589', '08590', '08591', '08592', '08593', '08594', '08595'])
export const MEMORY_STORY_CODES = Object.freeze(MEMORY_ENEMY_CODES.map(code => `${code}b`))
export const LOCATION_STORY_CODES = Object.freeze(LOCATION_TABLE.map(([, code]) => `${code}b`).filter(code => code !== '08556b'))
export const ALL_STORY_CODES = Object.freeze(['08556b', ...LOCATION_STORY_CODES, ...MEMORY_STORY_CODES])

// 遭遇定义：主遭遇牌库 + 放一边的记忆敌人（记忆敌人不洗进主牌库，但需要敌人定义供生成）。
const defs = encounterDefinitions([...ENCOUNTER_DECK, ...MEMORY_ENEMY_CODES])
const partnerDefs = Object.fromEntries(PARTNER_CODES.map(code => [code, { ...printed(code), global: true }]))
const storyDefs = Object.fromEntries(ALL_STORY_CODES.map(code => [code, { ...printed(code), global: true }]))

// 记忆（地点→记忆敌人→伙伴）关系：剧情卡背面决定「活着的伙伴」生成记忆敌人、被划掉则放逐。
export const MEMORY_LINKS = Object.freeze({
  alaskanWilds: { enemy: '08575', partner: '08589' },
  infirmaryFatalMirage: { enemy: '08576', partner: '08590' },
  airfield: { enemy: '08577', partner: '08595' },
  ottomanFront: { enemy: '08578', partner: '08592' },
  dyersClassroom: { enemy: '08579', partner: '08587' },
  clutteredDormitory: { enemy: '08580', partner: '08588' },
  theBlackStone: { enemy: '08581', partner: '08591' },
  moaiStatues: { enemy: '08582', partner: '08594' },
  drKenslersOffice: { enemy: '08583', partner: '08593' },
})
// 幻景层 2 地点由幻景层 1 剧情卡背面的三项选择之一揭示。
export const MIRAGE_CHOICES = Object.freeze({
  baseCamp: ['coastalWaters', 'desertedStation', 'riverviewTheatre'],
  deckOfTheTheodosia: ['coastalWaters', 'hedgeMaze', 'standingStones'],
  universityHalls: ['elderChamber', 'riverviewTheatre', 'standingStones'],
  airfield: ['alaskanWilds'],
  alaskanWilds: ['clutteredDormitory'],
  coastalWaters: ['airfield', 'ottomanFront'],
  elderChamber: ['clutteredDormitory'],
  riverviewTheatre: ['drKenslersOffice', 'infirmaryFatalMirage'],
  standingStones: ['theBlackStone', 'dyersClassroom'],
})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '致命幻景 · Fatal Mirage',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: 'prisonOfMemories',
  locations: LOCATIONS,
  setAsideLocations: LOCATION_TABLE.map(([id]) => id).filter(id => id !== 'prisonOfMemories'),
  acts: [{ ...actStageForVersion(1), chapterFlow: 'fatalMirage' }],
  agendas: [{ ...agendaStageForVersion(1), chapterFlow: 'fatalMirage' }],
  ...defs,
  storyAssets: { ...partnerDefs, ...storyDefs },
  encounterDeck: [...ENCOUNTER_DECK],
  resolutions: {
    victory: SCENARIO_TEXT.resolutions.victory || '',
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    defeat: SCENARIO_TEXT.resolutions.defeat || '',
  },
  tokenMeanings: {
    standard: { ...FATAL_MIRAGE_TOKEN_MEANINGS.standard }, hard: { ...FATAL_MIRAGE_TOKEN_MEANINGS.hard },
    easy: { ...FATAL_MIRAGE_TOKEN_MEANINGS.easy }, expert: { ...FATAL_MIRAGE_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const CARD_DATA = Object.freeze(Object.fromEntries(
  [...Object.values(AGENDA_VERSION_CODES), ...Object.values(ACT_VERSION_CODES),
    ...MEMORY_ENEMY_CODES, HORROR_SHADOW_CODE, ...TREACHERY_CODES, ...PARTNER_CODES,
    ...LOCATION_TABLE.map(([, code]) => code)].map(code => [code, ALL_CARDS[code]])))
