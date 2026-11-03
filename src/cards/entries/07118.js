export default { code: '07118', uses: 3, usesType: 'charges', abilities: [{ kind: 'action', countsAs: 'investigate',
  label: '意志调查，多发现 1 线索；揭示诅咒时可在连接地点发现线索或补充充能', cost: { action: true, uses: 1 },
  resolve: ({ inv, source, api }) => api.playerTools.testWithTokenBenefits(inv.seat,
    { action: 'investigate', assetId: source.id, skill: 'willpower', bonus: 0, upgraded: false }),
}] }
