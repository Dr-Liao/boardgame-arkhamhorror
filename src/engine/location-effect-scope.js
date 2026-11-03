const scopes = new WeakMap()

export function withOptionalLocationIgnore(state, locationId, resolve) {
  const previous = scopes.get(state)
  scopes.set(state, locationId)
  try { return resolve() }
  finally {
    if (previous == null) scopes.delete(state)
    else scopes.set(state, previous)
  }
}

export function ignoreLocationTrigger(state, locationId, choose, label = '地点触发效果') {
  if (scopes.get(state) !== locationId) return false
  return choose(state, { kind: 'effect', seat: state.skillTest?.seat ?? state.currentSeat,
    source: locationId, prompt: `是否忽略「${label}」？`,
    options: [{ id: 'resolve', label: '正常结算' }, { id: 'ignore', label: '忽略此次效果' }] }) === 'ignore'
}
