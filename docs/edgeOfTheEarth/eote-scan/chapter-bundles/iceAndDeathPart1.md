# 章节 iceAndDeathPart1 · Ice and Death, Part I · 参考卡 08501

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js (10577B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js (18985B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/chaos.js (3640B)
- index: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js (1558B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/layout.js (286B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/texts.js (174B)

## 章节卡号
08518 08519 08520 08521 08522

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/iceAndDeath.json (41124B, keys=44)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/iceAndDeath.json (35883B, keys=39)

## 相关测试
- tests/eote-scenario-iceAndDeathPart1.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js
```js
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

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/behavior.js
```js
// 亡命冰原 第 I 部分 · 引擎钩子（章节流程 + 地点/议程/结局）。
//
// 约定同 TDE/Part3 章节：behavior 只做章节分派与本章机制；逐卡规则在单卡条目里。
// 本文件同时服务引擎 scenarioBehavior 分派与单测（测试直接调用这些函数）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { initializeTekeliDeck, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  campLocationId, recordRevealedLocation, revealedLocations, setCampLocation,
} from '../../../../../src/engine/eote-camp.js'
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'
import {
  LOCATIONS, LOCATION_CONNECTIONS, CHAPTER_ID, RAW_CODES as RAW, SET_ASIDE_ALIASES,
  UNCHARTED_ENTRY_COST, UNCHARTED_LOCATION_IDS, INITIAL_LOCATION_IDS, START_LOCATION, scenario,
} from './definition.js'
import { part1ChaosFailureSpec, part1ChaosTokenValue, shelterValueOf } from './chaos.js'

const codeOf = card => card?.originalCode || card?.code || card
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id)
const setAside = state => (state.scenarioZones ||= {}).setAside ||= []
const takeFromSetAside = (state, code) => {
  const list = setAside(state)
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}
const count = (state, codes) => codes.reduce((sum, code) => sum + codes.filter(item => item === code).length, 0)
const numInvestigators = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)

function makeRuntimeLocation(state, id, { revealed = false } = {}) {
  const data = LOCATIONS[id]
  if (!data) return null
  const clues = data.cluesFixed != null
    ? data.cluesFixed
    : (data.cluesPerInvestigator || 0) * numInvestigators(state)
  return {
    ...structuredClone(data), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0,
    connections: [...(LOCATION_CONNECTIONS[id] || [])],
  }
}

const putLocation = (state, id, options) => {
  if (locationOf(state, id)) return locationOf(state, id)
  const placed = makeRuntimeLocation(state, id, options)
  if (placed) state.locations.push(placed)
  return placed
}

const symbolPlaced = (state, locationId) => LOCATIONS[locationId]?.symbol || null

// Haskell#placeSetAsideConnectedLocations：把与刚进入地点「印刷连接」的未探索地点放到场上（未揭示）。
export function placeConnectedSetAsideLocations(state, locationId, api = {}) {
  const symbol = symbolPlaced(state, locationId)
  if (!symbol) return []
  const connected = UNCHARTED_LOCATION_IDS.filter(id => {
    if (locationOf(state, id)) return false
    if (!setAside(state).includes(LOCATIONS[id].originalCode || LOCATIONS[id].code)) return false
    const links = LOCATIONS[id].connections || []
    return (PUBLIC_LINKS[id] || []).includes(symbol) || (PUBLIC_LINKS[locationId] || []).includes(LOCATIONS[id].symbol)
      || links.includes(locationId) || (LOCATION_CONNECTIONS[id] || []).includes(locationId)
  })
  for (const id of connected) {
    putLocation(state, id, { revealed: false })
    takeFromSetAside(state, LOCATIONS[id].originalCode || LOCATIONS[id].code)
  }
  if (connected.length) api.info?.(`❄️ 进入「${LOCATIONS[locationId]?.name || locationId}」：放置相连地点 ${connected.length} 个。`)
  return connected
}

// 印刷「相邻符号」表（用于判定 set-aside 地点的连接；与 location.connections 同源）。
const PUBLIC_LINKS = Object.freeze({
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

/** Haskell#Setup：本章开局（地点、放一边、遭遇牌库、忒咳哩-哩牌库、议程/幕、难度毁灭）。 */
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.campaign ||= {}
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.doom = 0
  state.round = 1
  state.locations = []
  for (const id of INITIAL_LOCATION_IDS) putLocation(state, id, { revealed: true })
  for (const inv of state.investigators || []) inv.location = START_LOCATION
  state.scenarioZones.setAside = [
    ...UNCHARTED_LOCATION_IDS.map(id => LOCATIONS[id].originalCode || LOCATIONS[id].code),
    ...SET_ASIDE_ALIASES,
  ]
  state.encounterDeck = [...scenario.encounterDeck]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []
  state.enemies ||= []
  state.scenarioZones.putIntoPlay = [...INITIAL_LOCATION_IDS]
  initializeTekeliDeck(state, { cards: [...RAW.tekeliliFaces], copies: [...RAW.tekeliliCopies] })
  if (String(state.difficulty) === 'hard') state.doom = 1
  if (String(state.difficulty) === 'expert') state.doom = 2
  api.info?.(`🧊 亡命冰原 I：从「${LOCATIONS[START_LOCATION].name}」开始；${state.scenarioZones.setAside.length} 张放一边，遭遇牌库 ${state.encounterDeck.length} 张。`)
  return {
    startLocation: START_LOCATION,
    placed: [...INITIAL_LOCATION_IDS],
    setAside: state.scenarioZones.setAside.length,
    encounterDeck: state.encounterDeck.length,
    tekeliliDeck: RAW.tekeliliCopies.reduce((sum, value) => sum + value, 0),
  }
}

/** 首次进入地点：议程 I–III 的正面强制（放置相连的放一边地点），并处理未探索地点入场费。 */
export function locationEntered(state, inv, location, api = {}) {
  const placed = typeof location === 'string' ? locationOf(state, location) : location
  if (!placed) return true
  if (!placed.visited) {
    placed.visited = true
    if (Number(state.agendaIndex) <= 2) placeConnectedSetAsideLocations(state, placed.id, api)
  }
  if (placed.revealed === false) {
    const costPerInvestigator = UNCHARTED_ENTRY_COST[placed.id]
    if (costPerInvestigator) {
      const total = costPerInvestigator * numInvestigators(state)
      const group = activeInvestigators(state).filter(other => other.location === placed.id
        || other.location === inv?.location || other.seat === inv?.seat)
      const available = group.reduce((sum, other) => sum + (other.clues || 0), 0)
      if (available < total) {
        api.info?.(`未探索地点需要共同花费 ${total} 个线索才能进入。`)
        return false
      }
      let left = total
      for (const other of group) {
        const spend = Math.min(left, other.clues || 0)
        other.clues -= spend
        left -= spend
      }
    }
    placed.revealed = true
    placed.clues = placed.maxClues || 0
    recordRevealedLocation(state, placed.id)
    ;(recordsOf(state).locationsRevealed ||= [])
    if (!recordsOf(state).locationsRevealed.includes(placed.id)) recordsOf(state).locationsRevealed.push(placed.id)
    api.info?.(`🗺️ 揭示「${placed.name || placed.id}」。`)
  }
  return true
}

function spawnFromSetAside(state, code, locationId, api, extra = {}) {
  if (!takeFromSetAside(state, code)) return null
  const card = ALL_CARDS[code] || {}
  const enemy = {
    id: `${code}-${state.enemies.length + 1}`,
    code, originalCode: code, name: card.nameZh || card.name || code,
    location: locationId, engagedSeat: null, exhausted: false, damageTaken: 0,
    fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
    damage: card.damage || 0, horror: card.horror || 0,
    traits: [...(card.traits || [])], ...extra,
  }
  state.enemies.push(enemy)
  api.info?.(`👹 生成「${enemy.name}」在「${LOCATIONS[locationId]?.name || locationId}」。`)
  return enemy
}

const highestShelterLocation = (state, predicate = () => true) => (state.locations || [])
  .filter(location => predicate(location))
  .sort((a, b) => shelterValueOf(state, b.id) - shelterValueOf(state, a.id))[0] || null

/** 议程 I 背面：在队长所在地点生成疾行谬物；其余疾行谬物 + 冰中生物洗入遭遇牌库。 */
export function resolveColdWelcomeBack(state, api = {}) {
  const lead = state.investigators?.[leadSeat(state)] || state.investigators?.[0]
  const locationId = lead?.location || START_LOCATION
  const spawned = spawnFromSetAside(state, RAW.skitteringNonsense, locationId, api, { hunter: true })
  const skittering = setAside(state).filter(code => code === RAW.skitteringNonsense)
  const creatures = setAside(state).filter(code => (ALL_CARDS[code]?.encounterCode || '') === 'creatures_in_the_ice')
  for (const code of [...skittering, ...creatures]) takeFromSetAside(state, code)
  state.encounterDeck.push(...skittering, ...creatures)
  api.info?.(`🌨️ 冷遇背面：生成疾行谬物；${skittering.length + creatures.length} 张洗入遭遇牌库。`)
  return { spawned, shuffled: [...skittering, ...creatures] }
}

/** 议程 II 背面：在已揭示且庇护值最高的地点生成星之恐怖。 */
export function resolveIntoTheWhiteBack(state, api = {}) {
  const target = highestShelterLocation(state, location => location.revealed === true)
  if (!target) return { spawned: null }
  const spawned = spawnFromSetAside(state, RAW.terrorOfTheStars, target.id, api, { hunter: true, massive: true })
  return { spawned, location: target.id }
}

/** 议程 III 背面：每位调查员洗入 1 张忒咳哩-哩；选择无线索且庇护最高的地点，全员移动并撤退。 */
export function resolveRunningOutOfTimeBack(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    try { tekeliShuffleIn(state, inv.seat, 1) } catch { /* 未初始化时忽略 */ }
  }
  const target = highestShelterLocation(state, location => (location.clues || 0) === 0)
    || locationOf(state, START_LOCATION)
  for (const inv of activeInvestigators(state)) {
    if (target) inv.location = target.id
    inv.resigned = true
    recordCampFromResignation(state, inv, api)
  }
  const result = scenarioResolution(state, 'resolution1', [], api)
  return { location: target?.id || null, result }
}

function recordCampFromResignation(state, inv, api = {}) {
  const camp = campLocationId(state)
  const locationId = inv.location || START_LOCATION
  if (camp == null && locationOf(state, locationId)) {
    setCampLocation(state, locationId)
    recordsOf(state).camp = locationId
    api.info?.(`⛺ 营地设在「${LOCATIONS[locationId]?.name || locationId}」。`)
  }
}

/** 幕 I 目标：所有未被击败的调查员撤退后推进。 */
export function actObjectiveMet(state) {
  if (!activeInvestigators(state).length) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

export function checkObjectives(state, api = {}) {
  const result = actObjectiveMet(state)
  if (!result.met) return false
  const act = (state.acts || [])[state.actIndex]
  if (act && codeOf(act) === RAW.actSearchForACampSite) {
    state.actIndex = Math.min((state.acts || []).length, state.actIndex + 1)
    api.finish?.('resolution1')
    scenarioResolution(state, 'resolution1', [], api)
  }
  return true
}

// 幕 I：[action] 如果所有调查员都在同一地点，且该地点没有线索：撤退。
export function scenarioActions(state, inv) {
  const active = activeInvestigators(state)
  const here = locationOf(state, inv?.location)
  if (!here || active.length === 0) return []
  if (!active.every(other => other.location === here.id) || (here.clues || 0) > 0) return []
  // 星之恐怖处于重整状态时不能在其地点撤退。
  const blocked = (state.enemies || []).some(enemy => codeOf(enemy) === RAW.terrorOfTheStars
    && !enemy.exhausted && enemy.location === here.id)
  if (blocked) return []
  return [{
    action: 'scenarioAction', rule: 'campResign', actions: 1,
    label: '⛺ 寻找扎营点：所有调查员同处无线索地点，撤退',
  }]
}

export function performScenarioAction(state, inv, move, api = {}) {
  if (move?.rule !== 'campResign') return false
  const active = activeInvestigators(state)
  const here = locationOf(state, inv?.location)
  if (!here || !active.every(other => other.location === here.id) || (here.clues || 0) > 0) {
    api.info?.('无法撤退：必须所有未被击败的调查员在同一地点，且该地点没有线索。')
    return false
  }
  for (const other of active) {
    other.resigned = true
    recordCampFromResignation(state, other, api)
  }
  api.info?.('⛺ 调查员们扎起营地并撤退。')
  return true
}

/** 星之恐怖处于重整状态时：不能发现其所在地点的线索。 */
export function canDiscoverClues(state, inv, location) {
  const locationId = typeof location === 'string' ? location : location?.id
  const terror = (state.enemies || []).find(enemy => codeOf(enemy) === RAW.terrorOfTheStars
    && !enemy.exhausted && enemy.location === locationId)
  return !terror
}

export function investigationError(state, inv, location) {
  if (canDiscoverClues(state, inv, location)) return undefined
  return '星之恐怖处于重整状态：不能发现它所在地点的线索。'
}

/** 敌人数值修正：星之恐怖 +3 生命值/调查员（印刷 per_investigator）。 */
export function enemyStatModifier(state, enemy, stat) {
  const code = codeOf(enemy)
  if (code === RAW.terrorOfTheStars && stat === 'health') return 3 * numInvestigators(state)
  return 0
}

/** 敌人被击败：疾行谬物 → 把忒咳哩-哩牌库顶 1 张洗入击败者牌库（不能则它攻击你）。 */
export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== RAW.skitteringNonsense) return false
  const seat = Number(enemy.defeatedBy ?? state.campaign?.leadSeat ?? 0)
  const shuffled = tekeliShuffleIn(state, seat, 1)
  if (!shuffled) {
    const owner = state.investigators?.[seat]
    if (owner) owner.horror = (owner.horror || 0) + 1
    api.info?.('疾行谬物：忒咳哩-哩牌库已空，它攻击了你（1 点恐惧）。')
  }
  return true
}

