// 08704 窥看不可说之事 · 险境。先结算忒咳哩-哩弱点，再将该副本洗入一位调查员的牌库。
const CODE = '08704'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const resolved = api.resolveTekeliTop(inv.seat, {
      destination: 'anyDeck',
      targetSeat: () => {
        const remaining = state.investigators.filter(investigator => !investigator.defeated && !investigator.resigned)
        if (remaining.length <= 1) return remaining[0]?.seat ?? inv.seat
        return Number(api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择把这张忒咳哩-哩洗入哪位调查员的牌库。',
          options: remaining.map(other => ({ id: String(other.seat), label: other.name })),
        }))
      },
    })
    if (resolved) return true
    api.info('「窥看不可说之事」：忒咳哩-哩牌库为空，获得涌动。')
    return { gainSurge: true }
  },
}
