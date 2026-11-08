// 亡命冰原 III（iceAndDeathPart3 · 印刷参考卡 08501）· 章节数据（scenario 只含数据）。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart3.hs +
//       Location/Act/Agenda/Enemy/Treachery/CardDefs/EdgeOfTheEarth/IceAndDeath.hs。
// 卡号归属：本章条目目录只收 seepingNightmares 组的 08544–08548（单章专用组）；
// 其余共用组（iceAndDeath/creaturesInTheIce/...）的条目在战役 shared 目录，由其它分片维护。
// 剧情正文来自 p2-flow 生成物 story-access.js；生成物尚未落地时由 safeChapterStory 兜底为空，
// 测试只断言结构可读，正文断言等 p2-flow 就绪后补。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'
import { location, stage, encounterDefinitions, identitiesFor, printed } from '../../card-data.js'
import { chapterStory, flattenStory, flattenResolution } from '../../story-access.js'
import { PART3_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'iceAndDeathPart3'
export const REFERENCE_CODE = '08501'
export const ACT_CODES = ['08546']
export const AGENDA_CODES = ['08544', '08545']

export const GATHER_GROUPS = Object.freeze([
  'iceAndDeath', 'seepingNightmares', 'creaturesInTheIce', 'deadlyWeather',
  'hazardsOfAntarctica', 'silenceAndMystery', 'tekelili',
])
export const SET_ASIDE_GROUPS = Object.freeze(['seepingNightmares'])

// 营地候选：检查点记录里的营地可以是《亡命冰原》13 个地点中的任何一个
// （Part I 的幕 1 目标让调查队在任意无线索地点扎营），不能只认开局 4 个。
export const CAMPS = Object.freeze([
  'crashSite', 'frozenShores', 'treacherousPath', 'precariousIceSheet', 'broadSnowdrifts', 'icyWastes',
  'rockyCrags', 'snowGraves', 'icebreakerLanding', 'frigidCave', 'barrierCamp', 'remnantsOfLakesCamp',
  'crystallineCavern',
])
export const DEFAULT_CAMP = 'crashSite'

// 印刷地点（08502–08514）、符号与印刷庇护值（与 Part I/II 同一张冰原地图）。
export const LOCATION_TABLE = Object.freeze([
  ['crashSite', '08502', 'circle', 0], ['frozenShores', '08503', 'diamond', 2],
  ['treacherousPath', '08504', 'triangle', 1], ['precariousIceSheet', '08505', 'heart', 2],
  ['broadSnowdrifts', '08506', 'square', 4], ['icyWastes', '08507', 'droplet', 4],
  ['rockyCrags', '08508', 'equals', 3], ['snowGraves', '08509', 'squiggle', 5],
  ['icebreakerLanding', '08510', 'trefoil', 5], ['frigidCave', '08511', 'plus', 6],
  ['barrierCamp', '08512', 'moon', 7], ['remnantsOfLakesCamp', '08513', 'star', 7],
  ['crystallineCavern', '08514', 'hourglass', 8],
])

// Haskell#iceAndDeathLayout（坐标投影；符号在阵列中的位置决定桌面坐标）。
export const GRID = Object.freeze([
  'trefoil  .  .  .  .  .  plus',
  'trefoil  .  .  .  moon  .  .  plus',
  '.  droplet  .  .  moon  .  equals  .',
  '.  droplet  .  .  .  .  equals  .',
  '.  .  heart  .  triangle  .  .  .',
  '.  .  heart  .  triangle  .  .  .',
  '.  .  .  circle  .  .  .  .',
  '.  .  star  .  circle  .  .  hourglass  .',
  '.  .  star  .  .  .  .  hourglass  .',
  '.  .  .  diamond  .  .  .  .',
  '.  .  .  diamond  .  .  .  .',
  '.  .  .  square  .  .  .  .',
  '.  .  .  square  .  .  .  .',
  '.  .  .  squiggle  .  .  .  .',
])

// 印刷连接表（Haskell Location/CardDefs/IceAndDeath.hs 的 symbol 连接）。
export const LOCATION_LINKS = Object.freeze({
  circle: ['diamond', 'triangle', 'heart'], diamond: ['circle', 'triangle', 'heart', 'square'],
  triangle: ['circle', 'diamond', 'heart', 'equals'], heart: ['circle', 'diamond', 'triangle', 'droplet'],
  square: ['diamond', 'hourglass', 'star', 'squiggle'], droplet: ['heart', 'star', 'moon', 'trefoil'],
  equals: ['triangle', 'hourglass', 'moon', 'plus'], squiggle: ['square'],
  trefoil: ['droplet'], plus: ['equals'], moon: ['droplet', 'equals'],
  star: ['square', 'droplet'], hourglass: ['equals', 'square'],
})

const idOfSymbol = Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) => [symbol, id]))
const coordinates = {}
GRID.forEach((line, row) => line.trim().split(/\s{2,}/).forEach((token, column) => {
  if (token && token !== '.' && idOfSymbol[token] && !coordinates[idOfSymbol[token]]) {
    coordinates[idOfSymbol[token]] = { x: column * 2, y: row * 2 }
  }
}))
export const LOCATION_COORDINATES = Object.freeze(coordinates)
export const LOCATION_CONNECTIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, , symbol]) =>
  [id, (LOCATION_LINKS[symbol] || []).map(link => idOfSymbol[link]).filter(Boolean)])))