/** 检定失败：执行 [cultist]/[tablet] 后果。 */
export function afterTest(state, inv, result, api = {}) {
  if (!result || result.success) return []
  const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const tokens = result.drawn || []
  const applied = []
  if (tokens.includes('cultist')) {
    const spec = part1ChaosFailureSpec(state, 'cultist', failedBy)
    if (spec) {
      const shuffled = tekeliShuffleIn(state, inv.seat, spec.count)
      const missing = spec.count - (shuffled ? Number(shuffled.length ?? spec.count) : 0)
      if (missing > 0) inv.horror = (inv.horror || 0) + missing
      applied.push({ token: 'cultist', count: spec.count, shuffled })
    }
  }
  if (tokens.includes('tablet')) {
    const spec = part1ChaosFailureSpec(state, 'tablet', failedBy)
    if (spec && typeof api.discardTopOfDeck === 'function') {
      const discarded = api.discardTopOfDeck(inv.seat, spec.count) || []
      for (const code of discarded) {
        if (['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)) api.moveCard?.({ code, from: 'discard', to: 'hand' })
      }
      applied.push({ token: 'tablet', count: spec.count, discarded })
    }
  }
  return applied
}

/** 结局：写入战报记录（营地、已揭示地点、本章结局）。 */
export function scenarioResolution(state, key = 'resolution1', events = [], api = {}) {
  const records = recordsOf(state)
  let camp = campLocationId(state) || records.camp || null
  if (!camp) {
    const lead = state.investigators?.[leadSeat(state)] || state.investigators?.[0]
    const target = highestShelterLocation(state, location => location.revealed === true)
      || locationOf(state, lead?.location || START_LOCATION)
    if (target) {
      try { setCampLocation(state, target.id); camp = target.id } catch { camp = null }
    }
  }
  if (camp) records.camp = camp
  const revealed = [...new Set([
    ...(revealedLocations(state) || []),
    ...((state.locations || []).filter(location => location.revealed === true).map(location => location.id)),
  ])]
  records.locationsRevealed = revealed
  records.iceAndDeathPart1Resolution = key
  const shelter = camp ? shelterValueOf(state, camp) : 0
  if (key === 'resolution1') records.iceAndDeathPart1CampShelter = shelter
  // 结算由引擎 finishScenario 驱动（本函数在 applyResolutionEffects 内执行；
  // 不能再调用 api.finish，否则会递归重入 finishScenario）。
  api.info?.(`📖 亡命冰原 I 结局：${key}；营地「${LOCATIONS[camp]?.name || camp || '无'}」庇护值 ${shelter}。`)
  return { key, camp, shelter, locationsRevealed: revealed }
}

export function chaosTokenValue(state, inv, token) {
  return part1ChaosTokenValue(state, token, inv)
}

/** 议程背面分派：读单卡条目的 chapterFlow（08518/08519/08520）。 */
export function resolveAgendaBack(state, code, api = {}) {
  switch (String(codeOf(code) || code)) {
    case RAW.agendaColdWelcome: return resolveColdWelcomeBack(state, api)
    case RAW.agendaIntoTheWhite: return resolveIntoTheWhiteBack(state, api)
    case RAW.agendaRunningOutOfTime: return resolveRunningOutOfTimeBack(state, api)
    default: return null
  }
}

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup() {},
  setupScenario,
  // 引擎真实路径：preScenarioSetup 后调用 setupLocations(state, events, helper)。
  // 本章 setupScenario 自行建立 state.locations/幕/议程/遭遇牌库/忒咳哩-哩，引擎不再重复放置。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  setupEnemies() {},
  locationEntered,
  placeConnectedSetAsideLocations,
  actObjectiveMet,
  checkObjectives,
  scenarioActions,
  performScenarioAction,
  agendaReveal() {},
  resolveAgendaBack,
  resolveColdWelcomeBack,
  resolveIntoTheWhiteBack,
  resolveRunningOutOfTimeBack,
  resolution: scenarioResolution,
  scenarioResolution,
  canDiscoverClues,
  investigationError,
  enemyStatModifier,
  enemyDefeated,
  afterTest,
  chaosTokenValue,
}

export const implementedEntryCodes = Object.freeze(['08518', '08519', '08520', '08521', '08522'])

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/chaos.js
```js
// 亡命冰原 第 I 部分（iceAndDeathPart1 · 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart1.hs#HasChaosTokenValue + FailedSkillTest。
//   [skull]：简单/普通 = ceil(你所在地点庇护值 / 2)；困难/专家 = 你所在地点庇护值。
//   [cultist]：-2。检定失败时：将忒咳哩-哩牌库顶 1 张洗入你的牌库（简单/普通固定 1 张；
//              困难/专家按失败差值张数，每张不能洗入则受 1 点恐惧）。
//   [tablet]：简单/普通 -3，困难/专家 -4。失败时每低于难度 1 点弃牌库顶 1 张；弃到的弱点抽取。
// 其余标记沿用战役混乱袋基础值（共享层负责）。
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'

export const PART1_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3,
    cultistBack: '失败：将忒咳哩-哩牌库顶 1 张洗入牌库。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  standard: Object.freeze({
    skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3,
    cultistBack: '失败：将忒咳哩-哩牌库顶 1 张洗入牌库。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  hard: Object.freeze({
    skull: '庇护值', cultist: -2, tablet: -4,
    cultistBack: '失败：每低于难度 1 点，将忒咳哩-哩牌库顶 1 张洗入牌库；不能洗入则受 1 点恐惧。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  expert: Object.freeze({
    skull: '庇护值', cultist: -2, tablet: -4,
    cultistBack: '失败：每低于难度 1 点，将忒咳哩-哩牌库顶 1 张洗入牌库；不能洗入则受 1 点恐惧。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
})

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

/** 当前所在地点的庇护值（P2 eote-shelter 读点；缺失/未知按 0）。 */
export function shelterValueOf(state, locationId) {
  if (!locationId) return 0
  try {
    return Number(locationShelter(state, locationId)) || 0
  } catch {
    const placed = (state.locations || []).find(location => location.id === locationId)
    const definition = state.scenario?.locations?.[locationId]
    const raw = placed?.shelter ?? definition?.shelter ?? 0
    return Number.isFinite(Number(raw)) ? Number(raw) : 0
  }
}

/** 标记修正值；返回 null 表示交回引擎默认值。 */
export function part1ChaosTokenValue(state, tokenFace, inv) {
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hardSide(state) ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hardSide(state) ? -4 : -3
    default: return null
  }
}

/**
 * 检定失败时的标记后果（纯数据；由 behavior.afterTest 用 api 执行）。
 * @returns {{token:string, kind:'tekelili'|'discardTop', count:number}|null}
 *   同一检定同时有 cultist/tablet 时返回数组由 behavior 逐个执行。
 */
export function part1ChaosFailureSpec(state, tokenFace, failedBy) {
  const shortfall = Math.max(0, Number(failedBy) || 0)
  if (!shortfall) return null
  if (tokenFace === 'cultist') {
    return { token: tokenFace, kind: 'tekelili', count: hardSide(state) ? shortfall : 1 }
  }
  if (tokenFace === 'tablet') return { token: tokenFace, kind: 'discardTop', count: shortfall }
  return null
}

```