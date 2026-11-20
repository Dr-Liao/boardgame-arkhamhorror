import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11020', uses: 3, usesType: 'secrets',
  abilities: [
    {
      kind: 'reaction', trigger: 'eventPlayed', cost: { uses: 1, exhaust: true },
      label: '打出策略事件后横置并花费 1 秘密，在你的回合结束时将该事件返回手中',
      criteria: [ownSeat(), ({ context, helpers }) => Boolean(context.discardedEvent)
        && helpers.cardTraits(context.cardCode).some(trait => trait.toLowerCase() === 'tactic')],
      resolve: ({ inv, context, api }) => api.deferPlayedEventReturn(context, inv.seat),
    },
  ],
}
