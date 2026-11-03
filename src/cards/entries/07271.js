export default { code: '07271', fast: true, assetRule: { discardWithoutSealedTokens: true }, abilities: [
  { kind: 'entersPlay', label: '封印至多3个诅咒',
    resolve: ({ inv, source, api }) => api.playerTools.sealUpTo(inv.seat, source.id, 'curse', 3) },
  { kind: 'reaction', trigger: 'beforeChaosTokenReveal', label: '横置月亮之恩：揭示封印诅咒，然后获得1资源',
    cost: { exhaust: true },
    criteria: ({ inv, source, context, state }) => context.seat === inv.seat
      && state.chaos.sealed.some(item => item.source === source.id),
    resolve: ({ inv, source, context, api }) => {
      if (api.playerTools.revealSealedInstead(context, source.id)) api.gainResources(inv.seat, 1)
    } },
] }
