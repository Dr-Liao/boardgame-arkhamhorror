// Multi-card mulligan / skill-commit confirmation, exposed to the hall as the
// optional `commitChoiceBatch` mod hook.

export function commitChoiceBatch(session, seat, batch, { commitMove, moveError }) {
  if (!batch || !['mulligan', 'commit'].includes(batch.kind)
      || !Array.isArray(batch.selected) || batch.selected.length < 1 || batch.selected.length > 20
      || !['done', 'help'].includes(batch.finish)) throw moveError('不支持的批量选择')
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
