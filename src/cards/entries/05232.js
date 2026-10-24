// 05232 绝密地图集（探求者 · 1 经验）
// 卡面：使用(4秘密)。
// 卡面：[action]花费1秘密并横置绝密地图集：选择一个与你所在地点之间的连接次数正好为2的已揭示地点。
//       移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05232 绝密地图集：[行动]花 1 秘密并横置：移动到与所在地点距离正好为 2 的已揭示地点。

const connectionsOf = (state, locationId) =>
  state.locations.find(location => location.id === locationId)?.connections || []

// 「正好 2 次连接」= 最短距离为 2：排除自身与直接相连的地点。
function locationsExactlyTwoAway(state, fromId) {
  const direct = new Set(connectionsOf(state, fromId))
  const seen = new Set()
  const out = []
  for (const middle of direct) {
    for (const destination of connectionsOf(state, middle)) {
      if (destination === fromId || direct.has(destination) || seen.has(destination)) continue
      const location = state.locations.find(item => item.id === destination)
      if (!location || !location.revealed) continue
      seen.add(destination)
      out.push({ id: destination, label: location.name || destination })
    }
  }
  return out
}

export default {
  code: '05232',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '花 1 秘密并横置：移动到距离正好为 2 的已揭示地点',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const candidates = locationsExactlyTwoAway(state, inv.location)
        if (!candidates.length) {
          api.info('与所在地点距离正好为 2 的已揭示地点不存在。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({
            kind: 'location', source: '05232', seat: inv.seat,
            prompt: '选择一个与你所在地点之间连接次数正好为 2 的已揭示地点。',
            options: candidates,
          })
        const destination = candidates.find(option => option.id === chosen) || candidates[0]
        api.moveInvestigator(inv.seat, destination.id)
        api.info(`🗺️ ${inv.name} 用「绝密地图集」移动到「${destination.label}」。`)
      },
    },
  ],
}
