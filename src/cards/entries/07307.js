export default { code: '07307', abilities: [{ kind: 'reaction', trigger: 'tokenEffectWouldResolve',
  label: '添加 1 诅咒：忽略本标记并再揭示；新标记为诅咒或自动失败时收回骰子',
  additionalTokenCost: { token: 'curse', operation: 'add', count: 1 },
  criteria: ({ inv, context }) => context.seat === inv.seat && !['curse', 'autofail'].includes(context.token)
    && !context.cannotCancel && !context.rerollToken,
  resolve: ({ source, context, api }) => api.playerTools.rerollToken(context, source.id),
}] }
