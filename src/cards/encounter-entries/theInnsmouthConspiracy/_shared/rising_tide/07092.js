export default {
  code: '07092', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const locations = state.locations.filter(location => api.mechanics.water.canChange(location.id, 1))
      .map(location => ({ location, distance: api.mechanics.map.distance(inv.location, location.id) }))
      .filter(item => Number.isFinite(item.distance))
    if (!locations.length) return { gainSurge: true }
    const nearest = Math.min(...locations.map(item => item.distance))
    const choices = locations.filter(item => item.distance === nearest).map(item => item.location)
    const id = choices.length === 1 ? choices[0].id : api.choose({ kind: 'location', seat: inv.seat, source: '07092',
      prompt: '选择一个最近且能够提高淹没等级的地点。', options: choices.map(location => ({ id: location.id, label: location.name })) })
    if (!choices.some(location => location.id === id)) return false
    const before = api.mechanics.water.level(id)
    api.mechanics.water.change(id, 1)
    return api.mechanics.water.level(id) === before ? { gainSurge: true } : false
  },
}
