// 《食梦者》双 part 数据模型（P3 骨架批次 1，D1-A 口径）。
//
// 口径：docs/tde-migration-roadmap.md §7.2.2 与 §5.5；账本：artifacts/migration/tde/primitive-plan.json。
// 本模块只做**纯数据**：
//   · 不 import 任何 engine 模块，不按卡号/战役名分支；
//   · 不改变 `state.investigators` 的座位语义（运行时座位在 P5 由 lane adapter 重建）；
//   · 所有导出函数都是确定性纯函数（除显式接收可变 state 的 setPart/inPart/mutateBothBags）。
//
// 状态形状（只有 TDE 会写入这些字段；未声明的战役不写 `parts`，状态字节不变）：
//   campaign.mode         'singleA' | 'singleB' | 'pick' | 'parallel'（可选）
//   campaign.seatParts    ['A','B','A','B']（房间座位 → 线；可选）
//   campaign.activeParts  ['A','B']（并行两条；分选/单线只有一条；可选）
//   campaign.currentPart  'A' | 'B' | null（分选/单线的当前线；并行下为 null；可选）
//   campaign.parts        { A: <非活动线快照>, B: <…> }（可选）
//
// 两条线的**共享**字段（不切片）：`scenarioResults`、`flow`/`flowStage`、`result`、`phase`、
// `scenarioIndex`、`scenarioCount`、`leadSeat`、`leadConfirmed` 等。逐线字段见 PART_SCOPED_FIELDS。

export const PARTS = Object.freeze(['A', 'B'])
export const MODES = Object.freeze(['singleA', 'singleB', 'pick', 'parallel'])

// 逐线持有的字段：切换时整块换手，跨线写入只走 recordInPart / inPart。
// `investigators` 是 campaign record（按座位键的对象），不是运行时 seat 数组。
export const PART_SCOPED_FIELDS = Object.freeze([
  'records', 'investigators', 'retired', 'trauma', 'xp', 'victory', 'chaosBag', 'storySections',
])

const SCOPED = new Set(PART_SCOPED_FIELDS)
const clone = value => structuredClone(value)

/** 一条线的默认空数据（只在首次切到该线时使用；不覆盖共享字段）。 */
export function defaultPartScope() {
  return {
    records: {},
    investigators: {},
    retired: [],
    trauma: {},
    xp: 0,
    victory: 0,
    chaosBag: [],
    storySections: {},
  }
}

function assertPart(part, label = 'part') {
  if (!PARTS.includes(part)) throw new Error(`${label} 必须是 'A' 或 'B'：${String(part)}`)
  return part
}

function assertMode(mode) {
  if (mode !== undefined && !MODES.includes(mode)) throw new Error(`未知开局模式：${String(mode)}`)
  return mode
}

// ---------------------------------------------------------------------------
// 座位映射：房间座位（roomSeat）↔ 线内连续座位（laneSeat）
// ---------------------------------------------------------------------------

/**
 * 校验 seatParts 的形状：非空数组、每个值都是 A/B。
 * 返回新的冻结数组（不保留调用方的引用）。
 */
export function normalizeSeatParts(seatParts) {
  if (!Array.isArray(seatParts) || !seatParts.length) throw new Error('seatParts 必须是非空数组')
  return Object.freeze(seatParts.map((part, seat) => assertPart(part, `seatParts[${seat}]`)))
}

/** 某条线的房间座位（升序）。 */
export function seatsOfLane(seatParts, lane) {
  assertPart(lane, 'lane')
  const parts = normalizeSeatParts(seatParts)
  return parts.reduce((out, part, seat) => (part === lane ? [...out, seat] : out), [])
}

/** 每条线的座位数。 */
export function laneCounts(seatParts) {
  const parts = normalizeSeatParts(seatParts)
  return Object.freeze({
    A: parts.filter(part => part === 'A').length,
    B: parts.filter(part => part === 'B').length,
  })
}

/** 房间座位 → 线内连续座位（0..该线人数-1）。 */
export function laneSeatOf(seatParts, roomSeat) {
  const parts = normalizeSeatParts(seatParts)
  if (!Number.isInteger(roomSeat) || roomSeat < 0 || roomSeat >= parts.length) {
    throw new Error(`房间座位越界：${String(roomSeat)}（共 ${parts.length} 个）`)
  }
  const lane = parts[roomSeat]
  let laneSeat = 0
  for (let seat = 0; seat < roomSeat; seat += 1) if (parts[seat] === lane) laneSeat += 1
  return laneSeat
}

/** 线内连续座位 → 房间座位；非法组合返回 null（不做静默截断）。 */
export function roomSeatOf(seatParts, lane, laneSeat) {
  assertPart(lane, 'lane')
  const seats = seatsOfLane(seatParts, lane)
  return Number.isInteger(laneSeat) && laneSeat >= 0 && laneSeat < seats.length ? seats[laneSeat] : null
}

