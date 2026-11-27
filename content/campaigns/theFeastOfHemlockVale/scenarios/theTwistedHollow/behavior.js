// 扭曲空洞（theTwistedHollow · 10605）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheTwistedHollow.hs +
//       Scenarios/TheFeastOfHemlockVale/TheTwistedHollow/Helpers.hs（pursuitEnemiesWith* /
//       placeValeLanternAtNearestLocation / drawEnemyFromPursuit / getDarknessLevel）+
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheFeastOfHemlockVale/TheTwistedHollow/*.hs +
//       Asset/Assets/ValeLantern{BeaconOfHope,AFaintHope}.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/theTwistedHollow.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation → 起始格（荧光草地；「迷失方向」分支由 setupLocations 换成随机西部树林）
//   preScenarioSetup → 引言二选一（说实话/说谎）与战役记录、混乱袋标记
//   setupLocations / locationPlaced / afterDeckSetup → 树林牌库（独立地点牌库）、放一边、
//     山谷提灯、罗莎·马奎兹、黑暗等级 1
//   locationRevealed → 议程 1 正面「地点揭示后：在上下左右放树林牌库顶地点」+
//     各地点自己的揭示强制效果
//   phaseBegan('enemy') → 议程 1 正面「调查阶段结束时」的追击/恐惧二选一
//   actions / performAction → [fast] 查看相邻地点（幕 2 / 特殊议程）、扭曲小路、荧光草地治愈
//   locationShroudModifier / enemyStatModifier / enemySpawned / enemyMoved /
//     enemyAttackStarted / enemyAttackResolved / enemyDefeated
//   actReveal / agendaReveal / checkObjectives / allResigned → 幕/议程正面与背面
//   investigateResult → 尸林「成功调查后受到 1 点恐惧」
//   resolveChaosToken / applyTokenEffect / afterTest → 10605 混乱标记
//   resolution → 结局 1/2/3/无结局/单人模式与战役记录
//
// 状态口径（全部是纯 JSON，随存档往返）：
//   · scenarioFlags.twistedHollowWoods = { deck: [地点 id…], discard: [] }（牌库顶在末尾）
//   · scenarioFlags.twistedHollowGrid = { 地点 id: {x,y} }（运行期网格；连接由相邻格重算）
//   · scenarioFlags.twistedHollowDarkness = 当前黑暗等级（见 chaos.js）
//   · scenarioFlags.twistedHollowLantern = { id, code, lit, location, controllerSeat }
//   · 追击区域用引擎既有的 out-of-play 敌区 `api.enemyZones.enter(enemy, 'pursuit')`
//     （enemy-zones.js 的通用原语；追击中的敌人不在 state.enemies 里）。
//
// 无法精确表达的子句（已在条目 note 与本文件注释披露）：
//   · 困难面 [cultist]「检定成功才治愈」没有 onSuccess 通道 → afterTest 结算；
//   · 幕 1 正面「没有生成指示的敌人获得生成-追击」→ enemySpawned 里把它们移入追击区域
//     （净效果相同，入场动画/涌动窗口可能已结算；来自追击区域的生成有防循环标记）；
//   · 类熊混种「将被击败时改为追击」没有 cancelDefeat 原语 → enemyDefeated 返回 replaced
//     并在里面治愈+移入追击；
//   · 山谷提灯用剧情资产 + lantern 记录表达（引擎没有双面剧情资产实例的通用翻面读点）；
//   · 月光空地「敌人移动时其地点视为与本地点连接」没有读点 → 未接线（见该地点条目 note）；
//   · 扭曲小路「发现线索后查看相邻地点」做成每回合一次的免费行动（引擎没有该反应窗口）；
//   · 特殊议程背面「弃遭遇牌直到敌人并在最近黑暗地点生成」→ 没有引擎抽牌管线时用本地
//     敌人构造兜底（有 api.spawn 时走引擎生成）；
//   · 幕 2「找到伯蒂」由扭曲空洞地点目标（轮末支付线索）结算，不做叙事触发。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  ACT_CODES, AGENDA_CODES, SPECIAL_AGENDA_CODE, URSINE_HYBRID_CODE, LANTERN_SPEC, LANTERN_CODES,
  LOCATIONS, WESTERN_WOODS_IDS, TWISTED_HOLLOW_LOCATION_ID, GLIMMERING_WOODS_ID,
  ACT_STAGES, SPECIAL_ACT_STAGE, STAGE_CARDS, BERTIE_CODE, DR_MARQUEZ_CODE, JUDITH_CODE, THEO_CODE,
  DIRECTION_VECTORS, START_SLOT, ACT2_GRID_OFFSETS, SET_ASIDE_CARDS, SET_ASIDE_LOCATIONS,
} from './definition.js'
import {
  darknessLevel, setDarknessLevel, raiseDarkness, isFinalDarkness, isHardSide,
  twistedHollowChaosToken, twistedHollowChaosTokenValue, INITIAL_DARKNESS,
} from './chaos.js'

const CHAPTER_ID = 'theTwistedHollow'
const NO_RESOLUTION = 'noResolution'
const RESOLUTION_KEYS = ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'standalone']
// 追击区域 zone id（enemy-zones.js 允许的纯小写标识）。
export const PURSUIT_ZONE = 'pursuit'
const WOODS_FLAG = 'twistedHollowWoods'
const GRID_FLAG = 'twistedHollowGrid'
const PLAN_FLAG = 'twistedHollowPlan'
const PREPARED_FLAG = 'twistedHollowPrepared'
const INTRO_FLAG = 'twistedHollowIntro'
const START_FLAG = 'twistedHollowStart'
const LANTERN_FLAG = 'twistedHollowLantern'
const SPECIAL_AGENDA_FLAG = 'twistedHollowBackToTheVale'
const CODEX_FLAG = 'twistedHollowCodex'
const WOODS_TOP_TWO = 2
const OPENING_DIRECTIONS = ['north', 'east', 'south', 'west']
const RECORD_SHOWED_THE_WAY = 'motherRachelShowedTheWay'
const RECORD_LOST_THE_PATH = 'theInvestigatorsLostThePath'
const RECORD_INTERVENED = 'motherRachelIntervened'
const RECORD_BERTIE_RESCUED = 'bertieWasRescued'
const RECORD_BERTIE_LOST = 'bertieWasLostInTheWoods'
const RECORD_BEAR_WOUNDED = 'theBearWasWounded'
const RECORD_WESTERN_WOODS = 'areasSurveyedWesternWoods'
const RECORD_JUDITH = 'judithSavedYourAss'
const RECORD_THEO = 'theoDistractedTheBear'
const RECORD_RESOLUTION = 'theTwistedHollowResolution'
const RECORD_TIMES = 'theTwistedHollowTimes'
const RECORD_XP_BONUS = 'theTwistedHollowBonusXp'

const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
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
const clearFlag = (state, key) => { delete flagsFor(state)[key] }
const record = (state, key, value = true) => {
  const records = recordsFor(state)
  records[key] = value
  return value
}
const recordIsTrue = (state, key) => recordsFor(state)[key] === true
const recordNumber = (state, key) => Number(recordsFor(state)[key]) || 0
const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)

// 单卡条目的规则数据（flags）是唯一事实源：behavior 只按条目声明分派。
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true
const codeOf = value => String(value?.originalCode || value?.code || '')
const isUrsineCode = code => String(code) === URSINE_HYBRID_CODE || flagIs(code, 'ursineHybrid')
const isStalkingCode = code => String(code) === '10625' || flagIs(code, 'stalkingHybrid')

// 洗牌只走引擎的 randomValue(state)（可重放、不自己造随机源）。
const shuffled = (state, list) => {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index--) {
    const pick = Math.floor(randomValue(state) * (index + 1))
    const swap = out[index]
    out[index] = out[pick]
    out[pick] = swap
  }
  return out
}

// ---------------------------------------------------------------------------
// 引言分支 / 战役记录
// ---------------------------------------------------------------------------

/** 引言分支：'showedTheWay' | 'lostThePath'（无记录时为 null）。 */
export function introBranch(state) {
  if (recordIsTrue(state, RECORD_LOST_THE_PATH)) return 'lostThePath'
  if (recordIsTrue(state, RECORD_SHOWED_THE_WAY)) return 'showedTheWay'
  return flagsFor(state)[INTRO_FLAG] || null
}

/** 是否「母亲瑞秋指路」（默认分支：说实话）。 */
export function showedTheWay(state) {
  return introBranch(state) !== 'lostThePath'
}

// ---------------------------------------------------------------------------
// 黑暗等级（chaos.js 的薄包装：行为层只从这里读写）
// ---------------------------------------------------------------------------

export { darknessLevel, setDarknessLevel, raiseDarkness, isFinalDarkness }

/** 地点是否带 [[黑暗]] 特性（山谷提灯「点燃」时移除其所在地点与连接地点的 Dark）。 */
export function isDarkLocation(state, location) {
  if (!location) return false
  if (!hasTrait(location, 'Dark')) return false
  const lantern = lanternRecord(state)
  // 提灯熄灭/不在场时不改变特性；只有点燃面才移除。
  if (!lantern || !lantern.lit || !lantern.location) return true
  if (location.id === lantern.location) return false
  const lanternLocation = findLocation(state, lantern.location)
  if (lantern.version === 'boon' && lanternLocation?.connections?.includes(location.id)) return false
  return true
}

export function darkLocations(state) {
  return (state.locations || []).filter(location => isDarkLocation(state, location))
}

// ---------------------------------------------------------------------------
// 网格 / 地点连接 / 树林牌库
// ---------------------------------------------------------------------------

function gridOf(state) {
  const flags = flagsFor(state)
  flags[GRID_FLAG] ||= {}
  return flags[GRID_FLAG]
}

const findLocation = (state, id) => (state.locations || []).find(location => location.id === id) || null
const slotOf = (state, id) => gridOf(state)[id] || null
const locationAt = (state, x, y) => Object.entries(gridOf(state))
  .find(([id, point]) => point.x === x && point.y === y
    && (state.locations || []).some(location => location.id === id))?.[0] || null

/** 按网格相邻（曼哈顿距离 1）重算所有在场地点的连接；这是本章连接的唯一写入口。 */
export function syncConnections(state) {
  const grid = gridOf(state)
  for (const location of state.locations || []) {
    const point = grid[location.id]
    if (!point) continue
    location.connections = Object.entries(DIRECTION_VECTORS)
      .map(([, vector]) => locationAt(state, point.x + vector.x, point.y + vector.y))
      .filter(Boolean)
  }
  return state.locations || []
}

/** 当前网格（id → {x,y} 的副本）。 */
export function gridState(state) {
  return Object.fromEntries(Object.entries(gridOf(state)).map(([id, point]) => [id, { ...point }]))
}

function woodsState(state) {
  const flags = flagsFor(state)
  const woods = flags[WOODS_FLAG]
  if (!woods || !Array.isArray(woods.deck)) return { deck: [], discard: [] }
  woods.discard ||= []
  return woods
}

/** 树林牌库张数（顶牌在数组末尾）。 */
export function woodsDeckSize(state) {
  return woodsState(state).deck.length
}

export function woodsDeckCards(state) {
  return [...woodsState(state).deck]
}

function takeAsideHollow(state) {
  if (findLocation(state, TWISTED_HOLLOW_LOCATION_ID)) return false
  const locations = state.scenarioZones?.setAsideLocations
  const index = locations?.indexOf(TWISTED_HOLLOW_LOCATION_ID) ?? -1
  if (index < 0) return takeFromSetAside(state, TWISTED_HOLLOW_LOCATION_ID)
  locations.splice(index, 1)
  return true
}

function drawWoods(state, count = 1) {
  const woods = woodsState(state)
  // 已结算法典 Σ 的旧存档可能仍把目标地点留在放一边区域。
  if (currentActCode(state) === ACT_CODES[1] && !woods.deck.includes(TWISTED_HOLLOW_LOCATION_ID)
    && takeAsideHollow(state)) {
    const bottom = woods.deck.splice(0, 3)
    woods.deck.unshift(...shuffled(state, [...bottom, TWISTED_HOLLOW_LOCATION_ID]))
  }
  const drawn = []
  for (let index = 0; index < Math.max(0, Math.floor(count)); index++) {
    const code = woods.deck.pop()
    if (!code) break
    drawn.push(code)
  }
  return drawn
}

/** 把地点放回树林牌库底（codes[0] 成为新的最底牌）。 */
function putWoodsBottom(state, codes) {
  const woods = woodsState(state)
  woods.deck.unshift(...codes)
  return woods.deck.length
}

/** 把地点洗到树林牌库顶（用于议程 1 背面：未揭示的[[黑暗]]地点 + 牌库顶 2 张洗回顶部）。 */
function shuffleWoodsTop(state, codes) {
  const woods = woodsState(state)
  woods.deck.push(...shuffled(state, codes))
  return woods.deck.length
}

