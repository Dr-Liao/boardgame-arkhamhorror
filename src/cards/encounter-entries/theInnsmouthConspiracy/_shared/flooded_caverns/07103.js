import { floodLevel } from '../../../_shared.js'
export default {
  code: '07103', scope: 'location', implemented: true,
  locationRule: { onReveal: (state, location, api) => api.mechanics.keys.placeRandom(`location:${location.id}`) },
  modifiers: [{ target: 'locationShroud', amount: ({ state, entity }) => floodLevel(state, entity.id) }],
}
