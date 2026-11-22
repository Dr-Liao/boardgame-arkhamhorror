// 60317 身手矫捷
// 卡面：本次技能检定每成功超过难度1点，结算后你便可以立即移动到一个连接地点(最多移动3次)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60317',
  abilities: [{
    kind: 'commit', label: '成功检定后，每超过难度一点可移动到连接地点，最多三次',
    skill: {
      afterTest: ({ inv, state, api, result }) => {
        if (!result?.success) return
        const maximum = Math.min(3, result.value - result.difficulty)
        for (let distance = 0; distance < maximum; distance++) {
          const origin = state.locations.find(location => location.id === inv.location)
          const candidates = origin?.connections.filter(id => api.canMoveTo(inv.seat, id)) || []
          if (!candidates.length) return
          const destination = api.choice({
            kind: 'location', source: '60317', seat: inv.seat, canSkip: true,
            prompt: '选择一个连接地点移动，或停止移动。',
            options: [{ id: 'stop', label: '停止移动' }, ...candidates.map(id => ({ id, label: api.locationName(id) }))],
          })
          if (destination === 'stop') return
          api.moveInvestigator(inv.seat, destination)
        }
      },
    },
  }],
}
