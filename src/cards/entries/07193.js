export default { code: '07193', playCondition: [{ when: ({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location), message: '本地点没有可攻击的敌人' }],
  abilities: [{ kind: 'played', countsAs: 'fight', label: '攻击；每添加 1 诅咒，战斗与伤害各 +1', resolve: ({ state, inv, api }) => {
    const enemyId = api.choice({ kind: 'target', source: '07193', seat: inv.seat, prompt: '选择攻击目标。',
      options: state.enemies.filter(enemy => enemy.location === inv.location).map(enemy => ({ id: enemy.id, label: enemy.name })) })
    const max = Math.min(3, api.chaosTokens.room('curse'))
    const count = Number(api.choice({ kind: 'effect', source: '07193', seat: inv.seat, prompt: '选择添加至多 3 枚诅咒。',
      options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: `${n} 枚诅咒` })) }))
    const added = api.chaosTokens.add('curse', count)
    api.fight(inv.seat, enemyId, { combatBonus: added, damageBonus: added, sourceCode: '07193' })
  } }],
}
