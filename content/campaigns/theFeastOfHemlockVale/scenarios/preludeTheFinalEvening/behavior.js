// 最终之夜（preludeTheFinalEvening · 10679b）· 引擎钩子（序曲流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/PreludeTheFinalEvening.hs（PreScenarioSetup /
//       Setup / ScenarioSpecific "codex" / ScenarioResolution）+ Campaigns/.../Helpers.hs
//       （getCrossedOutResidents / placeResident / recruitResident / flipResidentToEnemy）+
//       TokenHelpers.hs（序曲混乱标记）。
//
// 引擎读点（全部走既有钩子，不改引擎、不新增状态字段）：
//   startLocation → 盛宴被打断时从旅舍开始，否则从十字路口开始
//   preScenarioSetup → 序章：马奎兹有计划 → 三选一（真话/谎话/判处死刑）→ 混乱标记与战役记录
//   setupLocations / setupEnemies / afterDeckSetup → 八处地点、狂乱的赴宴者、六位在场居民
//       （关系等级 ≤ 阈值时翻到敌人面）、伯蒂（显灵时）、马奎兹（被打断时）、时间指示卡（第三夜）、
//       日历（第三日夜）、初始毁灭（= 调查员人数）
//   codexEntry（= events.preludeTheFinalEveningCodex）→ 法典 1–16 / Θ / Ω 的印刷结算
//   checkObjectives / enemyDefeated / actReveal / agendaReveal → 幕·议程目标、蕾切尔被击败、
//       待宰羔羊议程的居民胜利区目标
//   resolveChaosToken / applyTokenEffect / afterTest → 10704 的四个符号（谈判分支 + 躲避居民进胜利区）
//   resolution / scenarioResolution / allResigned → 四个结局与重玩/输掉战役
//
// 契约：只读 state，写变更走 `api.*`（无 api 时写内容层已声明的引擎读点：campaign.records、
// scenarioFlags.mechanics、campaign.chaosBag、地点的敌人/剧情资产数组）。不 import engine.js。
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { recordSetAdd, recordSetValues } from '../../../../../src/campaign/record-sets.js'
import {
  ACT_CODES, ACT_STAGES, AGENDAS, AGENDA_CODES, AGENDA_STAGES,
  BERTIE_ENEMY_CODE, CODEX_BONUS_XP, CODEX_BY_ID, CODEX_IDS, DAY_NUMBER, DR_MARQUEZ_CODE,
  FRENZIED_REVELER_CODE, FRENZIED_REVELER_SPAWN, LOCATION_CONNECTIONS, LOCATION_IDS, LOCATIONS,
  NEXT_SCENARIO_ID, NO_RESOLUTION, PRELUDE_DATE, PRELUDE_DATE_RECORD, RECORD_KEYS,
  REMOVED_LOCATION_CODES, RESIDENT_ASSET_CODES, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ENEMY_CODE,
  RESIDENT_BY_ID, RESIDENT_MAX_RELATIONSHIP, RESIDENT_PLACEMENT_ORDER,
  RESIDENTS, RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_CARDS, SET_ASIDE_RESIDENT_IDS, SPECIAL_AGENDA_CODE,
  SPECIAL_AGENDA_DOOM_THRESHOLD, SPECIAL_AGENDA_RESIDENT_VICTORY_BASE,
  SPECIAL_AGENDA_RESIDENT_VICTORY_PER_INVESTIGATOR, SPECIAL_AGENDA_STAGE, START_LOCATION,
  START_LOCATION_WHEN_INTERRUPTED, STEP_CODE, THE_ATWOOD_HOUSE_ID, THE_CROSSROADS_ID,
  THEATWOOD_HASHING_RECORD, TIME_MARKER, TIME_MARKER_CODE, scenario as SCENARIO,
} from './definition.js'
import { isHardSide, isParleyAttempt, theFinalEveningChaosToken, theFinalEveningChaosTokenValue } from './chaos.js'

const CHAPTER_ID = 'preludeTheFinalEvening'
const CODEX_EVENT_ID = 'preludeTheFinalEveningCodex'
const ATWOOD_HOUSE_ENTRY = 'theAtwoodHouse'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators)
  || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const present = (api, text, title) => {
  if (typeof api?.present === 'function') {
    api.present(text, { kind: 'story', title, code: STEP_CODE, name: title, text })
    return
  }
  info(api, `${title}：${text}`)
}
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
// 引擎 mechanicState 的存档形状要求 version:1（mechanic-state.js#validateMechanicState）。
const mechanicsFor = state => {
  const mechanics = flagsFor(state).mechanics ||= { version: 1 }
  mechanics.version ||= 1
  return mechanics
}
const clone = value => JSON.parse(JSON.stringify(value))
const codeOf = card => String(card?.originalCode || card?.code || '')
const locationById = (state, id) => (state.locations || []).find(loc => loc.id === id) || null
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const pick = (api, request, fallback) => {
  if (typeof api?.choose !== 'function' || !request?.options?.length) return fallback
  const answer = api.choose(request)
  return request.options.some(option => String(option.id) === String(answer)) ? answer : fallback
}
const entryFlagsOf = code => registeredEntry(String(code))?.flags || {}

/** 记录读点：布尔记录为 true（false/0/缺失都算未记录）。 */
export const recordTrue = (state, key) => {
  const value = recordsFor(state)[key]
  return value === true || value === 1
}
/** 记录写点：写 campaign.records（引擎读点）并转发 api.setCampaignRecord。 */
export function setRecord(state, key, value, api = {}) {
  recordsFor(state)[key] = value
  safeCall(api, 'setCampaignRecord', key, value)
  return value
}
/** 集合记录（居民笔记 / 已读法典）：唯一事实源是 campaign.records[key] 数组。 */
export const recordValues = (state, key) => {
  recordsFor(state)
  return recordSetValues(state.campaign, key)
}
export const recordAdd = (state, key, value, api = {}) => {
  recordsFor(state)
  const added = recordSetAdd(state.campaign, key, value)
  if (added) safeCall(api, 'campaignRecord', key, value)
  return added
}

// ---------------------------------------------------------------------------
// 居民：关系等级 / 笔记 / 划掉
// ---------------------------------------------------------------------------
export const residentOf = id => RESIDENT_BY_ID[String(id)] || null
export const residentByCode = code => RESIDENT_BY_ASSET_CODE[String(code)]
  || RESIDENT_BY_ENEMY_CODE[String(code)] || null

/** 关系等级（0–5）：`<居民>RelationshipLevel` 是引擎 resident-record.js 的读点。 */
export function relationshipLevel(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident) return 0
  const records = recordsFor(state)
  const raw = records[resident.record.level] ?? records.relationships?.[resident.id]
  const level = Number(raw)
  return Number.isFinite(level) ? Math.max(0, Math.min(RESIDENT_MAX_RELATIONSHIP, Math.trunc(level))) : 0
}

function writeRelationship(state, resident, next) {
  const records = recordsFor(state)
  // 双写：`<居民>RelationshipLevel`（引擎居民读点）与 `relationships[<居民 id>]`（P7 各章通用口径）。
  records[resident.record.level] = next
  records.relationships ||= {}
  records.relationships[resident.id] = next
  return next
}

/** 增减关系等级（印刷：每次增减一格；被划掉的居民不再变化）。 */
export function changeRelationship(state, residentId, delta = 1, api = {}) {
  const resident = residentOf(residentId)
  if (!resident || !Number.isFinite(Number(delta)) || Number(delta) === 0) return null
  if (isResidentCrossedOut(state, resident.id)) return null
  const current = relationshipLevel(state, resident.id)
  const next = Math.max(0, Math.min(RESIDENT_MAX_RELATIONSHIP, current + Math.trunc(Number(delta))))
  writeRelationship(state, resident, next)
  info(api, `「${resident.name}」的关系等级 ${current} → ${next}。`)
  return next
}

/** 把关系等级设为指定值（印刷「Set … to 0」）。 */
export function setRelationshipLevel(state, residentId, value, api = {}) {
  const resident = residentOf(residentId)
  if (!resident) return null
  const next = Math.max(0, Math.min(RESIDENT_MAX_RELATIONSHIP, Math.trunc(Number(value) || 0)))
  writeRelationship(state, resident, next)
  info(api, `「${resident.name}」的关系等级设为 ${next}。`)
  return next
}

/** 居民笔记（campaign.records[<居民>Notes] 集合）。 */
export const residentNotes = (state, residentId) => {
  const resident = residentOf(residentId)
  return resident ? recordValues(state, resident.record.notes) : []
}
export const hasResidentNote = (state, residentId, note) =>
  residentNotes(state, residentId).includes(String(note))

/** 写一条居民笔记（法典/剧情记录）。 */
export function addResidentNote(state, residentId, note, api = {}) {
  const resident = residentOf(residentId)
  if (!resident || !note) return false
  if (isResidentCrossedOut(state, resident.id)) return false
  return recordAdd(state, resident.record.notes, String(note), api)
}

export function isResidentCrossedOut(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident) return false
  return recordsFor(state)[resident.record.crossedOut] === true
}

/** 划掉一位居民（名字被划掉的居民不能进场，其笔记一并作废）。 */
export function crossOutResident(state, residentId, api = {}) {
  const resident = residentOf(residentId)
  if (!resident || isResidentCrossedOut(state, resident.id)) return false
  setRecord(state, resident.record.crossedOut, true, api)
  info(api, `划掉居民「${resident.name}」。`)
  return true
}

/** 场上（或某位调查员控制下）的居民资产。 */
export function residentAssetInPlay(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident) return null
  const inStory = (state.storyAssets || []).find(asset => codeOf(asset) === resident.assetCode)
  if (inStory) return inStory
  for (const inv of state.investigators || []) {
    const owned = (inv.assets || []).find(asset => codeOf(asset) === resident.assetCode)
    if (owned) return { ...owned, ownerSeat: inv.seat }
  }
  return null
}

