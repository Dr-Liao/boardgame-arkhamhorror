// 欢迎来到铁杉谷（welcomeToHemlockVale · 提示卡 10704）· 引擎钩子（序曲流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/PreludeWelcomeToHemlockVale.hs +
//       Campaigns/TheFeastOfHemlockVale/{Helpers,TokenHelpers}.hs +
//       Act|Agenda/Cards/TheFeastOfHemlockVale/DayOfRest/*.hs +
//       Location|Story/CardDefs/TheFeastOfHemlockVale/{TheVale,TheFirstDay}.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/base.json#prelude1。
//
// 引擎读点（全部既有钩子，不改引擎）：
//   preScenarioSetup / introduction → 开场「勘察 / 赴宴」二选一与其混乱标记（[tablet] / [elder_thing]）
//   startLocation / setupLocations / locationPlaced / afterDeckSetup → 第 1 日白天、8 处地点（Day 面）入场、
//     时间指示卡 10675「第一日」、议程上放等于调查员人数的毁灭、Residents 整组放一边
//   actions / performAction → 七处地点的法典行动（[codex] 9–16 中的 [action] 条目）、旅舍治愈、
//     教堂/学校检索、十字路口 [fast] 移动（1–2 位调查员时团队每轮一次）
//   afterInvestigate → 老磨坊「发现线索后：法典 12」反应
//   actReveal → 幕 10682 背面「光辉（The Brilliance）」：每位调查员 +1 奖励经验（参考 KonamiCode 分支）
//   agendaReveal / allResigned → 议程 10681 背面「Time to Get to Work!」= 所有调查员撤退（→R1）
//   checkObjectives → 幕没有数值目标（本序曲由议程推进结束）
//   resolveChaosToken / applyTokenEffect → 10704 四档混乱标记（含谈判的自动成功与追加揭示）
//   resolution → 结局 1 与战役记录（关系等级、奖励经验、[autoFail]、下一次勘察候选）
//   events → 共享组条目（居民资产/地点剧情）的「读法典 / 谈判成功后读法典」回派
//
// 共享组（The Vale 16 面 / Residents 20 张）是**数据型**条目（abilities: []，规则在章节层）：
// 本文件按卡号读它们的 flags —— `actionCodex` / `reactionAfterDiscoverClue`（法典触发时机）、
// `searchTopForTrait` / `searchDeckForTrait`（教堂/学校检索参数）、`healDamageOrHorrorOncePerGame`、
// `freeMoveIfOneOrTwoInvestigators`、`parley`（塔德杂货店的谈判行动与居民谈判规格）、
// `codexNumber`。条目未注册时回退 definition 的常量（纯内容层测试路径）。
//
// 状态写入口径：章节行为（不是卡条目）——读 state、经 api.* 结算效果；只有引擎没有对应原语的两处例外，
// 都在注释里逐条披露：
//   1. 谈判在简单/普通下的「自动成功」：引擎的 `resolveChaosToken` 契约没有 autoSuccess 字段，
//      因此走 onDraw → applyTokenEffect → 优先 `api.setTestAutoSuccess`，没有该 api 时写引擎既有读点
//      `state.skillTest.autoSuccess`（tests.js 在成功判定前读取；与 api-test.js#setTestAutoSuccess 同一字段）。
//   2. 日历：`api.mechanics.calendar.set` 存在时优先走它；纯内容层测试没有该 api 时写
//      `scenarioFlags.mechanics.scenarioDate` 与 `campaign.records.hemlockDate`（引擎同一存档形状）。
//
// 近似（已披露）：
//   · 议程 10681 正面「抽到弱点时取消其显现并弃掉」由共享组条目 10681 自己实现（forced 能力挂在引擎的
//     `cardWouldBeDrawn` 窗口，context.cancelled = true），章内 behavior 不重复声明。
//     「for the remainder of the campaign」的标记：开场 [tablet]/[elder_thing] 记入
//     `records.welcomeToHemlockValeChaosToken` 并立刻加入本局混乱袋，跨关重现由战役层按记录补做；
//     Resolution 1 的 [autoFail] 由战役层 `flow.js#chaosBagTransitions` 的 `welcomeResolution`
//     （触发条件 = 本章写下的结局记录）统一加入，章内不重复加。
//   · 结局 1 的「跳过 Setting Up the Game 第 1–8 步」与「为下一次勘察做准备」：整备由引擎
//     survey-preparation.js 在 finishScenario 里按 `scenario.mechanics.survey` 结算，跳过开局步骤由
//     战役层读取同一个整备包裹（`campaign.surveyPreparation`）；本文件只声明 destinations/resolutions。
//   · 法典 14（塔德杂货店）的「每位尚未结算的调查员可再次触发」：引擎 resolvedCodex 是整场一次，
//     因此 14 号声明 `unlimited`，按调查员的一次性用 `scenarioFlags.welcomeCodexSeats` 记账。
//   · 引擎的法典交互面板只按「记录条件 + 一次性」列条目，不知道「你在哪个地点/哪位居民在场」；
//     地点/居民的范围限制由本文件的 codexAvailable / actions / completeResidentParley 执行。
//   · 从手牌免费打出 / 搜索牌库放入场：优先 `api.giveAsset` / `api.putInHand`，没有这些 api 时本地建
//     资产实例（与 theSilentHeath 给水晶残骸建实例同一口径）。
//   · 老磨坊的反应只在「调查成功」这一条线索发现路径上触发；由其它效果在该地点放线索不会触发。
//   · 额外提示卡 10704 的 [cultist] 简单/普通「谈判自动成功」在引擎里没有契约字段，见上面口径 1。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  ACT_CODE, ACT_CODES, AGENDA_CODE, AGENDA_CODES, AGENDA_DOOM_THRESHOLD, AGENDAS, ACTS,
  CODEX_ENTRY_BY_ID, CODEX_ENTRY_BY_NUMBER, GATHER_GROUPS, LOCATION_CODEX_NUMBERS,
  LOCATION_CONNECTIONS, LOCATION_IDS, LOCATIONS, REACTION_CODEX_LOCATIONS, RECORD_KEYS, RECORD_READS,
  RECORD_WRITES, RESIDENTS, RESIDENT_BY_ASSET_CODE, RESIDENT_BY_ID, RESIDENT_CODE_BY_ID, RESIDENT_PARLEY,
  RESOLUTION_KEYS, SCENARIO_TEXT, SET_ASIDE_RESIDENT_CODES, START_LOCATION,
  SURVEY_DESTINATIONS, TIME_MARKER, TIME_MARKER_CODE,
} from './definition.js'
import {
  CALENDAR_RECORD, PRELUDE_DATE, WELCOME_TOKEN_MEANINGS, dayOf, dateOf, investigatorCount, isHardSide,
  isNight, isParleyTest, welcomeChaosToken, welcomeChaosTokenValue,
} from './chaos.js'

const CHAPTER_ID = 'welcomeToHemlockVale'
const SCENARIO_SOURCE = CHAPTER_ID

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const info = (api, text) => api?.info?.(text)
const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
// 共享遭遇组（the_vale / residents）是**数据型**单卡条目（abilities: []，规则在章节层）：
// 本文件按卡号读它们的 flags（actionCodex / searchTopForTrait / parley …），definition 的常量只作
// 条目尚未注册时的兜底（如纯内容层测试）。
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
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
const clearFlag = (state, key) => {
  delete flagsFor(state)[key]
}
const mechanicData = state => {
  const flags = flagsFor(state)
  const data = flags.mechanics ||= { version: 1 }
  data.version ||= 1
  return data
}
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorAt = (state, seat) => (state.investigators || [])[seat] || null
const leadSeat = state => {
  const active = activeInvestigators(state)
  const declared = Number(state?.campaign?.leadSeat)
  if (active.some(inv => inv.seat === declared)) return declared
  return active[0]?.seat ?? declared ?? 0
}
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const locationName = (state, id) => locationOf(state, id)?.name || id || '场外'
const chooseFrom = (api, request) => (typeof api?.choose === 'function' ? api.choose(request) : null)

