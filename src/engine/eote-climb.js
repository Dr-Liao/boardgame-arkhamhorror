// 七循环《地球边缘》第二章《失落之峰》的攀登原语（P2 `scenario.climb`）。
//
// 数据口径：
//   · 地点的印刷 Level 落在地点对象上（`location.level`，见 vertical-chain.js 的
//     `locationLevel`/`setLocationLevel`），本模块不另建「层号 → 地点」表；
//     层 → 地点的映射永远由 `state.locations` 现算。
//   · 场景级状态只保存**瞬时标记**：`scenarioFlags.mechanics.eote.climb =
//     { version: 1, seats: { "<seat>": { from, to, fromLevel, toLevel, direction, enterFromBelow } } }`。
//     每个座位只保留最近一次升降记录，供卡面/剧本运行时读取「从下方进入」的强制效果；
//     没有登记过的战役不会多出字段（读点从不初始化容器）。
//   · 随机性：本模块不掷骰、不洗牌（坠落伤害按层差换算，见 fallDamage 注释），
//     因此不需要 randomValue，也不需要注入 shuffle。
//
// 参考口径（只读来源 `参考资源/ArkhamHorror-main/.../EdgeOfTheEarth/`）：
//   · 失落之峰把五张山腰地点 + 山顶摆成一条斜线，位置自带 Level 0–5；连接由布置产生
//     （参考实现用 `connectsToAdjacent`，本引擎沿用既有 `connections` 数据）。
//   · `Moves #after You AnySource (below a) (be a)` 是「从下方进入」强制效果的统一写法，
//     即 fromLevel < toLevel；因此 `ascend` 返回 `enterFromBelow: true`，下行不触发。
//   · 攀登没有额外的费用/限制；「只能跨一层」是本原语的显式契约（避免内容层把斜线
//     之外的连接当成可攀登），跨越两层必须拆成多次移动。
//   · 移动本身（揭示、敌人跟随、进入窗口）由权威移动管线执行；本模块只做
//     校验 + 返回 transition + 记录瞬时标记，不搬动 `inv.location`，避免绕过移动事务。
import { eoteScenarioState } from './eote-state.js'
import { locationLevel } from './vertical-chain.js'

export const EOTE_CLIMB_VERSION = 1
const CLIMB_FIELDS = Object.freeze(['version', 'seats'])
const CLIMB_SEAT_FIELDS = Object.freeze(['from', 'to', 'fromLevel', 'toLevel', 'direction', 'enterFromBelow'])

function requireState(state, label) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError(`${label}必须是对象`)
  return state
}