/**
 * 一次算清整张映射表（建局/读档时确定性派生，不持久化第二份真相）。
 * 返回值全部是纯数据 + 三个便捷函数，便于观察投影与测试。
 */
export function seatPartMap(seatParts) {
  const parts = normalizeSeatParts(seatParts)
  const lanes = { A: seatsOfLane(parts, 'A'), B: seatsOfLane(parts, 'B') }
  const laneOfRoom = parts.slice()
  const laneSeatOfRoom = parts.map((_, seat) => laneSeatOf(parts, seat))
  const counts = laneCounts(parts)
  return Object.freeze({
    seatParts: parts,
    laneOfRoom,
    laneSeatOfRoom,
    roomSeatsOfLane: Object.freeze({ A: Object.freeze(lanes.A), B: Object.freeze(lanes.B) }),
    laneCounts: counts,
    laneOfRoomSeat: seat => laneOfRoom[seat] ?? null,
    laneSeat: seat => laneSeatOf(parts, seat),
    roomSeat: (lane, laneSeat) => roomSeatOf(parts, lane, laneSeat),
  })
}

// ---------------------------------------------------------------------------
// 开局模式与人数校验（hub 前置校验用；不写状态）
// ---------------------------------------------------------------------------

/**
 * 四种开局的人数/分线约束（§1.4.1）：
 *   singleA / singleB：1–4 人，全部座位同线；
 *   parallel：仅偶数人、两线等分；
 *   pick：两线各 ≥1 人（不得出现 0 人的线）。
 * 返回 { ok, reason }；reason 是给 hub 置灰/阻塞用的中文原因。
 */
export function validateModeSeats({ mode, seatParts }) {
  assertMode(mode)
  let parts
  try { parts = normalizeSeatParts(seatParts) } catch (error) { return { ok: false, reason: error.message } }
  const counts = laneCounts(parts)
  const total = parts.length
  if (!MODES.includes(mode)) return { ok: false, reason: `未知开局模式：${String(mode)}` }
  if (mode === 'singleA' && counts.B > 0) return { ok: false, reason: '单线 A 不允许有 B 线座位' }
  if (mode === 'singleB' && counts.A > 0) return { ok: false, reason: '单线 B 不允许有 A 线座位' }
  if (mode === 'parallel') {
    if (total % 2 !== 0) return { ok: false, reason: '并行需要两组人数相等（人数为奇数时不可用）' }
    if (counts.A !== counts.B) return { ok: false, reason: '并行需要两组人数相等' }
    return { ok: true, reason: '' }
  }
  if (mode === 'pick' && (counts.A === 0 || counts.B === 0)) {
    return { ok: false, reason: '分选双线要求两线各至少 1 个座位' }
  }
  return { ok: true, reason: '' }
}

// ---------------------------------------------------------------------------
// 逐线数据作用域
// ---------------------------------------------------------------------------

function scopeFromCampaign(campaign) {
  const scope = {}
  for (const field of PART_SCOPED_FIELDS) scope[field] = clone(campaign[field] ?? defaultPartScope()[field])
  return scope
}

function ensureParts(campaign) {
  if (!campaign.parts || typeof campaign.parts !== 'object') campaign.parts = {}
  return campaign.parts
}

/** 确保 `campaign.parts[part]` 存在，返回该线快照（不存在则建默认空线）。 */
export function ensurePartSnapshot(campaign, part) {
  assertPart(part)
  const parts = ensureParts(campaign)
  if (!parts[part]) parts[part] = defaultPartScope()
  for (const field of PART_SCOPED_FIELDS) {
    if (!(field in parts[part])) parts[part][field] = clone(defaultPartScope()[field])
  }
  return parts[part]
}

/** 读一条线的数据作用域：当前线读顶层，非活动线读 parts 快照。 */
export function partScope(campaign, part) {
  assertPart(part)
  if ((campaign.currentPart ?? null) === part) return scopeFromCampaign(campaign)
  const snapshot = campaign.parts?.[part]
  if (!snapshot) return defaultPartScope()
  const scope = {}
  for (const field of PART_SCOPED_FIELDS) scope[field] = clone(snapshot[field] ?? defaultPartScope()[field])
  return scope
}

/** 读某线的一条记录（未记录返回 undefined）。 */
export function partRecord(campaign, part, key) {
  if (!key) throw new Error('partRecord 需要 record key')
  return partScope(campaign, part).records[key]
}

/**
 * 写某线的一条记录：
 *   · 当前线 → 直接写顶层 campaign.records；
 *   · 非活动线 → 写进 parts 快照（不换 currentPart、不碰运行时座位）。
 */
