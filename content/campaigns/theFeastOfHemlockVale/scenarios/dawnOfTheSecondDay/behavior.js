// 第二日黎明（dawnOfTheSecondDay · 提示卡 10677a / 参考卡 10704）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/PreludeDawnOfTheSecondDay.hs +
//       Act|Agenda/Cards/TheFeastOfHemlockVale/DayOfRain/*.hs +
//       Campaigns/TheFeastOfHemlockVale/{Helpers,TokenHelpers}.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/base.json（prelude2 段）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   introduction / preScenarioSetup → 开场文本、疲劳换标记、The Hemlock Curse / Gnawing Hunger、
//     第 2 日白天的日历与战役记录（day/time/hemlockDate）；
//   setupLocations / afterDeckSetup → The Vale 8 张白天地点、Day Two 时间标记、Residents 整组
//     放一边/划掉移出游戏、Judith Park 放 Crossroads、按人数在议程上放毁灭；
//   actions / performAction → 8 个地点的 [action]/[fast] 能力（法典 9–16、治疗、搜索法术/书、
//     快速移动、Tad's 的谈判）；
//   cluesGained → The Old Mill「发现线索后：法典 12」反应；
//   actReveal → 幕 1 背面法典 17（The Curse）；checkObjectives → 读到 3 条法典后推进幕；
//   agendaReveal → 议程 1 背面按 Bertie 记录进入结局 1/2，再链到结局 3；
//   resolution → 结局记录 + 不记胜利点 + 整备下一次勘察（引擎 prepareSurvey 读
//     scenario.mechanics.survey；下次开局跳过步骤 1–8 / 不再发起始手牌与重抽由 surveyOpening 实现）；
//   resolveChaosToken / applyTokenEffect → 10704 的四档符号（谈判自动成功等）；
//   investigatorCanBeDefeated → 幕 1「调查员不能被击败」的兜底读点（主读点是
//     scenario.mechanics.protectInvestigators）。
//
// 状态写入：居民关系/笔记/法典/Campaign Log 只写 campaign.records（章节既有惯例）或走
// api.mechanics.residents / api.mechanics.recordSets / api.codex 等引擎原语；状态字段只读。
// 唯一例外（已披露）：谈判在简单/普通下的 [cultist]「自动成功」没有 resolveChaosToken 契约字段，
// 写入引擎既有读点 `state.skillTest.autoSuccess`（tests.js 在成功判定前读取，与
// api-test.js#setTestAutoSuccess 同一字段）；若 api.setTestAutoSuccess 存在则优先走 api。
// 所有近似都在文件末 scenarioApproximations 与 index.js 中逐条披露。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODE, ACT_CODEX_THRESHOLD, AGENDA_CODE, CODEX_BY_LOCATION, CODEX_IDS, CODEX_NUMBERS,
  CODEX_RESIDENT_PLACEMENTS, CODEX_SPEC, HEMLOCK_CURSE_CODE, JUDITH_CODE, JUDITH_LOCATION, LOCATION_IDS,
  LOCATIONS, REMEMBERED, RESIDENT_CODES, RESIDENT_KEYS, RESIDENT_RECORDS, RESOLUTION_KEYS, SCENARIO_TEXT,
  SET_ASIDE_RESIDENT_CODES, START_LOCATION, SURVEY_DESTINATIONS, SURVEY_LABELS, TIME_MARKER, TIME_MARKER_CODE,
  TIME_MARKER_FACE, scenario,
} from './definition.js'
import {
  DAWN_TOKEN_MEANINGS, dawnChaosTokenOutcome, dayOf, isParleyAttempt,
} from './chaos.js'

const CHAPTER_ID = 'dawnOfTheSecondDay'
const DAWN_DAY = 2
const DAWN_PERIOD = 'day'
const CORN_HUSK_DOLL_CODE = '10714'
// 「Item story asset」：战役包里的 Item 支援（Heirlooms 10713–10715、Vale Lantern 10610/10611、
// Prismatic Shard 10522 等剧情资产），不含玩家牌组的普通 Item 卡（fhvp 包）。
const isStoryItemAsset = code => {
  const card = ALL_CARDS[String(code)]
  return Boolean(card) && card.type === 'asset' && Boolean(card.encounterCode) && card.pack === 'fhvc'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}
// 法典编号从 definition 取（共享地点/居民条目也引用 definition.CODEX_ENTRIES / CODEX_NUMBERS）。
export { CODEX_NUMBERS }
// 地点 [action] 的法典动作（Old Mill 是「发现线索后」的反应，不在这里）。
export const LOCATION_CODEX_ACTIONS = Object.freeze(Object.fromEntries(
  Object.entries(CODEX_BY_LOCATION).filter(([locationId]) => locationId !== 'theOldMill'),
))
// Campaign Log 记录键（与其它 FHV 章节同口径）。
export const RECORD_KEYS = Object.freeze({
  day: 'day',
  time: 'time',
  hemlockDate: 'hemlockDate',
  relationships: 'relationships',
  codexRead: 'codexRead',
  remembered: 'remembered',
  finishedTheirMeal: 'finishedTheirMeal',
  bertieWasRescued: 'bertieWasRescued',
  bertieWasLostInTheWoods: 'bertieWasLostInTheWoods',
  areasSurveyed: 'areasSurveyed',
  resolution: 'dawnSecondResolution',
  resolvedTo: 'dawnSecondResolvedTo',
  hemlockCurseAdded: 'hemlockCurseAdded',
  fatigueApplied: 'hemlockFatigueApplied',
})

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
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
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentSeat = state => Number.isSafeInteger(state?.currentSeat)
  ? state.currentSeat
  : (Number.isSafeInteger(state?.campaign?.leadSeat) ? state.campaign.leadSeat : 0)
