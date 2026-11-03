// 06094 睡眠恐惧症（Somniphobia，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamers_curse（DSM / WTGD）。
// 卡面：Revelation - 检定[willpower](5)。你检定失败每低于难度 1 点，受到 1 点恐惧，最多 3 点。
//       图标权重同 06093。
// 实现：检定通过 iconWeights 设置图标权重；失败差值封顶 3 点恐惧。
export default {
  code: '06094',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test?.(inv.seat, 'willpower', 5, result => {
      if (result.success) return
      const failedBy = Math.max(0, Number(result.difficulty ?? 5) - Number(result.value || 0))
      const horror = Math.min(3, failedBy)
      api.horror?.(inv.seat, horror)
      api.info?.(`😱 「睡眠恐惧症」：${inv.name} 受到 ${horror} 点恐惧（最多 3 点）。`)
    }, { iconWeights: { intellect: 1, combat: 1, agility: 1, willpower: 2, wild: 2 } })
    return false
  },
}