/** 画面朝上的居民敌人。 */
export const residentEnemyInPlay = (state, residentId) => {
  const resident = residentOf(residentId)
  if (!resident?.enemyCode) return null
  return (state.enemies || []).find(enemy => codeOf(enemy) === resident.enemyCode
    && !enemy.defeated && !enemy.removed) || null
}

// ---------------------------------------------------------------------------
// 地点 / 敌人 / 剧情资产 / 混乱袋
// ---------------------------------------------------------------------------
export function setupLocationIds() {
  // 参考 Setup 的 place 顺序（十字路口与老磨坊使用 Day of the Feast 的傍晚面）。
  return ['boardingHouse', THE_CROSSROADS_ID, 'hemlockChapel', THE_ATWOOD_HOUSE_ID,
    'tadsGeneralStore', 'valeSchoolhouse', 'theCommons', 'theOldMill']
}

const locationDefinition = (state, id) => state.scenario?.locations?.[id] || LOCATIONS[id] || null

export function ensureLocation(state, id, api = {}) {
  const existing = locationById(state, id)
  if (existing) return existing
  const definition = locationDefinition(state, id)
  if (!definition) return null
  const count = investigatorCount(state)
  const clues = definition.cluesFixed
    ? (Number(definition.clues) || 0)
    : (Number(definition.cluesPerInvestigator ?? definition.clues) || 0) * count
  const runtime = { ...clone(definition), id, revealed: true, clues, maxClues: clues,
    doom: 0, damage: 0, horror: 0, resources: 0 }
  state.locations ||= []
  state.locations.push(runtime)
  safeCall(api, 'setLocationFlag', id, 'symbol', runtime.symbol || null)
  return runtime
}

export function enemyDefinitionFor(state, code) {
  return state.scenario?.enemies?.[code] || SCENARIO.enemies?.[code] || {}
}

let enemySerial = 0
export function spawnEnemyAt(state, code, locationId, api = {}, extra = {}) {
  const spawned = typeof api.spawn === 'function' ? api.spawn(code, locationId, { ...extra }) : null
  if (spawned) {
    if (Object.keys(extra).length) Object.assign(spawned, extra)
    return spawned
  }
  const definition = enemyDefinitionFor(state, code)
  const health = Number(definition.health) || null
  const enemy = {
    id: `preludeEnemy-${code}-${enemySerial += 1}`, code, originalCode: code,
    name: definition.name || code, nameEn: definition.nameEn || definition.name || code,
    traits: [...(definition.traits || [])], fight: definition.fight ?? null,
    evade: definition.evade ?? null, health, healthRemaining: health,
    damage: Number(definition.damage) || 0, horror: Number(definition.horror) || 0,
    location: locationId, exhausted: false, engagedSeat: null, damageTaken: 0, ...extra,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

export function placeStoryAssetAt(state, code, locationId, api = {}, extra = {}) {
  const placed = typeof api.storyAsset === 'function' ? api.storyAsset(code, locationId) : null
  if (placed) return placed
  const existing = (state.storyAssets || []).find(asset => codeOf(asset) === code)
  if (existing) return existing
  const definition = state.scenario?.storyAssets?.[code] || SCENARIO.storyAssets?.[code] || {}
  const asset = {
    id: `preludeStory-${code}`, code, originalCode: code,
    name: definition.name || code, nameEn: definition.nameEn || definition.name || code,
    location: locationId, controllerSeat: null,
    ...(definition.traits ? { traits: [...definition.traits] } : {}), ...extra,
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}

function ensureChaosBags(state) {
  state.chaosBag = Array.isArray(state.chaosBag) ? state.chaosBag : []
  state.campaign ||= {}
  state.campaign.chaosBag = Array.isArray(state.campaign.chaosBag)
    ? state.campaign.chaosBag : [...state.chaosBag]
}

/** 「在战役余下时间」加混乱标记：changeChaosBag 的 permanent 口径（bag + campaignBag 双写）。 */
export function addChaosToken(state, token, amount = 1) {
  const times = Math.max(0, Math.trunc(Number(amount) || 0))
  if (!times) return 0
  ensureChaosBags(state)
  try {
    changeChaosBag(state, token, times, { permanent: true })
  } catch {
    for (let index = 0; index < times; index += 1) {
      state.chaosBag.push(token)
      state.campaign.chaosBag.push(token)
    }
  }
  return times
}

export const chaosBagCounts = state => (Array.isArray(state?.chaosBag) ? state.chaosBag : [])
  .reduce((totals, token) => ({ ...totals, [token]: (totals[token] || 0) + 1 }), {})

// ---------------------------------------------------------------------------
// 日历：第三日 / 夜（时间指示卡的「第三夜」面）
// ---------------------------------------------------------------------------
export function setPreludeDate(state, api = {}) {
  const { day, period } = PRELUDE_DATE
  const calendar = api?.mechanics?.calendar
  if (typeof calendar?.set === 'function') calendar.set(day, period)
  mechanicsFor(state).scenarioDate = { day, period }
  setRecord(state, PRELUDE_DATE_RECORD, `${day}:${period}`, api)
  return { day, period }
}

export function scenarioDateOf(state) {
  const date = mechanicsFor(state).scenarioDate
  if (date) return { day: Number(date.day), period: String(date.period) }
  const raw = recordsFor(state)[PRELUDE_DATE_RECORD]
  if (typeof raw === 'string') {
    const [day, period] = raw.split(':')
    if (Number(day)) return { day: Number(day), period }
  }
  return { ...PRELUDE_DATE }
}

// ---------------------------------------------------------------------------
// 序章（PreScenarioSetup）
// ---------------------------------------------------------------------------
export const introHasPlan = state => recordTrue(state, RECORD_KEYS.drMarquezHasAPlan)
export const believed = state => recordTrue(state, RECORD_KEYS.believed)
export const liedToMotherRachel = state => recordTrue(state, RECORD_KEYS.lied)
export const interrupted = state => recordTrue(state, RECORD_KEYS.interrupted)

/** 序章分支：有「马奎兹有计划」才进 Intro 2；关系等级 ≥3 才能说「你没有任何错」。 */
export function introPlan(state) {
  const hasPlan = introHasPlan(state)
  const motherRel = relationshipLevel(state, 'motherRachel')
  if (!hasPlan) {
    return { hasPlan, motherRel, intro: 'intro5', options: ['sentencedToDeath'], tokens: ['tablet', 'elderthing'] }
  }
  const options = []
  if (motherRel >= 3) options.push('doneNothingWrongTruth', 'doneNothingWrongLie')
  options.push('sentencedToDeath')
  return { hasPlan, motherRel, intro: 'intro2', options, tokens: [] }
}

const INTRO_TOKENS = Object.freeze({
  doneNothingWrongTruth: Object.freeze(['cultist']),
  doneNothingWrongLie: Object.freeze(['cultist', 'elderthing']),
  sentencedToDeath: Object.freeze(['tablet', 'elderthing']),
})
const INTRO_RECORDS = Object.freeze({
  doneNothingWrongTruth: RECORD_KEYS.believed,
  doneNothingWrongLie: RECORD_KEYS.lied,
  sentencedToDeath: RECORD_KEYS.interrupted,
})

/** 序章选择 → 混乱标记 + 战役记录；返回 { choice, tokens, records }。 */
export function applyIntroChoice(state, choice, api = {}) {
  const key = INTRO_TOKENS[choice] ? choice : 'sentencedToDeath'
  const tokens = [...INTRO_TOKENS[key]]
  setFlag(state, 'preludeIntroChoice', key)
  setFlag(state, 'preludeIntroTokens', tokens)
  setRecord(state, INTRO_RECORDS[key], true, api)
  if (key === 'doneNothingWrongTruth') removeDrMarquezFromDecks(state, api)
  info(api, `序章：${key} → 混乱袋加入 ${tokens.join('、')}（持续到战役结束）。`)
  return { choice: key, tokens, records: [INTRO_RECORDS[key]] }
}

/** 真话分支：搜索每位调查员的牌组，把罗莎·马奎兹剧情资产移出游戏。 */
export function removeDrMarquezFromDecks(state, api = {}) {
  const seats = []
  for (const inv of state.investigators || []) {
    let found = false
    for (const zone of ['deck', 'hand', 'discard']) {
      const pile = inv[zone]
      if (!Array.isArray(pile)) continue
      const index = pile.indexOf(DR_MARQUEZ_CODE)
      if (index >= 0) {
        pile.splice(index, 1)
        found = true
      }
    }
    if (found) {
      seats.push(inv.seat)
      safeCall(api, 'removePlayerCardFromGame', inv.seat, DR_MARQUEZ_CODE)
    }
  }
  if (seats.length) info(api, `序章：把罗莎·马奎兹移出游戏（座位 ${seats.join('、')}）。`)
  return seats
}

/** 把序章加入的标记真正放进混乱袋（afterChaosBagSetup 读点；一次性）。 */
export function applyIntroTokens(state, api = {}) {
  const tokens = flagsFor(state).preludeIntroTokens
  if (!Array.isArray(tokens) || !tokens.length) return 0
  if (flagsFor(state).preludeIntroTokensApplied) return 0
  setFlag(state, 'preludeIntroTokensApplied', true)
  let added = 0
  for (const token of tokens) added += addChaosToken(state, token, 1)
  info(api, `序章：混乱袋加入 ${added} 个标记（${tokens.join('、')}），持续到战役结束。`)
  return added
}

export function preScenarioSetup(state, events, api = {}) {
  void events
  state.scenarioFlags ||= {}
  const plan = introPlan(state)
  const labels = SCENARIO_TEXT.introLabels
  const labelOf = id => ({
    doneNothingWrongTruth: labels.doneNothingWrongTruth,
    doneNothingWrongLie: labels.doneNothingWrongLie,
    sentencedToDeath: labels.sentencedToDeath,
  }[id] || id)
  let choice = 'sentencedToDeath'
  if (plan.hasPlan) {
    choice = pick(api, {
      kind: 'story', source: CHAPTER_ID, seat: state.campaign?.leadSeat ?? 0,
      prompt: SCENARIO_TEXT.intro2 || '序章：你们要对蕾切尔嬷嬷说什么？',
      options: plan.options.map(id => ({ id, label: labelOf(id) })),
    }, plan.options.at(-1))
  }
  const applied = applyIntroChoice(state, choice, api)
  const branchText = applied.choice === 'doneNothingWrongTruth'
    ? SCENARIO_TEXT.introBranches.intro3
    : applied.choice === 'doneNothingWrongLie'
      ? SCENARIO_TEXT.introBranches.intro4
      : SCENARIO_TEXT.introBranches.intro5
  if (branchText) present(api, branchText, SCENARIO_TEXT.heading || 'Prelude: The Final Evening')
  setFlag(state, 'preludeIntro', applied.choice)
  return false
}

// 引擎读点：afterChaosBagSetup(state, events, scenarioRuntime)
export function afterChaosBagSetup(state, events, api = {}) {
  void events
  return applyIntroTokens(state, api)
}

// ---------------------------------------------------------------------------
// 布置（Setup）
// ---------------------------------------------------------------------------
/** 划掉的居民：北角矿井未勘察 → 开场划掉莉亚·阿特伍德（参考 Setup removeResidents）。 */
export function crossedOutResidentsBeforeSetup(state) {
  const ids = RESIDENT_ASSET_CODES
    .map(code => RESIDENT_BY_ASSET_CODE[code])
    .filter(resident => resident && isResidentCrossedOut(state, resident.id))
    .map(resident => resident.id)
  if (!recordTrue(state, RECORD_KEYS.areasSurveyedNorthPointMine) && !ids.includes('leahAtwood')) {
    ids.push('leahAtwood')
  }
  return ids
}

function setAsideResidentsFor(state) {
  const ids = [...SET_ASIDE_RESIDENT_IDS]
  if (!recordTrue(state, RECORD_KEYS.bertieHadAnEpiphany) || isResidentCrossedOut(state, 'bertieMusgrave')) {
    ids.push('bertieMusgrave')
  }
  return ids
}

/** 布置计划（纯读）：开场地点、在场/放一边的居民、狂乱的赴宴者、伯蒂与马奎兹。 */
export function setupPlan(state) {
  const crossedOut = crossedOutResidentsBeforeSetup(state)
  const isOut = residentId => crossedOut.includes(residentId)
  const placements = []
  for (const residentId of RESIDENT_PLACEMENT_ORDER) {
    const resident = residentOf(residentId)
    if (!resident || isOut(resident.id)) continue
    const relationship = relationshipLevel(state, resident.id)
    const threshold = resident.threshold
    placements.push({
      residentId: resident.id, assetCode: resident.assetCode, enemyCode: resident.enemyCode,
      locationId: resident.location, relationship, threshold,
      side: threshold != null && relationship <= threshold ? 'enemy' : 'asset',
    })
  }
  const frenziedRevelers = [{ locationId: FRENZIED_REVELER_SPAWN.primary }]
  if (investigatorCount(state) >= FRENZIED_REVELER_SPAWN.extraFromInvestigators) {
    frenziedRevelers.push({ locationId: FRENZIED_REVELER_SPAWN.extra })
  }
  const bertieInPlay = !isOut('bertieMusgrave') && recordTrue(state, RECORD_KEYS.bertieHadAnEpiphany)
  return {
    interrupted: interrupted(state),
    believed: believed(state),
    lied: liedToMotherRachel(state),
    northPointSurveyed: recordTrue(state, RECORD_KEYS.areasSurveyedNorthPointMine),
    crossedOut,
    startLocation: interrupted(state) ? START_LOCATION_WHEN_INTERRUPTED : START_LOCATION,
    doom: investigatorCount(state),
    placements,
    setAsideResidents: setAsideResidentsFor(state),
    frenziedRevelers,
    bertie: bertieInPlay ? { inPlay: true, side: 'enemy', locationId: THE_CROSSROADS_ID } : null,
    drMarquez: interrupted(state) ? { inPlay: true, controllerSeat: null } : null,
    removedLocations: [...REMOVED_LOCATION_CODES],
    timeMarker: { ...TIME_MARKER },
    date: { ...PRELUDE_DATE },
  }
}

export const startLocation = state => (interrupted(state)
  ? START_LOCATION_WHEN_INTERRUPTED : START_LOCATION)

export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.storyAssets ||= []
  state.enemies ||= []
  state.locations ||= []
  state.acts = [{ ...clone(state.scenario?.acts?.[0] || ACT_STAGES[1]) }]
  state.agendas = [{ ...clone(state.scenario?.agendas?.[0] || AGENDAS[0]) }]
  state.actIndex = 0
  state.agendaIndex = 0
  const zones = state.scenarioZones
  zones.setAside = [...SET_ASIDE_CARDS]
  zones.setAsideResidents = setAsideResidentsFor(state)
  zones.setAsideLocations = []
  zones.removed = [...REMOVED_LOCATION_CODES]
  flagsFor(state).preludeCodexRead ||= []
  setFlag(state, 'preludeDate', { ...PRELUDE_DATE })
  mechanicsFor(state)
  return { actCodes: [...ACT_CODES], agendaCodes: [...AGENDA_CODES], setAside: [...zones.setAside] }
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  prepareScenario(state, api)
  const ids = setupLocationIds()
  for (const id of ids) ensureLocation(state, id, api)
  info(api, `最终之夜：${ids.length} 处地点入场（十字路口与老磨坊使用傍晚面）。`)
  return ids
}

/** 把居民资产放到地点（进场时的默认面）。 */
export function placeResidentAsset(state, residentId, locationId, api = {}) {
  const resident = residentOf(residentId)
  if (!resident) return null
  return placeStoryAssetAt(state, resident.assetCode, locationId, api, { residentId: resident.id })
}

function removeResidentAsset(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident) return false
  const storyIndex = (state.storyAssets || []).findIndex(asset => codeOf(asset) === resident.assetCode)
  if (storyIndex >= 0) {
    state.storyAssets.splice(storyIndex, 1)
    return true
  }
  for (const inv of state.investigators || []) {
    const index = (inv.assets || []).findIndex(asset => codeOf(asset) === resident.assetCode)
    if (index >= 0) {
      inv.assets.splice(index, 1)
      return true
    }
  }
  return false
}

function removeResidentEnemy(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident?.enemyCode) return false
  const index = (state.enemies || []).findIndex(enemy => codeOf(enemy) === resident.enemyCode)
  if (index < 0) return false
  state.enemies.splice(index, 1)
  return true
}

