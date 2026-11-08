# 章节 iceAndDeathPart3 · Ice and Death, Part III · 参考卡 08501

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js (7733B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js (8209B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/chaos.js (1937B)
- index: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js (1462B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/layout.js (277B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/texts.js (165B)

## 章节卡号
08544 08545 08546 08547 08548

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/iceAndDeath.json (41124B, keys=20)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/iceAndDeath.json (35883B, keys=11)

## 相关测试
- tests/eote-scenario-iceAndDeathPart3.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js
```js
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

// 营地候选（Part1/Part2 的战役记录会记下营地点；replay/单测可用默认坠机点）。
export const CAMPS = Object.freeze(['crashSite', 'frozenShores', 'treacherousPath', 'precariousIceSheet'])
export const DEFAULT_CAMP = 'crashSite'

// 印刷地点（08502–08514）与符号。
export const LOCATION_TABLE = Object.freeze([
  ['crashSite', '08502', 'circle'], ['frozenShores', '08503', 'diamond'],
  ['treacherousPath', '08504', 'triangle'], ['precariousIceSheet', '08505', 'heart'],
  ['broadSnowdrifts', '08506', 'square'], ['icyWastes', '08507', 'droplet'],
  ['rockyCrags', '08508', 'equals'], ['snowGraves', '08509', 'squiggle'],
  ['icebreakerLanding', '08510', 'trefoil'], ['frigidCave', '08511', 'plus'],
  ['barrierCamp', '08512', 'moon'], ['remnantsOfLakesCamp', '08513', 'star'],
  ['crystallineCavern', '08514', 'hourglass'],
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


export const LOCATIONS = Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, symbol]) => {
  const base = location({ id, code, symbol, clues: 0 })
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
const deckCodes = groupCodes.filter(([, card]) => ['enemy', 'treachery'].includes(card.type)).map(([code]) => code)
const storyCodes = groupCodes.filter(([, card]) => card.type === 'story').map(([code]) => code)
const definitions = encounterDefinitions(deckCodes)

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
  encounterDeck: deckCodes,
  resolutions: {
    victory: SCENARIO_TEXT.resolutions.victory || '',
    defeat: SCENARIO_TEXT.resolutions.defeat || '',
    noResolution: SCENARIO_TEXT.resolutions.noResolution || '',
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

// 本章 behavior 引用的卡号统一放数据表。
export const RAW_CODES = Object.freeze({
  camp: DEFAULT_CAMP,
  actSiege: '08546',
  agendaEidolons: '08544',
  agendaDeeper: '08545',
  seepingNightmare: '08547',
  everChangingMirage: '08548',
})

export const CARD_DATA = Object.freeze(Object.fromEntries(
  ['08544', '08545', '08546', '08547', '08548'].map(code => [code, ALL_CARDS[code]])))

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js
```js
// 亡命冰原 III · 引擎钩子（章节流程 + 渗出梦魇）。
//
// 约定同 TDE 章节：behavior 只做章节分派与本章机械；逐卡规则在单卡条目。
// 本文件同时服务于引擎 scenarioBehavior 分派与单测（测试直接调用这些函数）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import { part3ChaosTokenValue, shelterValueOf } from './chaos.js'
import {
  CAMPS, DEFAULT_CAMP, LOCATIONS, RAW_CODES as RAW, scenario,
} from './definition.js'

const CHAPTER_ID = 'iceAndDeathPart3'
const lo = code => String(code || '').toLowerCase()
const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(lo)
const isEidolon = code => traitsOf(code).includes('eidolon')
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const campId = state => {
  const record = state.campaign?.records?.camp
  return CAMPS.includes(record) ? record : DEFAULT_CAMP
}

// Haskell#Setup：收集小组 → 建遭遇牌库 → 放置全部地点（未揭示）→ 营地揭示并去线索 →
// 抽出 N 张渗出梦魇（每调查员 1 张）放到非营地地点并压入幻灵敌人 → 剩余卡放一边。
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const camp = campId(state)
  state.scenarioFlags.camp = camp
  const perInvestigator = Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)

  // 遭遇牌库：本章 gather 的敌人/诡计（去掉被压到渗出梦魇底下的幻灵）。
  const gathered = (scenario.encounterDeck || []).filter(code => !isEidolon(code))
  const eidolons = (scenario.encounterDeck || []).filter(isEidolon)
  state.encounterDeck = [...gathered]
  state.encounterDiscard ||= []

  // 地点：全部入场，仅营地揭示；营地清除线索。
  state.locations = Object.entries(LOCATIONS).map(([id, data]) => ({
    ...data, id, clues: 0, maxClues: 0, doom: 0, revealed: id === camp,
    ...(id === camp ? { clues: 0, startedAt: true } : {}),
  }))
  const campLocation = state.locations.find(location => location.id === camp)
  if (campLocation) campLocation.clues = 0
  for (const inv of activeInvestigators(state)) inv.location = camp

  // 渗出梦魇：每调查员 1 张，放到非营地的荒芜地点；每张压入等分幻灵。
  const nightMareCode = RAW.seepingNightmare
  const candidates = state.locations.filter(location => location.id !== camp).map(location => location.id)
  const count = Math.min(perInvestigator, Math.max(1, candidates.length))
  state.enemies = []
  const placed = candidates.slice(0, count)
  for (let index = 0; index < placed.length; index += 1) {
    // 幻灵按调查员人数等分压在各渗出梦魇下；不足时轮流分配（不改变「有压卡」语义）。
    const share = Math.max(1, Math.ceil(eidolons.length / Math.max(1, placed.length)))
    const beneath = eidolons.slice(index * share, index * share + share)
    state.enemies.push({
      id: `seepingNightmare${index + 1}`, code: nightMareCode, name: ALL_CARDS[nightMareCode]?.nameZh || '渗出梦魇',
      location: placed[index], fight: ALL_CARDS[nightMareCode]?.fight ?? 4, evade: ALL_CARDS[nightMareCode]?.evade ?? 3,
      health: ALL_CARDS[nightMareCode]?.health ?? 6, damage: 2, horror: 2, hunter: beneath.length === 0,
      exhausted: false, beneath, beneathFaceDown: beneath.map(() => true),
    })
  }
  state.scenarioZones.setAside = [
    ...eidolons.slice(count * Math.max(1, Math.ceil(eidolons.length / Math.max(1, placed.length)))),
    ...(state.scenarioZones.setAside || []),
  ]
  state.scenarioZones.putIntoPlay = Object.values(LOCATIONS).map(location => location.id)
  api.info?.(`🧊 亡命冰原 III：营地「${campLocation?.name || camp}」；${placed.length} 个渗出梦魇压在冰原上。`)
  return { camp, nightmareCount: placed.length, eidolonCount: eidolons.length, eidolonsBeneath: placed.length * 4 }
}

// 08544 邪灵现身（强制，密谋将要推进时）：若有渗出梦魇底下有正面朝下卡牌 → 不推进，
// 改为移除 2 毁灭，并选底下卡最多的渗出梦魇随机翻出 1 张卡生成在其地点。
export function agendaWouldAdvance(state, agenda) {
  if ((agenda?.originalCode || agenda?.code) !== RAW.agendaEidolons) return true
  const holders = (state.enemies || []).filter(enemy => enemy.code === RAW.seepingNightmare && (enemy.beneath || []).length)
  if (!holders.length) return true
  state.doom = Math.max(0, Number(state.doom || 0) - 2)
  const host = holders.reduce((best, enemy) => (enemy.beneath.length > best.beneath.length ? enemy : best), holders[0])
  const [code] = host.beneath.splice(0, 1)
  ;(host.beneathFaceDown ||= []).splice(0, 1)
  host.hunter = host.beneath.length === 0
  state.scenarioFlags.spawnedFrom = { seepingNightmare: host.id, code, location: host.location }
  // 把翻出的卡放进遭遇弃牌堆顶部，供引擎在议程结算后从该地点生成。
  state.encounterDiscard ||= []
  state.encounterDiscard.push(code)
  return false
}

// 08546 陷入围攻！：场上没有幻灵敌人 → 推进；或所有未被击败的调查员都撤退了。
export function actObjectiveMet(state) {
  const eidolons = (state.enemies || []).filter(enemy => !enemy.defeated && isEidolon(enemy.code))
  if (!eidolons.length) return { met: true, reason: 'noEidolonEnemies' }
  const alive = activeInvestigators(state)
  if (alive.length === 0) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

// 08546 营地获得 [action] 共同花 4 线索：撤退。
export function scenarioActions(state, inv) {
  const camp = state.scenarioFlags?.camp
  if (!camp || inv?.location !== camp) return []
  return [{
    action: 'scenarioAction', rule: 'campResign', actions: 1,
    label: '⛺ 营地：共同花费 4 个线索，撤退',
  }]
}

export function performScenarioAction(state, inv, move, api = {}) {
  if (move?.rule !== 'campResign') return false
  const group = activeInvestigators(state).filter(other => other.location === state.scenarioFlags?.camp)
  const clues = group.reduce((sum, other) => sum + (other.clues || 0), 0)
  if (clues < 4) {
    api.info?.('线索不足：营地的调查员们需要共同花费 4 个线索才能撤退。')
    return false
  }
  let left = 4
  for (const other of group) {
    const spend = Math.min(left, other.clues || 0)
    other.clues -= spend
    left -= spend
  }
  for (const other of group) other.resigned = true
  api.info?.('⛺ 调查队从营地撤退。')
  return true
}

// 结束：胜利/失败记录。庇护值取自营地点/最后所在地点（P2 eote-shelter 落地前兼容）。
export function scenarioResolution(state, resolution = 'victory') {
  state.campaign ||= {}
  state.campaign.records ||= {}
  const records = state.campaign.records
  const seat = Number(state.campaign.leadSeat ?? 0)
  const inv = state.investigators?.[seat]
  const shelter = shelterValueOf(state, state.scenarioFlags?.camp || inv?.location)
  records.shelterValue = shelter
  records.iceAndDeathPart3Resolution = resolution
  if (resolution === 'victory') {
    records.eidolonsVanquished = true
    records.seepingNightmaresEnded = true
  }
  return { resolution, shelterValue: shelter, records: { ...records } }
}

export function chaosTokenValue(state, tokenFace, inv) {
  return part3ChaosTokenValue(state, tokenFace, inv)
}

export const behavior = {
  id: CHAPTER_ID,
  setupScenario,
  // 引擎真实路径入口：setupScenario 已建立地点/遭遇牌库等，引擎不再重复放置。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, { info: text => helper.info?.(state, events, text) })
    return []
  },
  agendaWouldAdvance,
  actObjectiveMet,
  scenarioActions,
  performScenarioAction,
  scenarioResolution,
  chaosTokenValue,
  campId,
}

// 本章单卡条目（08544–08548）在合并后由 Lead 登记；behavior 通过 entryFlags 读取卡面声明。
export function implementedEntryFlags(code) {
  return entryFlags(code) || {}
}

```

## content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/chaos.js
```js
// 亡命冰原 III（iceAndDeathPart3 · 印刷参考卡 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart3.hs#HasChaosTokenValue。
//   [skull]：简单/普通 = ceil(庇护值/2)，困难/专家 = 庇护值。
//   [cultist]：-2；[tablet]：简单/普通 -3，困难/专家 -4。
// 其余标记沿用战役混乱袋基础值（战役层 CHAOS_BAGS）。
//
// 本章 chaos.js 同时暴露静态文案表与运行时数值函数；definition 把它接入 scenario.tokenMeanings，
// behavior.chaosTokenValue 供引擎/测试读当前庇护值。
export const PART3_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({ skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3 }),
  standard: Object.freeze({ skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3 }),
  hard: Object.freeze({ skull: '庇护值', cultist: -2, tablet: -4 }),
  expert: Object.freeze({ skull: '庇护值', cultist: -2, tablet: -4 }),
})

// 地点庇护值：优先读地点实例上的 shelter/shelterValue（P2 eote-shelter 落地前的兼容读点），
// 其次读关卡数据里地点定义的 shelter；都没有则 0。
export function shelterValueOf(state, locationId) {
  if (!locationId) return 0
  const placed = (state.locations || []).find(location => location.id === locationId)
  const definition = state.scenario?.locations?.[locationId]
  const raw = placed?.shelter ?? placed?.shelterValue ?? definition?.shelter ?? definition?.shelterValue
  return Number.isFinite(Number(raw)) ? Number(raw) : 0
}

export function part3ChaosTokenValue(state, tokenFace, inv) {
  const hard = ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hard ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hard ? -4 : -3
    default: return null
  }
}

```