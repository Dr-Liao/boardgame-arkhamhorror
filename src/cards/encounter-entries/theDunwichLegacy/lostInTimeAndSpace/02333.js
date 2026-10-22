// 02333 辽阔无边
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 如果场上没有[[异次元]]地点，辽阔无边获得涌动。否则，检定[willpower](X)，其中X为场上[[异次元]]地点数(最多为5)。你检定失败且每低于难度1点，受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02333', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const count = state.locations.filter(loc =>
      loc.traits?.some(trait => trait.toLowerCase() === 'extradimensional')).length
    if (!count) { api.drawEncounter(inv.seat); return false }
    api.test(inv.seat, 'willpower', Math.min(5, count), result => {
      if (!result.success) api.horror(inv.seat, Math.max(0, Math.min(5, count) - result.value))
    })
    return false
  },
}
