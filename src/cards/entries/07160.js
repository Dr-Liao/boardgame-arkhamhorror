export default { code: '07160', abilities: [{ kind: 'played', fast: true, trigger: 'tokenEffectWouldResolve',
  label: '你或检定者可以投入或收回1张牌',
  criteria: ({ inv, state, context }) => state.investigators[context.seat]?.location === inv.location
    && typeof context.token === 'string' && !/^[+-]?\d+$/.test(context.token),
  resolve: ({ inv, context, api }) => api.playerTools.lateCommitOrReturn(inv.seat, context.seat),
}] }
