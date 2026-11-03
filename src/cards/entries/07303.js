export default {
  code: '07303', deckConstruction: { sizeBonus: 5, minimumTypes: { skill: 10 } },
  abilities: [
    { kind: 'setup', label: '起始手牌前：随机附属 5 张非弱点技能', resolve: ({ inv, source, api }) => {
      if (api.choice({ kind: 'reaction', seat: inv.seat, source: '07303', canSkip: true, prompt: '在先祖知识下方放置随机 5 张非弱点技能？',
        options: [{ id: 'attach', label: '附属技能' }, { id: 'skip', label: '不触发' }] }) !== 'attach') return
      const candidates = inv.deck.filter(code => api.cardType(code) === 'skill' && api.isNonWeakness(code))
      for (let i = 0; i < 5 && candidates.length; i++) {
        const index = Math.floor(api.random() * candidates.length)
        const [code] = candidates.splice(index, 1)
        api.commitOrigins.store(inv.seat, source.id, code, { from: 'deck' })
      }
    } },
    { kind: 'free', label: '横置：抽取 1 张附属技能', cost: { action: false, exhaust: true },
      criteria: ({ state, inv, source }) => (state.scenarioFlags.mechanics?.beneath?.[inv.seat]?.[source.id] || []).length > 0,
      resolve: ({ inv, source, api }) => {
        const cards = api.commitOrigins.beneath(inv.seat, source.id)
        if (!cards.length) return
        const code = cards.length === 1 ? cards[0] : api.choice({ kind: 'card', seat: inv.seat, source: source.id,
          prompt: '选择抽取的附属技能。', options: cards.map((code, i) => ({ id: String(i), cardCode: code, label: api.cardName(code) })) })
        api.playerTools.drawBeneath(inv.seat, source.id, cards.length === 1 ? code : cards[Number(code)])
      } },
  ],
}
