import { attackableEnemies } from './_shared.js'

const code = '60117'
const candidates = (state, inv, helpers) => attackableEnemies(state, inv).filter(enemy =>
  !enemy.defeated && !enemy.removedFromGame && !enemy.hasParts
  && !helpers.entityRuleActive(enemy, 'cannot:beAttacked'))

export default {
  code,
  playCondition: [({ state, inv, helpers }) => !helpers.capabilityBlocked(inv.seat, 'fight')
    && candidates(state, inv, helpers).length > 0],
  abilities: [{
    kind: 'played', countsAs: 'fight', label: '战斗 +1。成功后可再攻击同一敌人，战斗 +2 且伤害 +1',
    resolve: ({ state, inv, api }) => {
      const options = candidates(state, inv, api)
      if (!options.length) return
      const id = options.length === 1 ? options[0].id : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择要攻击的敌人。',
        options: options.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      if (!options.some(enemy => enemy.id === id)) return
      const first = api.fight(inv.seat, id, { sourceCode: code, noSpend: true, combatBonus: 1 })
      if (!first?.success || first.attackResult?.defeated
        || !candidates(state, inv, api).some(enemy => enemy.id === id)) return
      const again = api.choice({
        kind: 'effect', source: code, seat: inv.seat, canSkip: true, prompt: '是否再攻击同一敌人？',
        options: [{ id: 'fight', label: '再攻击一次' }, { id: 'skip', label: '结束' }],
      })
      if (again === 'fight') api.fight(inv.seat, id, {
        sourceCode: code, noSpend: true, combatBonus: 2, damageBonus: 1,
      })
    },
  }],
}
