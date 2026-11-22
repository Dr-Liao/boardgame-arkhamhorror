// 51061 萦绕的回忆（Beyond the Threshold）
// 归属：跨关卡共享（重返敦威治遗产 → beyond_the_threshold）
// 卡面：显现 - 你的手牌中每有一张在弃牌堆有同名卡牌，受到 1 点恐惧（最多 3）。
//       如果没有因此受到恐惧，弃掉你牌库顶 3 张卡牌。
export default {
  code: '51061', scope: 'treachery', implemented: true,
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const titleOf = item => (typeof item === 'string' ? item : (item?.code || item?.name || ''))
    const discarded = new Set((inv.discard || []).map(titleOf).filter(Boolean))
    const matches = Math.min(3, (inv.hand || []).map(titleOf).filter(title => discarded.has(title)).length)
    if (matches === 0) api.discardTop(inv.seat, 3)
    else api.horror(inv.seat, matches)
    return true
  },
}