function requireLocationId(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label}必须是非空地点 id`)
  return value
}

function locationOf(state, id) {
  return (state.locations || []).find(location => String(location.id) === String(id)) || null
}

// 调查员参数既可以是权威实例，也可以是与 state 对应的实例；一律按座位回表校验，
// 防止调用方拿旧副本写出别人的标记。座位非法抛错，座位不在场也抛错（参数问题）。
function requireInvestigator(state, inv, label = '调查员') {
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) throw new TypeError(`${label}必须是对象`)
  if (!Number.isSafeInteger(inv.seat)) throw new TypeError(`${label}座位无效`)
  const target = state.investigators?.[inv.seat]
  if (!target) throw new RangeError('无效调查员座位')
  return target
}

function isConnected(from, toId) {
  return (from.connections || []).some(id => String(id) === String(toId))
}

function pushFlag(state, transition) {
  const data = eoteScenarioState(state, true)
  const climb = data.climb ||= { version: EOTE_CLIMB_VERSION }
  climb.version = EOTE_CLIMB_VERSION
  const seats = climb.seats ||= {}
  seats[String(transition.seat)] = {
    from: transition.from,
    to: transition.to,
    fromLevel: transition.fromLevel,
    toLevel: transition.toLevel,
    direction: transition.direction,
    enterFromBelow: transition.enterFromBelow,
  }
  return transition
}

/** 攀登瞬时标记的只读入口；从未使用过返回 null（不创建容器）。 */
export function climbState(state) {
  const climb = eoteScenarioState(state)?.climb
  if (!climb) return null
  const seats = {}
  for (const [seat, entry] of Object.entries(climb.seats || {})) seats[seat] = { ...entry }
  return { version: climb.version, seats }
}

/**
 * 攀登目的地校验：返回 null 表示合法，否则返回中文错误串。
 * 规则：两地之间必须已有 `connections` 连接，且 Level 差恰为 ±1（只能跨一层）；
 * 同层移动不是攀登（由普通移动管线处理），跨两层必须拆分。地点/Level 缺失属于
 * 「非法游戏状态」返回错误串；id 类型不合法属于调用参数错误，直接抛错。
 */
export function climbDestinationError(state, fromId, toId) {
  requireState(state, '状态')
  requireLocationId(fromId, '起点')
  requireLocationId(toId, '目标')
  const from = locationOf(state, fromId)
  const to = locationOf(state, toId)
  if (!from) return '起点地点不存在'
  if (!to) return '目标地点不存在'
  if (String(from.id) === String(to.id)) return '不能移动到原地'
  const fromLevel = locationLevel(from)
  const toLevel = locationLevel(to)
  if (fromLevel == null) return '起点地点没有声明 Level'
  if (toLevel == null) return '目标地点没有声明 Level'
  if (!isConnected(from, to.id)) return '两地不直接相连'
  if (toLevel === fromLevel) return '同层移动不属于攀登'
  if (Math.abs(toLevel - fromLevel) !== 1) return '只能攀爬相邻高度（Level ±1）'
  return null
}

/** 向上攀登：校验 + 返回 transition + 记录「从下方进入」瞬时标记；不做实际位移。 */
export function ascend(state, inv, toId) {
  requireState(state, '状态')
  const target = requireInvestigator(state, inv)
  requireLocationId(toId, '目标')
  const fromId = target.location
  if (typeof fromId !== 'string' || !fromId) return false
  if (climbDestinationError(state, fromId, toId) != null) return false
  const fromLevel = locationLevel(state, fromId)
  const toLevel = locationLevel(state, toId)
  if (fromLevel == null || toLevel == null || toLevel !== fromLevel + 1) return false
  return pushFlag(state, {
    seat: target.seat, from: String(fromId), to: String(toId), fromLevel, toLevel,
    direction: 'up', enterFromBelow: true,
  })
}

/** 向下移动：只接受 Level − 1 的相邻地点；返回 transition 并记录 direction: 'down'。 */
export function descend(state, inv, toId) {
  requireState(state, '状态')
  const target = requireInvestigator(state, inv)
  requireLocationId(toId, '目标')
  const fromId = target.location
  if (typeof fromId !== 'string' || !fromId) return false
  if (climbDestinationError(state, fromId, toId) != null) return false
  const fromLevel = locationLevel(state, fromId)
  const toLevel = locationLevel(state, toId)
  if (fromLevel == null || toLevel == null || toLevel !== fromLevel - 1) return false
  return pushFlag(state, {
    seat: target.seat, from: String(fromId), to: String(toId), fromLevel, toLevel,
    direction: 'down', enterFromBelow: false,
  })
}

/**
 * 坠落伤害换算：从高层向低层坠落时按「每坠落 1 层 1 点伤害」返回，向上/同层为 0。
 * 注：参考实现与失落之峰卡面都没有「通用坠落伤害」规则（Av alanche、Hanging on the
 * Edge 等由卡面自己给出数值），本读点只提供可复算的层差基线，真正造成伤害仍由
 * 卡牌/剧本用权威伤害入口结算；卡面已给出数值时以卡面为准。
 */
export function fallDamage(state, fromLevel, toLevel) {
  requireState(state, '状态')
  for (const [label, value] of [['起点 Level', fromLevel], ['终点 Level', toLevel]]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}必须是非负整数`)
  }
  return toLevel >= fromLevel ? 0 : fromLevel - toLevel
}

/**
 * 「移动后归还全部线索」（08597/08598：After you move to a location: Return all of
 * your clues to the token pool）的只读换算：返回本次应归还的线索数。
 * `clueCount` 可选，用于本次移动只归还部分线索的变体（默认取调查员当前全部线索）。
 * 不修改 `inv.clues`：归还必须走权威线索入口，调用方按返回值结算，失败时无部分写入。
 */
export function cluesLostOnMove(state, inv, { clueCount = null } = {}) {
  requireState(state, '状态')
  const target = requireInvestigator(state, inv)
  const current = target.clues
  if (current != null && (!Number.isSafeInteger(current) || current < 0)) return false
  const held = current ?? 0
  if (clueCount == null) return held
  if (!Number.isSafeInteger(clueCount) || clueCount < 0) throw new TypeError('clueCount 必须是非负整数')
  return Math.min(clueCount, held)
}

