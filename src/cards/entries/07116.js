export default { code: '07116', abilities: [{ kind: 'reaction', trigger: 'tokenEffectWouldResolve', cost: { exhaust: true },
  label: '取消诅咒并将其归还标记池，揭示另一个标记',
  criteria: ({ inv, context }) => context.location === inv.location && context.token === 'curse',
  resolve: ({ context, api }) => { api.chaosTokens.treat({ index: context.tokenIndex, cancel: true, toPool: true }); api.noteCancelled('chaosToken') },
}] }
