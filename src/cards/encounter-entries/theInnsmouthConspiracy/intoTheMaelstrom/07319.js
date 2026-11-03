export default {
  code: '07319', scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.placeRandom(`location:${location.id}`)
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'clueDiscovered', label: '黑暗深渊：完全淹没并提升相邻地点的淹没等级',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context.location === source.id && context.lastClue === true,
    resolve: ({ state, source, api }) => {
      api.water.set(source.id, 2)
      for (const id of source.connections || []) {
        if (state.locations.some(location => location.id === id)) api.water.change(id, 1)
      }
    },
  }],
}