/** 关系等级过低：把居民资产翻到敌人面（参考 flipResidentToEnemy）。 */
export function flipResidentToEnemy(state, residentId, api = {}) {
  const resident = residentOf(residentId)
  if (!resident?.enemyCode) return null
  const existing = residentEnemyInPlay(state, resident.id)
  if (existing) return existing
  const asset = residentAssetInPlay(state, resident.id)
  if (!asset) return null
  const locationId = asset.location
    || state.investigators?.[asset.controllerSeat]?.location || null
  removeResidentAsset(state, resident.id)
  const enemy = spawnEnemyAt(state, resident.enemyCode, locationId, api, {
    residentId: resident.id, name: resident.name, nameEn: resident.nameEn,
  })
  info(api, `「${resident.name}」翻到敌人面（关系等级 ${relationshipLevel(state, resident.id)}）。`)
  return enemy
}

/** 「Take control of …」：只能把已在场的居民资产交给调查员（Haskell takeControlOfResident 同口径）。 */
export function takeControlOfResident(state, residentId, seat, api = {}) {
  const resident = residentOf(residentId)
  const inv = state.investigators?.[seat]
  if (!resident || !inv) return false
  const asset = residentAssetInPlay(state, resident.id)
  if (!asset) {
    info(api, `「${resident.name}」不在场，无法取得控制权。`)
    return false
  }
  removeResidentAsset(state, resident.id)
  inv.assets ||= []
  inv.assets.push({ ...asset, controllerSeat: seat, location: inv.location, residentId: resident.id })
  info(api, `${inv.name} 取得「${resident.name}」的控制权。`)
  return true
}

/** 从放一边的 Residents 组取出一位居民（obtainCard）。 */
export function obtainSetAsideResident(state, residentId) {
  const resident = residentOf(residentId)
  if (!resident) return false
  const zones = state.scenarioZones ||= {}
  const aside = zones.setAsideResidents ||= [...SET_ASIDE_RESIDENT_IDS]
  const index = aside.indexOf(resident.id)
  if (index >= 0) aside.splice(index, 1)
  if (Array.isArray(zones.setAside)) {
    const cardIndex = zones.setAside.indexOf(resident.assetCode)
    if (cardIndex >= 0) zones.setAside.splice(cardIndex, 1)
  }
  return true
}

