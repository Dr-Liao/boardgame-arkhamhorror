// 08097 袖珍望远镜
// 卡面：[free]横置袖珍望远镜：查看一个连接的未揭示地点的揭示面。
//       [action]：调查。调查一个连接的已揭示地点，如同你在该地点。
//
// 查看使用私有卡面选择，不改变地点的揭示状态。
const connectedLocations = (state, inv, revealed) => {
  const here = state.locations.find(location => location.id === inv.location)
  return (here?.connections || []).map(id => state.locations.find(location => location.id === id))
    .filter(location => location && (location.revealed === true) === revealed)
}

export default {
  code: '08097',
  abilities: [
    { kind: 'free', label: '横置：查看一个相连未揭示地点的揭示面', cost: { action: false, exhaust: true },
      criteria: ({ state, inv }) => connectedLocations(state, inv, false).length > 0,
      resolve: ({ inv, state, api }) => {
        const candidates = connectedLocations(state, inv, false)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'location', source: '08097', seat: inv.seat,
          prompt: '选择要查看的连接地点。', options: candidates.map(location => ({ id: location.id, label: location.name })) })
        const face = api.playerTools.lookAtLocation(inv.seat, chosen)
        if (!face) return
        api.choice({ kind: 'look', source: '08097', seat: inv.seat,
          prompt: `查看「${face.name}」的揭示面。`,
          options: [{ id: 'continue', label: `继续（帷幕 ${face.shroud}，线索 ${face.clues}）`, cardCode: face.code }] })
      } },
    { kind: 'action', label: '调查一个相连的已揭示地点（如同你在该地点）', cost: { action: true }, countsAs: 'investigate',
      criteria: ({ state, inv }) => connectedLocations(state, inv, true).length > 0,
      resolve: ({ inv, state, api }) => {
        const candidates = connectedLocations(state, inv, true)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'location', source: '08097', seat: inv.seat,
          prompt: '选择要调查的相连地点。', options: candidates.map(location => ({ id: location.id, label: location.name })) })
        api.investigate(inv.seat, { locationId: chosen, asIfLocation: true })
      } },
  ],
  modifiers: [],
}