// ---------------------------------------------------------------------------
// 日 / 时段：写入战役记录与引擎日历原语
// ---------------------------------------------------------------------------
export const PRELUDE_DAY = PRELUDE_DATE.day
export const PRELUDE_PERIOD = PRELUDE_DATE.period

/** 把当前日/时段写回 records.day/time、records.hemlockDate 与日历原语（duringPeriod 读点）。 */
export function syncDayAndTime(state, api = {}, date = PRELUDE_DATE) {
  const day = Number(date?.day) || PRELUDE_DAY
  const period = date?.period === 'night' ? 'night' : 'day'
  const records = recordsFor(state)
  records[RECORD_KEYS.day] = day
  records[RECORD_KEYS.time] = period === 'night' ? 'Night' : 'Day'
  setFlag(state, 'welcomeToHemlockValeDay', day)
  setFlag(state, 'welcomeToHemlockValeNight', period === 'night')
  const calendar = api?.mechanics?.calendar
  const current = typeof calendar?.current === 'function' ? calendar.current() : null
  const already = current && Number(current.day) === day && current.period === period
  if (typeof calendar?.set === 'function') {
    if (!already) calendar.set(day, period)
  } else {
    const data = mechanicData(state)
    if (!data.scenarioDate || Number(data.scenarioDate.day) !== day || data.scenarioDate.period !== period) {
      data.scenarioDate = { day, period }
    }
    records[RECORD_KEYS.calendar] = `${day}:${period}`
  }
  return { day, period }
}

/** 只读：本序曲是否处在白天（共享卡的 (Day)/(Night) 子句与法典行为共用）。 */
export const isDaytime = state => !isNight(state)

// ---------------------------------------------------------------------------
// 时间指示卡（10675 第一日 / 第一夜）
// ---------------------------------------------------------------------------
export function timeMarkerInPlay(state) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === TIME_MARKER_CODE) || null
}

function faceTimeMarker(state, marker) {
  if (!marker) return marker
  const card = ALL_CARDS[TIME_MARKER_CODE] || {}
  // 面/名称读共享组条目 10675 的 flags（facePeriods/frontName/backName），未注册时回退 definition。
  const flags = flagsOf(TIME_MARKER_CODE)
  const period = isNight(state) ? 'night' : 'day'
  const periods = flags.facePeriods || { front: 'day', back: 'night' }
  const face = periods.front === period ? 'front' : 'back'
  marker.face = face
  marker.day = dayOf(state)
  marker.period = period
  marker.name = face === 'front'
    ? (card.nameZh || flags.frontName || TIME_MARKER.nameZh || TIME_MARKER.name)
    : (card.backNameZh || flags.backName || TIME_MARKER.backNameZh || TIME_MARKER.backName)
  marker.artCode = face === 'front' ? TIME_MARKER_CODE : `${TIME_MARKER_CODE}b`
  return marker
}

/** Setup「Put the Day One Time Marker card into play」：剧情卡入场并摆到当前面。 */
export function putTimeMarkerInPlay(state, api = {}) {
  const existing = timeMarkerInPlay(state)
  if (existing) return faceTimeMarker(state, existing)
  let marker = null
  if (typeof api?.storyAsset === 'function') marker = api.storyAsset(TIME_MARKER_CODE, null)
  if (!marker) {
    const card = ALL_CARDS[TIME_MARKER_CODE] || {}
    marker = {
      id: `welcome-timeMarker-${TIME_MARKER_CODE}`, code: TIME_MARKER_CODE, originalCode: TIME_MARKER_CODE,
      name: card.nameZh || card.name || TIME_MARKER.name, global: true, location: null,
      controllerSeat: null, exhausted: false, tokens: 0, assets: [], attachments: [],
    }
    ;(state.storyAssets ||= []).push(marker)
  }
  faceTimeMarker(state, marker)
  info(api, `时间指示卡「${marker.name}」进入场上（第 ${marker.day} 日${marker.period === 'night' ? '夜' : '白天'}）。`)
  return marker
}

// ---------------------------------------------------------------------------
// 毁灭：Setup「Place doom on the agenda equal to the number of investigators」
// ---------------------------------------------------------------------------
export function placeDoomOnAgenda(state, amount, api = {}) {
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  if (!n) return 0
  if (typeof api?.addDoom === 'function') api.addDoom(n)
  else state.doom = (Number(state.doom) || 0) + n
  info(api, `在议程上放置 ${n} 点毁灭（当前 ${Number(state.doom) || 0}）。`)
  return n
}

