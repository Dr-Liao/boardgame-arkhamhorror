import { ownSeat } from '../../engine/matcher.js'

const code = '60122'

export default {
  code,
  abilities: [{
    kind: 'played', fast: true, trigger: 'enemyAttack', countsAs: 'fight',
    label: '先攻击这名敌人，战斗 +2 且伤害 +1',
    criteria: [ownSeat(), ({ state, inv, context, helpers }) =>
      state.enemies.some(enemy => enemy.id === context.enemy?.id)
      && !helpers?.capabilityBlocked?.(inv.seat, 'fight')],
    resolve: ({ inv, context, api }) => api.fight(inv.seat, context.enemy.id, {
      sourceCode: code, noSpend: true, ignoreDistance: true, ignoreAloof: true, combatBonus: 2, damageBonus: 1,
    }),
  }],
}
