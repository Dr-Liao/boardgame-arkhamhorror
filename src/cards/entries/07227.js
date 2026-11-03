export default { code: '07227', uses: 3, usesType: 'charges', abilities: [{ kind: 'action', countsAs: 'investigate',
  label: '意志 +2 调查，多发现 1 线索；每枚诅咒可发现连接地点线索或补充充能', cost: { action: true, uses: 1 },
  resolve: ({ inv, source, api }) => api.playerTools.testWithTokenBenefits(inv.seat,
    { action: 'investigate', assetId: source.id, skill: 'willpower', bonus: 2, upgraded: true }),
}] }