// ---------------------------------------------------------------------------
// 居民：入场 / 放回一边 / 关系等级
// ---------------------------------------------------------------------------
export function residentsInPlay(state) {
  return (state.storyAssets || []).filter(asset => Boolean(RESIDENT_BY_ASSET_CODE[codeOf(asset)]))
}
export function residentInPlay(state, residentId) {
  const code = RESIDENT_CODE_BY_ID[residentId]
  if (!code) return null
  return (state.storyAssets || []).find(asset => codeOf(asset) === code) || null
}
/** 把放一边的居民放入场（地点法典 9–16 与其它序曲共用）。 */
export function putResidentInPlay(state, residentId, api = {}, { location = null } = {}) {
  const resident = RESIDENT_BY_ID[residentId]
  if (!resident) return null
  const existing = residentInPlay(state, residentId)
  if (existing) {
    if (location && existing.location !== location) existing.location = location
    return existing
  }
  let asset = null
  if (typeof api?.storyAsset === 'function') asset = api.storyAsset(resident.assetCode, location)
  if (!asset) {
    const card = ALL_CARDS[resident.assetCode] || {}
    asset = {
      id: `${SCENARIO_SOURCE}-${resident.assetCode}`, code: resident.assetCode, originalCode: resident.assetCode,
      name: card.nameZh || card.name || resident.name, subname: card.subnameZh || card.subname || '',
      controllerSeat: null, exhausted: false, tokens: 0, location,
      assets: [], attachments: [],
    }
    ;(state.storyAssets ||= []).push(asset)
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = (state.scenarioZones.setAside || [])
    .filter(code => code !== resident.assetCode)
  info(api, `居民「${asset.name}」在「${locationName(state, location)}」入场。`)
  return asset
}
/** 把居民资产放回一边（out of play）：从场上移除并回到 Residents 组。 */
export function removeResidentFromPlay(state, residentId, api = {}) {
  const resident = RESIDENT_BY_ID[residentId]
  if (!resident) return false
  const asset = residentInPlay(state, residentId)
  if (!asset) return false
  state.storyAssets = (state.storyAssets || []).filter(item => item !== asset)
  state.scenarioZones ||= {}
  const setAside = new Set(state.scenarioZones.setAside || [])
  setAside.add(resident.assetCode)
  state.scenarioZones.setAside = [...setAside]
  info(api, `居民「${asset.name || resident.name}」回到一边。`)
  return true
}

export const residentRecord = residentId => RESIDENT_BY_ID[residentId]?.record || null
export function residentLevel(state, residentId) {
  const spec = residentRecord(residentId)
  if (!spec) return 0
  return Math.max(0, Number(recordsFor(state)[spec.level]) || 0)
}
/** 「Increase <resident>’s Relationship Level」：引擎 resident-record.js 的唯一写入口。 */
export function addResidentRelationship(state, residentId, amount = 1, api = {}) {
  const spec = residentRecord(residentId)
  const resident = RESIDENT_BY_ID[residentId]
  if (!spec || !resident) return 0
  const records = recordsFor(state)
  if (records[spec.crossedOut] === true) {
    info(api, `${resident.name} 已被划掉，关系等级不能提升。`)
    return residentLevel(state, residentId)
  }
  if (typeof api?.mechanics?.residents?.change === 'function') {
    const next = api.mechanics.residents.change(spec, amount)
    if (next !== false && next != null) {
      info(api, `与${resident.name}的关系等级 → ${next}。`)
      return Number(next) || 0
    }
  }
  const next = Math.max(0, Math.min(spec.max, (Number(records[spec.level]) || 0) + amount))
  records[spec.level] = next
  info(api, `与${resident.name}的关系等级 → ${next}。`)
  return next
}

// ---------------------------------------------------------------------------
// 法典 1–16：一次性记录（引擎 resolvedCodex）与逐调查员记录
// ---------------------------------------------------------------------------
const codexSeatsFor = state => (flagsFor(state).welcomeCodexSeats ||= {})

/** 接受法典编号（1–16）、条目 id 或条目对象。 */
export function codexEntryOf(entry) {
  if (!entry) return null
  if (typeof entry === 'object') return entry.number ? (CODEX_ENTRY_BY_NUMBER[entry.number] || null) : (CODEX_ENTRY_BY_ID[entry.id] || null)
  const number = Number(entry)
  if (Number.isInteger(number) && CODEX_ENTRY_BY_NUMBER[number]) return CODEX_ENTRY_BY_NUMBER[number]
  return CODEX_ENTRY_BY_ID[String(entry)] || null
}
export const codexNumberForLocation = locationId => {
  const flags = flagsOf(LOCATIONS[locationId]?.code)
  const reaction = Number(flags.reactionAfterDiscoverClue?.codexNumber) || null
  const action = Number(flags.actionCodex) || null
  return reaction || action || LOCATION_CODEX_NUMBERS[locationId] || null
}
/** 只给「[action] 询问」的地点法典编号（老磨坊是「发现线索后」反应，不给行动）。 */
export const actionCodexNumberForLocation = locationId => {
  const flags = flagsOf(LOCATIONS[locationId]?.code)
  if (flags.reactionAfterDiscoverClue || REACTION_CODEX_LOCATIONS.includes(locationId)) return null
  return Number(flags.actionCodex) || LOCATION_CODEX_NUMBERS[locationId] || null
}
/** 只给「发现线索后」反应的地点法典编号。 */
export const reactionCodexNumberForLocation = locationId => {
  const flags = flagsOf(LOCATIONS[locationId]?.code)
  const fromEntry = Number(flags.reactionAfterDiscoverClue?.codexNumber) || null
  if (fromEntry) return fromEntry
  return locationId === 'theOldMill' ? (LOCATION_CODEX_NUMBERS[locationId] || null) : null
}
export const codexNumberForResident = residentId => {
  const def = RESIDENT_BY_ID[residentId]
  const flags = flagsOf(def?.assetCode)
  return Number(flags.codexNumber) || def?.codexNumber || null
}
export function codexEntryForLocation(locationId) {
  return codexEntryOf(codexNumberForLocation(locationId))
}
export function codexEntryForResident(residentId) {
  return codexEntryOf(codexNumberForResident(residentId))
}

export function resolvedCodexKeys(state) {
  return [...(mechanicData(state).resolvedCodex || [])]
}
const codexLimitKey = entry => (entry.limit === 'unlimited' ? null : entry.id)
export function codexResolved(state, entryIdOrNumber) {
  const entry = codexEntryOf(entryIdOrNumber)
  if (!entry) return false
  const key = codexLimitKey(entry)
  return key ? resolvedCodexKeys(state).includes(key) : false
}
export function codexResolvedBy(state, entryIdOrNumber, seat) {
  const entry = codexEntryOf(entryIdOrNumber)
  if (!entry) return false
  const seats = codexSeatsFor(state)[entry.id] || []
  return seats.includes(Number(seat))
}
const markCodexSeat = (state, entry, seat) => {
  if (!entry.perInvestigatorOnce || !Number.isSafeInteger(Number(seat))) return
  const ledger = codexSeatsFor(state)
  const seats = new Set(ledger[entry.id] || [])
  seats.add(Number(seat))
  ledger[entry.id] = [...seats].sort((a, b) => a - b)
}
const markCodexResolved = (state, entry) => {
  const key = codexLimitKey(entry)
  if (!key) return false
  const keys = resolvedCodexKeys(state)
  if (!keys.includes(key)) mechanicData(state).resolvedCodex = [...keys, key]
  return true
}

/** 该调查员此刻能否触发某条法典（地点/居民范围 + 一次性 + 逐调查员记录）。 */
export function codexAvailable(state, entryIdOrNumber, seat = null) {
  const entry = codexEntryOf(entryIdOrNumber)
  if (!entry) return false
  const inv = seat == null ? null : investigatorAt(state, seat)
  if (seat != null && (!inv || inv.defeated || inv.resigned)) return false
  if (entry.kind === 'location') {
    if (!inv || inv.location !== entry.location) return false
  } else if (entry.kind === 'resident') {
    const resident = residentInPlay(state, entry.resident)
    if (!resident) return false
    if (inv && resident.location !== inv.location) return false
  }
  if (entry.perInvestigatorOnce && seat != null && codexResolvedBy(state, entry, seat)) return false
  if (!entry.perInvestigatorOnce && codexResolved(state, entry)) return false
  return true
}

/** 地点自身可触发的法典（actions 用；不含居民）。 */
export function codexEntryAvailableAt(state, locationId, seat = null) {
  const entry = codexEntryForLocation(locationId)
  if (!entry) return null
  return codexAvailable(state, entry, seat) ? entry : null
}

/** 当前位置上可读的全部法典（地点 + 在场居民）：返回条目数组。 */
export function codexEntriesAt(state, seat) {
  const inv = investigatorAt(state, seat)
  if (!inv?.location) return []
  const entries = []
  const locationEntry = codexEntryForLocation(inv.location)
  if (locationEntry && codexAvailable(state, locationEntry, seat)) entries.push(locationEntry)
  for (const asset of residentsInPlay(state)) {
    if (asset.location !== inv.location) continue
    const resident = RESIDENT_BY_ASSET_CODE[codeOf(asset)]
    if (!resident) continue
    const entry = codexEntryForResident(resident.id)
    if (entry && codexAvailable(state, entry, seat)) entries.push(entry)
  }
  return entries
}

// ---------------------------------------------------------------------------
// 法典结算（内容层效果）
// ---------------------------------------------------------------------------
const matchesTraits = (code, traits) => {
  const card = ALL_CARDS[code]
  if (!card || !Array.isArray(traits) || !traits.length) return false
  const own = (card.traits || []).map(value => String(value).toLowerCase())
  return traits.some(trait => own.includes(String(trait).toLowerCase()))
}

function gainResourcesFor(state, inv, amount, api = {}) {
  const n = Math.max(0, Number(amount) || 0)
  if (!n) return 0
  if (typeof api?.gainResources === 'function') return api.gainResources(inv.seat, n) ?? n
  inv.resources = (Number(inv.resources) || 0) + n
  return n
}
function drawCardsFor(state, inv, amount, api = {}) {
  const n = Math.max(0, Number(amount) || 0)
  if (!n) return 0
  if (typeof api?.drawCards === 'function') {
    api.drawCards(inv.seat, n)
    return n
  }
  let drawn = 0
  for (let i = 0; i < n; i += 1) {
    if (!inv.deck?.length) break
    ;(inv.hand ||= []).push(inv.deck.pop())
    drawn += 1
  }
  return drawn
}
function putAssetIntoPlay(state, inv, code, api = {}) {
  if (typeof api?.giveAsset === 'function') {
    const asset = api.giveAsset(inv.seat, code)
    if (asset) return asset
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `${SCENARIO_SOURCE}-play-${code}-${(inv.assets || []).length + 1}`,
    code, originalCode: code, name: card.nameZh || card.name || code,
    controllerSeat: inv.seat, ownerSeat: inv.seat, exhausted: false,
    damage: 0, horror: 0, tokens: 0, attachments: [], assets: [], traits: [...(card.traits || [])],
  }
  ;(inv.assets ||= []).push(asset)
  return asset
}
function pickCard(state, inv, codes, prompt, api = {}) {
  if (!codes.length) return null
  if (codes.length === 1 || typeof api?.choose !== 'function') return codes[0]
  const answer = api.choose({
    kind: 'search', source: SCENARIO_SOURCE, seat: inv.seat, prompt,
    options: codes.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })),
  })
  const index = Number(answer)
  return Number.isInteger(index) && codes[index] ? codes[index] : codes[0]
}
function playFromHandTrait(state, inv, traits, api = {}) {
  const hand = inv.hand || []
  const matches = hand.filter(code => matchesTraits(code, traits))
  if (!matches.length) {
    info(api, `手里没有符合「${traits.join('/')}」的卡牌：本次法典没有可打出的支援。`)
    return null
  }
  const code = pickCard(state, inv, matches, `选择要打出的一张 ${traits.join('/')} 卡牌（忽略费用）`, api)
  const at = hand.indexOf(code)
  if (at >= 0) hand.splice(at, 1)
  putAssetIntoPlay(state, inv, code, api)
  info(api, `${inv.name} 免费打出「${cardName(code)}」。`)
  return code
}
function searchDeckToHand(state, inv, { traits, from = 'top9' }, api = {}) {
  const deck = inv.deck || []
  const pool = from === 'top9' ? deck.slice(-9) : [...deck]
  const matches = pool.filter(code => matchesTraits(code, traits))
  if (!matches.length) {
    info(api, `牌库${from === 'top9' ? '顶 9 张' : ''}里没有符合「${traits.join('/')}」的卡牌。`)
    return null
  }
  const code = pickCard(state, inv, matches, `选择一张 ${traits.join('/')} 卡牌加入手牌`, api)
  const at = deck.lastIndexOf(code)
  if (at >= 0) deck.splice(at, 1)
  if (typeof api?.putInHand === 'function') api.putInHand(inv.seat, code)
  else (inv.hand ||= []).push(code)
  info(api, `${inv.name} 找到「${cardName(code)}」并加入手牌。`)
  return code
}
function searchDeckAndPlay(state, inv, { traits }, api = {}) {
  const deck = inv.deck || []
  const matches = deck.filter(code => matchesTraits(code, traits))
  if (!matches.length) {
    info(api, `牌库里没有符合「${traits.join('/')}」的卡牌。`)
    return null
  }
  const code = pickCard(state, inv, matches, `选择一张 ${traits.join('/')} 卡牌并免费打出`, api)
  const at = deck.lastIndexOf(code)
  if (at >= 0) deck.splice(at, 1)
  putAssetIntoPlay(state, inv, code, api)
  info(api, `${inv.name} 找到「${cardName(code)}」并免费打出。`)
  return code
}
function moveToAnyLocation(state, inv, api = {}) {
  const destinations = (state.locations || []).map(location => location.id)
  if (!destinations.length) return null
  let destination = destinations.find(id => id !== inv.location) || destinations[0]
  if (typeof api?.choose === 'function' && destinations.length > 1) {
    const answer = api.choose({
      kind: 'move', source: SCENARIO_SOURCE, seat: inv.seat, prompt: '选择要立即移动到的地点。',
      options: destinations.map(id => ({ id, label: locationName(state, id) })),
    })
    if (destinations.includes(answer)) destination = answer
  }
  if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, destination)
  else inv.location = destination
  info(api, `${inv.name} 立即移动到「${locationName(state, destination)}」。`)
  return destination
}
function drawOrResourceChoice(state, inv, entry, api = {}) {
  const answer = chooseFrom(api, {
    kind: 'story', source: `welcometCodex${entry.number}`, seat: inv.seat,
    prompt: '你可以抽 1 张牌，或获得 1 点资源。',
    options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'resource', label: '获得 1 点资源' }],
  })
  if (answer === 'resource') {
    gainResourcesFor(state, inv, 1, api)
    return 'resource'
  }
  drawCardsFor(state, inv, 1, api)
  return 'draw'
}
function spendSearchPlay(state, inv, effect, api = {}) {
  if ((Number(inv.resources) || 0) <= 0) {
    info(api, '资源不足：无法支付塔德杂货店的法典费用。')
    return null
  }
  const answer = chooseFrom(api, {
    kind: 'story', source: 'welcometCodex14', seat: inv.seat,
    prompt: SCENARIO_TEXT.codexLabels.tadsGeneralStoreItem || '花费 1 点资源：搜索牌库找一张物品卡并免费打出。',
    options: [{ id: 'spend', label: '花费 1 点资源' }, { id: 'skip', label: '跳过' }],
  })
  if (answer === 'skip') {
    info(api, '跳过塔德杂货店的物品检索。')
    return null
  }
  if (typeof api?.loseResources === 'function') api.loseResources(inv.seat, effect.amount || 1)
  else inv.resources = Math.max(0, (Number(inv.resources) || 0) - (effect.amount || 1))
  return searchDeckAndPlay(state, inv, effect, api)
}