function setWoodsDeck(state, codes) {
  const flags = flagsFor(state)
  flags[WOODS_FLAG] = { deck: [...codes], discard: [] }
  return flags[WOODS_FLAG]
}

/** 布置计划：随机移出 1–2 张、起始地点、树林牌库候选（只算一次）。 */
export function setupPlan(state) {
  const flags = flagsFor(state)
  if (flags[PLAN_FLAG]) return flags[PLAN_FLAG]
  const count = investigatorCount(state)
  const showed = showedTheWay(state)
  const candidates = shuffled(state, WESTERN_WOODS_IDS.filter(id => id !== GLIMMERING_WOODS_ID))
  const removeCount = count <= 2 ? 2 : 1
  const removed = candidates.slice(0, removeCount)
  let pool = candidates.slice(removeCount)
  let start = GLIMMERING_WOODS_ID
  if (showed) {
    // 荧光草地在场：其余西部树林洗成树林牌库。
    pool = [...pool]
  } else {
    // 迷失方向：随机一张西部树林作为起始地点，荧光草地再洗回树林牌库。
    start = pool.pop() ?? GLIMMERING_WOODS_ID
    pool = [...pool, GLIMMERING_WOODS_ID]
  }
  const plan = { showedTheWay: showed, investigatorCount: count, removed, start, pool }
  flags[PLAN_FLAG] = plan
  flags[START_FLAG] = start
  return plan
}

/** 引擎读点：起始地点（迷失方向分支由 setupLocations 换成随机西部树林）。 */
export function startLocation(state) {
  const flags = flagsFor(state)
  if (flags[START_FLAG]) return flags[START_FLAG]
  // 规划尚未算出时：名义起始地点是荧光草地（引擎在 preScenarioSetup 之前调用本钩子）。
  return GLIMMERING_WOODS_ID
}

/** 放置一个地点：优先走引擎 api.place（保留线索/胜利/入场窗口），无 api 时本地放置。 */
function placeNow(state, id, api = {}, options = {}) {
  const existing = findLocation(state, id)
  if (existing) return existing
  if (typeof api.place === 'function') {
    api.place(id)
    const placed = findLocation(state, id)
    if (placed) {
      if (options.revealed && placed.revealed !== true) safeCall(api, 'reveal', id)
      return placed
    }
  }
  const def = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!def) return null
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state) : (def.clues || 0))
  state.locations ||= []
  const location = {
    ...structuredClone(def), id, revealed: options.revealed === true,
    clues: options.revealed === true ? clues : 0, maxClues: clues, doom: 0,
    ...(options.revealed === true ? { tokens: 0 } : {}),
  }
  state.locations.push(location)
  syncConnections(state)
  return location
}

function assignSlot(state, id, point) {
  const grid = gridOf(state)
  grid[id] = { x: Number(point.x) || 0, y: Number(point.y) || 0 }
  syncConnections(state)
  return grid[id]
}

/** 在指定地点的四方向空槽放树林牌库顶的地点（议程 1 正面/背面的核心动作）。 */
export function placeWoodsAround(state, locationId, api = {}, options = {}) {
  const origin = slotOf(state, locationId)
  if (!origin) return []
  const directions = options.directions || OPENING_DIRECTIONS
  const placed = []
  for (const direction of directions) {
    const vector = DIRECTION_VECTORS[direction]
    if (!vector) continue
    const x = origin.x + vector.x
    const y = origin.y + vector.y
    if (locationAt(state, x, y)) continue
    const [id] = drawWoods(state, 1)
    if (!id) break
    assignSlot(state, id, { x, y })
    if (placeNow(state, id, api, { revealed: false })) placed.push(id)
  }
  syncConnections(state)
  if (placed.length) {
    info(api, `树林牌库：在「${findLocation(state, locationId)?.name || locationId}」四周放置 ${placed.length} 张西部树林。`)
  }
  return placed
}

/** 幕 2 背面：把除扭曲空洞外的所有地点收回树林牌库并按示意图重放（13 个槽位）。 */
export function rebuildWoodsFromLocations(state, api = {}) {
  const keep = TWISTED_HOLLOW_LOCATION_ID
  const removed = []
  for (const location of [...(state.locations || [])]) {
    if (location.id === keep) continue
    removed.push(location.id)
    if (typeof api.remove === 'function') api.remove(location.id)
    else state.locations = (state.locations || []).filter(item => item.id !== location.id)
    delete gridOf(state)[location.id]
  }
  // 空[[黑暗]]地点本来就已经离场（不在 state.locations 里）。
  const woodsDeckCodes = [...removed, ...woodsDeckCards(state)].filter(id => id !== keep)
  if (!findLocation(state, keep)) {
    // 扭曲空洞可能在放一边区域：放到中央并揭示。
    takeAsideHollow(state)
    assignSlot(state, keep, START_SLOT)
    placeNow(state, keep, api, { revealed: true })
  } else {
    assignSlot(state, keep, START_SLOT)
  }
  setWoodsDeck(state, shuffled(state, woodsDeckCodes))
  const placed = []
  for (const offset of ACT2_GRID_OFFSETS) {
    const [id] = drawWoods(state, 1)
    if (!id) break
    assignSlot(state, id, offset)
    if (placeNow(state, id, api, { revealed: false })) placed.push(id)
  }
  syncConnections(state)
  info(api, `幕 2 背面：以扭曲空洞为中心重铺 ${placed.length} 张西部树林（树林牌库余 ${woodsState(state).deck.length} 张）。`)
  return { placed, woodsCount: woodsState(state).deck.length }
}

// ---------------------------------------------------------------------------
// 追击区域（引擎 out-of-play 敌区）
// ---------------------------------------------------------------------------

function pursuitApi(api) {
  return api?.enemyZones || null
}

/** 追击中的敌人（不在 state.enemies 里）。 */
export function pursuitEnemies(state, api = {}) {
  const zones = pursuitApi(api)
  if (zones && typeof zones.list === 'function') {
    try {
      return zones.list(PURSUIT_ZONE) || []
    } catch {
      return []
    }
  }
  return []
}

/** 把敌人放进追击区域；无 enemyZones 时返回 false（调用方决定兜底）。 */
export function sendToPursuit(state, enemy, api = {}) {
  if (!enemy) return false
  const zones = pursuitApi(api)
  if (!zones || typeof zones.enter !== 'function') {
    info(api, `⚠️ 「${enemy.name || enemy.code}」无法进入追击区域（缺少敌区原语）。`)
    return false
  }
  const entered = zones.enter(enemy, PURSUIT_ZONE)
  if (entered) info(api, `「${enemy.name || enemy.code}」进入追击区域。`)
  return Boolean(entered)
}

/** 追击区域里按某项数值取最高者（同值全部返回；参考 pursuitEnemiesWith*）。 */
export function pursuitWithHighest(state, api = {}, stat = 'evade') {
  const enemies = pursuitEnemies(state, api).filter(enemy => Number.isFinite(Number(enemy?.[stat])))
  if (!enemies.length) return []
  const best = Math.max(...enemies.map(enemy => Number(enemy[stat])))
  return enemies.filter(enemy => Number(enemy[stat]) === best)
}

function pursuitWithLowest(state, api = {}, stat = 'fight') {
  const enemies = pursuitEnemies(state, api).filter(enemy => Number.isFinite(Number(enemy?.[stat])))
  if (!enemies.length) return []
  const lowest = Math.min(...enemies.map(enemy => Number(enemy[stat])))
  return enemies.filter(enemy => Number(enemy[stat]) === lowest)
}

function chooseEnemy(state, candidates, api, { prompt, seat = null }) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  let picked = candidates[0]
  if (typeof api?.choose === 'function') {
    const answer = api.choose({
      kind: 'enemy', source: CHAPTER_ID, seat: seat ?? state.currentSeat ?? 0, prompt,
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
    })
    picked = candidates.find(enemy => enemy.id === answer) || picked
  }
  return picked
}

/** 从追击区域生成一个敌人（未指定则按最高 evasion 选）。 */
export function spawnFromPursuit(state, api = {}, options = {}) {
  const stat = options.stat || 'evade'
  const candidates = options.enemies || pursuitWithHighest(state, api, stat)
  const enemy = options.enemy || chooseEnemy(state, candidates, api, {
    prompt: options.prompt || `选择一名处于追击中的敌人（${stat} 最高）。`, seat: options.seat,
  })
  if (!enemy) return null
  const locationId = options.location || state.investigators?.[options.seat ?? state.currentSeat ?? 0]?.location
  if (!locationId || !findLocation(state, locationId)) return null
  const zones = pursuitApi(api)
  const engagedSeat = options.engagedSeat ?? null
  if (zones && typeof zones.restore === 'function') {
    // 标记「这次生成来自追击区域」：幕 1 正面的 enemySpawned 分派不能把它再送回追击区域。
    setFlag(state, 'twistedHollowPursuitSpawn', String(enemy.id))
    const restored = zones.restore(PURSUIT_ZONE, enemy.id, {
      location: locationId, engageSeat: engagedSeat, exhausted: options.exhausted === true,
    })
    if (restored) info(api, `「${enemy.name || enemy.code}」从追击区域出现在「${findLocation(state, locationId)?.name || locationId}」。`)
    else clearFlag(state, 'twistedHollowPursuitSpawn')
    return restored || null
  }
  return null
}

// ---------------------------------------------------------------------------
// 山谷提灯（双面剧情资产：Lit / Unlit）
// ---------------------------------------------------------------------------

function lanternSpec(state) {
  return showedTheWay(state) ? LANTERN_SPEC.boon : LANTERN_SPEC.plain
}

/** 提灯记录（没有时返回 null）。 */
export function lanternRecord(state) {
  return flagsFor(state)[LANTERN_FLAG] || null
}

function storyAssetRecord(state, code, extra = {}) {
  state.storyAssets ||= []
  const isLanternCode = value => LANTERN_CODES.includes(String(value || ''))
  const existing = state.storyAssets.find(asset => codeOf(asset) === code
    || (isLanternCode(code) && isLanternCode(codeOf(asset))))
  if (existing) return existing
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `${CHAPTER_ID}-${code}`, code, originalCode: code,
    name: card.nameZh || card.name || code,
    location: null, controllerSeat: null, exhausted: false, ...extra,
  }
  state.storyAssets.push(asset)
  return asset
}

/** 把提灯放到一名调查员控制下（setup）。 */
export function placeLantern(state, api = {}, options = {}) {
  const spec = lanternSpec(state)
  const seat = Number.isInteger(options.seat) ? options.seat : (state.investigators?.[0]?.seat ?? 0)
  const inv = state.investigators?.[seat]
  const location = options.location || inv?.location || null
  const code = spec.lit
  let asset = null
  if (typeof api.storyAsset === 'function' && location) {
    asset = api.storyAsset(code, location)
  }
  asset ||= storyAssetRecord(state, code, { location })
  asset.code = code
  asset.originalCode = code
  asset.name = cardName(code)
  asset.lit = true
  asset.face = 'lit'
  asset.location = location
  asset.controllerSeat = seat
  asset.noSlot = investigatorCount(state) === 1
  flagsFor(state)[LANTERN_FLAG] = {
    id: asset.id, code, lit: true, face: 'lit', location, controllerSeat: seat,
    version: showedTheWay(state) ? 'boon' : 'plain',
  }
  info(api, `山谷提灯（${showedTheWay(state) ? '希望信标' : '希望微薄'}，点燃面）置于 ${inv?.name || '调查员'} 控制下。`)
  return asset
}

function moveLantern(state, asset, locationId, api = {}) {
  if (!asset) return null
  asset.location = locationId
  const recordEntry = flagsFor(state)[LANTERN_FLAG]
  if (recordEntry) recordEntry.location = locationId
  info(api, `山谷提灯移动到「${findLocation(state, locationId)?.name || locationId}」。`)
  return asset
}

