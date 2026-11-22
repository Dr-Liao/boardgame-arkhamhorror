import { enemyInEngagement } from '../../engine/enemy-parts.js'
import { firstMatchingToken } from './_shared.js'

export default {
  code: '60432',
  uses: 3,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    countsAs: 'evade',
    label: '花费 1 充能：用意志躲避，意志 +3，成功后伤害 +2；揭示旧印、+1 或 0 时损失资源 2',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('evade'),
    target: { kind: 'enemy', query: ({ state, inv, entity, enemyEvade }) =>
      enemyInEngagement(state, entity, inv) && Number.isFinite(enemyEvade(entity)) },
    resolve: ({ inv, api, source, targetId }) => api.evade(inv.seat, {
      assetId: source.id,
      skill: 'willpower',
      bonus: 3,
      damageOnSuccess: 2,
      enemyId: targetId,
      onToken: firstMatchingToken(['eldersign', '+1', '0'], { api, inv, source }, () => api.loseResources(inv.seat, 2)),
    }),
  }],
}
