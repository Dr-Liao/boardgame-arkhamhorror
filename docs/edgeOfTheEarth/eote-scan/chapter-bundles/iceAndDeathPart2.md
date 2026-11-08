# 章节 iceAndDeathPart2 · Ice and Death, Part II · 参考卡 08501

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js (9620B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js (17944B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/chaos.js (2944B)
- index: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js (1544B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/layout.js (282B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/texts.js (175B)

## 章节卡号
08523 08524 08525 08526 08527 08528 08529 08530 08531 08532 08533 08534 08535 08536 08537 08538 08539 08540 08541 08542 08543

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/iceAndDeath.json (41124B, keys=27)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/iceAndDeath.json (35883B, keys=26)

## 相关测试
- tests/eote-scenario-iceAndDeathPart2.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js
```js
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

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/behavior.js
```js
// 亡命冰原 第 II 部分 · 引擎钩子（营地之夜、失踪队员、剧情卡与结局）。
//
// 约定同第 I 部分：behavior 只做章节分派与本章机制；逐卡规则在被附身队员/剧情单卡条目里。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import { initializeTekeliDeck, tekeliReturn, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  campLocationId, recordRevealedLocation, revealedLocations, setCampLocation,
} from '../../../../../src/engine/eote-camp.js'
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'
import { partnerState, setPartnerStatus } from '../../../../../src/campaign/eote-partners.js'
import {
  CHAPTER_ID, CAMP_IDS, DEFAULT_CAMP, LOCATIONS, POSSESSED_ENEMY_CODES, POSSESSED_PARTNERS,
  RAW_CODES as RAW, SET_ASIDE_ALIASES, STORY_CODES, UNCHARTED_LOCATION_IDS, scenario,
} from './definition.js'
import { part2ChaosFailureSpec, part2ChaosTokenValue, shelterValueOf } from './chaos.js'

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
const numInvestigators = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)
const partnerCodeOfEnemy = enemyCode => (POSSESSED_PARTNERS.find(([, enemy]) => enemy === enemyCode) || [])[0] || null
const isPossessedEnemy = code => POSSESSED_ENEMY_CODES.includes(code)

function campIdOf(state) {
  const record = recordsOf(state).camp || campLocationId(state)
  return CAMP_IDS.includes(record) ? record : DEFAULT_CAMP
}

function makeRuntimeLocation(state, id, revealed) {
  const data = LOCATIONS[id]
  const clueCount = data.cluesFixed != null ? data.cluesFixed : (data.cluesPerInvestigator || 0) * numInvestigators(state)
  return {
    ...structuredClone(data), id, revealed, clues: revealed ? clueCount : 0, maxClues: clueCount, doom: 0,
    connections: [...(data.connections || [])],
  }
}

const putLocation = (state, id, revealed = false) => {
  if (locationOf(state, id)) return locationOf(state, id)
  const placed = makeRuntimeLocation(state, id, revealed)
  if (placed) state.locations.push(placed)
  return placed
}

// Haskell#Setup：放营地与全部地点；把 Mia 队员敌人 + 8 张剧情卡洗成 9 张，压到未探索地点下。
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
  const camp = campIdOf(state)
  const revealed = new Set([...(recordsOf(state).locationsRevealed || []), ...(revealedLocations(state) || [])])
  for (const id of CAMP_IDS) {
    const place = putLocation(state, id, revealed.has(id))
    if (id === camp) {
      place.revealed = true
      place.clues = 0
    }
  }
  try { setCampLocation(state, camp) } catch { /* 地点已重置时忽略 */ }
  state.scenarioFlags.camp = camp
  for (const inv of state.investigators || []) inv.location = camp

  // 队员状态：Mia 的队员变成被附身敌人放一边；其余队员从场上移除（由战役流程持有）。
  const miaEnemies = []
  const partners = state.campaign?.eote?.partners?.roster || []
  for (const partner of partners) {
    if (partner.status !== 'mia') continue
    const row = POSSESSED_PARTNERS.find(([asset]) => asset === partner.code)
    if (row) miaEnemies.push(row[1])
  }
  state.scenarioZones.setAside = [...new Set([...miaEnemies, ...STORY_CODES])]
  state.encounterDeck = [...scenario.encounterDeck]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []
  state.enemies ||= []
  initializeTekeliDeck(state, { cards: [...RAW.tekeliliFaces], copies: [...RAW.tekeliliCopies] })

  // 9 张（Mia 敌人 + 剧情卡）压到未探索地点下；其余放回「移出游戏」。
  const hidden = [...miaEnemies, ...STORY_CODES]
  const under = hidden.slice(0, 9)
  const removed = hidden.slice(9)
  const uncharted = UNCHARTED_LOCATION_IDS.map(id => locationOf(state, id)).filter(Boolean)
  under.forEach((code, index) => {
    const host = uncharted[index % Math.max(1, uncharted.length)]
    if (!host) return
    host.beneath ||= []
    host.beneath.push(code)
    host.beneathFaceDown ||= []
    host.beneathFaceDown.push(true)
  })
  state.scenarioZones.removed = [...(state.scenarioZones.removed || []), ...removed]
  // 压在地点下的卡已经不在「放一边」；放一边只留超过 9 张的余牌（Haskell removeEvery）。
  state.scenarioZones.setAside = [...removed]
  api.info?.(`🌌 亡命冰原 II：营地在「${LOCATIONS[camp]?.name || camp}」；${under.length} 张卡压在未探索地点下。`)
  return {
    camp, placed: CAMP_IDS.length, beneath: under.length, removed: removed.length,
    setAside: state.scenarioZones.setAside.length, encounterDeck: state.encounterDeck.length,
  }
}

/** 议程 IV/V 背面：查看一张压在某个地点底下的卡，然后放回正面朝下。 */
export function agendaAdvance(state, code, api = {}) {
  const agendaCode = codeOf(code) || code
  if ([RAW.agendaHarshWind, RAW.agendaChillOfNight].includes(agendaCode)) {
    const hosts = (state.locations || []).filter(location => (location.beneath || []).length)
    if (!hosts.length) return { looked: null }
    const host = hosts[0]
    const beneath = host.beneath[0]
    state.scenarioFlags.lookedAt = { locationId: host.id, code: beneath }
    api.cardReveal?.(beneath, ALL_CARDS[beneath]?.nameZh || beneath)
    api.info?.(`👁️ 查看「${host.name || host.id}」底下的卡（正面朝下放回）。`)
    return { looked: { locationId: host.id, code: beneath } }
  }
  if (agendaCode === RAW.agendaMadnessAndDeath) {
    for (const inv of activeInvestigators(state)) {
      inv.defeated = true
      const record = state.campaign?.investigators?.[inv.seat]
      if (record) record.trauma = { ...(record.trauma || {}), mental: (record.trauma?.mental || 0) + 1 }
      else {
        state.campaign.records ||= {}
        const key = `mentalTrauma_${inv.seat}`
        state.campaign.records[key] = (state.campaign.records[key] || 0) + 1
      }
    }
    const result = scenarioResolution(state, 'resolution1', [], api)
    return { result }
  }
  return null
}

const storyCard = code => ALL_CARDS[code] || {}

/** 剧情卡结算（08527–08534）：读条目 flags.storyEffect，执行后加入胜利区。 */
export function resolveStory(state, code, inv, api = {}) {
  const card = storyCard(code)
  const effect = entryFlags(code)?.storyEffect || null
  const active = inv || state.investigators?.[leadSeat(state)] || state.investigators?.[0]
  const tekeliliCodes = RAW.tekeliliFaces
  const removeFrost = () => api.removeChaosToken?.('frost')
  const toBottom = codes => {
    for (const item of codes) {
      const index = (active?.deck || []).indexOf(item)
      if (index >= 0) {
        active.deck.splice(index, 1)
        // P2 忒咳哩-哩原语：把卡放回忒咳哩-哩牌库底（不暴露牌序）。
        try { tekeliReturn(state, item, { destination: 'bottom' }) } catch { /* 牌库未初始化时由战役层另接 */ }
      }
    }
  }
  switch (effect) {
    case 'removeFrost':
      removeFrost()
      api.info?.(`🧊 「${card.nameZh || code}」：从混乱袋移除 1 个 [frost] 标记。`)
      break
    case 'tekeliliToBottom': {
      const found = (active?.deck || []).find(item => tekeliliCodes.includes(item))
      if (found) toBottom([found])
      api.info?.(`🧊 「${card.nameZh || code}」：把牌库中的 1 张忒咳哩-哩放到忒咳哩-哩牌库底。`)
      break
    }
    case 'tekeliliTopNineToBottom': {
      const top = (active?.deck || []).slice(0, 9)
      const found = top.filter(item => tekeliliCodes.includes(item))
      toBottom(found)
      api.info?.(`🧊 「${card.nameZh || code}」：查看牌库顶 9 张，把 ${found.length} 张忒咳哩-哩放到牌库底。`)
      break
    }
    case 'discardNonEliteEidolon': {
      const candidates = (state.enemies || []).filter(enemy => {
        const traits = (ALL_CARDS[codeOf(enemy)]?.traits || []).map(item => String(item).toLowerCase())
        return traits.includes('eidolon') && !traits.includes('elite')
      })
      if (candidates.length) {
        const chosen = candidates[0]
        state.enemies = state.enemies.filter(enemy => enemy !== chosen)
        api.info?.(`🧊 「${card.nameZh || code}」：弃掉幻灵敌人「${chosen.name || codeOf(chosen)}」。`)
      }
      break
    }
    case 'possessedDoomToClues': {
      const candidates = (state.enemies || []).filter(enemy => {
        const traits = (ALL_CARDS[codeOf(enemy)]?.traits || []).map(item => String(item).toLowerCase())
        return traits.includes('possessed') && !traits.includes('elite')
      })
      const chosen = candidates[0]
      if (chosen) {
        const host = locationOf(state, chosen.location)
        if (host) host.clues = (host.clues || 0) + (chosen.doom || 0)
        chosen.doom = 0
        state.enemies = state.enemies.filter(enemy => enemy !== chosen)
        api.info?.(`🧊 「${card.nameZh || code}」：控制「${chosen.name || codeOf(chosen)}」的毁灭并弃掉它。`)
      }
      break
    }
    default:
      api.info?.(`「${card.nameZh || code}」结算。`)
  }
  state.victoryDisplay ||= []
  const addToVictory = entryFlags(code)?.storyAddToVictory !== false
  if (addToVictory && !state.victoryDisplay.some(entry => (entry.code || entry) === code)) {
    state.victoryDisplay.push({ code, name: card.nameZh || card.name || code })
  }
  return { code, effect, victory: entryFlags(code)?.storyVictory ?? card.victory ?? 0 }
}

/** 受附身队员被击败：在战报日志划掉其名字（状态标记 eliminated）。 */
export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOf(enemy)
  const partner = partnerCodeOfEnemy(code)
  if (!partner) return false
  try {
    setPartnerStatus(state, partner, 'eliminated')
  } catch {
    recordsOf(state)[`crossedOut_${partner}`] = true
  }
  recordsOf(state)[`crossedOutPartner_${partner}`] = true
  api.info?.(`✖️ 划掉「${enemy.name || code}」的名字。`)
  return true
}

