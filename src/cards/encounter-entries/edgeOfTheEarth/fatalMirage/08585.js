// 08585 易散之雾：附属到最近且仍有幻景的地点。
const CODE = '08585'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: {
    mirageFlipCost: { groupClues: 2, damagePerInvestigator: 2 },
    discardWhenMirageCleared: true,
  },
  encounterResolve(state, inv, card, api) {
    const nearest = api.mechanics.map.nearest(inv.location, location => location.mirage && !api.isLocationMirageCleared(location.id))
    if (!nearest.length) return false
    const locationId = nearest.length === 1 ? nearest[0] : api.choice({ kind: 'location', source: CODE, seat: inv.seat,
      prompt: '选择最近且仍有幻景的地点。', options: nearest.map(id => ({ id, label: api.locName(id) })) })
    if (!api.attachEncounterToLocation(CODE, locationId)) return false
    api.addCluesToLocation(locationId, 2)
    return true
  },
}
