// 60376 一扫而空（升级版，André Patel，2 XP）
// 卡面：调查（[agility]）。本次检定将你的[intellect]加入你的[agility]。本次检定结算后，你可以移动到一个连接地点。
export default {
  code: '60376',
  abilities: [{
    kind: 'played',
    label: '调查（敏捷 + 智力）；结算后可移动到连接地点',
    resolve: ({ state, inv, api }) => {
      api.investigate(inv.seat, { skill: 'agility', addSkill: 'intellect' })
      const location = state.locations.find(item => item.id === inv.location)
      const targets = (location?.connections || []).filter(id => state.locations.some(item => item.id === id))
      if (!targets.length) return
      const answer = api.choice({
        kind: 'choice', source: '60376', seat: inv.seat, canSkip: true,
        prompt: '本次调查结算后：是否移动到一个连接地点？',
        options: [{ id: 'skip', label: '留在原地' },
          ...targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id }))],
      })
      if (answer !== 'skip' && targets.includes(answer)) api.moveInvestigator(inv.seat, answer)
    },
  }],
}