const sceneSeat = (state, seat) => (Number.isSafeInteger(seat) && state?.investigators?.[seat] ? seat : currentSeat(state))
const currentActCode = state => codeOf(state?.acts?.[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf(state?.agendas?.[state.agendaIndex ?? 0])

function chooseOption(api, request, fallback = null) {
  if (typeof api?.choose !== 'function') return fallback
  const answer = api.choose(request)
  if (answer == null || answer === 'skip' || answer === 'cancel') return fallback
  return answer
}

/** 抽牌：引擎 api.drawCards，内容层测试退化为从牌库顶抽。 */
function drawCards(state, seat, amount, api = {}) {
  const count = Math.max(0, Number(amount) || 0)
  if (!count) return 0
  const drawn = safeCall(api, 'drawCards', seat, count)
  if (drawn != null) return Number(drawn) || count
  const inv = state?.investigators?.[seat]
  if (!inv) return 0
  inv.hand ||= []
  inv.deck ||= []
  let got = 0
  for (let index = 0; index < count; index++) {
    const code = inv.deck.pop()
    if (!code) break
    inv.hand.push(code)
    got += 1
  }
  return got
}
function gainResources(state, seat, amount, api = {}) {
  const n = Math.max(0, Number(amount) || 0)
  if (!n) return 0
  const gained = safeCall(api, 'gainResources', seat, n)
  if (gained != null) return Number(gained) || n
  const inv = state?.investigators?.[seat]
  if (!inv) return 0
  inv.resources = (Number(inv.resources) || 0) + n
  return n
}
function loseResources(state, seat, amount, api = {}) {
  const n = Math.max(0, Number(amount) || 0)
  if (!n) return 0
  const lost = safeCall(api, 'loseResources', seat, n)
  if (lost != null) return Number(lost) || n
  const inv = state?.investigators?.[seat]
  if (!inv) return 0
  inv.resources = Math.max(0, (Number(inv.resources) || 0) - n)
  return n
}
function moveInvestigator(state, seat, locationId, api = {}) {
  if (!locationId) return false
  const moved = safeCall(api, 'moveInvestigator', seat, locationId)
  if (moved != null) return moved !== false
  const inv = state?.investigators?.[seat]
  if (!inv) return false
  inv.location = locationId
  return true
}
/** 「每位调查员获得 N 点奖励经验」：api.addScenarioXpBonus 是结局结算的读点。 */
function addBonusXpAll(state, amount, api = {}) {
  const n = Number(amount) || 0
  if (!n) return 0
  let count = 0
  for (const inv of activeInvestigators(state)) {
    if (typeof api?.addScenarioXpBonus === 'function') api.addScenarioXpBonus(inv.seat, n)
    else inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + n
    count += 1
  }
  return count
}
function addBonusXpOne(state, seat, amount, api = {}) {
  const n = Number(amount) || 0
  if (!n) return 0
  if (typeof api?.addScenarioXpBonus === 'function') api.addScenarioXpBonus(seat, n)
  else {
    const inv = state?.investigators?.[seat]
    if (inv) inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + n
  }
  return n
}
/** 「搜索牌库顶 9 张」：引擎内容层只有整库检索原语（searchStartingCards → searchDeck），
 *  这里按整库近似并在 scenarioApproximations 披露。 */
function searchDeckToHand(state, seat, filters, api = {}) {
  const found = safeCall(api, 'searchStartingCards', seat, { ...filters, choose: 1 })
  if (found != null) return Array.isArray(found) ? found : [found].filter(Boolean)
  // 纯内容层回退：直接按特质在牌库里找第一张。
  const inv = state?.investigators?.[seat]
  if (!inv) return []
  inv.deck ||= []
  const traitList = [...(filters.traitsAny || []), ...(filters.trait ? [filters.trait] : [])]
    .map(value => String(value).toLowerCase())
  const index = inv.deck.findIndex(code => {
    const card = ALL_CARDS[code]
    if (!card) return false
    if (filters.type && card.type !== filters.type) return false
    return !traitList.length || (card.traits || []).some(trait => traitList.includes(String(trait).toLowerCase()))
  })
  if (index < 0) return []
  const [code] = inv.deck.splice(index, 1)
  inv.hand ||= []
  inv.hand.push(code)
  return [code]
}
function searchDeckAndPlay(state, seat, filters, api = {}) {
  const played = safeCall(api, 'searchAndPlayFromDeck', seat, filters)
  if (played != null) return played
  const found = searchDeckToHand(state, seat, filters, api)
  return found
}
function playFreeFromHand(state, seat, allowedTraits, api = {}) {
  const inv = state?.investigators?.[seat]
  if (!inv) return null
  const traits = allowedTraits.map(value => String(value).toLowerCase())
  const candidates = (inv.hand || []).filter(code => (ALL_CARDS[code]?.traits || [])
    .some(trait => traits.includes(String(trait).toLowerCase())))
  if (!candidates.length) return null
  const picked = candidates.length === 1 ? candidates[0] : chooseOption(api, {
    kind: 'card', source: 'dawnSecondCodex', seat, prompt: '选择要免费打出的卡牌。',
    options: candidates.map((code, index) => ({ id: String(index), cardCode: code, label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code })),
  }, '0')
  const code = candidates[Number(picked)] || candidates[0]
  if (safeCall(api, 'playCardFromHandFree', seat, code)) return code
  inv.hand = inv.hand.filter(item => item !== code)
  inv.assets ||= []
  inv.assets.push({
    id: `dawnSecond-free-${code}-${inv.assets.length + 1}`, code, originalCode: code,
    name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    controllerSeat: seat, ownerSeat: seat, exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [],
  })
  return code
}
export function addCampaignCard(state, seat, code, reason, api = {}) {
  // P8：传家宝（Heirlooms 10713–10715）与战役记录 heirloomsAwarded 同步（此前记录无人写）。
  const heirloom = ['10713', '10714', '10715'].includes(String(code))
  if (typeof api?.campaignCard === 'function') {
    api.campaignCard(code, seat, reason)
    if (heirloom) recordHeirloom(state, code)
    return true
  }
  const inv = state?.investigators?.[seat]
  if (inv) {
    inv.deck ||= []
    inv.deck.push(code)
    if (heirloom) recordHeirloom(state, code)
  }
  return Boolean(inv)
}
function recordHeirloom(state, code) {
  const records = state?.campaign?.records
  if (!records) return
  const awarded = Array.isArray(records.heirloomsAwarded) ? records.heirloomsAwarded : []
  if (!awarded.includes(code)) records.heirloomsAwarded = [...awarded, code]
}
function removeFromDeckPermanently(state, seat, code, api = {}) {
  safeCall(api, 'removeFromGameCards', [code])
  if (typeof api?.campaignCardChange === 'function') {
    api.campaignCardChange(state.campaign, seat, code, 'remove', 'theCommons')
  }
  const inv = state?.investigators?.[seat]
  if (inv) {
    inv.hand = (inv.hand || []).filter(item => item !== code)
    inv.deck = (inv.deck || []).filter(item => item !== code)
    inv.discard = (inv.discard || []).filter(item => item !== code)
  }
  return true
}
function campaignDeckOf(state, seat) {
  return state?.campaign?.investigators?.[seat]?.deck || []
}
function inDeckOrDiscard(state, seat, code) {
  const inv = state?.investigators?.[seat]
  return (inv?.deck || []).includes(code) || (inv?.discard || []).includes(code)
    || (inv?.hand || []).includes(code) || campaignDeckOf(state, seat).includes(code)
}

// ---------------------------------------------------------------------------
// 居民关系 / 笔记（引擎 resident-record.js 的记录形状）
// ---------------------------------------------------------------------------
export function relationshipLevel(state, resident) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec) return 0
  const records = recordsFor(state)
  const level = Number(records[spec.level])
  const legacy = Number(records.relationships?.[resident])
  return Math.max(0, Number.isFinite(level) ? level : 0, Number.isFinite(legacy) ? legacy : 0)
}

export function addRelationship(state, resident, amount = 1, api = {}) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec) return 0
  let next = null
  if (typeof api?.mechanics?.residents?.change === 'function') {
    const changed = api.mechanics.residents.change(spec, amount)
    if (typeof changed === 'number') next = changed
  }
  if (next == null) {
    next = Math.max(0, Math.min(spec.max, relationshipLevel(state, resident) + Number(amount || 0)))
  }
  // 两个读点同写：`<resident>RelationshipLevel`（resident-record.js）与
  // `relationships[resident]`（P7 各章的通用口径）；引擎路径写同值，便于存档/投影一致。
  const records = recordsFor(state)
  records[spec.level] = next
  records.relationships ||= {}
  records.relationships[resident] = next
  info(api, `与「${resident}」的关系等级 → ${next}`)
  return next
}

export function notesOf(state, resident) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec) return []
  const values = recordsFor(state)[spec.notes]
  return Array.isArray(values) ? [...values] : []
}

export function hasNote(state, resident, note) {
  return notesOf(state, resident).includes(note)
}

export function addNote(state, resident, note, api = {}) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec || !note) return false
  if (typeof api?.mechanics?.recordSets?.add === 'function') {
    const added = api.mechanics.recordSets.add(spec.notes, note)
    if (added != null) return added !== false
  }
  const records = recordsFor(state)
  const values = Array.isArray(records[spec.notes]) ? records[spec.notes] : []
  if (values.includes(note)) return false
  values.push(note)
  records[spec.notes] = values
  info(api, `「${resident}」的笔记：${SCENARIO_TEXT.noteLabels[resident]?.[note] || note}`)
  return true
}

export function isCrossedOut(state, resident) {
  const spec = RESIDENT_RECORDS[resident]
  return Boolean(spec && recordsFor(state)[spec.crossedOut] === true)
}

export function crossOutResident(state, resident, api = {}) {
  const spec = RESIDENT_RECORDS[resident]
  if (!spec || isCrossedOut(state, resident)) return false
  if (typeof api?.mechanics?.residents?.crossOut === 'function') return Boolean(api.mechanics.residents.crossOut(spec))
  recordsFor(state)[spec.crossedOut] = true
  return true
}

export const noteLabel = (resident, note) => SCENARIO_TEXT.noteLabels?.[resident]?.[note] || note

// ---------------------------------------------------------------------------
// 剧情标记（Campaign Log 的 Remembered）：records.remembered 对象（与其它 FHV 章节一致）
// ---------------------------------------------------------------------------
export function rememberedFor(state) {
  const records = recordsFor(state)
  if (!records[RECORD_KEYS.remembered] || typeof records[RECORD_KEYS.remembered] !== 'object'
    || Array.isArray(records[RECORD_KEYS.remembered])) records[RECORD_KEYS.remembered] = {}
  return records[RECORD_KEYS.remembered]
}
export const isRemembered = (state, key) => rememberedFor(state)[key] === true
export function rememberFact(state, key, api = {}) {
  const remembered = rememberedFor(state)
  if (remembered[key]) return false
  remembered[key] = true
  info(api, `记录：${SCENARIO_TEXT.remembered?.[key] || key}`)
  return true
}

// ---------------------------------------------------------------------------
// 时间推进：第 2 日白天
// ---------------------------------------------------------------------------
/** preScenarioSetup 把时间推进到第 2 日白天（战役 meta 的 Day2/Day）。 */
export function setDawnDay(state, api = {}) {
  const records = recordsFor(state)
  records[RECORD_KEYS.day] = DAWN_DAY
  records[RECORD_KEYS.time] = 'Day'
  const calendar = api?.mechanics?.calendar
  if (typeof calendar?.set === 'function') {
    const current = calendar.current?.()
    if (!current || Number(current.day) !== DAWN_DAY || current.period !== DAWN_PERIOD) calendar.set(DAWN_DAY, DAWN_PERIOD)
  } else {
    flagsFor(state).dawnSecondDay = DAWN_DAY
    const data = (state.scenarioFlags.mechanics ||= { version: 1 })
    data.scenarioDate = { day: DAWN_DAY, period: DAWN_PERIOD }
    records[RECORD_KEYS.hemlockDate] = `${DAWN_DAY}:${DAWN_PERIOD}`
  }
  return { day: DAWN_DAY, period: DAWN_PERIOD }
}

export const dayOfDawn = state => {
  const day = dayOf(state)
  return day === DAWN_DAY ? DAWN_DAY : day
}

