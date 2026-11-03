// Shapes in the Water：有效淹没等级分别令显现检定难度为 2／3／4。
// 渔船把乘客所在地点视为未淹没，因此读取 effectiveLevel，而非实际水位。
export default {
  code: '07184',
  scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const difficulty = 2 + api.mechanics.water.effectiveLevel(inv.seat)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
