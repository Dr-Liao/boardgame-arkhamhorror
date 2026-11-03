export default {
  code: '07100', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const locations = state.locations.filter(location => state.investigators.some(other =>
      !other.defeated && !other.resigned && other.location === location.id))
    if (!locations.length) return false
    const id = locations.length === 1 ? locations[0].id : api.choose({ kind: 'location', seat: inv.seat, source: '07100',
      prompt: '选择至少有一名调查员的地点。', options: locations.map(location => ({ id: location.id, label: location.name })) })
    if (!locations.some(location => location.id === id)) return false
    const before = api.mechanics.water.level(id)
    api.mechanics.water.change(id, 1)
    const increased = api.mechanics.water.level(id) > before
    for (const other of state.investigators.filter(other => !other.defeated && !other.resigned && other.location === id)) api.damage(other.seat, 1)
    return increased ? false : { gainSurge: true }
  },
}
