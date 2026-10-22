// 04069 荆棘之路
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：强制 - 在你调查荆棘之路时，技能检定失败后：受到1点伤害。
// 卡面：强制 - 在你在荆棘之路探索失败后：受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 荆棘之路（04069）：调查失败受到 1 点伤害；探索失败也受到 1 点伤害。

export default {
  code: '04069', scope: 'location',
  locationRule: {
    afterTest({ inv, result, api }) {
      if (result.success || result.source?.label !== '调查') return
      api.damage(inv.seat, 1)
    },
    afterExploreFailure({ inv, api }) { api.damage(inv.seat, 1) },
  },
}
