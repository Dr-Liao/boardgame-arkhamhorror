import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11017',
  investigator: { handSizeFromBeneath: true, commitFromBeneath: true, elderSign: { bonus: 1 } },
  elderSign: { id: '11017-sign', resolve: () => ({ delta: 1, draw: 1 }) },
  abilities: [{
    kind: 'reaction', trigger: 'handCardDiscarded', label: '将弃牌放在调查员底下，然后抽 1 张牌',
    limit: { scope: 'perPhase', owner: 'player' },
    criteria: [ownSeat(), ({ state, inv, context }) => inv.discard.includes(context.cardCode)
      && (state.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[inv.code]?.length || 0) < 5],
    resolve: ({ inv, context, api }) => {
      if (api.commitOrigins.store(inv.seat, inv.code, context.cardCode, { from: 'discard', capacity: 5 })) {
        api.drawCards(inv.seat, 1)
      }
    },
  }],
}
