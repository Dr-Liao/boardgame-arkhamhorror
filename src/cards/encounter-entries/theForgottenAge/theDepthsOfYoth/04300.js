// 04300 无光之影
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：显现 - 检定[agility](1)。本次检定难度+X，X等于当前深度等级。如果你检定失败，受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04300', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 1 + Math.max(1, Number(state.scenarioFlags?.depthLevel || 1)), result => {
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
