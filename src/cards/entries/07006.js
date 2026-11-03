export default {
  code: '07006', passive: { assignHarmAtLocation: 'damage', assignHarmConnections: true },
  abilities: [{ kind: 'reaction', trigger: 'assetDamageAssigned', label: '按分配伤害加入祝福',
    criteria: ({ source, context, helpers }) => context.assetId === source.id && context.amount > 0 && helpers.poolTokenRoom('bless') > 0,
    limit: { scope: 'perWindow', owner: 'instance' },
    resolve: ({ context, api }) => api.chaosTokens.add('bless', context.amount) }],
}
