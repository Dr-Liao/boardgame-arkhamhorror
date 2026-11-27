// 深沼之物（theThingInTheDepths · 提示卡 10588）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheThingInTheDepths.hs +
//       Scenarios/TheFeastOfHemlockVale/TheThingInTheDepths/Helpers.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheThingInTheDepths/*.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theThingInTheDepths.json（input.guidePath）。
//
// 引擎读点（全部既有钩子，不改引擎）：
//   preScenarioSetup → 日期分支、3×3 网格洗牌/随机移出 1 张、实际起始地点、幕/议程牌库、毁灭、放一边
//   startLocation / setupLocations / locationPlaced / afterDeckSetup → 9 地点入场与运行时连接、当日遭遇组、居民
//   actions / performAction → 泛滥道路（渗坑换移动）、废弃棚屋（线索换渗坑伤害）
//   locationShroudModifier / moveError / beforeMove / locationEntered / afterTest
//   enemySpawned / enemyMoved / enemyEngaged / enemyPhaseStart / enemyPhaseAfterHunters / enemyDefeated
//   enemyStatModifier（健康值）/ enemyConnections（深沼之物跨沉没地点连通）/ spawnLocation / canOpportunityAttack
//   turnEnded / roundEnded / checkObjectives → 渗坑强制效果与翻面
//   actReveal / agendaReveal → 幕/议程背面（鳄龟混种、深沼之物、全员被击败）
//   resolveChaosToken / applyTokenEffect → 10588 混乱标记
//   resolution / events → 结局 1–5、无结局与剧本日志记录；诡计显现（地层扰动/泥泞下沉）
//
// 「渗坑下沉」唯一写入口：地点上的伤害标记即渗坑；达到 3 个时调用引擎原语 `api.sinkLocation`
// （src/engine/location-face.js）——弃掉该地点的渗坑、保留调查员/敌人/诡计附属与线索、弃掉玩家附属、
// 把印刷面换成 Open Water（[[沉没]]）。引擎没有「地点上放伤害」的 api，也没有地点受伤的强制窗口，
// 因此渗坑放完立即在 behavior 里扫一遍阈值（turnEnded / roundEnded / checkObjectives / 标记效果），
// 这是本文件唯一的近似点：引擎其它子系统直接改 location.damage 的场合只能等到下一次扫描。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { replacePrintedLocationFace } from '../../../../../src/engine/location-face.js'
import {
  ACT_CODES, AGENDA_CODES, AGENDAS, ACTS, CENTER_SLOT, CHELYDRAN_HYBRID_CODE, DAY_ENCOUNTER_GROUPS,
  DAY_STORY_CODES, ENCOUNTER_DECK, GRASPING_TENDRIL_CODE, GRID_ADJACENCY, GRID_SLOTS, LOCATION_IDS,
  LOCATIONS, OPEN_WATER_BY_BOG_CODE, OPEN_WATER_FACES, RECORD_KEYS, RECORD_READS, REFERENCE_CODE,
  RESIDENT_CODES, RESIDENT_RECORDS, SET_ASIDE_CARDS, SLOT_IDS, SLOT_LABELS, START_LOCATION, START_SLOT,
  THING_IN_THE_DEPTHS_CODE, connectionsForAssignment, dayEncounterDeck,
} from './definition.js'
import {
  BOG_TRAIT, SUNKEN_TRAIT, hasTrait, isHardSide, sunkenLocationCount,
  thingInTheDepthsChaosToken, thingInTheDepthsChaosTokenValue,
} from './chaos.js'

const CHAPTER_ID = 'theThingInTheDepths'
const SINKHOLE_THRESHOLD = 3
const NO_RESOLUTION = 'noResolution'
const RESOLUTION_KEYS = Object.freeze([
  'noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5',
])
const SYMBOL_TOKENS = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing', 'autofail'])

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
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
const cardCodeOf = value => String(value?.originalCode || value?.code || '')
const leadSeat = state => Number.isInteger(state?.campaign?.leadSeat) ? state.campaign.leadSeat : 0
const locationById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const definitionOf = (state, id) => state.scenario?.locations?.[id] || LOCATIONS[id] || null
const enemiesAt = (state, locationId) => (state.enemies || [])
  .filter(enemy => enemy && !enemy.defeated && enemy.location === locationId)
const enemyByCode = (state, code) => (state.enemies || [])
  .find(enemy => enemy && !enemy.defeated && cardCodeOf(enemy) === String(code)) || null
const locationName = (state, id) => locationById(state, id)?.name || definitionOf(state, id)?.name || id

// 单卡条目的规则数据（flags）是命运读点：behavior 只按条目声明分派。
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true

const ACT_BY_CODE = Object.freeze(Object.fromEntries(ACTS.map(act => [cardCodeOf(act), act])))
const AGENDA_BY_CODE = Object.freeze(Object.fromEntries(AGENDAS.map(agenda => [cardCodeOf(agenda), agenda])))

/** 只取印刷字段的地点面：normalizePrintedLocationFace 只接受 code/name/nameEn/shroud/traits。 */
function printedLocationFace(definition) {
  if (!definition) return null
  return {
    code: definition.originalCode || definition.code,
    name: definition.name,
    nameEn: definition.nameEn,
    shroud: definition.shroud,
    traits: [...(definition.traits || [])],
  }
}

// ---------------------------------------------------------------------------
// 日期（三昼三夜）与居民记录
// ---------------------------------------------------------------------------
const CALENDAR_RECORD = 'hemlockDate'
const DAY_LABELS = Object.freeze({ 1: '第一日', 2: '第二日', 3: '第三日' })

function parseDate(value) {
  if (typeof value !== 'string') return null
  const [day, period] = value.split(':')
  const number = Number(day)
  return Number.isSafeInteger(number) && number >= 1 && number <= 3
    && ['day', 'night'].includes(period) ? { day: number, period } : null
}

/** 当前日/时段：日历原语记录 → 战役日志 day/time → scenarioFlags → 默认第一日白天。 */
export function hemlockClock(state) {
  const records = state?.campaign?.records || {}
  const flags = state?.scenarioFlags || {}
  const fromCalendar = parseDate(records[CALENDAR_RECORD])
  if (fromCalendar) return fromCalendar
  const rawDay = records.day ?? flags.depthsDay
  const rawPeriod = records.time ?? records.period ?? flags.depthsPeriod
  const dayMatch = /(\d)/.exec(String(rawDay ?? ''))
  const day = dayMatch ? Number(dayMatch[1]) : 1
  const period = /night|夜/i.test(String(rawPeriod ?? '')) ? 'night' : 'day'
  return { day: Math.min(3, Math.max(1, day)), period }
}

export const dayNumber = state => hemlockClock(state).day
export const isNight = state => hemlockClock(state).period === 'night'

/** 记录唯一写入口（引擎 api.setCampaignRecord；直调路径回退到 campaign.records）。 */
export function setRecord(state, api, key, value) {
  if (typeof api?.setCampaignRecord === 'function') return api.setCampaignRecord(key, value)
  const records = recordsFor(state)
  if (value == null) delete records[key]
  else records[key] = value
  return records[key] ?? null
}

export const recordOf = (state, key) => state?.campaign?.records?.[key] ?? null
export const residentLevel = (state, residentKey) => Number(recordOf(state, RESIDENT_RECORDS[residentKey]?.level)) || 0

/** 居民关系增减：引擎 api.mechanics.residents.change（resident-record.js）；直调路径按上下限夹取。 */
export function changeResident(state, api, residentKey, delta) {
  const spec = RESIDENT_RECORDS[residentKey]
  if (!spec) return null
  const changed = safeCall(api?.mechanics?.residents, 'change', spec, delta)
  if (typeof changed === 'number') return changed
  if (safeCall(api?.mechanics?.residents, 'status', spec)) return null
  const records = recordsFor(state)
  const next = Math.max(0, Math.min(spec.max, (Number(records[spec.level]) || 0) + Number(delta || 0)))
  records[spec.level] = next
  return next
}

/** 剧情引入分支（参考 PreScenarioSetup 的 Intro 1–8）。 */
export function introBranchFor(state, clock = hemlockClock(state)) {
  if (clock.period !== 'day') return 'night'
  if (clock.day === 2) return 'day2'
  if (clock.day === 3) return 'day3'
  return residentLevel(state, 'judithPark') >= 1 ? 'day1-judithHigh' : 'day1-judithLow'
}

// ---------------------------------------------------------------------------
// 地点：网格槽位、连接、渗坑与翻面
// ---------------------------------------------------------------------------
export function slotLocationId(state, slotId) {
  return flagsFor(state).depthsSlots?.[slotId] || null
}

