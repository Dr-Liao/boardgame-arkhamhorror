import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11006',
  abilities: [
    { kind: 'weakness', label: '放入威胁区', weakness: { type: 'threat' } },
    {
      kind: 'forced', trigger: 'clueDiscovered', label: '承受 1 点恐惧并将弱点洗回牌库',
      limit: { scope: 'perTurn', owner: 'player' },
      criteria: [ownSeat(), ({ context }) => context.firstThisTurn === true],
      resolve: ({ inv, source, api }) => {
        api.horror(inv.seat, 1)
        if (api.removeThreat(source)) {
          api.moveCard({ code: source.code, from: 'discard', to: 'deckTop', ownerSeat: inv.seat }, { seat: inv.seat })
          api.shuffleDeck(inv.seat)
        }
      },
    },
  ],
}
