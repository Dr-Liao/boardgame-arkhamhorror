// 双运行时容器（P5 批次 3，D8-C 口径）：一个房间、一套存档、两条线各自的运行时。
//
// 口径：docs/tde-migration-roadmap.md §7.5.2。
//   · `shared`：mode / seatParts / pairProgress / interlude / ending 等**协调状态**，只有一份；
//   · `lanes.A` / `lanes.B`：每条线完整运行时（records / bag / investigators / phase / pendingChoice…），
//     各自持有 `revision`；
//   · 顶层 `revision` 是**全局提交序列**（发布、事件、缓存、存档指纹、重连用）；
//   · 提交按 session 全局串行（本模块的 commit 是同步原子替换）；同线旧版本拒绝，
//     全局版本过期但目标线版本未变时允许安全重基；
//   · 关卡屏障：两条线都 `awaitingPair` 时，**一次**提交里写 `pairSealed` + 跑一次幕间 +
//     写 `interludeApplied`；重复提交/重连/重放看到 `interludeApplied` 直接 no-op。
//
// 本模块只做容器与协议（纯数据），不 import engine、不认识 TDE 内容；真实 lane runtime
// 由 P5 批次 3 的引擎接线注入，halls 侧的提交/保存队列在批次 3 之后接入。

export const DUAL_SCHEMA_VERSION = 1

const LANES = Object.freeze(['A', 'B'])
const clone = value => structuredClone(value)

export const isLane = lane => LANES.includes(lane)

function emptyLane(extra = {}) {
  return { revision: 0, phase: null, pendingChoice: null, currentSeat: null, awaitingPair: null, ...extra }
}

/** 建容器；`shared` 与 `lanes` 由调用方给初值（缺省为空线）。 */
export function createDualRuntime({ schemaVersion = DUAL_SCHEMA_VERSION, shared = {}, lanes = {} } = {}) {
  if (!shared || typeof shared !== 'object') throw new Error('createDualRuntime 需要 shared 对象')
  return {
    schemaVersion,
    revision: 0,
    shared: clone(shared),
    lanes: {
      A: emptyLane(clone(lanes.A || {})),
      B: emptyLane(clone(lanes.B || {})),
    },
  }
}

/** 读某条线的运行时（返回引用；调用方只读，写入必须走 commitLane）。 */
export function laneState(container, lane) {
  if (!isLane(lane)) throw new Error(`未知线：${String(lane)}`)
  return container.lanes[lane]
}

/**
 * 原子提交一条线的变更。
 * `reducer(draft, container)` 收到该线运行时的深拷贝；返回值作为 `result` 透出。
 * 返回：
 *   `{ ok: true, revision, laneRevision, result }`
 *   `{ ok: false, reason: 'stale-lane' | 'unknown-lane' | 'invalid-container', expected, actual }`
 * 规则：
 *   · 只校验**目标线**的版本；`baseLaneRevision` 缺省表示不校验（首次提交）；
 *   · 全局 `revision` 过期**不**拒绝（允许安全重基），成功后全局版本 +1、目标线版本 +1；
 *   · reducer 抛错则不提交（容器保持原样）。
 */
export function commitLane(container, lane, reducer, { baseLaneRevision = null } = {}) {
  if (!container || !container.lanes || !Number.isInteger(container.revision)) {
    return { ok: false, reason: 'invalid-container' }
  }
  if (!isLane(lane)) return { ok: false, reason: 'unknown-lane', lane: String(lane) }
  const current = container.lanes[lane]
  if (baseLaneRevision != null && current.revision !== baseLaneRevision) {
    return { ok: false, reason: 'stale-lane', expected: baseLaneRevision, actual: current.revision }
  }
  if (typeof reducer !== 'function') throw new Error('commitLane 需要 reducer')
  const draft = clone(current)
  const result = reducer(draft, container)
  draft.revision = current.revision + 1
  container.lanes[lane] = draft
  container.revision += 1
  return { ok: true, revision: container.revision, laneRevision: draft.revision, lane, result }
}

