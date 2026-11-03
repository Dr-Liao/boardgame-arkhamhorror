export default {
  code: '07023', additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
  abilities: [{ kind: 'played', label: '同地点调查员合计抽 3 张牌', resolve: ({ state, inv, api }) => {
    const targets = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location)
    const allocation = new Map()
    for (let i = 0; i < 3; i++) {
      const seat = targets.length === 1 ? targets[0].seat : Number(api.choice({ kind: 'investigator', seat: inv.seat, source: '07023',
        prompt: `分配第 ${i + 1} 张抽牌。`, options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
      allocation.set(seat, (allocation.get(seat) || 0) + 1)
    }
    for (const [seat, amount] of allocation) api.drawCards(seat, amount)
  } }],
}
