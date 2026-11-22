// 50040 地底深寒（Chill from Below）· 诡计 · ghouls_of_umôrdhoth · ×3
// 卡面：显现 - 检定[willpower](3)。你检定失败且每低于难度 1 点，必须从你的手中随机弃掉 1 张卡牌。
//   每有 1 张卡牌不能弃掉，受到 1 点伤害。
// 读点：treachery-tokens.js#resolveTreachery → 场景数据 entryRevelation + 条目 encounterResolve。
export default {
  code: '50040',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    void card
    void state
    const difficulty = 3
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) return
      const amount = Math.max(0, difficulty - Number(result?.value ?? 0))
      const hand = (inv.hand || []).length
      const canDiscard = Math.min(amount, hand)
      if (canDiscard > 0) api.discardRandom(inv.seat, canDiscard)
      const shortfall = Math.max(0, amount - canDiscard)
      if (shortfall > 0) api.damage(inv.seat, shortfall)
      api.info(`地底深寒：${inv.name} 意志检定失败 ${amount} 点，弃 ${canDiscard} 张手牌`
        + `${shortfall ? `，未能弃的 ${shortfall} 张改为伤害` : ''}。`)
    })
    return true
  },
}