export function setupEnemies(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  // 生成走引擎入口：api.spawn(code, location)（剧本运行时）或 helper.spawnEnemy(state, code, loc, …)。
  const spawnApi = typeof api.spawn === 'function'
    ? api
    : (typeof helper.spawnEnemy === 'function'
      ? { spawn: (code, locationId) => helper.spawnEnemy(state, code, locationId, null, true) }
      : {})
  const spawn = (code, locationId, extra) => spawnEnemyAt(state, code, locationId, spawnApi, extra)
  // 1) 被划掉的居民：先划掉（北角矿井未勘察 → 莉亚），再移出游戏。
  if (!recordTrue(state, RECORD_KEYS.areasSurveyedNorthPointMine)
    && !isResidentCrossedOut(state, 'leahAtwood')) {
    crossOutResident(state, 'leahAtwood', api)
  }
  const plan = setupPlan(state)
  for (const residentId of plan.crossedOut) {
    const resident = residentOf(residentId)
    if (!resident) continue
    removeResidentAsset(state, residentId)
    removeResidentEnemy(state, residentId)
    info(api, `移出游戏：被划掉的居民「${resident.name}」。`)
  }
  // 2) 狂乱的赴宴者（社群大厅，3–4 人时再放一张在教堂）。
  const revelers = plan.frenziedRevelers
    .map(row => spawn(FRENZIED_REVELER_CODE, row.locationId))
    .filter(Boolean)
  // 3) 在场居民：资产面 / 关系等级 ≤ 阈值时敌人面。
  const residents = plan.placements.map(placement => {
    const resident = residentOf(placement.residentId)
    if (placement.side === 'enemy') {
      const enemy = spawn(resident.enemyCode, placement.locationId,
        { residentId: resident.id, name: resident.name, nameEn: resident.nameEn })
      return { residentId: resident.id, side: 'enemy', id: enemy?.id || null }
    }
    const asset = placeResidentAsset(state, resident.id, placement.locationId, api)
    return { residentId: resident.id, side: 'asset', id: asset?.id || null }
  })
  // 4) 伯蒂确实显灵 → 敌人在十字路口进场。
  let bertie = null
  if (plan.bertie) {
    obtainSetAsideResident(state, 'bertieMusgrave')
    bertie = spawn(BERTIE_ENEMY_CODE, THE_CROSSROADS_ID,
      { residentId: 'bertieMusgrave', name: '伯蒂·马斯格雷夫', nameEn: 'Bertie Musgrave' })
    info(api, '伯蒂见证了显灵：他以敌人面在十字路口进场。')
  }
  // 5) 盛宴被打断 → 罗莎·马奎兹由一位调查员控制。
  let drMarquez = null
  if (plan.drMarquez) {
    const seat = Number(pick(api, {
      kind: 'investigator', source: CHAPTER_ID, seat: state.campaign?.leadSeat ?? 0,
      prompt: '被打断的盛宴：选择取得罗莎·马奎兹控制权的调查员。',
      options: activeInvestigators(state).map(inv => ({ id: String(inv.seat), label: inv.name })),
    }, String(state.campaign?.leadSeat ?? 0)))
    const inv = state.investigators?.[seat] || state.investigators?.[0]
    obtainSetAsideResident(state, 'drRosaMarquez')
    const asset = placeStoryAssetAt(state, DR_MARQUEZ_CODE, inv?.location || null, api,
      { residentId: 'drRosaMarquez', controllerSeat: inv?.seat ?? 0 })
    if (asset && inv) {
      state.storyAssets = (state.storyAssets || []).filter(item => item !== asset)
      inv.assets ||= []
      inv.assets.push({ ...asset, controllerSeat: inv.seat, location: inv.location })
      drMarquez = asset
    }
    info(api, `被打断的盛宴：${inv?.name || '调查员'} 取得罗莎·马奎兹的控制权。`)
  }
  return { revelers, residents, bertie, drMarquez, plan }
}

export function placeSetupDoom(state, api = {}) {
  const count = investigatorCount(state)
  if (typeof api.addDoom === 'function') api.addDoom(count)
  else state.doom = (Number(state.doom) || 0) + count
  info(api, `议程放置 ${count} 点毁灭（等于调查员人数）。`)
  return count
}

export function placeTimeMarker(state, api = {}) {
  const marker = { ...TIME_MARKER }
  setFlag(state, 'preludeTimeMarker', marker)
  setFlag(state, 'preludeDay', DAY_NUMBER)
  setFlag(state, 'preludePeriod', PRELUDE_DATE.period)
  state.storyAssets ||= []
  if (!state.storyAssets.some(asset => codeOf(asset) === TIME_MARKER_CODE)) {
    state.storyAssets.push({
      id: `preludeTimeMarker-${TIME_MARKER_CODE}`, code: TIME_MARKER_CODE,
      originalCode: TIME_MARKER_CODE, name: marker.name, nameEn: marker.name,
      location: null, global: true, storyCode: 'timeMarker', face: marker.face,
      day: marker.day, period: marker.period,
    })
    safeCall(api, 'storyAsset', TIME_MARKER_CODE, null)
  }
  info(api, '时间指示卡入场：第三夜面。')
  return marker
}

export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  placeTimeMarker(state, api)
  const date = setPreludeDate(state, api)
  const doom = placeSetupDoom(state, api)
  const plan = setupPlan(state)
  info(api, `最终之夜布置完成：${plan.placements.length} 位居民入场、`
    + `${plan.crossedOut.length} 位被划掉、狂乱的赴宴者 ${plan.frenziedRevelers.length} 张。`)
  return { date, doom, placements: plan.placements.length, crossedOut: [...plan.crossedOut] }
}

// ---------------------------------------------------------------------------
// 法典（Codex 1–16 / Θ / Ω）
// ---------------------------------------------------------------------------
export const codexReadIds = state => recordValues(state, RECORD_KEYS.codexRead)
export const codexWasRead = (state, entryId) => codexReadIds(state).includes(String(entryId))

export const hemlocksHashingItOut = state => recordTrue(state, THEATWOOD_HASHING_RECORD)
  || flagsFor(state).preludeHemlocksHashingItOut === true

/** 法典的唯一分支判定（含引擎原语无法表达的顶层记录条件）。 */
export function codexBranch(state, entryId) {
  switch (String(entryId)) {
    case 'motherRachel':
      if (believed(state)) return 'believed'
      if (liedToMotherRachel(state)) return 'lied'
      return 'otherwise'
    case 'simeonAtwood':
      return recordTrue(state, RECORD_KEYS.valeIsFullOfFireworks) ? 'fireworks' : 'otherwise'
    case 'leahAtwood':
      return hasResidentNote(state, 'leahAtwood', RECORD_KEYS.leahSawSomethingInTheMine)
        ? 'sawMine' : 'otherwise'
    case 'gideonMizrah':
      return hasResidentNote(state, 'gideonMizrah', RECORD_KEYS.gideonToldTheTaleOfTheAnnabelleLee)
        && hasResidentNote(state, 'gideonMizrah', RECORD_KEYS.gideonFoundHisTreasure)
        ? 'toldTale' : 'otherwise'
    case 'judithPark':
      return hasResidentNote(state, 'judithPark', RECORD_KEYS.youBackedJudithUp) ? 'backedUp' : 'otherwise'
    case 'theoPeters':
      if (hasResidentNote(state, 'theoPeters', RECORD_KEYS.theoIsHavingSecondThoughts)) {
        return hasResidentNote(state, 'theoPeters', RECORD_KEYS.theoReconciledWithHelen)
          ? 'both' : 'secondThoughts'
      }
      return 'otherwise'
    case ATWOOD_HOUSE_ENTRY:
      return hemlocksHashingItOut(state) ? 'hashingItOut' : 'otherwise'
    default:
      return 'printed'
  }
}

/** 法典能否被读：条目存在、居民未划掉、未读过（Atwood House 可重复，选边后关闭）。 */
export function codexReadable(state, entryId) {
  const entry = CODEX_BY_ID[String(entryId)]
  if (!entry) return false
  // 待宰羔羊（10689 正面）：「你不能触发 [codex] 抄本条目。」
  if (currentAgendaCode(state) === SPECIAL_AGENDA_CODE) return false
  if (entry.resident && isResidentCrossedOut(state, entry.resident)) return false
  if (entry.id === ATWOOD_HOUSE_ENTRY && flagsFor(state).preludeAtwoodHouseSettled) return false
  if (entry.limit === 'unlimited') return true
  return !codexWasRead(state, entry.id)
}

function markCodexRead(state, entryId, api) {
  recordAdd(state, RECORD_KEYS.codexRead, String(entryId), api)
  const flags = flagsFor(state)
  flags.preludeCodexRead ||= []
  if (!flags.preludeCodexRead.includes(String(entryId))) flags.preludeCodexRead.push(String(entryId))
  const mechanics = mechanicsFor(state)
  mechanics.resolvedCodex = [...new Set([...(mechanics.resolvedCodex || []), String(entryId)])]
}

const choose = (api, seat, entryId, prompt, options, fallback) => pick(api,
  { kind: 'codex', source: entryId, seat, prompt, options }, fallback)

function drawOrResource(state, seat, count, api) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  const choice = choose(api, seat, 'codexChoice', `选择：抽 ${count} 张牌，或获得 ${count} 个资源。`,
    [{ id: 'draw', label: `抽 ${count} 张牌` }, { id: 'resource', label: `获得 ${count} 个资源` }], 'draw')
  if (choice === 'resource') {
    if (typeof api.gainResources === 'function') api.gainResources(seat, count)
    else inv.resources = (Number(inv.resources) || 0) + count
    info(api, `${inv.name} 获得 ${count} 个资源。`)
    return { kind: 'resource', amount: count }
  }
  drawCards(state, seat, count, api)
  info(api, `${inv.name} 抽 ${count} 张牌。`)
  return { kind: 'draw', amount: count }
}

function drawCards(state, seat, count, api) {
  if (typeof api.drawCards === 'function') {
    api.drawCards(seat, count)
    return count
  }
  const inv = state.investigators?.[seat]
  if (!inv) return 0
  inv.hand ||= []
  let drawn = 0
  for (let index = 0; index < count; index += 1) {
    const code = (inv.deck || []).pop()
    if (!code) break
    inv.hand.push(code)
    drawn += 1
  }
  return drawn
}

/** 印刷「Each investigator earns N bonus experience」：记在 scenarioXpBonus（= 未花费经验）。 */
export function addBonusXpToAll(state, amount, api = {}) {
  const value = Math.max(0, Math.trunc(Number(amount) || 0))
  if (!value) return 0
  const before = Number(flagsFor(state).preludeBonusXp) || 0
  for (const inv of state.investigators || []) {
    if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, value)
    else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + value
  }
  setFlag(state, 'preludeBonusXp', before + value)
  return value
}

