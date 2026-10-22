// 02232 艾丽莎·格雷厄姆
// 卡面：你得到+1[intellect]。
// 卡面：[free]横置艾丽莎·格雷厄姆：查看遭遇牌库或任意玩家牌库顶的卡牌。然后你可以在艾丽莎·格雷厄姆上增加1个毁灭标记，以将查看的卡牌放到其牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02232 艾丽莎：第 122 轮从 player-effects.js 的 `lookTopDeckAndDoom` 分派搬进本文件。

export default {
  code: '02232',
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '查看牌库顶牌',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api, source }) => {
        const choice = api.choice({
          kind: 'deck', source: '02232', seat: inv.seat, prompt: '选择查看的牌库。',
          options: [{ id: 'encounter', label: '遭遇牌库' },
            ...state.investigators.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` }))],
        })
        const deck = choice === 'encounter' ? state.encounterDeck : state.investigators[Number(choice)]?.deck
        if (!deck) return
        const top = deck.at(-1)
        if (!top) return
        const bury = api.choice({
          kind: 'card', source: '02232', seat: inv.seat,
          prompt: `顶牌是「${api.cardName(top)}」，是否放到牌库底并在艾丽莎上放 1 毁灭？`,
          options: [{ id: 'keep', label: '保留在顶端' }, { id: 'bottom', label: '放到牌库底' }],
        })
        if (bury !== 'bottom') return
        deck.pop()
        deck.unshift(top)
        if (source) api.placeDoomOnCard(source, 1)
      },
    },
  ],
}