function applyCodexEffect(state, inv, entry, api = {}) {
  const effect = entry.effect
  const receipt = {}
  if (!effect) return receipt
  if (effect.kind === 'drawOrResource') {
    receipt.choice = drawOrResourceChoice(state, inv, entry, api)
  } else if (effect.kind === 'gainResources') {
    receipt.resources = gainResourcesFor(state, inv, effect.amount, api)
  } else if (effect.kind === 'drawCards') {
    receipt.cards = drawCardsFor(state, inv, effect.amount, api)
  } else if (effect.kind === 'playFromHand') {
    receipt.played = playFromHandTrait(state, inv, effect.traits, api)
  } else if (effect.kind === 'searchToHand') {
    receipt.found = searchDeckToHand(state, inv, effect, api)
  } else if (effect.kind === 'moveAnyLocation') {
    receipt.movedTo = moveToAnyLocation(state, inv, api)
  } else if (effect.kind === 'spendSearchPlay') {
    receipt.played = spendSearchPlay(state, inv, effect, api)
  }
  return receipt
}

/**
 * 结算一条法典（内容层）。`entry` 可传编号 1–16 / 条目 id / 条目对象。
 * 返回回执 `{ entry, number, seat, branch, relationship, resident, ...effectReceipt }`；不能结算返回 false。
 * 引擎可用时走 `api.mechanics.codex.resolve`（唯一写入口，一次性键与引擎一致）；否则写同一存档形状
 * `scenarioFlags.mechanics.resolvedCodex`。
 */
export function resolveCodexEntry(state, entryIdOrNumber, seat = null, api = {}, { force = false } = {}) {
  const entry = codexEntryOf(entryIdOrNumber)
  if (!entry) return false
  const actor = seat == null ? leadSeat(state) : Number(seat)
  const inv = investigatorAt(state, actor)
  if (!inv || inv.defeated || inv.resigned) return false
  if (!force && !codexAvailable(state, entry, actor)) return false
  const receipt = {
    entry: entry.id, number: entry.number, kind: entry.kind, seat: actor, branch: 'printed',
    relationship: null, resident: null,
  }
  const apply = () => {
    if (entry.relationship) {
      receipt.relationship = addResidentRelationship(state, entry.relationship, 1, api)
    }
    if (entry.putsResident) {
      const asset = putResidentInPlay(state, entry.putsResident, api,
        { location: entry.location || inv.location })
      receipt.resident = asset ? entry.putsResident : null
      if (asset) receipt.residentLocation = asset.location
    }
    Object.assign(receipt, applyCodexEffect(state, inv, entry, api))
    markCodexSeat(state, entry, actor)
  }
  const engineCodex = api?.mechanics?.codex
  if (typeof engineCodex?.resolve === 'function') {
    const resolved = engineCodex.resolve(entry.id, actor, context => {
      receipt.branch = context?.branch || 'printed'
      apply()
    })
    if (!resolved) {
      // 引擎判定为不可读（记录条件/一次性）：内容层不绕过，交回调用方。
      return false
    }
  } else {
    markCodexResolved(state, entry)
    apply()
  }
  const title = SCENARIO_TEXT.codex?.[entry.id]?.title || entry.id
  info(api, `法典 ${entry.number}「${title}」结算完成。`)
  return receipt
}

