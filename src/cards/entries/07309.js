export default { code: '07309', assetRule: { skipUpkeepReady: true }, abilities: [
  { kind: 'reaction', trigger: 'testWouldFail', label: '横置雅各布·莫里森：本次检定值+2',
    cost: { exhaust: true }, criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ context, api }) => api.setReactionFlag('testBonus', (context.testBonus || 0) + 2, context) },
  { kind: 'reaction', trigger: 'chaosTokenRevealed', label: '揭示祝福后重整雅各布·莫里森',
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.token === 'bless' && source.exhausted,
    resolve: ({ source, api }) => api.ready(source) },
] }
