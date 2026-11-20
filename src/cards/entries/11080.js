const CODE = '11080'

export default {
  code: CODE,
  campaignDeck: { brandSpellOnPurchase: true },
  abilities: [{
    kind: 'setup', silent: true, label: '抽起始手牌前，可搜索已烙印的法术支援并支付费用打出',
    resolve: ({ state, inv, api }) => {
      const title = state.campaign.investigators[inv.seat]?.brandedSpell
      if (!title) return
      const options = { titles: [title], zones: ['deck'], source: CODE }
      if (!api.canSearchPlayableAsset(inv.seat, options)) return
      const answer = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '是否在抽起始手牌前搜索并付费打出已烙印的法术支援？',
        options: [{ id: 'skip', label: '不搜索' }, { id: 'search', label: '搜索并付费打出' }],
      })
      if (answer === 'search') api.searchPlayableAsset(inv.seat, options)
    },
  }],
}
