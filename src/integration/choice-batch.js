// Multi-card mulligan / skill-commit confirmation, exposed to the hall as the
// optional `commitChoiceBatch` mod hook.
//
// 并行双线（P0 修复）：大厅把容器当 session.state，批量确认原本只认单状态的
// pendingChoice/legalMoves/investigators。这里按座位找到所属 lane，在 **lane 的克隆**
// 上逐步 applyMove，成功后才写回容器（原子），并把事件座位换回房间座位。
import { applyMove, legalMoves } from '../engine/engine.js'

const LANES = ['A', 'B']

function parallelContext(session, seat) {
  const container = session?.state
  const lane = container?.campaign?.seatParts?.[seat]
  const laneState = LANES.includes(lane) ? container?.parallel?.lanes?.[lane] : null
  if (!laneState) return null
  const roomSeats = laneState.laneRuntime?.roomSeats || []
  const laneSeat = roomSeats.indexOf(seat)
  return laneSeat >= 0 ? { container, lane, laneState, laneSeat, roomSeats } : null
}

function mapLaneEvents(events, roomSeats, lane) {
  return (events || []).map(event => {
    const copy = { ...event }
    if (Number.isInteger(copy.seat)) copy.seat = roomSeats[copy.seat] ?? copy.seat
    if (Number.isInteger(copy.privateSeat)) copy.privateSeat = roomSeats[copy.privateSeat] ?? copy.privateSeat
    copy.lane = lane
    return copy
  })
}

function commitParallelBatch(session, seat, batch, { lane, laneState, laneSeat, roomSeats }, moveError) {
  const original = laneState.pendingChoice
  if (original?.id !== batch.choiceId || original.kind !== batch.kind || original.seat !== laneSeat) {
    throw moveError('当前选择已变化，请刷新后重试')
  }
  const hand = laneState.investigators[laneSeat]?.hand || []
  const used = new Set()
  for (const item of batch.selected) {
    if (!Number.isSafeInteger(item?.index) || item.index < 0 || item.index >= hand.length
        || typeof item.code !== 'string' || hand[item.index] !== item.code || used.has(item.index)) {
      throw moveError('所选手牌已变化，请重新选择')
    }
    used.add(item.index)
  }
  // 原子：所有步骤都在 lane 的副本上，失败不影响容器。
  let draft = structuredClone(laneState)
  const collected = []
  const removed = []
  for (const item of batch.selected) {
    const choice = draft.pendingChoice
    if (choice?.kind !== batch.kind || choice.seat !== laneSeat) throw moveError('选择结算过程中状态已变化')
    const index = item.index - removed.filter(previous => previous < item.index).length
    if (draft.investigators[laneSeat]?.hand[index] !== item.code) throw moveError('所选手牌已变化，请重新选择')
    const move = legalMoves(draft, laneSeat).find(candidate => candidate.action === 'choose'
      && candidate.choiceId === choice.id && candidate.optionId === String(index))
    if (!move) throw moveError('所选手牌当前不可投入或更换')
    collected.push(...(applyMove(draft, laneSeat, move) || []))
    removed.push(item.index)
  }
  const choice = draft.pendingChoice
  const helperCommit = batch.kind === 'commit' && batch.finish === 'done'
    && Number.isInteger(draft.skillTest?.seat) && draft.skillTest.seat !== laneSeat
  if (!((choice?.kind !== batch.kind || choice.seat !== laneSeat) && helperCommit)) {
    if (choice?.kind !== batch.kind || choice.seat !== laneSeat) throw moveError('确认前选择已结束')
    const finish = legalMoves(draft, laneSeat).find(candidate => candidate.action === 'choose'
      && candidate.choiceId === choice.id && candidate.optionId === batch.finish)
    if (!finish) throw moveError('当前无法确认选择')
    collected.push(...(applyMove(draft, laneSeat, finish) || []))
  }
  // 写回容器：只替换本线运行时，容器版本 +1；事件换回房间座位并补 seq。
  const before = {
    ...session.state,
    parallel: { ...session.state.parallel, lanes: { ...session.state.parallel.lanes, [lane]: laneState } },
  }
  const container = session.state
  container.parallel.lanes[lane] = draft
  container.revision = (before.revision ?? 0) + 1
  const events = mapLaneEvents(collected, roomSeats, lane)
    .map((event, index) => ({ ...event, seq: session.events.length + index }))
  session.events = session.events.concat(events)
  return {
    before, after: container, events, seat,
    move: { action: 'choiceBatch', kind: batch.kind }, revision: container.revision,
  }
}

