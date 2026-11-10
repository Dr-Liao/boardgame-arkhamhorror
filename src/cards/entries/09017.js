// 09017「毁掉的底片」（Ruined Film）· 诡计 · 达雷尔专属弱点
// 卡面：显现 - 从你控制的卡牌上移除 4 个证据。每有 1 个以此法无法移除的证据，你受到 1 点恐惧。
export default {
  code: '09017',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat' },
      label: '显现：从你控制的卡牌上移除 4 个证据，不足则每点受到 1 点恐惧',
      resolve: ({ inv, api }) => {
        let remaining = 4
        const cards = (inv.assets || []).filter(card => api.cardCounterOf(card, 'evidence') > 0)
        for (const card of cards) {
          if (!remaining) break
          const amount = Math.min(remaining, api.cardCounterOf(card, 'evidence'))
          api.moveCardCounters(card, null, 'evidence', amount)
          remaining -= amount
        }
        if (remaining > 0) {
          api.harm(inv.seat, { horror: remaining, direct: true })
          api.info(`🎞️ 「毁掉的底片」：${inv.name} 受到 ${remaining} 点恐惧。`)
        }
      },
    },
  ],
  modifiers: [],
}
