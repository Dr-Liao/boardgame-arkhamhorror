// 寂静荒野（theSilentHeath · 10549）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheSilentHeath.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheSilentHeath/*.hs +
//       Location|Enemy/CardDefs/TheFeastOfHemlockVale/HorrorsInTheRock.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theSilentHeath.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / introduction → 昼夜、开场分支、幕/议程牌库（荒芜 v.I/v.II）
//   modifyDeck → 当日遭遇组并入遭遇牌库
//   setupLocations / locationPlaced / locationRevealed / afterDeckSetup → 三张起始地点 + 网格、
//     时间标记卡、白日居民、岩中恐怖暗牌库、水晶残骸暗牌堆
//   actions / performAction → 幕 2「抽取地点底下暗牌」「查看暗堆顶并放底」、水晶果园献残骸
//   turnBegins / assetLeftPlay / investigatorEliminated → 水晶残骸的回合开始伤害与击败暗堆、撤退献纳
//   enemySpawned / enemyMoved / enemyStatModifier / locationShroudModifier / enemyAttackResolved
//   phaseBegan / roundEnded → 昆虫关键词同步（荒芜 v.I/v.II、族群虫后光环）
//   doomPlaced → 议程「放置毁灭时揭示标记，符号则生成族群虫后」
//   actReveal / agendaReveal / checkObjectives / allResigned → 幕/议程背面与推进
//   resolveChaosToken / applyTokenEffect / testAutoFail → 10549 四档混乱标记
//   resolution → 结局 1/2/3/4（含无结局的残骸张数分支）与战役记录
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON），
// 网格坐标走 mechanicState.grid（与《消失的姐妹》同一套 P2 原语），变化只经 api.* 生效。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { adjacentGridSpaces, connectGrid, gridPosition } from '../../../../../src/engine/grid-map.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  isHardSide, insectCount, insectsInPlay, insectsInVictory, skullValue, atLairLocation,
  silentHeathChaosToken, silentHeathChaosTokenValue,
} from './chaos.js'
import {
  ACT_CODES, ACT1_CODE, ACT2_CODE, AGENDA_CODES, AGENDA1_CODE, AGENDA_STAGES, ACTS, AGENDAS,
  DESOLATION_V1_CODE, DESOLATION_V2_CODE, DESOLATION_V2_STAGE, STAGE_CARDS,
  BROOD_QUEEN_CODE, BROOD_SOLDIER_CODE, COLORLESS_LARVA_CODE, COMMANDING_RESONANCE_CODE,
  CRYSTAL_PARASITE_CODE, CRYSTAL_REMAINS_CHILD, CRYSTAL_REMAINS_CODES, CRYSTAL_REMAINS_DECK,
  CRYSTAL_REMAINS_FATHER, CRYSTAL_REMAINS_MOTHER, DEFEND_THE_NEST_CODE,
  DAY_GATHER_GROUPS, DAY_NUMBERS, SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, CAVE_LOCATION_IDS,
  CAVE_LOCATION_BY_ID, HORRORS_POOL_IDS, HORRORS_SET_ASIDE_CELLS, HORRORS_SET_ASIDE_COUNT,
  HORRORS_REMOVED_COUNT, LOCATION_CELLS, LOCATION_CONNECTIONS, LOCATIONS, RESIDENT_ASSETS,
  RESIDENT_LOCATIONS, SCENARIO_TEXT, START_LOCATION, START_LOCATION_IDS, TIME_MARKER_CODES,
  RESOLUTION_KEYS, dayGroupCards, scenario,
} from './definition.js'

const CHAPTER_ID = 'theSilentHeath'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => {
  flagsFor(state)[key] = value
  return value
}
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true
const flagValue = (code, key) => flagsOf(code)[key]
const isCrystalRemainsCode = code => CRYSTAL_REMAINS_CODES.includes(String(code)) || flagIs(code, 'crystalRemains')
const isBroodQueenCode = code => String(code) === BROOD_QUEEN_CODE || flagIs(code, 'broodQueen')
const isBroodSoldierCode = code => String(code) === BROOD_SOLDIER_CODE || flagIs(code, 'broodSoldier')
const activeInvestigatorAt = (state, locationId) => activeInvestigators(state).find(inv => inv.location === locationId) || null
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const agendaFrontCode = state => {
  const agenda = currentAgenda(state)
  if (!agenda || agenda.face === 'back') return null
  return AGENDA_CODES.includes(codeOf(agenda)) ? codeOf(agenda) : null
}

// 单卡条目的规则数据（flags）是唯一事实源：behavior 只按条目声明分派；未注册时退回章节常量。
const testSpecOf = code => flagValue(code, 'test') || null
const agendaFlags = state => flagsOf(agendaFrontCode(state) || '')

// ---------------------------------------------------------------------------
// 天数与昼夜（指南「Check your Campaign Log」）
// ---------------------------------------------------------------------------
export function dayNumberOf(value) {
  const raw = value != null && typeof value === 'object' ? (value.day ?? value.value) : value
  if (raw == null || raw === '') return null
  const match = /([123])/.exec(String(raw))
  return match ? Number(match[1]) : null
}
const timeIsNight = value => value != null && /night/i.test(String(value))

function calendarDate(state) {
  const date = mechanicState(state)?.scenarioDate
  if (date) return { day: Number(date.day), night: date.period === 'night' }
  const record = state?.scenario?.mechanics?.calendar?.record
  const raw = record ? state?.campaign?.records?.[record] : null
  const [day, period] = typeof raw === 'string' ? raw.split(':') : []
  return day && period ? { day: Number(day), night: /night/i.test(period) } : null
}

export function dayOf(state) {
  const records = state?.campaign?.records || {}
  return dayNumberOf(state?.scenarioFlags?.silentHeathDay)
    ?? calendarDate(state)?.day
    ?? dayNumberOf(records.day)
    ?? dayNumberOf(records.currentDay)
    ?? 1
}

export function isNight(state) {
  if (state?.scenarioFlags?.silentHeathNight != null) return state.scenarioFlags.silentHeathNight === true
  const dated = calendarDate(state)
  if (dated) return dated.night
  const records = state?.campaign?.records || {}
  return timeIsNight(records.time) || timeIsNight(records.dayTime) || timeIsNight(records.timeOfDay)
}

/** 开场分支：夜（Night 1/2）跳过 Intro 4；否则按天数 Intro 1/2/3 再接 Intro 5。 */
export function introBranchKey(state) {
  if (isNight(state)) return 'intro4'
  const day = dayOf(state)
  return day === 3 ? 'intro3' : day === 2 ? 'intro2' : 'intro1'
}

export function introFor(state) {
  const key = introBranchKey(state)
  const extra = isNight(state) ? [] : ['intro5']
  return { key, keys: [key, ...extra], text: [key, ...extra].map(item => SCENARIO_TEXT.introBranches[item] || '') }
}

/** 把当前天数/时段写回战役记录与引擎日历原语（duringPeriod 读点）。 */
export function syncDayAndTime(state, api = {}) {
  const day = dayOf(state)
  const night = isNight(state)
  const records = recordsFor(state)
  if (dayNumberOf(records.day) !== day) records.day = day
  const time = night ? 'Night' : 'Day'
  if (String(records.time || '').toLowerCase() !== time.toLowerCase()) records.time = time
  const calendar = api?.mechanics?.calendar
  if (typeof calendar?.set === 'function') {
    const current = calendar.current?.()
    if (!current || Number(current.day) !== day || current.period !== (night ? 'night' : 'day')) {
      calendar.set(day, night ? 'night' : 'day')
    }
  } else {
    const data = mechanicState(state, true)
    if (!data.scenarioDate || Number(data.scenarioDate.day) !== day
      || data.scenarioDate.period !== (night ? 'night' : 'day')) {
      data.scenarioDate = { day, period: night ? 'night' : 'day' }
    }
  }
  return { day, night }
}

// ---------------------------------------------------------------------------
// 网格（地点入场 / 连接）
// ---------------------------------------------------------------------------
function syncConnections(state) {
  try {
    connectGrid(state)
  } catch {
    // 纯数据测试没有网格容器时忽略：连接由静态 LOCATION_CONNECTIONS 表覆盖。
  }
  return (state.locations || []).map(location => location.id)
}

function writeGridCell(state, locationId, cell) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[locationId] = {
    x: cell.x, y: cell.y, isolated: false, connections: [...(LOCATION_CONNECTIONS[locationId] || [])],
  }
  const loc = locationOf(state, locationId)
  if (loc) loc.grid = { x: cell.x, y: cell.y }
  return data.grid[locationId]
}

function locationInstance(state, locationId, { revealed }) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const def = clone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state)
    : Number(def.clues) || 0)
  return {
    ...def, id: locationId, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [...(def.connections || [])],
    symbolLinks: [...(LOCATION_CONNECTIONS[locationId] || [])],
    attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
    ...(revealed ? {} : {}),
  }
}

/** 把地点放进网格；优先走引擎 api.place / mechanics.map.place，纯内容层调用时本地建实例。 */
export function placeLocationAt(state, locationId, cell, api = {}, { revealed = false } = {}) {
  writeGridCell(state, locationId, cell)
  const inPlay = locationOf(state, locationId)
  if (!inPlay) {
    const placed = typeof api?.mechanics?.map?.place === 'function'
      ? api.mechanics.map.place(locationId, cell.x, cell.y)
      : null
    if (!placed && !locationOf(state, locationId)) {
      const instance = locationInstance(state, locationId, { revealed })
      if (!instance) return null
      state.locations ||= []
      state.locations.push(instance)
      locationPlaced(state, instance, api)
    }
  }
  const loc = locationOf(state, locationId)
  if (loc) loc.grid = { x: cell.x, y: cell.y }
  if (revealed && loc && loc.revealed !== true) revealLocationLocal(state, loc, api)
  syncConnections(state)
  return locationId
}

function revealLocationLocal(state, loc, api = {}) {
  if (!loc || loc.revealed === true) return false
  loc.revealed = true
  loc.clues = Math.max(0, Number(loc.maxClues) || 0)
  delete loc.hiddenIdentity
  info(api, `「${loc.name}」被揭示。`)
  return true
}

