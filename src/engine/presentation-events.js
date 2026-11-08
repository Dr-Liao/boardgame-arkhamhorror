// Presentation events do not advance the rule-event cursor used by saved
// continuations. Store their insertion points outside authoritative state.
const pending = new WeakMap()
export function emitPresentation(state, events, cue) {
  if (!state._resolution) { events.push(cue); return }
  if (!pending.has(state)) pending.set(state, [])
  pending.get(state).push({ at:state._resolution.events.length, cue })
}
export function presentationCount(state) { return pending.get(state)?.length || 0 }
export function transactionEvents(state, transaction) {
  const events=state._resolution.events, cues=pending.get(state)||[], output=[]
  const remaining=cues.slice(transaction._presentationEmitted||0).filter(item=>item.at>=transaction.emitted)
  let next=0
  for(let i=transaction.emitted;i<=events.length;i++) {
    while(next<remaining.length&&remaining[next].at===i) output.push(remaining[next++].cue)
    if(i<events.length)output.push(events[i])
  }
  return output
}
