import { enemyInEngagement } from '../../engine/enemy-parts.js'

export default {
  code: '52006',
  uses: 3,
  usesType: 'charges',
  onUsesEmptied: ({ inv, source, api }) => api.discardAsset(inv.seat, source),
  abilities: [{
    kind: 'action',
    countsAs: 'evade',
    label: '把意志加入躲避检定，成功差值不足时消耗充能',
    cost: { action: true, exhaust: true },
    target: { kind: 'enemy', query: ({ state, inv, entity, enemyEvade }) =>
      enemyInEngagement(state, entity, inv) && enemyEvade(entity) != null },
    resolve: ({ inv, source, target, api }) => {
      const result = api.evade(inv.seat, { enemyId: target.id, addSkill: 'willpower' })
      if (result && inv.assets.includes(source)
        && (!result.success || result.value - result.difficulty < 2)) api.addUses(source, -1)
    },
  }],
}
