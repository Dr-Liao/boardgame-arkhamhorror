import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11001',
  investigator: { extraSlots: { hand: -1 }, elderSign: { bonus: 1 } },
  elderSign: { id: '11001-sign', resolve: ({ inv, api }) => {
    api.lookAt(inv.seat, { zone: 'investigatorDeck', count: 3, choose: 1, drawChosen: true, filter: { type: 'event' }, returnStrategy: 'shuffle', source: '11001' })
    return { delta: 1 }
  } },
  abilities: [{
    kind: 'reaction', trigger: 'eventPlayed', label: '抽 1 张牌，然后可打出另一张事件',
    limit: { scope: 'perRound', owner: 'player' },
    criteria: [ownSeat(), ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat],
    resolve: ({ inv, context, api }) => {
      api.drawCards(inv.seat, 1)
      api.offerEventPlay(inv.seat, { exclude: context.cardCode, source: inv.code })
    },
  }],
}
