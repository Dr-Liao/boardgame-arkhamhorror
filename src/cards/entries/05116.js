// 05116 秘密卷轴
// 卡面：使用(3秘密)
// 卡面：[action]横置秘密卷轴并花费1秘密：查看任意一位调查员的牌库底或遭遇牌库底1张卡牌。
// 然后，弃掉该卡牌、将其加入其所有者手牌，或将其放到该牌库底或者牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：引擎的看牌原语 lookAt 只从牌库「顶」读（src/engine/look.js），没有牌库底的读/写通道，
// 因此本卡在 resolve 里直接按引擎的牌库布局读写（牌库底 = 数组头，抽牌从数组尾 pop；
// 遭遇牌库同布局）。这是单卡一次性逻辑（protocol 允许的 resolve 逃生口），
// 主进程可考虑把它提升成通用的「牌库底」原语。

const DESTINATION_LABELS = {
  discard: '弃掉该卡牌',
  hand: '加入其所有者手牌',
  bottom: '放到该牌库底',
  top: '放到该牌库顶',
}

export default {
  code: '05116',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action', label: '横置并花费 1 秘密：查看任意牌库底 1 张并决定去向',
      cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const decks = [
          ...state.investigators
            .filter(owner => !owner.defeated && !owner.resigned && (owner.deck || []).length)
            .map(owner => ({ id: `seat:${owner.seat}`, label: `${owner.name} 的牌库底`, owner })),
          ...((api.encounterDeckCards?.() || state.encounterDeck || []).length
            ? [{ id: 'encounter', label: '遭遇牌库底', owner: null }]
            : []),
        ]
        if (!decks.length) { api.info('没有可查看的牌库。'); return }
        const deckId = decks.length === 1 ? decks[0].id
          : api.choice({ kind: 'deck', source: '05116', seat: inv.seat,
            prompt: '秘密卷轴：选择要查看牌库底的牌库。',
            options: decks.map(deck => ({ id: deck.id, label: deck.label })) })
        const deck = decks.find(item => item.id === deckId) || decks[0]
        // 牌库底读写走引擎原语（takeDeckBottom / putOnDeckBottom / putOnEncounterDeck 等）。
        const bottom = deck.owner ? api.takeDeckBottom?.(deck.owner.seat) : api.takeEncounterDeckBottom?.()
        if (bottom == null) { api.info('牌库底没有卡牌。'); return }
        api.info(`👁 「秘密卷轴」查看「${api.cardName(bottom)}」（${deck.label}）。`)
        const options = ['discard', ...(deck.owner ? ['hand'] : []), 'bottom', 'top']
          .map(id => ({ id, label: DESTINATION_LABELS[id] }))
        const destination = options.length === 1 ? options[0].id
          : api.choice({ kind: 'effect', source: '05116', seat: inv.seat,
            prompt: `秘密卷轴：「${api.cardName(bottom)}」的去向。`, options })
        if (destination === 'discard') {
          if (deck.owner) api.putInDiscard?.(deck.owner.seat, bottom)
          else api.discardEncounterCards?.(bottom)
        } else if (destination === 'hand') {
          api.putInHand?.(deck.owner.seat, bottom)
        } else if (destination === 'bottom') {
          if (deck.owner) api.putOnDeckBottom?.(deck.owner.seat, bottom)
          else api.putOnEncounterDeck?.(bottom, { bottom: true })
        } else {
          if (deck.owner) api.putOnTopOfDeck?.(deck.owner.seat, bottom)
          else api.putOnEncounterDeck?.(bottom, { top: true })
        }
        api.info(`秘密卷轴：「${api.cardName(bottom)}」${DESTINATION_LABELS[destination]}。`)
      },
    },
  ],
  modifiers: [],
}