export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, symbol, shelter]) => {
  // 线索按印刷值（每调查员）进入地点数据；shroud/shelter 由 card-data 与印刷表补齐。
  const base = location({ id, code, symbol, shelter, clues: ALL_CARDS[code]?.clues || 0 })
  return [id, { ...base, connections: [...LOCATION_CONNECTIONS[id]], symbol }]
})))

const safeChapterStory = id => {
  try {
    return chapterStory(id)
  } catch {
    // story-text 生成物尚未落地（p2-flow 负责）；章节结构、manifest 必须仍可 import。
    return { sections: { resolutions: {} } }
  }
}
const STORY = safeChapterStory(CHAPTER_ID)
const SECTIONS = STORY.sections || {}
const text = value => flattenStory(value)
const blocks = (...parts) => parts.map(text).filter(Boolean).join('\n\n')

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  intro: text(SECTIONS.intro),
  setup: text(SECTIONS.setup),
  resolutions: Object.freeze(Object.fromEntries(Object.entries(SECTIONS.resolutions || {})
    .map(([key, value]) => [key, flattenResolution(value)]))),
})

const ACT_EXTRA = Object.freeze({
  '08546': { chapterFlow: 'breakTheSiege', objective: { type: 'noEidolonEnemies' } },
})
const AGENDA_EXTRA = Object.freeze({
  '08544': { chapterFlow: 'seepingNightmares' },
  '08545': {},
})

const toSnake = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const groupCodes = Object.entries(ALL_CARDS).filter(([, card]) =>
  GATHER_GROUPS.some(group => card.encounterCode === toSnake(group)))
const expand = entries => entries.flatMap(([code, card]) => Array(card.quantity || 1).fill(code))
const traitsOfCard = card => (card.traits || []).map(trait => String(trait).toLowerCase())
// 印刷布置：8 张幻灵敌人来自 Ice and Death（疾行谬物 ×3）与 Creatures in the Ice（×5），
// 洗混后正面朝下均分压在渗出梦魇底下；渗出梦魇本身不是「底下的幻灵」。
const seepingGroupCodes = groupCodes.filter(([, card]) => card.encounterCode === 'seeping_nightmares')
const seepingNightmareEntry = seepingGroupCodes.find(([, card]) => card.type === 'enemy')
export const SEEDING_NIGHTMARE_CODE = seepingNightmareEntry?.[0] || '08547'
export const SEEDING_NIGHTMARE_COPIES = seepingNightmareEntry?.[1].quantity || 4
const eidolonEntries = groupCodes.filter(([, card]) => card.type === 'enemy'
  && traitsOfCard(card).includes('eidolon') && card.encounterCode !== 'seeping_nightmares')
