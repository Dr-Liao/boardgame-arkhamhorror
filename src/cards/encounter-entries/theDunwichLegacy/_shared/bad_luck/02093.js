// 02093 扭转命运
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：bad_luck
// 卡面：显现 - 从混乱袋中随机揭示1个标记。
// 卡面：如果你揭示了[elder_sign]符号或正值，无事发生。
// 卡面：如果你揭示了其他数值，受到1点伤害。
// 卡面：如果你揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02093', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token)) api.horror(inv.seat, 2)
    else if (/^[+-]?\d+$/.test(token) && Number(token) <= 0) api.damage(inv.seat, 1)
    return false
  },
}
