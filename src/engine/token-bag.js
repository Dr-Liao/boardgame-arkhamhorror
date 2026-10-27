// 蛛群滋生袋（批次 2 原语 `tokenBag`）。
//
// 与混乱袋（`chaos-bag.js`）语义不同：这是剧本专用的**独立 token 袋**，
// B1《清醒噩梦》用它做 infestation test（抽到「滋生」就把地点标成 infested）。
// 状态形状：`state.tokenBags = { [bagId]: { tokens: string[], revealed: string[] } }`，
// 地点标记落 `state.infestedLocations`（卡号/地点 id 数组）。
//
// 纯数据：不 import engine；未使用 token 袋的战役不产生字段。

import { randomValue } from './rules-state.js'

export const INFESTATION_BAG_ID = 'infestation'

function bags(state) {
  state.tokenBags ||= {}
  return state.tokenBags
}

function assertBagId(id) {
  if (!id || typeof id !== 'string') throw new Error('tokenBag 需要字符串 id')
  return id
}

/** 建袋（重复建会覆盖；返回 token 副本数）。 */
export function createTokenBag(state, id, tokens = []) {
  assertBagId(id)
  const bag = { tokens: [...tokens], revealed: [] }
  bags(state)[id] = bag
  return bag.tokens.length
}

/** 袋是否存在 / 剩余张数 / 已揭示内容（公开信息）。 */
export function tokenBagInfo(state, id) {
  const bag = state && state.tokenBags ? state.tokenBags[id] : undefined
  if (!bag) return { id, exists: false, count: 0, revealed: [] }
  return { id, exists: true, count: bag.tokens.length, revealed: [...bag.revealed] }
}

/** 抽 1 个 token（默认用 state.rngState 随机；返回 token 或 null）。 */
export function revealTokenFromBag(state, id, { rng = null } = {}) {
  const bag = bags(state)[id]
  if (!bag || !bag.tokens.length) return null
  const roll = typeof rng === 'function' ? rng() : randomValue(state)
  const index = Math.min(bag.tokens.length - 1, Math.floor(Math.max(0, Math.min(0.999999, roll)) * bag.tokens.length))
  const [token] = bag.tokens.splice(index, 1)
  bag.revealed.push(token)
  return token
}

/** 把已揭示的 token 放回袋里（返回是否命中）。 */
export function returnTokenToBag(state, id, token) {
  const bag = bags(state)[id]
  if (!bag) return false
  const index = bag.revealed.indexOf(token)
  if (index < 0) return false
  bag.revealed.splice(index, 1)
  bag.tokens.push(token)
  return true
}

/** 往袋里加 token（可加多个；返回总数）。 */
export function addTokenToBag(state, id, token) {
  const bag = bags(state)[id] || (bags(state)[id] = { tokens: [], revealed: [] })
  const list = Array.isArray(token) ? token : [token]
  bag.tokens.push(...list)
  return bag.tokens.length
}

/** 重置袋（新一章/新一局）：删掉整个袋并返回旧记录。 */
export function resetTokenBag(state, id, tokens = null) {
  const previous = bags(state)[id] || null
  if (tokens) bags(state)[id] = { tokens: [...tokens], revealed: [] }
  else delete bags(state)[id]
  return previous
}

// ---------------------------------------------------------------------------
// infestation 状态（B1：抽到滋生 → 地点被寄生；「已寄生地点数」影响符号）
// ---------------------------------------------------------------------------

function infested(state) {
  state.infestedLocations ||= []
  return state.infestedLocations
}

/** 标记地点被寄生（幂等）；返回是否新增。 */
export function markInfested(state, locationId) {
  const list = infested(state)
  const key = String(locationId)
  if (list.includes(key)) return false
  list.push(key)
  return true
}

/** 取消寄生；返回是否移除。 */
export function clearInfested(state, locationId) {
  const list = infested(state)
  const index = list.indexOf(String(locationId))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

/** 地点是否被寄生。 */
export function isInfestedLocation(state, locationId) {
  return infested(state).includes(String(locationId))
}

/** 已寄生地点数（B1 的 [elder_thing] 符号用它）。 */
export function infestedCount(state) {
  return infested(state).length
}
