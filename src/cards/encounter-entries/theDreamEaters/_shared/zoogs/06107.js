// 06107 潜行的祖格鼠（Stealthy Zoog，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 与你所在地点 [agility] 最低的调查员交战。猎物 - [agility] 最低。
//       警戒（Alert）。Swarming 1。
// 实现：警戒与 Swarming 1 由 definition 解析；猎物 key 用条目规则覆盖（lowestAgility）；
//   地点由共享 spawnLocation 选择，交战目标由 enemyRule.spawnEngagedSeat
//   按所在地点最低敏捷值选择。
export default {
  code: '06107',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    prey: 'lowestAgility',
    spawnEngagedSeat(state, enemy, drawnSeat, api) {
      const location = state.investigators?.[drawnSeat]?.location || enemy.location
      const candidates = (state.investigators || []).filter(inv =>
        !inv.defeated && !inv.resigned && inv.location === location)
      if (!candidates.length) return null
      const stat = inv => Number(api.investigatorStat?.(inv.seat, 'agility') ?? inv.agility ?? 0)
      const minimum = Math.min(...candidates.map(stat))
      const tied = candidates.filter(inv => stat(inv) === minimum)
      if (tied.length === 1) return tied[0].seat
      const chosen = api.choice?.({
        kind: 'investigator', source: '06107', seat: drawnSeat ?? state.currentSeat ?? 0,
        prompt: '潜行的祖格鼠：选择敏捷值最低的调查员与其交战。',
        options: tied.map(inv => ({ id: String(inv.seat), label: inv.name })),
      })
      return tied.find(inv => String(inv.seat) === String(chosen))?.seat ?? tied[0].seat
    },
  },
  flags: { spawn: { kind: 'engagedWithLowestSkill', skill: 'agility', colocated: true } },
}
