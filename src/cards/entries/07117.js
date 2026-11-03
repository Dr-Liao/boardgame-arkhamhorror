export default { code: '07117', uses: 3, usesType: 'charges', abilities: [{ kind: 'action', countsAs: 'fight',
  label: '意志攻击，伤害 +1；揭示诅咒时可造成伤害或补充充能', cost: { action: true, uses: 1 }, target: { kind: 'enemy' },
  resolve: ({ inv, source, target, api }) => api.playerTools.testWithTokenBenefits(inv.seat,
    { action: 'fight', assetId: source.id, skill: 'willpower', bonus: 0, upgraded: false, enemyId: target.id }),
}] }