/** 翻转提灯（Lit ↔ Unlit）；Unlit 面按参考实现放在最近地点。 */
export function flipLantern(state, api = {}, options = {}) {
  const recordEntry = lanternRecord(state)
  if (!recordEntry) return null
  const spec = recordEntry.version === 'boon' ? LANTERN_SPEC.boon : LANTERN_SPEC.plain
  const nextLit = options.lit !== undefined ? Boolean(options.lit) : !recordEntry.lit
  const nextCode = nextLit ? spec.lit : spec.unlit
  const asset = (state.storyAssets || []).find(item => item.id === recordEntry.id)
    || storyAssetRecord(state, nextCode, { location: recordEntry.location })
  const destination = options.location || recordEntry.location
    || nearestLocationTo(state, state.investigators?.[recordEntry.controllerSeat ?? 0]?.location)
  asset.code = nextCode
  asset.originalCode = nextCode
  asset.name = cardName(nextCode)
  asset.lit = nextLit
  asset.face = nextLit ? 'lit' : 'unlit'
  asset.exhausted = nextLit ? false : asset.exhausted
  if (!nextLit) {
    asset.controllerSeat = null
    recordEntry.controllerSeat = null
  }
  recordEntry.exhausted = asset.exhausted
  recordEntry.code = nextCode
  recordEntry.lit = nextLit
  recordEntry.face = nextLit ? 'lit' : 'unlit'
  if (destination) moveLantern(state, asset, destination, api)
  info(api, `山谷提灯翻到「${nextLit ? '点燃' : '熄灭'}」面${destination ? `，放在「${findLocation(state, destination)?.name || destination}」` : ''}。`)
  return asset
}

function nearestLocationTo(state, fromId) {
  if (fromId && findLocation(state, fromId)) return fromId
  return (state.locations || [])[0]?.id || null
}

/** 离所有调查员最远的空地点（窃取光明用）。 */
function farthestEmptyLocation(state) {
  const distances = new Map()
  const queue = activeInvestigators(state).map(inv => [inv.location, 0])
  for (const [id, distance] of queue) {
    if (!id || distances.has(id)) continue
    distances.set(id, distance)
    for (const next of findLocation(state, id)?.connections || []) if (!distances.has(next)) queue.push([next, distance + 1])
  }
  const candidates = (state.locations || []).filter(location => !(state.investigators || [])
    .some(inv => inv.location === location.id && !inv.defeated && !inv.resigned))
  if (!candidates.length) return null
  let best = null
  let bestDistance = -1
  for (const location of candidates) {
    const distance = distances.has(location.id) ? distances.get(location.id) : Number.MAX_SAFE_INTEGER
    if (distance > bestDistance) { bestDistance = distance; best = location.id }
  }
  return best
}

function nearestDarkLocation(state, fromId) {
  if (!fromId) return null
  const seen = new Set([fromId])
  const queue = [fromId]
  while (queue.length) {
    const id = queue.shift()
    const location = findLocation(state, id)
    if (location && isDarkLocation(state, location)) return id
    for (const next of location?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

function prepareScenario(state, api = {}) {
  const flags = flagsFor(state)
  state.scenarioZones ||= {}
  const plan = setupPlan(state)
  const lanternVersion = showedTheWay(state) ? LANTERN_SPEC.boon : LANTERN_SPEC.plain
  const otherVersion = showedTheWay(state) ? LANTERN_SPEC.plain : LANTERN_SPEC.boon
  const setAside = SET_ASIDE_CARDS.filter(code => ![lanternVersion.lit, lanternVersion.unlit,
    DR_MARQUEZ_CODE].includes(code))
  state.scenarioZones.setAside = [...new Set([...setAside, otherVersion.lit, otherVersion.unlit])]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATIONS]
  state.scenarioZones.removed = [...plan.removed]
  if (flags[PREPARED_FLAG]) return { plan, setAside: state.scenarioZones.setAside }
  flags[PREPARED_FLAG] = true
  setDarknessLevel(state, INITIAL_DARKNESS)
  info(api, `扭曲空洞布置：${showedTheWay(state) ? '母亲瑞秋指路（荧光草地开场）' : '调查员迷失方向'}；`
    + `移出游戏 ${plan.removed.length} 张西部树林，黑暗等级 ${darknessLevel(state)}。`)
  return { plan, setAside: state.scenarioZones.setAside }
}

/** 引擎真实入口：setup.js#setupLocations（返回要放行的地点 id）。 */
export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const { plan } = prepareScenario(state, api)
  // 起始地点 + 四方向：先排定网格，再交给引擎逐个 placeLocation（locationPlaced 里同步连接）。
  const start = plan.start || GLIMMERING_WOODS_ID
  const pool = plan.pool.filter(id => id !== start)
  const woods = shuffled(state, pool)
  assignSlot(state, start, START_SLOT)
  const placed = [start]
  for (const direction of OPENING_DIRECTIONS) {
    const vector = DIRECTION_VECTORS[direction]
    const id = woods.pop()
    if (!id) break
    assignSlot(state, id, vector)
    placed.push(id)
  }
  setWoodsDeck(state, woods)
  // 「迷失方向」分支的起始地点不是荧光草地：把已在起始格准备的调查员搬过去。
  for (const inv of state.investigators || []) {
    if (inv.location === start) continue
    if (start === GLIMMERING_WOODS_ID && inv.location === GLIMMERING_WOODS_ID) continue
    inv.location = start
  }
  info(api, `扭曲空洞：起始地点「${findLocation(state, start)?.name || start}」，四周 ${placed.length - 1} 张西部树林，树林牌库余 ${woodsState(state).deck.length} 张。`)
  return placed
}

/** 引擎真实入口：地点入场（按网格重算连接）。 */
export function locationPlaced(state, location, api = {}) {
  void api
  if (location?.id && !slotOf(state, location.id)) {
    // 引擎自行放置的地点（例如剧情效果）：接在起始格东侧的空位，保持网格连通。
    const occupied = new Set(Object.values(gridOf(state)).map(point => `${point.x},${point.y}`))
    let x = 0
    let y = 0
    while (occupied.has(`${x},${y}`)) x += 1
    gridOf(state)[location.id] = { x, y }
  }
  syncConnections(state)
}

/** 引擎真实入口：遭遇牌库建立之后（剧情资产、黑暗等级、放一边的核对）。 */
export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const flags = flagsFor(state)
  if (flags.twistedHollowStoryPlaced) return
  flags.twistedHollowStoryPlaced = true
  // 山谷提灯：按战役记录选版本，放到调查员控制下，另一版本移出游戏。
  placeLantern(state, api, { location: flags[START_FLAG] || GLIMMERING_WOODS_ID })
  const otherSpec = showedTheWay(state) ? LANTERN_SPEC.plain : LANTERN_SPEC.boon
  for (const code of [otherSpec.lit, otherSpec.unlit]) {
    if (safeCall(api, 'takeFromSetAside', code)) info(api, `移除另一版本的山谷提灯（${cardName(code)}）。`)
  }
  // 罗莎·马奎兹博士：放到一名调查员控制下（本关不占盟友槽）。
  const seat = state.investigators?.[0]?.seat ?? 0
  let marquez = typeof api.storyAsset === 'function' ? api.storyAsset(DR_MARQUEZ_CODE, null) : null
  marquez ||= storyAssetRecord(state, DR_MARQUEZ_CODE, { global: false, location: null })
  marquez.controllerSeat = seat
  marquez.noSlot = true
  info(api, '罗莎·马奎兹博士置于调查员控制下（本关不占盟友槽）。')
  // 关系等级：西奥/朱迪丝达到 2 级时放一边（由战役层记录读）。
  for (const [code, key] of [[THEO_CODE, 'theoPetersRelationshipLevel'], [JUDITH_CODE, 'judithParkRelationshipLevel']]) {
    if (recordNumber(state, key) >= 2) info(api, `「${cardName(code)}」关系等级 ≥2：本关放一边。`)
  }
  setDarknessLevel(state, Math.max(INITIAL_DARKNESS, darknessLevel(state)))
  const woods = woodsState(state)
  info(api, `黑暗等级 ${darknessLevel(state)}；树林牌库 ${woods.deck.length} 张；放一边 ${state.scenarioZones?.setAside?.length || 0} 张。`)
}

/** 直调/单测入口：准备 + 网格布置 + 剧情资产（不经过引擎的 placeLocation）。 */
export function setupScenario(state, api = {}) {
  const { plan } = prepareScenario(state, api)
  const start = plan.start || GLIMMERING_WOODS_ID
  const pool = plan.pool.filter(id => id !== start)
  const woods = shuffled(state, pool)
  assignSlot(state, start, START_SLOT)
  const placedIds = [start]
  placeNow(state, start, api, { revealed: true })
  for (const direction of OPENING_DIRECTIONS) {
    const vector = DIRECTION_VECTORS[direction]
    const id = woods.pop()
    if (!id) break
    assignSlot(state, id, vector)
    placeNow(state, id, api, { revealed: false })
    placedIds.push(id)
  }
  setWoodsDeck(state, woods)
  state.investigators ||= []
  for (const inv of state.investigators) {
    if (inv.location !== start) inv.location = start
  }
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || [])]
  afterDeckSetup(state, [], { api })
  syncConnections(state)
  return { plan, placedIds, start, woodsCount: woodsState(state).deck.length }
}

/** 引擎真实入口：引言二选一（说实话 / 说谎）与混乱袋标记。 */
export function preScenarioSetup(state, events, api = {}) {
  void events
  const flags = flagsFor(state)
  if (flags.twistedHollowIntroDone) return false
  flags.twistedHollowIntroDone = true
  // 引言决定会改变布置分支（荧光草地开场 / 随机西部树林开场）：地点还没入场时重算计划。
  const syncPlan = () => {
    const plan = flags[PLAN_FLAG]
    if (!plan || plan.showedTheWay === showedTheWay(state)) return
    if ((state.locations || []).length > 0) return
    delete flags[PLAN_FLAG]
    clearFlag(state, START_FLAG)
  }
  const standalone = state.standalone === true || state.campaign?.standalone === true
  if (standalone) {
    record(state, RECORD_LOST_THE_PATH)
    flags[INTRO_FLAG] = 'lostThePath'
    syncPlan()
    info(api, '单人模式：调查员迷失了方向（跳过引言选择）。')
    return false
  }
  const existing = introBranch(state)
  if (existing) {
    flags[INTRO_FLAG] = existing
    syncPlan()
    info(api, `引言分支（战役记录）：${existing === 'showedTheWay' ? '母亲瑞秋指路' : '调查员迷失方向'}。`)
    return false
  }
  const labels = state.scenario?.labels || {}
  const choice = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'choice', source: REFERENCE_INTRO, seat: state.campaign?.leadSeat ?? 0,
      prompt: `${labels.tellTheTruth || 'Tell the truth.'} / ${labels.lie || 'Lie to her.'}`,
      options: [
        { id: 'tellTheTruth', label: labels.tellTheTruth || '说实话' },
        { id: 'lie', label: labels.lie || '对她撒谎' },
      ],
    })
    : 'tellTheTruth'
  if (choice === 'lie') {
    record(state, RECORD_LOST_THE_PATH)
    flags[INTRO_FLAG] = 'lostThePath'
    setFlag(state, 'twistedHollowIntroToken', 'elderthing')
    info(api, '引言 3：调查员欺骗了母亲瑞秋。战役日志记录「调查员迷失了方向」，混乱袋加入 1 个 [elder_thing]（afterChaosBagSetup 结算）。')
  } else {
    record(state, RECORD_SHOWED_THE_WAY)
    flags[INTRO_FLAG] = 'showedTheWay'
    setFlag(state, 'twistedHollowIntroToken', 'cultist')
    info(api, '引言 2：母亲瑞秋指路。战役日志记录「母亲瑞秋指路」，混乱袋加入 1 个 [cultist]（afterChaosBagSetup 结算）。')
  }
  syncPlan()
  return false
}

const REFERENCE_INTRO = '10605-intro'

/**
 * 引言标记：引擎在 startScenario 里用 initializeChaosBag 重建当前袋（`state.chaosBag =
 * [...campaign.chaosBag]`），所以引言加的标记必须等混乱袋建好之后再写（本钩子是唯一时机），
 * 并按印刷「for the remainder of the campaign」同时写进战役袋。
 */
export function afterChaosBagSetup(state, events, api = {}) {
  void events
  const flags = flagsFor(state)
  const token = flags.twistedHollowIntroToken
  if (!token || flags.twistedHollowIntroTokenApplied) return false
  flags.twistedHollowIntroTokenApplied = true
  addChaosToken(state, token, api)
  info(api, `引言标记入袋：1 个 [${token}]（remainder of the campaign）。`)
  return true
}

function addChaosToken(state, token, api = {}) {
  state.campaign ||= {}
  if (Array.isArray(state.campaign.chaosBag)) state.campaign.chaosBag.push(token)
  if (typeof api.addChaosToken === 'function') return api.addChaosToken(token)
  state.chaosBag ||= []
  state.chaosBag.push(token)
  return true
}

// ---------------------------------------------------------------------------
// 地点揭示 / 各地点强制效果
// ---------------------------------------------------------------------------

const DARKNESS_X = state => darknessLevel(state)

