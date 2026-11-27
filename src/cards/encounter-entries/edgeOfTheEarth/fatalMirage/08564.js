// 08564 河景剧院
export default {
  code: '08564', scope: 'location', implemented: true,
  flags: { mirageId: 'riverviewTheatre', tier: 2 },
  abilities: [{
    kind: 'forced', trigger: 'tekeliWouldResolve', label: '额外结算一次忒咳哩-哩',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id,
    resolve: ({ context, api }) => api.addTekeliResolution(context),
  }, {
    kind: 'forced', trigger: 'tekeliResolved', label: '忒咳哩-哩结算后，发现剧院的 1 个线索',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id,
    resolve: ({ inv, source, api }) => api.discoverClue(inv.seat, 1, source.id),
  }],
}
