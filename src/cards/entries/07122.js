// Ancient Covenant — one physical bless stops its own additional reveal only.
export default { code: '07122', abilities: [{ kind: 'reaction', trigger: 'chaosTokenResolved',
  label: '横置古老圣约：该祝福不再追加揭示', cost: { exhaust: true },
  criteria: ({ inv, context, state }) => context.token === 'bless'
    && state.investigators[context.seat]?.location === inv.location,
  resolve: ({ context, api }) => api.chaosTokens.treat({ index: context.tokenIndex, stop: true }),
}] }
