import { ownSeat } from '../../engine/matcher.js'

const code = '52012'

export default {
  code,
  hiddenRule: { playerWeakness: true, scenarioXpModifier: -2 },
  abilities: [
    {
      kind: 'weakness',
      label: '将弱点秘密加入手牌',
      weakness: { type: 'hidden' },
      resolve: ({ inv, api }) => api.placeHiddenWeakness(inv.seat, code),
    },
    {
      kind: 'reaction',
      trigger: 'investigateSuccess',
      fromHand: true,
      noPlayCost: true,
      label: '成功调查没有线索的地点后弃置',
      criteria: [ownSeat(), ({ state, inv, context }) => inv.hiddenCards?.includes(code)
        && state.locations.some(location => location.id === context.location && location.clues === 0)],
      resolve: ({ inv, api }) => api.discardHiddenWeakness(inv.seat, code),
    },
  ],
}
