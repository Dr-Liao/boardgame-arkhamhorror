import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60127',
  modifiers: [
    { target: 'skill:combat', amount: 2, condition: { when: ({ state }) => state.skillTest?.actionKind === 'fight' } },
  ],
  abilities: [{
    kind: 'reaction', trigger: 'defeatEnemy', label: '横置本牌，查找牌库顶 9 张中的一张灵体事件',
    cost: { exhaust: true }, criteria: [ownSeat()],
    resolve: ({ inv, api }) => api.lookAt(inv.seat, {
      zone: 'investigatorDeck', count: 9, choose: 1, filter: { type: 'event', trait: 'Spirit' },
      returnStrategy: 'shuffle', source: '60127',
    }),
  }],
}
