// 09017「毁掉的底片」（Ruined Film）· 诡计 · 达雷尔专属弱点
// 卡面：显现 - 从你控制的所有卡牌上移除总计 4 证据。
//       每有 1 个证据你不能以此法移除，你受到 1 点恐惧。
//
// 读点（卡面 → 引擎读点）：
//   · 显现结算：weakness.js#resolveWeaknessBody 优先执行 kind:'weakness' 描述子的 resolve()
//     （src/engine/weakness.js:68-72），再走旧型弱点分支；本卡用描述子 resolve 接管。
//   · 证据 = 卡实例具名计数器 'evidence'（card-counters.js 白名单 id；读写走 api.cardCounterOf /
//     api.addCardCounter）。P1-6 修正：旧实现用 api.moveCardCounters(card, null, ...) 表达「移除」，
//     但 card-counters.js:73 把 null 目标视为非法（`if (!from || !to || !wanted) return 0`），
//     证据永远不掉。移除不是「搬运」，改用 api.addCardCounter(card,'evidence',-N)。
//   · 「你控制的所有卡牌」= 支援区 + 威胁区（inv.assets + inv.threat）上的卡实例。
//   · 剩余无法移除的证据 → 直接恐惧：api.harm(seat, { horror, direct:true })。
//   · 结算后去向：weakness type 用 'discardAfterResolve'（与 02178 同口径）。若写成 'threat'，
//     deck-ops 会误以为已放进威胁区而跳过弃牌，这张牌会从所有区域消失。
export default {
  code: '09017',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'discardAfterResolve' },
      label: '显现：从你控制的所有卡牌上移除 4 个证据，不足则每点受到 1 点恐惧',
      resolve: ({ inv, api }) => {
        let remaining = 4
        const cards = [...(inv.assets || []), ...(inv.threat || [])]
          .filter(card => api.cardCounterOf(card, 'evidence') > 0)
        for (const card of cards) {
          if (!remaining) break
          const amount = Math.min(remaining, api.cardCounterOf(card, 'evidence'))
          api.addCardCounter(card, 'evidence', -amount)
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
