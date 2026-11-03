// Tempt Fate — "Then" requires the first instruction to resolve in full.
export default { code: '07037', abilities: [{ kind: 'played', label: '加入诅咒，然后加入祝福并抽牌', fast: true,
  resolve: ({ inv, api }) => {
    if (api.chaosTokens.add('curse', 3) !== 3) return
    api.chaosTokens.add('bless', 3)
    api.drawCards(inv.seat, 1)
  } }] }