/** 本序曲累计发放的奖励经验（= 每位调查员的 scenarioXpBonus）。 */
export function bonusXp(state) {
  const fromInvestigators = (state.investigators || [])
    .reduce((max, inv) => Math.max(max, Number(inv.scenarioXpBonus) || 0), 0)
  const flag = Number(flagsFor(state).preludeBonusXp)
  return Math.max(fromInvestigators, Number.isFinite(flag) ? flag : 0)
}

function recruitResident(state, residentId, relationship, xp, api) {
  if (relationship) changeRelationship(state, residentId, relationship, api)
  if (xp) addBonusXpToAll(state, xp, api)
  const seat = state.campaign?.leadSeat ?? 0
  const controlled = takeControlOfResident(state, residentId, seat, api)
  const resident = residentOf(residentId)
  info(api, `招募「${resident?.name || residentId}」：关系等级 +${relationship || 0}、`
    + `每人 +${xp || 0} 奖励经验${controlled ? '、取得控制权' : '（不在场，未取得控制权）'}。`)
  return controlled
}

function residentEnemiesAt(state, locationIds) {
  const ids = (Array.isArray(locationIds) ? locationIds : [locationIds]).filter(Boolean)
  return (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removed
    && ids.includes(enemy.location)
    && (RESIDENT_BY_ENEMY_CODE[codeOf(enemy)]
      || (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'resident')))
}

/** 法典 12 / 15：选择一位 [[居民]] 敌人，检定任意技能 (2)，成功则自动躲避。 */
function testToEvadeResident(state, seat, entryId, prompt, locationIds, api) {
  const candidates = residentEnemiesAt(state, locationIds)
  if (!candidates.length) {
    info(api, `${entryId}：本地点（或连接地点）没有[[居民]]敌人。`)
    return false
  }
  const enemyId = choose(api, seat, entryId, prompt,
    candidates.map(enemy => ({ id: String(enemy.id), label: enemy.name })), String(candidates[0].id))
  const enemy = candidates.find(item => String(item.id) === String(enemyId)) || candidates[0]
  const resolve = result => {
    if (result && result.success === false) {
      info(api, `${entryId}：检定失败，「${enemy.name}」没有被躲避。`)
      return
    }
    if (typeof api.autoEvadeEnemy === 'function') api.autoEvadeEnemy(seat, enemy.id)
    else if (typeof api.evadeEnemy === 'function') api.evadeEnemy(seat, enemy.id)
    else {
      enemy.exhausted = true
      enemy.engagedSeat = null
    }
    info(api, `${entryId}：自动躲避「${enemy.name}」。`)
  }
  if (typeof api.test === 'function') {
    api.test(seat, 'willpower', 2, resolve)
    return true
  }
  resolve({ success: true })
  return true
}

function flipAllResidentsExcept(state, exceptId, api) {
  const flipped = []
  for (const resident of Object.values(RESIDENT_BY_ID)) {
    if (!resident.enemyCode || resident.id === exceptId) continue
    if (!residentAssetInPlay(state, resident.id)) continue
    const enemy = flipResidentToEnemy(state, resident.id, api)
    if (enemy) flipped.push({ residentId: resident.id, enemyId: enemy.id })
  }
  return flipped
}

function emptyLocationIds(state) {
  const occupied = new Set((state.enemies || []).map(enemy => enemy.location))
  for (const inv of state.investigators || []) if (inv.location) occupied.add(inv.location)
  return (state.locations || []).map(loc => loc.id).filter(id => !occupied.has(id))
}

function putLambsToTheSlaughterIntoPlay(state, api = {}) {
  const doom = Number(state.doom) || 0
  state.doom = 0
  if (typeof api.removeDoom === 'function' && doom) api.removeDoom(doom)
  const stage = { ...clone(SPECIAL_AGENDA_STAGE), id: `agenda${SPECIAL_AGENDA_CODE}`, doom: 0,
    doomThreshold: SPECIAL_AGENDA_DOOM_THRESHOLD }
  if (state.agendas?.length) state.agendas[state.agendaIndex ?? 0] = stage
  else state.agendas = [stage]
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside)) {
    const index = zones.setAside.indexOf(SPECIAL_AGENDA_CODE)
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  setFlag(state, 'preludeLambsAgenda', true)
  info(api, '换上特别议程「待宰羔羊」，并移除议程上的全部毁灭。')
  return stage
}

export const currentAgendaCode = state => {
  const agenda = state.agendas?.[state.agendaIndex ?? 0] || state.agendas?.[0]
  return agenda ? codeOf(agenda) : null
}

function spawnResidentEnemyAtHouse(state, residentId, api) {
  const resident = residentOf(residentId)
  if (!resident?.enemyCode) return null
  removeResidentAsset(state, resident.id)
  obtainSetAsideResident(state, resident.id)
  return spawnEnemyAt(state, resident.enemyCode, THE_ATWOOD_HOUSE_ID, api, {
    residentId: resident.id, name: resident.name, nameEn: resident.nameEn,
  })
}

function playWeaponFree(state, seat, api) {
  const inv = state.investigators?.[seat]
  if (!inv) return false
  const weapons = (inv.hand || []).filter(code => (state.cards?.[code]?.type || '') === 'asset')
  if (!weapons.length) return false
  const chosen = choose(api, seat, 'judithPark',
    SCENARIO_TEXT.codex.judithPark?.backedUp || '你可以忽略费用打出一张武器卡。',
    [{ id: 'skip', label: '不出牌' },
      ...weapons.map(code => ({ id: String(code), label: String(code), cardCode: String(code) }))], 'skip')
  if (!chosen || chosen === 'skip') return false
  const index = (inv.hand || []).indexOf(String(chosen))
  if (index < 0) return false
  if (typeof api.playCardFromHandFree === 'function') {
    api.playCardFromHandFree(seat, String(chosen))
    return true
  }
  spliceHand(inv, index, 1)
  inv.assets ||= []
  inv.assets.push({ id: `preludeWeapon-${chosen}`, code: String(chosen), controllerSeat: seat,
    location: inv.location })
  return true
}

function discardFromHand(state, seat, count, api) {
  const inv = state.investigators?.[seat]
  if (!inv) return 0
  inv.hand ||= []
  let discarded = 0
  for (let index = 0; index < count && inv.hand.length; index += 1) {
    const chosen = choose(api, seat, 'bertieMusgrave', `弃掉第 ${index + 1} 张手牌。`,
      inv.hand.map((code, position) => ({ id: String(position), label: String(code), cardCode: String(code) })),
      '0')
    const position = Number(chosen)
    const safe = Number.isInteger(position) && position >= 0 && position < inv.hand.length ? position : 0
    const [code] = spliceHand(inv, safe, 1)
    inv.discard ||= []
    inv.discard.push(code)
    discarded += 1
  }
  return discarded
}

function chooseHeir(state, seat, api) {
  const candidates = ['williamHemlock', 'riverHawthorne'].filter(id => Boolean(residentOf(id)))
  if (!candidates.length) return null
  const chosen = choose(api, seat, ATWOOD_HOUSE_ENTRY, '选择要取得控制权的继承人。',
    candidates.map(id => ({ id, label: residentOf(id)?.name || id })), candidates[0])
  return candidates.includes(chosen) ? chosen : candidates[0]
}

/**
 * 法典结算的唯一入口。`entryId` 是定义里的 id（motherRachel…theCommons /
 * drRosaMarquez / bertieMusgrave）。返回 true 表示已结算（效果已应用、一次性键已写）。
 */
