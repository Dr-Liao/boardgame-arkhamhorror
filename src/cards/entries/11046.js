const CODE = '11046'
const revealedFaces = state => [...new Set((state.chaos?.revealed || []).slice(state.chaos?.frames?.at(-1) ?? 0))]
const sealed = (state, source) => (state.chaos?.sealed || []).filter(item => item.source === source.id)

export default {
  code: CODE,
  researchRequirement: 'youHaveCalculatedTheDayOfReckoning',
  researchUpgradeFrom: '11035',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestFail', label: '此处的检定失败时横置：封印本次检定揭示的 1 枚标记',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => state.skillTest && state.investigators[state.skillTest.seat]?.location === inv.location
        && revealedFaces(state).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const totals = revealedFaces(state)
        const token = totals.length === 1 ? totals[0] : api.choice({
          kind: 'token', source: CODE, seat: inv.seat, prompt: '选择要封印的标记。',
          options: totals.map(id => ({ id, label: api.tokenLabel(id) })),
        })
        api.sealTestToken(inv.seat, token, source.id)
      },
    },
    {
      kind: 'forced', trigger: 'roundEnds', label: '为每枚封印标记花费 1 充能或释放它',
      criteria: [({ state, source }) => sealed(state, source).length > 0],
      resolve: ({ state, inv, source, api }) => {
        for (const { token } of sealed(state, source)) {
          const answer = source.uses > 0 && api.choice({
            kind: 'token', source: CODE, seat: inv.seat, prompt: `为封印标记「${api.tokenLabel(token)}」花费 1 充能或释放它。`,
            options: [{ id: 'pay', token, label: '花费 1 充能' }, { id: 'release', token, label: '释放标记' }],
          })
          if (answer !== 'pay' || !api.spendUses(source, 1)) api.chaosTokens.release(source.id, token, 1)
        }
      },
    },
  ],
}
