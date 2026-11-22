import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60109',
  abilities: [
    {
      kind: 'reaction', trigger: 'enemyDamagePlaced', label: '横置本牌，将多余伤害放到本牌',
      cost: { exhaust: true }, criteria: [ownSeat(), ({ context }) => context.excess > 0],
      resolve: ({ source, context, api }) => api.investigatorTools.setAssetDamage(source, context.excess),
    },
    {
      kind: 'free', label: '弃掉本牌，按其积累的伤害获得资源', cost: { discardSelf: true },
      criteria: [({ source, helpers }) => source.damage > 0 && helpers.canGainResources()],
      resolve: ({ inv, source, api }) => api.gainResources(inv.seat, source.damage),
    },
  ],
}
