// 亡命冰原 第 I 部分（iceAndDeathPart1 · 印刷参考卡 08501）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart1.hs +
//       Location/Act/Agenda/Enemy/CardDefs/EdgeOfTheEarth/IceAndDeath.hs +
//       Scenario/Scenarios/IceAndDeath/Helpers.hs（iceAndDeathLayout / camps / placeSetAsideConnectedLocations）。
// 卡号归属：本章条目目录只放 theCrash 组的 08518–08522（单章专用组）；
// 其余共用组（iceAndDeath / deadlyWeather / hazardsOfAntarctica / silenceAndMystery /
// tekelili / creaturesInTheIce）的条目在战役 shared 目录，由其它分片维护。
// 剧情正文来自 p2-flow 生成物 story-text.js（经 story-access.js 读取）；生成物未落地时
// safeChapterStory 兜底为空，章节结构/manifest 仍可 import。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed, SYMBOLS } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution, resolutionText } from '../../story-access.js'
import { PART1_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'iceAndDeathPart1'
export const REFERENCE_CODE = '08501'
export const ACT_CODES = ['08521']
export const AGENDA_CODES = ['08518', '08519', '08520']

export const GATHER_GROUPS = Object.freeze([
  'iceAndDeath', 'theCrash', 'deadlyWeather', 'hazardsOfAntarctica', 'silenceAndMystery',
])
export const GATHER_SET_ASIDE_GROUPS = Object.freeze(['creaturesInTheIce'])

// 印刷地点表（08502–08514）：[id, code, symbol, shelter]，顺序 = 剧本手册地图顺序。
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

// Haskell#iceAndDeathLayout：地点按印刷格放置；每个地点占两格，符号相同时即印刷连接。
// 这里按参考实现的地点卡「印刷连接符号」表生成连接（location.connections 为 id 数组）。
const PRINTED_LINKS = Object.freeze({
  crashSite: ['diamond', 'triangle', 'heart'],
  frozenShores: ['circle', 'triangle', 'heart', 'square'],
  treacherousPath: ['circle', 'diamond', 'heart', 'equals'],
  precariousIceSheet: ['circle', 'diamond', 'triangle', 'droplet'],
  broadSnowdrifts: ['diamond', 'hourglass', 'star', 'squiggle'],
  icyWastes: ['heart', 'star', 'moon', 'trefoil'],
  rockyCrags: ['triangle', 'hourglass', 'moon', 'plus'],
  snowGraves: ['square'],
  icebreakerLanding: ['droplet'],
  frigidCave: ['equals'],
  barrierCamp: ['droplet', 'equals'],
  remnantsOfLakesCamp: ['square', 'droplet'],
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

// 印刷坐标（Haskell iceAndDeathLayout 的格子 → 桌面像素坐标；每格 x=2/y=2）。
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

// 开局已在场的地点（Haskell placeAll）与开始地点。
export const START_LOCATION = 'crashSite'
export const INITIAL_LOCATION_IDS = Object.freeze(['crashSite', 'frozenShores', 'treacherousPath', 'precariousIceSheet'])
// 开局放在一边的「未探索」地点（Haskell setAside 的 Uncharted 地点）。
export const UNCHARTED_LOCATION_IDS = Object.freeze([
  'broadSnowdrifts', 'icyWastes', 'rockyCrags', 'snowGraves', 'icebreakerLanding',
  'frigidCave', 'barrierCamp', 'remnantsOfLakesCamp', 'crystallineCavern',
])
// 入口额外费用：进入未探索地点需共同花费的线索（印刷背面文本；[per_investigator]）。
export const UNCHARTED_ENTRY_COST = Object.freeze({
  broadSnowdrifts: 1, icyWastes: 1, rockyCrags: 1, snowGraves: 2, icebreakerLanding: 2,
  frigidCave: 2, barrierCamp: 4, remnantsOfLakesCamp: 4, crystallineCavern: 4,
})

const placeLocation = ([id, code, symbol, shelter]) => location({
  id, code, symbol, shelter, clues: ALL_CARDS[code]?.clues || 0,
  links: PRINTED_LINKS[id] || [],
})

export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id]) => [id, placeLocation(
  LOCATION_TABLE.find(row => row[0] === id))])))
for (const id of Object.keys(LOCATIONS)) LOCATIONS[id].connections = [...LOCATION_CONNECTIONS[id]]

