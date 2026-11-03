export default {
  code: '07284', scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('red', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'investigateFail', label: '鲜血厅堂：受到1点恐惧',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context.location === source.id,
    resolve: ({ context, api }) => api.horror(context.seat, 1),
  }],
}
