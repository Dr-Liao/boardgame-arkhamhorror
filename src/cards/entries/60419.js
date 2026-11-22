const CODE = '60419'
const options = [
  { id: 'even', label: '偶数' },
  { id: 'odd', label: '奇数' },
  { id: 'symbol', label: '符号' },
]

function tokenType(token) {
  if (!/^[+-]?\d+$/.test(token)) return 'symbol'
  return Number(token) % 2 === 0 ? 'even' : 'odd'
}

export default {
  code: CODE,
  abilities: [{
    kind: 'commit',
    label: '本次检定最多投入 1 张本卡',
    skill: { maxPerTest: 1 },
  }, {
    kind: 'forced',
    trigger: 'committedCard',
    limit: { scope: 'perTest', owner: 'player' },
    label: '投入后选择标记类型；若本次检定揭示该类型，可收回 1 张法术',
    criteria: ({ inv, context }) => context.seat === inv.seat && context.cardCode === CODE,
    resolve: ({ state, inv, api }) => {
      const wanted = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '指定偶数、奇数或符号。',
        options,
      })
      api.afterCurrentTest(result => {
        const physical = state.chaos?.revealed?.slice(state.chaos.frames.at(-1)) || []
        const tokens = [...physical, ...(result?.ignoredTokens || []), ...(result?.cancelledTokens || [])]
        if (!tokens.some(token => tokenType(token) === wanted)) return
        const candidates = [...new Set(inv.discard)].filter(code => api.cardTraits(code).some(trait => trait.toLowerCase() === 'spell'))
        if (!candidates.length) return
        const chosen = api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '可将弃牌堆中的一张法术卡返回手牌。',
          canSkip: true,
          options: [{ id: 'skip', label: '不返回卡牌' }, ...candidates.map(code => ({
            id: code, cardCode: code, label: api.cardName(code),
          }))],
        })
        if (chosen !== 'skip') api.moveCard({ code: chosen, from: 'discard', to: 'hand' }, { seat: inv.seat })
      })
    },
  }],
}