/**
 * 「失去对 Expedition 支援的控制并把它放在你的地点」的只读换算（失落之峰 tablet
 * 符号 / White Bluff / Hanging on the Edge）：返回应掉落的支援记录，按传入顺序。
 * 不改动 `inv.assets`、不改写支援位置：调用方在移动/失败事务里执行权威的离开控制
 * 与放置。`assetIds` 由卡面/剧本决定（本原语不按卡号或特性猜支援）。
 * 返回 `[{ assetId, code, location, seat }]`；非法游戏状态（支援不在该调查员控制下、
 * 调查员不在场地点）返回 false 且不写状态。
 */
export function dropExpeditionAssets(state, inv, { assetIds } = {}) {
  requireState(state, '状态')
  const target = requireInvestigator(state, inv)
  if (assetIds == null) return []
  if (!Array.isArray(assetIds) || assetIds.some(id => typeof id !== 'string' || !id)) {
    throw new TypeError('assetIds 必须是非空支援 id 数组')
  }
  if (new Set(assetIds).size !== assetIds.length) throw new TypeError('assetIds 不能重复')
  if (!assetIds.length) return []
  const location = target.location
  if (typeof location !== 'string' || !locationOf(state, location)) return false
  const ownAssets = target.assets || []
  const records = []
  for (const assetId of assetIds) {
    const asset = ownAssets.find(item => String(item.id) === String(assetId))
    if (!asset) return false
    records.push({ assetId: String(asset.id), code: asset.code ?? null, location, seat: target.seat })
  }
  return records
}

/** 读档校验：`climb` 瞬时标记的形状、字段、座位、地点与 Level 必须自洽。 */
export function validateEoteClimb(state, value = eoteScenarioState(state)?.climb) {
  requireState(state, '状态')
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('攀登状态必须是对象')
  for (const key of Object.keys(value)) if (!CLIMB_FIELDS.includes(key)) throw new TypeError(`攀登状态未知字段 ${key}`)
  if (value.version !== EOTE_CLIMB_VERSION) throw new TypeError('不支持的攀登状态版本')
  const seats = value.seats
  if (seats == null) return true
  if (typeof seats !== 'object' || Array.isArray(seats)) throw new TypeError('攀登座位记录必须是对象')
  for (const [key, entry] of Object.entries(seats)) {
    const seat = Number(key)
    if (!Number.isSafeInteger(seat) || String(seat) !== key) throw new TypeError('攀登记录座位无效')
    if (state.investigators && !state.investigators[seat]) throw new TypeError('攀登记录座位不在场')
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('攀登记录必须是对象')
    for (const field of Object.keys(entry)) if (!CLIMB_SEAT_FIELDS.includes(field)) throw new TypeError(`攀登记录未知字段 ${field}`)
    if (typeof entry.from !== 'string' || !entry.from) throw new TypeError('攀登记录起点无效')
    if (typeof entry.to !== 'string' || !entry.to) throw new TypeError('攀登记录终点无效')
    if (entry.from === entry.to) throw new TypeError('攀登记录起点与终点相同')
    if (!['up', 'down'].includes(entry.direction)) throw new TypeError('攀登方向无效')
    if (typeof entry.enterFromBelow !== 'boolean') throw new TypeError('攀登进入标记无效')
    if (entry.enterFromBelow !== (entry.direction === 'up')) throw new TypeError('攀登进入标记与方向不一致')
    const from = locationOf(state, entry.from)
    const to = locationOf(state, entry.to)
    if (!from || !to) throw new TypeError('攀登记录地点不在场')
    if (!Number.isSafeInteger(entry.fromLevel) || entry.fromLevel < 0) throw new TypeError('攀登记录起点 Level 无效')
    if (!Number.isSafeInteger(entry.toLevel) || entry.toLevel < 0) throw new TypeError('攀登记录终点 Level 无效')
    if (locationLevel(from) !== entry.fromLevel) throw new TypeError('攀登记录起点 Level 与地点不一致')
    if (locationLevel(to) !== entry.toLevel) throw new TypeError('攀登记录终点 Level 与地点不一致')
    if (entry.direction === 'up' && entry.toLevel !== entry.fromLevel + 1) throw new TypeError('攀登记录高度不连续')
    if (entry.direction === 'down' && entry.toLevel !== entry.fromLevel - 1) throw new TypeError('下行记录高度不连续')
  }
  return true
}
