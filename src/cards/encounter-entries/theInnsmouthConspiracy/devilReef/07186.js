// Horrors from the Deep：部分／完全淹没分别使难度 +1／+2；失败受到固定 2 伤害。
export default {
  code: '07186',
  scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const difficulty = 2 + api.mechanics.water.effectiveLevel(inv.seat)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}
