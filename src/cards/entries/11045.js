import { ownTurn } from '../../engine/matcher.js'

const CODE = '11045'

export default {
  code: CODE,
  playCondition: [ownTurn(), ({ state, inv, helpers }) => state.locations.some(location =>
    location.revealed && helpers.canDiscoverClueAt(inv.seat, location.id))],
  abilities: [{
    kind: 'played', fast: true, label: '从任意已揭示地点发现 1 个线索',
    resolve: ({ state, inv, api }) => {
      const locations = state.locations.filter(location => location.revealed && api.canDiscoverClueAt(inv.seat, location.id))
      if (!locations.length) return
      const target = locations.length === 1 ? locations[0].id : api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择一个可发现线索的已揭示地点。',
        options: locations.map(location => ({ id: location.id, label: api.locationName(location.id), cardCode: location.code })),
      })
      api.discoverClue(inv.seat, 1, target)
    },
  }],
}
