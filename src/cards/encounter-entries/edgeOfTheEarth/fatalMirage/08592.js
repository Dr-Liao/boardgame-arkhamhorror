// 08592 詹姆斯·“曲奇”·弗雷德里克斯 · 坚毅伙伴
export default {
  code: '08592', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'ammo',
  abilities: [{
    kind: 'free', actionKind: 'fight', label: '花费 1 弹药并横置：以基础战斗 6 攻击，成功则非精英敌人本轮不能攻击',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat,
    target: { kind: 'enemy' },
    resolve: ({ state, inv, target, api }) => api.fight(inv.seat, target.id, {
      baseValue: 6, noSpend: true, sourceCode: '08592', presentationCardCode: '08592',
      onSuccess({ enemy }) {
        if (enemy && !enemy.elite) for (const investigator of state.investigators) api.protectFromEnemyAttack(enemy, investigator.seat)
      },
    }),
  }],
}
