import { attackableEnemies } from './_shared.js'

export default {
  code: '60529',
  uses: 3,
  usesType: 'supplies',
  abilities: [{
    kind: 'action',
    countsAs: 'fight',
    label: '花费 1 补给攻击：战斗 +2、伤害 +2。若失败，补回 1 补给或对该敌人造成 1 伤害',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('fight'),
    target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
      !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
    resolve: ({ api, state, inv, source, target }) => {
      const result = api.fight(inv.seat, target.id, {
        assetId: source.id,
        combatBonus: 2,
        damageBonus: 2,
        noSpend: true,
      })
      if (result?.success !== false) return
      const attacked = state.enemies.find(enemy => enemy.id === (result.source?.enemyId ?? target.id))
      const options = []
      if (inv.assets.includes(source)) options.push({ id: 'replenish', label: '补回 1 补给' })
      if (attacked) options.push({ id: 'damage', label: '对该敌人造成 1 伤害' })
      if (!options.length) return
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: '60529', seat: inv.seat,
        prompt: '攻击失败：补回补给或伤害敌人。',
        options,
      })
      if (answer === 'damage') api.damageEnemy(attacked, 1, inv.seat, '60529')
      else api.addUses(source, 1)
    },
  }],
}
