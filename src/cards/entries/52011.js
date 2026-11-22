import { ownSeat } from '../../engine/matcher.js'

const code = '52011'

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
      trigger: 'enemyDamagePlaced',
      fromHand: true,
      noPlayCost: true,
      label: '造成超过敌人剩余生命的伤害后弃置',
      criteria: [ownSeat(), ({ inv, context }) => inv.hiddenCards?.includes(code) && context.excess > 0],
      resolve: ({ inv, api }) => api.discardHiddenWeakness(inv.seat, code),
    },
  ],
}
