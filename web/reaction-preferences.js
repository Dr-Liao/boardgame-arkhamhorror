const cache = new Map()
const keyFor = (session, seat) => `arkham-reactions:${session}:${seat}`
function preferences(session, seat) {
  const key = keyFor(session, seat)
  if (!cache.has(key)) {
    let value = []
    try { value = JSON.parse(localStorage.getItem(key) || '[]') } catch { /* optional storage */ }
    cache.set(key, new Set(Array.isArray(value) ? value : []))
  }
  return cache.get(key)
}
export const reactionEnabled = (session, seat, code) => !preferences(session, seat).has(code)
export function setReactionEnabled(session, seat, codes, enabled) {
  const value = preferences(session, seat)
  for (const code of codes) enabled ? value.delete(code) : value.add(code)
  try { localStorage.setItem(keyFor(session, seat), JSON.stringify([...value])) } catch { /* stays in memory */ }
}
export function reactionChoices(st) {
  const choice = st.pendingChoice
  if (!choice?.canSkip || !['reaction','playerWindow','boost'].includes(choice.kind)) return []
  const inv = st.investigators.find(inv => inv.seat === choice.seat)
  if (!inv) return []
  const assets = [...(inv.assets || []), ...(inv.threat || [])]
  const source = typeof choice.source === 'string' ? choice.source : choice.source?.id
  const sourceCard = assets.find(asset => asset.id === source)?.code
    || [inv.code, ...assets.map(asset => asset.code)].find(code => code === source || st.cards?.[code]?.reactionIds?.includes(source))
  return (st.legalMoves || []).filter(move => move.action === 'choose' && move.choiceId === choice.id && move.optionId !== 'skip').map(move => {
    const option = choice.options?.find(option => option.id === move.optionId)
    const code = option?.cardCode || (choice.kind === 'reaction' && /^\d+$/.test(move.optionId) ? inv.hand?.[Number(move.optionId)] : null)
      || assets.find(asset => move.optionId === asset.id || move.optionId.startsWith(asset.id + ':'))?.code || sourceCard
    return { move, code }
  })
}
export function reactionView(session) {
  const st = session.state, choice = st.pendingChoice, items = reactionChoices(st)
  if (!items.length) return session
  const disabled = new Set(items.filter(item => item.code && !reactionEnabled(session.sessionId,choice.seat,item.code)).map(item => item.move.optionId))
  if (!disabled.size) return session
  return {...session,state:{...st,legalMoves:st.legalMoves.filter(move => !disabled.has(move.optionId))}}
}
