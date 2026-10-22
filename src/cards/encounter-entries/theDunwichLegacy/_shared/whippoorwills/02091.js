// 02091 渴望死亡
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：whippoorwills
// 卡面：显现 - 检定[willpower](2)。你每有1点伤害，本次技能检定难度提升1点。如果你检定失败，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02091', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 2 + inv.damage, result => { if (!result.success) api.horror(inv.seat, 2) })
    return false
  },
}
