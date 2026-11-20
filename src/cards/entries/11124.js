function eligibleEnemies(state) {
  return state.enemies.filter(enemy => !enemy.defeated && !enemy.elite && enemy.location != null)
}

export default {
  code: '11124',
  abilities: [{
    kind: 'played', fast: true, trigger: 'phaseBegins',
    limit: { scope: 'perGame', owner: 'group' },
    label: '调查阶段开始时，将一个地点的所有非精英敌人放到一边直到本轮结束',
    criteria: ({ state }) => state.phase === 'investigation' && eligibleEnemies(state).length > 0,
    resolve: ({ state, inv, api }) => {
      const enemies = eligibleEnemies(state)
      const locations = state.locations.filter(location => enemies.some(enemy => enemy.location === location.id))
      const locationId = api.choice({ kind: 'location', source: '11124', seat: inv.seat, prompt: '选择一个地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })) })
      for (const enemy of enemies.filter(enemy => enemy.location === locationId)) {
        api.setEnemyAside(enemy, { untilRoundEnd: true })
      }
    },
  }],
  modifiers: [],
}
