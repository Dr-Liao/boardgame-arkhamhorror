// 线内运行时重建（P5 批次 3）：进入某条线的关卡时把座位改成线内连续座位。
//
// 口径：双线迁移路线图 §7.2.2（座位 id 两套、禁止混用）。
//   · 大厅/关间用 **roomSeat**（0–3，`campaign.seatParts` 下标）；
//   · 关卡运行只装当前线的座位，且线内座位必须密集（0..n-1）；`campaign.investigators`
//     在该线作用域里同样改成以 laneSeat 为键（引擎 194 处 `campaign.records` / 调查员记录读点
//     因此不需要知道双线）；
//   · 离开关卡时把记录键改回 roomSeat，并恢复关间的全部座位运行时（备份在 `state.laneRuntime`）。
//
// 本模块只操作 state 数据，不 import engine，也不认识具体战役；非双线战役（没有
// `campaign.seatParts`）调用是 no-op，状态字节不变。
import { laneSeatOf, seatsOfLane } from '../campaign/campaign-parts.js'

const clone = value => structuredClone(value)

function remapSeatKeyed(object, mapping) {
  const out = {}
  for (const [key, value] of Object.entries(object || {})) {
    const roomSeat = mapping(Number(key))
    if (roomSeat == null) continue
    out[roomSeat] = value
  }
  return out
}

function activePart(campaign) {
  if (!campaign?.seatParts) return null
  if (campaign.currentPart) return campaign.currentPart
  const active = Array.isArray(campaign.activeParts) ? campaign.activeParts : []
  return active.length === 1 ? active[0] : null
}

/**
 * 进入当前线的关卡运行时。
 * 返回 lane runtime 描述（同时写入 `state.laneRuntime`）；重复调用幂等。
 * 若该战役没有 `seatParts`/唯一活动线，返回 null 且不改任何字段。
 */
export function enterLaneRuntime(state) {
  const campaign = state?.campaign
  const part = activePart(campaign)
  if (!part) return null
  if (state.laneRuntime) return state.laneRuntime
  if (!Array.isArray(state.investigators) || !state.investigators.length) throw new Error('进入关卡前缺少运行时调查员')
  const roomSeats = seatsOfLane(campaign.seatParts, part)
  if (!roomSeats.length) throw new Error(`${part} 线没有座位`)
  const backup = {
    investigators: state.investigators.map(inv => clone(inv)),
    humanSeats: [...(state.humanSeats || [])],
    leadSeat: campaign.leadSeat ?? null,
    currentSeat: state.currentSeat ?? null,
    hubSeatSelected: clone(state.hubSeatSelected || {}),
    hubSeatDone: clone(state.hubSeatDone || {}),
    hubUpgradedSeats: clone(state.hubUpgradedSeats || {}),
    numInvestigators: state.numInvestigators ?? state.investigators.length,
  }
  // 1) 战役记录改以 laneSeat 为键（record.seat 同步），并记下 roomSeat 供离开时还原。
  const byRoom = new Map()
  for (const [key, record] of Object.entries(campaign.investigators || {})) {
    if (!record || typeof record !== 'object') continue
    byRoom.set(Number.isInteger(record.seat) ? record.seat : Number(key), record)
  }
  const records = {}
  for (const [laneSeat, roomSeat] of roomSeats.entries()) {
    const record = byRoom.get(roomSeat)
    if (!record) throw new Error(`缺少座位 ${roomSeat} 的战役记录，无法进入 ${part} 线`)
    records[laneSeat] = { ...clone(record), seat: laneSeat, roomSeat }
  }
  campaign.investigators = records
  if (campaign.trauma) {
    campaign.trauma = Object.fromEntries(roomSeats.map((roomSeat, laneSeat) => [laneSeat, clone(campaign.trauma[roomSeat] || { physical: 0, mental: 0 })]))
  }
  // 2) 运行时调查员改成线内密集数组（保留关间准备时选好的 code/name 与自定义字段）。
  const byRoomSeat = new Map(backup.investigators.map(inv => [inv.seat, inv]))
  state.investigators = roomSeats.map((roomSeat, laneSeat) => {
    const inv = byRoomSeat.get(roomSeat)
    if (!inv) throw new Error(`缺少座位 ${roomSeat} 的运行时调查员`)
    const copy = clone(inv)
    copy.seat = laneSeat
    copy.campaignId = records[laneSeat]?.id ?? copy.campaignId
    return copy
  })
  // 3) 座位级簿记改成线内座位。
  const roomToLane = new Map(roomSeats.map((roomSeat, laneSeat) => [roomSeat, laneSeat]))
  state.humanSeats = (backup.humanSeats || []).map(seat => roomToLane.get(seat)).filter(seat => seat != null)
  state.currentSeat = Number.isInteger(backup.currentSeat) && roomToLane.has(backup.currentSeat)
    ? roomToLane.get(backup.currentSeat) : (state.humanSeats[0] ?? 0)
  campaign.leadSeat = Number.isInteger(backup.leadSeat) && roomToLane.has(backup.leadSeat)
    ? roomToLane.get(backup.leadSeat) : (state.humanSeats[0] ?? 0)
  state.hubSeatSelected = remapSeatKeyed(backup.hubSeatSelected, room => roomToLane.get(room))
  state.hubSeatDone = remapSeatKeyed(backup.hubSeatDone, room => roomToLane.get(room))
  state.hubUpgradedSeats = remapSeatKeyed(backup.hubUpgradedSeats, room => roomToLane.get(room))
  state.numInvestigators = roomSeats.length
  state.laneRuntime = { part, roomSeats, backup }
  return state.laneRuntime
}