// ---------------------------------------------------------------------------
// 开场：疲劳 / The Hemlock Curse / Gnawing Hunger
// ---------------------------------------------------------------------------
export const FATIGUE_REPLACEMENT = Object.freeze({ count: 2, delta: -1 })
/** 指南 Intro：「Draw tokens … until you have 2 non-symbol tokens. Replace these tokens with a
 *  chaos token of a value 1 lower for the remainder of the campaign.」 */
export function fatigueReplacement() {
  return { ...FATIGUE_REPLACEMENT, note: '2 个非符号标记改为数值低 1 的标记（战役袋永久）' }
}

function applyFatigue(state, api = {}) {
  const flags = flagsFor(state)
  const records = recordsFor(state)
  if (flags.dawnSecondFatigueApplied === true || records[RECORD_KEYS.fatigueApplied] === true) {
    return { applied: false, replaced: flags.dawnSecondFatigueReplaced || [] }
  }
  const replaced = safeCall(api?.mechanics?.chaosTokens, 'replaceCampaignNumeric', FATIGUE_REPLACEMENT.count, FATIGUE_REPLACEMENT.delta)
  flags.dawnSecondFatigueApplied = true
  flags.dawnSecondFatigueReplaced = Array.isArray(replaced) ? replaced : []
  // 战役记录：重开本序曲（scenarioFlags 被重置）时不会再次替换战役混乱袋。
  records[RECORD_KEYS.fatigueApplied] = true
  if (Array.isArray(replaced) && replaced.length) {
    info(api, `疲劳：${replaced.map(row => `${row.from}→${row.to}`).join('、')}（战役混乱袋永久替换）`)
  } else if (replaced === false) {
    info(api, '疲劳：混乱袋里的非符号标记不足，无法按印刷替换；保留原袋（近似）。')
  }
  return { applied: true, replaced: flags.dawnSecondFatigueReplaced }
}

function introduceBranch(state, branchKey, investigators, api = {}) {
  const body = SCENARIO_TEXT.introBranches[branchKey]
  if (!body) return
  const names = investigators.map(inv => inv.name).join('、')
  if (typeof api?.present === 'function') {
    api.present(body, {
      kind: 'story', title: branchKey === 'theHemlockCurse' ? 'The Hemlock Curse' : 'Gnawing Hunger',
      code: TIME_MARKER_CODE, name: names || scenario.name, text: body,
    })
  } else {
    info(api, body)
  }
}

/** 「finished their meal」记录：支持组级布尔（true = 全队）、座位数组、{seat:true} 映射，
 *  以及战役层按调查员写入的 `campaign.investigators[seat].finishedTheirMeal`。 */
export function finishedMealSeats(state) {
  const records = recordsFor(state)
  const raw = records[RECORD_KEYS.finishedTheirMeal]
  const active = new Set(activeInvestigators(state).map(inv => inv.seat))
  const result = new Set()
  if (raw === true) for (const seat of active) result.add(seat)
  else if (Array.isArray(raw)) for (const value of raw) { const seat = Number(value); if (active.has(seat)) result.add(seat) }
  else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const seat = Number(key)
      if (value === true && active.has(seat)) result.add(seat)
    }
  }
  for (const seat of active) {
    if (state?.campaign?.investigators?.[seat]?.finishedTheirMeal === true) result.add(seat)
  }
  return result
}

/** 开场分支：finished their meal → The Hemlock Curse（加弱点）；否则 Gnawing Hunger（1 肉体创伤）。 */
export function resolveIntroChoices(state, api = {}) {
  const records = recordsFor(state)
  const finishedSeats = finishedMealSeats(state)
  const finished = activeInvestigators(state).filter(inv => finishedSeats.has(inv.seat))
  const hungry = activeInvestigators(state).filter(inv => !finishedSeats.has(inv.seat))
  const cursed = []
  for (const inv of finished) {
    addCampaignCard(state, inv.seat, HEMLOCK_CURSE_CODE, '第二日黎明：The Hemlock Curse', api)
    cursed.push(inv.seat)
  }
  const traumatized = []
  for (const inv of hungry) {
    if (typeof api?.addTrauma === 'function') api.addTrauma(inv.seat, 'physical', 1)
    else {
      state.campaign.trauma ||= {}
      state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[inv.seat].physical += 1
    }
    traumatized.push(inv.seat)
  }
  if (cursed.length) {
    records[RECORD_KEYS.hemlockCurseAdded] = true
    introduceBranch(state, 'theHemlockCurse', finished, api)
    info(api, `${finished.map(inv => inv.name).join('、')} 把「The Hemlock Curse」弱点加入牌组（不占牌组张数）。`)
  }
  if (hungry.length) {
    introduceBranch(state, 'gnawingHunger', hungry, api)
    info(api, `${hungry.map(inv => inv.name).join('、')} 承受 1 点肉体创伤。`)
  }
  return { cursed, traumatized }
}