// 地点揭示强制的键：优先读单卡条目的 `flags.onReveal`（声明即有读点），
// 条目缺失时退回卡号表（内容层测试/未重建索引时仍可运行）。
const REVEAL_BY_CODE = Object.freeze({
  '10613': 'lowestFightPursuitHere',
  '10614': 'poisonedMarsh',
  '10615': 'agilityHighestHealthPursuit',
  '10616': 'intellectHighestEvadeAttacks',
  '10617': 'willpowerHighestFightPursuit',
  '10619': 'corpseGroveHorror',
  '10620': 'highestFightPursuitEngaged',
})

const revealContext = (state, location, api, seat) => {
  const inv = Number.isInteger(seat) ? state.investigators?.[seat] : activeInvestigators(state)[0]
  return { inv, seatOf: inv?.seat ?? state.currentSeat ?? 0, location }
}

const REVEAL_HANDLERS = Object.freeze({
  // 枯疫空地：选择攻击值最低且处于追击中的敌人，生成在本地点。
  lowestFightPursuitHere(state, location, api, { seatOf }) {
    const enemy = spawnFromPursuit(state, api, { enemies: pursuitWithLowest(state, api, 'fight'), location: location.id, seat: seatOf })
    if (!enemy) info(api, '枯疫空地：追击区域没有敌人。')
    return true
  },
  // 毒沼：受到 1 点直接伤害，或对你控制的每个[[盟友]]支援造成 1 点伤害。
  poisonedMarsh(state, location, api, { inv, seatOf }) {
    void location
    const allies = (inv?.assets || []).filter(asset => hasTrait(asset, 'Ally') || hasTrait(ALL_CARDS[codeOf(asset)], 'Ally'))
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'choice', source: '10614', seat: seatOf, prompt: '毒沼：选择一项。',
        options: [
          { id: 'damage', label: '受到 1 点直接伤害' },
          ...(allies.length ? [{ id: 'assets', label: '对你控制的每个[[盟友]]支援造成 1 点伤害' }] : []),
        ],
      })
      : 'damage'
    if (choice === 'assets' && allies.length) {
      for (const asset of allies) {
        // 引擎读点：api.damageAsset(seat, assetId, amount)。
        if (typeof api.damageAsset === 'function') api.damageAsset(seatOf, asset.id, 1)
        else asset.damage = (Number(asset.damage) || 0) + 1
      }
      info(api, `毒沼：${inv?.name || '调查员'} 的 ${allies.length} 个[[盟友]]支援各受到 1 点伤害。`)
    } else {
      applyDirectDamage(state, inv, 1, api)
      info(api, `毒沼：${inv?.name || '调查员'} 受到 1 点直接伤害。`)
    }
    return true
  },
  // 茂盛灌丛：检定[agility](X)；失败则生成印刷生命值最高的追击敌人。
  agilityHighestHealthPursuit(state, location, api, { inv, seatOf }) {
    runRevealTest(state, api, inv, 'agility', DARKNESS_X(state), () => {
      const enemy = spawnFromPursuit(state, api, { enemies: pursuitWithHighest(state, api, 'health'), location: location.id, seat: seatOf })
      if (!enemy) info(api, '茂盛灌丛：追击区域没有敌人。')
    }, `茂盛灌丛：检定[agility](${DARKNESS_X(state)})`)
    return true
  },
  // 蘑菇园：检定[intellect](X)；失败则躲避值最高的追击敌人攻击你。
  intellectHighestEvadeAttacks(state, location, api, { inv }) {
    void location
    runRevealTest(state, api, inv, 'intellect', DARKNESS_X(state), () => {
      const enemy = pursuitWithHighest(state, api, 'evade')[0]
      if (!enemy) { info(api, '蘑菇园：追击区域没有敌人。'); return }
      if (typeof api.attack === 'function') api.attack(enemy, inv)
      else applyDirectHorror(state, inv, Number(enemy.horror) || 0, api)
      info(api, `蘑菇园：「${enemy.name || enemy.code}」攻击 ${inv?.name || '调查员'}。`)
    }, `蘑菇园：检定[intellect](${DARKNESS_X(state)})`)
    return true
  },
  // 月光空地：检定[willpower](X)；失败则生成攻击值最高的追击敌人。
  willpowerHighestFightPursuit(state, location, api, { inv, seatOf }) {
    runRevealTest(state, api, inv, 'willpower', DARKNESS_X(state), () => {
      const enemy = spawnFromPursuit(state, api, { enemies: pursuitWithHighest(state, api, 'fight'), location: location.id, seat: seatOf })
      if (!enemy) info(api, '月光空地：追击区域没有敌人。')
    }, `月光空地：检定[willpower](${DARKNESS_X(state)})`)
    return true
  },
  // 尸林：受到 1 点恐惧。
  corpseGroveHorror(state, location, api, { inv }) {
    void location
    applyDirectHorror(state, inv, 1, api)
    info(api, `尸林：${inv?.name || '调查员'} 受到 1 点恐惧。`)
    return true
  },
  // 熊穴：攻击值最高的追击敌人与你交战；不能则抽取遭遇牌库顶。
  highestFightPursuitEngaged(state, location, api, { inv, seatOf }) {
    const enemy = pursuitWithHighest(state, api, 'fight')[0]
    if (enemy) {
      spawnFromPursuit(state, api, { enemy, location: location.id, seat: seatOf, engagedSeat: seatOf })
      info(api, `熊穴：「${enemy.name || enemy.code}」生成并与 ${inv?.name || '调查员'} 交战。`)
    } else {
      safeCall(api, 'drawEncounter', seatOf)
      info(api, '熊穴：追击区域没有敌人，改为抽取遭遇牌库顶的卡牌。')
    }
    return true
  },
})

/** 各地点「你揭示本地点后」的强制效果（参考 Location/Cards/…/TheTwistedHollow/*.hs）。 */
export function resolveLocationReveal(state, location, api = {}, seat = null) {
  if (!location) return false
  const code = codeOf(location)
  const key = flagsOf(code).onReveal || REVEAL_BY_CODE[code]
  const handler = key ? REVEAL_HANDLERS[key] : null
  if (typeof handler !== 'function') return false
  return handler(state, location, api, revealContext(state, location, api, seat)) === true
}

function runRevealTest(state, api, inv, skill, difficulty, onFail, label) {
  if (!inv) return false
  if (typeof api.test === 'function') {
    api.test(inv.seat, skill, difficulty, result => { if (!result.success) onFail() }, 0, { label })
    return true
  }
  // 无检定通道（内容层直调）：按失败结算最坏分支，测试可用 api.forceTestSuccess 覆盖。
  const forced = api.forceTestSuccess === true
  if (!forced) onFail()
  return true
}

function applyDirectDamage(state, inv, amount, api = {}) {
  if (!inv || !(amount > 0)) return 0
  if (typeof api.directDamage === 'function') return api.directDamage(inv.seat, amount)
  inv.damage = (Number(inv.damage) || 0) + amount
  return amount
}

function applyDirectHorror(state, inv, amount, api = {}) {
  if (!inv || !(amount > 0)) return 0
  if (typeof api.directHorror === 'function') return api.directHorror(inv.seat, amount)
  inv.horror = (Number(inv.horror) || 0) + amount
  return amount
}

/** 引擎真实入口：地点揭示后（议程 1 正面强制 + 该地点的强制效果）。 */
export function locationRevealed(state, location, api = {}, seat = null, { from, ignoreForced = false } = {}) {
  if (!location) return false
  if (!ignoreForced && !suppressLanternForestReveal(state, location, seat, from, api)) {
    resolveLocationReveal(state, location, api, seat)
  }
  if (currentAgendaFrontCode(state) === AGENDA_CODES[0]) {
    placeWoodsAround(state, location.id, api)
    return true
  }
  return false
}

function lanternAsset(state) {
  const record = lanternRecord(state)
  return (state.storyAssets || []).find(asset => asset.id === record?.id)
}

function lanternLocation(state, asset) {
  return state.investigators[asset?.controllerSeat]?.location || asset?.location
}

export function locationEntered(state, inv, location) {
  const asset = lanternAsset(state)
  if (!asset || asset.controllerSeat !== inv.seat || !location) return
  asset.location = location.id
  lanternRecord(state).location = location.id
}

function exhaustLantern(state, asset) {
  asset.exhausted = true
  lanternRecord(state).exhausted = true
}

function suppressLanternForestReveal(state, location, seat, from, api) {
  const asset = lanternAsset(state)
  const owner = state.investigators[asset?.controllerSeat]
  const rule = flagsOf(codeOf(asset)).lanternRules
  const printed = flagsOf(codeOf(location)).onReveal || REVEAL_BY_CODE[codeOf(location)]
  const forest = (location.traits || []).some(trait => trait.toLowerCase() === 'forest')
  if (!from || !rule?.suppressForestReveal || asset.exhausted || !owner || owner.defeated || owner.resigned
    || !printed || !forest || (seat !== owner.seat && from !== owner.location)) return false
  const selected = api.choose?.({ kind: 'reaction', seat: owner.seat, source: asset.id, canSkip: true,
    prompt: '横置山谷提灯以忽略这个森林地点的揭示强制效果？',
    options: [{ id: 'skip', label: '跳过' }, { id: 'exhaust', label: '横置提灯并忽略强制效果' }] })
  if (selected !== 'exhaust') return false
  exhaustLantern(state, asset)
  return true
}

export function replaceStoryAssetDeparture(state, asset, api = {}) {
  if (asset !== lanternAsset(state)) return false
  const record = lanternRecord(state)
  const from = state.investigators[asset.controllerSeat]?.location || asset.location
  const location = nearestLocationTo(state, from)
  if (!location) return false
  flipLantern(state, api, { lit: false, location })
  asset.controllerSeat = null
  record.controllerSeat = null
  return true
}

export function investigatorEliminated(state, inv, clues, api = {}) {
  const asset = lanternAsset(state)
  if (asset?.controllerSeat === inv.seat) replaceStoryAssetDeparture(state, asset, api)
}

export function enemyConnections(state, enemy, origin) {
  const clearing = (state.locations || []).find(location => location.revealed
    && flagsOf(codeOf(location)).enemyConnectedFromOtherLocations)
  if (!clearing || clearing.id === origin?.id) return []
  return [clearing.id]
}

/** 引擎真实入口：调查结果窗口（尸林「成功调查后受到 1 点恐惧」）。 */
export function investigateResult(state, inv, location, result, api = {}) {
  void inv
  if (codeOf(location) === '10619' && result?.success) {
    applyDirectHorror(state, inv || state.investigators?.[state.currentSeat ?? 0], 1, api)
    info(api, '尸林：成功调查后受到 1 点恐惧。')
  }
  return undefined
}

// ---------------------------------------------------------------------------
// 地点/敌人常驻修正
// ---------------------------------------------------------------------------

export function locationShroudModifier(state, location) {
  if (!location) return 0
  const code = codeOf(location)
  const darkness = darknessLevel(state)
  if (code === '10618') return darkness // 扭曲小路：帷幕 = X = 黑暗等级（基数 0）
  if (code === '10615') return -darkness // 茂盛灌丛：-X 帷幕
  if (code === '10616') return isDarkLocation(state, location) ? 0 : 2 // 蘑菇园：非[[黑暗]]时 +2
  return 0
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy) return 0
  const code = codeOf(enemy)
  if (stat !== 'health') return 0
  if (isStalkingCode(code)) return darknessLevel(state) // X = 黑暗等级
  if (isUrsineCode(code)) return 2 * investigatorCount(state) // +2[per_investigator] 生命值
  return 0
}

