// Lantern Room: the white key is placed only by revealing this physical location.
export default {
  code: '07241', scope: 'location',
  locationRule: {
    floodBounds: { min: 0, max: 0 },
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('white', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
}
