export default {
  code: '07190', abilities: [{ kind: 'reaction', trigger: 'chaosTokenRevealed', label: '第二个祝福视为旧印；两个祝福结束后放回袋内', cost: { exhaust: true },
    criteria: ({ state, inv, context }) => context.token === 'bless' && state.investigators[context.seat]?.location === inv.location
      && state.chaos.revealed.slice(state.chaos.frames.at(-1), context.tokenIndex + 1).filter(token => token === 'bless').length === 2,
    resolve: ({ state, api, context }) => {
      const start = state.chaos.frames.at(-1)
      const first = state.chaos.revealed.findIndex((token, i) => i >= start && i < context.tokenIndex && token === 'bless')
      if (first >= 0) api.chaosTokens.treat({ index: first, retain: true })
      api.chaosTokens.treat({ index: context.tokenIndex, as: 'eldersign', retain: true })
    } }],
}
