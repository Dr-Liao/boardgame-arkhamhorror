// 06093 入梦者的诅咒（Dreamer's Curse，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamers_curse（DSM / WTGD）。
// 卡面：Revelation - 检定[willpower](5)。你检定失败每低于难度 1 点，受到 1 点伤害，最多 3 点。
//       统计投入本检定的图标时，[intellect]/[combat]/[agility] 图标计 1 个匹配图标，
//       [willpower]/[wild] 图标计 2 个匹配图标。
// 实现：自定义检定 + 失败差值封顶 3 的伤害；「图标权重」需要检定器支持自定义图标值（引擎
//   skillTestIconValues 是参考实现的结构，本引擎无内容读点）→ simplified，已登记 coordinator request。
export default {
  code: '06093',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 5, result => {
      if (result.success) return
      const failedBy = Math.max(0, 5 - Number(result.value || 0))
      const damage = Math.min(3, failedBy)
      api.damage?.(inv.seat, damage)
      api.info?.(`🌙 「入梦者的诅咒」：${inv.name} 受到 ${damage} 点伤害（最多 3 点）。`)
    })
    return false
  },
  simplified: true,
  note: '「[intellect]/[combat]/[agility] 计 1、[willpower]/[wild] 计 2 个匹配图标」需要检定器的图标权重读点；已登记 coordinator request。',
}
