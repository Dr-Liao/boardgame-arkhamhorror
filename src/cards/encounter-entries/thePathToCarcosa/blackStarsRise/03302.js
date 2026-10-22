// 03302 洪水肆虐
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：显现 - 检定[agility](3)。如果你检定失败：
// 卡面：- 如果密谋1a在场，受到1点伤害并失去1个行动。
// 卡面：- 如果密谋2a在场，受到2点伤害并失去2个行动。
// 卡面：- 如果场景3a或密谋3a在场，受到3点伤害并失去3个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03302', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const deck = state.scenarioFlags?.agendaDecks?.a
    const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
      ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
    api.test(inv.seat, 'agility', 3, result => {
      if (result.success) return
      api.damage(inv.seat, amount)
      api.loseActions(inv.seat, amount)
    })
    return false
  },
}
