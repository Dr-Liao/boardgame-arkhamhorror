// 09086 惊悚皈依（Eldritch Initiation）· 秘术师事件 · 0 经验。
// 卡面：你每有一个法术槽位，抽取 1 张卡牌（最多 5 张）。你每有一个法术槽位有支援，
//       选择并弃掉你 1 张手牌。
//
export default {
  code: '09086',
  abilities: [
    {
      kind: 'played',
      label: '每个法术槽位抽 1 张（最多 5）；每个被占用的法术槽位弃 1 张手牌',
      resolve: ({ state, inv, api }) => {
        const filled = api.occupiedAssetSlots(inv.seat, 'arcane')
        const slots = filled + api.emptyAssetSlots(inv.seat, 'arcane')
        const drawCount = Math.min(5, slots)
        let drawn = 0
        for (const text of api.drawCards(inv.seat, drawCount) || []) {
          api.info(text)
          drawn += 1
        }
        if (!drawn) api.info(`📖 「惊悚皈依」：抽取 ${drawCount} 张卡牌。`)
        for (let index = 0; index < filled; index++) {
          const hand = state.investigators[inv.seat]?.hand || []
          if (!hand.length) break
          const picked = hand.length === 1 ? hand[0] : api.choice({
            kind: 'discard', source: '09086', seat: inv.seat,
            prompt: `被占用的法术槽位：选择并弃掉第 ${index + 1} 张手牌。`,
            options: [...new Set(hand)].map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
          })
          if (!picked) break
          api.discardFromHand(inv.seat, picked)
          api.info(`🔥 「惊悚皈依」：弃掉「${api.cardName(picked)}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
