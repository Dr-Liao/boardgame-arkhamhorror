// 04073 曲折小道
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：作为你在曲折小道调查或探索的额外费用，检查你们的补给品。如果你所在地点没有调查员带有指南针，你必须花费3资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 曲折小道（04073）：探索前检查指南针，没有则必须花费 3 资源。
// 第 116 轮：调查前的同一费用也由条目声明（heartOfTheEldersPart1 的 behavior 会分派）。

export default {
  code: '04073', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      if (api.checkSupplies(inv.seat, 'compass')) return true
      if ((inv.resources || 0) < 3) return false
      inv.resources -= 3
      api.info?.(`曲折小道：${inv.name} 没有指南针，额外花费 3 资源。`)
      return true
    },
    beforeInvestigate(state, inv, location, api) {
      if (api?.checkSupplies?.(inv.seat, 'compass')) return true
      if ((inv.resources || 0) < 3) {
        api?.info?.(`曲折小道：${inv.name} 没有指南针，也没有 3 资源支付额外费用。`)
        return false
      }
      inv.resources -= 3
      api?.info?.(`曲折小道：${inv.name} 没有指南针，调查额外花费 3 资源。`)
      return true
    },
  },
}
