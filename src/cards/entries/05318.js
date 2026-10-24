// 05318 窥看不思议之事
// 卡面：将你手牌中任意数量的非弱点卡牌洗入你的牌库。抽取卡牌，直至手牌数量达到上限。将窥看不思议之事从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05318 窥看不思议之事：逐张选择非弱点手牌洗回牌库 → 洗牌 → 补抽到手牌上限 → 自身移出游戏
// （exileAfterPlay 是引擎 doPlay 收尾段的读点）。

export default {
  code: '05318',
  exileAfterPlay: true,
  abilities: [
    {
      kind: 'played',
      label: '把任意数量非弱点手牌洗回牌库并补抽到手牌上限',
      resolve: ({ state, inv, api }) => {
        for (let guard = 0; guard < 30; guard++) {
          const hand = state.investigators[inv.seat].hand
          const candidates = [...new Set(hand.filter(code => api.isNonWeakness(code)))]
          if (!candidates.length) break
          const answer = api.choice({ kind: 'card', source: '05318', seat: inv.seat, canSkip: true,
            prompt: '选择要洗回牌库的非弱点手牌（可随时结束）。',
            options: [{ id: 'done', label: '完成洗回' },
              ...candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done' || answer === undefined) break
          if (!candidates.includes(answer)) break
          api.moveCard({ code: answer, from: 'hand', to: 'deckTop' })
        }
        api.shuffleDeck(inv.seat)
        const missing = api.handSize(inv.seat) - state.investigators[inv.seat].hand.length
        if (missing > 0) api.drawCards(inv.seat, missing)
      },
    },
  ],
  modifiers: [

  ],
}
