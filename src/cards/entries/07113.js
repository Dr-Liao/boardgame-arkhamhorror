export default {
  code: '07113',
  abilities: [{ kind: 'reaction', trigger: 'chaosTokenRevealed', label: '诅咒修正改为 +1，结束后放回袋内', cost: { exhaust: true },
    criteria: ({ inv, state, context }) => context.token === 'curse'
      && state.investigators[context.seat]?.location === inv.location,
    resolve: ({ api, context }) => api.chaosTokens.treat({ index: context.tokenIndex, modifier: 1, retain: true }) }],
}
