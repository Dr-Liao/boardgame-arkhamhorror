// 10072 「我肯定还！」：借同地点的资源，在轮末把此时拥有的资源交给对方。
const CODE = '10072'
const othersHere = (state, inv) => state.investigators.filter(other =>
  other.seat !== inv.seat && other.location === inv.location && !other.defeated && !other.resigned)

export default {
  code: CODE,
  playCondition: [
    {
      when: ({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat,
      message: '只能在你的回合打出「我肯定还！」',
    },
    {
      when: ({ state, inv }) => othersHere(state, inv).length > 0,
      message: '你所在地点没有另一位调查员',
    },
  ],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '把同地点另一位调查员的所有资源移给你，轮末把你的所有资源移给该调查员',
    resolve: ({ state, inv, api }) => {
      const others = othersHere(state, inv)
      const seat = others.length === 1 ? others[0].seat : Number(api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat,
        prompt: '「我肯定还！」：选择要借用资源的调查员。',
        options: others.map(other => ({ id: String(other.seat), label: other.name })),
      }))
      const lender = others.find(other => other.seat === seat)
      if (!lender) return
      api.transferResources(lender.seat, inv.seat, lender.resources)
      api.addEffect({
        duration: 'endOfRound',
        sourceCode: CODE,
        controllerSeat: inv.seat,
        label: '「我肯定还！」轮末归还资源',
        abilities: [{
          kind: 'forced',
          trigger: 'roundEnds',
          label: '把你现在拥有的所有资源移给借出资源的调查员',
          effect: { type: 'transferResources', toSeat: lender.seat, all: true },
        }],
      })
    },
  }],
}