/** 引擎 introduction 钩子：把开场标题/正文、疲劳与两条分支拼成阅读器日志。 */
export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : {
    campaign: { records }, scenarioFlags: context?.scenarioFlags || {},
    investigators: context?.investigators || [],
  }
  const sections = []
  const lead = htmlParagraphs(SCENARIO_TEXT.intro)
  if (lead.length) sections.push({ title: SCENARIO_TEXT.heading || sc?.name || scenario.name, paragraphs: lead })
  const fatigue = htmlParagraphs(SCENARIO_TEXT.fatigue.body)
  if (fatigue.length) sections.push({ title: SCENARIO_TEXT.fatigue.title || 'Fatigue', paragraphs: fatigue })
  const finishedSeats = finishedMealSeats(state)
  const finished = (state.investigators || []).filter(inv => finishedSeats.has(inv.seat))
  const hungry = (state.investigators || []).filter(inv => !finishedSeats.has(inv.seat))
  if (finished.length) sections.push({ title: 'The Hemlock Curse', paragraphs: htmlParagraphs(SCENARIO_TEXT.introBranches.theHemlockCurse) })
  if (hungry.length) sections.push({ title: 'Gnawing Hunger', paragraphs: htmlParagraphs(SCENARIO_TEXT.introBranches.gnawingHunger) })
  return {
    version: 3, title: sc?.name || scenario.name, sections,
    paragraphs: sections.flatMap(section => section.paragraphs),
    code: ACT_CODE,
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

/** 引擎钩子：开场（疲劳 + 两条分支）与时间推进。 */
export function preScenarioSetup(state, events = [], api = {}) {
  void events
  const calendar = setDawnDay(state, api)
  const fatigue = applyFatigue(state, api)
  const intro = resolveIntroChoices(state, api)
  return { calendar, fatigue, intro }
}

// ---------------------------------------------------------------------------
// 剧情资产 / 居民入场
// ---------------------------------------------------------------------------
export function residentInPlay(state, code) {
  return (state?.storyAssets || []).find(asset => codeOf(asset) === String(code)) || null
}
export function putResidentInPlay(state, code, location = null, api = {}) {
  const key = String(code)
  const existing = residentInPlay(state, key)
  if (existing) {
    if (location) existing.location = location
    return existing
  }
  const spawned = safeCall(api, 'storyAsset', key, location)
  if (spawned) {
    spawned.face ||= 'asset'
    return spawned
  }
  const card = ALL_CARDS[key] || {}
  const asset = {
    id: `dawnSecondResident-${key}`, code: key, originalCode: key,
    name: card.nameZh || card.name || key, face: 'asset', location,
    controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets ||= []
  state.storyAssets.push(asset)
  return asset
}
export function residentsInPlay(state) {
  return (state?.storyAssets || []).filter(asset => SET_ASIDE_RESIDENT_CODES.includes(codeOf(asset)))
}

export function timeMarkerInPlay(state) {
  return (state?.storyAssets || []).find(asset => codeOf(asset) === TIME_MARKER_CODE) || null
}
export function putTimeMarkerInPlay(state, api = {}) {
  const existing = timeMarkerInPlay(state)
  if (existing) return faceTimeMarker(existing)
  const spawned = safeCall(api, 'storyAsset', TIME_MARKER_CODE, null)
  if (spawned) return faceTimeMarker(spawned)
  const card = ALL_CARDS[TIME_MARKER_CODE] || {}
  const marker = {
    id: `dawnSecond-${TIME_MARKER_CODE}`, code: TIME_MARKER_CODE, originalCode: TIME_MARKER_CODE,
    name: card.nameZh || card.name || TIME_MARKER.name, nameEn: card.name || TIME_MARKER.nameEn,
    global: true, location: null, controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
  }
  state.storyAssets ||= []
  state.storyAssets.push(marker)
  return faceTimeMarker(marker)
}
function faceTimeMarker(marker) {
  if (!marker) return marker
  marker.face = TIME_MARKER_FACE
  marker.stepCode = TIME_MARKER.stepCode
  return marker
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function locationInstance(state, id) {
  const base = LOCATIONS[id]
  if (!base) return null
  const def = clone(base)
  const count = investigatorCount(state)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * count : Number(def.clues) || 0)
  return {
    ...def, id, revealed: true, clues, maxClues: clues,
    connections: [...(def.connections || [])],
    symbolLinks: [...(def.connections || [])],
    attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

/** setupLocations：The Vale 8 张白天地点全部入场（每张已翻到白天面）。 */
export function setupLocations(state, events = [], api = {}) {
  void events
  void api
  // 起始地点排第一，其余按模板从上到下、从左到右。
  return [START_LOCATION, ...LOCATION_IDS.filter(id => id !== START_LOCATION)]
}

/** afterDeckSetup：Day Two 时间标记、Residents 放一边/划掉、Judith、按人数的毁灭。 */
export function afterDeckSetup(state, events = [], helper = {}) {
  void events
  const api = helper?.api || helper
  state.scenarioZones ||= {}
  const marker = putTimeMarkerInPlay(state, api)
  const residents = setupResidents(state, api)
  const doom = placeSetupDoom(state, api)
  return {
    timeMarker: marker ? codeOf(marker) : null,
    residentsSetAside: [...residents.setAside],
    residentsRemoved: [...residents.removed],
    judith: residents.judith ? codeOf(residents.judith) : null,
    doom,
  }
}

function setupResidents(state, api = {}) {
  const records = recordsFor(state)
  const removed = []
  const setAside = []
  for (const code of SET_ASIDE_RESIDENT_CODES) {
    const resident = RESIDENT_KEYS.find(id => RESIDENT_CODES[id] === code)
    if (resident && records[RESIDENT_RECORDS[resident].crossedOut] === true) {
      removed.push(code)
      continue
    }
    if (code === JUDITH_CODE) continue
    setAside.push(code)
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAsideResidents = setAside
  state.scenarioZones.removedResidents = removed
  const judith = putResidentInPlay(state, JUDITH_CODE, JUDITH_LOCATION, api)
  info(api, `布置：Residents 组 ${setAside.length} 张放一边、${removed.length} 张被划掉移出游戏；Judith Park 放在 The Crossroads。`)
  return { setAside, removed, judith }
}

function placeSetupDoom(state, api = {}) {
  const count = investigatorCount(state)
  if (!count) return 0
  if (typeof api?.addDoom === 'function') {
    api.addDoom(count)
  } else {
    state.doom = (Number(state.doom) || 0) + count
  }
  info(api, `布置：在议程上放置 ${count} 点毁灭（= 调查员人数）。`)
  return count
}

/** 直调/单测入口：布置 8 地点 + afterDeckSetup（真实引擎走 setupLocations/afterDeckSetup）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioZones ||= {}
  for (const id of setupLocations(state, [], api)) {
    const instance = locationInstance(state, id)
    if (instance) state.locations.push(instance)
  }
  const extras = afterDeckSetup(state, [], { api })
  return { locations: state.locations.map(location => location.id), ...extras }
}

// ---------------------------------------------------------------------------
// 法典
// ---------------------------------------------------------------------------
function codexSpecOf(id) {
  return CODEX_SPEC.find(entry => entry.id === id) || null
}
function codexResolvedKeys(state) {
  const data = state?.scenarioFlags?.mechanics
  return Array.isArray(data?.resolvedCodex) ? data.resolvedCodex : []
}
/** 引擎 scenario-calendar.js#codexSelection 的纯内容镜像（测试与无引擎回退共用）。 */
export function codexBranchFor(state, id) {
  const entry = codexSpecOf(id)
  if (!entry) return null
  const records = recordsFor(state)
  if (entry.resident) {
    if (entry.resident.crossedOut && records[entry.resident.crossedOut] === true) return null
    const level = Number(records[entry.resident.relationship]) || 0
    const notes = Array.isArray(records[entry.resident.notes]) ? records[entry.resident.notes] : []
    const branch = entry.branches.find(row => level >= (row.minRelationship ?? 0)
      && level <= (row.maxRelationship ?? Infinity)
      && (row.notes || []).every(note => notes.includes(note))
      && (row.withoutNotes || []).every(note => !notes.includes(note)))
    return branch ? branch.id : null
  }
  return entry.branches[0]?.id || null
}

export function codexReadCount(state, id = null) {
  const records = recordsFor(state)
  const read = records[RECORD_KEYS.codexRead]
  if (id != null) return read && typeof read === 'object' ? Number(read[id]) || 0 : 0
  if (!read || typeof read !== 'object') return 0
  return Object.values(read).reduce((sum, value) => sum + (Number(value) || 0), 0)
}
export function isCodexRead(state, id) {
  return codexReadCount(state, id) > 0 || codexResolvedKeys(state).includes(id)
}
export function codexAvailable(state, id) {
  const entry = codexSpecOf(id)
  if (!entry) return false
  if (codexBranchFor(state, id) == null) return false
  if (entry.limit === 'unlimited') return true
  return !isCodexRead(state, id)
}
function markCodexRead(state, id, api = {}, seat = null) {
  const records = recordsFor(state)
  records[RECORD_KEYS.codexRead] ||= {}
  records[RECORD_KEYS.codexRead][id] = (Number(records[RECORD_KEYS.codexRead][id]) || 0) + 1
  if (Number.isSafeInteger(seat)) markCodexSeat(state, id, seat)
  void api
}

// Codex 14（Tad's）：「An investigator may trigger this codex again if they are 'running an errand'」。
// 引擎 resolvedCodex 只有整场一次，故 C14 声明 unlimited，逐座位的一次性用 scenarioFlags 记账。
function codexSeatLedger(state) {
  const flags = flagsFor(state)
  flags.dawnSecondCodexSeats ||= {}
  return flags.dawnSecondCodexSeats
}
export function codexSeatRead(state, id, seat) {
  return (codexSeatLedger(state)[id] || []).includes(seat)
}
function markCodexSeat(state, id, seat) {
  const ledger = codexSeatLedger(state)
  const list = ledger[id] ||= []
  if (!list.includes(seat)) list.push(seat)
}

function presentCodex(state, api, id, bodyParts) {
  const entry = SCENARIO_TEXT.codex[id] || {}
  const title = entry.title || `${id}`
  const body = bodyParts.filter(Boolean).join('\n\n')
  if (typeof api?.present === 'function') {
    api.present(body, {
      kind: 'story', title, code: TIME_MARKER_CODE, name: title, text: body,
      codex: id, codexNumber: CODEX_NUMBERS[id] ?? null,
    })
  } else {
    info(api, `${title}\n${body}`)
  }
}

/**
 * 阅读一条法典。优先走引擎 `api.mechanics.codex.resolve`（scenario-calendar.js 负责居民分支/
 * 限次/解锁记录）；没有引擎时走本文件的纯内容镜像（测试与直调）。
 * 返回是否成功结算。
 */
export function codex(state, id, api = {}, options = {}) {
  if (!codexSpecOf(id)) return false
  const seat = sceneSeat(state, options.seat ?? api.seat)
  // Tad's 的 mechanics.codex 用 unlimited 才能允许「running an errand」后再次触发；
  // 逐座位的一次性（以及跑腿例外）由内容层在此收口。
  if (id === 'tadsGeneralStore' && codexSeatRead(state, id, seat)
    && !isRemembered(state, REMEMBERED.youAreRunningAnErrand)) return false
  if (!codexAvailable(state, id)) return false
  const branch = codexBranchFor(state, id)
  if (branch == null) return false
  if (typeof api?.mechanics?.codex?.resolve === 'function') {
    let applied = false
    const resolved = api.mechanics.codex.resolve(id, seat, context => {
      applied = true
      applyCodexEffect(state, id, context?.branch || branch, context?.seat ?? seat, api)
    })
    if (!resolved || !applied) return false
    markCodexRead(state, id, api, seat)
    return true
  }
  markCodexRead(state, id, api, seat)
  applyCodexEffect(state, id, branch, seat, api)
  return true
}

/** 法典效果总表（印刷文本的机械效果；选择类由 api.choose 决定，缺省取第一项）。 */
export function applyCodexEffect(state, id, branch, seat, api = {}) {
  const entry = SCENARIO_TEXT.codex[id] || {}
  const actor = state?.investigators?.[seat]
  switch (id) {
    case 'motherRachel': {
      addRelationship(state, 'motherRachel', 1, api)
      addBonusXpAll(state, 1, api)
      presentCodex(state, api, id, [entry.motherRachel1, entry[branch] || entry.motherRachel3])
      if (branch === 'motherRachel2') {
        addCampaignCard(state, seat, CORN_HUSK_DOLL_CODE, '第二日黎明：Corn Husk Doll', api)
        info(api, 'Cod.1：把 Corn Husk Doll 加入你的牌组（不占张数）。')
      } else {
        drawCards(state, seat, 1, api)
        playFreeFromHand(state, seat, ['Charm', 'Spell'], api)
      }
      return true
    }
    case 'simeonAtwood': {
      // 印刷文本没有关系/经验奖励（base.json 的 codex.xp 也没有 simeonAtwood）。
      if (branch === 'hatchedAPlan') {
        addNote(state, 'simeonAtwood', 'thePlanIsUnderway', api)
        presentCodex(state, api, id, [entry.hatchedAPlan])
      } else {
        presentCodex(state, api, id, [entry.otherwise])
        drawCards(state, seat, 1, api)
        searchDeckToHand(state, seat, { traitsAny: ['Tactic', 'Trick'] }, api)
      }
      return true
    }
    case 'williamHemlock': {
      addNote(state, 'williamHemlock', 'williamTookHeart', api)
      addRelationship(state, 'williamHemlock', 1, api)
      addRelationship(state, 'riverHawthorne', -1, api)
      addBonusXpAll(state, 1, api)
      presentCodex(state, api, id, [entry.body])
      searchDeckToHand(state, seat, { traitsAny: ['Tome', 'Talent'] }, api)
      return true
    }
    case 'riverHawthorne': {
      addNote(state, 'riverHawthorne', 'theSchemeIsInMotion', api)
      addRelationship(state, 'riverHawthorne', 2, api)
      addRelationship(state, 'williamHemlock', -1, api)
      addBonusXpAll(state, 2, api)
      presentCodex(state, api, id, [entry.body])
      gainResources(state, seat, 4, api)
      return true
    }
    case 'gideonMizrah': {
      addRelationship(state, 'gideonMizrah', 1, api)
      addBonusXpAll(state, 1, api)
      if (branch === 'gideon2') {
        addNote(state, 'gideonMizrah', 'gideonToldTheTaleOfTheAnnabelleLee', api)
        presentCodex(state, api, id, [entry.gideon1, entry.gideon2])
      } else {
        presentCodex(state, api, id, [entry.gideon1, entry.gideon3])
      }
      drawCards(state, seat, 3, api)
      return true
    }
    case 'judithPark': {
      if (branch === 'judith2') {
        presentCodex(state, api, id, [entry.judith1, entry.judith2])
        const picked = chooseOption(api, {
          kind: 'story', source: 'dawnSecondCodexJudith', seat,
          prompt: entry.judith1 ? '“I can handle myself.” / “Thanks for saving us.”' : '选择回答。',
          options: [
            { id: 'iCanHandleMyself', label: SCENARIO_TEXT.codex.labels.judith.iCanHandleMyself || 'I can handle myself.' },
            { id: 'thanksForSavingUs', label: SCENARIO_TEXT.codex.labels.judith.thanksForSavingUs || 'Thanks for saving us.' },
          ],
        }, 'iCanHandleMyself')
        if (picked === 'thanksForSavingUs') {
          addRelationship(state, 'judithPark', -1, api)
          addBonusXpAll(state, 1, api)
          presentCodex(state, api, id, [entry.judith4])
        } else {
          addRelationship(state, 'judithPark', 1, api)
          addBonusXpAll(state, 1, api)
          presentCodex(state, api, id, [entry.judith3])
        }
      } else {
        presentCodex(state, api, id, [entry.judith1])
        drawCards(state, seat, 1, api)
        playFreeFromHand(state, seat, ['Weapon'], api)
      }
      return true
    }
    case 'theoPeters': {
      if (branch === 'distractedTheBear') {
        addRelationship(state, 'theoPeters', 1, api)
        addBonusXpAll(state, 1, api)
        presentCodex(state, api, id, [entry.distractedTheBear])
      } else {
        presentCodex(state, api, id, [entry.otherwise])
      }
      // 「你可以立即移动到任意地点」：候选 = 全部地点，可选。
      const destination = chooseOption(api, {
        kind: 'location', source: 'dawnSecondCodexTheo', seat,
        prompt: 'Theo Peters：你可以立即移动到任意地点。',
        canSkip: true,
        options: [{ id: 'skip', label: '不移动' }, ...LOCATION_IDS.map(locationId => ({
          id: locationId, label: LOCATIONS[locationId]?.name || locationId,
        }))],
      }, 'skip')
      if (destination && destination !== 'skip') moveInvestigator(state, seat, destination, api)
      return true
    }
    case 'boardingHouse': {
      presentCodex(state, api, id, [entry.body])
      // 每次触发结算 1 个选项；「额外选项」按法典可重复触发建模（每次 1 行动）。
      const picked = chooseOption(api, {
        kind: 'story', source: 'dawnSecondCodexBoardingHouse', seat,
        prompt: SCENARIO_TEXT.codex.labels.additionalActions || '选择 1 个选项',
        options: ['help', 'simeon', 'gideon'].map(option => ({
          id: option, label: SCENARIO_TEXT.codex.labels.boardingHouse[option] || option,
        })),
      }, 'help')
      if (picked === 'simeon') {
        putResidentInPlay(state, RESIDENT_CODES.simeonAtwood, 'theOldMill', api)
      } else if (picked === 'gideon') {
        putResidentInPlay(state, RESIDENT_CODES.gideonMizrah, 'theCommons', api)
      } else {
        const here = activeInvestigators(state).filter(inv => inv.location === 'boardingHouse')
        const mover = here.length === 1 ? here[0] : here.find(inv => inv.seat === seat) || here[0]
        if (mover) moveInvestigator(state, mover.seat, 'theCrossroads', api)
      }
      return true
    }
    case 'theCrossroads': {
      presentCodex(state, api, id, [entry.body])
      drawCards(state, seat, 1, api)
      rememberFact(state, REMEMBERED.youAreRunningAnErrand, api)
      return true
    }
    case 'hemlockChapel': {
      presentCodex(state, api, id, [entry.body])
      putResidentInPlay(state, RESIDENT_CODES.motherRachel, CODEX_RESIDENT_PLACEMENTS.motherRachel.location, api)
      return true
    }
    case 'theOldMill': {
      presentCodex(state, api, id, [entry.body])
      drawCards(state, seat, 3, api)
      return true
    }
    case 'theAtwoodHouse': {
      presentCodex(state, api, id, [entry.body])
      const william = relationshipLevel(state, 'williamHemlock') >= 2
      const river = relationshipLevel(state, 'riverHawthorne') >= 2
      const options = []
      if (william) options.push({ id: 'william', label: SCENARIO_TEXT.codex.labels.theAtwoodHouse.william || 'William' })
      if (river) options.push({ id: 'river', label: SCENARIO_TEXT.codex.labels.theAtwoodHouse.river || 'River' })
      options.push({ id: 'fight', label: SCENARIO_TEXT.codex.labels.theAtwoodHouse.fight || 'Let them fight it out.' })
      const picked = chooseOption(api, {
        kind: 'story', source: 'dawnSecondCodexAtwood', seat, prompt: 'The Atwood House：选择一方或让他们打。', options,
      }, options[options.length - 1].id)
      if (picked === 'william') {
        putResidentInPlay(state, RESIDENT_CODES.williamHemlock, CODEX_RESIDENT_PLACEMENTS.williamHemlock.location, api)
      } else if (picked === 'river') {
        putResidentInPlay(state, RESIDENT_CODES.riverHawthorne, CODEX_RESIDENT_PLACEMENTS.riverHawthorne.location, api)
      } else {
        addRelationship(state, 'williamHemlock', -1, api)
        addRelationship(state, 'riverHawthorne', -1, api)
        presentCodex(state, api, id, [entry.body2])
      }
      return true
    }
    case 'tadsGeneralStore': {
      if (isRemembered(state, REMEMBERED.youAreRunningAnErrand)) {
        presentCodex(state, api, id, [entry.runningAnErrand])
        addRelationship(state, 'leahAtwood', 1, api)
        addBonusXpAll(state, 1, api)
        return true
      }
      presentCodex(state, api, id, [entry.otherwise])
      const resources = Number(actor?.resources) || 0
      if (resources < 3) return true
      const picked = chooseOption(api, {
        kind: 'story', source: 'dawnSecondCodexTads', seat,
        prompt: '花费 3 资源，从牌库搜索 1 张 Item 支援并免费打出？',
        canSkip: true,
        options: [{ id: 'skip', label: '不购买' }, { id: 'buy', label: SCENARIO_TEXT.codex.labels.tadsGeneralStore.item || '购买 Item' }],
      }, 'skip')
      if (picked !== 'buy') return true
      loseResources(state, seat, 3, api)
      searchDeckAndPlay(state, seat, { type: 'asset', trait: 'Item' }, api)
      return true
    }
    case 'valeSchoolhouse': {
      presentCodex(state, api, id, [entry.body])
      putResidentInPlay(state, RESIDENT_CODES.theoPeters, CODEX_RESIDENT_PLACEMENTS.theoPeters.location, api)
      return true
    }
    case 'theCommons': {
      presentCodex(state, api, id, [entry.body])
      const inv = actor
      if (!inv) return true
      // 「Item story asset」= 战役包里的 Item 剧情支援（Heirlooms / Vale Lantern / Shard 等）。
      const owned = [...new Set([
        ...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || []),
        ...campaignDeckOf(state, seat),
      ])]
      const candidates = owned.filter(code => isStoryItemAsset(code))
      if (!candidates.length) return true
      const picked = chooseOption(api, {
        kind: 'card', source: 'dawnSecondCodexCommons', seat,
        prompt: '选择 1 张 Item 剧情资产永久移出牌组。', canSkip: true,
        options: [{ id: 'skip', label: '不移除' }, ...candidates.map((code, index) => ({
          id: String(index), cardCode: code, label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
        }))],
      }, 'skip')
      if (picked === 'skip' || picked == null) return true
      const code = candidates[Number(picked)] || candidates[0]
      removeFromDeckPermanently(state, seat, code, api)
      const eligible = RESIDENT_KEYS.filter(id => relationshipLevel(state, id) <= 2)
      if (!eligible.length) return true
      const resident = chooseOption(api, {
        kind: 'resident', source: 'dawnSecondCodexCommons', seat,
        prompt: '选择 1 名关系等级 ≤ 2 的居民，其关系 +1。',
        options: eligible.map(id => ({ id, label: ALL_CARDS[RESIDENT_CODES[id]]?.nameZh || ALL_CARDS[RESIDENT_CODES[id]]?.name || id })),
      }, eligible[0])
      addRelationship(state, eligible.includes(resident) ? resident : eligible[0], 1, api)
      addBonusXpAll(state, 1, api)
      return true
    }
    case 'theCurse': {
      presentCodex(state, api, id, [entry.body])
      addBonusXpOne(state, seat, 2, api)
      const inDeck = inDeckOrDiscard(state, seat, HEMLOCK_CURSE_CODE) || isCodexCurseInDeck(state, seat)
      if (!inDeck) {
        addCampaignCard(state, seat, HEMLOCK_CURSE_CODE, '第二日黎明：The Curse', api)
        recordsFor(state)[RECORD_KEYS.hemlockCurseAdded] = true
      } else {
        // 「下次开局把它加入起始手牌」→ 先用整库检索把它放到手里；结局整备会把手牌快照成
        // 下一关的起始手牌（近似：只查牌库，不查弃牌堆）。
        searchDeckToHand(state, seat, { type: 'skill', trait: 'Blight' }, api)
      }
      return true
    }
    default:
      return false
  }
}

function isCodexCurseInDeck(state, seat) {
  return campaignDeckOf(state, seat).includes(HEMLOCK_CURSE_CODE)
}

// ---------------------------------------------------------------------------
// 地点能力
// ---------------------------------------------------------------------------
const healUsedKey = state => Boolean(flagsFor(state).dawnBoardingHouseHealUsed)
const chapelSearchUsedKey = state => Boolean(flagsFor(state).dawnChapelSpellSearchUsed)
const schoolSearchUsedKey = state => Boolean(flagsFor(state).dawnSchoolhouseTomeSearchUsed)
function crossroadsMoveUsed(state) {
  const flags = flagsFor(state)
  return Number(flags.dawnCrossroadsMoveRound) === Number(state?.round ?? 0)
}

function codexActionFor(locationId) {
  const codexId = LOCATION_CODEX_ACTIONS[locationId]
  if (!codexId) return null
  const number = CODEX_NUMBERS[codexId]
  const name = LOCATIONS[locationId]?.name || locationId
  return {
    action: 'scenarioAction', rule: `dawnSecondCodex:${codexId}`, locationId, actions: 1,
    codex: codexId,
    label: `法典 ${number}：${name}`,
  }
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const codexMove = codexActionFor(here.id)
  if (codexMove) {
    const tadRepeat = here.id === 'tadsGeneralStore' && isRemembered(state, REMEMBERED.youAreRunningAnErrand)
    // Tad's 的 mechanics.codex 是 unlimited（允许跑腿后再触发）；逐座位的一次性由内容层收口。
    const seatRead = here.id === 'tadsGeneralStore' && codexSeatRead(state, codexMove.codex, inv.seat)
    const available = here.id === 'tadsGeneralStore' ? (!seatRead || tadRepeat) : codexAvailable(state, codexMove.codex)
    if (available) moves.push(codexMove)
    else moves.push({ ...codexMove, reason: `法典 ${CODEX_NUMBERS[codexMove.codex]} 本场已由你读过。` })
  }
  if (here.id === 'boardingHouse') {
    const used = healUsedKey(state)
    moves.push({
      action: 'scenarioAction', rule: 'dawnSecondBoardingHeal', locationId: here.id, actions: 1,
      label: '旅舍：治疗 1 点伤害或 1 点恐惧（每场游戏一次）',
      ...(used ? { reason: '每场游戏一次的治疗已经用过。' } : {}),
    })
  }
  if (here.id === 'theCrossroads') {
    const count = investigatorCount(state)
    const used = crossroadsMoveUsed(state)
    moves.push({
      action: 'scenarioAction', rule: 'dawnSecondCrossroadsMove', locationId: here.id, actions: 0,
      label: '十字路口：快速移动到连接地点（1–2 名调查员时，每轮团队一次）',
      ...(count > 2 ? { reason: '只有 1–2 名调查员时才能使用。' }
        : used ? { reason: '本轮已经用过。' } : {}),
    })
  }
  if (here.id === 'hemlockChapel') {
    moves.push({
      action: 'scenarioAction', rule: 'dawnSecondChapelSearch', locationId: here.id, actions: 1,
      label: '毒堇教堂：从牌库顶 9 张找 1 张 Spell 并抽取（每场游戏一次）',
      ...(chapelSearchUsedKey(state) ? { reason: '每场游戏一次的检索已经用过。' } : {}),
    })
  }
  if (here.id === 'valeSchoolhouse') {
    moves.push({
      action: 'scenarioAction', rule: 'dawnSecondSchoolSearch', locationId: here.id, actions: 1,
      label: '山谷学校：从牌库搜索 1 张 Tome 支援并抽取（每场游戏一次）',
      ...(schoolSearchUsedKey(state) ? { reason: '每场游戏一次的检索已经用过。' } : {}),
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const rule = String(move.rule || '')
  if (rule.startsWith('dawnSecondCodex:')) {
    const id = rule.slice('dawnSecondCodex:'.length)
    return codex(state, id, api, { seat: inv.seat })
  }
  if (rule === 'dawnSecondBoardingHeal') return boardingHouseHeal(state, inv, api)
  if (rule === 'dawnSecondCrossroadsMove') return crossroadsFastMove(state, inv, api)
  if (rule === 'dawnSecondChapelSearch') return chapelSpellSearch(state, inv, api)
  if (rule === 'dawnSecondSchoolSearch') return schoolhouseTomeSearch(state, inv, api)
  return false
}

function boardingHouseHeal(state, inv, api = {}) {
  const flags = flagsFor(state)
  if (flags.dawnBoardingHouseHealUsed) return false
  const damage = Number(inv.damage) || 0
  const horror = Number(inv.horror) || 0
  if (!damage && !horror) return false
  const choice = damage && horror
    ? chooseOption(api, {
      kind: 'damage', source: 'dawnSecondBoardingHeal', seat: inv.seat, prompt: '治疗 1 点伤害还是 1 点恐惧？',
      options: [{ id: 'damage', label: '治疗 1 点伤害' }, { id: 'horror', label: '治疗 1 点恐惧' }],
    }, 'damage')
    : damage ? 'damage' : 'horror'
  if (choice === 'horror') {
    if (safeCall(api, 'healHorror', inv.seat, 1) == null) inv.horror = Math.max(0, horror - 1)
  } else if (safeCall(api, 'healDamage', inv.seat, 1) == null) inv.damage = Math.max(0, damage - 1)
  flags.dawnBoardingHouseHealUsed = true
  info(api, '旅舍：治疗 1 点伤害/恐惧（每场游戏一次）。')
  return true
}

function crossroadsFastMove(state, inv, api = {}) {
  if (investigatorCount(state) > 2) return false
  if (crossroadsMoveUsed(state)) return false
  const here = locationOf(state, inv.location) || LOCATIONS.theCrossroads
  const destinations = (here.connections || []).filter(id => locationOf(state, id))
  if (!destinations.length) return false
  const picked = chooseOption(api, {
    kind: 'move', source: 'dawnSecondCrossroadsMove', seat: inv.seat, prompt: '十字路口：快速移动到连接地点。',
    canSkip: true,
    options: destinations.map(id => ({ id, label: LOCATIONS[id]?.name || id })),
  }, destinations[0])
  const destination = destinations.includes(picked) ? picked : destinations[0]
  if (!moveInvestigator(state, inv.seat, destination, api)) return false
  flagsFor(state).dawnCrossroadsMoveRound = Number(state?.round ?? 0)
  info(api, `十字路口：快速移动到「${LOCATIONS[destination]?.name || destination}」（本轮团队限一次）。`)
  return true
}

function chapelSpellSearch(state, inv, api = {}) {
  if (chapelSearchUsedKey(state)) return false
  const found = searchDeckToHand(state, inv.seat, { type: 'asset', trait: 'Spell' }, api)
  flagsFor(state).dawnChapelSpellSearchUsed = true
  info(api, found.length ? `毒堇教堂：找到「${ALL_CARDS[found[0]]?.name || found[0]}」。` : '毒堇教堂：牌库里没有 Spell 支援。')
  return true
}

function schoolhouseTomeSearch(state, inv, api = {}) {
  if (schoolSearchUsedKey(state)) return false
  const found = searchDeckToHand(state, inv.seat, { type: 'asset', trait: 'Tome' }, api)
  flagsFor(state).dawnSchoolhouseTomeSearchUsed = true
  info(api, found.length ? `山谷学校：找到「${ALL_CARDS[found[0]]?.name || found[0]}」。` : '山谷学校：牌库里没有 Tome 支援。')
  return true
}

/** The Old Mill「发现线索后：法典 12」反应（内容层自动结算，见近似披露）。 */
export function cluesGained(state, inv, amount, api = {}) {
  if (!(Number(amount) > 0) || !inv) return false
  if (inv.location !== 'theOldMill') return false
  if (!codexAvailable(state, 'theOldMill')) return false
  return codex(state, 'theOldMill', { ...api, seat: inv.seat })
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  info(api, '幕 1 背面：阅读法典 17（The Curse）。')
  return codex(state, 'theCurse', api, { seat: currentSeat(state) })
}

/** 幕目标没有印刷数值：读到 3 条法典即视为「与当地人交谈已足」并推进幕（近似）。 */
export function checkObjectives(state, api = {}) {
  const act = state?.acts?.[state.actIndex ?? 0]
  if (!act || codeOf(act) !== ACT_CODE || act.face === 'back') return false
  const read = codexReadCount(state)
  if (read < ACT_CODEX_THRESHOLD) return false
  const flags = flagsFor(state)
  if (flags.dawnSecondActAdvanced === true) return false
  flags.dawnSecondActAdvanced = true
  info(api, `读书法典 ${read} 条（≥ ${ACT_CODEX_THRESHOLD}）：推进幕 1（翻面 → 法典 17）。`)
  if (typeof api?.advanceAct === 'function') {
    api.advanceAct()
    return true
  }
  // 无引擎回退：直接结算背面并把幕标记为背面（测试用）。
  actReveal(state, act, api)
  act.face = 'back'
  return true
}

export function resolutionChainForKey(key) {
  if (key === 'resolution1') return ['resolution1', 'resolution3']
  if (key === 'resolution2') return ['resolution2', 'resolution3']
  if (key === 'resolution3') return ['resolution3']
  return []
}

function resolutionStoryFor(key) {
  const entry = SCENARIO_TEXT.resolutions[key]
  return { title: entry?.title || key, body: entry?.body || '' }
}

/** 议程 1 正面强制「抽到弱点时取消其显现并弃掉」。共享条目 10683.js 已用 cardWouldBeDrawn
 *  近似接线（引擎只能把该牌洗回牌库）；这里保留内容层读点与「取消并弃掉」结算器，供 P8 精确接线。 */
export const agendaCancelsWeakness = state => currentAgendaCode(state) === AGENDA_CODE
  && state?.agendas?.[state.agendaIndex ?? 0]?.face !== 'back'
export function cancelWeaknessDraw(state, inv, card, api = {}) {
  if (!inv || !card || !agendaCancelsWeakness(state)) return false
  const code = typeof card === 'string' ? card : codeOf(card)
  if (!code) return false
  let removed = false
  for (const zone of ['hand', 'threat']) {
    const before = (inv[zone] || []).length
    inv[zone] = (inv[zone] || []).filter(item => (typeof item === 'string' ? item : codeOf(item)) !== code)
    if ((inv[zone] || []).length !== before) removed = true
  }
  if (!removed) return false
  ;(inv.discard ||= []).push(code)
  info(api, `议程「Dark Clouds」：取消弱点「${code}」的显现并弃掉它。`)
  return true
}

/** 议程 1 背面：Bertie 在战役日志里被救援 → 结局 1，否则结局 2；两者都进入结局 3。 */
export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  const records = recordsFor(state)
  const rescued = records[RECORD_KEYS.bertieWasRescued] === true
  const key = rescued ? 'resolution1' : 'resolution2'
  records[RECORD_KEYS.resolvedTo] = key
  records[RECORD_KEYS.resolution] = 'resolution3'
  const story = resolutionStoryFor(key)
  if (typeof api?.present === 'function') {
    api.present(story.body, { kind: 'story', title: story.title, code: AGENDA_CODE, name: story.title, text: story.body })
  } else {
    info(api, `${story.title}：${story.body}`)
  }
  info(api, `议程背面：Bertie ${rescued ? '已获救' : '未被救'} → 结局 ${rescued ? 1 : 2}，随后进入结局 3。`)
  if (typeof api?.finish === 'function') {
    api.finish('resolution3')
    return true
  }
  state.resolution = 'resolution3'
  return true
}

export function surveyedAreas(state) {
  const records = recordsFor(state)
  const result = new Set()
  const aliasToScenario = {
    northPointMine: 'writtenInRock', writtenInRock: 'writtenInRock',
    hemlockHarbor: 'hemlockHouse', hemlockHouse: 'hemlockHouse',
    pearlRidge: 'theSilentHeath', theSilentHeath: 'theSilentHeath',
    akwanShoreline: 'theLostSister', theLostSister: 'theLostSister',
    eastwickBog: 'theThingInTheDepths', theThingInTheDepths: 'theThingInTheDepths',
    westernWoods: 'theTwistedHollow', theTwistedHollow: 'theTwistedHollow',
    southernFields: 'theLongestNight', theLongestNight: 'theLongestNight',
  }
  const raw = records[RECORD_KEYS.areasSurveyed]
  if (Array.isArray(raw)) {
    for (const value of raw) if (aliasToScenario[value]) result.add(aliasToScenario[value])
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      if (value === true && aliasToScenario[key]) result.add(aliasToScenario[key])
    }
  }
  // 各章自己的平铺勾选键（theLongestNight / theTwistedHollow）。
  if (records.areasSurveyedSouthernFields === true) result.add('theLongestNight')
  if (records.areasSurveyedWesternWoods === true) result.add('theTwistedHollow')
  for (const key of Object.values(aliasToScenario)) if (records[`${key}Surveyed`] === true) result.add(key)
  return result
}

/** 结局 3：「Check the Areas Surveyed … choose a scenario that has not yet been checked off」。 */
export function surveyDestinations(state) {
  const surveyed = surveyedAreas(state)
  const left = SURVEY_DESTINATIONS.filter(id => !surveyed.has(id))
  return left.length ? left : [...SURVEY_DESTINATIONS]
}

/** 结局 3 的整备清单（引擎 prepareSurvey 实现的规则；文本用于指南/测试）。 */
export const PREPARATION_FOR_NEXT_SURVEY = Object.freeze([
  '保留 1 张不在开局入场的支援，弃掉其余支援与附属',
  '弃牌至起始手牌数量；把弃牌堆洗回牌库（当前手牌就是下一关的起始手牌，不再发新起手、不做重抽）',
  '资源弃至起始资源数',
  '所有线索保留',
  '下次开局跳过规则书第 27 页 Setting Up the Game 的步骤 1–8',
])

function applySurveyDestinations(state, destinations) {
  const survey = state?.scenario?.mechanics?.survey
  if (!survey) return
  survey.destinations = [...destinations]
}

export function resolution(state, key, events = [], api = {}) {
  void events
  const records = recordsFor(state)
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : null
  if (!finalKey) throw new RangeError(`未知结局：${key}`)
  const infoApi = api?.info ? api : api?.api || {}
  if (finalKey === 'resolution1' || finalKey === 'resolution2') {
    // 链式结局：R1/R2 只记录并继续到 R3（印刷：Skip/Proceed to Resolution 3）。
    const story = resolutionStoryFor(finalKey)
    info(infoApi, `${story.title}：${story.body}`)
    records[RECORD_KEYS.resolvedTo] = finalKey
    return { bonus: 0, award: false }
  }
  // 结局 3：不记录胜利区每张卡的 Victory X。
  state.victory = 0
  records[RECORD_KEYS.resolution] = 'resolution3'
  records[RECORD_KEYS.resolvedTo] ||= records[RECORD_KEYS.bertieWasRescued] === true ? 'resolution1' : 'resolution2'
  const destinations = surveyDestinations(state)
  applySurveyDestinations(state, destinations)
  const story = resolutionStoryFor('resolution3')
  info(infoApi, `${story.title}：${story.body}`)
  for (const line of PREPARATION_FOR_NEXT_SURVEY) info(infoApi, `整备：${line}`)
  info(infoApi, `下一次勘察候选：${destinations.map(id => SURVEY_LABELS[id] || id).join('、')}。`)
  // 奖励经验只来自本序曲的法典/奖励（inv.scenarioXpBonus）；胜利点为 0。
  return { bonus: 0, award: true, surveyDestinations: destinations }
}

// ---------------------------------------------------------------------------
// 混乱标记（10704）
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, api = {}) {
  const parley = isParleyAttempt(state, api)
  const outcome = dawnChaosTokenOutcome(state, inv, token, { parley, handSize: (inv?.hand || []).length })
  // 谈判在简单/普通下的「自动成功」：引擎 resolveChaosToken 契约没有 autoSuccess 字段，
  // 因此优先 api.setTestAutoSuccess（存在时），否则写引擎既有读点
  // `state.skillTest.autoSuccess`（tests.js 在成功判定前读取；与 api-test.js#setTestAutoSuccess 同一字段）。
  if (outcome && state?.skillTest && outcome.onDraw.some(fx => fx.autoSuccess === true)) {
    if (typeof api?.setTestAutoSuccess === 'function') api.setTestAutoSuccess()
    else state.skillTest.autoSuccess = true
  }
  return outcome
}

export function chaosTokenValue(state, inv, token) {
  return dawnChaosTokenOutcome(state, inv, token, { parley: isParleyAttempt(state) })?.delta ?? 0
}

export function applyTokenEffect(state, inv, context = {}, api = {}) {
  const face = String(context?.token || '').toLowerCase()
  if (face === 'cultist' && context?.autoSuccess === true) {
    // 与 resolveChaosToken 同一读点：优先引擎 api，否则写 tests.js 读取的既有字段。
    if (typeof api?.setTestAutoSuccess === 'function') api.setTestAutoSuccess()
    else if (state?.skillTest) state.skillTest.autoSuccess = true
    else return false
    info(api, '[cultist]：谈判尝试自动成功。')
    return true
  }
  return false
}

export function testAutoFail() {
  return null
}

export function investigatorCanBeDefeated() {
  return false
}

// ---------------------------------------------------------------------------
// 法典事件（供共享居民条目/主进程接线）
// ---------------------------------------------------------------------------
const camelOfId = value => value.charAt(0).toUpperCase() + value.slice(1)
const CODE_BY_RESIDENT = Object.freeze(Object.fromEntries(RESIDENT_KEYS.map(id => [RESIDENT_CODES[id], id])))
// 共享组居民条目（_shared/residents/10693–10700）探测的事件约定（见 10693.js#readCodex）：
//   · `dawnOfTheSecondDayResidentParley` { code, resident, id, seat }
//   · `dawnOfTheSecondDayCodex`           { entry, entryId, key, number, id, seat }
//   · `dawnOfTheSecondDayCodex<Resident>` { seat }（短名与章名相同，兜底同名）
// 另外保留早期的 `dawnSecondCodex<Resident>` 别名（测试/主进程验收用）。
const eventName = id => `dawnSecondCodex${camelOfId(id)}`
export const codexEventIds = Object.freeze(Object.fromEntries([
  ...CODEX_IDS.map(id => [`${CHAPTER_ID}Codex${camelOfId(id)}`, id]),
  ...CODEX_IDS.map(id => [eventName(id), id]),
]))
function codexIdFromPayload(payload = {}) {
  const candidates = [payload.entryId, payload.entry, payload.key,
    payload.resident, payload.code != null ? CODE_BY_RESIDENT[String(payload.code)] : null]
  return candidates.find(value => typeof value === 'string' && CODEX_IDS.includes(value)) || null
}
export function resolveCodexEvent(state, eventId, payload = {}, api = {}) {
  const id = codexEventIds[eventId]
    || (eventId === `${CHAPTER_ID}ResidentParley` || eventId === `${CHAPTER_ID}Codex`
      ? codexIdFromPayload(payload) : null)
  if (!id) return false
  return codex(state, id, api, { seat: payload?.seat ?? api?.seat })
}
const eventIds = Object.freeze([
  `${CHAPTER_ID}ResidentParley`,
  `${CHAPTER_ID}Codex`,
  ...Object.keys(codexEventIds),
])
export const events = Object.freeze(Object.fromEntries(eventIds.map(eventId => [eventId,
  (state, payload = {}, api = {}) => resolveCodexEvent(state, eventId, payload, api)])))

// ---------------------------------------------------------------------------
// 只读投影 / 声明
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    day: dayOfDawn(state),
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    doom: Number(state?.doom) || 0,
    codexRead: codexReadCount(state),
    relationships: Object.fromEntries(RESIDENT_KEYS.map(id => [id, relationshipLevel(state, id)])),
    notes: Object.fromEntries(RESIDENT_KEYS.map(id => [id, notesOf(state, id)])),
    residentsInPlay: residentsInPlay(state).map(asset => codeOf(asset)),
    timeMarker: codeOf(timeMarkerInPlay(state)) || null,
    remembered: { ...rememberedFor(state) },
    surveyDestinations: surveyDestinations(state),
  }
}

export function implementedEntryFlags() {
  return {}
}

export const scenarioApproximations = Object.freeze([
  '幕的目标没有印刷数值：与共享条目 10684 声明的 chapterRule（talkToTheLocals / codexThreshold 3）一致，按「读到 3 条法典」推进。',
  'Boarding House 的「团队花费任意行动选择额外选项」按「每次 1 行动触发 1 个选项」建模（法典可重复触发）。',
  'Old Mill 的「发现线索后：法典 12」是 [reaction]，内容层自动结算（不弹反应窗口）。',
  '搜索牌库顶 9 张（法典 3/4/7/11/15、Tad\'s、The Commons）用引擎整库检索原语近似。',
  '法典 17 的「否则下次开局把毒堇诅咒加入起始手牌」只检索牌库（不检索弃牌堆）。',
  '「奖励经验记入 Unspent Experience、下一关结束前不得花费」由战役层处理；本章只写 inv.scenarioXpBonus。',
  'The Vale 地图的规则连接只取印刷符号连接（Location Adjacency 在 P1 扫描里仍是 pending 原语；3×3 正交相邻另导出 GRID_ADJACENCY，未并入）。',
  '本序曲没有遭遇牌库：Downpour 不进场，只登记在放一边区。',
  '中文翻译缺失（story-source/base.part2.json 未落地），正文全部回退英文。',
  'Judith Park 在 manifest 里登记为「在场」而不是「放一边」：静态区域投影只保留最终位置（布置时先收集再入场）。',
  '居民笔记写入 base.json 的笔记 id（如 thePlanIsUnderway），显示名由 SCENARIO_TEXT.noteLabels 提供；引擎按同一 id 判定法典分支。',
  '「finished their meal」按组级布尔/座位数组/座位映射三种既有记录形状读取；Haskell 参考实现是按调查员记录。',
  '议程 1 正面的强制「抽到弱点时取消其显现并弃掉」由共享条目 10683.js 的 cardWouldBeDrawn 近似结算（引擎只能把该牌洗回牌库，不是弃掉）；本文件另留 cancelWeaknessDraw 内容读点备用。',
  'Codex 14（Tad\'s）在 mechanics.codex 里登记为 unlimited 才能允许「running an errand」后再次触发；逐座位的一次性用 scenarioFlags.dawnSecondCodexSeats 记账（与共享地点条目 10710a 的 codexPerInvestigatorOnce 一致）。',
  '开场加的 The Hemlock Curse 通过 api.campaignCard 写入战役牌组（下一关起进入牌组）；当前序曲的牌库不插入，法典 17 的「已在牌组」判定同时读战役牌组与当前牌库。',
  '谈判 [cultist] 的「自动成功」没有 resolveChaosToken 契约字段：优先 api.setTestAutoSuccess，否则写引擎既有读点 state.skillTest.autoSuccess（tests.js 成功判定前读取）。',
  '结局 3「不记录 Victory X」写 state.victory = 0（引擎没有清零胜利点的 API；finishScenario 在 resolution 钩子之后读取该字段结算）。',
  '疲劳替换按引擎 replaceCampaignNumeric(2, -1) 语义（随机 2 个数值标记各降 1）；参考实现遇到已达最低值（-8）会重抽，本序曲不再额外重试。',
])

// ---------------------------------------------------------------------------
// behavior 钩子集合
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: true,
  introduction,
  preScenarioSetup,
  setupLocations,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  cluesGained,
  actReveal,
  agendaReveal,
  agendaCancelsWeakness,
  cancelWeaknessDraw,
  checkObjectives,
  resolution,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  testAutoFail,
  investigatorCanBeDefeated,
  events,
  codex,
  tokenMeanings: DAWN_TOKEN_MEANINGS,
  // 具名助手（测试 / 主进程验收 / 居民共享条目接线）
  codexBranchFor, codexAvailable, codexReadCount, isCodexRead, codexSeatRead,
  relationshipLevel, addRelationship, addNote, notesOf, hasNote, noteLabel,
  isCrossedOut, crossOutResident,
  rememberedFor, isRemembered, rememberFact,
  setDawnDay, dayOfDawn, fatigueReplacement, resolveIntroChoices, finishedMealSeats, addCampaignCard,
  residentInPlay, putResidentInPlay, residentsInPlay, timeMarkerInPlay, putTimeMarkerInPlay,
  surveyDestinations, surveyedAreas, resolutionChainForKey,
  scenarioSummary, implementedEntryFlags,
  CODEX_NUMBERS, RECORD_KEYS, PREPARATION_FOR_NEXT_SURVEY, scenarioApproximations,
}

export default behavior