/** 把「居民 id / 资产卡号 / 场上资产实例」统一解析成居民定义。 */
export function residentOf(value) {
  if (!value) return null
  if (typeof value === 'string') return RESIDENT_BY_ASSET_CODE[value] || RESIDENT_BY_ID[value] || null
  return RESIDENT_BY_ASSET_CODE[codeOf(value)] || RESIDENT_BY_ID[String(value.id || '')] || null
}

/** 居民谈判成功后读法典：共享组条目通过 `api.resolveScenarioEvent('welcomeToHemlockValeResidentParley')` 回派。 */
export function completeResidentParley(state, residentOrCode, seat = null, api = {}) {
  const resident = residentOf(residentOrCode)
  if (!resident) return false
  const entry = codexEntryForResident(resident.id)
  if (!entry) return false
  return resolveCodexEntry(state, entry, seat, api)
}

/** 居民资产面的谈判规格（技能/难度/额外费用）：优先读共享组条目 10693–10700 的 flags.parley。 */
export function residentParleySpec(residentOrCode, state = null) {
  const resident = residentOf(residentOrCode)
  if (!resident) return null
  const flags = flagsOf(resident.assetCode)
  const spec = flags.parley || RESIDENT_PARLEY[resident.id]
  if (!spec) return null
  const day = state ? dayOf(state) : null
  const skills = Array.isArray(spec.skills) ? spec.skills.map(String) : []
  return {
    resident: resident.id, assetCode: resident.assetCode,
    codexNumber: Number(flags.codexNumber) || resident.codexNumber,
    skills, difficulty: Number(spec.difficulty) || 0, actions: Number(spec.actions) || 1,
    ...(spec.spendResources ? { spendResources: spec.spendResources, amount: day } : {}),
    ...(spec.discardCards ? { discardCards: spec.discardCards, amount: day } : {}),
  }
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function locationInstance(state, id, api = {}) {
  const base = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!base) return null
  const def = clone(base)
  const count = investigatorCount(state)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? Number(def.cluesPerInvestigator) * count
    : Number(def.clues) || 0)
  return {
    ...def, id, revealed: true, clues, maxClues: clues,
    connections: [...new Set([...(def.connections || []), ...(LOCATION_CONNECTIONS[id] || [])])],
    damage: 0, horror: 0, doom: 0, resources: 0, attachments: [],
  }
}

/** 直调/单测入口：日期、幕/议程牌库、放一边、无遭遇牌库。 */
export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const date = syncDayAndTime(state, api, PRELUDE_DATE)
  const actSource = state.scenario?.acts?.length ? state.scenario.acts : ACTS
  state.acts = actSource.map(act => clone(act))
  state.actIndex = 0
  const agendaSource = state.scenario?.agendas?.length ? state.scenario.agendas : AGENDAS
  state.agendas = agendaSource.map(agenda => clone(agenda))
  state.agendaIndex = 0
  state.scenarioZones.setAside = [...SET_ASIDE_RESIDENT_CODES]
  state.scenarioZones.setAsideLocations = []
  // 序曲没有遭遇牌库（scenario.mechanics.noEncounterDeck）——这里也把空牌库写稳。
  // The First Day 里的 10676 虫群 ×3 随组收集但不使用，故不写入任何区域。
  state.encounterDeck = []
  const report = {
    ...date,
    actCodes: [...ACT_CODES],
    agendaCodes: [...AGENDA_CODES],
    setAside: [...SET_ASIDE_RESIDENT_CODES],
    startLocation: START_LOCATION,
  }
  setFlag(state, 'welcomePrepared', true)
  info(api, `欢迎来到铁杉谷：第 ${date.day} 日${date.period === 'night' ? '夜' : '白天'}。`)
  return report
}

/** 引擎真实入口：setup.js#setupLocations。返回按顺序入场的地点 id（十字路口先入场）。 */
export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  return [...LOCATION_IDS]
}

/** 引擎真实入口：placeLocation 之后（Day 面朝上、图标连接）。 */
export function locationPlaced(state, location, api = {}) {
  void api
  if (!location) return
  location.revealed = true
  location.hemlockVale = true
  location.daySide = true
  const def = LOCATIONS[location.id]
  if (!def) return
  location.connections = [...new Set([...(location.connections || []), ...(def.connections || [])])]
  location.symbols = clone(def.symbols)
  location.symbol = def.symbol
  if (location.codexNumber == null) location.codexNumber = def.codexNumber
  if (location.residentCode == null) location.residentCode = def.residentCode
}

/** 引擎真实入口：setup.js#setupScenarioDecks 之后（时间指示卡、毁灭、居民放一边）。 */
export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_RESIDENT_CODES]
  putTimeMarkerInPlay(state, api)
  placeDoomOnAgenda(state, investigatorCount(state), api)
  setFlag(state, 'welcomeDeckPrepared', true)
  info(api, `${SET_ASIDE_RESIDENT_CODES.length} 张居民卡放在一边；序曲期间没有遭遇牌库。`)
  return {
    timeMarker: TIME_MARKER_CODE,
    doom: Number(state.doom) || 0,
    setAside: [...SET_ASIDE_RESIDENT_CODES],
  }
}

