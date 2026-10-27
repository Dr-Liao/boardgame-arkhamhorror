// TDE P0 · D8-C 七项确定性并发门禁的合成双 lane 验收（协议级）。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node develop/tde-dual-lane-spike.check.mjs            # 跑全部门禁，打印摘要
//   node develop/tde-dual-lane-spike.check.mjs --json     # 只输出 JSON（供报告引用）
//
// 说明：这是 P0 的**协议级** spike，不是生产测试；不接真实引擎、不登记进 test tier。
// 它证明的是 §7.5.2 的容器/提交/屏障/投影语义可写，并给出 WP-8 估算的实测下限；
// adapter 级闭环（真实 engine、roomSeat↔laneSeat、事件演出、保存管线）仍属 P3 之后的 WP-8。

import {
  createSession, delayedSubmit, laneSeatOf, restoreSession, snapshot, submitMove,
  viewEvents, viewState, SAVE_FAILED, STALE_REVISION,
} from './tde-dual-lane-spike.mjs'

const results = []
const record = (id, name, pass, details = {}) => {
  results.push({ id, name, pass, details })
  if (!pass) console.error(`✘ ${id} ${name}`, details)
}

const seats = ['A', 'B', 'A', 'B']
const isA = seat => seat % 2 === 0
const aSeat = 0
const bSeat = 1

// 门禁 7 的辅助：把某个事件计数出来，避免断言里写魔法字符串。
const countEvents = (session, predicate) => session.events.filter(predicate).length

async function gate1ConcurrentBothLanes() {
  const session = createSession({ seatParts: seats })
  const [a, b] = await Promise.all([
    delayedSubmit(session, aSeat, { type: 'investigate' }, {}, 0),
    delayedSubmit(session, bSeat, { type: 'investigate' }, {}, 0),
  ])
  record('G1', '两线从同一全局版本并发提交，两次都保留', a.ok && b.ok
    && session.revision === 2
    && session.lanes.A.revision === 1 && session.lanes.B.revision === 1
    && session.lanes.A.clues === 1 && session.lanes.B.clues === 1
    && countEvents(session, e => e.type === 'investigate') === 2, {
    a, b, revision: session.revision, lanes: { A: session.lanes.A, B: session.lanes.B },
  })
}

async function gate2StaleRules() {
  const session = createSession({ seatParts: seats })
  await submitMove(session, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })
  // 同线旧版本：目标线已推进到 1，必须拒绝。
  const stale = await submitMove(session, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 1 })
  // 全局版本过期但目标线未变：允许安全重基（B 线仍是 0）。
  const rebased = await submitMove(session, bSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })
  record('G2', '同线旧版本被拒，跨线全局版本过期可安全重基', stale.code === STALE_REVISION
    && stale.ok === false
    && rebased.ok === true && rebased.rebased === true
    && session.lanes.A.clues === 1 && session.lanes.B.clues === 1, { stale, rebased })
}

async function gate3AiOutOfOrder() {
  const session = createSession({ seatParts: seats })
  // 两条 AI 请求都在 laneRevision=0 / revision=0 创建，返回顺序与创建顺序相反。
  const slowA = delayedSubmit(session, aSeat, { type: 'investigate' }, {}, 25)
  const fastB = delayedSubmit(session, bSeat, { type: 'investigate' }, {}, 5)
  const [a, b] = await Promise.all([slowA, fastB])
  const orderKept = a.ok && b.ok && session.revision === 2 && session.lanes.A.clues === 1 && session.lanes.B.clues === 1

  // 反向覆盖：请求创建后目标线又提交了一次（laneRevision 前进），旧结果必须被丢弃。
  const session2 = createSession({ seatParts: seats })
  const inFlight = delayedSubmit(session2, aSeat, { type: 'investigate' }, {}, 20)
  await submitMove(session2, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })
  const late = await inFlight
  const dropped = late.ok === false && late.code === STALE_REVISION && session2.lanes.A.clues === 1
  record('G3', 'AI 反向返回不覆盖新状态（过期 laneRevision 结果被丢弃）', orderKept && dropped, {
    orderKept, dropped, late, revision: session2.revision, clues: session2.lanes.A.clues,
  })
}

async function gate4InterludeOnce() {
  const session = createSession({ seatParts: seats })
  const [a, b] = await Promise.all([
    delayedSubmit(session, aSeat, { type: 'settle', pair: 1 }, {}, 0),
    delayedSubmit(session, bSeat, { type: 'settle', pair: 1 }, {}, 0),
  ])
  const firstCount = countEvents(session, e => e.type === 'interlude' && e.lane === 'shared')
  // 重放同一批 settle：必须 no-op，不再执行幕间。
  const replayA = await submitMove(session, aSeat, { type: 'settle', pair: 1 }, {})
  const replayB = await submitMove(session, bSeat, { type: 'settle', pair: 1 }, {})
  const secondCount = countEvents(session, e => e.type === 'interlude' && e.lane === 'shared')
  record('G4', '两线同时结算只执行一次幕间，重放幂等', a.ok && b.ok
    && firstCount === 1 && secondCount === 1
    && Boolean(session.shared.interlude[1])
    && replayA.duplicate === true && replayB.duplicate === true, {
    a, b, firstCount, secondCount, interlude: session.shared.interlude,
  })
}

