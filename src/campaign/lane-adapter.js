// 双线座位适配器（P5 批次 3）：房间座位 ↔ 线内连续座位的边界转换。
//
// 口径：docs/tde-migration-roadmap.md §7.2.2「两套座位 id，禁止混用」与 §11.2 门禁 7。
//   · 大厅命令带 **roomSeat**（0–3，`campaign.seatParts` 的下标）；
//   · 引擎运行时只接收 **laneSeat**（0–该线人数−1），`state.investigators` 在线内是密集数组；
//   · 引擎产生的 currentSeat / pendingChoice.seat(s) / humanSeats / leadSeat / 调查员与牌组记录
//     在离开适配器时必须转回 roomSeat。
//
// 本模块是**纯函数**（不 import engine、不写状态），供 P5 批次 3 的运行时重建、观察投影
// 与大厅命令入口共用；P3 的 `campaign-parts.js` 提供底层映射，这里补齐「一整条边界」：
// 命令、待决选择、座位列表、事件 lane 标记与密集性断言。
import { laneCounts, laneSeatOf as partLaneSeatOf, normalizeSeatParts, roomSeatOf as partRoomSeatOf, seatsOfLane } from './campaign-parts.js'

export const LANES = Object.freeze(['A', 'B'])

/** 当前活动线：并行两条同时活动时返回 null（由调用方按事件 lane 分流）。 */
export function activeLane(campaign) {
  const current = campaign?.currentPart ?? null
  if (current) return current
  const active = Array.isArray(campaign?.activeParts) ? campaign.activeParts : []
  return active.length === 1 ? active[0] : null
}

/** 线内座位表：`{ A: [roomSeat...], B: [...] }`（由 seatParts 派生，不持久化第二份真相）。 */
export function laneSeats(campaign) {
  const seatParts = normalizeSeatParts(campaign?.seatParts || [])
  return { A: seatsOfLane(seatParts, 'A'), B: seatsOfLane(seatParts, 'B') }
}

/** 房间座位 → 线内座位；越界抛错（不静默截断）。 */
export function toLaneSeat(campaign, roomSeat) {
  return partLaneSeatOf(normalizeSeatParts(campaign?.seatParts || []), roomSeat)
}

/** 线内座位 → 房间座位；非法返回 null。 */
export function toRoomSeat(campaign, lane, laneSeat) {
  return partRoomSeatOf(normalizeSeatParts(campaign?.seatParts || []), lane, laneSeat)
}

/**
 * 大厅命令进入引擎前：把 roomSeat 换成 laneSeat。
 * 非双线战役（没有 seatParts）原样返回，行为零变化。
 * 返回 `{ seat, lane, move }`；`move` 不做任何改写（命令里不放座位）。
 */
export function toLaneCommand(campaign, roomSeat, move) {
  if (!campaign?.seatParts) return { seat: roomSeat, lane: null, move }
  const lane = campaign.seatParts[roomSeat]
  if (!LANES.includes(lane)) throw new Error(`座位 ${roomSeat} 不属于任何线`)
  return { seat: toLaneSeat(campaign, roomSeat), lane, move }
}

/**
 * 引擎输出离开边界前：把 laneSeat 换成 roomSeat。
 * 供 currentSeat / humanSeats / leadSeat / 事件 seat 使用；非双线战役原样返回。
 */
export function toRoomSeatValue(campaign, lane, laneSeat) {
  if (!campaign?.seatParts || laneSeat == null) return laneSeat
  if (lane == null) return laneSeat
  return toRoomSeat(campaign, lane, laneSeat) ?? laneSeat
}

/** 座位列表转换：`{ seats, lane }` → roomSeat 列表（保持顺序，丢弃越界项）。 */
export function seatsToRoom(campaign, lane, seats) {
  if (!campaign?.seatParts) return [...(seats || [])]
  return (seats || []).map(seat => toRoomSeat(campaign, lane, seat)).filter(seat => seat != null)
}

