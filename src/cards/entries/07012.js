export default { code: '07012', abilities: [{ kind: 'reaction', trigger: 'assetEnteredPlay', label: '本轮结算该支援触发能力时技能 +2',
  limit: { scope: 'perWindow', owner: 'instance' },
  criteria: ({ inv, context }) => context.seat === inv.seat && !!context.assetId,
  resolve: ({ context, api }) => api.investigatorTools.markAbilityBonus(context.assetId, 2) }] }
