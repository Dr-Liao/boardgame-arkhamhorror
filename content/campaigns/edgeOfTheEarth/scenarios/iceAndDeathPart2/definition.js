// 亡命冰原 第 II 部分（iceAndDeathPart2 · 印刷参考卡 08501）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart2.hs +
//       Enemy/Story/CardDefs/EdgeOfTheEarth/IceAndDeath.hs + Scenario/Scenarios/IceAndDeath/Helpers.hs。
// 卡号归属：本章条目目录放 lostInTheNight 组全部 08523–08543（单章专用组：议程/幕/剧情/被附身队员）。
// 其余共用组（iceAndDeath / leftBehind / deadlyWeather / hazardsOfAntarctica / silenceAndMystery /
// tekelili / ancientEvils）的条目由其它分片维护；本章只在 definition 里引用其牌库内容。
// 剧情正文来自 p2-flow 生成物 story-text.js（经 story-access.js 读取），缺失时安全兜底为空。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution, resolutionText } from '../../story-access.js'
import { PART2_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'iceAndDeathPart2'
export const REFERENCE_CODE = '08501'
export const ACT_CODES = ['08526']
export const AGENDA_CODES = ['08523', '08524', '08525']

export const GATHER_GROUPS = Object.freeze([
  'iceAndDeath', 'lostInTheNight', 'leftBehind', 'deadlyWeather', 'hazardsOfAntarctica', 'silenceAndMystery',
])
export const SET_ASIDE_GROUPS = Object.freeze(['lostInTheNight'])

// 印刷地点表（08502–08514；Part1/Part2 共用同一张地图数据）。
export const LOCATION_TABLE = Object.freeze([
  ['crashSite', '08502', 'circle', 0],
  ['frozenShores', '08503', 'diamond', 2],
  ['treacherousPath', '08504', 'triangle', 1],
  ['precariousIceSheet', '08505', 'heart', 2],
  ['broadSnowdrifts', '08506', 'square', 4],
  ['icyWastes', '08507', 'droplet', 4],
  ['rockyCrags', '08508', 'equals', 3],
  ['snowGraves', '08509', 'squiggle', 5],
  ['icebreakerLanding', '08510', 'trefoil', 5],
  ['frigidCave', '08511', 'plus', 6],
  ['barrierCamp', '08512', 'moon', 7],
  ['remnantsOfLakesCamp', '08513', 'star', 7],
  ['crystallineCavern', '08514', 'hourglass', 8],
])

const PRINTED_LINKS = Object.freeze({
  crashSite: ['diamond', 'triangle', 'heart'],
  frozenShores: ['circle', 'triangle', 'heart', 'square'],
  treacherousPath: ['circle', 'diamond', 'heart', 'equals'],
  precariousIceSheet: ['circle', 'diamond', 'triangle', 'droplet'],
  broadSnowdrifts: ['diamond', 'hourglass', 'star', 'squiggle'],
  icyWastes: ['heart', 'star', 'moon', 'trefoil'],
  rockyCrags: ['triangle', 'hourglass', 'moon', 'plus'],
  snowGraves: ['square'], icebreakerLanding: ['droplet'], frigidCave: ['equals'],
  barrierCamp: ['droplet', 'equals'], remnantsOfLakesCamp: ['square', 'droplet'],
  crystallineCavern: ['equals', 'square'],
})
const symbolOfId = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [id, symbol]))
const idOfSymbol = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [symbol, id]))
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id]) => {
  const forward = (PRINTED_LINKS[id] || []).map(symbol => idOfSymbol[symbol]).filter(Boolean)
  const reverse = LOCATION_TABLE.filter(([other]) => (PRINTED_LINKS[other] || []).includes(symbolOfId[id]))
    .map(([other]) => other)
  return [id, [...new Set([...forward, ...reverse])]]
})))

const SYMBOL_POINTS = Object.freeze({
  trefoil: { x: 0, y: 0 }, plus: { x: 12, y: 0 },
  moon: { x: 6, y: 2 }, droplet: { x: 2, y: 4 }, equals: { x: 10, y: 4 },
  heart: { x: 4, y: 8 }, triangle: { x: 8, y: 8 },
  circle: { x: 6, y: 12 }, star: { x: 2, y: 14 }, hourglass: { x: 10, y: 14 },
  diamond: { x: 6, y: 16 }, square: { x: 6, y: 20 }, squiggle: { x: 6, y: 24 },
})
export const LOCATION_COORDINATES = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => {
  const point = SYMBOL_POINTS[symbol] || { x: 0, y: 0 }
  return [id, { ...point }]
})))

export const UNCHARTED_LOCATION_IDS = Object.freeze([
  'broadSnowdrifts', 'icyWastes', 'rockyCrags', 'snowGraves', 'icebreakerLanding',
  'frigidCave', 'barrierCamp', 'remnantsOfLakesCamp', 'crystallineCavern',
])
// 营地记录 → 地点 id（Part1 结局记录 `camp`；Part3 续用同一记录键）。
export const CAMP_IDS = Object.freeze(LOCATION_TABLE.map(([id]) => id))
export const DEFAULT_CAMP = 'crashSite'