// 遭遇牌库：gather 组里的敌人/诡计；creaturesInTheIce 是 gatherAndSetAside（先放一边，议程 I 背面洗入）。
const snake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const cardsOfGroups = groups => Object.entries(ALL_CARDS).filter(([, card]) =>
  groups.some(group => card.encounterCode === snake(group)))
const gatherCards = cardsOfGroups(GATHER_GROUPS)
const setAsideGroupCards = cardsOfGroups(GATHER_SET_ASIDE_GROUPS)
const deckCards = gatherCards.filter(([, card]) => ['enemy', 'treachery'].includes(card.type))
  .filter(([code]) => !['08515', '08522'].includes(code))
const definitions = encounterDefinitions([
  ...deckCards.map(([code]) => code),
  ...setAsideGroupCards.map(([code]) => code),
  '08522',
])
export const ENCOUNTER_DECK = Object.freeze(deckCards.flatMap(([code, card]) => Array(card.quantity || 1).fill(code)))
// 放一边的牌：疾行谬物×3、星之恐怖、冰中生物组（印刷份数展开）；未探索地点走 setAsideLocations。
export const SET_ASIDE_ALIASES = Object.freeze([
  ...Array(3).fill('08515'),
  '08522',
  ...setAsideGroupCards.flatMap(([code, card]) => Array(card.quantity || 1).fill(code)),
])
// 核心包的「远古恶魔」（Ancient Evils）遭遇组随本剧本 gather；不在 EotE 卡包里，按核心卡号展开。
export const SHARED_CORE_DECK = Object.freeze(['01166', '01166', '01166'])

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
  intro: blocks(SECTIONS.heading, SECTIONS.investigatorSetup, SECTIONS.intro,
    SECTIONS.intro1, SECTIONS.intro2, SECTIONS.intro3, SECTIONS.intro4),
  setup: text(SECTIONS.setup),
  resolutions: Object.freeze({
    noResolution: resolutionText(CHAPTER_ID, 'noResolution') || flattenResolution(SECTIONS.resolutions?.noResolution),
    resolution1: resolutionText(CHAPTER_ID, 'resolution1') || flattenResolution(SECTIONS.resolutions?.resolution1),
  }),
})

const actExtra = code => ({
  '08521': { chapterFlow: 'searchForACampSite', objective: { type: 'resign' } },
}[code] || {})
const agendaExtra = code => ({
  '08518': { chapterFlow: 'coldWelcome' },
  '08519': { chapterFlow: 'intoTheWhite' },
  '08520': { chapterFlow: 'runningOutOfTime' },
}[code] || {})

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '亡命冰原 第 I 部分 · Ice and Death, Part I',
  nameEn: 'Ice and Death, Part I',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: [...UNCHARTED_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  acts: ACT_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }), id: `act${index + 1}`, reveal: { type: 'campaignRule' }, ...actExtra(code),
  })),
  agendas: AGENDA_CODES.map((code, index) => ({
    ...stage(code, { number: index + 1 }), id: `agenda${index + 1}`, reveal: { type: 'campaignRule' }, ...agendaExtra(code),
  })),
  ...definitions,
  storyAssets: Object.fromEntries([...gatherCards, ...setAsideGroupCards]
    .filter(([, card]) => card.type === 'story')
    .map(([code]) => [code, { ...printed(code), global: true }])),
  storyFaces: Object.fromEntries(['08501'].map(code => [code, { ...printed(code), type: 'scenario' }])),
  encounterDeck: [...ENCOUNTER_DECK, ...SHARED_CORE_DECK],
  resolutions: {
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1 || '',
  },
  tokenMeanings: {
    easy: { ...PART1_TOKEN_MEANINGS.easy },
    standard: { ...PART1_TOKEN_MEANINGS.standard },
    hard: { ...PART1_TOKEN_MEANINGS.hard },
    expert: { ...PART1_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

// behavior.js 引用的印刷卡号集中放这里（内容流程不写卡号字面量的第二份来源）。
export const RAW_CODES = Object.freeze({
  agendaColdWelcome: '08518',
  agendaIntoTheWhite: '08519',
  agendaRunningOutOfTime: '08520',
  actSearchForACampSite: '08521',
  terrorOfTheStars: '08522',
  skitteringNonsense: '08515',
  tekeliliFaces: Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729']),
  tekeliliCopies: Object.freeze([3, 3, 2, 2, 2, 2, 2]),
})
