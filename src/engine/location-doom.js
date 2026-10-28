// 地点毁灭（P3 批次 3 原语 `location.doom`）。
//
// B4《编织宇宙》的「大网」地点：地点上累积毁灭标记，达到阈值就**毁灭**（移出游戏，
// 并把毁灭加到议程上 / 触发剧本后果）。与 `state.doom`（全桌毁灭）分开记账。
//
// 口径：食梦者迁移路线 §5.2 `location.doom`；账本 batch P3-3。
// 纯数据：只写 `location.doomOnLocation`；未使用该原语的地点不产生字段。

/** 地点当前的毁灭标记数（未记录 = 0）。 */
export function locationDoomOf(location) {
  const value = location?.doomOnLocation
  return Number.isInteger(value) && value > 0 ? value : 0
}

/** 地点毁灭阈值（未声明 = null，表示不会被毁灭计数推倒）。 */
export function locationDoomThreshold(location) {
  const value = location?.doomThreshold
  return Number.isInteger(value) && value > 0 ? value : null
}

/** 加/减地点毁灭（0 下限；返回新值）。 */
export function addLocationDoom(location, delta = 1) {
  if (!location || typeof location !== 'object') throw new Error('addLocationDoom 需要地点对象')
  const next = Math.max(0, locationDoomOf(location) + (Number(delta) || 0))
  location.doomOnLocation = next
  return next
}

/** 是否达到毁灭阈值。 */
export function shouldDestroyLocation(location) {
  const threshold = locationDoomThreshold(location)
  return threshold != null && locationDoomOf(location) >= threshold
}

/**
 * 毁灭地点：移出 `state.locations`，记入 `state.destroyedLocations`（幂等），返回 `{ destroyed, code, doom }`。
 * 是否把毁灭加到议程上由调用方决定（`addDoom` 注入），本模块不猜。
 */
export function destroyLocation(state, locationId, { addDoom = null } = {}) {
  state.locations ||= []
  const index = state.locations.findIndex(location => String(location.id) === String(locationId))
  if (index < 0) return { destroyed: false, code: null, doom: 0 }
  const location = state.locations[index]
  if (!shouldDestroyLocation(location)) return { destroyed: false, code: location.originalCode || location.code, doom: locationDoomOf(location) }
  state.locations.splice(index, 1)
  state.destroyedLocations ||= []
  const code = location.originalCode || location.code
  if (!state.destroyedLocations.includes(code)) state.destroyedLocations.push(code)
  const doom = locationDoomOf(location)
  if (typeof addDoom === 'function' && doom > 0) addDoom(state, doom)
  return { destroyed: true, code, doom }
}

/** 全桌地点毁灭总数（议程阈值/UI 用）。 */
export function totalLocationDoom(state) {
  return (state?.locations || []).reduce((sum, location) => sum + locationDoomOf(location), 0)
}

/** 注册期校验：阈值必须是正整数，且同一剧本的阈值口径一致（返回问题列表）。 */
export function normalizeLocationDoom(locations) {
  const problems = []
  const thresholds = new Set()
  for (const location of locations || []) {
    const value = location.doomThreshold
    if (value == null) continue
    if (!Number.isInteger(value) || value <= 0) problems.push(`${location.code || location.id}：阈值必须是正整数（收到 ${value}）`)
    else thresholds.add(value)
  }
  return { ok: problems.length === 0, thresholds: [...thresholds].sort((a, b) => a - b), problems }
}