export function recordInPart(campaign, part, key, value) {
  assertPart(part)
  if (!key) throw new Error('recordInPart 需要 record key')
  if ((campaign.currentPart ?? null) === part) {
    campaign.records ||= {}
    campaign.records[key] = clone(value)
    return value
  }
  const snapshot = ensurePartSnapshot(campaign, part)
  snapshot.records[key] = clone(value)
  return value
}

/**
 * 勾销（cross out）某线的一条记录：删除键并返回旧值。
 * 存在性语义与引擎一致（`campaign.records[key]` 为假 = 未记录），跨线勾销不触碰当前线。
 */
export function crossOutInPart(campaign, part, key) {
  assertPart(part)
  if (!key) throw new Error('crossOutInPart 需要 record key')
  if ((campaign.currentPart ?? null) === part) {
    campaign.records ||= {}
    const previous = campaign.records[key]
    delete campaign.records[key]
    return previous
  }
  const snapshot = ensurePartSnapshot(campaign, part)
  const previous = snapshot.records[key]
  delete snapshot.records[key]
  return previous
}

/**
 * 在目标线的数据作用域里执行 fn（只绑 records/chaosBag 等逐线数据，不换 currentPart、
 * 不换 state.investigators）。fn 内抛错时作用域仍会还原。
 */
export function inPart(state, part, fn) {
  assertPart(part)
  const campaign = state.campaign
  if (!campaign) throw new Error('inPart 需要带 campaign 的状态')
  if (typeof fn !== 'function') throw new Error('inPart 需要回调函数')
  if ((campaign.currentPart ?? null) === part) return fn(state)
  const snapshot = ensurePartSnapshot(campaign, part)
  const saved = {}
  for (const field of PART_SCOPED_FIELDS) {
    saved[field] = campaign[field]
    campaign[field] = clone(snapshot[field])
  }
  const savedStateBag = state.chaosBag
  state.chaosBag = clone(campaign.chaosBag)
  try {
    return fn(state)
  } finally {
    for (const field of PART_SCOPED_FIELDS) {
      if (SCOPED.has(field)) snapshot[field] = campaign[field]
      campaign[field] = saved[field]
    }
    state.chaosBag = savedStateBag
  }
}

// ---------------------------------------------------------------------------
// 混乱袋（两袋）
// ---------------------------------------------------------------------------

/** 读某线的混乱袋（当前线读 campaign.chaosBag，非活动线读快照）。 */
export function partChaosBag(state, part) {
  assertPart(part)
  const campaign = state.campaign
  if (!campaign) throw new Error('partChaosBag 需要带 campaign 的状态')
  if ((campaign.currentPart ?? null) === part) return campaign.chaosBag || []
  return campaign.parts?.[part]?.chaosBag || []
}