export function codexEntry(state, seat, entryId, api = {}) {
  const id = String(entryId)
  const entry = CODEX_BY_ID[id]
  if (!entry || !codexReadable(state, id)) return false
  const inv = state.investigators?.[seat] || state.investigators?.[0]
  if (!inv) return false
  const actor = Number.isFinite(Number(inv.seat)) ? Number(inv.seat) : 0
  const branch = codexBranch(state, id)
  const outcome = { entry: id, branch, seat: actor }
  let resolved = true
  let markRead = entry.limit !== 'unlimited'
  switch (id) {
    case 'motherRachel': {
      if (branch === 'believed') {
        const flipped = flipAllResidentsExcept(state, 'motherRachel', api)
        const available = emptyLocationIds(state)
        const moved = []
        const aside = [...((state.scenarioZones ||= {}).setAsideResidents || SET_ASIDE_RESIDENT_IDS)]
        for (const residentId of aside) {
          const resident = residentOf(residentId)
          if (!resident?.enemyCode || isResidentCrossedOut(state, resident.id)) continue
          const target = available.shift() || null
          if (!target) {
            info(api, `${resident.name} 没有空地点可放，留在放一边。`)
            continue
          }
          obtainSetAsideResident(state, resident.id)
          const enemy = spawnEnemyAt(state, resident.enemyCode, target, api, {
            residentId: resident.id, name: resident.name, nameEn: resident.nameEn,
          })
          moved.push({ residentId: resident.id, locationId: target, enemyId: enemy?.id || null })
        }
        putLambsToTheSlaughterIntoPlay(state, api)
        Object.assign(outcome, { flipped, moved })
        info(api, '法典 1（相信）：其余居民翻面、放一边的居民在空地点以敌人面进场，'
          + '换上「待宰羔羊」议程。')
      } else if (branch === 'lied') {
        const enemy = flipResidentToEnemy(state, 'motherRachel', api)
        if (enemy) {
          if (typeof api.damageEnemy === 'function') api.damageEnemy(enemy.id, 2, actor)
          else enemy.damageTaken = (Number(enemy.damageTaken) || 0) + 2
        }
        Object.assign(outcome, { enemyId: enemy?.id || null, damage: 2 })
        info(api, '法典 1（撒谎）：蕾切尔嬷嬷翻到敌人面并受到 2 点伤害。')
      } else {
        const enemy = flipResidentToEnemy(state, 'motherRachel', api)
        Object.assign(outcome, { enemyId: enemy?.id || null })
        info(api, '法典 1（否则）：蕾切尔嬷嬷翻到敌人面。')
      }
      break
    }
    case 'leahAtwood': {
      if (branch === 'sawMine') {
        const choice = choose(api, actor, id,
          SCENARIO_TEXT.codex.leahAtwood?.leah1 || '你要问矿井里的事吗？',
          [{ id: 'askMine', label: SCENARIO_TEXT.codexLabels.askMine || '“你在北角矿井里看到了什么？”' },
            { id: 'sayNothing', label: SCENARIO_TEXT.codexLabels.sayNothing || '什么也不说。' }],
          'sayNothing')
        if (choice === 'askMine') {
          setRelationshipLevel(state, 'leahAtwood', 0, api)
          Object.assign(outcome, { choice, relationship: 0 })
        } else {
          recruitResident(state, 'leahAtwood', 1, CODEX_BONUS_XP.leahAtwood, api)
          Object.assign(outcome, { choice, relationship: relationshipLevel(state, 'leahAtwood'),
            xp: CODEX_BONUS_XP.leahAtwood })
        }
      } else {
        changeRelationship(state, 'leahAtwood', 1, api)
        addBonusXpToAll(state, 1, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'leahAtwood'), xp: 1 })
      }
      break
    }
    case 'simeonAtwood': {
      if (branch === 'fireworks') {
        recruitResident(state, 'simeonAtwood', 2, CODEX_BONUS_XP.simeonAtwood, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'simeonAtwood'),
          xp: CODEX_BONUS_XP.simeonAtwood })
      } else {
        changeRelationship(state, 'simeonAtwood', 1, api)
        addBonusXpToAll(state, 1, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'simeonAtwood'), xp: 1 })
      }
      break
    }
    case 'williamHemlock': {
      recruitResident(state, 'williamHemlock', 1, CODEX_BONUS_XP.williamHemlock, api)
      setRelationshipLevel(state, 'riverHawthorne', 0, api)
      const enemy = spawnResidentEnemyAtHouse(state, 'riverHawthorne', api)
      Object.assign(outcome, { relationship: relationshipLevel(state, 'williamHemlock'),
        xp: CODEX_BONUS_XP.williamHemlock, enemyId: enemy?.id || null })
      break
    }
    case 'riverHawthorne': {
      recruitResident(state, 'riverHawthorne', 1, CODEX_BONUS_XP.riverHawthorne, api)
      setRelationshipLevel(state, 'williamHemlock', 0, api)
      const enemy = spawnResidentEnemyAtHouse(state, 'williamHemlock', api)
      Object.assign(outcome, { relationship: relationshipLevel(state, 'riverHawthorne'),
        xp: CODEX_BONUS_XP.riverHawthorne, enemyId: enemy?.id || null })
      break
    }
    case 'gideonMizrah': {
      if (branch === 'toldTale') {
        setRecord(state, RECORD_KEYS.gideonFinishedTheTaleOfAnnabelleLee, true, api)
        recruitResident(state, 'gideonMizrah', 1, CODEX_BONUS_XP.gideonMizrah, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'gideonMizrah'),
          xp: CODEX_BONUS_XP.gideonMizrah, record: RECORD_KEYS.gideonFinishedTheTaleOfAnnabelleLee })
      } else {
        changeRelationship(state, 'gideonMizrah', 1, api)
        addBonusXpToAll(state, 1, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'gideonMizrah'), xp: 1 })
      }
      break
    }
    case 'judithPark': {
      if (branch === 'backedUp') {
        playWeaponFree(state, actor, api)
        recruitResident(state, 'judithPark', 1, CODEX_BONUS_XP.judithPark, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'judithPark'),
          xp: CODEX_BONUS_XP.judithPark })
      } else {
        changeRelationship(state, 'judithPark', 1, api)
        addBonusXpToAll(state, 1, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'judithPark'), xp: 1 })
      }
      break
    }
    case 'theoPeters': {
      if (branch === 'both') {
        recruitResident(state, 'theoPeters', 1, CODEX_BONUS_XP.theoPeters, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'theoPeters'),
          xp: CODEX_BONUS_XP.theoPeters })
      } else if (branch === 'secondThoughts') {
        recruitResident(state, 'theoPeters', 1, 1, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'theoPeters'), xp: 1 })
      } else {
        takeControlOfResident(state, 'theoPeters', actor, api)
        Object.assign(outcome, { relationship: relationshipLevel(state, 'theoPeters'), xp: 0 })
      }
      break
    }
    case 'boardingHouse': {
      Object.assign(outcome, drawOrResource(state, actor, 3, api))
      break
    }
    case 'theCrossroads': {
      const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && !enemy.removed)
      if (!enemies.length) {
        info(api, '法典 10：场上没有敌人。')
        resolved = false
        break
      }
      const enemyId = choose(api, actor, id,
        SCENARIO_TEXT.codex.theCrossroads?.body || '选择一位敌人。',
        enemies.map(enemy => ({ id: String(enemy.id), label: enemy.name })), String(enemies[0].id))
      const enemy = enemies.find(item => String(item.id) === String(enemyId)) || enemies[0]
      if (typeof api.disengage === 'function') api.disengage(enemy)
      enemy.engagedSeat = null
      for (const other of state.investigators || []) {
        other.engaged = (other.engaged || []).filter(item => String(item) !== String(enemy.id))
      }
      if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, THE_CROSSROADS_ID)
      else enemy.location = THE_CROSSROADS_ID
      enemy.exhausted = true
      safeCall(api, 'exhaustEnemy', enemy)
      Object.assign(outcome, { enemyId: enemy.id, locationId: THE_CROSSROADS_ID })
      info(api, `法典 10：「${enemy.name}」解除交战、移动到十字路口并横置。`)
      break
    }
    case 'hemlockChapel': {
      Object.assign(outcome, drawOrResource(state, actor, 1, api))
      break
    }
    case 'theOldMill': {
      const here = state.investigators?.[actor]?.location
      resolved = testToEvadeResident(state, actor, id,
        SCENARIO_TEXT.codex.theOldMill?.body || '选择本地点或连接地点的一位[[居民]]敌人，检定任意技能 (2)。',
        [here, ...(LOCATION_CONNECTIONS[here] || [])], api)
      break
    }
    case ATWOOD_HOUSE_ENTRY: {
      if (branch === 'hashingItOut') {
        setRecord(state, RECORD_KEYS.theHemlocksMadeATruce, true, api)
        changeRelationship(state, 'williamHemlock', 1, api)
        changeRelationship(state, 'riverHawthorne', 1, api)
        addBonusXpToAll(state, CODEX_BONUS_XP.theAtwoodHouse, api)
        const heir = chooseHeir(state, actor, api)
        if (heir) {
          obtainSetAsideResident(state, heir)
          placeResidentAsset(state, heir, THE_ATWOOD_HOUSE_ID, api)
          takeControlOfResident(state, heir, actor, api)
        }
        setFlag(state, 'preludeAtwoodHouseSettled', true)
        Object.assign(outcome, { heir, xp: CODEX_BONUS_XP.theAtwoodHouse,
          relationship: { williamHemlock: relationshipLevel(state, 'williamHemlock'),
            riverHawthorne: relationshipLevel(state, 'riverHawthorne') } })
        info(api, '法典 13（赫姆洛克停战）：记录「赫姆洛克家族达成停战」，并取得一位继承人的控制权。')
      } else {
        const options = []
        if (hasResidentNote(state, 'riverHawthorne', RECORD_KEYS.riverIsReclaimingTheirLegacy)) {
          options.push('sideRiver')
        }
        if (hasResidentNote(state, 'williamHemlock', RECORD_KEYS.williamIsResolved)) {
          options.push('sideWilliam')
        }
        options.push('letFight')
        const labels = SCENARIO_TEXT.codexLabels
        const labelOf = key => ({
          sideRiver: labels.sideRiver, sideWilliam: labels.sideWilliam, letFight: labels.letFight,
        }[key] || key)
        const choice = choose(api, actor, id,
          SCENARIO_TEXT.codex.theAtwoodHouse?.otherwise || '你要帮谁？',
          options.map(option => ({ id: option, label: labelOf(option) })), 'letFight')
        const picked = options.includes(choice) ? choice : 'letFight'
        if (picked === 'sideRiver' || picked === 'sideWilliam') {
          const heir = picked === 'sideRiver' ? 'riverHawthorne' : 'williamHemlock'
          obtainSetAsideResident(state, heir)
          placeResidentAsset(state, heir, THE_ATWOOD_HOUSE_ID, api)
          setFlag(state, 'preludeAtwoodHouseSettled', true)
          markRead = true
          Object.assign(outcome, { choice: picked, heir, locationId: THE_ATWOOD_HOUSE_ID })
          info(api, `法典 13：站在「${residentOf(heir)?.name || heir}」一边，他/她在阿特伍德宅以资产面进场。`)
        } else {
          const conditions = hasResidentNote(state, 'williamHemlock', RECORD_KEYS.williamIsResolved)
            || hasResidentNote(state, 'riverHawthorne', RECORD_KEYS.riverIsReclaimingTheirLegacy)
          if (conditions) {
            setRecord(state, THEATWOOD_HASHING_RECORD, true, api)
            setFlag(state, 'preludeHemlocksHashingItOut', true)
          }
          markRead = false
          Object.assign(outcome, { choice: 'letFight', hashingItOut: Boolean(conditions) })
          info(api, conditions
            ? '法典 13：让他们自己打，记住「赫姆洛克家族正在一决胜负」（本条目可以再次触发）。'
            : '法典 13：让他们自己打（没有可记录的条件）。')
        }
      }
      break
    }
    case 'tadsGeneralStore': {
      if (typeof api.gainResources === 'function') api.gainResources(actor, 3)
      else inv.resources = (Number(inv.resources) || 0) + 3
      Object.assign(outcome, { resources: 3 })
      info(api, `${inv.name} 获得 3 个资源。`)
      break
    }
    case 'valeSchoolhouse': {
      const here = state.investigators?.[actor]?.location
      resolved = testToEvadeResident(state, actor, id,
        SCENARIO_TEXT.codex.valeSchoolhouse?.body || '选择本地点的[[居民]]敌人，检定任意技能 (2)。',
        [here], api)
      break
    }
    case 'theCommons': {
      const destinations = (state.locations || []).map(loc => loc.id)
        .filter(id2 => id2 !== state.investigators?.[actor]?.location)
      if (!destinations.length) {
        info(api, '法典 16：没有别的地点可去。')
        resolved = false
        break
      }
      const target = choose(api, actor, id,
        SCENARIO_TEXT.codex.theCommons?.body || '你可以立即移动到任意其他地点。',
        [{ id: 'skip', label: '不移动' },
          ...destinations.map(locationId => ({ id: locationId,
            label: locationById(state, locationId)?.name || locationId }))], 'skip')
      if (!target || target === 'skip') {
        Object.assign(outcome, { moved: false })
        info(api, '法典 16：没有移动。')
        break
      }
      if (typeof api.moveInvestigator === 'function') api.moveInvestigator(actor, target)
      else inv.location = target
      if (typeof api.gainActions === 'function') api.gainActions(actor, 1)
      else inv.extraActions = (Number(inv.extraActions) || 0) + 1
      Object.assign(outcome, { moved: true, locationId: target, additionalAction: 1 })
      info(api, `${inv.name} 立即移动到「${locationById(state, target)?.name || target}」，本回合获得 1 个额外行动。`)
      break
    }
    case 'drRosaMarquez': {
      const chosen = choose(api, actor, id,
        SCENARIO_TEXT.codex.drRosaMarquez?.body || '选择任意地点的一位调查员抽 5 张牌。',
        activeInvestigators(state).map(other => ({ id: String(other.seat), label: other.name })),
        String(actor))
      const targetSeat = state.investigators?.[Number(chosen)] ? Number(chosen) : actor
      const drawn = drawCards(state, targetSeat, 5, api)
      Object.assign(outcome, { targetSeat, drawn })
      info(api, `法典 Θ：座位 ${targetSeat} 抽 ${drawn} 张牌。`)
      break
    }
    case 'bertieMusgrave': {
      const discarded = discardFromHand(state, actor, 3, api)
      setRecord(state, RECORD_KEYS.bertiePerished, true, api)
      Object.assign(outcome, { discarded, record: RECORD_KEYS.bertiePerished })
      info(api, '法典 Ω：弃掉 3 张手牌，并记录「伯蒂遇难」。')
      break
    }
    default:
      resolved = false
  }
  if (resolved && markRead) markCodexRead(state, id, api)
  outcome.resolved = resolved
  setFlag(state, `preludeCodex:${id}`, outcome)
  return resolved
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, runtime = {}) {
  void runtime
  return theFinalEveningChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv = null) {
  return theFinalEveningChaosTokenValue(state, tokenFace, inv)
}

