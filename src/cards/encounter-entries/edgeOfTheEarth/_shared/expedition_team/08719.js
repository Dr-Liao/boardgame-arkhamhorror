// 08719 詹姆斯·「曲奇」·弗雷德里克斯 · 伙伴。使用（3 子弹）。
const CODE = '08719'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true },
  uses: 3, usesType: 'ammo',
  abilities: [{
    kind: 'action', actionKind: 'fight',
    label: '花费 1 子弹并横置：以基础战斗 5 攻击；成功且非精英则本轮不能攻击',
    cost: { action: 1, exhaust: true, uses: 1 },
    target: { kind: 'enemy' },
    resolve: ({ state, inv, target, source, api }) => {
      api.fight(inv.seat, target.id, {
        baseValue: 5, noSpend: true, sourceCode: CODE, presentationCardCode: source.code,
        onSuccess: ({ enemy }) => {
          if (!enemy || enemy.elite) return
          for (const investigator of state.investigators) api.protectFromEnemyAttack(enemy, investigator.seat)
        },
      })
    },
  }],
}
