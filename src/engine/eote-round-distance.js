// 七循环《地球边缘》investigator.roundDistance 原语（P2-F）。
//
// 印刷规则（08007 蒙特雷·杰克）：回合结束时，按「本轮起始地点」与「当前地点」之间的连接距离
// 结算资源/抽牌。参考实现用 Matcher.Investigator 的 DistanceFromRoundStart 表达同一读点。
//
// 状态形状（场景级可选扩展，见 eote-state.js；纯 JSON，随存档往返，读点从不初始化）：
//   state.scenarioFlags.mechanics.eote.roundDistance = { "<seat>": locationId }
// 只记录地点 id；距离用 map-graph.js#shortestPaths/roadDistance 现算，不存派生值，避免状态漂移。
import { roadDistance } from './map-graph.js'
import { eoteScenarioState } from './eote-state.js'

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function assertSeat(state, seat) {
  if (!Number.isSafeInteger(seat) || !state?.investigators?.[seat]) throw new RangeError('无效调查员座位')
  return state.investigators[seat]
}

function assertLocation(state, locationId, label = '地点') {
  if (typeof locationId !== 'string' || !locationId) throw new TypeError(`${label} id 必须是非空字符串`)
  if (!(state?.locations || []).some(location => location.id === locationId)) throw new RangeError(`未知${label} ${locationId}`)
  return locationId
}

function roundDistanceStore(state, create = false) {
  const scenario = eoteScenarioState(state, create)
  if (!scenario) return null
  if (create) scenario.roundDistance ||= {}
  return scenario.roundDistance || null
}

export function validateEoteRoundDistance(state, value = roundDistanceStore(state)) {
  if (value == null) return true // 旧存档没有该扩展时保持原状。
  if (!isPlainObject(value)) throw new TypeError('本轮起始地点状态必须是对象')
  for (const [key, locationId] of Object.entries(value)) {
    const seat = Number(key)
    if (!Number.isSafeInteger(seat) || String(seat) !== key || !state?.investigators?.[seat]) throw new TypeError('本轮起始地点座位无效')
    if (typeof locationId !== 'string' || !locationId) throw new TypeError('本轮起始地点 id 无效')
    assertLocation(state, locationId, '本轮起始地点')
  }
  return true
}

/** 读取本轮起始地点；未记录返回 null。 */
export function roundStartLocation(state, seat) {
  assertSeat(state, seat)
  return roundDistanceStore(state)?.[seat] ?? null
}

/** 记录本轮起始地点（回合开始/轮初调用）。 */
export function noteRoundStartLocation(state, seat, locationId) {
  assertSeat(state, seat)
  assertLocation(state, locationId)
  const store = roundDistanceStore(state, true)
  store[seat] = locationId
  return { seat, locationId }
}

/**
 * 本轮起始地点 → 当前地点的连接距离（路数）。
 * 未记录、未定位、地形不连通时返回 null（调用方按 0 奖励处理，不要猜距离）。
 */
export function travelDistance(state, seat) {
  const inv = assertSeat(state, seat)
  const from = roundDistanceStore(state)?.[seat]
  if (!from) return null
  const to = inv.location
  if (typeof to !== 'string' || !to) return null
  if (from === to) return 0
  const distance = roadDistance(state.locations || [], from, to)
  return Number.isFinite(distance) ? distance : null
}

/** 纯函数：按每点距离的奖励换算奖励；不可达/未记录返回 0。 */
export function roundDistanceReward(state, seat, { perDistance } = {}) {
  if (typeof perDistance !== 'number' || !Number.isFinite(perDistance) || perDistance < 0) {
    throw new TypeError('每点距离奖励必须是非负有限数值')
  }
  const distance = travelDistance(state, seat)
  return distance == null ? 0 : distance * perDistance
}