/** 标记追加效果：[cultist]（简单/普通）谈判自动成功（引擎读点 skillTest.autoSuccess）。 */
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || !effect) return false
  const parley = isParleyAttempt(state, effect.test ? { test: effect.test } : {})
  if (effect.token === 'cultist' && effect.mode === 'parley' && parley) {
    safeCall(api, 'setTestAutoSuccess')
    if (state.skillTest) state.skillTest.autoSuccess = true
    info(api, '[cultist]：谈判尝试自动成功。')
    return true
  }
  return false
}

export function addEnemyToVictoryDisplay(state, enemy, api = {}) {
  if (typeof api.addEnemyToVictory === 'function') api.addEnemyToVictory(enemy)
  else {
    state.victoryDisplay ||= []
    if (!state.victoryDisplay.some(item => String(item.id) === String(enemy.id))) {
      state.victoryDisplay.push({ id: enemy.id, code: codeOf(enemy), name: enemy.name,
        victory: Number(enemy.victory) || 0, resident: Boolean(RESIDENT_BY_ENEMY_CODE[codeOf(enemy)]) })
    }
  }
  const index = (state.enemies || []).findIndex(item => String(item.id) === String(enemy.id))
  if (index >= 0) state.enemies.splice(index, 1)
  return true
}

/**
 * 待宰羔羊议程（10689 正面）：躲避[[居民]]敌人且超过难度至少 2 点 → 把它放进胜利区。
 * 引擎的 afterTest 上下文给出 test.actionKind 与 test.target。
 */
export function afterTest(state, inv, result, api = {}, context = {}) {
  if (!result?.success || !inv) return false
  if (currentAgendaCode(state) !== SPECIAL_AGENDA_CODE) return false
  const actionKind = context?.test?.actionKind || context?.actionKind
  if (actionKind && actionKind !== 'evade') return false
  const explicit = Number(result.successBy)
  const successBy = Number.isFinite(explicit) ? explicit
    : (Number(result.value) || 0) - (Number(result.difficulty) || 0)
  if (!(successBy >= 2)) return false
  const target = context?.test?.target
  const targetId = target && typeof target === 'object' ? target.id : target
  const enemy = (state.enemies || []).find(item => String(item.id) === String(targetId))
    || (state.enemies || []).find(item => !item.defeated && item.location === inv.location
      && RESIDENT_BY_ENEMY_CODE[codeOf(item)])
  if (!enemy || !RESIDENT_BY_ENEMY_CODE[codeOf(enemy)]) return false
  addEnemyToVictoryDisplay(state, enemy, api)
  info(api, `躲避「${enemy.name}」超过 ${successBy} 点：把它加入胜利区。`)
  return true
}

export const residentsInVictoryDisplay = state => (state.victoryDisplay || [])
  .filter(item => item.resident || RESIDENT_BY_ENEMY_CODE[codeOf(item)])

export const residentVictoryTarget = state => SPECIAL_AGENDA_RESIDENT_VICTORY_BASE
  + SPECIAL_AGENDA_RESIDENT_VICTORY_PER_INVESTIGATOR * investigatorCount(state)

// ---------------------------------------------------------------------------
// 幕 / 议程 / 目标
// ---------------------------------------------------------------------------
export const motherRachelDefeated = state => {
  const enemy = (state.enemies || []).find(item => codeOf(item) === '10693b')
  return Boolean((enemy && (enemy.defeated || enemy.removed))
    || flagsFor(state).preludeMotherRachelDefeated)
}

const finish = (state, key, api) => {
  if (typeof api.finish === 'function') api.finish(key)
  else state.resolution = key
}

export function checkObjectives(state, api = {}) {
  if (currentAgendaCode(state) === SPECIAL_AGENDA_CODE) {
    const count = residentsInVictoryDisplay(state).length
    const target = residentVictoryTarget(state)
    if (count >= target) {
      info(api, `待宰羔羊：胜利区有 ${count} 张[[居民]]（需要 ${target}）→ 结局 3。`)
      finish(state, 'resolution3', api)
      return true
    }
    return false
  }
  if (motherRachelDefeated(state)) {
    info(api, '幕目标达成：蕾切尔嬷嬷被击败 → 结局 1。')
    finish(state, 'resolution1', api)
    return true
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOf(enemy)
  const resident = RESIDENT_BY_ENEMY_CODE[code]
  if (resident) info(api, `居民敌人「${resident.name}」被击败。`)
  if (code === '10693b') {
    setFlag(state, 'preludeMotherRachelDefeated', true)
    checkObjectives(state, api)
  }
  // 不接管击败后的落点（不是 commitDestination）：返回 false 交回引擎常规结算。
  return false
}

/** 幕背面：Around the Table 是议程卡本身，翻面等价于议程推进。 */
export function actReveal(state, act, api = {}) {
  if (!ACT_CODES.includes(codeOf(act))) return false
  return agendaReveal(state, act, api)
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === SPECIAL_AGENDA_CODE) {
    // 待宰羔羊背面：「所有调查员撤退。」→ 无结局（相信了 → 结局 2 → 结局 3）。
    if (checkObjectives(state, api)) return true
    for (const inv of activeInvestigators(state)) {
      inv.resigned = true
      safeCall(api, 'markResigned', inv.seat)
    }
    info(api, '待宰羔羊背面：所有调查员撤退 → 无结局。')
    finish(state, NO_RESOLUTION, api)
    return true
  }
  if (!AGENDA_CODES.includes(code)) return false
  // 背面：每位调查员被击败并承受 1 点精神/肉体创伤 → 无结局（→ 结局 2 / 结局 4）。
  for (const inv of state.investigators || []) {
    inv.defeated = true
    const kind = pick(api, {
      kind: 'effect', source: code, seat: inv.seat,
      prompt: '每位调查员被击败：选择承受 1 点精神创伤或 1 点肉体创伤。',
      options: [{ id: 'mental', label: '精神创伤' }, { id: 'physical', label: '肉体创伤' }],
    }, 'mental')
    if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, kind, 1)
    else {
      inv.trauma ||= { physical: 0, mental: 0 }
      inv.trauma[kind] = (Number(inv.trauma[kind]) || 0) + 1
    }
  }
  info(api, '议程背面：每位调查员被击败并承受 1 点创伤 → 无结局。')
  finish(state, NO_RESOLUTION, api)
  return true
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function victoryXp(state) {
  return (state.victoryDisplay || []).reduce((sum, entry) => {
    if (Number.isFinite(Number(entry))) return sum + Number(entry)
    return sum + (Number(entry?.victory) || Number(entry?.points) || 0)
  }, 0)
}

