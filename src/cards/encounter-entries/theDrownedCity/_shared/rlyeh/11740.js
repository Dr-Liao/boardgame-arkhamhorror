// 11740 崩塌砖石（Crumbling Masonry）· 诡计 · 共享遭遇组 rlyeh（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/rlyeh。
// 卡面（cards-data 11740）：
//   显现 - 检定[agility](X)，其中X为你所在地点的印刷隐藏值。如果你失败，受到2点伤害。
//
// 读点（声明即接线）：
//   · 「印刷隐藏值」= 地点实例 shroud（印刷值，修正不进 X，与参考 LocationPrintedShroud 同口径）；
//   · 显现检定 = api.test；失败伤害 = api.damage（普通伤害分配）。
const CODE = '11740'

export default {
  code: CODE,
  name: '崩塌砖石',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    quantity: 2,
    test: { skill: 'agility', difficultyFromPrintedShroud: true },
    failDamage: 2,
  },
  encounterResolve(state, inv, card, api) {
    const location = state.locations?.find(item => item.id === inv.location)
    const difficulty = Math.max(0, Number(location?.shroud) || 0)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「崩塌砖石」检定（敏捷 ${result.value} vs ${difficulty}）。`)
        return
      }
      api.damage(inv.seat, 2)
      api.info?.(`🧱 「崩塌砖石」：${inv.name} 检定失败，受到 2 点伤害。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '崩塌砖石' })
    return false
  },
  note: '难度 = 所在地点印刷隐藏值（location.shroud）；失败受到 2 点普通伤害（api.damage，走伤害分配）。',
}
