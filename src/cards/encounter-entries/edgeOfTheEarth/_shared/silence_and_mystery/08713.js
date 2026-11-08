// 08713 黑暗极光（Dark Aurora）· 诡计 · silence_and_mystery
// 卡面：显现 - 检定[willpower](3)。本次检定期间每揭示一个[frost]标记，受到 1 点恐惧。
//   如果你检定失败，受到 2 点恐惧。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组。
export default {
  code: '08713', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.horror(inv.seat, frosts)
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}

