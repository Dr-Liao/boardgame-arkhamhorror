// 08698 冰缝（Crevasse）· 诡计 · hazards_of_antarctica
// 卡面：显现 - 检定[agility](3)。本次检定期间每揭示一个[frost]标记，受到 1 点伤害。
//   如果你检定失败，受到 2 点伤害。
// 读点：encounterResolve；result.drawn 是本次检定揭示的标记数组（与 07296 同一契约）。
export default {
  code: '08698', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      const frosts = (result.drawn || []).filter(token => token === 'frost').length
      if (frosts > 0) api.damage(inv.seat, frosts)
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}

