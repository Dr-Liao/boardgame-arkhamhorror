// .25 Automatic: the exhausted-enemy bonus is checked for the chosen attack.
export default { code: '07025', fast: true, uses: 4, usesType: 'ammo', abilities: [{
  kind: 'action', label: '攻击；目标横置时战斗 +2、伤害 +1', countsAs: 'fight',
  cost: { action: true, uses: 1 }, target: { kind: 'enemy' },
  resolve: ({ inv, source, target, api }) => api.fight(inv.seat, target.id,
    { assetId: source.id, conditionalBonus: { targetExhausted: { skill: 2, damage: 1 } } }),
}] }