/** 直调/单测入口：准备 + 8 处地点入场 + 时间指示卡 + 毁灭。 */
export function setupScenario(state, api = {}) {
  delete flagsFor(state).welcomePrepared
  delete flagsFor(state).welcomeDeckPrepared
  state.locations = []
  const report = prepareScenario(state, api)
  const placed = []
  for (const id of LOCATION_IDS) {
    const location = locationInstance(state, id, api)
    if (!location) continue
    state.locations.push(location)
    locationPlaced(state, location, api)
    placed.push(id)
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  const deckReport = afterDeckSetup(state, null, { api })
  info(api, `序曲布置完成：${placed.length} 处地点入场（起点：${locationName(state, START_LOCATION)}）。`)
  return { ...report, ...deckReport, placedIds: placed, startLocation: START_LOCATION }
}

/** 引擎读点：开始地点固定十字路口。 */
export function startLocation(state) {
  void state
  return START_LOCATION
}

// ---------------------------------------------------------------------------
// 开场（勘察 / 赴宴）
// ---------------------------------------------------------------------------
export function introBranch(state) {
  const value = recordsFor(state)[RECORD_KEYS.intro]
  return value === 'feast' ? 'feast' : value === 'survey' ? 'survey' : null
}
/** 开场二选一对应的混乱标记（参考 PreScenarioSetup 的 DoStep 2 / 3）。 */
export const introChaosToken = branch => (branch === 'feast' ? 'elderthing' : 'tablet')

/** 把开场选择的混乱标记加入本局混乱袋，并记入战役记录（幂等）。 */
export function applyIntroChaosToken(state, branch = introBranch(state) || 'survey', api = {}) {
  const token = introChaosToken(branch)
  const records = recordsFor(state)
  if (records[RECORD_KEYS.chaosToken] === token && flagsFor(state).welcomeIntroTokenApplied) return token
  records[RECORD_KEYS.chaosToken] = token
  if (typeof api?.addChaosToken === 'function') api.addChaosToken(token)
  else if (state.chaosBag) state.chaosBag.push(token)
  setFlag(state, 'welcomeIntroTokenApplied', true)
  info(api, `${branch === 'feast' ? '你们为赴宴而来' : '你们为勘察而来'}：向混乱袋加入 1 枚 [${token}]（战役余下时间）。`)
  return token
}

/** 引擎真实入口：setup.js#preScenarioSetup（开场选择 + 日期）。 */
export function preScenarioSetup(state, events = null, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  const date = syncDayAndTime(state, api, PRELUDE_DATE)
  let branch = introBranch(state)
  if (!branch) {
    const labels = SCENARIO_TEXT.intro.labels
    const answer = chooseFrom(api, {
      kind: 'story', source: 'welcomeToHemlockValeIntro', seat: leadSeat(state),
      prompt: '母亲蕾切尔问你们为什么来铁杉谷。',
      options: [
        { id: 'survey', label: labels.survey || '“We’re here on a survey from Miskatonic University.”' },
        { id: 'feast', label: labels.feast || '“We’re here for the Feast.”' },
      ],
    })
    branch = answer === 'feast' ? 'feast' : 'survey'
    recordsFor(state)[RECORD_KEYS.intro] = branch
  }
  applyIntroChaosToken(state, branch, api)
  setFlag(state, 'welcomeIntroBranch', branch)
  return { branch, ...date }
}

/** 开场正文：前言（Intro 1）→ 所选分支（Intro 2 / 3）→ Intro 4。 */
export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : {
    campaign: { records },
    scenarioFlags: context?.scenarioFlags || {},
  }
  const splitParagraphs = value => String(value || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
  const sections = []
  const lead = splitParagraphs(SCENARIO_TEXT.intro.intro1)
  if (lead.length) sections.push({ title: SCENARIO_TEXT.intro.title, paragraphs: lead })
  const branch = introBranch(state)
  if (!branch) {
    const labels = SCENARIO_TEXT.intro.labels
    sections.push({
      title: '调查员的来意',
      paragraphs: [labels.survey, labels.feast].filter(Boolean),
    })
  } else {
    const body = branch === 'feast' ? SCENARIO_TEXT.intro.intro3 : SCENARIO_TEXT.intro.intro2
    const label = branch === 'feast' ? SCENARIO_TEXT.intro.labels.feast : SCENARIO_TEXT.intro.labels.survey
    sections.push({ title: label || '调查员的来意', paragraphs: splitParagraphs(body) })
  }
  const tail = splitParagraphs(SCENARIO_TEXT.intro.intro4)
  if (tail.length) sections.push({ title: '', paragraphs: tail })
  return {
    version: 3,
    title: sc?.name || '欢迎来到铁杉谷',
    sections,
    paragraphs: sections.flatMap(section => section.paragraphs),
    code: ACT_CODE,
    day: dayOf(state),
    period: isNight(state) ? 'night' : 'day',
  }
}

// ---------------------------------------------------------------------------
// 行动：地点法典、旅舍治愈、教堂/学校检索、十字路口快速移动
// ---------------------------------------------------------------------------
const limitsFor = state => (flagsFor(state).welcomeLimits ||= {})
const limitUsed = (state, key) => limitsFor(state)[key] === true
const markLimit = (state, key) => {
  limitsFor(state)[key] = true
  return true
}

export const ACTIONS = Object.freeze({
  codex: 'welcomeCodex',
  boardingHouseHeal: 'welcomeBoardingHouseHeal',
  chapelSearchSpell: 'welcomeChapelSearchSpell',
  schoolhouseSearchTome: 'welcomeSchoolhouseSearchTome',
  crossroadsMove: 'welcomeCrossroadsMove',
})
// 单次行动（每场游戏一次）与 [fast] 行动的印刷限制由 actions 里的 flag/limit 检查执行。
export const CODEX_ACTION_LABEL = number => `询问当地人（[codex] ${number}）`

/**
 * 地点法典的两种触发时机：
 *   · 7 处地点印刷 `[action]: … ([codex] N)` → 由 actions/performAction 提供动作；
 *   · 老磨坊印刷 `[reaction] After you discover a clue at The Old Mill: ([codex] 12)` → afterInvestigate。
 * 触发时机与编号优先读共享组条目 10705a–10712a 的 flags（actionCodex / reactionAfterDiscoverClue）；
 * 条目未注册时回退 definition 的 LOCATION_CODEX_NUMBERS / REACTION_CODEX_LOCATIONS（纯内容层测试）。
 */
export { REACTION_CODEX_LOCATIONS }

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const flags = flagsOf(here.code)
  const moves = []
  const codexNumber = actionCodexNumberForLocation(here.id)
  if (codexNumber) {
    const entry = CODEX_ENTRY_BY_NUMBER[codexNumber]
    const available = entry ? codexAvailable(state, entry, inv.seat) : false
    moves.push({
      action: 'scenarioAction', rule: ACTIONS.codex, locationId: here.id, codexNumber,
      actions: 1, label: CODEX_ACTION_LABEL(codexNumber),
      // 塔德杂货店印着「Parley」：谈判不引发借机攻击，也让 [cultist]/[elder_thing] 的谈判子句生效。
      ...(flags.parley === true || here.id === 'tadsGeneralStore' ? { actionKind: 'parley' } : {}),
      ...(available ? {} : { reason: '本序曲的这条法典已经结算过（或未满足条件）' }),
    })
  }
  if (here.id === 'boardingHouse') {
    moves.push({
      action: 'scenarioAction', rule: ACTIONS.boardingHouseHeal, locationId: here.id, actions: 1,
      healAmount: Number(flags.healDamageOrHorrorOncePerGame) || 1,
      label: '治愈 1 点伤害或 1 点恐惧（每场游戏一次）',
      ...(limitUsed(state, ACTIONS.boardingHouseHeal) ? { reason: '本场游戏已经使用过' } : {}),
    })
  }
  if (here.id === 'hemlockChapel') {
    const spec = flags.searchTopForTrait || { count: 9, trait: 'Spell', limit: 'oncePerGame' }
    moves.push({
      action: 'scenarioAction', rule: ACTIONS.chapelSearchSpell, locationId: here.id, actions: 1,
      search: { from: 'top9', count: Number(spec.count) || 9, traits: [String(spec.trait || 'Spell')] },
      label: '检索牌库顶 9 张，找一张 [[法术]] 支援并抽取（每场游戏一次）',
      ...(limitUsed(state, ACTIONS.chapelSearchSpell) ? { reason: '本场游戏已经使用过' } : {}),
    })
  }
  if (here.id === 'valeSchoolhouse') {
    const spec = flags.searchDeckForTrait || { trait: 'Tome', limit: 'oncePerGame' }
    moves.push({
      action: 'scenarioAction', rule: ACTIONS.schoolhouseSearchTome, locationId: here.id, actions: 1,
      search: { from: 'deck', traits: [String(spec.trait || 'Tome')] },
      label: '检索牌库，找一张 [[书籍]] 支援并抽取（每场游戏一次）',
      ...(limitUsed(state, ACTIONS.schoolhouseSearchTome) ? { reason: '本场游戏已经使用过' } : {}),
    })
  }
  // 十字路口：[fast] 1–2 位调查员时，团队每轮一次移动。
  if (here.id === START_LOCATION && investigatorCount(state) <= 2) {
    const usedRound = Number(limitsFor(state).crossroadsRound)
    const used = usedRound === Number(state.round)
    moves.push({
      action: 'scenarioAction', rule: ACTIONS.crossroadsMove, locationId: here.id,
      actions: 0, fast: true, label: '快速移动到连接地点（团队每轮一次）',
      ...(used ? { reason: '本轮已经使用过' } : {}),
    })
  }
  return moves
}

