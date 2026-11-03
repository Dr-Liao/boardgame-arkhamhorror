export default {
  code: '07104', scope: 'location', implemented: true,
  locationRule: { floodBounds: { max: 1, onlyRevealed: true },
    onReveal: (state, location, api) => api.mechanics.water.change(location.id, 1) },
}
