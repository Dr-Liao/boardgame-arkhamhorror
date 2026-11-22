import { attackableEnemies } from './_shared.js'

export default {
  code: '60505',
  uses: 2,
  usesType: 'ammo',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '花费 1 弹药攻击：战斗 +2、伤害 +1。若失败，补回 1 弹药',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('fight'),
    target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
      !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
    resolve: ({ api, inv, source, target }) => {
      const result = api.fight(inv.seat, target.id, {
        assetId: source.id,
        combatBonus: 2,
        damageBonus: 1,
        noSpend: true,
      })
      if (result?.success === false && inv.assets.includes(source)) api.addUses(source, 1)
    },
  }],
}
