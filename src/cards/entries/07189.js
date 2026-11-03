export default {
  code: '07189', assetRule: { harmCapacity: 'unlimited', playUnderAnyAtLocation: true },
  abilities: [
    { kind: 'entersPlay', label: '选择同地点的控制者', resolve: ({ inv, source, api }) => api.playerTools.offerControl(inv.seat, source.id) },
    { kind: 'forced', trigger: 'assetHarmPlaced', label: '所有者检定意志（护甲上伤害与恐惧总值）',
      criteria: ({ context, source }) => context.assetId === source.id || context.asset?.id === source.id,
      resolve: ({ context, source, api }) => api.playerTools.testAssignedHarm(context, source) },
  ],
}