// ---------------------------------------------------------------------------
// 地点底下暗堆（幕 1 背面 6 张 / 法典 Ψ、Ω、Φ 的 3 张 / 水晶残骸被击败的 3 张）
// ---------------------------------------------------------------------------
const stacksOf = state => (state.scenarioZones ||= {}).beneathStacks ||= {}
export function stackAt(state, locationId) {
  return stacksOf(state)[locationId] || []
}
function addStackCards(state, locationId, cards) {
  const stack = stacksOf(state)[locationId] || (stacksOf(state)[locationId] = [])
  stack.push(...cards.map(card => ({ facedown: true, ...card })))
  return stack
}
function replaceStack(state, locationId, cards) {
  stacksOf(state)[locationId] = cards.map(card => ({ facedown: true, ...card }))
  return stacksOf(state)[locationId]
}
export function takeTopBeneath(state, locationId) {
  const stack = stackAt(state, locationId)
  return stack.length ? stack.shift() : null
}
export function putBeneathBottom(state, locationId, card) {
  if (!card) return false
  addStackCards(state, locationId, [card])
  return true
}
function cardKindOf(code) {
  if (CAVE_LOCATION_IDS.includes(code) || HORRORS_POOL_IDS.includes(code)) return 'location'
  if (isCrystalRemainsCode(code)) return 'asset'
  const card = ALL_CARDS[code]
  return card?.type === 'enemy' || card?.type === 'treachery' ? 'encounter' : 'other'
}
function stackCard(code) {
  const kind = cardKindOf(code)
  const card = ALL_CARDS[code]
  // 幕 1 背面的暗牌可能是「地点实例 id」（洞穴地点放一边时存的是 id 而不是卡号）。
  const location = kind === 'location' ? (LOCATIONS[code] || null) : null
  return {
    code, kind, facedown: true,
    name: card?.nameZh || card?.name || location?.printedName || code,
  }
}
const stackLabel = card => card?.name || ALL_CARDS[card?.code]?.nameZh || ALL_CARDS[card?.code]?.name || card?.code || ''

function shuffleWith(source, list) {
  const fn = typeof source === 'function' ? source : source?.shuffle
  if (typeof fn === 'function') return fn([...list])
  return [...list]
}
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
function localShuffle(list, random) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1))
    ;[result[index], result[pick]] = [result[pick], result[index]]
  }
  return result
}
function takeEncounterTop(state, count) {
  const deck = state.encounterDeck || (state.encounterDeck = [])
  const n = Math.min(Math.max(0, count), deck.length)
  const cards = deck.splice(deck.length - n, n).reverse()
  return { cards, short: cards.length < count }
}

// ---------------------------------------------------------------------------
// 岩中恐怖独立牌库 + 水晶残骸暗牌堆
// ---------------------------------------------------------------------------
export function horrorsSetAside(state) {
  state.scenarioZones ||= {}
  state.scenarioZones.horrorsSetAside ||= []
  return state.scenarioZones.horrorsSetAside
}
export function horrorsRemoved(state) {
  state.scenarioZones ||= {}
  state.scenarioZones.horrorsRemoved ||= []
  return state.scenarioZones.horrorsRemoved
}
export function crystalRemainsDeck(state) {
  state.scenarioZones ||= {}
  state.scenarioZones.crystalRemainsDeck ||= []
  return state.scenarioZones.crystalRemainsDeck
}
export function takeCrystalRemains(state) {
  const deck = crystalRemainsDeck(state)
  const code = deck.length ? deck.shift() : null
  if (code) {
    const aside = state.scenarioZones?.setAside
    if (Array.isArray(aside)) {
      const index = aside.indexOf(code)
      if (index >= 0) aside.splice(index, 1)
    }
  }
  return code
}

/** Setup：6 张岩中恐怖地点洗牌，随机 3 张放一边、其余 3 张移出游戏；水晶残骸 3 张洗暗。 */
export function buildHorrorsDeck(state, { shuffle = null } = {}) {
  const pool = shuffleWith(shuffle, [...HORRORS_POOL_IDS])
  const setAside = pool.slice(0, HORRORS_SET_ASIDE_COUNT)
  const removed = pool.slice(HORRORS_SET_ASIDE_COUNT, HORRORS_SET_ASIDE_COUNT + HORRORS_REMOVED_COUNT)
  const remains = shuffleWith(shuffle, [...CRYSTAL_REMAINS_DECK])
  state.scenarioZones ||= {}
  state.scenarioZones.horrorsSetAside = setAside
  state.scenarioZones.horrorsRemoved = removed
  state.scenarioZones.crystalRemainsDeck = remains
  setFlag(state, 'silentHeathHorrorsRemoved', removed)
  return { pool, setAside, removed, remains }
}