/** 猎踪混种的「猎物：仅限拥有山谷提灯的调查员」。 */
export function preyRank(state, enemy, inv) {
  if (!isStalkingCode(codeOf(enemy))) return 0
  const lantern = lanternRecord(state)
  return lantern && lantern.controllerSeat === inv?.seat ? 100 : 0
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

const roundFlag = (state, key) => {
  const flags = flagsFor(state)
  return Number(flags[key]) === Number(state.round)
}
const markRound = (state, key) => { flagsFor(state)[key] = Number(state.round) }

function currentActCode(state) {
  const act = state.acts?.[state.actIndex ?? 0]
  return codeOf(act)
}

function currentAgendaFrontCode(state) {
  const agenda = state.agendas?.[state.agendaIndex ?? 0]
  if (!agenda) return null
  if (agenda.face === 'back') return null
  const code = codeOf(agenda)
  return AGENDA_CODES.includes(code) || code === SPECIAL_AGENDA_CODE ? code : null
}

function adjacentUnrevealed(state, inv) {
  const location = findLocation(state, inv?.location)
  if (!location) return []
  return (location.connections || [])
    .map(id => findLocation(state, id))
    .filter(target => target && target.revealed !== true)
}

export function actions(state, inv) {
  if (!inv || state.status === 'finished') return []
  const moves = []
  const location = findLocation(state, inv.location)
  if (!location) return moves
  const actCode = currentActCode(state)
  const agendaCode = currentAgendaFrontCode(state)
  const hasUnrevealedNeighbor = adjacentUnrevealed(state, inv).length > 0
  const lanternAt = lanternAsset(state)
  const lanternRules = flagsOf(codeOf(lanternAt)).lanternRules
  if (lanternAt?.location === inv.location && lanternAt.controllerSeat == null && lanternRules?.recover === 'action') {
    moves.push({ action: 'scenarioAction', rule: 'twistedHollowRecoverLantern', actions: 1, label: '取得并点燃山谷提灯' })
  }
  if (lanternLocation(state, lanternAt) === inv.location && !lanternAt?.exhausted && lanternRules?.peekAndMove && hasUnrevealedNeighbor) {
    moves.push({ action: 'scenarioAction', rule: 'twistedHollowLanternPeek', actions: 1, label: '横置山谷提灯：查看相邻地点并可以移动' })
  }
  // 幕 2 正面：[fast] 花费 1 线索，查看相邻地点的已揭示面。
  if (actCode === ACT_CODES[1] && hasUnrevealedNeighbor) {
    moves.push((inv.clues || 0) >= 1
      ? { action: 'scenarioAction', rule: 'twistedHollowLookAdjacent', actions: 0, cost: 1,
        label: '快速：花费 1 线索，查看一个相邻地点的已揭示面' }
      : { action: 'scenarioAction', rule: 'twistedHollowLookAdjacent', actions: 0,
        reason: '查看相邻地点需要 1 个线索' })
  }
  // 特殊议程「回到山谷！」正面：[fast] 横置山谷提灯或共同花费 1[per_investigator] 线索。
  if (agendaCode === SPECIAL_AGENDA_CODE && hasUnrevealedNeighbor) {
    const lantern = lanternRecord(state)
    const exhaustable = lantern && lantern.lit && !lantern.exhausted
    const groupClues = activeInvestigators(state).reduce((sum, target) => sum + (target.clues || 0), 0)
    const cost = investigatorCount(state)
    moves.push(exhaustable || groupClues >= cost
      ? { action: 'scenarioAction', rule: 'twistedHollowLookAdjacentSpecial', actions: 0,
        label: `快速：横置山谷提灯或共同花费 ${cost} 线索，查看相邻地点的已揭示面（可移动）` }
      : { action: 'scenarioAction', rule: 'twistedHollowLookAdjacentSpecial', actions: 0,
        reason: `需要点燃的山谷提灯或 ${cost} 个团队线索` })
  }
  // 扭曲小路：发现线索后查看相邻地点（这里做成每回合一次的免费行动）。
  if (codeOf(location) === '10618' && hasUnrevealedNeighbor) {
    moves.push(roundFlag(state, 'twistedHollowCrookedPathRound')
      ? { action: 'scenarioAction', rule: 'twistedHollowCrookedPathLook', actions: 0,
        reason: '扭曲小路：本回合已经使用过' }
      : { action: 'scenarioAction', rule: 'twistedHollowCrookedPathLook', actions: 0,
        label: '扭曲小路：查看一个相邻地点的已揭示面，你可以移动到该地点（每回合一次）' })
  }
  // 荧光草地：[action] 治愈 1 点恐惧（每轮仅限一次）。
  if (codeOf(location) === '10612' && (inv.horror || 0) > 0) {
    moves.push(roundFlag(state, 'twistedHollowGlimmeringHealRound')
      ? { action: 'scenarioAction', rule: 'twistedHollowGlimmeringHeal', actions: 1,
        reason: '荧光草地：本轮已经使用过' }
      : { action: 'scenarioAction', rule: 'twistedHollowGlimmeringHeal', actions: 1,
        label: '荧光草地：治愈 1 点恐惧（每轮一次）' })
  }
  return moves
}

export function fastActions(state, inv) {
  const asset = lanternAsset(state)
  if (asset?.location !== inv?.location || !asset || asset.controllerSeat != null
    || flagsOf(codeOf(asset)).lanternRules?.recover !== 'fast') return []
  return [{ action: 'scenarioAction', rule: 'twistedHollowRecoverLantern', actions: 0, label: '快速：取得并点燃山谷提灯' }]
}

function chooseNeighbor(state, inv, api) {
  const candidates = adjacentUnrevealed(state, inv)
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]
  let picked = candidates[0]
  if (typeof api?.choose === 'function') {
    const answer = api.choose({
      kind: 'location', source: CHAPTER_ID, seat: inv.seat, prompt: '选择一个相邻地点。',
      options: candidates.map(target => ({ id: target.id, label: target.unrevealedName || target.name })),
    })
    picked = candidates.find(target => target.id === answer) || picked
  }
  return picked
}

function lookAtAdjacent(state, inv, api, { allowMove = false, ignoreForced = false } = {}) {
  const target = chooseNeighbor(state, inv, api)
  if (!target) return false
  const peeked = typeof api.peekLocation === 'function' ? api.peekLocation(inv.seat, target.id) : false
  info(api, `${inv.name} 查看「${target.unrevealedName || target.name}」的已揭示面${peeked ? '' : '（本地口径）'}。`)
  if (!allowMove) return true
  const canMove = typeof api.canMoveTo === 'function' ? api.canMoveTo(inv.seat, target.id) : true
  if (!canMove) return true
  const answer = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'reaction', source: CHAPTER_ID, seat: inv.seat, canSkip: true,
      prompt: `是否移动到「${target.name}」？`,
      options: [{ id: 'move', label: '移动到该地点' }, { id: 'skip', label: '不移动' }],
    })
    : 'skip'
  if (answer !== 'move') return true
  if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, target.id, { ignoreLocationForced: ignoreForced })
  else inv.location = target.id
  info(api, `${inv.name} 移动到「${target.name}」。`)
  return true
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule === 'twistedHollowRecoverLantern') {
    const asset = lanternAsset(state)
    const rule = flagsOf(codeOf(asset)).lanternRules
    if (!rule?.recover || asset.controllerSeat != null || asset.location !== inv.location) return false
    asset.controllerSeat = inv.seat
    lanternRecord(state).controllerSeat = inv.seat
    return Boolean(flipLantern(state, api, { lit: true, location: inv.location }))
  }
  if (move.rule === 'twistedHollowLanternPeek') {
    const asset = lanternAsset(state)
    if (!flagsOf(codeOf(asset)).lanternRules?.peekAndMove || asset.exhausted
      || lanternLocation(state, asset) !== inv.location || !adjacentUnrevealed(state, inv).length) return false
    exhaustLantern(state, asset)
    return lookAtAdjacent(state, inv, api, { allowMove: true, ignoreForced: true })
  }
  if (move.rule === 'twistedHollowLookAdjacent') {
    if (currentActCode(state) !== ACT_CODES[1] || (inv.clues || 0) < 1) return false
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, 1)
    else inv.clues = Math.max(0, (inv.clues || 0) - 1)
    return lookAtAdjacent(state, inv, api, { allowMove: false })
  }
  if (move.rule === 'twistedHollowLookAdjacentSpecial') {
    if (currentAgendaFrontCode(state) !== SPECIAL_AGENDA_CODE) return false
    const lantern = lanternRecord(state)
    const exhaustable = lantern && lantern.lit && !lantern.exhausted
    if (exhaustable) {
      const asset = (state.storyAssets || []).find(item => item.id === lantern.id)
      if (asset) asset.exhausted = true
      lantern.exhausted = true
      info(api, '横置山谷提灯：查看相邻地点的已揭示面。')
    } else {
      const cost = investigatorCount(state)
      const group = activeInvestigators(state).reduce((sum, target) => sum + (target.clues || 0), 0)
      if (group < cost) return false
      let remaining = cost
      for (const target of activeInvestigators(state)) {
        const pay = Math.min(remaining, target.clues || 0)
        if (pay > 0) {
          if (typeof api.spendClues === 'function') api.spendClues(target.seat, pay)
          else target.clues = Math.max(0, (target.clues || 0) - pay)
          remaining -= pay
        }
        if (remaining <= 0) break
      }
    }
    return lookAtAdjacent(state, inv, api, { allowMove: true })
  }
  if (move.rule === 'twistedHollowCrookedPathLook') {
    const location = findLocation(state, inv.location)
    if (codeOf(location) !== '10618') return false
    if (roundFlag(state, 'twistedHollowCrookedPathRound')) return false
    markRound(state, 'twistedHollowCrookedPathRound')
    return lookAtAdjacent(state, inv, api, { allowMove: true })
  }
  if (move.rule === 'twistedHollowGlimmeringHeal') {
    const location = findLocation(state, inv.location)
    if (codeOf(location) !== '10612') return false
    if (roundFlag(state, 'twistedHollowGlimmeringHealRound')) return false
    markRound(state, 'twistedHollowGlimmeringHealRound')
    if (typeof api.healHorror === 'function') api.healHorror(inv.seat, 1)
    else inv.horror = Math.max(0, (inv.horror || 0) - 1)
    info(api, `荧光草地：${inv.name} 治愈 1 点恐惧（每轮一次）。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

/** 印刷上没有「生成」指示的敌人（幕 1 正面给它们追击生成）。 */
function hasSpawnInstruction(code) {
  const text = ALL_CARDS[code]?.text || ''
  return /(^|\n)\s*Spawn\b/i.test(text) || /(^|\n)\s*生成\s*[-－]/i.test(ALL_CARDS[code]?.textZh || '')
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  const code = codeOf(enemy)
  // 来自追击区域的生成（behavior.spawnFromPursuit）：不再送回追击区域。
  const fromPursuit = flagsFor(state).twistedHollowPursuitSpawn
  if (fromPursuit && fromPursuit === String(enemy.id)) {
    clearFlag(state, 'twistedHollowPursuitSpawn')
    return
  }
  // 幕 1 正面：没有生成指示的敌人从遭遇牌库抽出时放进追击区域。
  if (currentActCode(state) === ACT_CODES[0] && !isUrsineCode(code) && !hasSpawnInstruction(code)) {
    if (sendToPursuit(state, enemy, api)) {
      info(api, `幕 1 正面：「${enemy.name || code}」没有生成指示 → 进入追击区域。`)
      return
    }
  }
  if (isUrsineCode(code) && !flagsFor(state).twistedHollowBearSpawned) {
    flagsFor(state).twistedHollowBearSpawned = true
  }
}

export function enemyMoved(state, enemy, previous, api = {}) {
  void api
  if (!enemy || !previous || enemy.location === previous) return
  if (isUrsineCode(codeOf(enemy)) && !findLocation(state, enemy.location)) {
    // 类熊混种永远不会在无地点状态停留。
    enemy.location = previous
  }
}

export function enemyAttackStarted(state, enemy, inv, api = {}) {
  void state
  void enemy
  void inv
  void api
}

/** 猎踪混种：攻击你后，如果你控制山谷提灯，翻到熄灭面并放在你的地点。 */
export function enemyAttackResolved(state, enemy, inv, api = {}) {
  if (!enemy || !inv) return false
  if (!isStalkingCode(codeOf(enemy))) return false
  const lantern = lanternRecord(state)
  if (!lantern || lantern.controllerSeat !== inv.seat) return false
  flipLantern(state, api, { lit: false, location: inv.location })
  info(api, `猎踪混种攻击后：山谷提灯翻到熄灭面并放在「${findLocation(state, inv.location)?.name || inv.location}」。`)
  return true
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  const code = codeOf(enemy)
  // 类熊混种：幕 2 期间「将被击败时」治愈全部伤害并移入追击区域（不进胜利区）。
  if (isUrsineCode(code) && currentActCode(state) === ACT_CODES[1]) {
    const healed = Number(enemy.damageTaken) || 0
    enemy.damageTaken = 0
    safeCall(api, 'healEnemy', enemy, healed)
    enemy.exhausted = false
    const moved = sendToPursuit(state, enemy, api)
    info(api, `类熊混种将被击败：治愈 ${healed} 点伤害并${moved ? '放入追击区域' : '留在场上'}（不进胜利区）。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

function actInstance(state, code) {
  const source = state.scenario?.stageCards?.[code] || STAGE_CARDS[code]
  return source ? structuredClone(source) : null
}

/** 幕 1 背面 = 类熊混种：结算 Codex Σ（参考 DesperateSearch.hs）。 */
export function codexSigma(state, api = {}, options = {}) {
  const seat = options.seat ?? state.currentSeat ?? 0
  const inv = state.investigators?.[seat]
  record(state, `${CODEX_FLAG}Sigma`, true)
  const judithAside = hasSetAside(state, JUDITH_CODE)
  const theoAside = hasSetAside(state, THEO_CODE)
  if (judithAside || theoAside) {
    let choice = judithAside ? JUDITH_CODE : THEO_CODE
    if (judithAside && theoAside && typeof api?.choose === 'function') {
      const answer = api.choose({
        kind: 'choice', source: 'codex-sigma', seat, prompt: 'Codex Σ：选择一位到场的居民。',
        options: [JUDITH_CODE, THEO_CODE].map(code => ({ id: code, label: cardName(code) })),
      })
      if (answer === THEO_CODE || answer === JUDITH_CODE) choice = answer
    }
    takeFromSetAside(state, choice)
    const asset = storyAssetRecord(state, choice, { location: inv?.location || null })
    asset.controllerSeat = seat
    info(api, `Codex Σ：${cardName(choice)} 进入游戏并置于 ${inv?.name || '调查员'} 控制下。`)
    resolveCodex(state, choice === JUDITH_CODE ? 'judithPark' : 'theoPeters', api, { seat })
  } else {
    record(state, RECORD_INTERVENED)
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'choice', source: 'codex-sigma', seat, prompt: 'Codex Σ（The Bear 2）：选择一项。',
        options: [
          { id: 'physical', label: '承受 1 点肉体创伤并受到 1 点直接伤害' },
          { id: 'mental', label: '承受 1 点精神创伤并受到 1 点直接恐惧' },
        ],
      })
      : 'physical'
    if (choice === 'mental') {
      safeCall(api, 'addTrauma', seat, 'mental', 1)
      applyDirectHorror(state, inv, 1, api)
    } else {
      safeCall(api, 'addTrauma', seat, 'physical', 1)
      applyDirectDamage(state, inv, 1, api)
    }
    info(api, 'Codex Σ（The Bear 2）：母亲瑞秋出手干预（战役日志记录）。')
  }
  // The Bear 3：未交战敌人进追击；类熊混种在你的地点生成（横置、受 1 点伤害）；重铺树林。
  for (const target of [...(state.enemies || [])]) {
    if (target.engagedSeat != null || target.defeated) continue
    sendToPursuit(state, target, api)
  }
  const locationId = inv?.location || findLocation(state, TWISTED_HOLLOW_LOCATION_ID)?.id || flagsFor(state)[START_FLAG]
  const bear = spawnBear(state, api, { location: locationId, exhausted: true })
  if (bear) {
    bear.damageTaken = (Number(bear.damageTaken) || 0) + 1
    info(api, `Codex Σ：类熊混种在「${findLocation(state, locationId)?.name || locationId}」生成（横置，受 1 点伤害）。`)
  }
  const lantern = lanternRecord(state)
  if (lantern && lantern.controllerSeat == null) {
    lantern.controllerSeat = seat
    const asset = (state.storyAssets || []).find(item => item.id === lantern.id)
    if (asset) asset.controllerSeat = seat
  }
  rebuildWoodsFromCodex(state, api, { seat })
  return true
}

