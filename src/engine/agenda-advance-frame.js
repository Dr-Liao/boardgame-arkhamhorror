const agendaFrames = new WeakMap()
export function withAgendaAdvanceFrame(state, agenda, resolve) {
  const previous = agendaFrames.get(state)
  const frame = { agenda, index: state.agendaIndex, revert: false }
  agendaFrames.set(state, frame)
  try { return { value: resolve(), revert: frame.revert } }
  finally {
    if (previous) agendaFrames.set(state, previous)
    else agendaFrames.delete(state)
  }
}
export function requestCurrentAgendaRevert(state) {
  const frame = agendaFrames.get(state)
  if (!frame || state.agendaIndex !== frame.index
    || state.agendas?.[frame.index] !== frame.agenda) return false
  frame.revert = true
  return true
}
