// 03236 探知术
// 卡面：使用(3充能)。
// 卡面：[free]横置探知术并花费1充能：查看任意一位调查员的牌库顶或遭遇牌库顶3张卡牌。将其以任意顺序放回该牌库顶。如果查看的卡牌中有[[恐怖]]或[[征兆]]卡牌，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03236 探知：查看任一牌库顶 3 张并排列（B5 lookAt）；顶牌有恐怖/预兆特性时受 1 恐惧。

export default {
  code: '03236',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'free', label: '探知牌库顶 3 张并重排', cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const decks = [
          { id: 'self', label: `${inv.name} 的牌库`, targetSeat: inv.seat, pile: inv.deck },
          ...state.investigators.filter(other => other.seat !== inv.seat && !other.defeated && !other.resigned)
            .map(other => ({ id: `seat:${other.seat}`, label: `${other.name} 的牌库`, targetSeat: other.seat, pile: other.deck })),
          { id: 'encounter', label: '遭遇牌库', zone: 'encounterDeck', pile: state.encounterDeck },
        ].filter(option => option.pile && option.pile.length)
        if (!decks.length) return
        const deckId = decks.length === 1 ? decks[0].id
          : api.choice({ kind: 'deck', source: '03236', seat: inv.seat, prompt: '选择要查看牌库顶 3 张的牌库。',
            options: decks.map(option => ({ id: option.id, label: option.label })) })
        const chosenDeck = decks.find(option => option.id === deckId) || decks[0]
        const top = chosenDeck.pile.slice(-3)
        if (top.some(code => (api.cardTraits?.(code) || []).some(trait => ['terror', 'omen'].includes(String(trait).toLowerCase())))) {
          api.horror(inv.seat, 1)
        }
        api.lookAt(inv.seat, {
          zone: chosenDeck.zone || 'deck', targetSeat: chosenDeck.targetSeat ?? null,
          count: Math.min(3, chosenDeck.pile.length), arrange: true, returnStrategy: 'top',
          prompt: '选择放回牌库顶的顺序（从上到下）。', source: '03236',
        })
      },
    },
  ],
  modifiers: [

  ],
}
