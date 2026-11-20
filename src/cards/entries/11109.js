const code = '11109'
const enemiesAt = (state, location) => state.enemies.filter(enemy => enemy.location === location
  && !enemy.elite && !enemy.defeated)

export default {
  code,
  abilities: [{
    kind: 'reaction', trigger: 'moveBeforeEngage', cost: { exhaust: true },
    label: '进入地点时：横置。本轮该处的非精英敌人不能与你交战，你不能伤害这些敌人',
    criteria: ({ state, inv, context }) => context.seat === inv.seat && enemiesAt(state, context.location).length > 0,
    resolve: ({ state, inv, context, api }) => {
      api.protectFromEnemies(inv.seat, enemiesAt(state, context.location).map(enemy => enemy.id), {
        duration: 'endOfRound', cannotDamage: true,
      })
    },
  }],
}
