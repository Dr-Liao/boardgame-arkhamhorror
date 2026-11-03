export default { code: '07114', abilities: [{ kind: 'played', noOpportunityAttack: true, countsAs: 'investigate',
  label: '调查时加入敏捷；成功超过 2 时可自动躲避', resolve: ({ state, inv, api }) => {
    const result = api.investigate(inv.seat, { addSkill: 'agility' })
    if (!result?.success || result.value - result.difficulty < 2) return
    const targets = state.enemies.filter(enemy => enemy.location === inv.location && api.canAutoEvade(enemy, inv.seat))
    if (!targets.length) return
    const id = api.choice({ kind: 'target', source: '07114', seat: inv.seat, canSkip: true, prompt: '可以自动躲避本地点一个敌人。',
      options: [...targets.map(enemy => ({ id: enemy.id, label: enemy.name })), { id: 'skip', label: '不躲避' }] })
    const target = targets.find(enemy => enemy.id === id)
    if (target) api.autoEvadeEnemy(target)
  },
}] }
