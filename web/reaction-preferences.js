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
// 自动跳过判定：只回答「这个窗口该不该自动过」，ready 只表示「现在能不能提交」。
// 联机快照会先带着 busy 到达（房主还在结算上一步），这时不能提交，但调用方仍要
// 把窗口藏住——先画出来再消失就是玩家看到的「卡顿一下」。
export function reactionPassPlan(session, seat, ready = true) {
  const st = session?.state, choice = st?.pendingChoice
  if (!choice || choice.seat !== seat) return null
  const items = reactionChoices(st)
  if (!items.length || items.some(item => !item.code || reactionEnabled(session.sessionId, choice.seat, item.code))) return null
  const skip = (st.legalMoves || []).find(move => move.action === 'choose' && move.optionId === 'skip')
  if (!skip) return null
  return { choice, items, skip, key: `${session.sessionId}:${st.revision}:${choice.id}`, submit: !!ready }
}
export function reactionView(session) {
  const st = session.state, choice = st.pendingChoice, items = reactionChoices(st)
  if (!items.length) return session
  const disabled = new Set(items.filter(item => item.code && !reactionEnabled(session.sessionId,choice.seat,item.code)).map(item => item.move.optionId))
  if (!disabled.size) return session
  return {...session,state:{...st,legalMoves:st.legalMoves.filter(move => !disabled.has(move.optionId))}}
}
