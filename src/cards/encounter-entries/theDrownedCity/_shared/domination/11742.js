// 11742 压迫影响（Oppressive Influence）· 诡计 · 共享遭遇组 domination（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/domination。
// 卡面（cards-data 11742）：
//   显现 - 检定[willpower](X)，其中X为你所在地点的印刷隐藏值。如果你失败，受到2点恐惧。
//
// 读点（声明即接线）：
//   · 「印刷隐藏值」= 地点实例 shroud（印刷值，修正不进 X，与参考 LocationPrintedShroud 同口径）；
//   · 显现检定 = api.test；失败恐惧 = api.horror。
const CODE = '11742'

export default {
  code: CODE,
  name: '压迫影响',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power'],
    quantity: 2,
    test: { skill: 'willpower', difficultyFromPrintedShroud: true },
    failHorror: 2,
  },
  encounterResolve(state, inv, card, api) {
    const location = state.locations?.find(item => item.id === inv.location)
    const difficulty = Math.max(0, Number(location?.shroud) || 0)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「压迫影响」检定（意志 ${result.value} vs ${difficulty}）。`)
        return
      }
      api.horror(inv.seat, 2)
      api.info?.(`🐙 「压迫影响」：${inv.name} 检定失败，受到 2 点恐惧。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '压迫影响' })
    return false
  },
  note: '难度 = 所在地点印刷隐藏值（location.shroud）；失败受到 2 点恐惧（api.horror）。',
}
