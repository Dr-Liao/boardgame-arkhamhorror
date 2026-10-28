// 02180 蒸汽之爪
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：显现 - 检定[willpower](3)。如果你检定失败，受到2点伤害且你本轮不能移动离开本地点。如可能，本效果的伤害必须先分配给你的支援。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02180', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      if (!result.success) { api.lockMovementThisRound(inv.seat); api.assetsFirstDamage(inv.seat, 2) }
    })
    return false
  },
}
