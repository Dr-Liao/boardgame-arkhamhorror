import { ALL_CARDS } from '../cards-data.js'

const code = '11087'

export default {
  code,
  discardPlayCost: { trait: 'Item', slot: 'hand', zones: ['hand', 'play'] },
  playCondition: [{
    when: ({ state, inv }) => state.locations.some(location => location.id === inv.location && !location.locked),
    message: '所在地点无法调查',
  }],
  abilities: [{
    kind: 'played',
    countsAs: 'investigate',
    label: '弃掉占手部槽位的道具：调查，按弃牌的印刷费用增加智识；从场上弃掉时额外发现 1 个线索',
    resolve: ({ inv, context, api }) => {
      const paid = context.playCost?.discardedCard
      if (!paid) return
      api.investigate(inv.seat, {
        bonus: ALL_CARDS[paid.code]?.cost || 0,
        clueBonus: paid.from === 'play' ? 1 : 0,
      })
    },
  }],
}