/** 座位列表转换：roomSeat 列表 → laneSeat 列表（保持顺序，丢弃不属于该线的座位）。 */
export function seatsToLane(campaign, lane, seats) {
  if (!campaign?.seatParts) return [...(seats || [])]
  const laneSeatsOf = new Set(seatsOfLane(normalizeSeatParts(campaign.seatParts), lane))
  return (seats || []).filter(seat => laneSeatsOf.has(seat)).map(seat => toLaneSeat(campaign, seat))
}

/**
 * 待决选择的座位翻译：引擎内部 `pendingChoice` 用 laneSeat（含 seats / responderSeat / seat）；
 * 投影与大厅命令用 roomSeat。返回新对象，不修改入参。
 */
export function pendingChoiceToRoom(campaign, pending, lane) {
  if (!pending) return pending
  if (!campaign?.seatParts) return pending
  const convert = seat => (Number.isInteger(seat) ? toRoomSeatValue(campaign, lane, seat) : seat)
  const copy = { ...pending }
  if (Number.isInteger(copy.seat)) copy.seat = convert(copy.seat)
  if (Array.isArray(copy.seats)) copy.seats = copy.seats.map(convert)
  if (Number.isInteger(copy.responderSeat)) copy.responderSeat = convert(copy.responderSeat)
  if (Array.isArray(copy.options)) {
    copy.options = copy.options.map(option => (Number.isInteger(option?.responderSeat)
      ? { ...option, responderSeat: convert(option.responderSeat) } : option))
  }
  return copy
}

/** 观察者所属线：`{ lane, laneSeat, roomSeat }` 或 null（不属于任何活动线 → 只给公开投影）。 */
export function laneViewFor(campaign, roomSeat) {
  if (!campaign?.seatParts) return { lane: null, laneSeat: roomSeat, roomSeat }
  const lane = campaign.seatParts[roomSeat]
  if (!LANES.includes(lane)) return null
  const active = campaign.activeParts || (campaign.currentPart ? [campaign.currentPart] : [])
  if (active.length && !active.includes(lane)) return null
  return { lane, laneSeat: toLaneSeat(campaign, roomSeat), roomSeat }
}

/** 运行期座位必须密集（0..n-1 无洞）：返回 `{ ok, problems }`，供重建后断言。 */
export function assertDenseRuntime(investigators) {
  const problems = []
  const seats = (investigators || []).map(inv => inv?.seat)
  if (seats.some(seat => !Number.isInteger(seat))) problems.push('运行时调查员缺少整数 seat')
  const sorted = [...seats].sort((left, right) => left - right)
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index) { problems.push(`线内座位不密集：期望 ${index}，实际 ${sorted[index]}`); break }
  }
  return { ok: problems.length === 0, problems, count: seats.length }
}

/**
 * 事件 lane 标记：引擎事件在 append 前标记 `lane: 'A'|'B'|'shared'`，并把事件内 seat 转回 roomSeat。
 * 非双线战役返回原事件（不写 lane 字段，事件形状与旧版本逐字节一致）。
 */
export function tagEventLane(campaign, event, lane = null) {
  if (!campaign?.seatParts || !event || typeof event !== 'object') return event
  const targetLane = lane || activeLane(campaign)
  const copy = { ...event, lane: targetLane || 'shared' }
  if (Number.isInteger(copy.seat)) {
    copy.seat = targetLane ? toRoomSeatValue(campaign, targetLane, copy.seat) : copy.seat
  }
  return copy
}

/** 观察者可看的事件：shared 全可见；本线可见；另一线/无 lane 的私有事件不可见。 */
export function visibleToLane(event, view) {
  const lane = event?.lane
  if (!lane || lane === 'shared') return true
  if (!view) return false
  return lane === view.lane
}

/** 座位统计（hub/投影共用）：总人数、两线人数、是否存在空线。 */
export function laneSummary(campaign) {
  const seatParts = normalizeSeatParts(campaign?.seatParts || [])
  const counts = laneCounts(seatParts)
  return { total: seatParts.length, ...counts, empty: counts.A === 0 || counts.B === 0 }
}