/** 某条线结算完毕、等待对方：写 `awaitingPair`（不推进 flow）。 */
export function markAwaitingPair(container, lane, pairId) {
  if (!isLane(lane)) throw new Error(`未知线：${String(lane)}`)
  if (!pairId) throw new Error('markAwaitingPair 需要 pairId')
  const result = commitLane(container, lane, draft => {
    draft.awaitingPair = String(pairId)
    return draft.awaitingPair
  })
  return result
}

/**
 * 关卡屏障：两条线都 awaiting 同一个 pairId 时，一次提交里封盘并应用一次幕间。
 * `applyInterlude(container, pairId)` 返回幕间结果（任意可序列化值）。
 * 返回：
 *   `{ sealed: true, applied: true, pairId, result }`
 *   `{ sealed: false, applied: false, reason: 'waiting-other-lane' | 'not-awaiting' | 'already-applied' }`
 * 幂等：`shared.interludeApplied[pairId]` 已为真时直接返回 `already-applied`，不再跑幕间。
 */
export function sealPairOnce(container, pairId, { applyInterlude = null } = {}) {
  const id = String(pairId || '')
  if (!id) throw new Error('sealPairOnce 需要 pairId')
  container.shared.pairSealed ||= {}
  container.shared.interludeApplied ||= {}
  if (container.shared.interludeApplied[id]) return { sealed: false, applied: false, reason: 'already-applied', pairId: id }
  const awaiting = LANES.filter(lane => container.lanes[lane].awaitingPair === id)
  if (awaiting.length !== LANES.length) {
    return { sealed: false, applied: false, reason: awaiting.length ? 'waiting-other-lane' : 'not-awaiting', pairId: id }
  }
  // 先在内存副本上完成整个转换，再原子替换（§7.5.2「先内存副本，再原子替换」）。
  const sealedAt = container.revision + 1
  const result = typeof applyInterlude === 'function' ? applyInterlude(container.shared, id) : null
  for (const lane of LANES) {
    const draft = clone(container.lanes[lane])
    draft.awaitingPair = null
    draft.revision += 1
    container.lanes[lane] = draft
  }
  container.shared.pairSealed[id] = { revision: sealedAt }
  container.shared.interludeApplied[id] = { revision: sealedAt }
  container.shared.pairProgress = { ...(container.shared.pairProgress || {}), lastSealed: id }
  container.revision += 1
  return { sealed: true, applied: true, pairId: id, result, revision: container.revision }
}

/** 单文件存档：稳定格式化（同内容 → 同字节），用于存档指纹与可靠保存。 */
export function serializeDualRuntime(container) {
  return `${JSON.stringify(container, null, 2)}\n`
}

/** 读档：形状校验（版本、两线、revision）；失败抛错而不是静默修补。 */
export function restoreDualRuntime(value) {
  const container = typeof value === 'string' ? JSON.parse(value) : clone(value)
  if (!container || typeof container !== 'object') throw new Error('存档不是对象')
  if (container.schemaVersion !== DUAL_SCHEMA_VERSION) throw new Error(`不支持的容器版本：${String(container.schemaVersion)}`)
  if (!Number.isInteger(container.revision) || container.revision < 0) throw new Error('存档 revision 非法')
  if (!container.shared || typeof container.shared !== 'object') throw new Error('存档缺少 shared')
  for (const lane of LANES) {
    const state = container.lanes?.[lane]
    if (!state || typeof state !== 'object') throw new Error(`存档缺少 lanes.${lane}`)
    if (!Number.isInteger(state.revision) || state.revision < 0) throw new Error(`lanes.${lane}.revision 非法`)
  }
  return container
}

/**
 * 两条线同时提交的确定性协议测试入口：按给定顺序依次提交，任一线过期即返回失败。
 * 只是把「A/B 谁先到」的两种返回顺序都跑一遍，不改变提交语义。
 */
export function commitBoth(container, commits) {
  const results = []
  for (const { lane, reducer, baseLaneRevision = null } of commits || []) {
    results.push({ lane, ...commitLane(container, lane, reducer, { baseLaneRevision }) })
  }
  return { results, ok: results.every(item => item.ok), revision: container.revision }
}
