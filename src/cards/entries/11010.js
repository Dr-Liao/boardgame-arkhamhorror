export default {
  code: '11010',
  threatEffect: { extraChaosTokens: 1 },
  abilities: [
    { kind: 'weakness', label: '放入威胁区', weakness: { type: 'threat' } },
    {
      kind: 'action', label: '将这张弱点洗回牌库',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        if (api.removeThreat(source)) {
          api.moveCard({ code: source.code, from: 'discard', to: 'deckTop', ownerSeat: inv.seat }, { seat: inv.seat })
          api.shuffleDeck(inv.seat)
        }
      },
    },
  ],
}
