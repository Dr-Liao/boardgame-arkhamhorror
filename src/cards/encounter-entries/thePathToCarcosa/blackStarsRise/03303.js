// 03303 世界融合
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：显现 - 检定[willpower](3)。如果你检定失败：
// 卡面：- 如果密谋1c在场，受到1点恐惧并弃掉你1张手牌。
// 卡面：- 如果密谋2c在场，受到2点恐惧并弃掉你2张手牌。
// 卡面：- 如果场景3c或密谋3c在场，受到3点恐惧并弃掉你3张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03303', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const deck = state.scenarioFlags?.agendaDecks?.c
    const amount = state.scenarioFlags?.openPath || state.actIndex >= 2
      ? 3 : Math.min(3, Number(deck?.index || 0) + 1)
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      api.horror(inv.seat, amount)
      api.discardChosen(inv.seat, amount, '03303')
    })
    return false
  },
}
