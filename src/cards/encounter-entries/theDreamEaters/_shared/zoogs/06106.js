// 06106 鬼祟的祖格鼠（Furtive Zoog，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 与你所在地点 [combat] 最低的调查员交战。猎物 - [combat] 最低。
//       反击（Retaliate）。Swarming 1。
// 实现：反击与 Swarming 1 由 definition 解析（card-data + 共享层蜂拥自动放置）；
//   猎物 key 用条目规则覆盖（lowestCombat）；地点由共享 spawnLocation 选择，
//   交战目标由 enemyRule.spawnEngagedSeat 按所在地点最低战斗值选择。
export default {
  code: '06106',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    prey: 'lowestCombat',
    spawnEngagedSeat(state, enemy, drawnSeat, api) {
      const location = state.investigators?.[drawnSeat]?.location || enemy.location
      const candidates = (state.investigators || []).filter(inv =>
        !inv.defeated && !inv.resigned && inv.location === location)
      if (!candidates.length) return null
      const stat = inv => Number(api.investigatorStat?.(inv.seat, 'combat') ?? inv.combat ?? 0)
      const minimum = Math.min(...candidates.map(stat))
      const tied = candidates.filter(inv => stat(inv) === minimum)
      if (tied.length === 1) return tied[0].seat
      const chosen = api.choice?.({
        kind: 'investigator', source: '06106', seat: drawnSeat ?? state.currentSeat ?? 0,
        prompt: '鬼祟的祖格鼠：选择战斗值最低的调查员与其交战。',
        options: tied.map(inv => ({ id: String(inv.seat), label: inv.name })),
      })
      return tied.find(inv => String(inv.seat) === String(chosen))?.seat ?? tied[0].seat
    },
  },
  flags: { spawn: { kind: 'engagedWithLowestSkill', skill: 'combat', colocated: true } },
}
