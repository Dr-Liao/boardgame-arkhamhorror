// 08593 艾米·肯斯勒博士 · 坚毅伙伴
export default {
  code: '08593', scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'free', actionKind: 'investigate', label: '花费 1 秘密并横置：以基础智力 6 调查，成功可查看并弃掉一张牌库顶牌',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat,
    resolve: ({ state, inv, api }) => {
      if (!api.investigate(inv.seat, { skill: 'intellect', baseValue: 6 })?.success) return
      const options = state.investigators.filter(owner => !owner.defeated && !owner.resigned && owner.deck.length)
        .map(owner => ({ id: 'investigator:' + owner.seat, label: owner.name + ' 的牌库', owner }))
      if (state.encounterDeck.length) options.push({ id: 'encounter', label: '遭遇牌库' })
      if (!options.length) return
      const deckId = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '08593', seat: inv.seat,
        prompt: '选择要查看的牌库。', options: options.map(({ id, label }) => ({ id, label })) })
      const deck = options.find(option => option.id === deckId)
      if (!deck) return
      const code = deck.owner ? deck.owner.deck.at(-1) : api.scenario.lookEncounterTop(inv.seat, 1)?.[0]
      if (!code) return
      const chosen = api.choice({ kind: 'card', source: '08593', seat: inv.seat,
        prompt: '查看了「' + api.cardName(code) + '」。你可以弃掉它。',
        options: [{ id: 'keep', label: '留在牌库顶', cardCode: code }, { id: 'discard', label: '弃掉', cardCode: code }] })
      if (chosen !== 'discard') return
      if (deck.owner) api.scenario.moveCard({ ownerSeat: deck.owner.seat, code, from: 'deck', to: 'discard' })
      else api.scenario.discardEncounterCard(code)
    },
  }],
}