export function assignmentForLocation(state, locationId) {
  const slots = flagsFor(state).depthsSlots
  if (!slots) return null
  return SLOT_IDS.find(slotId => slots[slotId] === locationId) || null
}

/** 洗牌结果 → 槽位分配。shuffle/random 来自引擎 helper 或 api，直调路径用恒等洗牌 + 首个随机索引。 */
export function planLocations(state, helper = {}) {
  void state
  const api = helper?.api || {}
  const shuffle = typeof api.shuffle === 'function'
    ? api.shuffle
    : typeof helper.shuffle === 'function'
      ? list => helper.shuffle([...list], () => Number(helper?.randomValue?.(state) ?? Math.random()))
      : list => [...list]
  const random = typeof helper.random === 'function' ? () => helper.random() : () => 0
  const order = shuffle([...LOCATION_IDS])
  const removedIndex = Math.max(0, Math.min(order.length - 1, Math.floor(random() * order.length)))
  const removed = order[removedIndex]
  const remaining = order.filter((_, index) => index !== removedIndex)
  const assignment = Object.fromEntries(SLOT_IDS.map((slotId, index) => [slotId, remaining[index]]))
  return {
    order, removed, assignment,
    startLocation: assignment[START_SLOT],
    northShore: assignment.northShore,
    center: assignment[CENTER_SLOT],
    cranberryBog: assignment.cranberryBog,
    connections: connectionsForAssignment(assignment),
  }
}

/** 把洗牌结果写进 flags/地点的规则连接（定义表与已入场实例同步）。 */
export function applyLocationPlan(state, plan) {
  const flags = flagsFor(state)
  flags.depthsSlots = { ...plan.assignment }
  flags.depthsRemovedLocation = plan.removed
  flags.depthsStartLocation = plan.startLocation
  flags.depthsNorthShore = plan.northShore
  flags.depthsCenter = plan.center
  flags.depthsCranberryBog = plan.cranberryBog
  for (const [locationId, connections] of Object.entries(plan.connections || {})) {
    const definition = state.scenario?.locations?.[locationId]
    if (definition) definition.connections = [...connections]
    const runtime = locationById(state, locationId)
    if (runtime) runtime.connections = [...connections]
  }
  return plan
}

export const syncPlanConnections = state => {
  const plan = { assignment: flagsFor(state).depthsSlots || {} }
  return applyLocationPlan(state, {
    ...plan, connections: connectionsForAssignment(plan.assignment),
    removed: flagsFor(state).depthsRemovedLocation,
    startLocation: plan.assignment[START_SLOT],
    northShore: plan.assignment.northShore,
    center: plan.assignment[CENTER_SLOT],
    cranberryBog: plan.assignment.cranberryBog,
  })
}

export function distancesFrom(state, fromId) {
  const distance = new Map()
  if (!fromId) return distance
  distance.set(fromId, 0)
  const queue = [fromId]
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]
    for (const next of locationById(state, id)?.connections || []) {
      if (distance.has(next) || !locationById(state, next)) continue
      distance.set(next, distance.get(id) + 1)
      queue.push(next)
    }
  }
  return distance
}

/** 最近的[[沼地]]地点（同距离的候选全部返回，由调用方按规则选择）。 */
export function nearestBogLocations(state, fromId) {
  const distance = distancesFrom(state, fromId)
  const bogs = (state.locations || []).filter(location => hasTrait(location, BOG_TRAIT))
    .map(location => ({ location, steps: distance.get(location.id) ?? Number.MAX_SAFE_INTEGER }))
  if (!bogs.length) return []
  const best = Math.min(...bogs.map(row => row.steps))
  return bogs.filter(row => row.steps === best).map(row => row.location)
}

function chooseLocation(api, seat, candidates, prompt, { canSkip = false, source = '10588' } = {}) {
  if (!candidates.length || typeof api?.choose !== 'function') return candidates[0] || null
  const picked = api.choose({
    kind: 'location', source, seat, prompt, canSkip,
    options: [...(canSkip ? [{ id: 'skip', label: '不选择' }] : []),
      ...candidates.map(location => ({ id: location.id, label: `${location.name}（${Number(location.damage) || 0} 个渗坑）` }))],
  })
  if (picked == null) return candidates[0]
  if (picked === 'skip') return null
  return candidates.find(location => location.id === picked) || candidates[0]
}

/** 在地点放置渗坑（伤害标记），随后立即结算「3 个渗坑翻面」。 */
export function addSinkholes(state, location, count, api = {}) {
  if (!location) return 0
  const amount = Math.max(0, Math.floor(Number(count) || 0))
  if (!amount) return 0
  location.damage = (Number(location.damage) || 0) + amount
  sinkLocationsAtThreshold(state, api)
  return amount
}

/** 翻面：优先引擎原语 api.sinkLocation（完整规则）；直调路径换印刷面并弃掉玩家附属。 */
export function sinkLocation(state, location, api = {}) {
  if (!location) return false
  const code = cardCodeOf(location)
  const openWater = OPEN_WATER_BY_BOG_CODE[code] || location.sinkFaceCode || null
  const face = openWater ? OPEN_WATER_FACES[openWater] : null
  if (!face) return false
  if (typeof api.sinkLocation === 'function') {
    const name = location.name
    const done = api.sinkLocation(location.id, face, SINKHOLE_THRESHOLD)
    if (!done) return false
    info(api, `「${name}」沉入水下：翻至「${face.name}」面（保留线索与遭遇附属）。`)
    return true
  }
  if (!replacePrintedLocationFace(location, face)) return false
  location.damage = 0
  const name = location.name
  for (const attachment of (location.attachments || []).filter(card => card.ownerSeat != null && !card.encounterAttached)) {
    const owner = state.investigators?.[attachment.ownerSeat]
    if (owner) { owner.discard ||= []; owner.discard.push(attachment.code) }
  }
  location.attachments = (location.attachments || []).filter(card => card.ownerSeat == null || card.encounterAttached)
  info(api, `「${name}」沉入水下：翻至「${face.name}」面（保留线索与遭遇附属）。`)
  return true
}

/** 强制翻面（议程 1 背面）：不受渗坑数量限制；先弃掉地点上全部标记（含线索）。 */
export function forceSinkLocation(state, location, api = {}, { discardClues = false } = {}) {
  if (!location) return false
  if (discardClues) {
    location.clues = 0
    location.maxClues = 0
  }
  location.damage = Math.max(Number(location.damage) || 0, SINKHOLE_THRESHOLD)
  return sinkLocation(state, location, api)
}

/** 议程 1/2 正面的强制效果：任意地点 ≥3 个渗坑 → 翻面。 */
export function sinkLocationsAtThreshold(state, api = {}) {
  let flipped = 0
  for (const location of [...(state.locations || [])]) {
    if ((Number(location.damage) || 0) < SINKHOLE_THRESHOLD) continue
    if (sinkLocation(state, location, api)) flipped += 1
  }
  return flipped
}

export const sunkenCount = state => sunkenLocationCount(state)

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function cloneCards(source, codes, fallbackByCode) {
  return codes.map(code => {
    const found = (source || []).find(card => cardCodeOf(card) === code)
    const base = found || fallbackByCode[code]
    return base ? structuredClone(base) : null
  }).filter(Boolean)
}
/** 引擎真实入口：setup.js 在调查员准备**之前**取 startLocation，之后才调用 preScenarioSetup。 */
export function startLocation(state) {
  return flagsFor(state).depthsStartLocation || START_LOCATION
}