/** 同时改两袋：mutate 收到袋子副本，返回新数组（返回 undefined 视为原地修改）。 */
export function mutateBothBags(state, mutate) {
  const campaign = state.campaign
  if (!campaign) throw new Error('mutateBothBags 需要带 campaign 的状态')
  if (typeof mutate !== 'function') throw new Error('mutateBothBags 需要回调函数')
  const next = {}
  for (const part of PARTS) {
    const current = [...partChaosBag(state, part)]
    const result = mutate(current, part)
    next[part] = Array.isArray(result) ? result : current
  }
  for (const part of PARTS) {
    if ((campaign.currentPart ?? null) === part) {
      campaign.chaosBag = next[part]
      state.chaosBag = next[part]
    } else {
      const snapshot = ensurePartSnapshot(campaign, part)
      snapshot.chaosBag = next[part]
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// 切 part（五步：存快照 → 载入目标 → 带过共享 → 换线 → 重建运行时由 P5 负责）
// ---------------------------------------------------------------------------

/**
 * 切到目标线：
 *   1. 当前线（若有）整块存进 `campaign.parts[当前线]`；
 *   2. 目标线快照载入顶层逐线字段；没有快照则用 defaultPartScope；
 *   3. 共享字段（flow/scenarioResults/…）不动，天然带过；
 *   4. `campaign.currentPart = part`，`state.chaosBag` 跟 `campaign.chaosBag` 同步；
 *   5. **不**重建 `state.investigators`——那是 P5 的 lane adapter 职责。
 * 返回 { changed, from, to, initialized }。
 */
export function setPart(state, part) {
  assertPart(part)
  const campaign = state.campaign
  if (!campaign) throw new Error('setPart 需要带 campaign 的状态')
  const from = campaign.currentPart ?? null
  if (from === part) return { changed: false, from, to: part, initialized: false }
  if (from) {
    const parts = ensureParts(campaign)
    parts[from] = scopeFromCampaign(campaign)
  }
  const snapshot = campaign.parts?.[part]
  const scope = snapshot ? Object.fromEntries(PART_SCOPED_FIELDS.map(field => [field, clone(snapshot[field] ?? defaultPartScope()[field])])) : defaultPartScope()
  for (const field of PART_SCOPED_FIELDS) campaign[field] = scope[field]
  state.chaosBag = campaign.chaosBag
  campaign.currentPart = part
  return { changed: true, from, to: part, initialized: !snapshot }
}

/**
 * Flow 条件：`{ part: 'A' }`、`{ parts: ['A','B'] }`、`{ mode: 'pick' }`、
 * `{ modeIn: ['pick','parallel'] }`、`{ activeParts: ['A','B'] }`。
 * 未知键返回 false（不抛错），由 P5 的 flow 校验器在加载期拒绝未知条件。
 */
export function partFlowCondition(campaign, condition) {
  if (!condition || typeof condition !== 'object') return false
  const mode = campaign?.mode ?? null
  const currentPart = campaign?.currentPart ?? null
  const activeParts = Array.isArray(campaign?.activeParts) ? campaign.activeParts : (currentPart ? [currentPart] : [])
  if ('part' in condition && currentPart !== condition.part) return false
  if ('parts' in condition && !(Array.isArray(condition.parts) && activeParts.some(part => condition.parts.includes(part)))) return false
  if ('mode' in condition && mode !== condition.mode) return false
  if ('modeIn' in condition && !(Array.isArray(condition.modeIn) && condition.modeIn.includes(mode))) return false
  if ('activeParts' in condition && !(Array.isArray(condition.activeParts)
    && condition.activeParts.length === activeParts.length
    && condition.activeParts.every(part => activeParts.includes(part)))) return false
  return true
}

/** 建一份初始 parts 行（TDE 建局时调用；非 TDE 不调用）。 */
export function createPartsState({ mode = 'pick', seatParts, activeParts, currentPart = null } = {}) {
  assertMode(mode)
  const parts = normalizeSeatParts(seatParts)
  const counts = laneCounts(parts)
  const active = activeParts
    ? activeParts.filter(part => PARTS.includes(part))
    : mode === 'parallel' ? ['A', 'B'] : (currentPart ? [currentPart] : (counts.A > 0 ? ['A'] : ['B']))
  const decision = validateModeSeats({ mode, seatParts: parts })
  if (!decision.ok && mode !== 'singleA' && mode !== 'singleB') throw new Error(decision.reason)
  return {
    mode,
    seatParts: [...parts],
    activeParts: active,
    currentPart: mode === 'parallel' ? null : (currentPart ?? (counts.A > 0 ? 'A' : 'B')),
    parts: {},
  }
}

// ---------------------------------------------------------------------------
// 观察投影：非活动线快照脱敏（P5 批次 1）
// ---------------------------------------------------------------------------

/**
 * 把 `campaign.parts` 里的非活动线快照压成公开摘要：
 *   · 记录、经验、创伤、胜利、混乱袋属于战役日志，公开保留；
 *   · 牌组 / 购入 / 移除 / 升级草稿 / 故事段落正文一律不投影（只给张数与段数），
 *     避免另一条线的未到达分支与牌库顺序泄露；
 *   · 调查员只给身份、状态与牌组张数。
 * 未声明 parts 的战役原样返回（不写 `partsRedacted`，状态与旧投影逐字节一致）。
 */
export function partScopedView(view) {
  if (!view || !view.parts || typeof view.parts !== 'object') return view
  const parts = {}
  for (const part of PARTS) {
    const snapshot = view.parts[part]
    if (!snapshot || typeof snapshot !== 'object') continue
    const investigators = Object.values(snapshot.investigators || {}).map(record => ({
      id: record.id ?? null,
      seat: record.seat ?? null,
      code: record.code ?? null,
      name: record.name ?? null,
      status: record.status ?? null,
      deckSize: Array.isArray(record.deck) ? record.deck.length : 0,
      xp: record.xp ?? 0,
    })).sort((left, right) => (left.seat ?? 0) - (right.seat ?? 0))
    parts[part] = {
      records: clone(snapshot.records || {}),
      investigators,
      retired: clone((snapshot.retired || []).map(record => ({
        seat: record.seat ?? null, code: record.code ?? null, name: record.name ?? null, status: record.status ?? null,
      }))),
      trauma: clone(snapshot.trauma || {}),
      xp: snapshot.xp ?? 0,
      victory: snapshot.victory ?? 0,
      chaosBag: clone(snapshot.chaosBag || []),
      storySectionCount: Object.keys(snapshot.storySections || {}).length,
    }
  }
  view.parts = parts
  view.partsRedacted = true
  return view
}
