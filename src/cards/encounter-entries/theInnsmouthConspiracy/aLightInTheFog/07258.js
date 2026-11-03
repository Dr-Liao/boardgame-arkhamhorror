export default {
  code: '07258', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    let placed = false
    api.test(inv.seat, 'willpower', 3, result => {
      if (!result.success && !state.investigators[inv.seat].defeated && !state.investigators[inv.seat].resigned) {
        placed = Boolean(api.threat(inv.seat, '07258'))
      }
    })
    return placed
  },
  abilities: [{
    kind: 'forced', trigger: 'move', label: '合相之刻：进入淹没地点后受到1点恐惧',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context, helpers }) => context.seat === inv.seat
      && inv.threat.some(card => card.id === source.id)
      && helpers.effectiveFloodLevel(inv.seat, { location: context.location }) > 0,
    resolve: ({ inv, api }) => api.horror(inv.seat, 1),
  }, {
    kind: 'forced', trigger: 'turnEnded', label: '你的回合结束：弃掉合相之刻',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && inv.threat.some(card => card.id === source.id),
    resolve: ({ source, api }) => api.removeThreat(source),
  }],
}
