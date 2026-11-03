export default { code: '07272', fast: true, assetRule: { discardWithoutSealedTokens: true }, abilities: [
  { kind: 'entersPlay', label: '封印至多3个祝福',
    resolve: ({ inv, source, api }) => api.playerTools.sealUpTo(inv.seat, source.id, 'bless', 3) },
  { kind: 'reaction', trigger: 'beforeChaosTokenReveal', label: '横置太阳之恩：改为揭示封印祝福',
    cost: { exhaust: true },
    criteria: ({ inv, source, context, state }) => context.seat === inv.seat
      && state.chaos.sealed.some(item => item.source === source.id),
    resolve: ({ source, context, api }) => api.playerTools.revealSealedInstead(context, source.id) },
] }
