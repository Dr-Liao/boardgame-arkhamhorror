import { canLeaveControlledAsset } from '../../engine/asset-departure.js'

export default {
  code: '52010',
  abilities: [
    {
      kind: 'action',
      label: '攻击，战斗值提高 2 点',
      cost: { action: true },
      effect: { type: 'fight', combatBonus: 2 },
    },
    {
      kind: 'action',
      label: '弃置自身，发现 1 个线索',
      cost: { action: true, discardSelf: true },
      effect: { type: 'discoverClue', amount: 1 },
    },
    {
      kind: 'action',
      label: '将自身移出游戏，发现 2 个线索',
      cost: { action: true },
      criteria: [({ state, inv, source, helpers }) => canLeaveControlledAsset(state, inv, source)
        && helpers.canDiscoverClueAt(inv.seat, inv.location)
        && state.locations.some(location => location.id === inv.location && location.clues > 0)],
      resolve: ({ inv, source, api }) => {
        const moved = api.moveCard({ id: source.id, from: 'play', to: 'removedFromGame' })
        if (moved) api.discoverClue(inv.seat, 2)
      },
    },
  ],
}
