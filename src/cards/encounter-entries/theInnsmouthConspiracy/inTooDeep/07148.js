import { gridPosition, gridLocations } from '../../_shared.js'
export default {
  code: '07148', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success || inv.defeated || inv.resigned) return
      const origin = gridPosition(state, inv.location)
      const here = state.locations.find(location => location.id === inv.location)
      const east = origin && !origin.isolated ? gridLocations(state, { row: origin.y }).find(location =>
        gridPosition(state, location.id).x === origin.x + 1 && here?.connections?.includes(location.id)) : null
      if (east) api.moveInvestigator(inv.seat, east.id, { ignoreBarriers: true })
      // Printed "then" drops held keys at the actual final location even if no
      // eastern location exists; unrelated movement restrictions remain active.
      for (const color of api.mechanics.keys.at(`investigator:${inv.seat}`, { reveal: true })) {
        api.mechanics.keys.transfer(color, `investigator:${inv.seat}`, `location:${inv.location}`, { reveal: true })
      }
    })
    return false
  },
}
