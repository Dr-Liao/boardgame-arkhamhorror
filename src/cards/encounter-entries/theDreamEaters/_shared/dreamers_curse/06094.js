// 06094 睡眠恐惧症（Somniphobia，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamers_curse（DSM / WTGD）。
// 卡面：Revelation - 检定[willpower](5)。你检定失败每低于难度 1 点，受到 1 点恐惧，最多 3 点。
//       图标权重同 06093。
// 实现：自定义检定 + 失败差值封顶 3 的恐惧；图标权重同 06093 simplified。
export default {
  code: '06094',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 5, result => {
      if (result.success) return
      const failedBy = Math.max(0, 5 - Number(result.value || 0))
      const horror = Math.min(3, failedBy)
      api.horror?.(inv.seat, horror)
      api.info?.(`😱 「睡眠恐惧症」：${inv.name} 受到 ${horror} 点恐惧（最多 3 点）。`)
    })
    return false
  },
  simplified: true,
  note: '图标权重同 06093（已登记 coordinator request）。',
}
