// 12057 视线盲区（Out of Sight）
// 卡面：每次技能检定最多投入1张。
//       如果本次检定成功且超过难度至少1点，执行检定的调查员可以与每个敌人解除交战并移动到一个已揭示地点，
//       该地点与其所在地点连接次数不超过2。
//
// 读点：
//   · 投入限制 → commit 档案 maxPerTest:1（commit-rules.js 的同一读点）；
//   · 「成功且超过难度至少 1 点」→ commit 档案 onSuccessResolve（tests.js 成功结算时以 successBy 回调）；
//   · 解除交战 → api.disengageAll；移动 → api.moveInvestigator（目标为 1~2 个连接内的已揭示地点，条目内 BFS 读取连接图）。
//   · 图标（敏捷×3）由 cards-data 的 icons 数据提供，不在条目里重复。
const CODE = '12057'

function reachableRevealed(state, from, maxConnections) {
  const byId = new Map(state.locations.map(location => [location.id, location]))
  const distances = new Map([[from, 0]])
  const queue = [from]
  while (queue.length) {
    const current = queue.shift()
    const distance = distances.get(current) || 0
    if (distance >= maxConnections) continue
    const location = byId.get(current)
    for (const next of location?.connections || []) {
      if (!byId.has(next) || distances.has(next)) continue
      distances.set(next, distance + 1)
      queue.push(next)
    }
  }
  return state.locations.filter(location => location.id !== from && distances.has(location.id)
    && location.revealed !== false)
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '成功且超过难度 1 点：解除与每个敌人的交战，并移动到 1~2 个连接内的已揭示地点',
      skill: {
        maxPerTest: 1,
        onSuccessResolve: ({ state, inv, result, api }) => {
          if (!result?.success || (result.successBy || 0) < 1) return
          const candidates = reachableRevealed(state, inv.location, 2)
          if (!candidates.length) return
          const hasEngaged = (inv.engaged || []).length > 0
          const answer = api.choice({
            kind: 'location', source: CODE, seat: inv.seat, canSkip: true,
            prompt: '视线盲区：是否与每个敌人解除交战，并移动到一个 1~2 个连接内的已揭示地点？',
            options: [
              { id: 'skip', label: '不移动' },
              ...candidates.map(location => ({ id: location.id, label: location.name })),
            ],
          })
          if (!candidates.some(location => location.id === answer)) return
          if (hasEngaged) api.disengageAll(inv.seat)
          api.moveInvestigator(inv.seat, answer)
          api.info(`👣「视线盲区」：${inv.name} 解除交战并移动到「${api.locationName(answer)}」。`)
        },
      },
    },
  ],
}
