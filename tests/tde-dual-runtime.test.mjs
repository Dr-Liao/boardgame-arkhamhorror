// TDE P5 批次 3：双运行时容器（dual-runtime）的 Node 验收。
//
// 路线图 §7.5.2 的协议门禁：
//   · 顶层 revision 是全局提交序列，每线 revision 独立；
//   · 跨线同时提交都保留、同线旧版本被拒、全局版本过期可安全重基；
//   · 两线同时结算时幕间只执行一次（重复提交/重连/重放幂等）；
//   · 单文件存档往返逐字节一致，非法存档拒绝而不是静默修补。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commitBoth, commitLane, createDualRuntime, laneState, markAwaitingPair, restoreDualRuntime,
  sealPairOnce, serializeDualRuntime,
} from '../src/campaign/dual-runtime.js'

const runtime = () => createDualRuntime({
  shared: { mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'], pairProgress: {} },
  lanes: { A: { phase: 'investigation', records: { evidence: 0 } }, B: { phase: 'investigation', records: {} } },
})

test('建容器：全局 revision 0、两线各自 revision 0、shared 独立拷贝', () => {
  const container = runtime()
  assert.equal(container.revision, 0)
  assert.equal(container.lanes.A.revision, 0)
  assert.equal(container.lanes.B.revision, 0)
  assert.equal(container.shared.mode, 'parallel')
  assert.equal(laneState(container, 'A').phase, 'investigation')
  assert.throws(() => laneState(container, 'C'), /未知线/)
})

test('提交：全局与目标线版本一起 +1，另一线不动；reducer 收到副本', () => {
  const container = runtime()
  const before = structuredClone(container.lanes.A)
  const result = commitLane(container, 'A', draft => {
    draft.records.evidence = 3
    draft.phase = 'resolution'
    return draft.records.evidence
  })
  assert.equal(result.ok, true)
  assert.equal(result.revision, 1)
  assert.equal(result.laneRevision, 1)
  assert.equal(result.result, 3)
  assert.equal(container.revision, 1)
  assert.equal(container.lanes.A.revision, 1)
  assert.equal(container.lanes.B.revision, 0)
  assert.equal(container.lanes.A.records.evidence, 3)
  assert.equal(before.records.evidence, 0, 'reducer 必须拿到副本，不能改到旧状态')
})

test('reducer 抛错：不提交、版本不变', () => {
  const container = runtime()
  assert.throws(() => commitLane(container, 'A', () => { throw new Error('结算失败') }), /结算失败/)
  assert.equal(container.revision, 0)
  assert.equal(container.lanes.A.revision, 0)
  assert.equal(container.lanes.A.records.evidence, 0)
})

test('同线旧版本被拒；全局版本过期但目标线未变时允许安全重基', () => {
  const container = runtime()
  commitLane(container, 'A', draft => { draft.records.evidence = 1 })
  // 目标线版本已变：旧命令拒绝。
  const stale = commitLane(container, 'A', draft => { draft.records.evidence = 2 }, { baseLaneRevision: 0 })
  assert.equal(stale.ok, false)
  assert.equal(stale.reason, 'stale-lane')
  assert.equal(stale.expected, 0)
  assert.equal(stale.actual, 1)
  assert.equal(container.lanes.A.records.evidence, 1, '被拒的提交不能留下半成品')
  // 拿旧全局版本提交另一条线：允许（重基），新版本来自该线。
  const rebased = commitLane(container, 'B', draft => { draft.records.scouted = true }, { baseLaneRevision: 0 })
  assert.equal(rebased.ok, true)
  assert.equal(rebased.revision, 2)
  assert.equal(rebased.laneRevision, 1)
  assert.equal(container.lanes.B.records.scouted, true)
})

test('跨线同时提交：两种返回顺序都保留两边的更新，全局版本各 +1', () => {
  const run = order => {
    const container = runtime()
    const commits = {
      A: { lane: 'A', reducer: draft => { draft.records.a = 1 } },
      B: { lane: 'B', reducer: draft => { draft.records.b = 1 } },
    }
    const outcome = commitBoth(container, order.map(lane => commits[lane]))
    return { container, outcome }
  }
  const ab = run(['A', 'B'])
  const ba = run(['B', 'A'])
  assert.equal(ab.outcome.ok, true)
  assert.equal(ba.outcome.ok, true)
  for (const { container } of [ab, ba]) {
    assert.equal(container.revision, 2)
    assert.equal(container.lanes.A.records.a, 1)
    assert.equal(container.lanes.B.records.b, 1)
    assert.equal(container.lanes.A.revision, 1)
    assert.equal(container.lanes.B.revision, 1)
  }
})

test('关卡屏障：两边都 awaiting 才封盘，幕间只执行一次且幂等', () => {
  const container = runtime()
  let interludeRuns = 0
  const applyInterlude = (shared, pairId) => { interludeRuns += 1; shared.interlude = pairId; return { pairId } }
  const first = markAwaitingPair(container, 'A', '1')
  assert.equal(first.ok, true)
  assert.equal(container.lanes.A.awaitingPair, '1')
  const waiting = sealPairOnce(container, '1', { applyInterlude })
  assert.deepEqual({ sealed: waiting.sealed, applied: waiting.applied, reason: waiting.reason },
    { sealed: false, applied: false, reason: 'waiting-other-lane' })
  assert.equal(interludeRuns, 0)
  markAwaitingPair(container, 'B', '1')
  const sealed = sealPairOnce(container, '1', { applyInterlude })
  assert.equal(sealed.sealed, true)
  assert.equal(sealed.applied, true)
  assert.equal(interludeRuns, 1)
  assert.equal(container.lanes.A.awaitingPair, null)
  assert.equal(container.lanes.B.awaitingPair, null)
  assert.equal(container.shared.interlude, '1')
  assert.equal(container.shared.interludeApplied['1'] != null, true)
  // 重复提交 / 重连 / 重放：直接 no-op，不再跑幕间。
  const again = sealPairOnce(container, '1', { applyInterlude })
  assert.equal(again.applied, false)
  assert.equal(again.reason, 'already-applied')
  assert.equal(interludeRuns, 1)
  // 未结算的 pair 不会误封。
  const notAwaiting = sealPairOnce(container, '2', { applyInterlude })
  assert.equal(notAwaiting.reason, 'not-awaiting')
  assert.equal(interludeRuns, 1)
})

test('单文件存档：序列化 → 恢复逐字节一致，恢复后可继续提交', () => {
  const container = runtime()
  commitLane(container, 'A', draft => { draft.records.evidence = 2 })
  markAwaitingPair(container, 'A', '1')
  const saved = serializeDualRuntime(container)
  const restored = restoreDualRuntime(saved)
  assert.equal(serializeDualRuntime(restored), saved, '往返必须逐字节一致')
  const next = commitLane(restored, 'B', draft => { draft.records.scouted = true })
  assert.equal(next.ok, true)
  assert.equal(restored.revision, container.revision + 1)
  // 非法存档：版本/两线/revision 缺失都要拒绝。
  assert.throws(() => restoreDualRuntime('{"schemaVersion":99}'), /不支持的容器版本/)
  const bad = structuredClone(container)
  delete bad.lanes.B
  assert.throws(() => restoreDualRuntime(bad), /lanes\.B/)
  const badRevision = structuredClone(container)
  badRevision.revision = -1
  assert.throws(() => restoreDualRuntime(badRevision), /revision 非法/)
  assert.throws(() => restoreDualRuntime('null'), /存档不是对象/)
})

test('容器不合法/未知线：返回错误而不是抛错（便于大厅回 409）', () => {
  assert.deepEqual(commitLane(null, 'A', () => null), { ok: false, reason: 'invalid-container' })
  const container = runtime()
  assert.deepEqual(commitLane(container, 'C', () => null), { ok: false, reason: 'unknown-lane', lane: 'C' })
  assert.throws(() => markAwaitingPair(container, 'C', '1'), /未知线/)
  assert.throws(() => sealPairOnce(container, ''), /pairId/)
})