export function preScenarioSetup(state, events, api = {}) {
  void events
  const flags = flagsFor(state)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  const clock = hemlockClock(state)
  flags.depthsDay = clock.day
  flags.depthsPeriod = clock.period
  // 日期写回引擎日历原语（duringPeriod 等匹配器读它）；直调路径回退到战役记录。
  if (typeof api?.mechanics?.calendar?.set === 'function') api.mechanics.calendar.set(clock.day, clock.period)
  else setRecord(state, api, CALENDAR_RECORD, `${clock.day}:${clock.period}`)

  // 幂等：已经洗过牌（读档/重复布置）时沿用既有槽位，不重洗。
  const plan = flags.depthsSlots
    ? syncPlanConnections(state)
    : applyLocationPlan(state, planLocations(state, { shuffle: api.shuffle, random: api.random }))
  // 调查员的起始地点在 preScenarioSetup 之前已按默认起点准备，这里改到洗牌后的真实起始地点。
  for (const inv of state.investigators || []) {
    if (!inv || inv.defeated || inv.resigned) continue
    inv.location = plan.startLocation
    inv.handSlotsPenalty = state.scenario?.locations?.[plan.startLocation]?.handSlotsPenalty || 0
  }
  // 幕/议程牌库（可变副本）；幕 1 的目标地点指向实际北岸。
  state.acts = cloneCards(state.scenario?.acts, ACT_CODES, ACT_BY_CODE)
  if (state.acts[0]?.objective?.type === 'clues') state.acts[0].objective.atLocation = plan.northShore
  state.actIndex = 0
  state.agendas = cloneCards(state.scenario?.agendas, AGENDA_CODES, AGENDA_BY_CODE)
  state.agendaIndex = 0
  state.doom = Number(state.doom) || 0
  // 参考 Setup：Day 2 → 议程上 1 个毁灭；Day 3 且白天 → 2 个毁灭。
  if (clock.period === 'day' && clock.day === 2) state.doom += 1
  if (clock.period === 'day' && clock.day === 3) state.doom += 2
  if (state.scenario) state.scenario.resignAnywhere = true

  // 引入分支（Intro 1–8）：Judith 关系 ≥1 → 提升关系 + 每人 1 点奖励经验；否则记「Judith shared a grudge」。
  const branch = introBranchFor(state, clock)
  setRecord(state, api, RECORD_KEYS.introBranch, branch)
  if (branch === 'day1-judithHigh') {
    changeResident(state, api, 'judithPark', 1)
    flags.depthsBonusXp = (Number(flags.depthsBonusXp) || 0) + 1
  } else if (branch === 'day1-judithLow') {
    setRecord(state, api, RECORD_KEYS.judithSharedAGrudge, true)
  } else if (branch === 'day2') {
    const answer = typeof api.choose === 'function'
      ? api.choose({
        kind: 'story', source: REFERENCE_CODE, seat: leadSeat(state),
        prompt: '卡车陷进泥里：推车，还是轰油门？',
        options: [
          { id: 'push', label: '"我们来推！"（下一场景每人少 2 资源）' },
          { id: 'rev', label: '"轰油门。"（下一场景每人少 1 行动）' },
        ],
      })
      : 'push'
    if (answer === 'rev') setRecord(state, api, RECORD_KEYS.fewerActionsNextScenario, 1)
    else setRecord(state, api, RECORD_KEYS.fewerResourcesNextScenario, 2)
  }
  info(api, `${DAY_LABELS[clock.day] || '第一日'}${clock.period === 'night' ? '夜晚' : '白天'}：`
    + `东威克沼 10 张地点洗混，移出「${locationName(state, plan.removed)}」，其余 9 张按 3×3 网格 Bog 面朝上入场；`
    + `起始地点「${locationName(state, plan.startLocation)}」，北岸「${locationName(state, plan.northShore)}」。`)
  return true
}

/** 引擎真实入口：setup.js#setupLocations；返回要由引擎逐一入场的地点 id（网格顺序）。 */
export function setupLocations(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const flags = flagsFor(state)
  if (!flags.depthsSlots) {
    const shuffle = typeof helper.shuffle === 'function'
      ? list => helper.shuffle([...list], () => helper.randomValue(state))
      : api.shuffle
    const random = typeof helper.randomValue === 'function' ? () => helper.randomValue(state) : api.random
    applyLocationPlan(state, planLocations(state, {
      shuffle: typeof shuffle === 'function' ? shuffle : undefined,
      random: typeof random === 'function' ? random : undefined,
    }))
  }
  const placed = SLOT_IDS.map(slotId => flags.depthsSlots[slotId]).filter(Boolean)
  const startId = flags.depthsSlots[START_SLOT] || START_LOCATION
  for (const inv of state.investigators || []) {
    if (!inv || inv.defeated || inv.resigned) continue
    inv.location = startId
    inv.handSlotsPenalty = state.scenario?.locations?.[startId]?.handSlotsPenalty || 0
  }
  info(api, `东威克沼：${placed.length} 处地点按 3×3 网格入场（Bog 面朝上）。`)
  return placed
}

/** 地点入场后保证规则连接与槽位表一致（后续效果放置地点时同样成立）。 */
export function locationPlaced(state, location) {
  const id = location?.id
  if (!id || !LOCATIONS[id]) return
  const slots = flagsFor(state).depthsSlots
  if (!slots) return
  const slotId = assignmentForLocation(state, id)
  if (!slotId) return
  location.connections = GRID_ADJACENCY[slotId].map(neighbor => slots[neighbor]).filter(Boolean)
}

