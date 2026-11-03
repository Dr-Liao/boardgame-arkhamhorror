// Lighthouse Keeper's Cottage: partially flooded is its maximum flood level.
export default {
  code: '07243', scope: 'location',
  locationRule: {
    floodBounds: { min: 0, max: 1 },
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('yellow', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
}
