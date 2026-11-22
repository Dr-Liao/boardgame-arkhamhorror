// 51064 复苏之邪（Resurgent Evils）
// 归属：跨关卡共享（重返敦威治遗产 → resurgent_evils）
// 卡面：险境。显现 - 你必须决定（选择一项）：抽取遭遇牌库顶 2 张卡牌；
//       或在当前密谋上放置 1 个毁灭标记（可导致密谋推进）。
export default {
  code: '51064', scope: 'treachery', implemented: true,
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const answer = api.choose({
      kind: 'treachery', source: '51064', seat: inv.seat, prompt: '复苏之邪：选择一项。',
      options: [
        { id: 'draw', label: '抽取遭遇牌库顶 2 张卡牌' },
        { id: 'doom', label: '在当前密谋上放置 1 个毁灭标记' },
      ],
    })
    if (answer === 'doom') {
      const agenda = state.agendas?.[state.agendaIndex]
      if (agenda) api.placeDoomOnCard?.(agenda, 1)
    } else {
      api.drawEncounter(inv.seat)
      api.drawEncounter(inv.seat)
    }
    return true
  },
}
