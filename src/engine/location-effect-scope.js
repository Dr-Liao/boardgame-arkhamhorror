const scopes = new WeakMap()

export function ignoreTestKeyword(state, inv, keyword, enemy, choose) {
  if (!state.skillTest?.allowIgnoreTestTriggers || state.skillTest.seat !== inv.seat) return false
  return choose(state, { kind: 'effect', seat: inv.seat, source: enemy.id,
    prompt: `是否忽略「${enemy.name}」的${keyword}效果？`,
    options: [{ id: 'resolve', label: '正常结算' }, { id: 'ignore', label: '忽略此次效果' }],
  }) === 'ignore'
}

export function withOptionalLocationIgnore(state, locationId, resolve) {
  const previous = scopes.get(state)
  scopes.set(state, locationId)
  try { return resolve() }
  finally {
    if (previous == null) scopes.delete(state)
    else scopes.set(state, previous)
  }
}

export function ignoreLocationTrigger(state, locationId, choose, label = '地点触发效果', test = state.skillTest) {
  if (scopes.get(state) !== locationId && !test?.allowIgnoreTestTriggers) return false
  return choose(state, { kind: 'effect', seat: test?.seat ?? state.currentSeat,
    source: locationId, prompt: `是否忽略「${label}」？`,
    options: [{ id: 'resolve', label: '正常结算' }, { id: 'ignore', label: '忽略此次效果' }] }) === 'ignore'
}
