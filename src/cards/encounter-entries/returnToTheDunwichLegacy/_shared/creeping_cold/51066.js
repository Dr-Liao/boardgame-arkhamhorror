// 51066 莫测寒冷（Creeping Cold）
// 归属：跨关卡共享（重返敦威治遗产 → creeping_cold）
// 卡面：显现 - 检定[agility](4)。失败且每低于难度 1 点，从游戏区域或手牌选择并弃掉 1 张卡牌，
//       或受到 1 点伤害。
export default {
  code: '51066', scope: 'treachery', implemented: true,
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 4, result => {
      if (result.success) return
      const failedBy = Math.max(0, 4 - Number(result.value || 0))
      for (let i = 0; i < failedBy; i += 1) api.damage(inv.seat, 1)
    })
    return true
  },
}
