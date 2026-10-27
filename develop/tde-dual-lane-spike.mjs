// TDE P0 · D8-C 协议级 spike：单房间双运行时 + 全局串行提交 + 关卡屏障。
//
// 定位（对应 docs/tde-migration-roadmap.md §7.5.2 与 docs/tde-p0-report.md §7）：
// - 只验证「容器协议」语义，不接真实引擎、不碰 src/**、不参与任何 test tier；
// - 目的：在 P3 骨架落地前，先用合成双 lane 夹具证明七项确定性并发门禁的协议可写，
//   并给 WP-8 的估算提供实测行数/断言数下限；
// - 与生产代码的边界：lane adapter、房间座位↔线内座位转换、事件投影的**真实**接线仍属 WP-8。
//
// 状态形状（照 §7.5.2）：
//   session = {
//     schemaVersion, rulesVersion,
//     revision,                              // 全局提交序列：任一线成功提交都 +1
//     shared: { mode, seatParts, pairs, interlude, epilogue },
//     lanes:  { A: { revision, clues, settled }, B: {...} },
//     events: [{ seq, lane, seat, type }],
//     save:   { count, lastHash, queue },
//     commitChain,                           // 全局串行提交队列（进程内）
//   }
//
// 约定：
// - `roomSeat` 是大厅房间座位；lane 由 `seatParts[roomSeat]` 决定，线内座位由前缀中出现次数派生。
// - 提交先克隆、后保存、成功才替换；保存失败必须让命令失败且不替换 session（门禁 5）。
// - 幕间只在同一 `pairId` 两侧都结算的「同一次权威提交」里执行一次（门禁 4/6）。

export const STALE_REVISION = 'STALE_REVISION'
export const SAVE_FAILED = 'SAVE_FAILED'

const clone = value => structuredClone(value)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

/** 房间座位 → 线别；未分线时抛错，不允许静默落到 A。 */
export function laneForSeat(seatParts, roomSeat) {
  const lane = seatParts[roomSeat]
  if (lane !== 'A' && lane !== 'B') throw new Error(`座位 ${roomSeat} 未分线`)
  return lane
}

/** 房间座位 → 线内连续座位（0..该线人数-1），由 seatParts 确定性派生，不持久化第二份真相。 */
export function laneSeatOf(seatParts, roomSeat) {
  const lane = laneForSeat(seatParts, roomSeat)
  let laneSeat = 0
  for (let seat = 0; seat < roomSeat; seat += 1) if (seatParts[seat] === lane) laneSeat += 1
  return laneSeat
}

const emptyLane = () => ({ revision: 0, clues: 0, settled: null })

export function createSession({ seatParts = ['A', 'B', 'A', 'B'], pairs = 4 } = {}) {
  const shared = {
    mode: 'parallel',
    seatParts: [...seatParts],
    pairs: {},
    interlude: {},
    epilogue: null,
  }
  for (let pair = 1; pair <= pairs; pair += 1) shared.pairs[pair] = { A: false, B: false }
  return {
    schemaVersion: 8,
    rulesVersion: 'n6.0',
    revision: 0,
    shared,
    lanes: { A: emptyLane(), B: emptyLane() },
    events: [],
    save: { count: 0, lastHash: null, queue: Promise.resolve(), failure: null },
    commitChain: Promise.resolve(),
  }
}

/** 全局串行提交：所有权威写入都排进同一条链，事件 seq 与保存也在链内分配。 */
function serialized(session, task) {
  const run = session.commitChain.then(task)
  session.commitChain = run.then(() => undefined, () => undefined)
  return run
}

/** 单文件保存队列：同一 session 的两个 lane runner 共用；并发保存按提交顺序串行。 */
async function persist(session, snapshot) {
  const run = session.save.queue.then(async () => {
    await tick()
    if (session.save.failure) {
      const error = new Error(session.save.failure)
      error.code = SAVE_FAILED
      session.save.failure = null
      throw error
    }
    session.save.count += 1
    session.save.lastHash = JSON.stringify(snapshot).length
  })
  session.save.queue = run.then(() => undefined, () => undefined)
  return run
}