// ---------------------------------------------------------------------------
// 居民 / 时间标记卡
// ---------------------------------------------------------------------------
export function residentsInPlay(state) {
  const codes = new Set(Object.values(RESIDENT_ASSETS))
  return (state.storyAssets || []).filter(asset => codes.has(codeOf(asset)))
}
export function residentInPlay(state, key) {
  const code = RESIDENT_ASSETS[key]
  return (state.storyAssets || []).find(asset => codeOf(asset) === code) || null
}
export function putResidentInPlay(state, key, api = {}, { location = null } = {}) {
  const code = RESIDENT_ASSETS[key]
  if (!code) return null
  const existing = residentInPlay(state, key)
  if (existing) return existing
  if (typeof api?.storyAsset === 'function') {
    const spawned = api.storyAsset(code, location)
    if (spawned) return spawned
  }
  const card = ALL_CARDS[code] || {}
  // 居民以剧情资产形式「放在地点」，无控制者；法典/谈判能力由 residents 组条目接管。
  const asset = {
    id: `silentHeath-${code}`, code, originalCode: code,
    name: card.nameZh || card.name || code,
    location, controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}
export function timeMarkerInPlay(state) {
  const codes = new Set(Object.values(TIME_MARKER_CODES))
  return (state.storyAssets || []).find(asset => codes.has(codeOf(asset))) || null
}
export function putTimeMarkerInPlay(state, api = {}) {
  const existing = timeMarkerInPlay(state)
  if (existing) return faceTimeMarker(state, existing)
  const code = TIME_MARKER_CODES[dayOf(state)] || TIME_MARKER_CODES[1]
  if (typeof api?.storyAsset === 'function') {
    const spawned = api.storyAsset(code, null)
    if (spawned) return faceTimeMarker(state, spawned)
  }
  const card = ALL_CARDS[code] || {}
  const marker = {
    id: `silentHeath-timeMarker-${code}`, code, originalCode: code,
    name: card.nameZh || card.name || code, global: true, location: null,
    controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets ||= []
  state.storyAssets.push(marker)
  return faceTimeMarker(state, marker)
}

// 时间标记卡是双面的（Day One / Night One …）：按当前昼夜放到对应面。
function faceTimeMarker(state, marker) {
  if (!marker) return marker
  const card = ALL_CARDS[codeOf(marker)] || {}
  const night = isNight(state)
  marker.face = night ? 'back' : 'front'
  marker.name = night
    ? (card.backNameZh || card.backName || marker.name)
    : (card.nameZh || card.name || marker.name)
  marker.artCode = night ? `${codeOf(marker)}b` : codeOf(marker)
  return marker
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (state.scenarioFlags?.silentHeathPrepared) {
    return state.scenarioFlags.silentHeathReport
  }
  const { day, night } = syncDayAndTime(state, api)
  const intro = introBranchKey(state)
  setFlag(state, 'silentHeathDay', day)
  setFlag(state, 'silentHeathNight', night)
  setFlag(state, 'silentHeathIntro', intro)
  // 幕牌库固定；议程 2 按第 1 日 / 其余选择荒芜 v.I / v.II。
  const actSource = state.scenario?.acts || ACTS
  state.acts = ACT_CODES
    .map(code => actSource.find(act => codeOf(act) === code) || ACTS[ACT_CODES.indexOf(code)])
    .filter(Boolean).map(act => clone(act))
  const agendaSource = state.scenario?.stageCards || STAGE_CARDS
  const agenda2 = day === 1
    ? (agendaSource[DESOLATION_V1_CODE] || AGENDA_STAGES[2])
    : (agendaSource[DESOLATION_V2_CODE] || DESOLATION_V2_STAGE)
  const agenda1 = (state.scenario?.agendas || AGENDAS)
    .find(agenda => codeOf(agenda) === AGENDA1_CODE) || AGENDAS[0]
  state.agendas = [clone(agenda1), clone(agenda2)]
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  const report = {
    day, night, intro,
    actCodes: [...ACT_CODES],
    agendaCodes: [AGENDA1_CODE, day === 1 ? DESOLATION_V1_CODE : DESOLATION_V2_CODE],
    timeMarkerCode: TIME_MARKER_CODES[day] || TIME_MARKER_CODES[1],
  }
  setFlag(state, 'silentHeathReport', report)
  setFlag(state, 'silentHeathPrepared', true)
  info(api, `寂静荒野：第 ${day} 日${night ? '（夜）' : '（昼）'} · 议程 2 = ${
    report.agendaCodes[1] === DESOLATION_V1_CODE ? '荒芜 v.I' : '荒芜 v.II'}。`)
  return report
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  const report = prepareScenario(state, api)
  return { ...report, introText: introFor(state).text }
}

/** 白天/黑夜的开场正文（setup.js#introduction 的章节钩子）。 */
export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : {
    campaign: { records },
    scenarioFlags: context?.scenarioFlags || {},
  }
  const day = dayOf({ ...state, campaign: { records } })
  const night = isNight({ campaign: { records }, scenarioFlags: state.scenarioFlags })
  const keys = night ? ['intro4'] : [day === 3 ? 'intro3' : day === 2 ? 'intro2' : 'intro1', 'intro5']
  const sections = keys
    .map(key => ({ title: htmlTitle(SCENARIO_TEXT.introBranches[key]), paragraphs: htmlParagraphs(SCENARIO_TEXT.introBranches[key]) }))
    .filter(section => section.paragraphs.length)
  const lead = htmlParagraphs(SCENARIO_TEXT.intro)
  if (lead.length) sections.unshift({ title: SCENARIO_TEXT.heading, paragraphs: lead })
  return {
    version: 3, title: sc?.name || scenario.name, sections,
    paragraphs: sections.flatMap(section => section.paragraphs),
    code: ACT1_CODE,
  }
}

const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
function decodeEntities(value) {
  return String(value || '').replace(/&(amp|lt|gt|quot|#39);/g, match => HTML_ENTITIES[match] || match)
}
function htmlParagraphs(value) {
  return decodeEntities(String(value || '')
    .replace(/<\/(?:p|li|h\d)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n'))
    .split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
}
function htmlTitle(value) {
  return htmlParagraphs(value)[0] || ''
}

/** 按当前天数把「第 N 日」遭遇组并入遭遇牌库（Setup #2）。 */
export function modifyDeck(state, deck, events = null, helper = {}) {
  void events
  void helper
  return [...deck, ...dayGroupCards(dayOf(state))]
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.scenarioZones ||= {}
  const shuffle = typeof api.shuffle === 'function'
    ? api.shuffle
    : typeof helper?.shuffle === 'function'
      ? list => helper.shuffle([...list], () => Number(helper?.randomValue?.(state) ?? Math.random()))
      : null
  const report = prepareScenario(state, api)
  const built = buildHorrorsDeck(state, { shuffle })
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  for (const [id, cell] of Object.entries(LOCATION_CELLS)) writeGridCell(state, id, cell)
  info(api, `岩中恐怖独立牌库 ${built.pool.length} 张（放一边 ${built.setAside.length}、移出 ${built.removed.length}）；`
    + `水晶残骸暗牌堆 ${built.remains.length} 张。`)
  setFlag(state, 'silentHeathSetup', { ...report, horrorsSetAside: [...built.setAside], horrorsRemoved: [...built.removed] })
  return [...START_LOCATION_IDS]
}

export function setupEnemies(state, events = null, helper = {}) {
  void state
  void events
  void helper
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const day = dayOf(state)
  const night = isNight(state)
  putTimeMarkerInPlay(state, api)
  if (!night) {
    if (day === 1) putResidentInPlay(state, 'leah', api, { location: RESIDENT_LOCATIONS.leah })
    if (day === 2) putResidentInPlay(state, 'rosa', api, { location: RESIDENT_LOCATIONS.rosa })
    if (day === 3) putResidentInPlay(state, 'motherRachel', api, { location: RESIDENT_LOCATIONS.motherRachel })
    info(api, `白日布置：${residentsInPlay(state).length} 名居民入场，其余居民组移出游戏。`)
  }
  syncInsectKeywords(state, api)
  syncConnections(state)
  return { day, night, residents: residentsInPlay(state).map(asset => codeOf(asset)) }
}

/** 直调/单测入口：准备 + 三张起始地点入场 + 时间标记/居民。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.silentHeathPrepared
  delete state.scenarioFlags.silentHeathReport
  const prepared = prepareScenario(state, api)
  const shuffle = typeof api.shuffle === 'function'
    ? api.shuffle
    : typeof helper?.shuffle === 'function'
      ? list => helper.shuffle([...list], () => Number(helper?.randomValue?.(state) ?? Math.random()))
      : null
  buildHorrorsDeck(state, { shuffle })
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  state.scenarioZones.beneathStacks ||= {}
  for (const id of START_LOCATION_IDS) {
    placeLocationAt(state, id, LOCATION_CELLS[id], api, { revealed: true })
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) {
    state.encounterDeck = [...(state.scenario?.encounterDeck || scenario.encounterDeck || []), ...dayGroupCards(prepared.day)]
  }
  afterDeckSetup(state, null, { api })
  syncConnections(state)
  info(api, `寂静荒野（第 ${prepared.day} 日${prepared.night ? '夜' : '昼'}）：${state.locations.length} 处地点入场。`)
  return { ...prepared, placedIds: [...START_LOCATION_IDS] }
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  if (START_LOCATION_IDS.includes(location.id)) {
    if (!gridPosition(state, location.id)) writeGridCell(state, location.id, LOCATION_CELLS[location.id])
    location.symbolLinks = [...(LOCATION_CONNECTIONS[location.id] || [])]
    // Setup「Put the following locations into play」：起始地点正面朝上入场，不触发「揭示时」能力。
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || 0)
  } else if (!gridPosition(state, location.id)) {
    const cell = state.scenarioFlags?.silentHeathPendingCells?.[location.id]
    if (cell) writeGridCell(state, location.id, cell)
  }
  const cell = gridPosition(state, location.id)
  if (cell) location.grid = { x: cell.x, y: cell.y }
  syncConnections(state)
}

export function locationRevealed(state, location, api = {}, seat = null) {
  if (!location) return false
  syncConnections(state)
  if (location.id === 'ashenSlope') return ashenSlopeReveal(state, location, api, seat)
  if (CAVE_LOCATION_IDS.includes(location.id)) return revealCave(state, location, api, seat)
  return false
}

// ---------------------------------------------------------------------------
// 惨白斜坡 / 洞穴地点 / 法典
// ---------------------------------------------------------------------------
function currentSeatNear(state, seat) {
  return Number.isInteger(seat) ? seat : (state.currentSeat ?? state.campaign?.leadSeat ?? 0)
}

export function ashenSlopeReveal(state, location, api = {}, seat = null) {
  const spec = flagValue('10557', 'revealTest') || { skill: 'agility', difficulty: 4, failDamage: 2 }
  const actor = currentSeatNear(state, seat)
  const inv = (state.investigators || [])[actor]
  if (!inv) return false
  if (typeof api.test !== 'function') return false
  let failed = false
  api.test(actor, spec.skill, spec.difficulty, result => {
    if (result?.success === true) return
    failed = true
    if (typeof api.damage === 'function') api.damage(actor, spec.failDamage)
    else inv.damage = (Number(inv.damage) || 0) + spec.failDamage
    info(api, `惨白斜坡：${inv.name} 的${spec.skill === 'agility' ? '敏捷' : spec.skill}检定失败，受到 ${spec.failDamage} 点伤害。`)
  }, 0, { label: '惨白斜坡：揭示时检定' })
  return failed
}

/** 洞穴地点揭示（Revelation）：幼虫隧道先搜幼虫，再读法典 Ψ/Ω/Φ（生成地点底下暗堆）。 */
export function revealCave(state, location, api = {}, seat = null) {
  const actor = currentSeatNear(state, seat)
  if (flagIs(codeOf(location), 'searchLarva') || location.id === 'larvalTunnel') {
    searchColorlessLarva(state, location.id, api)
  }
  const codexId = flagValue(codeOf(location), 'codex') || CAVE_LOCATION_BY_ID[location.id]?.codex
  if (!codexId) return false
  return readCodex(state, api, codexId, actor, () => makeCodexStack(state, location.id, api))
}

/** 幼虫隧道「搜索遭遇牌库与弃牌堆，找出一张无彩幼虫并生成在此」。 */
export function searchColorlessLarva(state, locationId, api = {}, seat = null) {
  if ((state.enemies || []).some(enemy => codeOf(enemy) === COLORLESS_LARVA_CODE)) return null
  let found = null
  for (const pile of ['encounterDeck', 'encounterDiscard']) {
    const list = state[pile] || []
    const index = list.lastIndexOf(COLORLESS_LARVA_CODE)
    if (index < 0) continue
    list.splice(index, 1)
    found = COLORLESS_LARVA_CODE
    if (pile === 'encounterDeck') info(api, '幼虫隧道：从遭遇牌库找到无彩幼虫。')
    else info(api, '幼虫隧道：从遭遇弃牌堆找到无彩幼虫。')
    break
  }
  if (!found) return null
  const enemy = spawnEnemyAt(state, found, locationId, api, {})
  if (enemy) info(api, `无彩幼虫在「${locationOf(state, locationId)?.name || locationId}」生成。`)
  void seat
  return enemy
}

/** 法典 Ψ/Ω/Φ：拿 1 张暗放的水晶残骸 + 遭遇牌库顶 2 张，洗混后正面朝下放在地点底下。 */
export function makeCodexStack(state, locationId, api = {}) {
  const remains = takeCrystalRemains(state)
  const { cards: encounterCards } = takeEncounterTop(state, 2)
  const codes = [...(remains ? [remains] : []), ...encounterCards]
  if (!codes.length) return []
  const random = randomOf(api)
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle([...codes]) : localShuffle(codes, random)
  const stack = replaceStack(state, locationId, shuffled.map(code => stackCard(code)))
  info(api, `「${locationOf(state, locationId)?.name || locationId}」底下放置 ${stack.length} 张暗牌。`)
  return stack
}

/** 章节法典入口（居民条目/地点条目与测试共用；记录在 records.codexRead）。 */
export function codex(state, id, api = {}) {
  const records = recordsFor(state)
  records.codexRead ||= {}
  const key = codexKey(state, id)
  if (records.codexRead[key]) return false
  if (id === 'motherRachel') {
    records.codexRead[key] = true
    addRelationship(state, 'motherRachel', 1)
    addBonusXp(state, 1, api)
    presentCodex(state, api, SCENARIO_TEXT.codex.motherRachel, '法典 1：母亲瑞秋')
    info(api, '法典 1：母亲瑞秋的关系等级 +1，每位调查员获得 1 点奖励经验。')
    return true
  }
  if (id === 'leahAtwood') {
    records.codexRead[key] = true
    records.leahSearchedThePearlRuins = true
    for (const inv of activeInvestigators(state)) {
      if (typeof api.gainClues === 'function') api.gainClues(inv.seat, 1)
      else inv.clues = (Number(inv.clues) || 0) + 1
    }
    presentCodex(state, api, SCENARIO_TEXT.codex.leahAtwood, '法典 2：莉亚·阿特伍德')
    info(api, '法典 2：记录「莉亚搜索了珀尔废墟」，每位调查员从供应堆获得 1 个线索。')
    return true
  }
  if (id === 'drRosaMarquez') {
    records.codexRead[key] = true
    const act = currentActCode(state)
    const actor = currentSeatNear(state, state.currentSeat)
    if (act === ACT1_CODE) {
      presentCodex(state, api, SCENARIO_TEXT.codex.drRosaMarquez, '法典 Θ：罗莎·马尔克斯（幕 1）')
      if (typeof api.drawCards === 'function') api.drawCards(actor, 3)
      else {
        const inv = state.investigators?.[actor]
        if (inv) inv.hand = [...(inv.hand || []), ...(inv.deck || []).splice(-3).reverse()]
      }
      info(api, '法典 Θ：抽 3 张牌（不同幕可以再次触发本条）。')
      return true
    }
    presentCodex(state, api, SCENARIO_TEXT.codex.drRosaMarquez, '法典 Θ：罗莎·马尔克斯（幕 2）')
    return rosaAct2Effect(state, api, actor)
  }
  if (id === 'larvalTunnel' || id === 'saltChamber' || id === 'crystalNursery') {
    records.codexRead[key] = true
    const textEntry = SCENARIO_TEXT.codex[id]
    presentCodex(state, api, textEntry, `法典 ${id === 'larvalTunnel' ? 'Ψ：幼虫隧道' : id === 'saltChamber' ? 'Ω：盐厅' : 'Φ：水晶温床'}`)
    return true
  }
  if (id === 'broodQueen') {
    records.codexRead[key] = true
    presentCodex(state, api, SCENARIO_TEXT.codex.broodQueen, '法典 Σ：族群虫后')
    const queen = spawnBroodQueen(state, 'codex', api)
    if (!queen || !queen.location) return Boolean(queen)
    for (const entry of [...(state.victoryDisplay || [])]) {
      const card = ALL_CARDS[entry?.originalCode || entry?.code] || entry
      if (card?.type !== 'enemy' || !hasTrait(card, 'Insect')) continue
      const index = state.victoryDisplay.indexOf(entry)
      if (index >= 0) state.victoryDisplay.splice(index, 1)
      spawnEnemyAt(state, entry.originalCode || entry.code, queen.location, api)
      info(api, `法典 Σ：胜利区的「${card.nameZh || card.name || entry.code}」在族群虫后所在地点生成。`)
    }
    return true
  }
  return false
}

function codexKey(state, id) {
  if (id === 'drRosaMarquez') return `${id}:${state.actIndex ?? 0}`
  return id
}

/** 法典 Θ（幕 2）：选择场上一个地点，翻开该地点底下所有暗牌；弃掉诡计，其余任意顺序放回。 */
export function rosaAct2Effect(state, api = {}, seat = null) {
  const candidates = (state.locations || []).filter(location => stackAt(state, location.id).length)
  if (!candidates.length) {
    info(api, '法典 Θ：场上没有带暗堆的地点。')
    return false
  }
  const picked = typeof api.choose === 'function'
    ? api.choose({
      kind: 'location', source: '10566-codex', seat: currentSeatNear(state, seat),
      prompt: '法典 Θ：选择一个地点，翻开它底下的所有暗牌。',
      options: candidates.map(location => ({ id: location.id, label: location.name })),
    })
    : candidates[0].id
  const location = candidates.find(item => item.id === picked) || candidates[0]
  const stack = stackAt(state, location.id)
  const treacheries = stack.filter(card => card.kind === 'encounter' && ALL_CARDS[card.code]?.type === 'treachery')
  const rest = stack.filter(card => !treacheries.includes(card)).map(card => ({ ...card, facedown: true }))
  replaceStack(state, location.id, rest)
  for (const card of treacheries) state.encounterDiscard.push(card.code)
  info(api, `法典 Θ：翻开「${location.name}」底下 ${stack.length} 张暗牌，弃掉 ${treacheries.length} 张诡计。`)
  return true
}

function presentCodex(state, api, entry, fallbackTitle) {
  const body = entry?.body || entry?.act1 || entry?.text || ''
  const title = entry?.title || fallbackTitle
  if (typeof api.present === 'function') {
    api.present(body, { kind: 'story', title, code: '10549', name: title, text: body })
    return
  }
  info(api, `${title}：${htmlParagraphs(body).join(' ')}`)
}

/** 读一条法典：一次性（罗莎按幕）；无引擎法典面板时直接结算 effect。 */
export function readCodex(state, api, id, seat, effect) {
  const resolved = codex(state, id, { ...api, info: () => {} })
  if (!resolved) return false
  try {
    effect?.()
  } finally {
    void seat
  }
  return true
}

export function addRelationship(state, resident, amount = 1) {
  const records = recordsFor(state)
  records.relationships ||= {}
  const key = `${resident}RelationshipLevel`
  const current = Math.max(Number(records.relationships[resident]) || 0, Number(records[key]) || 0)
  const next = Math.max(0, current + amount)
  // 两个读点同写：`relationships[resident]`（P7 各章的通用口径）与
  // `<resident>RelationshipLevel`（引擎 resident-record.js#residentStatus 的居民清单读点）。
  records.relationships[resident] = next
  records[key] = next
  return next
}

export function relationshipLevel(state, resident) {
  const records = recordsFor(state)
  return Number(records[`${resident}RelationshipLevel`]) || Number(records.relationships?.[resident]) || 0
}

export function addBonusXp(state, amount, api = {}) {
  for (const inv of state.investigators || []) {
    if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, amount)
    else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + amount
  }
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
let enemySerial = 0
export function enemyDefinitionFor(code) {
  const def = scenario.enemies?.[code] || {}
  const card = ALL_CARDS[code] || {}
  return { ...card, ...def, code, type: 'enemy', traits: [...(def.traits || card.traits || [])] }
}
export function broodQueenHealth(state) {
  return 5 + dayOf(state) * investigatorCount(state)
}
export function spawnEnemyAt(state, code, locationId, api = {}, options = {}) {
  const def = enemyDefinitionFor(code)
  const spawned = typeof api.spawn === 'function' ? api.spawn(code, locationId, options) : null
  if (spawned) {
    if (isBroodQueenCode(codeOf(spawned))) spawned.health = broodQueenHealth(state)
    return spawned
  }
  if (!def.name && !def.fight && !def.health) return null
  enemySerial += 1
  const enemy = {
    id: `silentHeath-${code}-${enemySerial}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0,
    health: isBroodQueenCode(code) ? broodQueenHealth(state) : (def.health ?? 1),
    damage: def.damage || 0, horror: def.horror || 0,
    traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
    ...(def.elite ? { elite: true } : {}),
    ...(def.hunter ? { hunter: true } : {}),
    ...(def.retaliate ? { retaliate: true } : {}),
    ...(def.aloof ? { aloof: true } : {}),
    ...(def.massive ? { massive: true } : {}),
  }
  if (def.patrolTarget) enemy.patrol = clone(def.patrolTarget)
  state.enemies ||= []
  state.enemies.push(enemy)
  if (isBroodSoldierCode(code) && !enemy.patrol) enemy.patrol = { kind: 'trait', trait: 'Cave', minClues: 1 }
  enemySpawned(state, enemy, api)
  return enemy
}

/** 族群虫后：从放一边区生成到「最多调查员的地点（如可能在[[洞穴]]地点）」。 */
export function spawnBroodQueen(state, source = 'agenda', api = {}) {
  const existing = (state.enemies || []).find(enemy => isBroodQueenCode(codeOf(enemy)))
  if (existing) return existing
  const zones = state.scenarioZones || (state.scenarioZones = {})
  const aside = Array.isArray(zones.setAside) ? zones.setAside : null
  if (aside) {
    const index = aside.indexOf(BROOD_QUEEN_CODE)
    if (index < 0) return null
    aside.splice(index, 1)
  }
  const locationId = broodQueenSpawnLocation(state)
  const queen = spawnEnemyAt(state, BROOD_QUEEN_CODE, locationId, api)
  if (queen) info(api, `族群虫后（来源：${source}）在「${locationOf(state, locationId)?.name || locationId}」生成；`
    + `生命值 ${queen.health}。`)
  syncInsectKeywords(state, api)
  return queen
}

export function broodQueenSpawnLocation(state) {
  const counts = new Map()
  for (const inv of activeInvestigators(state)) {
    if (!inv.location) continue
    counts.set(inv.location, (counts.get(inv.location) || 0) + 1)
  }
  let best = 0
  let candidates = []
  for (const [id, count] of counts) {
    if (count > best) { best = count; candidates = [id] }
    else if (count === best) candidates.push(id)
  }
  const caves = candidates.filter(id => hasTrait(locationOf(state, id), 'Cave'))
  if (caves.length) return caves[0]
  if (candidates.length) return candidates[0]
  const anyCave = (state.locations || []).find(location => hasTrait(location, 'Cave'))
  return anyCave?.id || (state.locations || [])[0]?.id || null
}

export function broodQueenInPlay(state) {
  return (state.enemies || []).find(enemy => isBroodQueenCode(codeOf(enemy))) || null
}

/** 昆虫关键词同步：荒芜 v.I/v.II「失去冷漠」、v.II「获得猎手」、族群虫后所在地点昆虫「失去冷漠」。 */
export function syncInsectKeywords(state, api = {}) {
  const agenda = agendaFlags(state)
  const desolation = new Set([DESOLATION_V1_CODE, DESOLATION_V2_CODE])
  const front = agendaFrontCode(state)
  // 条目 flags 是事实源；条目尚未重建索引时按议程卡号退回同一份印刷文本。
  const losesAloof = desolation.has(front) || agenda.insectsLoseAloof === true
  const gainsHunter = front === DESOLATION_V2_CODE || agenda.insectsGainHunter === true
  const queen = broodQueenInPlay(state)
  let touched = 0
  for (const enemy of insectsInPlay(state)) {
    if (isBroodQueenCode(codeOf(enemy))) continue
    const printed = enemy.printedAloof ?? Boolean(enemy.aloof)
    if (enemy.printedAloof == null) enemy.printedAloof = printed
    if (printed) {
      const atQueen = Boolean(queen && queen.location === enemy.location)
      const enabled = !(losesAloof || atQueen)
      if (typeof api.setEnemyKeywords === 'function') {
        api.setEnemyKeywords(enemy, ['aloof'], { enabled, throughRound: Number(state.round) || 1 })
      } else {
        enemy.aloof = enabled
      }
      touched += 1
    }
    if (gainsHunter && enemy.hunter !== true) enemy.hunter = true
  }
  return touched
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  if (isBroodQueenCode(codeOf(enemy))) {
    enemy.health = broodQueenHealth(state)
    enemy.patrol = null
  }
  if (isBroodSoldierCode(codeOf(enemy)) && !enemy.patrol) {
    enemy.patrol = { kind: 'trait', trait: 'Cave', minClues: 1 }
  }
  syncInsectKeywords(state, api)
}

export function enemyMoved(state, enemy, previous, api = {}) {
  void previous
  if (!enemy) return
  syncInsectKeywords(state, api)
}

export function enemyAttackResolved(state, enemy, inv, api = {}, attack = null) {
  void inv
  void attack
  if (!enemy) return false
  // 10563 无彩幼虫：攻击后击败它。
  if (flagIs(codeOf(enemy), 'defeatAfterAttack')) {
    if (!(state.enemies || []).includes(enemy)) return false
    const defeated = typeof api.defeatEnemy === 'function' ? api.defeatEnemy(enemy) : false
    if (!defeated) {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
    }
    info(api, '无彩幼虫攻击后：击败它。')
    return true
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  void state
  void enemy
  void api
  return false
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || stat !== 'fight') return 0
  if (!isBroodQueenCode(codeOf(enemy))) return 0
  const others = insectsInPlay(state).filter(item => item !== enemy && item.id !== enemy.id)
  const perInsect = Number(scenario.enemies?.[BROOD_QUEEN_CODE]?.fightPerOtherInsect) || 1
  return others.length * perInsect
}

export function locationShroudModifier(state, location) {
  if (!location) return 0
  return (state.enemies || [])
    .filter(enemy => enemy.location === location.id && isBroodSoldierCode(codeOf(enemy)) && !enemy.exhausted)
    .reduce((sum, enemy) => sum + (Number(flagValue(codeOf(enemy), 'readyShroudBonus')) || 2), 0)
}

export function phaseBegan(state, phase, api = {}) {
  void phase
  syncInsectKeywords(state, api)
}

export function roundEnded(state, api = {}) {
  syncInsectKeywords(state, api)
}

// ---------------------------------------------------------------------------
// 行动（幕 2 的暗堆行动 / 水晶果园）
// ---------------------------------------------------------------------------
const groupCluesAt = (state, locationId) => (state.investigators || [])
  .filter(inv => inv.location === locationId && !inv.defeated && !inv.resigned)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of state.investigators || []) {
    if (remaining <= 0) break
    if (inv.location !== locationId || inv.defeated || inv.resigned) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues = (Number(inv.clues) || 0) - pay
    remaining -= pay
  }
  return remaining === 0
}

export function crystalRemainsControlledBy(state, seat) {
  const inv = (state.investigators || [])[seat]
  if (!inv) return []
  return (inv.assets || []).filter(asset => isCrystalRemainsCode(codeOf(asset)))
}

export function crystalRemainsInVictory(state) {
  return (state.victoryDisplay || []).filter(entry => CRYSTAL_REMAINS_CODES.includes(String(entry?.originalCode || entry?.code)))
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const act = currentActCode(state)
  // 幕 2：地点底下的暗堆。
  if (act === ACT2_CODE) {
    const stack = stackAt(state, here.id)
    if (stack.length) {
      if ((Number(here.clues) || 0) === 0) {
        moves.push({
          action: 'scenarioAction', rule: 'silentHeathDrawBeneath', locationId: here.id, actions: 1,
          label: `抽取「${here.name}」底下最顶上的卡牌（该地点没有线索）`,
        })
      } else {
        moves.push({
          action: 'scenarioAction', rule: 'silentHeathDrawBeneath', locationId: here.id, actions: 1,
          reason: '只有在你的地点没有线索时才能抽取底下的卡牌',
        })
      }
      const required = investigatorCount(state)
      const available = groupCluesAt(state, here.id)
      moves.push({
        action: 'scenarioAction', rule: 'silentHeathPeekBeneath', locationId: here.id, actions: 0,
        label: `团队共同花费 ${required} 个线索：查看「${here.name}」底下最顶上的卡牌，可以将其放到牌堆最底下`,
        reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
      })
    }
  }
  // 水晶果园：团队共付 1[per_investigator] 线索，把一张你控制的水晶残骸加入胜利区。
  if (flagIs(codeOf(here), 'crystalGrove') || here.id === 'crystalGrove') {
    const remains = crystalRemainsControlledBy(state, inv.seat)
    const required = investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    if (remains.length) {
      moves.push({
        action: 'scenarioAction', rule: 'silentHeathCrystalGrove', locationId: here.id, actions: 1,
        label: `团队共同花费 ${required} 个线索：将一张你控制的水晶残骸加入胜利区`,
        reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'silentHeathDrawBeneath') return drawBeneathAction(state, inv, api)
  if (move.rule === 'silentHeathPeekBeneath') return peekBeneathAction(state, inv, api)
  if (move.rule === 'silentHeathCrystalGrove') return crystalGroveAction(state, inv, api)
  return false
}

function drawBeneathAction(state, inv, api) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  if ((Number(location.clues) || 0) > 0) return false
  const card = takeTopBeneath(state, location.id)
  if (!card) return false
  info(api, `${inv.name} 抽取「${location.name}」底下的一张暗牌。`)
  if (card.kind === 'location') return drawBeneathLocation(state, inv, card.code, api)
  if (card.kind === 'asset') return giveCrystalRemains(state, inv, card.code, api)
  if (card.kind === 'encounter') {
    state.encounterDeck ||= []
    state.encounterDeck.push(card.code)
    if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
    else resolveEncounterFallback(state, inv, card.code, api)
    return true
  }
  return false
}

function drawBeneathLocation(state, inv, locationId, api) {
  const anchor = inv.location
  const spaces = gridPosition(state, anchor) ? adjacentGridSpaces(state, anchor) : []
  let cell = spaces[0] || null
  if (typeof api?.mechanics?.interactions?.fhv?.grid?.place === 'function') {
    const placed = api.mechanics.interactions.fhv.grid.place(inv.seat, { locationId })
    if (placed) {
      const located = locationOf(state, locationId)
      if (located && located.revealed !== true) {
        if (typeof api.reveal === 'function') api.reveal(locationId, inv.seat)
        else { revealLocationLocal(state, located, api); revealCave(state, located, api, inv.seat) }
      }
      return true
    }
    cell = null
  }
  if (!cell) {
    if (stackAt(state, anchor).length >= 0) putBeneathBottom(state, anchor, stackCard(locationId))
    info(api, '没有与所在地点相邻的空位：该地点不能入场，放回暗堆底下。')
    return false
  }
  const placed = placeLocationAt(state, locationId, cell, api, { revealed: false })
  if (!placed) return false
  const located = locationOf(state, locationId)
  if (typeof api.reveal === 'function') api.reveal(locationId, inv.seat)
  else if (revealLocationLocal(state, located, api)) revealCave(state, located, api, inv.seat)
  info(api, `「${located?.unrevealedName || '岩穴'}」在「${locationOf(state, anchor)?.name || anchor}」旁入场（${cell.x},${cell.y}）。`)
  return true
}

function resolveEncounterFallback(state, inv, code, api) {
  const card = ALL_CARDS[code] || {}
  if (card.type === 'enemy') {
    spawnEnemyAt(state, code, inv.location, api, { engagedSeat: inv.seat })
    return
  }
  state.encounterDiscard ||= []
  state.encounterDiscard.push(code)
  info(api, `揭示了遭遇卡「${card.nameZh || card.name || code}」（直调路径：进入遭遇弃牌堆）。`)
}

function peekBeneathAction(state, inv, api) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  const stack = stackAt(state, location.id)
  if (!stack.length) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, location.id) < required) return false
  spendGroupClues(state, location.id, required)
  const top = stack[0]
  const label = stackLabel(top)
  const choice = typeof api.choose === 'function'
    ? api.choose({
      kind: 'card', source: '10554', seat: inv.seat, canSkip: true,
      prompt: `查看「${location.name}」底下最顶上的卡牌：可以将它放到那堆卡牌最底下。`,
      options: [
        { id: 'leave', label: `留在顶上：${label}` },
        { id: 'bottom', label: `放到最底下：${label}`, cardCode: top.code },
      ],
    })
    : 'leave'
  if (choice === 'bottom') {
    takeTopBeneath(state, location.id)
    putBeneathBottom(state, location.id, top)
    info(api, `${inv.name} 把「${location.name}」底下的「${label}」放到牌堆最底下。`)
  } else {
    info(api, `${inv.name} 查看了「${location.name}」底下的「${label}」，把它留在顶上。`)
  }
  return true
}

function crystalGroveAction(state, inv, api) {
  const location = locationOf(state, inv.location)
  if (!location || !(flagIs(codeOf(location), 'crystalGrove') || location.id === 'crystalGrove')) return false
  const remains = crystalRemainsControlledBy(state, inv.seat)
  if (!remains.length) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, location.id) < required) return false
  spendGroupClues(state, location.id, required)
  const asset = remains[0]
  return sendCrystalRemainsToVictory(state, inv, asset, api)
}

/** 把一张受控水晶残骸加入胜利区（水晶果园行动 / 珀尔庄园撤退）。 */
export function sendCrystalRemainsToVictory(state, inv, asset, api = {}) {
  if (!asset) return false
  const code = codeOf(asset)
  const removed = typeof api.removeAsset === 'function' ? api.removeAsset(inv.seat, asset.id) : null
  if (removed == null) {
    const index = (inv.assets || []).indexOf(asset)
    if (index >= 0) inv.assets.splice(index, 1)
  }
  const added = typeof api.addStoryToVictory === 'function'
    ? api.addStoryToVictory(code, { sourceId: asset.id })
    : null
  if (added == null) {
    state.victoryDisplay ||= []
    if (!state.victoryDisplay.some(entry => entry.id === asset.id)) {
      state.victoryDisplay.push({
        id: asset.id, code, originalCode: code,
        name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
        victory: Number(ALL_CARDS[code]?.victory) || 0,
      })
    }
  }
  info(api, `${inv.name} 把一张水晶残骸加入胜利区。`)
  return true
}

/** 水晶残骸 Revelation：放进该调查员的游戏区域。 */
export function giveCrystalRemains(state, inv, code, api = {}) {
  if (!inv) return false
  const existing = (inv.assets || []).find(asset => codeOf(asset) === code)
  if (existing) return existing
  if (typeof api.giveAsset === 'function') {
    const asset = api.giveAsset(inv.seat, code)
    if (asset) return asset
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `silentHeath-crystalRemains-${code}-${(inv.assets || []).length + 1}`,
    code, originalCode: code, name: card.nameZh || card.name || code,
    controllerSeat: inv.seat, ownerSeat: inv.seat,
    exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [], assets: [],
  }
  inv.assets ||= []
  inv.assets.push(asset)
  info(api, `水晶残骸（${card.subnameZh || card.subname || code}）进入 ${inv.name} 的游戏区域。`)
  return asset
}

// ---------------------------------------------------------------------------
// 水晶残骸：回合开始伤害、被击败时暗堆、撤退时献纳
// ---------------------------------------------------------------------------
export function turnBegins(state, inv, api = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  let handled = false
  for (const asset of [...(inv.assets || [])]) {
    const code = codeOf(asset)
    if (!isCrystalRemainsCode(code)) continue
    if (!(inv.assets || []).includes(asset)) continue
    handled = true
    const turnEffect = flagValue(code, 'turnEffect') || { kind: 'choice', damage: 1, horror: 1 }
    if (turnEffect.kind === 'horror') {
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
      info(api, `水晶残骸（父亲）：${inv.name} 受到 1 点恐惧。`)
    } else if (turnEffect.kind === 'damage') {
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      else inv.damage = (Number(inv.damage) || 0) + 1
      info(api, `水晶残骸（母亲）：${inv.name} 受到 1 点伤害。`)
    } else {
      const choice = typeof api.choose === 'function'
        ? api.choose({
          kind: 'token', source: code, seat: inv.seat,
          prompt: '水晶残骸（孩子）：受到 1 点伤害或 1 点恐惧。',
          options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
        })
        : 'horror'
      if (choice === 'damage') {
        if (typeof api.damage === 'function') api.damage(inv.seat, 1)
        else inv.damage = (Number(inv.damage) || 0) + 1
      } else if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
      info(api, `水晶残骸（孩子）：${inv.name} 受到 1 点${choice === 'damage' ? '伤害' : '恐惧'}。`)
    }
  }
  return handled
}

function assetDefeatedByHarm(asset) {
  const card = ALL_CARDS[codeOf(asset)] || {}
  const health = Number(card.health) || 0
  const sanity = Number(card.sanity) || 0
  return (health > 0 && (Number(asset.damage) || 0) >= health)
    || (sanity > 0 && (Number(asset.horror) || 0) >= sanity)
}

/** 水晶残骸被击败：与遭遇牌库顶 2 张洗混，正面朝下放到最近的[[巢穴]]地点底下。 */
export function assetLeftPlay(state, inv, asset, api = {}) {
  if (!asset || !inv) return false
  const code = codeOf(asset)
  if (!isCrystalRemainsCode(code)) return false
  if (!assetDefeatedByHarm(asset)) return false
  if (inv.defeated || inv.resigned) return false
  const host = nearestLairLocation(state, inv.location)
  if (!host) {
    info(api, '水晶残骸被击败，但场上没有[[巢穴]]地点：无法放置暗堆。')
    return false
  }
  const { cards: encounterCards } = takeEncounterTop(state, 2)
  const cards = [stackCard(code), ...encounterCards.map(item => stackCard(item))]
  const random = randomOf(api)
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle(cards) : localShuffle(cards, random)
  addStackCards(state, host, shuffled)
  // leaveAsset 之后 checkAssetDefeated 还会把该卡推进弃牌堆：标记「已移出」抑制重复去向
  // （卡牌实体已在暗堆里，不再进弃牌堆）。
  asset.removedFromGame = true
  info(api, `水晶残骸被击败：与遭遇牌库顶 2 张洗混，暗放在「${locationOf(state, host)?.name || host}」底下。`)
  return true
}

export function nearestLairLocation(state, fromId) {
  const start = locationOf(state, fromId)
  if (start && hasTrait(start, 'Lair')) return start.id
  const seen = new Set([fromId])
  let frontier = [fromId].filter(Boolean)
  while (frontier.length) {
    const next = []
    for (const id of frontier) {
      const location = locationOf(state, id)
      for (const neighbor of location?.connections || []) {
        if (seen.has(neighbor)) continue
        seen.add(neighbor)
        const target = locationOf(state, neighbor)
        if (target && hasTrait(target, 'Lair')) return neighbor
        next.push(neighbor)
      }
    }
    frontier = next
  }
  return (state.locations || []).find(location => hasTrait(location, 'Lair'))?.id || null
}

export function investigatorEliminated(state, inv, clues, api = {}) {
  void clues
  if (!inv) return false
  // 「撤退。将所有你控制的水晶残骸加入胜利区。」——只在珀尔庄园撤退时触发。
  const resignLocation = locationOf(state, inv.location)
  const resignRule = flagIs(codeOf(resignLocation), 'resignRemains') || inv.location === START_LOCATION
  if (!inv.resigned || !resignRule) return false
  const remains = crystalRemainsControlledBy(state, inv.seat)
  if (!remains.length) return false
  for (const asset of remains) sendCrystalRemainsToVictory(state, inv, asset, api)
  info(api, `${inv.name} 在珀尔庄园废墟撤退：${remains.length} 张水晶残骸加入胜利区。`)
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function allUndefeatedResigned(state) {
  const alive = activeInvestigators(state)
  return alive.length === 0 && (state.investigators || []).some(inv => inv.resigned)
}

export function maybeAdvanceAct2(state, api = {}) {
  if (currentActCode(state) !== ACT2_CODE) return false
  // 印刷目标：每位未被击败的调查员都已撤退，且胜利区至少 1 张水晶残骸。
  if (!allUndefeatedResigned(state)) return false
  if (crystalRemainsInVictory(state).length < 1) return false
  const already = Boolean(state.scenarioFlags?.silentHeathAct2Advancing)
  if (already) return false
  setFlag(state, 'silentHeathAct2Advancing', true)
  info(api, '所有未被击败的调查员都已撤退，且胜利区至少有 1 张水晶残骸：推进幕 2。')
  if (typeof api.advanceAct === 'function') {
    api.advanceAct()
    return true
  }
  const act = currentAct(state)
  return Boolean(actReveal(state, act, api))
}

/** 幕 2 目标（引擎 act-agenda.js 在每次行动后调用）。 */
export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  return maybeAdvanceAct2(state, api)
}

/** 所有未败退调查员撤退时的引擎钩子（在 checkOutcome 之前结算幕 2 目标）。 */
export function allResigned(state, api = {}) {
  syncInsectKeywords(state, api)
  return maybeAdvanceAct2(state, api)
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (flagIs(code, 'warrensBack') || code === ACT1_CODE) return act1Back(state, api)
  if (flagIs(code, 'laidToRest') || code === ACT2_CODE) return act2Back(state, api)
  return false
}

function act1Back(state, api = {}) {
  // 1) 把 3 张放一边的岩中恐怖地点放进 (0,-1)/(1,0)/(2,-1)，未揭示。
  const setAside = horrorsSetAside(state)
  const placedIds = []
  for (const [index, cell] of HORRORS_SET_ASIDE_CELLS.entries()) {
    const id = setAside[index]
    if (!id) break
    const placed = placeLocationAt(state, id, cell, api, { revealed: false })
    if (!placed) continue
    placedIds.push(placed)
  }
  // 2) 洞穴地点（放一边）+ 遭遇牌库顶 3 张：洗混后每个地点暗发 1 张（起始 3 + 新 3）。
  const caveIds = (state.scenarioZones?.setAsideLocations || SET_ASIDE_LOCATION_IDS)
    .filter(id => CAVE_LOCATION_IDS.includes(id))
  const { cards: encounterCards } = takeEncounterTop(state, 3)
  const codes = [...caveIds.slice(0, 3), ...encounterCards]
  const random = randomOf(api)
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle([...codes]) : localShuffle(codes, random)
  const targets = [...START_LOCATION_IDS, ...placedIds]
  const dealt = []
  for (const [index, locationId] of targets.entries()) {
    const code = shuffled[index]
    if (!code) continue
    const kind = cardKindOf(code)
    addStackCards(state, locationId, [{ code, kind }])
    dealt.push({ locationId, code, kind })
    if (kind === 'location') {
      const zones = state.scenarioZones || (state.scenarioZones = {})
      zones.setAsideLocations = (zones.setAsideLocations || []).filter(id => id !== code)
    }
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAsideLocations = (state.scenarioZones.setAsideLocations || [])
    .filter(id => !CAVE_LOCATION_IDS.includes(id))
  setFlag(state, 'silentHeathAct1Back', { placedIds, dealt })
  info(api, `幕 1 背面（兔子洞）：${placedIds.length} 张岩中恐怖地点入场；`
    + `${dealt.length} 张暗牌发到 ${targets.length} 个地点底下。`)
  syncConnections(state)
  return true
}

function act2Back(state, api = {}) {
  const remains = crystalRemainsInVictory(state).length
  const key = remains === 3 ? 'resolution1' : 'resolution2'
  info(api, `幕 2 背面（安息）：胜利区水晶残骸 ${remains} 张 → 结局 ${key.slice(-1)}。`)
  if (typeof api.finish === 'function') {
    api.finish(key)
    return true
  }
  state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) return agenda1Back(state, api)
  if (code === DESOLATION_V1_CODE || code === DESOLATION_V2_CODE) return agenda2Back(state, api)
  return false
}

function agenda1Back(state, api = {}) {
  // 从遭遇牌库顶弃牌直到弃掉一个[[昆虫]]敌人；队长抽取该敌人；遭遇弃牌堆洗回遭遇牌库。
  const discarded = []
  let found = null
  const deck = state.encounterDeck || (state.encounterDeck = [])
  while (deck.length) {
    const code = deck.pop()
    const card = ALL_CARDS[code]
    if (card?.type === 'enemy' && hasTrait(card, 'Insect')) { found = code; break }
    discarded.push(code)
  }
  state.encounterDiscard ||= []
  state.encounterDiscard.push(...discarded)
  if (found) {
    const leadSeat = state.campaign?.leadSeat ?? state.currentSeat ?? 0
    const lead = (state.investigators || [])[leadSeat]
    if (lead && typeof api.drawEncounter === 'function') {
      state.encounterDeck.push(found)
      api.drawEncounter(leadSeat)
    } else if (lead) {
      const enemy = spawnEnemyAt(state, found, lead.location, api, { engagedSeat: lead.seat })
      if (!enemy) state.encounterDiscard.push(found)
    }
    info(api, `不安的宁静（背面）：弃掉 ${discarded.length} 张后找到昆虫敌人「${ALL_CARDS[found]?.nameZh || ALL_CARDS[found]?.name || found}」，由队长抽取。`)
  } else {
    info(api, '不安的宁静（背面）：遭遇牌库里没有昆虫敌人，弃牌堆洗回后继续。')
  }
  const discard = state.encounterDiscard || []
  if (discard.length) {
    state.encounterDeck = [...(state.encounterDeck || []), ...discard]
    state.encounterDiscard = []
    const random = randomOf(api)
    state.encounterDeck = typeof api.shuffle === 'function'
      ? api.shuffle(state.encounterDeck)
      : localShuffle(state.encounterDeck, random)
  }
  return true
}

function agenda2Back(state, api = {}) {
  // 每位调查员承受 1 点肉体创伤并被击败（随后 checkOutcome → 无结局）。
  let count = 0
  for (const inv of activeInvestigators(state)) {
    if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, 'physical', 1)
    else {
      state.campaign ||= {}
      state.campaign.trauma ||= {}
      state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[inv.seat].physical += 1
    }
    if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
    else {
      inv.defeated = true
      inv.defeatCause = 'physical'
    }
    count += 1
  }
  info(api, `荒芜（背面）：${count} 位调查员承受 1 点肉体创伤并被击败。`)
  return true
}

/** 议程正面强制：放置毁灭到本议程时，若族群虫后仍放一边，按胜利区昆虫敌人数揭示标记。 */
export function doomPlaced(state, context = {}, api = {}) {
  if (!context?.agenda || Number(context.amount) <= 0) return false
  const front = agendaFrontCode(state)
  if (!front) return false
  const flags = flagsOf(front)
  const trigger = flags.spawnBroodQueenOnDoom || (front === AGENDA1_CODE ? 'skullOrAutoFail'
    : front === DESOLATION_V1_CODE ? 'symbol' : front === DESOLATION_V2_CODE ? 'symbol' : null)
  if (!trigger) return false
  if ((state.enemies || []).some(enemy => isBroodQueenCode(codeOf(enemy)))) return false
  const aside = state.scenarioZones?.setAside
  if (!Array.isArray(aside) || !aside.includes(BROOD_QUEEN_CODE)) return false
  const count = insectsInVictory(state).length
  if (count <= 0) return false
  if (typeof api.revealToken !== 'function') return false
  const seat = currentSeatNear(state, null)
  const revealed = []
  for (let index = 0; index < count; index++) revealed.push(api.revealToken(seat))
  const symbols = new Set(['skull', 'cultist', 'tablet', 'elderthing'])
  const triggered = trigger === 'skullOrAutoFail'
    ? revealed.some(token => token === 'skull' || token === 'autofail')
    : revealed.some(token => symbols.has(String(token)))
  info(api, `荒芜（正面）：揭示 ${revealed.length} 个混乱标记（${revealed.join('、') || '无'}）`
    + `${triggered ? '，生成放一边的族群虫后' : '，没有达到生成条件'}。`)
  if (!triggered) return false
  spawnBroodQueen(state, 'agenda', api)
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return silentHeathChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace) {
  return silentHeathChaosTokenValue(state, tokenFace)
}

/** 困难/专家 [elder_thing]：在[[巢穴]]地点自动失败。 */
export function testAutoFail(state, inv, context = {}) {
  if (!isHardSide(state)) return false
  const drawn = context?.drawn || []
  if (!drawn.includes('elderthing')) return false
  return atLairLocation(state, inv)
}

function nonEliteEnemiesInVictory(state) {
  return (state.victoryDisplay || []).filter(entry => {
    const card = ALL_CARDS[entry?.originalCode || entry?.code] || entry
    return card?.type === 'enemy' && !hasTrait(card, 'Elite')
  })
}

function shuffleEnemyFromVictory(state, inv, api) {
  const candidates = nonEliteEnemiesInVictory(state)
  if (!candidates.length) {
    info(api, '[cultist]：胜利区没有非[[精英]]敌人，效果不结算。')
    return false
  }
  const picked = candidates.length === 1 || typeof api.choose !== 'function'
    ? candidates[0]
    : candidates.find(entry => entry.id === api.choose({
      kind: 'enemy', source: '10549-token', seat: inv.seat,
      prompt: '[cultist]：选择胜利区的一个非[[精英]]敌人洗回遭遇牌库。',
      options: candidates.map(entry => ({ id: entry.id, label: ALL_CARDS[entry.originalCode || entry.code]?.nameZh || entry.name || entry.code })),
    })) || candidates[0]
  const code = picked.originalCode || picked.code
  const index = (state.victoryDisplay || []).indexOf(picked)
  if (index >= 0) state.victoryDisplay.splice(index, 1)
  if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck([code])
  else {
    state.encounterDeck ||= []
    state.encounterDeck.push(code)
  }
  info(api, `[cultist]：胜利区的「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」洗回遭遇牌库。`)
  return true
}

function insectAttackToken(state, inv, api) {
  const insects = (state.enemies || []).filter(enemy => enemy.location === inv.location && hasTrait(enemy, 'Insect'))
  if (!insects.length) {
    info(api, '[tablet]：你所在地点没有[[昆虫]]敌人。')
    return false
  }
  const target = insects.length === 1 || typeof api.choose !== 'function'
    ? insects[0]
    : insects.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: '10549-token', seat: inv.seat,
      prompt: '[tablet]：选择你所在地点的一个[[昆虫]]敌人，它与你交战并立即攻击。',
      options: insects.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })) || insects[0]
  if (typeof api.engage === 'function') api.engage(target, inv.seat)
  else target.engagedSeat = inv.seat
  if (typeof api.attack === 'function') api.attack(target, inv)
  else inv.damage = (Number(inv.damage) || 0) + (Number(target.damage) || 0)
  info(api, `[tablet]：「${target.name}」与你交战并立即攻击。`)
  return true
}

function insectPhaseToken(state, inv, api) {
  const insects = (state.enemies || []).filter(enemy => hasTrait(enemy, 'Insect'))
  if (!insects.length) {
    info(api, '[tablet]：场上没有[[昆虫]]敌人。')
    return false
  }
  const distance = enemy => {
    const owner = locationOf(state, enemy.location)
    const here = locationOf(state, inv.location)
    if (!owner || !here) return 99
    if (enemy.location === inv.location) return 0
    return (here.connections || []).includes(enemy.location) ? 1 : 2
  }
  insects.sort((left, right) => distance(left) - distance(right))
  const target = insects[0]
  if (typeof api.readyEnemy === 'function') api.readyEnemy(target)
  else target.exhausted = false
  if (target.location !== inv.location) {
    if (typeof api.moveEnemyToward === 'function') api.moveEnemyToward(target, inv.location)
    else if (typeof api.moveEnemy === 'function') api.moveEnemy(target, inv.location)
    else target.location = inv.location
  }
  if (typeof api.resolveEnemyPhaseOf === 'function') api.resolveEnemyPhaseOf(target)
  else if (typeof api.attack === 'function') api.attack(target, inv)
  info(api, `[tablet]：重整最近的[[昆虫]]敌人「${target.name}」，它移动并攻击（如同敌军阶段）。`)
  return true
}

function lairAnotherToken(state, inv, api) {
  if (!atLairLocation(state, inv)) {
    info(api, '[elder_thing]：你不在[[巢穴]]地点，不再揭示标记。')
    return false
  }
  if (typeof api.revealToken !== 'function') return false
  const revealed = api.revealToken(inv.seat)
  const numeric = Number(revealed)
  const delta = Number.isFinite(numeric) ? numeric : (silentHeathChaosTokenValue(state, revealed) ?? 0)
  if (typeof api.addTestValue === 'function') api.addTestValue(delta)
  info(api, `[elder_thing]：你在[[巢穴]]地点，再揭示一个标记（${revealed}，修正 ${delta}）。`)
  return true
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!inv || !effect) return false
  const mode = effect.mode
  const test = effect.test || null
  const succeeded = !test || !Number.isFinite(Number(test.failedBy)) || Number(test.failedBy) <= 0
  if (effect.token === 'cultist') {
    if (mode === 'shuffleVictory') return shuffleEnemyFromVictory(state, inv, api)
    if (mode === 'shuffleVictoryOnSuccess') {
      if (!succeeded) {
        info(api, '[cultist]：检定失败，不能把胜利区的敌人洗回遭遇牌库。')
        return false
      }
      return shuffleEnemyFromVictory(state, inv, api)
    }
    return false
  }
  if (effect.token === 'tablet') {
    if (mode === 'insectAttack') return insectAttackToken(state, inv, api)
    if (mode === 'insectPhase') return insectPhaseToken(state, inv, api)
    return false
  }
  if (effect.token === 'elderthing') {
    if (mode === 'lairAnotherToken') return lairAnotherToken(state, inv, api)
    return false
  }
  return false
}

// ---------------------------------------------------------------------------
// 遭遇事件（诡计条目的 encounterResolve 桥）
// ---------------------------------------------------------------------------
function testSpecFor(code) {
  return testSpecOf(code) || { skill: 'willpower', difficulty: 2 }
}

function runChapterTest(state, api, seat, skill, difficulty, onResult, source = null) {
  if (typeof api.test !== 'function') return null
  let captured = null
  const returned = api.test(seat, skill, difficulty, result => {
    captured = result
    onResult(result)
  }, 0, source)
  return captured || returned || null
}

function failedByOf(result, difficulty) {
  const explicit = Number(result?.failedBy)
  if (Number.isFinite(explicit)) return Math.max(0, explicit)
  const value = Number(result?.value)
  if (Number.isFinite(value)) return Math.max(0, difficulty - value)
  return result?.success === true ? 0 : 1
}

function randomDiscard(state, inv, count, api) {
  if (typeof api.discardRandom === 'function') return api.discardRandom(inv.seat, count)
  let discarded = 0
  for (let index = 0; index < count; index++) {
    if (!(inv.hand || []).length) break
    const pick = Math.floor(randomOf(api)() * inv.hand.length)
    const [code] = inv.hand.splice(pick, 1)
    inv.discard ||= []
    inv.discard.push(code)
    discarded += 1
  }
  return discarded
}

function nearestInsectTo(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return null
  const insects = (state.enemies || []).filter(enemy => hasTrait(enemy, 'Insect'))
  if (!insects.length) return null
  const rank = enemy => {
    if (enemy.location === inv.location) return 0
    if ((here.connections || []).includes(enemy.location)) return 1
    return 2
  }
  insects.sort((left, right) => rank(left) - rank(right))
  return insects[0]
}

function moveInsectToInvestigator(state, inv, enemy, api) {
  let guard = 0
  while (enemy.location !== inv.location && guard < 8) {
    const from = locationOf(state, enemy.location)
    const path = from?.connections || []
    const step = path.includes(inv.location) ? inv.location
      : path.find(id => locationOf(state, id)) || null
    if (!step) break
    if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, step)
    else enemy.location = step
    guard += 1
  }
}

/** 10561 号令共振：意志(3)，失败每 1 点选一个不同选项（伤害 / 随机弃牌 / 最近昆虫攻击）。 */
export function commandingResonance(state, inv, api = {}) {
  if (!inv) return false
  const spec = testSpecFor(COMMANDING_RESONANCE_CODE)
  const difficulty = Number(spec.difficulty) || 3
  runChapterTest(state, api, inv.seat, spec.skill || 'willpower', difficulty, result => {
    const failedBy = failedByOf(result, difficulty)
    if (failedBy <= 0) {
      info(api, '号令共振：检定成功。')
      return
    }
    const used = new Set()
    for (let index = 0; index < failedBy; index++) {
      const options = []
      if (!used.has('damage')) options.push('damage')
      if (!used.has('discard') && (inv.hand || []).length) options.push('discard')
      if (!used.has('insect') && nearestInsectTo(state, inv)) options.push('insect')
      if (!options.length) break
      const choice = typeof api.choose === 'function'
        ? api.choose({
          kind: 'effect', source: COMMANDING_RESONANCE_CODE, seat: inv.seat,
          prompt: `号令共振：失败 ${failedBy} 点，选择第 ${index + 1} 个不同的选项。`,
          options: options.map(id => ({
            id,
            label: id === 'damage' ? '受到 1 点伤害'
              : id === 'discard' ? '随机弃掉 1 张手牌' : '最近的[[昆虫]]敌人重整、移动、交战并攻击',
          })),
        })
        : options[0]
      const picked = options.includes(choice) ? choice : options[0]
      used.add(picked)
      if (picked === 'damage') {
        if (typeof api.damage === 'function') api.damage(inv.seat, 1)
        else inv.damage = (Number(inv.damage) || 0) + 1
        info(api, '号令共振：受到 1 点伤害。')
      } else if (picked === 'discard') {
        randomDiscard(state, inv, 1, api)
        info(api, '号令共振：随机弃掉 1 张手牌。')
      } else {
        const enemy = nearestInsectTo(state, inv)
        if (!enemy) continue
        if (typeof api.readyEnemy === 'function') api.readyEnemy(enemy)
        else enemy.exhausted = false
        moveInsectToInvestigator(state, inv, enemy, api)
        if (typeof api.engage === 'function') api.engage(enemy, inv.seat)
        else enemy.engagedSeat = inv.seat
        if (typeof api.attack === 'function') api.attack(enemy, inv)
        info(api, `号令共振：最近的[[昆虫]]敌人「${enemy.name}」重整、移动、交战并攻击。`)
      }
    }
  }, { label: '号令共振' })
  return true
}

/** 10562 保卫虫巢：智识(2)，每个[[巢穴]]地点 +1 难度；失败在最近昆虫敌人上放 1 毁灭，否则 2 恐惧。 */
export function defendTheNest(state, inv, api = {}) {
  if (!inv) return false
  const spec = testSpecFor(DEFEND_THE_NEST_CODE)
  const lairs = (state.locations || []).filter(location => hasTrait(location, 'Lair')).length
  const difficulty = (Number(spec.difficulty) || 2) + lairs * (Number(spec.difficultyPerLair) || 1)
  runChapterTest(state, api, inv.seat, spec.skill || 'intellect', difficulty, result => {
    const failedBy = failedByOf(result, difficulty)
    if (failedBy <= 0) {
      info(api, '保卫虫巢：检定成功。')
      return
    }
    const enemy = nearestInsectTo(state, inv)
    if (enemy) {
      if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(enemy, 1)
      else enemy.doom = (Number(enemy.doom) || 0) + 1
      info(api, `保卫虫巢：在「${enemy.name}」上放置 1 个毁灭标记（场上 ${lairs} 个[[巢穴]]地点）。`)
      return
    }
    if (typeof api.horror === 'function') api.horror(inv.seat, 2)
    else inv.horror = (Number(inv.horror) || 0) + 2
    info(api, '保卫虫巢：最近的[[昆虫]]敌人不存在，改为受到 2 点恐惧。')
  }, { label: '保卫虫巢' })
  return true
}

export const events = {
  silentHeathCommandingResonance(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return commandingResonance(state, inv, api)
  },
  silentHeathDefendTheNest(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return defendTheNest(state, inv, api)
  },
  silentHeathCodexMotherRachel(state, payload = {}, api = {}) {
    return codex(state, 'motherRachel', { ...api, seat: payload.seat })
  },
  silentHeathCodexLeahAtwood(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'leahAtwood', api)
  },
  silentHeathCodexDrRosaMarquez(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'drRosaMarquez', api)
  },
  silentHeathCodexLarvalTunnel(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'larvalTunnel', api)
  },
  silentHeathCodexSaltChamber(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'saltChamber', api)
  },
  silentHeathCodexCrystalNursery(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'crystalNursery', api)
  },
  silentHeathCodexBroodQueen(state, payload = {}, api = {}) {
    void payload
    return codex(state, 'broodQueen', api)
  },
  silentHeathCrystalRemainsDefeated(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    const asset = (inv?.assets || []).find(item => codeOf(item) === String(payload.code))
    return asset ? assetLeftPlay(state, inv, asset, api) : false
  },
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
// 印刷的结局链：R1 → R3 → R4；R2 → R3 → R4；R3 → R4；R4 结束。
// 无结局按胜利区水晶残骸张数分流：3 → R1、1–2 → R2、0 → R4。
const RESOLUTION_CHAIN = Object.freeze({
  resolution1: Object.freeze(['resolution1', 'resolution3', 'resolution4']),
  resolution2: Object.freeze(['resolution2', 'resolution3', 'resolution4']),
  resolution3: Object.freeze(['resolution3', 'resolution4']),
  resolution4: Object.freeze(['resolution4']),
})

const RESOLUTION_STEPS = Object.freeze({
  resolution1: { record: 'theInvestigatorsLaidThePearlFamilyToRest', log: '记录「调查员们让珀尔家族安息」。' },
  resolution2: { record: 'theRemainsWerePartiallyRecovered', log: '记录「遗骸被部分回收」。' },
  resolution3: { record: 'madamePearlsDiaryWasRecovered', log: '记录「珀尔夫人的日记被找回」。' },
  resolution4: { log: '在「已勘察区域」勾选珀尔岭。' },
})

export function resolutionChainForKey(state, key) {
  if (key !== 'noResolution') return [...(RESOLUTION_CHAIN[key] || [])]
  const remains = crystalRemainsInVictory(state).length
  if (remains === 3) return [...RESOLUTION_CHAIN.resolution1]
  if (remains >= 1) return [...RESOLUTION_CHAIN.resolution2]
  return [...RESOLUTION_CHAIN.resolution4]
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const records = recordsFor(state)
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const chain = resolutionChainForKey(state, finalKey)
  if (!chain.length) throw new RangeError(`未知结局：${key}`)
  records.silentHeathResolution = finalKey
  records.silentHeathResolvedTo = chain[chain.length - 1]
  if (finalKey === 'noResolution') records.silentHeathNoResolution = true
  for (const step of chain) {
    const config = RESOLUTION_STEPS[step]
    if (!config) continue
    if (config.record) records[config.record] = true
    info(infoApi, `结局 ${step.slice(-1)}：${config.log}`)
  }
  if (chain.includes('resolution4')) {
    records.areasSurveyed ||= {}
    records.areasSurveyed.pearlRidge = true
    records.pearlRidgeSurveyed = true
    info(infoApi, '结局 4：每位调查员获得等于胜利区每张卡 Victory X 的经验，并勾选珀尔岭。')
  }
  // R4 的经验由引擎按 state.victory 结算；这里只返回 0 奖励，避免重复计分。
  return { bonus: 0, award: true }
}

// ---------------------------------------------------------------------------
// 只读投影（测试 / 主进程验收）
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    day: dayOf(state),
    night: isNight(state),
    intro: introBranchKey(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    insects: insectCount(state),
    skull: skullValue(state),
    crystalRemainsInVictory: crystalRemainsInVictory(state).length,
    crystalRemainsDeck: crystalRemainsDeck(state).length,
    horrorsSetAside: [...horrorsSetAside(state)],
    broodQueenInPlay: Boolean(broodQueenInPlay(state)),
    stacks: Object.fromEntries(Object.entries(state.scenarioZones?.beneathStacks || {})
      .map(([id, stack]) => [id, stack.length])),
  }
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  // 起始三地点由 locationPlaced 显式翻面；新地点（幕 1 背面/洞穴）保持未揭示。
  locationsStartRevealed: false,
  // 幕 1 只在回合结束时由「位于珀尔庄园废墟的调查员共同支付 2[per_investigator] 线索」推进。
  roundEndActIndex: 0,
  introduction,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  modifyDeck,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  locationPlaced,
  locationRevealed,
  actions,
  performAction,
  turnBegins,
  assetLeftPlay,
  investigatorEliminated,
  enemySpawned,
  enemyMoved,
  enemyAttackResolved,
  enemyDefeated,
  enemyStatModifier,
  locationShroudModifier,
  phaseBegan,
  roundEnded,
  doomPlaced,
  actReveal,
  agendaReveal,
  checkObjectives,
  allResigned,
  resolveChaosToken,
  chaosTokenValue,
  testAutoFail,
  applyTokenEffect,
  events,
  codex,
  resolution,
  scenarioSummary,
  // 具名助手（测试与主进程验收用）
  dayOf,
  isNight,
  introFor,
  introBranchKey,
  syncDayAndTime,
  placeLocationAt,
  stackAt,
  takeTopBeneath,
  putBeneathBottom,
  buildHorrorsDeck,
  horrorsSetAside,
  horrorsRemoved,
  crystalRemainsDeck,
  makeCodexStack,
  revealCave,
  searchColorlessLarva,
  residentsInPlay,
  residentInPlay,
  putResidentInPlay,
  putTimeMarkerInPlay,
  timeMarkerInPlay,
  crystalRemainsControlledBy,
  crystalRemainsInVictory,
  sendCrystalRemainsToVictory,
  giveCrystalRemains,
  spawnBroodQueen,
  spawnEnemyAt,
  broodQueenInPlay,
  broodQueenSpawnLocation,
  broodQueenHealth,
  syncInsectKeywords,
  nearestLairLocation,
  allUndefeatedResigned,
  maybeAdvanceAct2,
  relationshipLevel,
  addRelationship,
  addBonusXp,
  rosaAct2Effect,
  commandingResonance,
  defendTheNest,
  resolutionChainForKey,
  locationOf,
  neighborsOf,
}

export function neighborsOf(state, locationId) {
  return (locationOf(state, locationId)?.connections || []).filter(id => locationOf(state, id))
}

export { ACT_CODES, AGENDA_CODES, AGENDAS, ACTS, START_LOCATION, SET_ASIDE_CARDS, CRYSTAL_REMAINS_CODES }
