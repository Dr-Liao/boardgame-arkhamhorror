// 60364 一扫而空（Clean Sweep，André Patel）
// 卡面：调查（[intellect]）。本次调查你得到 +2[intellect]。
//       如果你发现了你所在地点的最后一个线索，你可以移动到一个连接地点。
export default {
  code: '60364',
  abilities: [{
    kind: 'played',
    label: '调查 +2 智力；发现最后一个线索后可移动到连接地点',
    resolve: ({ state, inv, api }) => {
      const location = state.locations.find(item => item.id === inv.location)
      const result = api.investigate(inv.seat, { bonus: 2 })
      if (!result?.success || !location || (location.clues || 0) > 0) return
      const targets = (location.connections || []).filter(id => state.locations.some(item => item.id === id))
      if (!targets.length) return
      const answer = api.choice({
        kind: 'choice', source: '60364', seat: inv.seat, canSkip: true,
        prompt: '发现了最后一个线索：是否移动到一个连接地点？',
        options: [{ id: 'skip', label: '留在原地' },
          ...targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id }))],
      })
      if (answer !== 'skip' && targets.includes(answer)) api.moveInvestigator(inv.seat, answer)
    },
  }],
}
