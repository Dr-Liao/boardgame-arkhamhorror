const CODE = '11076'

export default {
  code: CODE,
  playCondition: [({ inv, helpers }) => helpers.copyableInvestigatorFronts(inv.seat).length > 0],
  abilities: [{
    kind: 'played', label: '本局以内，替换为另一位可选调查员的正面',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ inv, api }) => {
      const choices = api.copyableInvestigatorFronts(inv.seat)
      if (!choices.length) return
      const code = choices.length === 1 ? choices[0] : api.choice({
        kind: 'card', source: CODE, seat: inv.seat,
        prompt: '选择要在本局使用的调查员正面。',
        options: choices.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
      })
      api.copyInvestigatorFront(inv.seat, code)
    },
  }],
}
