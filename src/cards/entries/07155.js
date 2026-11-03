export default {
  code: '07155', abilities: [{ kind: 'played', noOpportunityAttack: true, label: '揭示 7 个标记并分配伤害',
    resolve: ({ state, inv, api }) => {
      const revealed = api.chaosTokens.inspect(7)
      let remaining = 1 + revealed.filter(token => token === 'curse' || token === 'autofail').length
      const allocation = new Map()
      while (remaining > 0) {
        const targets = state.enemies.filter(enemy => enemy.location === inv.location)
        if (!targets.length) break
        const id = targets.length === 1 ? targets[0].id : api.choice({ kind: 'enemy', source: '07155', seat: inv.seat,
          prompt: `分配 1 点伤害（剩余 ${remaining}）。`, options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        allocation.set(id, (allocation.get(id) || 0) + 1)
        remaining--
      }
      for (const [id, amount] of allocation) {
        const target = state.enemies.find(enemy => enemy.id === id)
        if (target) api.damageEnemy(target, amount, inv.seat)
      }
    } }],
}
