// 04088 致命错误
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：traps
// 卡面：显现 - 检定[agility](2)。你所在地点每有一个毁灭标记，本次检定难度+1。如果你检定失败，受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04088', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api, { location }) {
    api.test(inv.seat, 'agility', 2 + (location?.doom || 0), result => {
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
