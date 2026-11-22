import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '60512',
  playCondition: [ownTurn()],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '你的回合中打出：本回合下一次检定不揭示混乱标记',
    resolve: ({ inv, api }) => api.skipNextTestTokens(inv.seat, { endOfTurn: true }),
  }],
}
