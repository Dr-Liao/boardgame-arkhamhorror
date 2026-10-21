// 场景选择助手：api.choose 必须只调用一次。
//
// 旧写法把 api.choose 放进 Array.find 的谓词里，恢复事务时每比较一个候选
// 就会新建一个问题（cursor 递增），答案与候选错位，最终可能返回 undefined
// 并在调用处崩溃。这里统一“先问一次、再按 key 找候选”。
export function chooseCandidate(api, request, candidates, { key, label, cardCode } = {}) {
  if (!candidates.length) return null
  if (candidates.length === 1 || typeof api.choose !== 'function') return candidates[0]
  const keyOf = key || (candidate => String(candidate.id ?? candidate.seat ?? candidate.index ?? candidate.code))
  const labelOf = label || (candidate => candidate.label || candidate.name || String(candidate.code ?? candidate.id ?? ''))
  const answer = api.choose({
    ...request,
    options: candidates.map(candidate => ({
      id: keyOf(candidate),
      ...(cardCode ? { cardCode: cardCode(candidate) } : {}),
      label: labelOf(candidate),
    })),
  })
  return candidates.find(candidate => keyOf(candidate) === answer) || candidates[0]
}