function applyMove(draft, lane, roomSeat, laneSeat, move) {
  const state = draft.lanes[lane]
  if (move.type === 'investigate') {
    state.clues += 1
    draft.events.push({ seq: draft.events.length + 1, lane, seat: roomSeat, type: 'investigate', laneSeat })
    return { ok: true, lane, roomSeat, laneSeat, type: 'investigate' }
  }
  if (move.type === 'settle') {
    const pair = Number(move.pair ?? 1)
    const progress = draft.shared.pairs[pair]
    if (!progress) return { ok: false, code: 'UNKNOWN_PAIR' }
    if (progress[lane]) return { ok: true, duplicate: true, lane, roomSeat, pair }
    progress[lane] = true
    state.settled = pair
    draft.events.push({ seq: draft.events.length + 1, lane, seat: roomSeat, type: 'settle', laneSeat, pair })
    const both = progress.A && progress.B
    if (both && !draft.shared.interlude[pair]) {
      // 屏障：同一次权威提交里封对、跑一次幕间、写幂等标记；两线的下一条命令按共享版本重基。
      draft.shared.interlude[pair] = { appliedAtRevision: draft.revision + 1, released: true }
      draft.events.push({ seq: draft.events.length + 1, lane: 'shared', seat: null, type: 'interlude', pair })
    }
    return { ok: true, lane, roomSeat, pair, interlude: both }
  }
  return { ok: false, code: 'UNKNOWN_MOVE' }
}

/**
 * 提交一条命令。校验顺序固定：线别 → 目标 line revision → 全局 revision（可安全重基）→ 保存 → 替换。
 * `expectedLaneRevision` / `expectedRevision` 由客户端投影带回；两者都过期时返回 STALE_REVISION。
 */
export async function submitMove(session, roomSeat, move, { laneRevision, revision } = {}) {
  return serialized(session, async () => {
    const lane = laneForSeat(session.shared.seatParts, roomSeat)
    const laneSeat = laneSeatOf(session.shared.seatParts, roomSeat)
    const laneState = session.lanes[lane]
    if (Number.isInteger(laneRevision) && laneRevision !== laneState.revision) {
      return { ok: false, code: STALE_REVISION, lane, laneRevision: laneState.revision }
    }
    // 全局版本过期但目标线未变 → 允许安全重基；目标线已变在上面已拒绝。
    const rebased = Number.isInteger(revision) && revision !== session.revision
    const draft = clone({ lanes: session.lanes, shared: session.shared, events: session.events, revision: session.revision })
    const outcome = applyMove(draft, lane, roomSeat, laneSeat, move)
    if (!outcome.ok) return outcome
    if (outcome.duplicate) return { ...outcome, revision: session.revision }
    draft.lanes[lane].revision += 1
    draft.revision += 1
    try {
      await persist(session, draft)
    } catch (error) {
      // 保存失败不回成功：session 保持原样，调用方可重试。
      return { ok: false, code: 'SAVE_FAILED', lane, error: error.message }
    }
    session.lanes = draft.lanes
    session.shared = draft.shared
    session.events = draft.events
    session.revision = draft.revision
    return { ...outcome, revision: session.revision, rebased }
  })
}

/** 观察投影：只给本线事件 + 已到达的 shared 事件；另一线的 move/结settle/幕间细节不外泄。 */
export function viewEvents(session, roomSeat) {
  const lane = laneForSeat(session.shared.seatParts, roomSeat)
  return session.events.filter(event => event.lane === lane || event.lane === 'shared')
}

export function viewState(session, roomSeat) {
  const lane = laneForSeat(session.shared.seatParts, roomSeat)
  const own = session.lanes[lane]
  const other = lane === 'A' ? 'B' : 'A'
  return {
    revision: session.revision,
    lane,
    laneSeat: laneSeatOf(session.shared.seatParts, roomSeat),
    laneRevision: own.revision,
    laneState: { clues: own.clues, settled: own.settled },
    // 另一线的进度只暴露「是否已结算」，不暴露其线索、牌组或叙事正文。
    pairProgress: Object.fromEntries(Object.entries(session.shared.pairs)
      .map(([pair, progress]) => [pair, { own: progress[lane], otherSettled: progress[other] }])),
    interludes: Object.keys(session.shared.interlude).map(Number),
    epilogue: session.shared.epilogue,
  }
}

/** 存档往返：只序列化权威字段，恢复后重建提交链与保存队列。 */
export function snapshot(session) {
  return clone({
    schemaVersion: session.schemaVersion,
    rulesVersion: session.rulesVersion,
    revision: session.revision,
    shared: session.shared,
    lanes: session.lanes,
    events: session.events,
  })
}

export function restoreSession(snapshotValue) {
  const data = clone(snapshotValue)
  return {
    ...data,
    save: { count: 0, lastHash: null, queue: Promise.resolve(), failure: null },
    commitChain: Promise.resolve(),
  }
}

/** 测试夹具：可控延迟的假 AI/客户端请求，返回创建时的 laneRevision。 */
export async function delayedSubmit(session, roomSeat, move, options, delayMs = 0) {
  const lane = laneForSeat(session.shared.seatParts, roomSeat)
  const laneRevision = session.lanes[lane].revision
  const revision = session.revision
  if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
  return submitMove(session, roomSeat, move, { ...options, laneRevision, revision })
}
