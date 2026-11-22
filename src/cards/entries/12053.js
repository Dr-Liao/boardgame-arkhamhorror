// 12053 视线盲区（Out of Sight）· 技能 · 游荡者 0 经验
// 卡面：每次技能检定最多投入 1 张。
// 卡面：如果本次检定成功且超过难度至少 2 点，执行检定的调查员可以与每个敌人解除交战
//       并移动到一个已揭示的连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Skill/Cards/OutOfSight.hs
//   （commit 限制 MaxOnePerTest；PassedSkillTest n >= 2 → 可选 disengage all + move to revealed connecting location）。
// 读点：commit 描述子的 skill 档案 —— maxPerTest:1 是引擎 commit-rules 的投入上限读点；
//   onSuccessResolve 由 tests.js#resolveCommit 在检定成功后回调（拿 result.successBy / api），
//   这里用 api.choice 提供可选项，api.scenario.disengage 解除交战、api.moveInvestigator 移动。
function revealedConnections(state, inv) {
  const here = state.locations.find(location => location.id === inv.location)
  return (here?.connections || [])
    .map(id => state.locations.find(location => location.id === id))
    .filter(location => location && location.revealed)
}

export default {
  code: '12053',
  abilities: [
    {
      kind: 'commit',
      label: '视线盲区：成功且超过难度 2+ 时可解除全部交战并移动',
      skill: {
        maxPerTest: 1,
        onSuccessResolve: ({ state, inv, result, api }) => {
          if (!result?.success || (Number(result.successBy) || 0) < 2) return
          const enemiesEngaged = (inv.engaged || [])
            .map(id => state.enemies.find(enemy => enemy.id === id))
            .filter(Boolean)
          const destinations = revealedConnections(state, inv)
          if (!enemiesEngaged.length && !destinations.length) return
          const parts = []
          if (enemiesEngaged.length) parts.push(`与 ${enemiesEngaged.length} 个敌人解除交战`)
          if (destinations.length) parts.push('移动到一个已揭示的连接地点')
          const pick = api.choice({
            kind: 'choice', source: '12053', seat: inv.seat,
            prompt: `视线盲区：是否${parts.join('并')}？`,
            options: [{ id: 'skip', label: '不' }, { id: 'trigger', label: parts.join('并') }],
          })
          if (pick !== 'trigger') return
          for (const enemy of enemiesEngaged) api.scenario.disengage(enemy)
          if (!destinations.length) return
          const destination = destinations.length === 1 ? destinations[0].id : api.choice({
            kind: 'move', source: '12053', seat: inv.seat, prompt: '选择要移动到的已揭示连接地点。',
            options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
          })
          api.moveInvestigator(inv.seat, destination)
          api.info(`${inv.name} 借着视线盲区移动到「${api.locName(destination)}」。`)
        },
      },
    },
  ],
  modifiers: [],
}