function boardingHouseHeal(state, inv, api = {}) {
  if (limitUsed(state, ACTIONS.boardingHouseHeal)) return false
  const answer = chooseFrom(api, {
    kind: 'story', source: ACTIONS.boardingHouseHeal, seat: inv.seat,
    prompt: '治愈 1 点伤害，或治愈 1 点恐惧？',
    options: [{ id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
  })
  if (answer === 'horror') {
    if (typeof api?.healHorror === 'function') api.healHorror(inv.seat, 1)
    else inv.horror = Math.max(0, (Number(inv.horror) || 0) - 1)
    info(api, `${inv.name} 在旅舍治愈 1 点恐惧。`)
  } else {
    if (typeof api?.healDamage === 'function') api.healDamage(inv.seat, 1)
    else inv.damage = Math.max(0, (Number(inv.damage) || 0) - 1)
    info(api, `${inv.name} 在旅舍治愈 1 点伤害。`)
  }
  markLimit(state, ACTIONS.boardingHouseHeal)
  return true
}

function crossroadsMove(state, inv, api = {}) {
  if (investigatorCount(state) > 2) return false
  if (Number(limitsFor(state).crossroadsRound) === Number(state.round)) return false
  const here = locationOf(state, inv.location)
  const destinations = [...(here?.connections || [])].filter(id => locationOf(state, id))
  if (!destinations.length) return false
  let destination = destinations[0]
  if (typeof api?.choose === 'function' && destinations.length > 1) {
    const answer = api.choose({
      kind: 'move', source: ACTIONS.crossroadsMove, seat: inv.seat, prompt: '选择要快速移动到的连接地点。',
      options: destinations.map(id => ({ id, label: locationName(state, id) })),
    })
    if (destinations.includes(answer)) destination = answer
  }
  if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, destination)
  else inv.location = destination
  limitsFor(state).crossroadsRound = Number(state.round)
  info(api, `${inv.name} 在十字路口快速移动到「${locationName(state, destination)}」（团队本轮一次）。`)
  return true
}

/** 引擎真实入口：dispatch.js#scenarioAction → behavior.performAction。 */
export function performAction(state, inv, move, api = {}) {
  if (!inv || !move) return false
  if (move.rule === ACTIONS.codex) {
    const entry = codexEntryOf(move.codexNumber ?? codexNumberForLocation(inv.location))
    if (!entry) return false
    return Boolean(resolveCodexEntry(state, entry, inv.seat, api))
  }
  if (move.rule === ACTIONS.boardingHouseHeal) return boardingHouseHeal(state, inv, api)
  if (move.rule === ACTIONS.chapelSearchSpell) {
    if (limitUsed(state, ACTIONS.chapelSearchSpell)) return false
    const search = move.search || { from: 'top9', count: 9, traits: ['Spell'] }
    const found = searchDeckToHand(state, inv, { traits: search.traits, from: search.from }, api)
    markLimit(state, ACTIONS.chapelSearchSpell)
    return Boolean(found) || true
  }
  if (move.rule === ACTIONS.schoolhouseSearchTome) {
    if (limitUsed(state, ACTIONS.schoolhouseSearchTome)) return false
    const search = move.search || { from: 'deck', traits: ['Tome'] }
    const found = searchDeckToHand(state, inv, { traits: search.traits, from: search.from }, api)
    markLimit(state, ACTIONS.schoolhouseSearchTome)
    return Boolean(found) || true
  }
  if (move.rule === ACTIONS.crossroadsMove) return crossroadsMove(state, inv, api)
  return false
}

/**
 * 引擎真实入口：actions.js#afterInvestigate（成功调查之后）。
 * 老磨坊：「After you discover a clue at The Old Mill: ([codex] 12)」——反应是可选的。
 * 近似：只覆盖「调查成功」这一条线索发现路径（效果/事件在该地点放线索不会触发；已披露）。
 */
export function afterInvestigate(state, inv, location, result, api = {}) {
  if (!inv || !location) return false
  const codexNumber = reactionCodexNumberForLocation(location.id)
  if (!codexNumber) return false
  if (result && result.success === false) return false
  const entry = codexEntryOf(codexNumber)
  if (!entry || !codexAvailable(state, entry, inv.seat)) return false
  const answer = chooseFrom(api, {
    kind: 'story', source: `welcometCodex${codexNumber}`, seat: inv.seat,
    prompt: `你发现了老磨坊的线索：要读法典 ${codexNumber} 吗？`,
    options: [{ id: 'read', label: '读法典' }, { id: 'skip', label: '跳过' }],
  })
  if (answer === 'skip') return false
  return Boolean(resolveCodexEntry(state, entry, inv.seat, api))
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
export const currentActCode = state => codeOf(currentAct(state))
export const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
export const currentAgendaCode = state => codeOf(currentAgenda(state))

/** 议程是否已到毁灭阈值（只读；引擎 checkAgenda 同口径：state.doom + 议程实例 + 场上卡）。 */
export function agendaDoomReached(state) {
  const agenda = currentAgenda(state)
  if (!agenda) return false
  const threshold = Number(agenda.doomThreshold ?? AGENDA_DOOM_THRESHOLD) || AGENDA_DOOM_THRESHOLD
  const cards = [...(state.enemies || []), ...(state.locations || []), ...(state.storyAssets || [])]
  const total = (Number(state.doom) || 0) + (Number(agenda.doom) || 0)
    + cards.reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
  return total >= threshold
}

export const isBrillianceRevealed = state => flagsFor(state).welcomeBrilliance === true

/**
 * 幕 10682 背面「The Brilliance」：参考 Haskell 的 KonamiCode 分支（正常流程不会翻幕；翻面时才结算）。
 * 每位调查员获得 1 点奖励经验（暂不花费），记入 `records.welcomeToHemlockValeBonusXp`。
 * 每人经验量读共享组条目 10682 的 flags.back.bonusXp（未注册时回退 1）。
 */
export function gainBrilliance(state, api = {}) {
  if (isBrillianceRevealed(state)) return 0
  setFlag(state, 'welcomeBrilliance', true)
  const records = recordsFor(state)
  const perInvestigator = Number(flagsOf(ACT_CODE).back?.bonusXp) || 1
  const count = investigatorCount(state) * perInvestigator
  records[RECORD_KEYS.brilliance] = true
  records[RECORD_KEYS.bonusXp] = (Number(records[RECORD_KEYS.bonusXp]) || 0) + count
  info(api, `「光辉（The Brilliance）」：每位调查员获得 ${perInvestigator} 点奖励经验（暂不花费）。`)
  return count
}

export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  gainBrilliance(state, api)
  return true
}

/** 记录序曲结束（幂等）：结局 1、日期、下一次勘察候选、奖励经验。 */
export function completePrelude(state, api = {}, { reason = 'agenda' } = {}) {
  const records = recordsFor(state)
  records[RECORD_KEYS.resolution] = 'resolution1'
  records[RECORD_KEYS.resolutionReason] = reason
  records[RECORD_KEYS.day] = dayOf(state)
  records[RECORD_KEYS.time] = isNight(state) ? 'Night' : 'Day'
  records[RECORD_KEYS.surveyChoices] = [...SURVEY_DESTINATIONS]
  records[RECORD_KEYS.bonusXp] = Number(records[RECORD_KEYS.bonusXp]) || 0
  setFlag(state, 'welcomePreludeComplete', true)
  setFlag(state, 'welcomePreludeCompleteReason', reason)
  return {
    resolution: 'resolution1',
    reason,
    bonusXp: records[RECORD_KEYS.bonusXp],
    surveyChoices: [...SURVEY_DESTINATIONS],
  }
}

/** 所有未退场调查员撤退（议程背面的印刷效果）。 */
export function resignAll(state, api = {}) {
  const active = activeInvestigators(state)
  for (const inv of active) {
    if (typeof api?.resign === 'function') api.resign(inv.seat)
    else inv.resigned = true
  }
  return active.length
}

/**
 * 议程 10681 背面「Time to Get to Work!」：所有调查员撤退（→ 结局 1）。
 * 背面数据读共享组条目 10681 的 flags.back（{ allResign, resolution, name }；未注册时回退印刷正文）。
 * 先写记录再撤退，避免最后一位撤退触发 allResigned → finish 抛 ScenarioEnded 时丢记录。
 */
export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  const back = flagsOf(AGENDA_CODE).back || {}
  const resolutionKey = String(back.resolution || 'resolution1')
  completePrelude(state, api, { reason: 'agendaBack' })
  info(api, `议程背面「${back.name || 'Time to Get to Work!'}」：所有调查员撤退（→ ${resolutionKey === 'resolution1' ? '结局 1' : resolutionKey}）。`)
  resignAll(state, api)
  if (state.status === 'playing' && typeof api?.finish === 'function') api.finish(resolutionKey)
  else state.resolution = resolutionKey
  return true
}

