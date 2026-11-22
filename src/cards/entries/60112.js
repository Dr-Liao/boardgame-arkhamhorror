import { ownSeat } from '../../engine/matcher.js'

const code = '60112'

export default {
  code,
  abilities: [{
    kind: 'played', fast: true, trigger: 'enemyAttacked', countsAs: 'fight',
    label: '攻击刚才向你发动攻击的敌人',
    criteria: [ownSeat(), ({ state, inv, context, helpers }) =>
      state.enemies.some(enemy => enemy.id === context.enemy?.id)
      && !helpers?.capabilityBlocked?.(inv.seat, 'fight')],
    resolve: ({ inv, context, api }) => api.fight(inv.seat, context.enemy.id, {
      sourceCode: code, noSpend: true, ignoreDistance: true, ignoreAloof: true,
    }),
  }],
}
