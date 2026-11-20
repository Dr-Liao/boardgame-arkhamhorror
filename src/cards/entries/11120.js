function canDiscover({ inv, helpers }) {
  return helpers.canDiscoverClueAt(inv.seat, inv.location)
}

function enemiesAt({ state, inv }, canDamage) {
  return state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location && canDamage(enemy))
}

export default {
  code: '11120',
  uses: 5,
  usesType: 'lead',
  playCondition: [{
    when: ({ inv }) => !inv.assets.some(asset => asset.code === '11120'),
    message: '每位调查员最多控制 1 张穷追不舍',
  }],
  abilities: [{
    kind: 'reaction', trigger: 'move', label: '进入有敌人的地点后，消耗 1 个线索标记并横置',
    cost: { uses: 1, exhaust: true },
    criteria: ctx => ctx.context.seat === ctx.inv.seat
      && enemiesAt(ctx, () => true).length > 0
      && (canDiscover(ctx) || enemiesAt(ctx, enemy => ctx.helpers.canDamageEnemy(enemy, ctx.inv.seat, '11120')).length > 0),
    resolve: ({ state, inv, api }) => {
      const enemies = enemiesAt({ state, inv }, enemy => api.canDamageEnemy(enemy, inv.seat, '11120'))
      const options = enemies.map(enemy => ({ id: enemy.id, label: `对「${enemy.name}」造成 1 点伤害` }))
      if (api.canDiscoverClueAt(inv.seat, inv.location)) options.unshift({ id: 'clue', label: '发现 1 个线索' })
      const answer = api.choice({ kind: 'effect', source: '11120', seat: inv.seat, prompt: '选择调查或造成伤害。', options })
      if (answer === 'clue') api.discoverClue(inv.seat, 1, inv.location)
      else if (answer) api.damageEnemy(enemies.find(enemy => enemy.id === answer), 1, inv.seat, '11120')
    },
  }],
  modifiers: [],
}