const eidolonCodeSet = new Set(eidolonEntries.map(([code]) => code))
export const EIDOLON_ENEMY_CODES = Object.freeze(expand(eidolonEntries))
const storyCodes = groupCodes.filter(([, card]) => card.type === 'story').map(([code]) => code)
// 遭遇牌库：gather 组的敌人/诡计，但去掉「幻灵敌人」（压在渗出梦魇底下）、
// 渗出梦魇本体（按人数生成、其余移出游戏）与忒咳哩-哩组（独立弱点牌库）。
const deckEntries = groupCodes.filter(([, card]) => ['enemy', 'treachery'].includes(card.type)
  && card.encounterCode !== 'tekelili' && card.encounterCode !== 'seeping_nightmares'
  && !eidolonCodeSet.has(card.code))
export const ENCOUNTER_DECK = Object.freeze(expand(deckEntries))
// 核心包的「远古恶魔」（Ancient Evils）遭遇组随本剧本 gather（与 Part I/II 同一口径）。
export const SHARED_CORE_DECK = Object.freeze(['01166', '01166', '01166'])
const definitionCodes = [...new Set(groupCodes
  .filter(([, card]) => ['enemy', 'treachery'].includes(card.type) && card.encounterCode !== 'tekelili')
  .map(([code]) => code))]
const definitions = encounterDefinitions(definitionCodes)

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: '亡命冰原 第 III 部分 · Ice and Death, Part III',
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setup,
  startLocation: DEFAULT_CAMP,
  locations: LOCATIONS,
  setAsideLocations: [],
  acts: ACT_CODES.map(code => stage(code)).map(act => ({ ...act, reveal: { type: 'campaignRule' }, ...(ACT_EXTRA[act.originalCode] || {}) })),
  agendas: AGENDA_CODES.map(code => stage(code)).map(agenda => ({ ...agenda, reveal: { type: 'campaignRule' }, ...(AGENDA_EXTRA[agenda.originalCode] || {}) })),
  ...definitions,
  storyAssets: Object.fromEntries(storyCodes.map(code => [code, { ...printed(code), global: true }])),
  encounterDeck: [...ENCOUNTER_DECK, ...SHARED_CORE_DECK],
  resolutions: {
    // 印刷结局键：场景 3b 的两个目标分别进入结局 1 / 结局 2（story-access 同名段落）。
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
    resolution1: SCENARIO_TEXT.resolutions.resolution1 || '',
    resolution2: SCENARIO_TEXT.resolutions.resolution2 || '',
  },
  tokenMeanings: {
    standard: { ...PART3_TOKEN_MEANINGS.standard }, hard: { ...PART3_TOKEN_MEANINGS.hard },
    easy: { ...PART3_TOKEN_MEANINGS.easy }, expert: { ...PART3_TOKEN_MEANINGS.expert },
  },
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

// 本章 behavior 引用的卡号统一放数据表（忒咳哩-哩 7 个卡面 × 印刷份数由目录派生）。
const tekeliliEntries = groupCodes.filter(([, card]) => card.encounterCode === 'tekelili')
export const RAW_CODES = Object.freeze({
  camp: DEFAULT_CAMP,
  actSiege: '08546',
  agendaEidolons: '08544',
  agendaDeeper: '08545',
  seepingNightmare: SEEDING_NIGHTMARE_CODE,
  everChangingMirage: '08548',
  tekeliliFaces: Object.freeze(tekeliliEntries.map(([code]) => code)),
  tekeliliCopies: Object.freeze(tekeliliEntries.map(([, card]) => card.quantity || 1)),
})

export const CARD_DATA = Object.freeze(Object.fromEntries(
  ['08544', '08545', '08546', '08547', '08548'].map(code => [code, ALL_CARDS[code]])))