async function gate5SaveFailure() {
  const session = createSession({ seatParts: seats })
  session.save.failure = 'disk full'
  const before = { revision: session.revision, clues: session.lanes.A.clues }
  const failed = await submitMove(session, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })
  const unchanged = session.revision === before.revision && session.lanes.A.clues === before.clues
  const retry = await submitMove(session, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })

  // 屏障 + 保存失败：A 已结算，B 的结算保存失败，重试后幕间仍只执行一次。
  const session2 = createSession({ seatParts: seats })
  await submitMove(session2, aSeat, { type: 'settle', pair: 2 }, { laneRevision: 0, revision: 0 })
  session2.save.failure = 'disk full'
  const bFail = await submitMove(session2, bSeat, { type: 'settle', pair: 2 }, { laneRevision: 0, revision: 1 })
  const bRetry = await submitMove(session2, bSeat, { type: 'settle', pair: 2 }, { laneRevision: 0, revision: 1 })
  const interludeCount = countEvents(session2, e => e.type === 'interlude' && e.lane === 'shared')
  record('G5', '保存失败不回成功；重试后幕间仍只有一次', failed.ok === false && failed.code === SAVE_FAILED
    && unchanged && retry.ok === true
    && bFail.ok === false && bFail.code === SAVE_FAILED && bRetry.ok === true && interludeCount === 1, {
    failed, unchanged, retry, bFail, bRetry, interludeCount,
  })
}

async function gate6RestartIdempotent() {
  const session = createSession({ seatParts: seats })
  await submitMove(session, aSeat, { type: 'settle', pair: 1 }, { laneRevision: 0, revision: 0 })
  const awaiting = restoreSession(snapshot(session))
  // 只有 A 结算（awaitingPair）时重启：B 结算只补一次幕间。
  const b = await submitMove(awaiting, bSeat, { type: 'settle', pair: 1 }, { laneRevision: 0, revision: 1 })
  const sealed = restoreSession(snapshot(awaiting))
  // 已封对（interludeApplied）后重启：再次结算必须 no-op。
  const replay = await submitMove(sealed, bSeat, { type: 'settle', pair: 1 }, {})
  const count = countEvents(sealed, e => e.type === 'interlude' && e.lane === 'shared')
  record('G6', '重启恢复不重复幕间（awaitingPair 与已封对两种状态）', b.ok === true
    && Boolean(awaiting.shared.interlude[1])
    && replay.duplicate === true && count === 1, {
    b, replay, count, interlude: sealed.shared.interlude,
  })
}

async function gate7PrivacyAndSeatMap() {
  const session = createSession({ seatParts: seats })
  await submitMove(session, aSeat, { type: 'investigate' }, { laneRevision: 0, revision: 0 })
  await submitMove(session, bSeat, { type: 'investigate' }, { laneRevision: 0, revision: 1 })
  const viewA = viewState(session, aSeat)
  const eventsA = viewEvents(session, aSeat)
  const eventsB = viewEvents(session, bSeat)
  const lanesSeenByA = new Set(eventsA.map(event => event.lane))
  const privacy = !eventsA.some(event => event.lane === 'B')
    && !eventsB.some(event => event.lane === 'A')
    && lanesSeenByA.has('A')
    && viewA.laneState.clues === 1
    && !Object.hasOwn(viewA, 'otherLane')
    && viewA.pairProgress['1'].otherSettled === false

  // 座位映射：非连续房间座位（['B','A','B','A']）也要派生连续 laneSeat。
  const reordered = ['B', 'A', 'B', 'A']
  const map = reordered.map((_, seat) => laneSeatOf(reordered, seat))
  const seatMap = map.join(',') === '0,0,1,1'
    && laneSeatOf(seats, 0) === 0 && laneSeatOf(seats, 2) === 1
    && laneSeatOf(seats, 1) === 0 && laneSeatOf(seats, 3) === 1
  record('G7', '另一线事件/状态不可见；非连续房间座位映射正确', privacy && seatMap, {
    privacy, seatMap, eventsA: eventsA.length, eventsB: eventsB.length, viewA,
  })
}

async function main() {
  await gate1ConcurrentBothLanes()
  await gate2StaleRules()
  await gate3AiOutOfOrder()
  await gate4InterludeOnce()
  await gate5SaveFailure()
  await gate6RestartIdempotent()
  await gate7PrivacyAndSeatMap()

  const summary = {
    generatedAt: new Date().toISOString(),
    kind: 'tde-p0-dual-lane-spike',
    note: '协议级 spike：合成双 lane，不接真实引擎；adapter 级闭环属 WP-8。',
    gates: results,
    pass: results.every(result => result.pass),
    passed: results.filter(result => result.pass).length,
    total: results.length,
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    for (const result of results) console.log(`${result.pass ? '✔' : '✘'} ${result.id} ${result.name}`)
    console.log(`\n${summary.passed}/${summary.total} gates pass · ${summary.pass ? 'PASS' : 'FAIL'}`)
  }
  if (!summary.pass) process.exitCode = 1
  return summary
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