/**
 * R4 的经验：每人 = 胜利区 X + 本序曲的奖励经验。
 * 引擎在关卡结算时已经把 `state.victory` 与 `inv.scenarioXpBonus` 计入经验
 * （campaign-flow.js:350），因此这里只汇总总数（记 flag 供面板/测试读），不重复加分。
 */
export function resolutionExperience(state) {
  const total = victoryXp(state) + bonusXp(state)
  setFlag(state, 'preludeResolutionXp', total)
  return total
}

/**
 * 结局（参考 ScenarioResolution）：
 *   无结局 → 相信了 → R2，否则 → R4；R1（蕾切尔被击败）→ R4；R2 → R3；
 *   R3 → 重玩本序曲（划掉「调查员相信了」）或输掉战役；
 *   R4 → 记录胜利区 X + 奖励经验，前往《山谷的命运》。
 */
export function resolution(state, key, events = [], api = {}) {
  void events
  const requested = String(key || NO_RESOLUTION)
  const chain = []
  let current = requested === NO_RESOLUTION
    ? (believed(state) ? 'resolution2' : 'resolution4')
    : requested
  if (!RESOLUTION_KEYS.includes(current)) current = 'resolution4'
  for (let guard = 0; guard < 6; guard += 1) {
    chain.push(current)
    if (current === 'resolution1') { current = 'resolution4'; continue }
    if (current === 'resolution2') { current = 'resolution3'; continue }
    break
  }
  const finalKey = chain.at(-1)
  const outcome = { requested, chain, resolution: finalKey, xp: 0, nextStep: null,
    replay: false, lost: false }
  setRecord(state, RECORD_KEYS.resolution, finalKey, api)
  if (chain.includes('resolution3')) {
    const labels = SCENARIO_TEXT.resolutionLabels
    const choice = pick(api, {
      kind: 'resolution', source: STEP_CODE, seat: state.campaign?.leadSeat ?? 0,
      prompt: SCENARIO_TEXT.resolutions.resolution3?.body || '结局 3：重玩本序曲，或输掉战役。',
      options: [
        { id: 'replay', label: labels.replay || 'Replay this prelude.' },
        { id: 'loseTheCampaign', label: labels.loseTheCampaign || 'The investigators lose the campaign.' },
      ],
    }, 'replay')
    if (choice === 'loseTheCampaign') {
      for (const inv of state.investigators || []) {
        inv.killed = true
        inv.defeated = true
      }
      setRecord(state, RECORD_KEYS.campaignLost, true, api)
      setRecord(state, RECORD_KEYS.nextStep, 'lost', api)
      Object.assign(outcome, { lost: true, nextStep: 'lost' })
      info(api, '结局 3：调查员输掉这次战役。')
      if (typeof api.gameOver === 'function') api.gameOver()
      finish(state, 'resolution3', api)
      return outcome
    }
    setRecord(state, RECORD_KEYS.replayRequested, true, api)
    setRecord(state, RECORD_KEYS.believed, false, api)
    setRecord(state, RECORD_KEYS.nextStep, 'replay', api)
    Object.assign(outcome, { replay: true, nextStep: 'replay' })
    info(api, '结局 3：重玩本序曲（划掉「调查员相信了」）。')
    finish(state, 'resolution3', api)
    return outcome
  }
  if (finalKey === 'resolution4') {
    const xp = resolutionExperience(state)
    setRecord(state, RECORD_KEYS.nextStep, NEXT_SCENARIO_ID, api)
    Object.assign(outcome, { xp, nextStep: NEXT_SCENARIO_ID })
    info(api, `结局 4：每位调查员获得 ${xp} 点经验（胜利区 ${victoryXp(state)} + 奖励 ${bonusXp(state)}），`
      + '随后前往《山谷的命运》。')
    finish(state, 'resolution4', api)
    return outcome
  }
  finish(state, finalKey, api)
  return outcome
}

export function scenarioResolution(state, resolutionKey = 'resolution4', api = {}) {
  return resolution(state, resolutionKey, [], api)
}

export function allResigned(state, api = {}) {
  info(api, '所有调查员都撤退/败退了：结算「无结局」。')
  finish(state, NO_RESOLUTION, api)
  return { resolution: NO_RESOLUTION, next: believed(state) ? 'resolution2' : 'resolution4' }
}

// ---------------------------------------------------------------------------
// 事件：共享居民/地点条目调用 api.resolveScenarioEvent('preludeTheFinalEveningCodex')
// ---------------------------------------------------------------------------
export function codexEvent(state, payload = {}, api = {}) {
  const seat = Number(payload.seat ?? state.campaign?.leadSeat ?? 0)
  return codexEntry(state, seat, payload.entry ?? payload.entryId ?? payload.id, api)
}

export const events = Object.freeze({ [CODEX_EVENT_ID]: codexEvent })

// ---------------------------------------------------------------------------
// 行为装配
// ---------------------------------------------------------------------------
export function implementedEntryFlags(code) {
  return entryFlagsOf(code)
}

/** 序曲摘要（面板/测试读点）。 */
export function scenarioSummary(state) {
  const plan = setupPlan(state)
  const date = scenarioDateOf(state)
  return {
    id: CHAPTER_ID,
    day: date.day,
    period: date.period,
    startLocation: plan.startLocation,
    interrupted: plan.interrupted,
    believed: plan.believed,
    crossedOut: [...plan.crossedOut],
    placements: plan.placements.map(row => ({ ...row })),
    residentsInPlay: [...(state.storyAssets || []).map(asset => codeOf(asset)),
      ...(state.enemies || []).map(enemy => codeOf(enemy))],
    codexRead: codexReadIds(state),
    resolution: recordsFor(state)[RECORD_KEYS.resolution] || null,
    nextStep: recordsFor(state)[RECORD_KEYS.nextStep] || null,
  }
}

/**
 * 无法在本内容层等价表达的子句（逐条披露；不写假等价）。
 */
export const approximations = Object.freeze([
  '中文正文（base.json 的 prelude4 段）尚未回填：114 条叶子逐键回退英文（story-text 的 chineseGaps 已列出），未伪造译文。',
  'Around the Table（10688）印刷上同时充当幕与议程：内容层给幕实例 act10688（同一卡号、同一正文），幕与议程各有一条身份记录。',
  'The Vale 的十字路口（10706a/b）与老磨坊（10708a/b）按印刷移出游戏：内容层只登记卡号（REMOVED_LOCATIONS），不入场、不占 manifest 区域。',
  '序曲没有遭遇牌库（hasEncounterDeckL .~ False）：The Final Day 的 10680「异界幻象」×3 只被 gather 不使用，因此不落任何区域。',
  '法典 1（相信/撒谎）与法典 3（烟花）的印刷条件读顶层战役记录；引擎 scenario-calendar.js 的法典分支只支持「居民关系等级/笔记」，因此这两条声明单分支、由 behavior.codexBranch 依记录挑选小节（限次仍保证）。',
  '法典 4/5 的「Take control of William/River」只对已在场的资产生效（与 Haskell takeControlOfResident 同口径）；两人布置时放一边，需先由法典 13 让他们进场。',
  '法典 12/15 的「检定任意技能 (2)」在无 api.test 的内容层测试里按成功结算；真实引擎由 api.test 回调结算。',
  '法典 16 的「额外行动」走 api.gainActions（无 api 时记 inv.extraActions），不改引擎既有行动计数。',
  '蕾切尔嬷嬷被击败的幕目标由 checkObjectives / enemyDefeated 两个读点结算；「待宰羔羊」议程的居民胜利区目标按 1 + 1/人 计算。',
  '居民双面卡、狂乱的赴宴者、罗莎·马奎兹、伯蒂·马斯格雷夫的单卡条目由共享遭遇组 worker 提供；本序曲只负责布置、关系等级、法典与结局，不重复实现卡面能力。',
  '本轮不发放传家宝：Heirlooms 组（10713–10715）由白天序曲/幕间发放，本序曲 PRELUDE_HEIRLOOM_REWARDS 为空数组。',
])

export const behavior = {
  id: CHAPTER_ID,
  isPrelude: true,
  startLocation,
  preScenarioSetup,
  afterChaosBagSetup,
  prepareScenario,
  setupLocations,
  setupLocationIds,
  setupEnemies,
  afterDeckSetup,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  afterTest,
  enemyDefeated,
  checkObjectives,
  actReveal,
  agendaReveal,
  resolution,
  scenarioResolution,
  allResigned,
  events,
  codexEntry,
  codexBranch,
  codexReadable,
  codexWasRead,
  codexReadIds,
  hemlocksHashingItOut,
  codexEvent,
  residentOf,
  residentByCode,
  residentAssetInPlay,
  residentEnemyInPlay,
  hasResidentNote,
  isResidentCrossedOut,
  recordTrue,
  recordValues,
  setRecord,
  introPlan,
  applyIntroChoice,
  applyIntroTokens,
  setupPlan,
  placeResidentAsset,
  flipResidentToEnemy,
  takeControlOfResident,
  obtainSetAsideResident,
  relationshipLevel,
  changeRelationship,
  setRelationshipLevel,
  residentNotes,
  addResidentNote,
  crossOutResident,
  crossedOutResidentsBeforeSetup,
  residentVictoryTarget,
  residentsInVictoryDisplay,
  addEnemyToVictoryDisplay,
  addBonusXpToAll,
  bonusXp,
  victoryXp,
  resolutionExperience,
  setPreludeDate,
  scenarioDateOf,
  placeSetupDoom,
  placeTimeMarker,
  addChaosToken,
  chaosBagCounts,
  spawnEnemyAt,
  ensureLocation,
  implementedEntryFlags,
  scenarioSummary,
  approximations,
}

export {
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, CODEX_IDS, LOCATION_IDS, LOCATIONS,
  NEXT_SCENARIO_ID, RECORD_KEYS, RESIDENTS, RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_CARDS,
  TIME_MARKER, isHardSide,
}
