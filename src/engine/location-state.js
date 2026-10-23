// 裂口（Breach）与地点布尔状态（火盆）—— 第 2 步 P2.11。
//
// 两个机制都挂在**地点实例**上，纯 JSON：
//   · 裂口：《混沌魔掌》的 `breaches` 计数器，沿连接传播；地点的骷髅值 = 裂口 + 其上毁灭标记。
//   · 火盆：《聚合幻灭》的布尔状态（点燃/熄灭），决定推进哪一版幕。
//
// 状态形状（写在地点实例上，随存档往返）：
//   location.breaches: number            // 缺省 0
//   location.flags: { brazier: boolean } // 缺省空对象
//
// 读点：
//   breachOf / addBreach / removeBreach / locationSkullValue / breachTotal
//   locationFlagOf / setLocationFlag / locationFlagsOf
// 内容层通过 scenarioRuntime 的 `breach/removeBreach/locationFlag/setLocationFlag` 调用；
// 公开投影在 `src/cards/campaign-view.js` 的 `locations` 字段（只含有标记的地点、只给公开值）。

export const LOCATION_FLAGS = Object.freeze(['brazier'])
export const BREACH_LIMIT = 3

function fail(message) {
  throw new Error(`地点状态无效：${message}`)
}

export function normalizeLocationFlag(flag) {
  const value = String(flag ?? '')
  if (!LOCATION_FLAGS.includes(value)) fail(`未知地点标记 ${JSON.stringify(flag)}（可用：${LOCATION_FLAGS.join('、')}）`)
  return value
}

function findLocation(state, locationId) {
  return (state?.locations || []).find(location => location.id === locationId)
    || state?.scenario?.locations?.[locationId]
    || null
}

// 裂口数：缺省 0；容错旧存档的字符串/负数。
export function breachOf(location) {
  const value = Number(location?.breaches || 0)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export function addBreach(state, locationId, amount = 1, { limit = BREACH_LIMIT } = {}) {
  const location = findLocation(state, locationId)
  if (!location) return null
  location.breaches = Math.min(limit, breachOf(location) + Math.max(0, Math.floor(amount)))
  return location.breaches
}

export function removeBreach(state, locationId, amount = 1) {
  const location = findLocation(state, locationId)
  if (!location) return null
  location.breaches = Math.max(0, breachOf(location) - Math.max(0, Math.floor(amount)))
  if (!location.breaches) delete location.breaches
  return breachOf(location)
}

// 骷髅值 = 地点裂口 + 地点上的毁灭标记（《混沌魔掌》）。
export function locationSkullValue(state, locationId) {
  const location = findLocation(state, locationId)
  if (!location) return 0
  return breachOf(location) + Number(location.doom || 0)
}

export function breachTotal(state) {
  return (state?.locations || []).reduce((sum, location) => sum + breachOf(location), 0)
}

// 布尔地点标记（火盆等）。
export function locationFlagOf(location, flag) {
  const key = normalizeLocationFlag(flag)
  return location?.flags?.[key] === true
}

export function locationFlagsOf(location) {
  const out = {}
  for (const flag of LOCATION_FLAGS) if (location?.flags?.[flag] === true) out[flag] = true
  return out
}

export function setLocationFlag(state, locationId, flag, value = true) {
  const key = normalizeLocationFlag(flag)
  const location = findLocation(state, locationId)
  if (!location) return null
  location.flags ||= {}
  if (value) location.flags[key] = true
  else delete location.flags[key]
  return locationFlagOf(location, key)
}

// 公开投影：只含有裂口/标记的地点；都是桌面公开信息。
export function locationStateProjection(state) {
  const out = {}
  for (const location of state?.locations || []) {
    const breaches = breachOf(location)
    const flags = locationFlagsOf(location)
    const entry = { ...(breaches ? { breaches } : {}), ...(Object.keys(flags).length ? { flags } : {}) }
    if (Object.keys(entry).length) out[location.id] = entry
  }
  return out
}
