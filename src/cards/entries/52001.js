import { canLeaveControlledAsset } from '../../engine/asset-departure.js'

export default {
  code: '52001',
  uses: 6,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '攻击，额外造成 1 点伤害',
      cost: { action: true, uses: 1 },
      effect: { type: 'fight', damageBonus: 1 },
    },
    {
      kind: 'free',
      label: '支付 1 资源：将此支援收回手牌',
      cost: { resources: 1 },
      criteria: [({ state, inv, source }) => canLeaveControlledAsset(state, inv, source)],
      resolve: ({ inv, source, api }) => api.moveCard(
        { id: source.id, from: 'play', to: 'hand' }, { seat: source.ownerSeat ?? inv.seat },
      ),
    },
  ],
}