/**
 * 离开关卡运行时（回到关间/结算台面）：记录键与座位簿记都改回 roomSeat，
 * 并恢复进入前的全部座位运行时。没有 `state.laneRuntime` 时是 no-op。
 */
export function leaveLaneRuntime(state) {
  const lane = state?.laneRuntime
  if (!lane) return null
  const campaign = state.campaign
  const records = {}
  for (const [key, record] of Object.entries(campaign.investigators || {})) {
    if (!record || typeof record !== 'object') continue
    const laneSeat = Number.isInteger(record.seat) ? record.seat : Number(key)
    const roomSeat = Number.isInteger(record.roomSeat) ? record.roomSeat : lane.roomSeats[laneSeat]
    if (roomSeat == null) continue
    const copy = { ...clone(record), seat: roomSeat }
    delete copy.roomSeat
    records[roomSeat] = copy
  }
  campaign.investigators = records
  if (campaign.trauma) {
    campaign.trauma = Object.fromEntries(Object.entries(campaign.trauma || {}).map(([laneSeat, value]) => {
      const roomSeat = lane.roomSeats[Number(laneSeat)]
      return [roomSeat == null ? laneSeat : roomSeat, value]
    }))
  }
  campaign.leadSeat = lane.backup.leadSeat
  state.investigators = lane.backup.investigators.map(inv => {
    const copy = clone(inv)
    const record = records[copy.seat]
    if (record?.id) copy.campaignId = record.id
    return copy
  })
  state.humanSeats = [...(lane.backup.humanSeats || [])]
  state.currentSeat = lane.backup.currentSeat
  state.hubSeatSelected = clone(lane.backup.hubSeatSelected || {})
  state.hubSeatDone = clone(lane.backup.hubSeatDone || {})
  state.hubUpgradedSeats = clone(lane.backup.hubUpgradedSeats || {})
  // 结算快照里的 recordsBefore/After 也是线内键：离开时一起改回 roomSeat。
  for (const result of campaign.scenarioResults || []) {
    if (result.recordsBefore) result.recordsBefore = roomKeyedRecords(lane.roomSeats, result.recordsBefore)
    if (result.recordsAfter) result.recordsAfter = roomKeyedRecords(lane.roomSeats, result.recordsAfter)
  }
  state.numInvestigators = lane.backup.numInvestigators ?? state.investigators.length
  delete state.laneRuntime
  return lane.part
}

/** 当前关卡运行时是否处于某条线（供边界包装判断）。 */
export function currentLaneRuntime(state) {
  return state?.laneRuntime || null
}

/** 线内座位 ↔ 房间座位（进入后使用；不存在运行时返回 null）。 */
export function laneToRoomSeat(state, laneSeat) {
  const lane = state?.laneRuntime
  if (!lane || !Number.isInteger(laneSeat)) return null
  return lane.roomSeats[laneSeat] ?? null
}

export function roomToLaneSeat(state, roomSeat) {
  const lane = state?.laneRuntime
  if (!lane || !Number.isInteger(roomSeat)) return null
  const index = lane.roomSeats.indexOf(roomSeat)
  return index >= 0 ? index : null
}

/** 供大厅边界使用：把 roomSeat 换成 laneSeat；不属于当前线返回 null。 */
export function laneSeatForRoom(state, roomSeat) {
  const lane = state?.laneRuntime
  if (!lane) return Number.isInteger(roomSeat) ? roomSeat : null
  return roomToLaneSeat(state, roomSeat)
}

/** 事件里的座位：引擎事件按 laneSeat 生成，离开引擎前必须换成 roomSeat。 */
export function roomSeatForEvent(state, seat) {
  if (!state?.laneRuntime || seat == null) return seat
  return laneToRoomSeat(state, seat) ?? seat
}

/** 把快照里的 records（以 laneSeat 为键）改回 roomSeat；用于 scenarioResults 存档快照。 */
export function roomKeyedRecords(roomSeats, records) {
  if (!records || typeof records !== 'object') return records
  const out = {}
  for (const [key, record] of Object.entries(records)) {
    const laneSeat = Number.isInteger(record?.seat) ? record.seat : Number(key)
    const roomSeat = record?.roomSeat ?? roomSeats[laneSeat]
    if (roomSeat == null) { out[key] = record; continue }
    const copy = { ...structuredClone(record), seat: roomSeat }
    delete copy.roomSeat
    out[roomSeat] = copy
  }
  return out
}

// 兼容命名：与 campaign-parts 的 laneSeatOf 一致（供测试/文档引用）。
export { laneSeatOf }
