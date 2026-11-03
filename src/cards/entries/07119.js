export default { code: '07119', uses: 3, usesType: 'charges', abilities: [{ kind: 'action', countsAs: 'evade',
  label: '意志躲避；成功可移动非精英敌人，诅咒可移动自己或补充充能', cost: { action: true, uses: 1 },
  target: { kind: 'enemy', query: ({ inv, candidate }) => candidate.entity.engagedSeat === inv.seat },
  resolve: ({ inv, source, target, api }) => api.playerTools.testWithTokenBenefits(inv.seat,
    { action: 'evade', assetId: source.id, skill: 'willpower', bonus: 0, upgraded: false, enemyId: target.id }),
}] }
