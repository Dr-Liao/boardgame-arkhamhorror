import { attackableEnemies } from './_shared.js'

const code = '60132'
const candidates = (state, inv, helpers) => attackableEnemies(state, inv).filter(enemy =>
  !enemy.defeated && !enemy.removedFromGame && !enemy.hasParts && !helpers.entityRuleActive(enemy, 'cannot:beAttacked'))

export default {
  code,
  playCondition: [({ state, inv, helpers }) => !helpers.capabilityBlocked(inv.seat, 'fight')
    && candidates(state, inv, helpers).length > 0],
  abilities: [{
    kind: 'played', countsAs: 'fight', label: '自动成功且伤害 +1；之后可再攻击一次，战斗 +3 且伤害 +2',
    resolve: ({ state, inv, api }) => {
      const firstTargets = candidates(state, inv, api)
      if (!firstTargets.length) return
      const id = firstTargets.length === 1 ? firstTargets[0].id : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择第一次攻击的敌人。',
        options: firstTargets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      if (!firstTargets.some(enemy => enemy.id === id)) return
      const result = api.fight(inv.seat, id, { sourceCode: code, noSpend: true, autoSuccess: true, damageBonus: 1 })
      const secondTargets = candidates(state, inv, api)
      if (!result?.success || inv.defeated || inv.resigned || !secondTargets.length) return
      const next = api.choice({
        kind: 'target', source: code, seat: inv.seat, canSkip: true, prompt: '可选择第二次攻击的敌人。',
        options: [{ id: 'skip', label: '结束' }, ...secondTargets.map(enemy => ({ id: enemy.id, label: enemy.name }))],
      })
      if (secondTargets.some(enemy => enemy.id === next)) {
        api.fight(inv.seat, next, { sourceCode: code, noSpend: true, combatBonus: 3, damageBonus: 2 })
      }
    },
  }],
}