/** The Bear 3：把空的[[黑暗]]地点收进树林牌库底、重洗，再在调查员四周铺开。 */
function rebuildWoodsFromCodex(state, api, { seat }) {
  // The Bear 3：把空的[[黑暗]]地点收回树林牌库；放一边的扭曲空洞 + 3 张随机西部树林
  // 洗成牌库底 4 张，其余西部树林以随机顺序压在上面。
  const emptyDark = (state.locations || []).filter(location => isDarkLocation(state, location)
    && !(state.investigators || []).some(inv => inv.location === location.id))
  const codes = []
  for (const location of emptyDark) {
    codes.push(location.id)
    if (typeof api.remove === 'function') api.remove(location.id)
    else state.locations = (state.locations || []).filter(item => item.id !== location.id)
    delete gridOf(state)[location.id]
  }
  const rest = shuffled(state, [...codes, ...woodsDeckCards(state)])
  const bottomWoods = rest.slice(0, 3)
  const top = rest.slice(3)
  const hollowAside = takeAsideHollow(state)
  const bottom = shuffled(state, hollowAside ? [...bottomWoods, TWISTED_HOLLOW_LOCATION_ID] : bottomWoods)
  setWoodsDeck(state, [...bottom, ...top])
  syncConnections(state)
  const inv = state.investigators?.[seat]
  if (inv) placeWoodsAround(state, inv.location, api)
  info(api, `Codex Σ（The Bear 3）：${codes.length} 个空[[黑暗]]地点收回树林牌库，重洗后重新铺开。`)
}

/** 从遭遇牌库顶弃牌直到弃到敌人，并在指定地点生成它（10609 背面「不能选择追击敌人」分支）。 */
function discardUntilEnemySpawned(state, api = {}, { seat = 0, location } = {}) {
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  while (state.encounterDeck.length) {
    const code = state.encounterDeck.pop()
    if (ALL_CARDS[code]?.type !== 'enemy') { state.encounterDiscard.push(code); continue }
    if (typeof api.spawn === 'function') {
      const spawned = api.spawn(code, location)
      if (spawned) return spawned
    }
    return spawnEnemyCode(state, code, location, api, { seat })
  }
  return null
}

/** 按卡号在指定地点生成敌人（仅在没有引擎 api.spawn 时的本地兜底）。 */
function spawnEnemyCode(state, code, locationId, api = {}, options = {}) {
  if (!code || !locationId || !findLocation(state, locationId)) return null
  const def = state.scenario?.enemies?.[code] || {}
  const card = ALL_CARDS[code] || {}
  state.enemies ||= []
  const enemy = {
    ...structuredClone(def),
    id: `${CHAPTER_ID}-${code}-${(state.enemies.length || 0) + 1}`,
    code, originalCode: code,
    name: def.name || card.nameZh || card.name || code,
    location: locationId, engagedSeat: options.engagedSeat ?? null, exhausted: options.exhausted === true,
    damageTaken: 0, doom: 0, clues: 0,
    fight: def.fight ?? card.fight ?? 0, evade: def.evade ?? card.evade ?? 0,
    health: def.health ?? card.health ?? 1, damage: def.damage ?? card.damage ?? 0, horror: def.horror ?? card.horror ?? 0,
    traits: [...(def.traits || card.traits || [])],
  }
  state.enemies.push(enemy)
  info(api, `「${enemy.name}」生成在「${findLocation(state, locationId)?.name || locationId}」。`)
  return enemy
}

function spawnBear(state, api = {}, options = {}) {
  const locationId = options.location
  if (!locationId || !findLocation(state, locationId)) return null
  state.enemies ||= []
  const existing = state.enemies.find(enemy => isUrsineCode(codeOf(enemy)))
  if (existing) {
    existing.location = locationId
    existing.exhausted = options.exhausted === true
    return existing
  }
  const def = state.scenario?.enemies?.[URSINE_HYBRID_CODE] || {}
  const enemy = {
    ...structuredClone(def), id: `${CHAPTER_ID}-ursine`, code: URSINE_HYBRID_CODE, originalCode: URSINE_HYBRID_CODE,
    name: def.name || cardName(URSINE_HYBRID_CODE), location: locationId, engagedSeat: null,
    exhausted: options.exhausted === true, damageTaken: 0, doom: 0, clues: 0,
  }
  if (!enemy.health && enemy.health !== 0) enemy.health = 5
  enemy.fight ??= 5
  enemy.evade ??= 3
  enemy.damage ??= 3
  enemy.horror ??= 2
  enemy.victory ??= 2
  state.enemies.push(enemy)
  info(api, `类熊混种（发光异形）在「${findLocation(state, locationId)?.name || locationId}」生成。`)
  return enemy
}

function hasSetAside(state, code) {
  return (state.scenarioZones?.setAside || []).includes(code)
}

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

/** Codex 条目（Θ 罗莎 / Ω 伯蒂 / 7 朱迪丝 / 8 西奥）；居民条目经 resolveScenarioEvent 派发到这里。 */
export function resolveCodex(state, key, api = {}, options = {}) {
  const seat = options.seat ?? state.currentSeat ?? 0
  const inv = state.investigators?.[seat]
  record(state, `${CODEX_FLAG}${String(key)}`, true)
  switch (key) {
    case 'judithPark': {
      const asset = storyAssetRecord(state, JUDITH_CODE, { location: null })
      asset.damage = (Number(asset.damage) || 0) + 2
      record(state, RECORD_JUDITH)
      info(api, 'Codex 7：朱迪丝·帕克出手相助（对她造成 2 点伤害；日志记录）。')
      return true
    }
    case 'theoPeters': {
      const asset = storyAssetRecord(state, THEO_CODE, { location: null })
      asset.horror = (Number(asset.horror) || 0) + 2
      record(state, RECORD_THEO)
      info(api, 'Codex 8：西奥·彼得斯引开了巨熊（对他造成 2 点恐惧；日志记录）。')
      return true
    }
    case 'drRosaMarquez': {
      const candidates = (state.locations || []).filter(location => location.revealed !== true)
      const choice = candidates.length && typeof api?.choose === 'function'
        ? api.choose({
          kind: 'location', source: 'codex-theta', seat, prompt: 'Codex Θ：可以揭示一个地点（忽略其强制效果）。',
          options: [{ id: 'skip', label: '不揭示任何地点' },
            ...candidates.map(location => ({ id: location.id, label: location.unrevealedName || location.name }))],
        })
        : 'skip'
      const target = candidates.find(location => location.id === choice)
      if (target) {
        const revealed = typeof api.reveal === 'function' ? api.reveal(target.id) : null
        if (!revealed) target.revealed = true
        info(api, `Codex Θ：揭示「${target.name}」（忽略其强制效果）。`)
      } else {
        info(api, 'Codex Θ：不揭示任何地点。')
      }
      return true
    }
    case 'bertieMusgrave': {
      const lantern = lanternRecord(state)
      const canReady = lantern && (lantern.exhausted || !lantern.lit)
      const choice = typeof api?.choose === 'function'
        ? api.choose({
          kind: 'choice', source: 'codex-omega', seat, prompt: 'Codex Ω：选择一项。',
          options: [
            { id: 'clues', label: '每位调查员获得 1 个线索（从标记池）' },
            ...(canReady ? [{ id: 'lantern', label: '重整山谷提灯' }] : []),
          ],
        })
        : 'clues'
      if (choice === 'lantern' && canReady) {
        const asset = (state.storyAssets || []).find(item => item.id === lantern.id)
        if (asset) asset.exhausted = false
        lantern.exhausted = false
        info(api, 'Codex Ω：重整山谷提灯。')
      } else {
        for (const target of activeInvestigators(state)) {
          if (typeof api.gainClues === 'function') api.gainClues(target.seat, 1)
          else target.clues = (target.clues || 0) + 1
        }
        info(api, 'Codex Ω：每位调查员获得 1 个线索（从标记池）。')
      }
      return true
    }
    case 'sigma':
      return codexSigma(state, api, options)
    default:
      return false
  }
}

/** 幕 2 背面「才出虎口……」：伯蒂、追击、重铺树林、类熊混种、特殊议程。 */
export function outOfTheFryingPan(state, api = {}) {
  const seat = state.currentSeat ?? 0
  const inv = state.investigators?.[seat]
  // 伯蒂入场（放在任意调查员控制下）。
  if (hasSetAside(state, BERTIE_CODE)) takeFromSetAside(state, BERTIE_CODE)
  const bertie = storyAssetRecord(state, BERTIE_CODE, { location: null })
  bertie.controllerSeat = seat
  bertie.noSlot = false
  info(api, `「伯蒂·马斯格雷夫」进入游戏并置于 ${inv?.name || '调查员'} 控制下。`)
  // 每个未交战的敌人进入追击区域。
  for (const enemy of [...(state.enemies || [])]) {
    if (enemy.engagedSeat != null || enemy.defeated) continue
    sendToPursuit(state, enemy, api)
  }
  // 除扭曲空洞外全部收进树林牌库，并按第 36 页示意图重铺；类熊混种在扭曲空洞生成。
  rebuildWoodsFromLocations(state, api)
  const bear = spawnBear(state, api, { location: TWISTED_HOLLOW_LOCATION_ID, exhausted: false })
  if (bear) {
    bear.damageTaken = 0
    safeCall(api, 'healEnemy', bear, 99)
    info(api, '类熊混种被找到：治愈全部伤害并生成在扭曲空洞。')
  }
  // 幕与议程都换成「回到山谷！」，毁灭标记随之转移。
  const doom = Number(state.doom) || 0
  const specialAct = structuredClone(SPECIAL_ACT_STAGE)
  state.acts = [specialAct]
  state.actIndex = 0
  const specialAgenda = state.scenario?.stageCards?.[SPECIAL_AGENDA_CODE]
    ? structuredClone(state.scenario.stageCards[SPECIAL_AGENDA_CODE]) : structuredClone(STAGE_CARDS[SPECIAL_AGENDA_CODE])
  specialAgenda.doomThreshold ??= 3
  state.agendas = [specialAgenda]
  state.agendaIndex = 0
  state.doom = doom
  setFlag(state, SPECIAL_AGENDA_FLAG, true)
  info(api, `幕与议程推进到特殊议程「回到山谷！」（毁灭 ${doom} 已转移）；它既是当前幕也是当前议程。`)
  return true
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT_CODES[0]) {
    info(api, '幕 1 背面 = 类熊混种：结算 Codex Σ。')
    codexSigma(state, api, { seat: state.currentSeat ?? 0 })
    return true
  }
  if (code === ACT_CODES[1]) {
    info(api, '幕 2 背面「才出虎口……」：伯蒂入场、敌人进入追击、树林重铺、类熊混种现身。')
    outOfTheFryingPan(state, api)
    return true
  }
  if (code === SPECIAL_AGENDA_CODE) {
    // 「回到山谷！」作为幕没有背面：撤退目标达成时直接进入结局 1（见 checkObjectives）。
    info(api, '「回到山谷！」既是当前幕也是当前议程，没有幕背面。')
    return true
  }
  return false
}

