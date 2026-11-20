const damageForEnemy = enemy => (enemy.elite ? 5 : 10)

export default {
  code: '11105',
  removeAfterPlay: true,
  playCondition: [{
    when: ({ state, inv, helpers }) => state.enemies.some(enemy => enemy.location === inv.location && !enemy.defeated && !helpers.parleyForbidden(inv.seat, enemy)),
    message: '所在地点没有敌人',
  }],
  abilities: [{
    kind: 'played', countsAs: 'parley', noOpportunityAttack: true,
    label: '谈判：对本地点的敌人造成 10 伤害，精英则为 5，随后将本卡移出游戏',
    resolve: ({ state, inv, api }) => {
      const options = state.enemies.filter(enemy => enemy.location === inv.location
        && !enemy.defeated && !api.parleyForbidden(inv.seat, enemy) && api.canDamageEnemy(enemy, inv.seat, { code: '11105' }))
      if (!options.length) return
      const enemyId = options.length === 1 ? options[0].id : api.choice({
        kind: 'enemy', source: '11105', seat: inv.seat, prompt: '选择谈判的敌人。',
        options: options.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = options.find(target => target.id === enemyId)
      api.damageEnemy(enemy, damageForEnemy(enemy), inv.seat, { code: '11105' })
    },
  }],
}