export function commitChoiceBatch(session, seat, batch, { commitMove, moveError }) {
  if (!batch || !['mulligan', 'commit'].includes(batch.kind)
      || !Array.isArray(batch.selected) || batch.selected.length < 1 || batch.selected.length > 20
      || !['done', 'help'].includes(batch.finish)) throw moveError('不支持的批量选择')
  const parallel = parallelContext(session, seat)
  if (parallel) return commitParallelBatch(session, seat, batch, parallel, moveError)
  const before = session.state
  const eventStart = session.events.length
  const original = session.state.pendingChoice
  if (original?.id !== batch.choiceId || original.kind !== batch.kind || original.seat !== seat) throw moveError('当前选择已变化，请刷新后重试')
  const originalHand = session.state.investigators[seat]?.hand || []
  const used = new Set()
  for (const item of batch.selected) {
    if (!Number.isSafeInteger(item?.index) || item.index < 0 || item.index >= originalHand.length
        || typeof item.code !== 'string' || originalHand[item.index] !== item.code || used.has(item.index)) throw moveError('所选手牌已变化，请重新选择')
    used.add(item.index)
  }
  // Resolve every intermediate choice against the latest authoritative state.
  // A failed step leaves the live session untouched, so the whole confirmation is atomic.
  const draft = { ...session }
  const removed = []
  for (const item of batch.selected) {
    const choice = draft.state.pendingChoice
    if (choice?.kind !== batch.kind || choice.seat !== seat) throw moveError('选择结算过程中状态已变化')
    const index = item.index - removed.filter(previous => previous < item.index).length
    if (draft.state.investigators[seat]?.hand[index] !== item.code) throw moveError('所选手牌已变化，请重新选择')
    const move = draft.state.legalMoves.find(candidate => candidate.action === 'choose' && candidate.choiceId === choice.id && candidate.optionId === String(index))
    if (!move) throw moveError('所选手牌当前不可投入或更换')
    commitMove(draft, seat, move, draft.state.revision)
    removed.push(item.index)
  }
  const choice = draft.state.pendingChoice
  // A helper may commit at most one card; that commit closes their window,
  // so the explicit "submit" finishes the batch without a separate 'done'.
  const helperCommit = batch.kind === 'commit' && batch.finish === 'done'
    && Number.isInteger(session.state.skillTest?.seat) && session.state.skillTest.seat !== seat
  if ((choice?.kind !== batch.kind || choice.seat !== seat) && helperCommit) {
    session.state = draft.state
    session.events = draft.events
    return {
      before, after: session.state, events: session.events.slice(eventStart), seat,
      move: { action: 'choiceBatch', kind: batch.kind }, revision: session.state.revision,
    }
  }
  if (choice?.kind !== batch.kind || choice.seat !== seat) throw moveError('确认前选择已结束')
  const finish = draft.state.legalMoves.find(candidate => candidate.action === 'choose' && candidate.choiceId === choice.id && candidate.optionId === batch.finish)
  if (!finish) throw moveError('当前无法确认选择')
  commitMove(draft, seat, finish, draft.state.revision)
  session.state = draft.state
  session.events = draft.events
  return {
    before, after: session.state, events: session.events.slice(eventStart), seat,
    move: { action: 'choiceBatch', kind: batch.kind }, revision: session.state.revision,
  }
}
