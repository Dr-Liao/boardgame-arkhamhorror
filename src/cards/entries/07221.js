export default {
  code: '07221', assetRule: { discardWithoutSealedTokens: true },
  abilities: [
    { kind: 'entersPlay', label: '封印最多 5 个祝福', resolve: ({ inv, source, api }) => api.playerTools.sealUpTo(inv.seat, source.id, 'bless', 5) },
    { kind: 'reaction', trigger: 'enemyAttack', label: '横置并释放 1 个标记：取消攻击', cost: { exhaust: true },
      criteria: ({ state, inv, source, context }) => context.location === inv.location
        && state.chaos?.sealed?.some(item => item.source === source.id),
      resolve: ({ source, api, context }) => { if (api.chaosTokens.release(source.id, null, 1) === 1) api.cancelCurrentAttack(context) } },
  ],
}