/** 引擎读点：所有调查员撤退时也直接进入结局 1（与议程背面同一条收束）。 */
export function allResigned(state, api = {}) {
  completePrelude(state, api, { reason: 'resigned' })
  info(api, '所有调查员都撤退了：结算结局 1（序曲结束）。')
  if (typeof api?.finish === 'function') api.finish('resolution1')
  else state.resolution = 'resolution1'
  return true
}

/** 幕没有数值目标（本序曲由议程推进结束）：不自动推进任何幕。 */
export function checkObjectives(state, api = {}) {
  void state
  void api
  return false
}

/**
 * 结局钩子：Resolution 1 只写战役记录（关系等级已由法典逐条写入）；经验由引擎按
 * `state.victory + bonus` 发放，本序曲 victory = 0，「光辉」额外 +1/人。
 * Resolution 1 的 [autoFail] 不在这里加：战役层已在 `flow.js#chaosBagTransitions` 声明
 * `welcomeResolution`（`when: 'welcomeToHemlockVale/resolution1'`，`adds: ['autoFail']`），
 * 章内写 `records.welcomeToHemlockValeResolution = 'resolution1'` 即该 transition 的触发条件，
 * 避免同一枚标记被加两次。「为第一次勘察做准备」由引擎 survey-preparation.js 按
 * `scenario.mechanics.survey` 在 finishScenario 里结算。
 */
export function resolution(state, key, events = null, api = {}) {
  void events
  const requested = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'resolution1'
  const receipt = completePrelude(state, api, { reason: 'resolution' })
  flagsFor(state).welcomeResolved = requested
  return { award: true, bonus: isBrillianceRevealed(state) ? 1 : 0, ...receipt }
}

export function scenarioResolution(state, resolutionKey = 'resolution1', api = {}) {
  resolution(state, resolutionKey, null, api)
  const records = recordsFor(state)
  return {
    resolution: records[RECORD_KEYS.resolution],
    reason: records[RECORD_KEYS.resolutionReason],
    bonusXp: Number(records[RECORD_KEYS.bonusXp]) || 0,
    surveyChoices: [...(records[RECORD_KEYS.surveyChoices] || [])],
    relationships: Object.fromEntries(RESIDENTS.map(row => [row.id, residentLevel(state, row.id)])),
    residents: residentsInPlay(state).map(asset => codeOf(asset)),
  }
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token, api = {}) {
  const outcome = welcomeChaosToken(state, inv, token)
  if (!outcome) return null
  // 谈判自动成功：优先引擎 api；没有时写引擎既有读点（见文件头披露 1）。
  if (outcome.onDraw.some(fx => fx.mode === 'parleyAutoSuccess') && state.skillTest) {
    if (typeof api?.setTestAutoSuccess === 'function') api.setTestAutoSuccess()
    else state.skillTest.autoSuccess = true
  }
  return {
    delta: outcome.delta,
    drawAnother: outcome.drawAnother,
    onDraw: outcome.onDraw,
    onFail: outcome.onFail,
  }
}
export function chaosTokenValue(state, tokenFace, inv, options = {}) {
  return welcomeChaosTokenValue(state, tokenFace, inv, options)
}

/** `onDraw` 的 `{type:'scenarioToken', token}` 回派点（skill-effects.js#applyTokenFx）。 */
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || !effect) return false
  if (effect.token === 'cultist' && effect.mode === 'parleyAutoSuccess') {
    if (typeof api?.setTestAutoSuccess === 'function') {
      api.setTestAutoSuccess()
      info(api, '[cultist]：本次谈判尝试自动成功。')
      return true
    }
    if (state.skillTest) {
      state.skillTest.autoSuccess = true
      info(api, '[cultist]：本次谈判尝试自动成功。')
      return true
    }
    return false
  }
  return false
}

// ---------------------------------------------------------------------------
// 事件（共享组条目回派）
// ---------------------------------------------------------------------------
export const events = Object.freeze({
  // 地点/居民条目（共享组 worker）读法典时：`api.resolveScenarioEvent('welcomeToHemlockValeCodex', { entry, seat })`
  welcomeToHemlockValeCodex: (state, payload = {}, api = {}) => resolveCodexEntry(
    state, payload.entry ?? payload.number ?? payload.id, payload.seat ?? leadSeat(state), api,
    { force: payload.force === true }),
  // 居民资产「谈判成功」后读法典：`api.resolveScenarioEvent('welcomeToHemlockValeResidentParley', { code, seat })`
  welcomeToHemlockValeResidentParley: (state, payload = {}, api = {}) => completeResidentParley(
    state, payload.code ?? payload.resident ?? payload.id, payload.seat ?? leadSeat(state), api),
  // 开场选择（无 UI 预置时的回派）：`{ branch: 'survey' | 'feast' }`
  welcomeToHemlockValeIntro: (state, payload = {}, api = {}) => {
    const records = recordsFor(state)
    const branch = payload.branch === 'feast' ? 'feast' : 'survey'
    if (records[RECORD_KEYS.intro] === branch && flagsFor(state).welcomeIntroTokenApplied) {
      return { branch, token: records[RECORD_KEYS.chaosToken] }
    }
    records[RECORD_KEYS.intro] = branch
    clearFlag(state, 'welcomeIntroTokenApplied')
    const token = applyIntroChaosToken(state, branch, api)
    return { branch, token }
  },
})

// ---------------------------------------------------------------------------
// 装配
// ---------------------------------------------------------------------------
export const implementedEncounterCodes = Object.freeze([])
export const implementedEntryFlags = () => ({})
export const RECORD_READ_KEYS = RECORD_READS
export const RECORD_WRITE_KEYS = RECORD_WRITES

export const behavior = {
  id: CHAPTER_ID,
  isPrelude: true,
  locationsStartRevealed: true,
  startLocation,
  preScenarioSetup,
  introduction,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  prepareScenario,
  setupScenario,
  actions,
  performAction,
  afterInvestigate,
  actReveal,
  agendaReveal,
  checkObjectives,
  allResigned,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioResolution,
  events,
  tokenMeanings: WELCOME_TOKEN_MEANINGS,
  scenarioText: SCENARIO_TEXT,
  gatherGroups: [...GATHER_GROUPS],
  declaredEncounterDeck: [],
  setAsideCards: [...SET_ASIDE_RESIDENT_CODES],
  // 读点/工具（测试与战役层共用）
  dayOf,
  isNight,
  isDaytime,
  dateOf,
  syncDayAndTime,
  timeMarkerInPlay,
  putTimeMarkerInPlay,
  placeDoomOnAgenda,
  residentsInPlay,
  residentInPlay,
  putResidentInPlay,
  removeResidentFromPlay,
  residentRecord,
  residentLevel,
  residentOf,
  addResidentRelationship,
  residentParleySpec,
  completeResidentParley,
  codexEntryOf,
  codexNumberForLocation,
  codexNumberForResident,
  actionCodexNumberForLocation,
  reactionCodexNumberForLocation,
  codexEntryForLocation,
  codexEntryForResident,
  codexEntriesAt,
  codexAvailable,
  codexEntryAvailableAt,
  codexResolved,
  codexResolvedBy,
  resolvedCodexKeys,
  resolveCodexEntry,
  REACTION_CODEX_LOCATIONS,
  introBranch,
  introChaosToken,
  applyIntroChaosToken,
  gainBrilliance,
  isBrillianceRevealed,
  completePrelude,
  resignAll,
  currentAct,
  currentActCode,
  currentAgenda,
  currentAgendaCode,
  agendaDoomReached,
  hardSide: isHardSide,
  parleyTest: isParleyTest,
}

export { dayOf, isNight, isParleyTest, welcomeChaosToken, welcomeChaosTokenValue, investigatorCount }