const placeLocation = ([id, code, symbol, shelter]) => location({
  id, code, symbol, shelter, clues: ALL_CARDS[code]?.clues || 0,
  links: PRINTED_LINKS[id] || [],
})
export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id]) => [id, placeLocation(
  LOCATION_TABLE.find(row => row[0] === id))])))
for (const id of Object.keys(LOCATIONS)) LOCATIONS[id].connections = [...LOCATION_CONNECTIONS[id]]

// 被附身的队员：队员支援卡号 → 被附身敌人卡号（Haskell#possessedMap）。
export const POSSESSED_PARTNERS = Object.freeze([
  ['08714', '08535'], ['08715', '08536'], ['08716', '08537'], ['08717', '08538'], ['08718', '08539'],
  ['08719', '08540'], ['08720', '08541'], ['08721', '08542'], ['08722', '08543'],
])
export const POSSESSED_ENEMY_CODES = Object.freeze(POSSESSED_PARTNERS.map(([, enemy]) => enemy))
export const STORY_CODES = Object.freeze(['08527', '08528', '08529', '08530', '08531', '08532', '08533', '08534'])

const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => Object.entries(ALL_CARDS).filter(([, card]) =>
  groups.some(group => card.encounterCode === snake(group)))
const gatherCards = cardsOfGroups(GATHER_GROUPS)
const deckCards = gatherCards
  .filter(([, card]) => ['enemy', 'treachery'].includes(card.type))
  .filter(([code]) => !POSSESSED_ENEMY_CODES.includes(code))
const definitions = encounterDefinitions([
  ...deckCards.map(([code]) => code),
  ...POSSESSED_ENEMY_CODES,
  ...STORY_CODES,
])
export const ENCOUNTER_DECK = Object.freeze(deckCards.flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))
export const SHARED_CORE_DECK = Object.freeze(['01166', '01166', '01166'])
// 放一边：被附身的队员敌人（Mia 的队员）+ 8 张背面剧情卡（Haskell Setup：setAside $ mia <> stories）。
export const SET_ASIDE_ALIASES = Object.freeze([...POSSESSED_ENEMY_CODES, ...STORY_CODES])

const safeChapterStory = id => {
  try { return chapterStory(id) } catch { return { sections: { resolutions: {} } } }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sections || {}
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  intro: blocks(SECTIONS.heading, SECTIONS.investigatorSetup, SECTIONS.intro),
  setup: text(SECTIONS.setup),
  resolutions: Object.freeze({
    noResolution: resolutionText(CHAPTER_ID, 'noResolution') || flattenResolution(SECTIONS.resolutions?.noResolution),
    resolution1: resolutionText(CHAPTER_ID, 'resolution1') || flattenResolution(SECTIONS.resolutions?.resolution1),
  }),
})

const actExtra = code => ({
  '08526': {
    chapterFlow: 'theLostExpedition', objective: { type: 'rescuePartners' },
    freeAction: { rule: 'drawUnderLocation', sameLocation: true },
    action: { rule: 'campResign' },
  },
}[code] || {})
const agendaExtra = code => ({
  '08523': { chapterFlow: 'aHarshWindBlows' },
  '08524': { chapterFlow: 'theChillOfNight' },
  '08525': { chapterFlow: 'madnessAndDeath' },
}[code] || {})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '亡命冰原 第 II 部分 · Ice and Death, Part II',
  nameEn: 'Ice and Death, Part II',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: DEFAULT_CAMP,
  locations: LOCATIONS,
  setAsideLocations: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  acts: ACT_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }), id: `act${index + 1}`, reveal: { type: 'campaignRule' }, ...actExtra(code),
  })),
  agendas: AGENDA_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }), id: `agenda${index + 1}`, reveal: { type: 'campaignRule' }, ...agendaExtra(code),
  })),
  ...definitions,
  storyAssets: Object.fromEntries(STORY_CODES.map(code => [code, { ...printed(code), global: true }])),
  storyFaces: Object.fromEntries(['08501'].map(code => [code, { ...printed(code), type: 'scenario' }])),
  encounterDeck: [...ENCOUNTER_DECK, ...SHARED_CORE_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1 || '',
  },
  tokenMeanings: {
    easy: { ...PART2_TOKEN_MEANINGS.easy },
    standard: { ...PART2_TOKEN_MEANINGS.standard },
    hard: { ...PART2_TOKEN_MEANINGS.hard },
    expert: { ...PART2_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const RAW_CODES = Object.freeze({
  agendaHarshWind: '08523',
  agendaChillOfNight: '08524',
  agendaMadnessAndDeath: '08525',
  actLostExpedition: '08526',
  possessedPartners: POSSESSED_PARTNERS,
  storyCodes: STORY_CODES,
  tekeliliFaces: Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729']),
  tekeliliCopies: Object.freeze([3, 3, 2, 2, 2, 2, 2]),
})
