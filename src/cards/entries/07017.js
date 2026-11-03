// Book of Psalms — secrets pay before either independent effect resolves.
export default {
  code: '07017', uses: 4, usesType: 'secrets',
  abilities: [{ kind: 'action', label: '花费 1 秘密：治愈恐惧并加入祝福', cost: { action: true, uses: 1 },
    criteria: ({ state, inv, helpers }) => helpers.poolTokenRoom('bless') > 0 || state.investigators.some(other =>
      !other.defeated && !other.resigned && other.location === inv.location && other.horror > 0),
    resolve: ({ state, inv, api }) => {
      const targets = state.investigators.filter(other => !other.defeated && !other.resigned && other.location === inv.location && other.horror > 0)
      if (targets.length) {
        const seat = targets.length === 1 ? targets[0].seat : Number(api.choice({ kind: 'investigator', source: '07017', seat: inv.seat,
          prompt: '选择治愈 1 点恐惧的调查员。', options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
        api.healHorror(seat, 1)
      }
      api.chaosTokens.add('bless', 2)
    } }],
}
