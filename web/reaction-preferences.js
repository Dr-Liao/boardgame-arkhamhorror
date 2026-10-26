const cache = new Map()
const sessionKey = session => (typeof session === 'string' ? session : session?.sessionId)
const keyFor = (session, seat) => `arkham-reactions:${sessionKey(session)}:${seat}`
const VALID_STATES = new Set(['skip', 'ask', 'auto'])
// 没有覆盖时的内置默认：原来的纯收益自动奖励（autoByDefault）自动触发，其余每次询问。
export const defaultReactionState = def => (def?.autoByDefault ? 'auto' : 'ask')

function preferences(session, seat) {
  const key = keyFor(session, seat)
  if (!cache.has(key)) {
    let stored = null
    try { stored = JSON.parse(localStorage.getItem(key) || 'null') } catch { /* optional storage */ }
    const states = {}
    // 旧格式是「快速反应关」的卡号数组；迁移成 skip 覆盖。
    if (Array.isArray(stored)) for (const code of stored) states[code] = 'skip'
    else if (stored && typeof stored === 'object' && stored.states && typeof stored.states === 'object') {
      for (const [code, state] of Object.entries(stored.states)) if (VALID_STATES.has(state)) states[code] = state
    }
    cache.set(key, { states, seq: Number.isSafeInteger(stored?.seq) ? stored.seq : 0 })
  }
  return cache.get(key)
}

function persist(session, seat) {
  const value = preferences(session, seat)
  try {
    localStorage.setItem(keyFor(session, seat), JSON.stringify({ states: value.states, seq: value.seq }))
  } catch { /* stays in memory */ }
}

/** 该座位对某张卡的显式覆盖；null 表示没有覆盖（跟随默认）。 */
export const reactionState = (session, seat, code) => preferences(session, seat).states[code] || null

/** 写一张卡的覆盖；state 传 null 删除覆盖。返回新的单调 seq。 */
export function setReactionState(session, seat, code, state) {
  const value = preferences(session, seat)
  if (VALID_STATES.has(state)) value.states[code] = state
  else delete value.states[code]
  value.seq = Math.max(value.seq + 1, Date.now())
  persist(session, seat)
  return value.seq
}

/** 重连/换设备时从房主视图恢复本座位覆盖（本地 seq 更高时保留本地未同步的修改）。 */
export function hydrateReactionStates(session, seat) {
  const remote = session?.autoPrefs
  if (!remote || !remote.mine || typeof remote.mine !== 'object') return
  const local = preferences(session.sessionId, seat)
  const remoteSeq = Number.isSafeInteger(remote.seq) ? remote.seq : 0
  const emptyLocal = !Object.keys(local.states).length
  if (remoteSeq > local.seq || (remoteSeq === local.seq && emptyLocal && Object.keys(remote.mine).length)) {
    local.states = { ...remote.mine }
    local.seq = remoteSeq
    persist(session.sessionId, seat)
  }
}

/** 本机该座位的完整覆盖表（随 move / prefs 上行；空对象 = 清除）。 */
export const reactionStates = (session, seat) => ({ ...preferences(session, seat).states })
export const reactionPrefsSeq = (session, seat) => preferences(session, seat).seq
export const nextReactionPrefsSeq = (session, seat) => {
  const value = preferences(session, seat)
  value.seq = Math.max(value.seq + 1, Date.now())
  return value.seq
}

// —— 旧接口：只关心「快速反应关」的调用方（测试、旧 UI）继续可用 ——
export const reactionEnabled = (session, seat, code) => reactionState(session, seat, code) !== 'skip'
export function setReactionEnabled(session, seat, codes, enabled) {
  for (const code of codes) setReactionState(session, seat, code, enabled ? 'ask' : 'skip')
}
export function reactionDisabledCodes(session, seat) {
  if (!sessionKey(session)) return []
  return Object.entries(preferences(session, seat).states)
    .filter(([, state]) => state === 'skip').map(([code]) => code).slice(0, 256)
}

