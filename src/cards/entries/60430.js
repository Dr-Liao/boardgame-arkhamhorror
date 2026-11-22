import { attackableEnemies, firstMatchingToken } from './_shared.js'

export default {
  code: '60430',
  uses: 4,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '花费 1 充能：用意志攻击，意志 +3，伤害 +2；揭示旧印、+1 或 0 时伤害 2',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('fight'),
    target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
      !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
    resolve: ({ inv, api, source, targetId }) => api.fight(inv.seat, targetId, {
      assetId: source.id,
      skill: 'willpower',
      combatBonus: 3,
      damageBonus: 2,
      noSpend: true,
      onToken: firstMatchingToken(['eldersign', '+1', '0'], { api, inv, source }, () => api.damage(inv.seat, 2)),
    }),
  }],
}