/** 议程 1 背面「黑暗聚拢」。 */
export function gatheringDarkness(state, api = {}) {
  const next = raiseDarkness(state, 1)
  info(api, `议程背面：黑暗等级 +1 → ${next}。`)
  if (isFinalDarkness(state) && !(state.standalone === true)) {
    for (const inv of [...activeInvestigators(state)]) {
      safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
      safeCall(api, 'defeatInvestigator', inv.seat)
      inv.defeated = true
    }
    info(api, '黑暗等级 6+：每位幸存的调查员被击败并承受 1 点肉体创伤。')
    return true
  }
  // 1）黑暗地点上未交战的敌人进入追击区域。
  for (const enemy of [...(state.enemies || [])]) {
    if (enemy.engagedSeat != null || enemy.defeated) continue
    const location = findLocation(state, enemy.location)
    if (!isDarkLocation(state, location)) continue
    sendToPursuit(state, enemy, api)
  }
  // 2）未揭示的黑暗地点 + 树林牌库顶 2 张洗到牌库顶。
  const unrevealedDark = (state.locations || []).filter(location => location.revealed !== true && isDarkLocation(state, location))
  const topCards = drawWoods(state, WOODS_TOP_TWO)
  if (unrevealedDark.length || topCards.length) {
    for (const location of unrevealedDark) {
      if (typeof api.remove === 'function') api.remove(location.id)
      else state.locations = (state.locations || []).filter(item => item.id !== location.id)
      delete gridOf(state)[location.id]
    }
    shuffleWoodsTop(state, [...unrevealedDark.map(location => location.id), ...topCards])
  }
  // 3）已揭示、无人且黑暗的地点翻回未揭示面并弃掉所有标记。
  for (const location of [...(state.locations || [])]) {
    if (location.revealed !== true) continue
    if (!isDarkLocation(state, location)) continue
    if ((state.investigators || []).some(inv => inv.location === location.id)) continue
    location.clues = 0
    location.doom = 0
    location.resources = 0
    if (typeof api.flipLocation === 'function') {
      try { api.flipLocation(location.id) } catch { location.revealed = false }
    } else {
      location.revealed = false
    }
  }
  // 4）在每位调查员所在地点四周铺树林牌库顶的地点。
  const withInvestigators = [...new Set((state.investigators || []).filter(inv => findLocation(state, inv.location)).map(inv => inv.location))]
  for (const locationId of withInvestigators) placeWoodsAround(state, locationId, api)
  // 5）山谷提灯持有者检定[willpower](X)；失败则选择一名追击敌人与自己交战。
  const lantern = lanternRecord(state)
  if (lantern?.controllerSeat != null) {
    const owner = state.investigators?.[lantern.controllerSeat]
    const difficulty = darknessLevel(state)
    if (owner && typeof api.test === 'function') {
      api.test(owner.seat, 'willpower', difficulty, result => {
        if (result.success) return
        const enemy = pursuitWithHighest(state, api, 'evade')[0]
        if (!enemy) { info(api, '黑暗聚拢：追击区域没有敌人。'); return }
        const spawned = spawnFromPursuit(state, api, { enemy, location: owner.location, seat: owner.seat, engagedSeat: owner.seat })
        if (spawned) info(api, `黑暗聚拢（检定失败）：「${enemy.name || enemy.code}」生成并与 ${owner.name} 交战。`)
      }, 0, { label: `黑暗聚拢：检定[willpower](${difficulty})` })
    } else if (owner) {
      info(api, `黑暗聚拢：${owner.name} 需要检定[willpower](${difficulty})（无检定通道，跳过）。`)
    }
  }
  // 翻回议程 1a。
  if (typeof api.revertAgenda === 'function') api.revertAgenda()
  else info(api, '黑暗聚拢：翻回议程 1a。')
  info(api, '黑暗聚拢结算完毕：翻回议程 1a。')
  return true
}

/** 特殊议程「回到山谷！」背面「饥渴的森林」。 */
export function backToTheValeBack(state, api = {}) {
  const next = raiseDarkness(state, 1)
  info(api, `「回到山谷！」背面：黑暗等级 +1 → ${next}。`)
  if (isFinalDarkness(state)) {
    for (const inv of [...activeInvestigators(state)]) {
      safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
      safeCall(api, 'defeatInvestigator', inv.seat)
      inv.defeated = true
    }
    info(api, '黑暗等级 6+：每位幸存的调查员被击败并承受 1 点肉体创伤 → 结局 2。')
    if (typeof api.finish === 'function') api.finish('resolution2')
    else state.resolution = 'resolution2'
    return true
  }
  // 按玩家顺序：每位玩家选择一个追击中的敌人，在最近的[[黑暗]]地点生成；不能则弃遭遇牌直到敌人。
  const seats = activeInvestigators(state).map(inv => inv.seat)
  for (const seat of seats.length ? seats : [state.currentSeat ?? 0]) {
    const inv = state.investigators?.[seat]
    const destination = nearestDarkLocation(state, inv?.location) || inv?.location
    if (!destination) continue
    const enemy = pursuitWithHighest(state, api, 'evade')[0]
    if (enemy) {
      spawnFromPursuit(state, api, { enemy, location: destination, seat })
      continue
    }
    const drawn = discardUntilEnemySpawned(state, api, { seat, location: destination })
    if (drawn) info(api, `「回到山谷！」背面：从遭遇牌库弃到敌人「${drawn.name || drawn.code}」并在「${findLocation(state, destination)?.name || destination}」生成。`)
    else info(api, '「回到山谷！」背面：追击区域与遭遇牌库都没有敌人。')
  }
  if (typeof api.revertAgenda === 'function') api.revertAgenda()
  info(api, '「回到山谷！」背面结算完毕：翻回正面。')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA_CODES[0]) {
    info(api, '议程 1 背面「黑暗聚拢」：黑暗等级 +1 与树林重铺。')
    return gatheringDarkness(state, api)
  }
  if (code === SPECIAL_AGENDA_CODE) {
    info(api, '特殊议程背面「饥渴的森林」：黑暗等级 +1 与追击敌人再入场。')
    return backToTheValeBack(state, api)
  }
  return false
}

function sharedLairLocation(state) {
  const alive = activeInvestigators(state)
  if (!alive.length) return null
  const first = alive[0].location
  if (!alive.every(inv => inv.location === first)) return null
  const location = findLocation(state, first)
  if (!location || !hasTrait(location, 'Lair')) return null
  if (location.revealed !== true) return null
  return location
}

function groupClues(state) {
  return activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
}

function payGroupClues(state, amount, api = {}) {
  let remaining = Math.max(0, Number(amount) || 0)
  for (const inv of activeInvestigators(state)) {
    if (remaining <= 0) break
    const pay = Math.min(remaining, Number(inv.clues) || 0)
    if (pay <= 0) continue
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, pay)
    else inv.clues = Math.max(0, (inv.clues || 0) - pay)
    remaining -= pay
  }
  return amount - remaining
}

function askAdvance(state, api, message) {
  if (typeof api?.choose !== 'function') return true
  const answer = api.choose({
    kind: 'act', source: CHAPTER_ID, seat: state.campaign?.leadSeat ?? state.currentSeat ?? 0, canSkip: true,
    prompt: message,
    options: [{ id: 'advance', label: '共同支付线索并推进' }, { id: 'skip', label: '暂不推进' }],
  })
  return answer !== 'skip'
}

