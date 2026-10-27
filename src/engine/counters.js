// 按调查员的计数器（批次 2 原语 `counter.investigator`）。
//
// 用途：警报等级（A3 的 0–5+，按调查员而非全桌）、赏金（Tony）、以及任何「每名调查员各有
// 一份计数」的剧本机制。与 `state.doom`/`state.clues` 这类全桌计数区别开。
//
// 口径：docs/-migration-roadmap.md §5.2 `counter.investigator`；账本 primitive-plan.json 的 batch P3-2。
// 纯数据：只读写 `state.investigatorCounters`，不 import engine；未使用的战役不产生新字段。
// 状态形状：`state.investigatorCounters = { [counterId]: { seats: number[], max: number|null } }`。

export const COUNTER_IDS = Object.freeze(['alarmLevel', 'bounty'])
export const ALARM_LEVEL_MAX = 5

function counters(state) {
  state.investigatorCounters ||= {}
  return state.investigatorCounters
}

// 只读访问：不创建字段（未使用计数的战役必须零字节变化）。
function readCounters(state) {
  return state && typeof state === 'object' && state.investigatorCounters ? state.investigatorCounters : {}
}

function entryFor(state, id, max = null) {
  if (!id) throw new Error('counter 需要 id')
  const table = counters(state)
  table[id] ||= { seats: [], max: null }
  if (max != null) table[id].max = max
  return table[id]
}

function normalizeSeat(seat) {
  const value = Number(seat)
  if (!Number.isInteger(value) || value < 0) throw new Error(`非法座位：${String(seat)}`)
  return value
}

/** 某座位某计数的当前值（未记录 = 0）。 */
export function counterOf(state, seat, id) {
  if (!id) throw new Error('counter 需要 id')
  const seatIndex = normalizeSeat(seat)
  const table = readCounters(state)[id]
  return table?.seats?.[seatIndex] ?? 0
}

/** 某计数的上限（未声明 = null）。 */
export function counterMax(state, id) {
  return readCounters(state)[id]?.max ?? null
}

/** 设置上限；返回旧上限。 */
export function setCounterMax(state, id, max) {
  const entry = entryFor(state, id)
  const previous = entry.max
  entry.max = max == null ? null : Number(max)
  return previous
}

/** 直接设值（会按已声明的上限 clamp；返回写入后的值）。 */
export function setCounter(state, seat, id, value, { max = undefined } = {}) {
  const entry = entryFor(state, id, max)
  const seatIndex = normalizeSeat(seat)
  const limit = entry.max
  const next = Math.max(0, Number(value) || 0)
  entry.seats[seatIndex] = limit == null ? next : Math.min(next, limit)
  return entry.seats[seatIndex]
}

/** 加/减计数（默认 +1；0 下限、按上限 clamp；返回新值）。 */
export function addCounter(state, seat, id, delta = 1, { max = undefined } = {}) {
  const entry = entryFor(state, id, max)
  const seatIndex = normalizeSeat(seat)
  const current = entry.seats[seatIndex] ?? 0
  const raw = current + (Number(delta) || 0)
  const limit = entry.max
  const next = Math.max(0, limit == null ? raw : Math.min(raw, limit))
  entry.seats[seatIndex] = next
  return next
}

/** 全桌最高值（没有任何记录返回 null）。 */
export function highestCounter(state, id) {
  const seats = readCounters(state)[id]?.seats
  if (!Array.isArray(seats) || !seats.length) return null
  return seats.reduce((max, value) => Math.max(max, value ?? 0), 0)
}

/** 是否达到阈值（本循环的「5 或更高」用 >= 判定，不写成 === 5）。 */
export function counterAtLeast(state, seat, id, threshold) {
  return counterOf(state, seat, id) >= Number(threshold)
}

/** 全桌每个座位的值（观察投影用；缺座位补 0）。 */
export function counterSummary(state, id, numInvestigators = 0) {
  const seats = readCounters(state)[id]?.seats || []
  const total = Math.max(numInvestigators, seats.length)
  return Array.from({ length: total }, (_, seat) => seats[seat] ?? 0)
}

/** 清空某个计数（新一局/新一章重置用）；返回旧记录。 */
export function resetCounter(state, id) {
  const table = readCounters(state)
  const previous = table[id]
  delete table[id]
  return previous ?? null
}
