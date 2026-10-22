// 04222 宽阔步道
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：作为你在宽阔步道探索时的额外费用，检查你们的补给品。如果本地点没有调查员带有双筒望远镜，你必须花费额外1个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 宽阔步道（04222）：没有双筒望远镜时探索要额外花 1 个行动。

export default {
  code: '04222', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      if (api.checkSupplies(inv.seat, 'binoculars')) return true
      if ((inv.actionsLeft || 0) < 1) {
        api.info?.('宽阔步道：本地点没有人带双筒望远镜，需要额外 1 个行动，你的行动不足。')
        return false
      }
      inv.actionsLeft -= 1
      api.info?.('宽阔步道：本地点没有人带双筒望远镜，额外花费 1 个行动。')
      return true
    },
  },
}
