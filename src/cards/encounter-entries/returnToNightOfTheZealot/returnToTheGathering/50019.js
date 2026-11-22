// 50019 远在房屋之上 / 开阔坟场（Far Above Your House / Field of Graves）· 地点 ·
// return_to_the_gathering
// 卡面（揭示面「开阔坟场」）：强制 - 你揭示开阔坟场后：检定[willpower](4)。
//   你检定失败且每低于难度 1 点，从每位调查员的手中随机弃掉 1 张卡牌。
// 读点：locations.js#revealLocation → locationRule.onReveal。

export default {
  code: '50019',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, loc, api, seat) {
      void loc
      const tester = seat == null ? (state.campaign?.leadSeat ?? 0) : seat
      const difficulty = 4
      api.test(tester, 'willpower', difficulty, result => {
        if (result?.success) return
        const amount = Math.max(0, difficulty - Number(result?.value ?? 0))
        for (const inv of state.investigators || []) {
          if (inv.defeated || inv.resigned || !(inv.hand || []).length) continue
          api.discardRandom(inv.seat, amount)
        }
        api.info(`开阔坟场：意志检定失败 ${amount} 点，每位调查员随机弃掉 ${amount} 张手牌。`)
      })
    },
  },
}
