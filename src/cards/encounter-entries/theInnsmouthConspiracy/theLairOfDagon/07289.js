export default {
  code: '07289', scope: 'location',
  locationRule: {
    entryError: state => state.scenarioFlags?.remembered?.includes('UnlockedTheThirdFloor')
      ? null : '三楼尚未解锁，不能进入。',
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('purple', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'skillTestFailed', label: '寂静厅堂：本地检定失败后加入1个诅咒',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && inv.location === source.id,
    resolve: ({ api }) => api.chaosTokens.add('curse', 1),
  }],
}
