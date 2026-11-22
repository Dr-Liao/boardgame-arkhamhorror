import { canLeaveControlledAsset } from '../../engine/asset-departure.js'

export default {
  code: '52009',
  abilities: [
    {
      kind: 'action',
      label: '调查，地点帷幕下降 1 点',
      cost: { action: true },
      effect: { type: 'investigate', shroudMod: -1 },
    },
    {
      kind: 'action',
      label: '弃置自身，造成 1 点伤害',
      cost: { action: true, discardSelf: true },
      effect: { type: 'dealDamage', amount: 1, target: 'here', noOpportunityAttack: true },
    },
    {
      kind: 'action',
      label: '将自身移出游戏，造成 2 点伤害',
      cost: { action: true },
      noOpportunityAttack: true,
      criteria: [({ state, inv, source }) => canLeaveControlledAsset(state, inv, source)],
      target: { kind: 'enemy', query: ({ entity, canDamageEnemy, source }) =>
        canDamageEnemy(entity, source.id) },
      resolve: ({ inv, source, target, api }) => {
        const moved = api.moveCard({ id: source.id, from: 'play', to: 'removedFromGame' })
        if (moved) api.damageEnemy(target.entity, 2, inv.seat, source.code)
      },
    },
  ],
}