export function reactionChoices(st) {
  const choice = st.pendingChoice
  if (!choice?.canSkip || !['reaction', 'playerWindow', 'boost'].includes(choice.kind)) return []
  const inv = st.investigators.find(inv => inv.seat === choice.seat)
  if (!inv) return []
  const assets = [...(inv.assets || []), ...(inv.threat || [])]
  const source = typeof choice.source === 'string' ? choice.source : choice.source?.id
  const sourceCard = choice.cardCode || assets.find(asset => asset.id === source)?.code
    || [inv.code, ...assets.map(asset => asset.code)].find(code => code === source || st.cards?.[code]?.reactionIds?.includes(source))
  return (st.legalMoves || []).filter(move => move.action === 'choose' && move.choiceId === choice.id && move.optionId !== 'skip').map(move => {
    const option = choice.options?.find(option => option.id === move.optionId)
    const code = option?.cardCode || (choice.kind === 'reaction' && /^\d+$/.test(move.optionId) ? inv.hand?.[Number(move.optionId)] : null)
      || assets.find(asset => move.optionId === asset.id || move.optionId.startsWith(asset.id + ':'))?.code || sourceCard
    return { move, code }
  })
}

// 纯判定：这个待决窗口是否「所有可选项都已被本机关闭」，可以自动跳过。
// 不读 localStorage，浏览器与 Node（房主侧代答）共用同一份映射/判定，避免漂移。
// isDisabled(code) 返回 true 表示该卡号的快速反应已关闭；映射不出卡号时 fail-closed。
export function reactionSkipPlan(state, isDisabled) {
  const choice = state?.pendingChoice
  if (!choice || !choice.canSkip) return null
  const items = reactionChoices(state)
  if (!items.length || items.some(item => !item.code || !isDisabled(item.code))) return null
  const skip = (state.legalMoves || []).find(move => move.action === 'choose'
    && move.choiceId === choice.id && move.optionId === 'skip')
  if (!skip) return null
  return { choice, items, skip }
}

/**
 * 自动结算判定：优先 auto（补 trigger），其次 skip（所有选项都已关闭）。
 * ready 只表示「现在能不能提交」；忙碌/演出期间调用方仍应把窗口藏住。
 */
export function reactionAutoPlan(session, seat, ready = true) {
  const st = session?.state, choice = st?.pendingChoice
  if (!choice || choice.seat !== seat) return null
  const stateOf = code => reactionState(session.sessionId, seat, code)
    ?? defaultReactionState(st.cards?.[code])
  const triggerOptionId = choice.autoOptionId || choice.autoTriggerOptionId
  if (triggerOptionId && stateOf(choice.cardCode) === 'auto') {
    const move = (st.legalMoves || []).find(item => item.action === 'choose'
      && item.choiceId === choice.id && item.optionId === triggerOptionId)
    if (move) return { choice, move, key: `${session.sessionId}:${st.revision}:${choice.id}:auto`, submit: !!ready }
  }
  // 新式反应窗口：每张候选卡一个 option；只有恰好一个候选设为 auto 时才代答。
  if (!triggerOptionId && choice.kind === 'reaction' && Array.isArray(choice.options)) {
    const autoOptions = choice.options.filter(option => option.cardCode
      && st.cards?.[option.cardCode]?.hasAutoReaction
      && stateOf(option.cardCode) === 'auto')
    if (autoOptions.length === 1) {
      const move = (st.legalMoves || []).find(item => item.action === 'choose'
        && item.choiceId === choice.id && item.optionId === autoOptions[0].id)
      if (move) return { choice, move, key: `${session.sessionId}:${st.revision}:${choice.id}:auto`, submit: !!ready }
    }
  }
  const plan = reactionSkipPlan(st, code => stateOf(code) === 'skip')
  if (!plan) return null
  return { ...plan, move: plan.skip, key: `${session.sessionId}:${st.revision}:${choice.id}:skip`, submit: !!ready }
}

// 兼容旧调用：只做 skip 的版本。
export function reactionPassPlan(session, seat, ready = true) {
  const st = session?.state, choice = st?.pendingChoice
  if (!choice || choice.seat !== seat) return null
  const plan = reactionSkipPlan(st, code => !reactionEnabled(session.sessionId, choice.seat, code))
  if (!plan) return null
  return { ...plan, move: plan.skip, key: `${session.sessionId}:${st.revision}:${choice.id}`, submit: !!ready }
}

export function reactionView(session) {
  const st = session.state, choice = st.pendingChoice, items = reactionChoices(st)
  if (!items.length) return session
  const seat = choice.seat
  const disabled = new Set(items.filter(item => item.code
    && (reactionState(session.sessionId, seat, item.code) ?? defaultReactionState(st.cards?.[item.code])) === 'skip')
    .map(item => item.move.optionId))
  if (!disabled.size) return session
  return { ...session, state: { ...st, legalMoves: st.legalMoves.filter(move => !disabled.has(move.optionId)) } }
}
