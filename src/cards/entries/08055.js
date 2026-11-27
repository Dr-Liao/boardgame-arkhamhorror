// 08055 黑市：逐张揭示并暂置为团队均可打出的卡，到下个调查阶段洗回所有者牌库。
const code = '08055'
const eligible = inv => !inv.defeated && !inv.resigned && inv.deck.length > 0

export default {
  code,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'investigationPhaseStarts',
    label: '从任意调查员牌库顶逐张揭示 5 张，暂时供团队打出',
    criteria: ({ state }) => state.investigators.some(eligible),
    resolve: ({ state, inv, api }) => {
      for (let index = 0; index < 5; index++) {
        const owners = state.investigators.filter(eligible)
        if (!owners.length) break
        const seat = owners.length === 1 ? owners[0].seat : Number(api.choice({
          kind: 'investigator', source: code, seat: inv.seat,
          prompt: `选择揭示第 ${index + 1} 张牌的调查员牌库。`,
          options: owners.map(owner => ({ id: String(owner.seat), label: owner.name })),
        }))
        if (!owners.some(owner => owner.seat === seat)) return
        api.revealTopForSharedPlay(seat)
      }
    },
  }],
  modifiers: [],
}
