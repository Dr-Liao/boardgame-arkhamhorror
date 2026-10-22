// 02081 酒里有毒
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：涌动。
// 卡面：显现 - 每位“喝了一杯”的玩家失去1个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：敦威治共享诡计的显现规则从 encounter-rules.js 搬来。
// 每个条目只声明自己这张卡的结算；战役入口仍由 encounter-rules 的 resolveEncounter 分派。

export default {
  code: '02081', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    for (const seat of state.scenarioFlags.hadDrink || []) {
      const target = state.investigators[seat]
      if (target && !target.defeated && !target.resigned) target.actionsLeft = Math.max(0, target.actionsLeft - 1)
    }
    api.drawEncounter(inv.seat)
    return { placed: false, surgeHandled: true }
  },
}
