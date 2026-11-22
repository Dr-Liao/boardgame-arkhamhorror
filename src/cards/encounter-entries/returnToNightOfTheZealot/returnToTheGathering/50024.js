// 50024 狂信徒之印（The Zealot's Seal）· 诡计 · return_to_the_gathering · ×2
// 卡面：显现 - 每位拥有 3 张或更少手牌的调查员必须受到 1 点伤害和 1 点恐惧。
//   每位拥有 4 张或更多手牌的调查员检定[willpower](2)，检定失败的调查员从手中随机弃掉 2 张卡牌。
// 读点：treachery-tokens.js#resolveTreachery → 场景数据 entryRevelation + 条目 encounterResolve。
export default {
  code: '50024',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    void card
    void inv
    api.info('「狂信徒之印」显现：手牌少的调查员受伤害与恐惧，手牌多的调查员进行意志检定。')
    for (const other of state.investigators || []) {
      if (other.defeated || other.resigned) continue
      const hand = (other.hand || []).length
      if (hand <= 3) {
        api.damage(other.seat, 1)
        api.horror(other.seat, 1)
        continue
      }
      api.test(other.seat, 'willpower', 2, result => {
        if (result?.success) return
        api.discardRandom(other.seat, 2)
        api.info(`狂信徒之印：${other.name} 意志检定失败，随机弃掉 2 张手牌。`)
      })
    }
    return true
  },
}
