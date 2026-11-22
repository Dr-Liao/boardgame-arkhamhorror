// 90048 艰难时刻（Hard Times）· 中立 · 诡计/弱点 · 替换（“灰堆”皮特）。
// 卡面（cards-data 90048）：
//   替换。
//   显现 - 将艰难时刻放置入你的威胁区域。
//   强制 - 在你抽取 1 张或更多卡牌后：选择并弃掉等量的手牌。
//   [action][action]：弃掉艰难时刻。
//
// 引擎读点：
//   · 显现进威胁区 = weakness 描述子的 threat 档案（weakness.js#resolveWeaknessBody 的 threat 分支）；
//     [action][action] 弃掉 = 同一档案的 discardCost（moves.js 的 discardThreat 行动枚举）。
//   · 「抽牌后」= cardsDrawn 窗口（deck-ops.js#drawCards 派发，context = { seat, drawnCodes }），
//     强制描述子按座位结算；弃牌 = api.discardFromHand（手牌唯一弃置写点）。
const code = '90048'

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '将艰难时刻放置入你的威胁区域',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: 'cardsDrawn',
      label: '你抽牌后：选择并弃掉等量的手牌',
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && (context.drawnCodes || []).length > 0
        && (inv.hand || []).length > 0],
      resolve: ({ inv, context, api }) => {
        const drawn = (context.drawnCodes || []).length
        let remaining = Math.min(drawn, (inv.hand || []).length)
        while (remaining > 0 && (inv.hand || []).length > 0) {
          const codes = [...new Set(inv.hand)]
          const picked = codes.length === 1 ? codes[0] : api.choice({
            kind: 'card', source: code, seat: inv.seat,
            prompt: `艰难时刻：选择并弃掉 1 张手牌（还需 ${remaining} 张）。`,
            options: codes.map(cardCode => ({ id: cardCode, cardCode, label: api.cardName(cardCode) })),
          })
          if (!picked) break
          if (!api.discardFromHand(inv.seat, picked)) break
          remaining -= 1
        }
      },
    },
  ],
  modifiers: [],
}