/** 幕 1 正面目标：轮末、全员同一[[巢穴]]地点、共同支付 3[per_investigator] 线索。 */
export function checkActOneObjective(state, api = {}) {
  if (currentActCode(state) !== ACT_CODES[0]) return false
  if (state._roundEndWindow !== true) return false
  const lair = sharedLairLocation(state)
  if (!lair) return false
  const required = 3 * investigatorCount(state)
  if (groupClues(state) < required) return false
  if (!askAdvance(state, api, `回合结束：全员在「${lair.name}」，是否共同支付 ${required} 个线索推进幕 1？`)) return false
  payGroupClues(state, required, api)
  info(api, `幕 1 目标达成：全员在[[巢穴]]「${lair.name}」，共同支付 ${required} 个线索。`)
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

/** 幕 2 目标：轮末、全员在扭曲空洞、共同支付 2[per_investigator] 线索 → 幕 2b。 */
export function checkActTwoObjective(state, api = {}) {
  if (currentActCode(state) !== ACT_CODES[1]) return false
  if (state._roundEndWindow !== true) return false
  const alive = activeInvestigators(state)
  if (!alive.length) return false
  if (!alive.every(inv => inv.location === TWISTED_HOLLOW_LOCATION_ID)) return false
  if (!findLocation(state, TWISTED_HOLLOW_LOCATION_ID)) return false
  const required = 2 * investigatorCount(state)
  if (groupClues(state) < required) return false
  if (!askAdvance(state, api, `回合结束：全员在扭曲空洞，是否共同支付 ${required} 个线索推进幕 2？`)) return false
  payGroupClues(state, required, api)
  info(api, `幕 2 目标达成：全员在扭曲空洞，共同支付 ${required} 个线索。`)
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

/** 特殊议程目标：每位未被击败的调查员都已撤退 → 结局 1。 */
export function checkBackToTheValeObjective(state, api = {}) {
  if (!(currentActCode(state) === SPECIAL_AGENDA_CODE || currentAgendaFrontCode(state) === SPECIAL_AGENDA_CODE)) return false
  const survivors = (state.investigators || []).filter(inv => inv && !inv.defeated)
  if (!survivors.length) return false
  if (survivors.some(inv => !inv.resigned)) return false
  info(api, '「回到山谷！」目标达成：所有未被击败的调查员都已撤退 → 结局 1。')
  if (typeof api.finish === 'function') api.finish('resolution1')
  else state.resolution = 'resolution1'
  return true
}

export function checkObjectives(state, api = {}) {
  if (checkActOneObjective(state, api)) return true
  if (checkActTwoObjective(state, api)) return true
  if (checkBackToTheValeObjective(state, api)) return true
  return false
}

/** 全体撤退：特殊议程在场时进入结局 1，否则无结局（随后由 resolution 跳到结局 3）。 */
export function allResigned(state, api = {}) {
  if (checkBackToTheValeObjective(state, api)) return true
  if (typeof api.finish === 'function') api.finish(NO_RESOLUTION)
  else state.resolution = NO_RESOLUTION
  return true
}

// ---------------------------------------------------------------------------
// 调查阶段结束（议程 1 正面）
// ---------------------------------------------------------------------------

/** 引擎读点 phaseBegan：敌人阶段紧接调查阶段之后，用它结算「调查阶段结束时」。 */
export function phaseBegan(state, phase, api = {}) {
  if (phase === 'upkeep') {
    const asset = lanternAsset(state)
    if (asset?.exhausted) {
      asset.exhausted = false
      lanternRecord(state).exhausted = false
    }
  }
  if (phase !== 'enemy') return false
  if (currentAgendaFrontCode(state) !== AGENDA_CODES[0]) return false
  let handled = false
  for (const inv of activeInvestigators(state)) {
    const location = findLocation(state, inv.location)
    if (!isDarkLocation(state, location)) continue
    handled = true
    const pursuit = pursuitWithHighest(state, api, 'evade')
    const options = [
      { id: 'horror', label: '受到 1 点恐惧（不能被取消）' },
      ...(pursuit.length ? [{ id: 'pursuit', label: '抽取一名追击中躲避值最高的敌人' }] : []),
    ]
    const choice = typeof api?.choose === 'function'
      ? api.choose({ kind: 'choice', source: AGENDA_CODES[0], seat: inv.seat,
        prompt: '调查阶段结束：你在[[黑暗]]地点，选择一项。', options })
      : (pursuit.length ? 'pursuit' : 'horror')
    if (choice === 'pursuit' && pursuit.length) {
      const enemy = pursuit[0]
      const restored = spawnFromPursuit(state, api, { enemy, location: inv.location, seat: inv.seat })
      info(api, `${inv.name} 抽取追击中的「${enemy.name || enemy.code}」${restored ? `到「${findLocation(state, inv.location)?.name || inv.location}」` : ''}。`)
    } else {
      applyDirectHorror(state, inv, 1, api)
      info(api, `${inv.name} 在[[黑暗]]地点，受到 1 点恐惧（不能被取消）。`)
    }
  }
  return handled
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return twistedHollowChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return twistedHollowChaosTokenValue(state, tokenFace, inv)
}

/** 困难面 [cultist]「检定成功才治愈 1 点伤害」没有 onSuccess 通道 → 在 afterTest 结算。 */
export function afterTest(state, inv, result, api = {}, details = {}) {
  if (!inv || !result) return false
  if (!isHardSide(state)) return false
  const drawn = details.resolvedTokens || result.drawn || []
  const tokens = Array.isArray(drawn) ? drawn : []
  const hasCultist = tokens.some(token => (typeof token === 'string' ? token : token?.token || token?.face) === 'cultist')
  if (!hasCultist || result.success !== true) return false
  if (typeof api.healDamage === 'function') api.healDamage(inv.seat, 1)
  else inv.damage = Math.max(0, (Number(inv.damage) || 0) - 1)
  info(api, `[cultist]（困难面）：检定成功，治愈 ${inv.name} 的 1 点伤害。`)
  return true
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  if (effect.token === 'cultist') {
    if (typeof api.healDamage === 'function') api.healDamage(inv.seat, 1)
    else inv.damage = Math.max(0, (Number(inv.damage) || 0) - 1)
    info(api, `[cultist]：治愈 ${inv.name} 的 1 点伤害。`)
    return true
  }
  if (effect.token === 'tablet') {
    const candidates = pursuitWithHighest(state, api, 'evade')
    const enemy = candidates[0]
    if (!enemy) {
      info(api, '[tablet]：追击区域没有敌人。')
      return true
    }
    const spawned = spawnFromPursuit(state, api, { enemy, location: inv.location, seat: inv.seat })
    info(api, `[tablet]：把追击中躲避值最高的「${enemy.name || enemy.code}」${spawned ? `生成在「${findLocation(state, inv.location)?.name || inv.location}」` : '生成失败'}。`)
    return true
  }
  if (effect.token === 'elderthing') {
    applyDirectHorror(state, inv, 1, api)
    info(api, `[elder_thing]：${inv.name} 受到 1 点恐惧。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

const RESOLUTION_EFFECTS = Object.freeze({
  noResolution: { record: RECORD_BERTIE_LOST },
  resolution1: { record: RECORD_BERTIE_RESCUED },
  resolution2: { record: RECORD_BERTIE_LOST },
  resolution3: {},
  standalone: {},
})

function victoryXp(state) {
  return (state.victoryDisplay || []).reduce((sum, card) => sum + (Number(card.victory) || 0), 0)
}

function bertieControlled(state) {
  const asset = (state.storyAssets || []).find(item => codeOf(item) === BERTIE_CODE)
    || (state.investigators || []).flatMap(inv => inv.assets || []).find(item => codeOf(item) === BERTIE_CODE)
  return Boolean(asset && asset.controllerSeat != null)
}

function applyResolutionRecords(state, key) {
  const records = recordsFor(state)
  const config = RESOLUTION_EFFECTS[key] || {}
  if (config.record) record(state, config.record)
  records[RECORD_RESOLUTION] = key
  records[RECORD_TIMES] = recordNumber(state, RECORD_TIMES) + 1
  // 结局 3（以及跳过到结局 3 的无结局/结局 1/2）：经验与战役日志更新。
  let bonus = 0
  if (key === 'resolution3' || key === 'noResolution' || key === 'resolution1' || key === 'resolution2') {
    bonus += 1 // 洞悉铁杉岛独特的生态系统
    if (bertieControlled(state)) bonus += 1 // 与伯蒂一起撤退
    const bear = (state.victoryDisplay || []).some(card => isUrsineCode(codeOf(card)))
      || (state.enemies || []).some(enemy => isUrsineCode(codeOf(enemy)))
    if (bear && key !== 'standalone') record(state, RECORD_BEAR_WOUNDED)
    record(state, RECORD_WESTERN_WOODS)
    bonus += victoryXp(state)
  }
  records[RECORD_XP_BONUS] = bonus
  return bonus
}

export function resolution(state, key, events = [], api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : NO_RESOLUTION
  const bonus = applyResolutionRecords(state, finalKey)
  const details = {
    resolution: recordSnapshot(state, RECORD_RESOLUTION),
    bonus,
    darkness: darknessLevel(state),
    woods: woodsDeckSize(state),
  }
  info(api, `扭曲空洞结算（${finalKey}）：黑暗等级 ${details.darkness}；奖励经验 ${bonus}。`)
  return { award: finalKey !== 'standalone', bonus, flowData: details }
}

function recordSnapshot(state, key) {
  return recordsFor(state)[key] ?? null
}

export function scenarioResolution(state, resolutionKey = 'noResolution', api = {}) {
  const result = resolution(state, resolutionKey, [], api)
  return {
    resolution: recordSnapshot(state, RECORD_RESOLUTION),
    bonus: result.bonus,
    darkness: darknessLevel(state),
    woods: woodsDeckSize(state),
    bertieRescued: recordIsTrue(state, RECORD_BERTIE_RESCUED),
    bertieLost: recordIsTrue(state, RECORD_BERTIE_LOST),
  }
}

// ---------------------------------------------------------------------------
// 行为装配
// ---------------------------------------------------------------------------

/** 本节实现行为的非玩家条目（与 index.js 的 implementedEncounterCodes 同源）。 */
export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export const events = Object.freeze({
  // 地点条目 onReveal → 章节分派（单卡条目声明读点，规则在 behavior）。
  theTwistedHollowReveal: (state, payload = {}, api = {}) => resolveLocationReveal(state,
    findLocation(state, payload.locationId), api, payload.seat ?? null),
  // 诡计条目 encounterResolve → 章节分派。
  theTwistedHollowTreachery: (state, payload = {}, api = {}) => resolveTreacheryEvent(state, payload, api),
  // 剧情资产（居民：罗莎/伯蒂）Codex 条目 → 章节分派。
  theTwistedHollowCodex: (state, payload = {}, api = {}) => resolveCodex(state, payload.key, api, { seat: payload.seat }),
})

/** 三张诡计的显现结算（Deep Shadows / Lurking Fear / Stolen Light）。 */
export function resolveTreacheryEvent(state, payload = {}, api = {}) {
  const code = String(payload.code || '')
  const seat = Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat ?? 0)
  const inv = state.investigators?.[seat]
  if (!inv) return false
  const location = findLocation(state, inv.location)
  const darkDifficulty = 5
  const baseDifficulty = 3
  const difficulty = isDarkLocation(state, location) ? darkDifficulty : baseDifficulty
  const runTest = (skill, onFail, label) => {
    if (typeof api.test !== 'function') {
      if (api.forceTestSuccess !== true) onFail()
      return true
    }
    api.test(seat, skill, difficulty, result => { if (!result.success) onFail() }, 0, { label })
    return true
  }
  if (code === '10622') {
    return runTest('willpower', () => {
      const lantern = lanternRecord(state)
      const canShift = Boolean(lantern && lantern.controllerSeat != null)
      const choice = typeof api?.choose === 'function'
        ? api.choose({
          kind: 'choice', source: code, seat, prompt: '暗影深深（失败）：选择一项。',
          options: [
            { id: 'horror', label: '受到 2 点恐惧' },
            ...(canShift ? [{ id: 'lantern', label: '山谷提灯翻到熄灭面并放在一个连接地点' }] : []),
          ],
        })
        : (canShift ? 'lantern' : 'horror')
      if (choice === 'lantern' && canShift) {
        const owner = state.investigators?.[lantern.controllerSeat]
        const destination = (findLocation(state, owner?.location)?.connections || [])
          .map(id => findLocation(state, id)).find(Boolean)
        flipLantern(state, api, { lit: false, location: destination?.id || owner?.location })
        info(api, '暗影深深：山谷提灯翻到熄灭面并放在一个连接地点。')
      } else {
        applyDirectHorror(state, inv, 2, api)
        info(api, `暗影深深：${inv.name} 受到 2 点恐惧。`)
      }
    }, `暗影深深：检定[willpower](${difficulty})`)
  }
  if (code === '10623') {
    return runTest('agility', () => {
      const enemy = pursuitWithHighest(state, api, 'fight')[0]
      const choice = typeof api?.choose === 'function'
        ? api.choose({
          kind: 'choice', source: code, seat, prompt: '惊惧潜伏（失败）：选择一项。',
          options: [
            { id: 'damage', label: '受到 2 点伤害' },
            ...(enemy ? [{ id: 'pursuit', label: '攻击值最高的追击敌人生成并与你交战' }] : []),
          ],
        })
        : (enemy ? 'pursuit' : 'damage')
      if (choice === 'pursuit' && enemy) {
        spawnFromPursuit(state, api, { enemy, location: inv.location, seat, engagedSeat: seat })
        info(api, `惊惧潜伏：「${enemy.name || enemy.code}」生成并与 ${inv.name} 交战。`)
      } else {
        applyDirectDamage(state, inv, 2, api)
        info(api, `惊惧潜伏：${inv.name} 受到 2 点伤害。`)
      }
    }, `惊惧潜伏：检定[agility](${difficulty})`)
  }
  if (code === '10624') {
    // 险境：不检定，二选一（在当前议程放 1 毁灭，或提灯熄灭并放到最远的空地点）。
    const lantern = lanternRecord(state)
    const farthest = farthestEmptyLocation(state)
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'choice', source: code, seat, prompt: '光明遭窃：选择一项。',
        options: [
          { id: 'doom', label: '在当前议程上放置 1 个毁灭（可能导致推进）' },
          ...(lantern ? [{ id: 'lantern', label: '山谷提灯翻到熄灭面并放在离所有人最远的空地点' }] : []),
        ],
      })
      : 'doom'
    if (choice === 'lantern' && lantern) {
      flipLantern(state, api, { lit: false, location: farthest || lantern.location })
      info(api, '光明遭窃：山谷提灯熄灭并放到最远的空地点。')
    } else {
      if (typeof api.addDoom === 'function') api.addDoom(1)
      else state.doom = (Number(state.doom) || 0) + 1
      info(api, `光明遭窃：在当前议程放置 1 个毁灭（当前 ${state.doom || 0}）。`)
    }
    return true
  }
  return false
}

export const behavior = {
  id: CHAPTER_ID,
  // 西部树林以未揭示面入场（起始地点因调查员在场而自动揭示，见 engine placeLocation）。
  locationsStartRevealed: false,
  // 幕目标由 checkObjectives 结算（「同一巢穴」不是引擎 objective 能表达的谓词）。
  roundEndActIndex: null,
  startLocation,
  preScenarioSetup,
  afterChaosBagSetup,
  setupLocations,
  locationPlaced,
  locationRevealed,
  locationEntered,
  afterDeckSetup,
  investigateResult,
  locationShroudModifier,
  enemyStatModifier,
  preyRank,
  actions,
  fastActions,
  performAction,
  replaceStoryAssetDeparture,
  investigatorEliminated,
  enemyConnections,
  phaseBegan,
  enemySpawned,
  enemyMoved,
  enemyAttackStarted,
  enemyAttackResolved,
  enemyDefeated,
  actReveal,
  actIndexAfterAdvance(state, previous) {
    if (codeOf(previous) === ACT_CODES[1] && currentActCode(state) === SPECIAL_AGENDA_CODE) return state.actIndex
  },
  agendaReveal,
  checkObjectives,
  allResigned,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  afterTest,
  resolution,
  scenarioResolution,
  events,
  // 具名读点（测试/主进程/共享条目可直接调用）
  setupScenario,
  setupPlan,
  syncConnections,
  gridState,
  resolveLocationReveal,
  woodsDeckSize,
  woodsDeckCards,
  placeWoodsAround,
  rebuildWoodsFromLocations,
  pursuitEnemies,
  pursuitWithHighest,
  sendToPursuit,
  spawnFromPursuit,
  lanternRecord,
  placeLantern,
  flipLantern,
  isDarkLocation,
  darkLocations,
  introBranch,
  showedTheWay,
  codexSigma,
  resolveCodex,
  outOfTheFryingPan,
  gatheringDarkness,
  backToTheValeBack,
  resolveTreacheryEvent,
  checkActOneObjective,
  checkActTwoObjective,
  checkBackToTheValeObjective,
}
