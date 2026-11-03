import { hasTrait } from '../../_shared.js'

// Damage ability prepared. The second printed key-cost/ready/flip ability
// remains blocked on main's shared key-cost and physical asset-face contract.
export default {
  code: '07300', scope: 'storyAsset',
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置并加入2个诅咒：对本地类人敌人造成1点伤害',
    cost: { exhaust: true },
    additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
    criteria: ({ inv, source }) => inv.assets.some(asset => asset.id === source.id),
    target: { kind: 'enemy', query: ({ entity, canDamageEnemy }) => !entity.defeated && !entity.removedFromGame
      && hasTrait(entity, 'Humanoid') && canDamageEnemy(entity, '07300') },
    resolve: ({ inv, target, api }) => api.damageEnemy(target.entity, 1, inv.seat, '07300'),
  }],
}
