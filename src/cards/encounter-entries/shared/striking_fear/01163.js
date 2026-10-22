// 01163 腐烂的尸体
// 归属：跨战役通用
// 遭遇组：striking_fear
// 卡面：显现 - 检定[willpower](3)。你检定失败且每低于难度1点，受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01163', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const failedBy = Math.max(0, 3 - result.value)
      if (failedBy > 0) api.horror(inv.seat, failedBy)
    })
    return false
  },
}
