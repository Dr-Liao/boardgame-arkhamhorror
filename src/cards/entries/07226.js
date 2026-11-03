export default { code: '07226', uses: 3, usesType: 'charges', abilities: [{ kind: 'action', countsAs: 'fight',
  label: '意志 +2 攻击，伤害 +1；每枚诅咒可造成伤害或补充充能', cost: { action: true, uses: 1 }, target: { kind: 'enemy' },
  resolve: ({ inv, source, target, api }) => api.playerTools.testWithTokenBenefits(inv.seat,
    { action: 'fight', assetId: source.id, skill: 'willpower', bonus: 2, upgraded: true, enemyId: target.id }),
}] }
