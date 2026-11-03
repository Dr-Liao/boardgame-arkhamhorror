import { ALL_CARDS, hasTrait, floodLevel } from '../../../_shared.js'
const choices = (state, inv) => state.locations.filter(location => location.id !== inv.location
  && hasTrait(Array.isArray(location.traits) ? location : ALL_CARDS[location.originalCode || location.code], 'Cave') && floodLevel(state, location.id) > 0)
export default {
  code: '07102', scope: 'location', implemented: true,
  locationRule: { onReveal: (state, location, api) => api.mechanics.water.set(location.id, 2) },
  abilities: [{
    kind: 'action', actionKind: 'move', label: '移动到任意一个已淹没的洞穴地点', cost: { action: 1 },
    criteria: ({ state, inv, helpers }) => choices(state, inv).some(location => helpers.canMoveTo(inv.seat, location.id)),
    resolve: ({ state, inv, api }) => {
      const locations = choices(state, inv).filter(location => api.canMoveTo(inv.seat, location.id))
      if (!locations.length) return
      const id = locations.length === 1 ? locations[0].id : api.choice({ kind: 'location', seat: inv.seat, source: '07102',
        prompt: '选择一个已淹没的洞穴地点。', options: locations.map(location => ({ id: location.id, label: location.name })) })
      if (locations.some(location => location.id === id)) api.moveInvestigator(inv.seat, id)
    },
  }],
}