function spawnStory(state, api, code, locationId) {
  if (typeof api.storyAsset === 'function') return api.storyAsset(code, locationId)
  const def = ALL_CARDS[code] || {}
  state.storyAssets ||= []
  const existing = state.storyAssets.find(asset => cardCodeOf(asset) === String(code))
  if (existing) return null
  const asset = {
    id: `depths-resident-${code}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId ?? null,
    controllerSeat: null, exhausted: false, tokens: 0,
  }
  state.storyAssets.push(asset)
  return asset
}

/** 参考 Setup：只在白天使用 residents 组；Day 1 → Judith（北岸）+ 马奎兹博士；Day 2/3 → River（北岸）。 */
export function placeResidents(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.depthsResidentsPlaced) return 0
  flags.depthsResidentsPlaced = true
  const clock = hemlockClock(state)
  if (clock.period !== 'day') return 0
  const northShore = flags.depthsSlots?.northShore || null
  let placed = 0
  if (clock.day === 1) {
    if (northShore && spawnStory(state, api, RESIDENT_CODES.judithPark, northShore)) placed += 1
    const marquez = spawnStory(state, api, RESIDENT_CODES.drRosaMarquez,
      state.investigators?.[leadSeat(state)]?.location || flags.depthsSlots?.[START_SLOT] || null)
    if (marquez) {
      // 近似：引擎没有「接管剧情资产」的原语；controllerSeat 是既有实例字段（UI 读控制者）。
      marquez.controllerSeat = leadSeat(state)
      placed += 1
    }
    info(api, '第一日白天：Judith Park 在北岸，Dr. Rosa Marquez 由调查员控制（本场景不占盟友槽）。')
  } else if (northShore && spawnStory(state, api, RESIDENT_CODES.riverHawthorne, northShore)) {
    placed += 1
    info(api, '第二/三日白天：River Hawthorne 在北岸。')
  }
  return placed
}

/** 参考 Setup：「把时间标记卡放到对应的（第 N 日）面」——本章用当天的时间标记卡进场景区表示。 */
export function placeTimeMarker(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.depthsTimeMarkerPlaced) return null
  const day = Number(flags.depthsDay) || hemlockClock(state).day
  const code = DAY_STORY_CODES[day]
  if (!code) return null
  flags.depthsTimeMarkerPlaced = true
  let asset = null
  if (typeof api.storyAsset === 'function') asset = api.storyAsset(code, null)
  if (!asset) {
    state.storyAssets ||= []
    asset = state.storyAssets.find(item => cardCodeOf(item) === code) || null
    if (!asset) {
      const def = ALL_CARDS[code] || {}
      asset = { id: `depths-marker-${code}`, code, originalCode: code,
        name: def.nameZh || def.name || code, location: null, global: true, controllerSeat: null,
        exhausted: false, tokens: 0 }
      state.storyAssets.push(asset)
    }
  }
  // 时间标记卡的朝上的一面由当前昼夜决定（引擎没有「时间标记翻面」原语，这里用实例 face 标记）。
  asset.face = isNight(state) ? 'night' : 'day'
  info(api, `时间标记卡「${DAY_LABELS[day] || '第一日'}」进入场景区（${isNight(state) ? '夜' : '昼'}面）。`)
  return asset
}

/** 引擎真实入口：遭遇牌库建立之后（当日遭遇组 + 时间标记 + 居民）。 */
export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const flags = flagsFor(state)
  const day = Number(flags.depthsDay) || hemlockClock(state).day
  const dayDeck = dayEncounterDeck(day)
  if (dayDeck.length && !flags.depthsDayDeckShuffled) {
    flags.depthsDayDeckShuffled = true
    if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck(dayDeck)
    else state.encounterDeck = [...(state.encounterDeck || []), ...dayDeck]
    info(api, `第 ${day} 日：遭遇组「${DAY_ENCOUNTER_GROUPS[day]}」的 ${dayDeck.length} 张牌洗入遭遇牌库。`)
  }
  placeTimeMarker(state, api)
  placeResidents(state, api)
}

export function setupEnemies(state, events, helper = {}) {
  void state
  void events
  void helper
}

/** 直调路径的地点入场（引擎路径由 setup.js#placeLocation 逐个入场）。 */
export function placeSetupLocations(state, api = {}) {
  state.locations ||= []
  const slots = flagsFor(state).depthsSlots || {}
  const placed = []
  for (const slotId of SLOT_IDS) {
    const id = slots[slotId]
    if (!id || locationById(state, id)) continue
    if (typeof api.place === 'function') {
      api.place(id)
      placed.push(id)
      continue
    }
    const definition = definitionOf(state, id)
    if (!definition) continue
    const clues = definition.cluesFixed ?? (definition.cluesPerInvestigator != null
      ? definition.cluesPerInvestigator * investigatorCount(state) : (definition.clues || 0))
    const location = { ...structuredClone(definition), id, revealed: true, clues, maxClues: clues, damage: 0 }
    state.locations.push(location)
    placed.push(id)
  }
  for (const id of placed) locationPlaced(state, locationById(state, id))
  return placed
}

/** 直调/单测入口：preScenarioSetup + 9 地点入场 + 遭遇牌库 + 当日组 + 居民。 */
export function setupScenario(state, api = {}) {
  preScenarioSetup(state, [], api)
  state.locations = []
  const placedIds = setupLocations(state, [], { api })
  placeSetupLocations(state, api)
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  afterDeckSetup(state, [], { api })
  sinkLocationsAtThreshold(state, api)
  return { placedIds, startLocation: flagsFor(state).depthsStartLocation, removed: flagsFor(state).depthsRemovedLocation }
}

// ---------------------------------------------------------------------------
// 地点规则与行动
// ---------------------------------------------------------------------------
/** 腐臭池塘：本地点上每有 1 个渗坑 +1 帷幕（引擎 locationShroudModifier 读点）。 */
export function locationShroudModifier(state, location) {
  void state
  if (!location) return 0
  return cardCodeOf(location) === '10595a' ? (Number(location.damage) || 0) : 0
}

/** 纠葛灌丛：移动离开的额外费用是 1 个行动（移动动作已经付过 1 个行动，这里再要 1 个）。 */
export function moveError(state, inv, location, id) {
  void state
  void location
  const current = locationById(state, inv?.location)
  if (cardCodeOf(current) !== '10594a') return null
  if (id == null || id === inv?.location) return null
  if ((Number(inv.actions) || 0) <= 1) return '离开纠葛灌丛需要额外花费 1 个行动'
  return null
}

export function beforeMove(state, inv, destination, api = {}, options = {}) {
  const current = locationById(state, inv?.location)
  if (cardCodeOf(current) !== '10594a') return true
  if (options?.reason === 'effect') return true
  if (!destination || destination.id === inv?.location) return true
  if ((Number(inv.actions) || 0) < 1) return false
  if (typeof api.loseActions === 'function') api.loseActions(inv.seat, 1)
  else inv.actions = Math.max(0, (Number(inv.actions) || 0) - 1)
  info(api, `${inv.name} 离开纠葛灌丛：额外花费 1 个行动。`)
  return true
}

/** Open Water（[[沉没]]面）：移动进入后抽遭遇牌（引擎 locationEntered 读点）。 */
export function locationEntered(state, inv, location, api = {}) {
  void state
  if (!inv || !location || location.revealed === false) return false
  if (!hasTrait(location, SUNKEN_TRAIT)) return false
  if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
  info(api, `${inv.name} 进入「${location.name}」：抽取遭遇牌库顶的卡牌。`)
  return true
}

/**
 * 腐烂码头：发现线索后检定[agility](3)，失败放 1 个渗坑（引擎 afterInvestigate 读点，
 * 在发现线索之后触发；result.success 为假或没有发现线索时不检定）。
 */
export function afterInvestigate(state, inv, location, result, api = {}) {
  if (!inv || !location || inv.defeated || inv.resigned) return false
  if (cardCodeOf(location) !== '10598a') return false
  if (result && result.success === false) return false
  if (result && Array.isArray(result.cluesDiscovered) && !result.cluesDiscovered.length) return false
  if (typeof api.test !== 'function') {
    addSinkholes(state, location, 1, api)
    return true
  }
  api.test(inv.seat, 'agility', 3, testResult => {
    if (testResult?.success) {
      info(api, `${inv.name} 在腐烂码头稳住了脚步。`)
      return
    }
    addSinkholes(state, location, 1, api)
    info(api, `腐烂码头：${inv.name} 的敏捷检定失败，在本地放置 1 个渗坑。`)
  }, 0, { label: '腐烂码头' })
  return true
}

function shackUsedThisRound(state) {
  return Number(flagsFor(state).depthsShackRound) === Number(state.round)
}

export function actions(state, inv) {
  if (!inv || state.status !== 'playing') return []
  const moves = []
  const location = locationById(state, inv.location)
  if (!location || location.revealed === false) return moves
  const code = cardCodeOf(location)
  if (code === '10596a') {
    moves.push({ action: 'scenarioAction', rule: 'depthsFloodedPathMove', actions: 0,
      label: '在泛滥道路放置 1 个伤害标记（渗坑）：移动至一个连接地点' })
  }
  if (code === '10597a') {
    const sinkholes = Number(location.damage) || 0
    const enemies = enemiesAt(state, location.id)
    if (sinkholes <= 0) {
      moves.push({ action: 'scenarioAction', rule: 'depthsAbandonedShackDrain', actions: 0, reason: '废弃棚屋没有渗坑' })
    } else if (!enemies.length) {
      moves.push({ action: 'scenarioAction', rule: 'depthsAbandonedShackDrain', actions: 0, reason: '本地没有敌人' })
    } else if ((Number(inv.clues) || 0) < 1) {
      moves.push({ action: 'scenarioAction', rule: 'depthsAbandonedShackDrain', actions: 0, reason: '需要 1 个线索' })
    } else if (shackUsedThisRound(state)) {
      moves.push({ action: 'scenarioAction', rule: 'depthsAbandonedShackDrain', actions: 0, reason: '每轮仅限一次' })
    } else {
      moves.push({ action: 'scenarioAction', rule: 'depthsAbandonedShackDrain', actions: 0,
        label: '花费 1 个线索：把废弃棚屋的 1 个渗坑移到本地点的敌人身上，作为伤害' })
    }
  }
  return moves
}

function floodedPathMove(state, inv, api) {
  const location = locationById(state, inv.location)
  if (!location || cardCodeOf(location) !== '10596a' || location.revealed === false) return false
  const destinations = (location.connections || []).filter(id => locationById(state, id))
  if (!destinations.length) return false
  let target = destinations[0]
  if (destinations.length > 1 && typeof api.choose === 'function') {
    const picked = api.choose({
      kind: 'location', source: '10596a', seat: inv.seat,
      prompt: '泛滥道路：选择移动的目的地。',
      options: destinations.map(id => ({ id, label: locationName(state, id) })),
    })
    if (destinations.includes(picked)) target = picked
  }
  addSinkholes(state, location, 1, api)
  if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, target)
  else inv.location = target
  info(api, `${inv.name} 在泛滥道路踩出一个渗坑，移动到「${locationName(state, target)}」。`)
  return true
}

function abandonedShackDrain(state, inv, api) {
  const location = locationById(state, inv.location)
  if (!location || cardCodeOf(location) !== '10597a' || shackUsedThisRound(state)) return false
  if ((Number(location.damage) || 0) < 1 || (Number(inv.clues) || 0) < 1) return false
  const candidates = enemiesAt(state, location.id)
  if (!candidates.length) return false
  let target = candidates[0]
  if (candidates.length > 1 && typeof api.choose === 'function') {
    const picked = api.choose({
      kind: 'enemy', source: '10597a', seat: inv.seat,
      prompt: '废弃棚屋：选择承受 1 点伤害的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    target = candidates.find(enemy => enemy.id === picked) || target
  }
  if (typeof api.spendClues === 'function') api.spendClues(inv.seat, 1)
  else inv.clues = Math.max(0, (Number(inv.clues) || 0) - 1)
  location.damage = Math.max(0, (Number(location.damage) || 0) - 1)
  if (typeof api.damageEnemy === 'function') api.damageEnemy(target.id, 1, inv.seat, { code: '10597a' })
  else target.damageTaken = (Number(target.damageTaken) || 0) + 1
  setFlag(state, 'depthsShackRound', Number(state.round))
  info(api, `废弃棚屋：${inv.name} 花费 1 个线索，把 1 个渗坑移到「${target.name}」身上。`)
  return true
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule === 'depthsFloodedPathMove') return floodedPathMove(state, inv, api)
  if (move.rule === 'depthsAbandonedShackDrain') return abandonedShackDrain(state, inv, api)
  if (move.rule === 'depthsChangeHybridPatrol') return changeHybridPatrol(state, inv, api)
  return false
}

export function fastActions(state, inv) {
  const hybrid = enemyByCode(state, CHELYDRAN_HYBRID_CODE)
  const location = locationById(state, inv?.location)
  if (!location || cardCodeOf(currentAct(state)) !== ACT_CODES[1] || !hybrid
    || !(locationById(state, hybrid.location)?.connections || []).includes(location.id)) return []
  const required = investigatorCount(state)
  const clues = activeInvestigators(state).filter(other => other.location === location.id)
    .reduce((total, other) => total + (other.clues || 0), 0)
  if (clues < required) return []
  return [{ action: 'scenarioAction', rule: 'depthsChangeHybridPatrol', actions: 0,
    label: `共同花费 ${required} 个线索：本轮把鳄龟混种的巡逻地点改为「${location.name}」` }]
}

function hybridPatrolOverride(state) {
  const override = flagsFor(state).depthsHybridPatrol
  return override && Number(override.round) === Number(state.round) ? override : null
}

function changeHybridPatrol(state, inv, api) {
  const hybrid = enemyByCode(state, CHELYDRAN_HYBRID_CODE)
  const location = locationById(state, inv.location)
  if (!hybrid || !location || cardCodeOf(currentAct(state)) !== ACT_CODES[1]) return false
  if (!(locationById(state, hybrid.location)?.connections || []).includes(location.id)) return false
  const required = investigatorCount(state)
  const payers = activeInvestigators(state).filter(other => other.location === location.id
    && api.canSpendClues?.(other.seat) !== false)
  if (payers.reduce((total, other) => total + (other.clues || 0), 0) < required) return false
  if (typeof api.payGroupClues === 'function') api.payGroupClues(required, { atLocation: location.id, seat: inv.seat })
  else {
    let remaining = required
    for (const payer of payers) {
      const amount = Math.min(payer.clues || 0, remaining)
      payer.clues -= amount
      remaining -= amount
    }
  }
  setFlag(state, 'depthsHybridPatrol', { location: location.id, round: Number(state.round) })
  info(api, `本轮鳄龟混种的巡逻地点改为「${location.name}」。`)
  return true
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
function spawnDepthsEnemy(state, code, locationId, api = {}, options = {}) {
  const wanted = String(code)
  if (options.unique) {
    const existing = (state.enemies || []).find(enemy => cardCodeOf(enemy) === wanted && !enemy.defeated)
    if (existing) return existing
  }
  removeFromSetAside(state, wanted)
  if (typeof api.spawn === 'function') {
    const spawned = api.spawn(wanted, locationId, options)
    if (spawned) return spawned
  }
  const def = state.scenario?.enemies?.[wanted] || ALL_CARDS[wanted] || {}
  const perInvestigator = def.healthPerInvestigator ? Number(def.health) * investigatorCount(state) : null
  const enemy = {
    id: `depths-${wanted}-${nextEnemySerial(state)}`, code: wanted, originalCode: wanted,
    name: def.nameZh || def.name || wanted, location: locationId || null,
    fight: def.fight ?? 0, evade: def.evade ?? 0,
    health: perInvestigator ?? (def.health ?? 1),
    damage: def.damage || 0, horror: def.horror || 0,
    traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
    ...(def.elite ? { elite: true } : {}),
    ...(def.hunter ? { hunter: true } : {}),
    ...(def.retaliate ? { retaliate: true } : {}),
    ...(def.aloof ? { aloof: true } : {}),
    ...(def.massive ? { massive: true } : {}),
    ...(def.elusive ? { elusive: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  info(api, `「${enemy.name}」在「${locationName(state, locationId)}」生成。`)
  return enemy
}

function nextEnemySerial(state) {
  const flags = flagsFor(state)
  flags.depthsEnemySeq = (Number(flags.depthsEnemySeq) || 0) + 1
  return flags.depthsEnemySeq
}

function removeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

/** 鳄龟混种：其地点有重整的[[异形]]敌人、或它与调查员交战时不能移动（引擎 immobile 读点）。 */
export function refreshHybridImmovable(state, enemy = null) {
  const hybrids = enemy ? [enemy] : (state.enemies || []).filter(item => cardCodeOf(item) === CHELYDRAN_HYBRID_CODE)
  let changed = 0
  for (const hybrid of hybrids) {
    if (!hybrid || hybrid.defeated) continue
    const readyAbomination = (state.enemies || []).some(other => other !== hybrid && other && !other.defeated
      && other.location === hybrid.location && !other.exhausted && hasTrait(other, 'Abomination'))
    const engaged = hybrid.engagedSeat != null
    const next = Boolean(readyAbomination || engaged)
    if (Boolean(hybrid.immobile) !== next) changed += 1
    hybrid.immobile = next
  }
  return changed
}

export function patrolTarget(state, enemy, printed) {
  if (cardCodeOf(enemy) !== CHELYDRAN_HYBRID_CODE) return printed
  const override = hybridPatrolOverride(state)
  return override ? { kind: 'named', locationId: override.location } : printed
}

function pathStepToward(state, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null
  const parent = new Map([[fromId, null]])
  const queue = [fromId]
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]
    if (id === toId) break
    for (const next of locationById(state, id)?.connections || []) {
      if (parent.has(next) || !locationById(state, next)) continue
      parent.set(next, id)
      queue.push(next)
    }
  }
  if (!parent.has(toId)) return null
  let step = toId
  while (parent.get(step) !== fromId) {
    step = parent.get(step)
    if (step == null) return null
  }
  return step
}

/** 敌军阶段结束：鳄龟混种所在地点每有 1 个重整的[[异形]]敌人，它受到 1 点伤害。 */
export function enemyPhaseEnd(state, api = {}) {
  const hybrid = enemyByCode(state, CHELYDRAN_HYBRID_CODE)
  if (!hybrid) return false
  const ready = (state.enemies || []).filter(enemy => enemy && !enemy.defeated
    && enemy.location === hybrid.location && !enemy.exhausted && hasTrait(enemy, 'Abomination')).length
  if (!ready) return false
  if (typeof api.damageEnemy === 'function') api.damageEnemy(hybrid.id, ready, null, { code: CHELYDRAN_HYBRID_CODE })
  else hybrid.damageTaken = (Number(hybrid.damageTaken) || 0) + ready
  info(api, `敌军阶段结束：鳄龟混种所在地点有 ${ready} 个重整的[[异形]]敌人，它受到 ${ready} 点伤害。`)
  return true
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  const code = cardCodeOf(enemy)
  if (code === GRASPING_TENDRIL_CODE) {
    // 「(黑夜[night])冷漠」：只在夜晚获得冷漠（对齐 Haskell ScenarioModifierKeyword "time"）。
    enemy.aloof = isNight(state)
    info(api, `「${enemy.name}」的冷漠${enemy.aloof ? '生效（黑夜）' : '不生效（白天）'}。`)
  }
  if (code === CHELYDRAN_HYBRID_CODE) refreshHybridImmovable(state, enemy)
}

export function enemyAttackResolved(state, enemy, inv, api = {}) {
  const amount = flagsOf(cardCodeOf(enemy)).healAfterAttackingAtBog
  if (amount && hasTrait(locationById(state, enemy.location), BOG_TRAIT) && !api.enemyTextBlanked?.(enemy)) {
    api.healEnemy?.(enemy, amount)
  }
}

export function enemyMoved(state, enemy, previous) {
  if (!enemy || enemy.location === previous) return
  if (cardCodeOf(enemy) === CHELYDRAN_HYBRID_CODE) refreshHybridImmovable(state, enemy)
}

export function enemyEngaged(state, enemy) {
  if (enemy && cardCodeOf(enemy) === CHELYDRAN_HYBRID_CODE) refreshHybridImmovable(state, enemy)
}

export function enemyPhaseStart(state) {
  refreshHybridImmovable(state)
}

/** 敌人健康值：深沼之物 +5[per_investigator]；攫噬触须 X = 当前天数（印刷值 -2 是占位）。 */
export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || stat !== 'health') return 0
  const code = cardCodeOf(enemy)
  if (code === THING_IN_THE_DEPTHS_CODE) return 5 * investigatorCount(state)
  if (code === GRASPING_TENDRIL_CODE) return dayNumber(state) - (Number(enemy.health) || 0)
  return 0
}

/** 深沼之物移动时，其地点视为与每个[[沉没]]地点连接（引擎 enemyConnections 读点）。 */
export function enemyConnections(state, enemy, location) {
  if (!enemy || cardCodeOf(enemy) !== THING_IN_THE_DEPTHS_CODE || !location) return []
  return (state.locations || [])
    .filter(other => other.id !== location.id && hasTrait(other, SUNKEN_TRAIT))
    .map(other => other.id)
}

/** 攫噬触须的生成地点：鳄龟混种所在地点（Haskell setSpawnAt）。 */
export function spawnLocation(state, code, loc, engagedSeat, api = {}) {
  void engagedSeat
  void api
  if (String(code) !== GRASPING_TENDRIL_CODE) return loc
  const hybrid = enemyByCode(state, CHELYDRAN_HYBRID_CODE)
  return hybrid?.location || loc
}

/** 深沼之物不能进行趁机攻击（引擎 enemyCanOpportunityAttack 读点）。 */
export function canOpportunityAttack(state, enemy) {
  void state
  return cardCodeOf(enemy) !== THING_IN_THE_DEPTHS_CODE
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  const code = cardCodeOf(enemy)
  if (code === CHELYDRAN_HYBRID_CODE) {
    info(api, '鳄龟混种被击败：结局 3（它被深沼之物吞食）。')
    if (typeof api.finish === 'function') api.finish('resolution3')
    else state.resolution = 'resolution3'
  } else if (code === THING_IN_THE_DEPTHS_CODE) {
    info(api, '深沼之物被击败：结局 4。')
    if (typeof api.finish === 'function') api.finish('resolution4')
    else state.resolution = 'resolution4'
  }
  return false
}

// ---------------------------------------------------------------------------
// 回合 / 轮末强制效果
// ---------------------------------------------------------------------------
function currentAgenda(state) {
  return (state.agendas || [])[state.agendaIndex || 0] || null
}

function currentAct(state) {
  return (state.acts || [])[state.actIndex || 0] || null
}

export function sinkingAgendaActive(state) {
  const agenda = currentAgenda(state)
  if (!agenda) return false
  return AGENDA_CODES.includes(cardCodeOf(agenda))
}

/** 撤退只属于议程 1 正面；议程推进后关掉（state.scenario.resignAnywhere 是引擎读点）。 */
export function syncResignAvailability(state) {
  if (!state?.scenario) return false
  const agenda = currentAgenda(state)
  const available = cardCodeOf(agenda) === AGENDA_CODES[0]
  state.scenario.resignAnywhere = available
  return available
}

/** 议程 1/2 正面强制：你的回合结束时，若你在[[沼地]]地点，放 1 个渗坑（1–2 人局改为 2 个）。 */
export function turnEnded(state, inv, api = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  if (!sinkingAgendaActive(state)) return false
  const location = locationById(state, inv.location)
  if (!location || !hasTrait(location, BOG_TRAIT)) return false
  const count = investigatorCount(state) <= 2 ? 2 : 1
  addSinkholes(state, location, count, api)
  info(api, `${inv.name} 的回合结束于「${location.name}」：放置 ${count} 个渗坑。`)
  return true
}

export function roundEnded(state, api = {}) {
  sinkLocationsAtThreshold(state, api)
  syncResignAvailability(state)
}

/** 幕 2 目标：一轮结束时鳄龟混种在起始地点 → 立即推进（objective 的「一轮结束时」读 _roundEndWindow）。 */
export function checkObjectives(state, api = {}) {
  let acted = false
  const act = currentAct(state)
  if (cardCodeOf(act) === ACT_CODES[1]) {
    const hybrid = enemyByCode(state, CHELYDRAN_HYBRID_CODE)
    const startId = flagsFor(state).depthsSlots?.[START_SLOT]
    if (hybrid && startId && hybrid.location === startId && state._roundEndWindow === true) {
      info(api, '一轮结束：鳄龟混种在起始地点，幕 2 立即推进。')
      if (typeof api.advanceAct === 'function') api.advanceAct()
      acted = true
    }
  }
  const flipped = sinkLocationsAtThreshold(state, api)
  syncResignAvailability(state)
  return acted || flipped > 0
}

// ---------------------------------------------------------------------------
// 幕 / 议程背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = cardCodeOf(act)
  const flags = flagsFor(state)
  if (code === ACT_CODES[0]) {
    const northShore = flags.depthsSlots?.northShore
    spawnDepthsEnemy(state, CHELYDRAN_HYBRID_CODE, northShore, api, { unique: true })
    const neighbors = (locationById(state, northShore)?.connections || []).filter(id => locationById(state, id))
    let target = neighbors[0] || northShore
    if (neighbors.length > 1 && typeof api.choose === 'function') {
      const picked = api.choose({
        kind: 'location', source: ACT_CODES[0], seat: leadSeat(state),
        prompt: '选择一个与鳄龟混种所在地点相邻的地点，生成 1 个攫噬触须。',
        options: neighbors.map(id => ({ id, label: locationName(state, id) })),
      })
      if (neighbors.includes(picked)) target = picked
    }
    // 生成时 spawnDepthsEnemy 会从放一边区域取走 1 张；其余仍放一边的与遭遇弃牌堆一起洗回牌库。
    spawnDepthsEnemy(state, GRASPING_TENDRIL_CODE, target, api)
    const rest = []
    while (removeFromSetAside(state, GRASPING_TENDRIL_CODE)) rest.push(GRASPING_TENDRIL_CODE)
    if (rest.length) {
      if (typeof api.shuffleIntoEncounterDeck === 'function') api.shuffleIntoEncounterDeck(rest)
      else state.encounterDeck = [...(state.encounterDeck || []), ...rest]
    }
    if (typeof api.shuffleDiscard === 'function') api.shuffleDiscard()
    info(api, `幕 1 背面：鳄龟混种在北岸生成；1 个攫噬触须在相邻地点生成，其余 ${rest.length} 个与遭遇弃牌堆一起洗回遭遇牌库。`)
    return true
  }
  if (code === ACT_CODES[1]) {
    const clock = hemlockClock(state)
    const key = clock.day === 1 ? 'resolution2' : 'resolution1'
    info(api, `幕 2 背面：${clock.day === 1 ? '第一日' : '不是第一日'} → 结局 ${key.slice(-1)}。`)
    if (typeof api.finish === 'function') api.finish(key)
    else state.resolution = key
    return true
  }
  return false
}

function defeatRemainingInvestigators(state, api) {
  let defeated = 0
  for (const inv of activeInvestigators(state)) {
    safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
    if (typeof api.addTrauma !== 'function') {
      inv.physicalTrauma = (Number(inv.physicalTrauma) || 0) + 1
    }
    if (typeof api.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat, { cause: 'agenda' })
    else inv.defeated = true
    defeated += 1
  }
  return defeated
}

export function agendaReveal(state, agenda, api = {}) {
  const code = cardCodeOf(agenda)
  const flags = flagsFor(state)
  if (code === AGENDA_CODES[0]) {
    const centerId = flags.depthsSlots?.[CENTER_SLOT] || null
    const center = locationById(state, centerId)
    if (center) forceSinkLocation(state, center, api, { discardClues: true })
    spawnDepthsEnemy(state, THING_IN_THE_DEPTHS_CODE, centerId, api, { unique: true })
    info(api, '议程 1 背面（险些中伏）：中央地点翻至沉没面（弃掉全部标记与玩家附属），深沼之物在中央地点生成。')
    return true
  }
  if (code === AGENDA_CODES[1]) {
    const defeated = defeatRemainingInvestigators(state, api)
    info(api, `议程 2 背面（险成一餐）：${defeated} 位幸存的调查员被击败并各承受 1 点肉体创伤。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return thingInTheDepthsChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return thingInTheDepthsChaosTokenValue(state, tokenFace, inv)
}

function removeSinkhole(state, inv, api) {
  const candidates = nearestBogLocations(state, inv.location)
    .filter(location => (Number(location.damage) || 0) > 0)
  if (!candidates.length) {
    info(api, '[标记]：最近的[[沼地]]地点没有渗坑。')
    return false
  }
  const target = chooseLocation(api, inv.seat, candidates,
    '[标记]：你可以从最近的[[沼地]]地点移除 1 个渗坑。', { canSkip: true })
  if (!target) return false
  target.damage = Math.max(0, (Number(target.damage) || 0) - 1)
  info(api, `[标记]：从「${target.name}」移除 1 个渗坑（剩 ${target.damage}）。`)
  return true
}

function placeNearestSinkhole(state, inv, api) {
  const target = chooseLocation(api, inv.seat, nearestBogLocations(state, inv.location),
    '[标记]：在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。')
  if (!target) return false
  addSinkholes(state, target, 1, api)
  info(api, `[标记]：在「${target.name}」放置 1 个渗坑（共 ${Number(target.damage) || 0} 个）。`)
  return true
}

/** 查找遭遇牌库/弃牌堆里的攫噬触须并「抽取」：直接生成以忽略涌动（见文件头近似说明）。 */
export function searchGraspingTendril(state, inv, api = {}) {
  const inDeck = (state.encounterDeck || []).lastIndexOf(GRASPING_TENDRIL_CODE)
  const inDiscard = (state.encounterDiscard || []).lastIndexOf(GRASPING_TENDRIL_CODE)
  if (inDeck < 0 && inDiscard < 0) {
    info(api, '[标记]：遭遇牌库与遭遇弃牌堆都没有攫噬触须。')
    return false
  }
  if (typeof api.takeEncounterCard === 'function') {
    if (!api.takeEncounterCard(GRASPING_TENDRIL_CODE)) return false
  } else if (inDeck >= 0) {
    state.encounterDeck.splice(inDeck, 1)
  } else {
    state.encounterDiscard.splice(inDiscard, 1)
  }
  const destination = spawnLocation(state, GRASPING_TENDRIL_CODE, inv.location, null, api) || inv.location
  spawnDepthsEnemy(state, GRASPING_TENDRIL_CODE, destination, api)
  info(api, `[标记]：找出攫噬触须并在「${locationName(state, destination)}」生成（忽略涌动）。`)
  return true
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  const mode = String(effect.mode || '')
  if (effect.token === 'cultist' || mode.includes('mayRemoveSinkhole')) return removeSinkhole(state, inv, api)
  if (effect.token === 'tablet' || mode.includes('placeSinkhole')) return placeNearestSinkhole(state, inv, api)
  if (effect.token === 'elderthing' || mode.includes('searchTendril')) return searchGraspingTendril(state, inv, api)
  return false
}

// ---------------------------------------------------------------------------
// 检定后（困难/专家 [cultist] 的成功效果 + 廊桥）
// ---------------------------------------------------------------------------
function tokenFaces(resolvedTokens) {
  return (resolvedTokens || []).map(token => (typeof token === 'string' ? token : token?.face || token?.token || ''))
}

export function afterTest(state, inv, result, api = {}, context = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  const tokens = tokenFaces(context?.resolvedTokens)
  let handled = false
  // 困难/专家 [cultist]：检定成功时你可以移除 1 个渗坑（没有 onSuccess 通道，在 afterTest 结算）。
  if (isHardSide(state) && result?.success && tokens.includes('cultist')) {
    handled = removeSinkhole(state, inv, api) || handled
  }
  // 廊桥：调查本地点时揭示符号标记 → 抽取遭遇牌库顶的卡牌。
  const location = locationById(state, inv.location)
  if (location && cardCodeOf(location) === '10599a' && location.revealed !== false
    && context?.test?.actionKind === 'investigate' && tokens.some(token => SYMBOL_TOKENS.includes(token))) {
    if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
    info(api, '廊桥：调查时揭示符号标记，抽取遭遇牌库顶的卡牌。')
    handled = true
  }
  return handled
}

// ---------------------------------------------------------------------------
// 诡计显现（条目 encounterResolve → api.resolveScenarioEvent → 本文件 events）
// ---------------------------------------------------------------------------
function damageInv(state, seat, amount, api) {
  if (typeof api.damage === 'function') api.damage(seat, amount)
  else if (state.investigators?.[seat]) state.investigators[seat].damage = (Number(state.investigators[seat].damage) || 0) + amount
}

function directDamage(state, seat, amount, api) {
  if (typeof api.directDamage === 'function') api.directDamage(seat, amount)
  else damageInv(state, seat, amount, api)
}

export function groundDisturbanceResolve(state, inv, api = {}) {
  if (!inv) return false
  const skills = ['intellect', 'agility']
  let skill = skills[0]
  if (typeof api.choose === 'function') {
    const picked = api.choose({
      kind: 'skill', source: '10603', seat: inv.seat,
      prompt: '地层扰动：选择检定技能（智力或敏捷）。',
      options: [{ id: 'intellect', label: '智力 4' }, { id: 'agility', label: '敏捷 4' }],
    })
    if (skills.includes(picked)) skill = picked
  }
  const resolveFailure = failedBy => {
    for (let index = 0; index < failedBy; index++) {
      const options = [{ id: 'damage', label: '承受 1 点伤害' }]
      if (nearestBogLocations(state, inv.location).length) options.push({ id: 'sinkhole', label: '在最近的[[沼地]]地点放 1 个渗坑' })
      const choice = typeof api.choose === 'function'
        ? api.choose({ kind: 'treachery', source: '10603', seat: inv.seat,
          prompt: `地层扰动：失败 1 点，选择一项（共 ${failedBy} 次）。`, options })
        : 'damage'
      if (choice === 'sinkhole') placeNearestSinkhole(state, inv, api)
      else damageInv(state, inv.seat, 1, api)
    }
  }
  if (typeof api.test !== 'function') {
    resolveFailure(1)
    return false
  }
  api.test(inv.seat, skill, 4, result => {
    if (result?.success) return
    const failedBy = Math.max(0, (Number(result?.difficulty) || 4) - (Number(result?.value) || 0))
    if (failedBy > 0) resolveFailure(failedBy)
  }, 0, { label: '地层扰动' })
  return false
}

export function sinkingSludgeResolve(state, inv, api = {}) {
  if (!inv) return false
  const location = locationById(state, inv.location)
  if (!location) return false
  if (hasTrait(location, SUNKEN_TRAIT)) {
    directDamage(state, inv.seat, 1, api)
    for (const asset of inv.assets || []) {
      const slots = (ALL_CARDS[asset.code]?.slots || []).map(slot => String(slot).toLowerCase())
      if (!slots.includes('ally')) continue
      if (typeof api.damageAsset === 'function') api.damageAsset(inv.seat, asset.id, 1)
      else asset.damage = (Number(asset.damage) || 0) + 1
    }
    info(api, `泥泞下沉：${inv.name} 在沉没地点受到 1 点直接伤害，其盟友各受到 1 点直接伤害。`)
  }
  if (hasTrait(location, BOG_TRAIT)) {
    addSinkholes(state, location, 1, api)
    info(api, `泥泞下沉：在「${location.name}」放置 1 个渗坑。`)
  }
  return false
}

export const events = Object.freeze({
  depthsGroundDisturbance: (state, payload = {}, api = {}) =>
    groundDisturbanceResolve(state, state.investigators?.[payload.seat], api),
  depthsSinkingSludge: (state, payload = {}, api = {}) =>
    sinkingSludgeResolve(state, state.investigators?.[payload.seat], api),
})

// ---------------------------------------------------------------------------
// 法典（Codex 5 河·霍桑 / 7 朱迪丝·帕克 / Θ 罗莎·马奎兹博士）
// ---------------------------------------------------------------------------
export const CODEX_IDS = Object.freeze({ riverHawthorne: 5, judithPark: 7, drRosaMarquez: 100 })

function controlledStoryAsset(state, code) {
  return (state.storyAssets || []).find(asset => cardCodeOf(asset) === String(code)
    && asset.controllerSeat != null) || null
}

export function runCodex(state, entry, seat, api = {}) {
  const id = Number(entry)
  const actor = Number.isInteger(seat) ? seat : leadSeat(state)
  if (id === CODEX_IDS.riverHawthorne) {
    const controlled = controlledStoryAsset(state, RESIDENT_CODES.riverHawthorne)
    if (controlled) {
      // 已控制 + 在蔓越莓沼（由调用方保证地点条件）→ 关系 +1、每人 1 点奖励经验、移出游戏。
      changeResident(state, api, 'riverHawthorne', 1)
      flagsFor(state).depthsBonusXp = (Number(flagsFor(state).depthsBonusXp) || 0) + 1
      state.storyAssets = (state.storyAssets || []).filter(asset => asset !== controlled)
      info(api, '法典 5（受控）：河·霍桑关系 +1、每人 1 点奖励经验，并将河·霍桑移出游戏。')
      return true
    }
    setRecord(state, api, RECORD_KEYS.riverAskedForHelp, true)
    const asset = spawnStory(state, api, RESIDENT_CODES.riverHawthorne,
      state.investigators?.[actor]?.location || null)
      || (state.storyAssets || []).find(item => cardCodeOf(item) === RESIDENT_CODES.riverHawthorne)
    if (asset) asset.controllerSeat = actor
    info(api, '法典 5：记录「River asked for help」并接管河·霍桑（在蔓越莓沼可再次触发）。')
    return true
  }
  if (id === CODEX_IDS.judithPark) {
    const grudge = recordOf(state, RECORD_KEYS.judithSharedAGrudge) === true
    if (grudge) {
      const candidates = (state.enemies || []).filter(enemy => enemy && !enemy.defeated && !enemy.elite)
      if (candidates.length) {
        const picked = typeof api.choose === 'function'
          ? api.choose({
            kind: 'enemy', source: RESIDENT_CODES.judithPark, seat: actor,
            prompt: '法典 7：选择一个非[[精英]]敌人并击败它。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          : null
        const target = candidates.find(enemy => enemy.id === picked) || candidates[0]
        if (typeof api.defeatEnemy === 'function') api.defeatEnemy(target, { source: RESIDENT_CODES.judithPark })
        else target.defeated = true
        info(api, `法典 7：击败「${target.name}」。`)
      }
    }
    const asset = spawnStory(state, api, RESIDENT_CODES.judithPark,
      state.investigators?.[actor]?.location || null)
      || (state.storyAssets || []).find(item => cardCodeOf(item) === RESIDENT_CODES.judithPark)
    if (asset) asset.controllerSeat = actor
    info(api, `法典 7：接管朱迪丝·帕克（${grudge ? '有旧怨' : '无旧怨'}）。`)
    return true
  }
  if (id === CODEX_IDS.drRosaMarquez) {
    const candidates = (state.locations || []).filter(location => location.revealed !== false)
    if (!candidates.length) return false
    let target = candidates[0]
    if (typeof api.choose === 'function') {
      const picked = api.choose({
        kind: 'location', source: RESIDENT_CODES.drRosaMarquez, seat: actor,
        prompt: '法典 Θ：选择任意一个在场地点。',
        options: candidates.map(location => ({ id: location.id, label: location.name })),
      })
      target = candidates.find(location => location.id === picked) || target
    }
    if (hasTrait(target, BOG_TRAIT)) {
      target.damage = 0
      info(api, `法典 Θ：移除「${target.name}」上的全部渗坑。`)
    } else if (hasTrait(target, SUNKEN_TRAIT)) {
      // 近似：引擎没有「翻回 Bog 面」的原语；用 replacePrintedLocationFace 只换印刷面，保留标记与附属。
      const face = printedLocationFace(definitionOf(state, target.id))
      if (face && replacePrintedLocationFace(target, face)) {
        target.damage = 0
        info(api, `法典 Θ：「${target.name}」翻回 Bog 面（保留标记与附属）。`)
      }
    }
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
function victoryXp(state) {
  return (state.victoryDisplay || []).reduce((sum, card) => sum + (Number(card?.victory) || 0), 0)
}

function thingInVictory(state) {
  return (state.victoryDisplay || []).some(card => String(card?.code || card?.originalCode) === THING_IN_THE_DEPTHS_CODE)
}

function addAreaSurveyed(state, api) {
  const added = safeCall(api?.mechanics?.recordSets, 'add', RECORD_KEYS.areasSurveyed, RECORD_KEYS.eastwickBog)
  if (added != null) return added
  const records = recordsFor(state)
  const list = Array.isArray(records[RECORD_KEYS.areasSurveyed]) ? records[RECORD_KEYS.areasSurveyed] : []
  if (!list.includes(RECORD_KEYS.eastwickBog)) list.push(RECORD_KEYS.eastwickBog)
  records[RECORD_KEYS.areasSurveyed] = list
  return true
}

function applyResolutionFive(state, api = {}) {
  let bonus = 0
  if (recordOf(state, RECORD_KEYS.riverAskedForHelp) === true) {
    changeResident(state, api, 'riverHawthorne', -1)
    info(api, '结局 5：河·霍桑关系 -1（River asked for help）。')
  }
  if (recordOf(state, RECORD_KEYS.judithSharedAGrudge) === true && thingInVictory(state)) {
    changeResident(state, api, 'judithPark', 1)
    bonus += 1
    info(api, '结局 5：深沼之物在胜利区且朱迪丝有旧怨 → 朱迪丝关系 +1、每人 1 点奖励经验。')
  }
  bonus += victoryXp(state)
  addAreaSurveyed(state, api)
  info(api, `结局 5：胜利区经验 ${victoryXp(state)}；在东威克沼（Eastwick Bog）完成勘察。`)
  return bonus
}

export function resolution(state, key, events = [], api = {}) {
  void events
  let finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : NO_RESOLUTION
  const records = recordsFor(state)
  let bonus = Number(flagsFor(state).depthsBonusXp) || 0
  if (finalKey === NO_RESOLUTION) {
    info(api, '无结局（所有调查员被击败）：每人 1 点奖励经验，跳至结局 5。')
    bonus += 1
  } else if (finalKey === 'resolution1') {
    setRecord(state, api, RECORD_KEYS.chelydranHybridPerished, true)
    bonus += 1
  } else if (finalKey === 'resolution2') {
    setRecord(state, api, RECORD_KEYS.chelydranHybridLived, true)
    bonus += 3
  } else if (finalKey === 'resolution3') {
    setRecord(state, api, RECORD_KEYS.chelydranHybridWasDevoured, true)
    for (const inv of state.investigators || []) safeCall(api, 'addTrauma', inv.seat, 'mental', 1)
    bonus += 1
  } else if (finalKey === 'resolution4') {
    setRecord(state, api, RECORD_KEYS.thingInTheDepthsWasDefeated, true)
  }
  if (finalKey === 'resolution3') info(api, '结局 3：每位调查员承受 1 点精神创伤。')
  bonus += applyResolutionFive(state, api)
  records[RECORD_KEYS.resolution] = finalKey
  records[RECORD_KEYS.bonusXp] = bonus
  info(api, `深沼之物结算（${finalKey}）：奖励经验 ${bonus}。`)
  return { award: true, bonus, resolution: finalKey }
}

export function scenarioResolution(state, resolutionKey = 'resolution1', api = {}) {
  resolution(state, resolutionKey, [], api)
  const records = recordsFor(state)
  return {
    resolution: records[RECORD_KEYS.resolution],
    bonusXp: records[RECORD_KEYS.bonusXp] ?? 0,
    areasSurveyed: [...(records[RECORD_KEYS.areasSurveyed] || [])],
    judith: residentLevel(state, 'judithPark'),
    river: residentLevel(state, 'riverHawthorne'),
  }
}

// ---------------------------------------------------------------------------
// 行为装配
// ---------------------------------------------------------------------------
export const implementedEncounterCodes = Object.freeze([
  ...Object.values(ACT_CODES), ...Object.values(AGENDA_CODES),
  THING_IN_THE_DEPTHS_CODE, CHELYDRAN_HYBRID_CODE, GRASPING_TENDRIL_CODE, '10603', '10604',
])

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  roundEndActIndex: 0,
  startLocation,
  preScenarioSetup,
  setupLocations,
  setupEnemies,
  setupScenario,
  placeSetupLocations,
  afterDeckSetup,
  locationPlaced,
  locationShroudModifier,
  moveError,
  beforeMove,
  locationEntered,
  afterInvestigate,
  enemySpawned,
  enemyAttackResolved,
  enemyMoved,
  enemyEngaged,
  enemyPhaseStart,
  patrolTarget,
  enemyPhaseEnd,
  enemyStatModifier,
  enemyConnections,
  spawnLocation,
  canOpportunityAttack,
  enemyDefeated,
  turnEnded,
  roundEnded,
  checkObjectives,
  actReveal,
  agendaReveal,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  afterTest,
  actions,
  fastActions,
  performAction,
  events,
  resolution,
  scenarioResolution,
  // 供测试/主进程直接调用（与引擎钩子同源）。
  hemlockClock,
  dayNumber,
  isNight,
  introBranchFor,
  planLocations,
  applyLocationPlan,
  syncPlanConnections,
  nearestBogLocations,
  distancesFrom,
  addSinkholes,
  sinkLocationsAtThreshold,
  forceSinkLocation,
  sunkenCount,
  spawnDepthsEnemy,
  searchGraspingTendril,
  refreshHybridImmovable,
  placeResidents,
  placeTimeMarker,
  syncResignAvailability,
  sinkingAgendaActive,
  runCodex,
  groundDisturbanceResolve,
  sinkingSludgeResolve,
  CODEX_IDS,
  setRecord,
  changeResident,
  residentLevel,
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export { RECORD_KEYS, RECORD_READS, RESIDENT_RECORDS, SET_ASIDE_CARDS, ENCOUNTER_DECK, GRID_SLOTS, SLOT_LABELS, DAY_ENCOUNTER_GROUPS, DAY_STORY_CODES, GRASPING_TENDRIL_CODE, THING_IN_THE_DEPTHS_CODE, CHELYDRAN_HYBRID_CODE, START_SLOT, CENTER_SLOT, SINKHOLE_THRESHOLD, flagIs }
