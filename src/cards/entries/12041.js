// 12041 溜之大吉（Through the Cracks）· 事件 · 探求者 2 经验 · 费用 2
// 卡面：躲避([agility])。本次躲避尝试你得到+2[agility]，你每控制 1 个线索再 +2（最多 +6）。
//       如果本次检定成功，执行检定的调查员可以与每个敌人解除交战并移动到一个已揭示的连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Event/Events/ThroughTheCracks.hs 的高阶版本（12041；卡面数值来自 Core2026.hs）。
// 读点与 12037 相同：played + countsAs:'evade' → api.evade（bonus 按线索计算）；
//   成功后可选「解除全部交战并移动到已揭示连接地点」（api.choice + api.scenario.disengage + api.moveInvestigator）。
const PER_CLUE = 2
const MAX_BONUS = 6

function evadableEnemies(state, inv) {
  const engaged = new Set(inv.engaged || [])
  return state.enemies.filter(enemy => engaged.has(enemy.id)
    || (enemy.massive && enemy.location === inv.location))
}

function revealedConnections(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  return (here?.connections || [])
    .map(id => state.locations.find(location => location.id === id))
    .filter(location => location && location.revealed)
}

export default {
  code: '12041',
  playCondition: [{
    when: ({ state, inv }) => evadableEnemies(state, inv).length > 0,
    message: '没有可躲避的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'evade',
      noOpportunityAttack: true,
      label: '躲避（每线索 +2 敏捷，最多 +6；成功后可与每个敌人解除交战并移动）',
      resolve: ({ state, inv, api }) => {
        const targets = evadableEnemies(state, inv)
        if (!targets.length) { api.info('没有可躲避的敌人。'); return }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: '12041', seat: inv.seat, prompt: '选择要躲避的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const bonus = Math.min(PER_CLUE * (Number(inv.clues) || 0), MAX_BONUS)
        api.evade(inv.seat, {
          enemyId, bonus, sourceCode: '12041',
          onSuccess: () => {
            const remaining = evadableEnemies(state, inv)
            const destinations = revealedConnections(state, inv)
            if (!remaining.length && !destinations.length) return
            const parts = []
            if (remaining.length) parts.push(`与 ${remaining.length} 个敌人解除交战`)
            if (destinations.length) parts.push('移动到一个已揭示的连接地点')
            const pick = api.choice({
              kind: 'choice', source: '12041', seat: inv.seat,
              prompt: `溜之大吉：是否${parts.join('并')}？`,
              options: [{ id: 'skip', label: '不' }, { id: 'trigger', label: parts.join('并') }],
            })
            if (pick !== 'trigger') return
            for (const enemy of remaining) api.scenario.disengage(enemy)
            if (!destinations.length) return
            const destination = destinations.length === 1 ? destinations[0].id : api.choice({
              kind: 'move', source: '12041', seat: inv.seat, prompt: '选择要移动到的已揭示连接地点。',
              options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
            })
            api.moveInvestigator(inv.seat, destination)
            api.info(`${inv.name} 从缝隙中溜走，移动到「${api.locName(destination)}」。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
