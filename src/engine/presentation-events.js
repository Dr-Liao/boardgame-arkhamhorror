// Presentation events do not advance the rule-event cursor used by saved
// continuations. Store their insertion points outside authoritative state.
const pending = new WeakMap()
function queuePresentation(state, events, cue, audio) {
  // 有些纯规则调用（测试直调 api.harm、无事务的调试路径）没有 events 容器：
  // 没有可投递的通道就丢弃演出 cue，绝不能因此抛错打断规则结算。
  if (!state._resolution) { if (Array.isArray(events)) events.push(cue); return }
  if (!pending.has(state)) pending.set(state, [])
  const { events: ruleEvents, cursor } = state._resolution
  pending.get(state).push({ at: ruleEvents.length, cursor, cue, audio })
}
export function emitPresentation(state, events, cue) { queuePresentation(state, events, cue, false) }
export function emitCardAudio(state, events, cue) {
  queuePresentation(state, events, { type: 'presentation', ...cue }, true)
}
export function presentationCount(state, audio = false) {
  return pending.get(state)?.filter(event => event.audio === audio).length || 0
}
export function transactionEvents(state, transaction) {
  const events=state._resolution.events, cues=pending.get(state)||[], output=[]
  let visualIndex = 0, audioIndex = 0
  const remaining = cues.filter(item => {
    if (!item.audio) return visualIndex++ >= (transaction._presentationEmitted || 0) && item.at >= transaction.emitted
    // Older paused saves only have the visual cursor. Their previously
    // answered choice boundary still tells us which audio has already passed.
    const unseen = transaction._cardAudioEmitted == null
      ? item.cursor >= (transaction._resumeAnswerCount || 0)
      : audioIndex >= transaction._cardAudioEmitted
    audioIndex++
    return unseen && item.at >= transaction.emitted
  })
  let next=0
  for(let i=transaction.emitted;i<=events.length;i++) {
    while(next<remaining.length&&remaining[next].at===i) output.push(remaining[next++].cue)
    if(i<events.length)output.push(events[i])
  }
  return output
}