export function actObjectiveMet(state) {
  if (!activeInvestigators(state).length) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

export function checkObjectives(state, api = {}) {
  const result = actObjectiveMet(state)
  if (!result.met) return false
  const act = (state.acts || [])[state.actIndex]
  if (act && (codeOf(act) === RAW.actLostExpedition)) {
    state.actIndex = Math.min((state.acts || []).length, state.actIndex + 1)
    api.finish?.('resolution1')
    scenarioResolution(state, 'resolution1', [], api)
  }
  return true
}

// [free] 同地点共同花费 1[per_investigator] 线索：抽取该地点底下的一张遭遇卡；[action] 在营地撤退。
export function scenarioActions(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return []
  const out = []
  if ((here.beneath || []).length) {
    out.push({
      action: 'scenarioAction', rule: 'drawUnderLocation', actions: 0,
      label: `🔍 抽取「${here.name || here.id}」底下的遭遇卡（共同花费 ${numInvestigators(state)} 线索）`,
    })
  }
  if (here.id === campIdOf(state)) {
    out.push({ action: 'scenarioAction', rule: 'campResign', actions: 1, label: '⛺ 回到营地，撤退' })
  }
  return out
}

export function performScenarioAction(state, inv, move, api = {}) {
  if (move?.rule === 'drawUnderLocation') {
    const here = locationOf(state, inv?.location)
    if (!here || !(here.beneath || []).length) return false
    const group = activeInvestigators(state).filter(other => other.location === here.id)
    const total = numInvestigators(state)
    const available = group.reduce((sum, other) => sum + (other.clues || 0), 0)
    if (available < total) {
      api.info?.(`线索不足：需要共同花费 ${total} 个线索。`)
      return false
    }
    let left = total
    for (const other of group) {
      const spend = Math.min(left, other.clues || 0)
      other.clues -= spend
      left -= spend
    }
    const code = here.beneath.shift()
    ;(here.beneathFaceDown ||= []).shift()
    if (isPossessedEnemy(code)) {
      const card = ALL_CARDS[code] || {}
      state.enemies ||= []
      state.enemies.push({
        id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.nameZh || card.name || code, location: here.id, engagedSeat: inv.seat,
        exhausted: false, damageTaken: 0, fight: card.fight, evade: card.evade, health: card.health,
        damage: card.damage || 0, horror: card.horror || 0, traits: [...(card.traits || [])],
      })
      api.info?.(`👹 「${code}」被附身的队员出现。`)
    } else {
      resolveStory(state, code, inv, api)
    }
    return true
  }
  if (move?.rule === 'campResign') {
    const camp = campIdOf(state)
    if (inv?.location !== camp) {
      api.info?.('只有在营地才能撤退。')
      return false
    }
    const active = activeInvestigators(state)
    if (!active.every(other => other.location === camp)) {
      api.info?.('所有未被击败的调查员必须都在营地才能撤退。')
      return false
    }
    for (const other of active) other.resigned = true
    api.info?.('⛺ 调查员们回到营地，熬过寒夜。')
    return true
  }
  return false
}

/** 结局：把胜利区里的被附身队员对应伙伴标为 Safe，否则 Eliminated；写回已揭示地点。 */
export function scenarioResolution(state, key = 'resolution1', events = [], api = {}) {
  const records = recordsOf(state)
  const victoryCodes = new Set((state.victoryDisplay || []).flatMap(entry => [
    entry?.code, entry?.originalCode, typeof entry === 'string' ? entry : null,
  ].filter(Boolean)))
  const partnerResults = []
  for (const [asset, enemy] of POSSESSED_PARTNERS) {
    const partner = (() => { try { return partnerState(state, asset) } catch { return null } })()
    if (!partner || partner.status !== 'mia') continue
    const rescued = victoryCodes.has(enemy)
    const status = rescued ? 'safe' : 'eliminated'
    try { setPartnerStatus(state, asset, status) } catch { /* 未初始化名册时跳过 */ }
    records[`partnerResult${asset}`] = status
    partnerResults.push({ asset, enemy, status })
  }
  records.iceAndDeathPart2Resolution = key
  records.locationsRevealed = [...new Set([
    ...(revealedLocations(state) || []),
    ...((state.locations || []).filter(location => location.revealed === true).map(location => location.id)),
  ])]
  // 结算由引擎 finishScenario 驱动（本函数在 applyResolutionEffects 内执行；
  // 不能再调用 api.finish，否则会递归重入 finishScenario）。
  api.info?.(`📖 亡命冰原 II 结局：${key}；救回 ${partnerResults.filter(item => item.status === 'safe').length} 名队员。`)
  return { key, partnerResults, locationsRevealed: records.locationsRevealed }
}

export function chaosTokenValue(state, inv, token) {
  return part2ChaosTokenValue(state, token, inv)
}

export function canDiscoverClues() { return true }

export function afterTest(state, inv, result, api = {}) {
  if (!result || result.success) return []
  const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const tokens = result.drawn || []
  const applied = []
  if (tokens.includes('cultist')) {
    const spec = part2ChaosFailureSpec(state, 'cultist', failedBy)
    if (spec) {
      const shuffled = tekeliShuffleIn(state, inv.seat, spec.count)
      const missing = spec.count - (shuffled ? Number(shuffled.length ?? spec.count) : 0)
      if (missing > 0) inv.horror = (inv.horror || 0) + missing
      applied.push({ token: 'cultist', count: spec.count })
    }
  }
  if (tokens.includes('tablet')) {
    const spec = part2ChaosFailureSpec(state, 'tablet', failedBy)
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

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup() {},
  setupScenario,
  // 引擎真实路径：同 Part I，setupScenario 完成初始化后返回空数组，避免引擎重复放置地点。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  setupEnemies() {},
  agendaAdvance,
  resolveAgendaBack: agendaAdvance,
  actObjectiveMet,
  checkObjectives,
  scenarioActions,
  performScenarioAction,
  resolveStory,
  enemyDefeated,
  resolution: scenarioResolution,
  scenarioResolution,
  chaosTokenValue,
  canDiscoverClues,
  afterTest,
}

export const implementedEntryCodes = Object.freeze([
  '08523', '08524', '08525', '08526', '08527', '08528', '08529', '08530', '08531', '08532', '08533',
  '08534', '08535', '08536', '08537', '08538', '08539', '08540', '08541', '08542', '08543',
])

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/chaos.js
```js
// 亡命冰原 第 II 部分（iceAndDeathPart2 · 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart2.hs#HasChaosTokenValue + FailedSkillTest。
// 与第 I 部分同一套符号数值：[skull] = 当前地点庇护值的一半（向上取整；困难/专家取全额）；
// [cultist] = -2（失败：忒咳哩-哩洗入牌库，困难/专家按失败差值）；[tablet] = -3/-4（失败弃牌库顶）。
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'

export const PART2_TOKEN_MEANINGS = Object.freeze({
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

export function part2ChaosTokenValue(state, tokenFace, inv) {
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hardSide(state) ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hardSide(state) ? -4 : -3
    default: return null
  }
}

export function part2ChaosFailureSpec(state, tokenFace, failedBy) {
  const shortfall = Math.max(0, Number(failedBy) || 0)
  if (!shortfall) return null
  if (tokenFace === 'cultist') return { token: tokenFace, kind: 'tekelili', count: hardSide(state) ? shortfall : 1 }
  if (tokenFace === 'tablet') return { token: tokenFace, kind: 'discardTop', count: shortfall }
  return null
}

```