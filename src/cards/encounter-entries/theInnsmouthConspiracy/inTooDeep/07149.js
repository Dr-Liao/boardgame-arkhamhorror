// 泛滥：只向无屏障的连接边放置，未实际放置任何屏障才涌动。
export default {
  code: '07149', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(entry => entry.id === inv.location)
    let placed = 0
    for (const destination of location?.connections || []) {
      if (api.mechanics.barriers.count(location.id, destination) > 0) continue
      if (api.mechanics.barriers.change(location.id, destination, 1) !== false) placed++
    }
    if (!placed) api.drawEncounter(inv.seat)
    return false
  },
}
