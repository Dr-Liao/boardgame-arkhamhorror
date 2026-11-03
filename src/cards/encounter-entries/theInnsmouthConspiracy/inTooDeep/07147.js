import { hasTrait } from '../../_shared.js'
export default {
  code: '07147', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.shuffleDiscard()
    const origin = api.mechanics.map.position(inv.location)
    if (!origin || origin.isolated) return false
    const east = api.mechanics.map.locations({ row: origin.y })
      .filter(location => api.mechanics.map.position(location.id).x > origin.x)
      .sort((left, right) => api.mechanics.map.position(left.id).x - api.mechanics.map.position(right.id).x)
    for (const location of east) {
      const code = api.discardUntilEnemy(inv.seat, definition => hasTrait(definition, 'Deep One') && definition.hunter)
      if (code) {
        api.spawn(code, location.id)
        api.autoEngageAll()
      }
    }
    return false
  },
}
