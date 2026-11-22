import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60104',
  abilities: [
    {
      kind: 'weakness',
      label: '显现时放入威胁区，可用两个行动弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: 'enemyDamagePlaced',
      label: '对敌人造成伤害后，受到 1 点伤害',
      criteria: [ownSeat(), ({ context }) => context.amount > 0],
      resolve: ({ inv, api }) => api.damage(inv.seat, 1),
    },
  ],
}
