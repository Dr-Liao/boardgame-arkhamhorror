export default {
  code: '60501',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    label: '旧印：+1，或自动失败并治疗 1 点伤害和 1 点恐惧',
    resolve: ({ inv, api }) => {
      const answer = api.choice({
        kind: 'effect',
        source: '60501',
        seat: inv.seat,
        prompt: '旧印：保留 +1，还是自动失败并治疗？',
        options: [
          { id: 'resolve', label: '保留 +1' },
          { id: 'heal', label: '自动失败并治疗 1 点伤害和 1 点恐惧' },
        ],
      })
      if (answer !== 'heal') return { delta: 1 }
      api.healDamage(inv.seat, 1)
      api.healHorror(inv.seat, 1)
      return { delta: 1, autoFail: true }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'skillTestFail',
    limit: 'oncePerRound',
    label: '检定失败后：本轮你的回合获得 1 个额外行动',
    criteria: ({ state, inv }) => state.skillTest?.seat === inv.seat,
    resolve: ({ inv, api }) => api.grantActionThisRound(inv.seat, 1),
  }],
}
