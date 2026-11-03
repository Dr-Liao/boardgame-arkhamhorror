export default { code: '07120', abilities: [{ kind: 'reaction', trigger: 'chaosRevealStepEnded', cost: { exhaust: true },
  label: '揭示过祝福与诅咒：自动成功', criteria: ({ inv, context }) => context.location === inv.location
    && context.tokens?.some(token => token.face === 'bless') && context.tokens?.some(token => token.face === 'curse'),
  resolve: ({ api }) => api.setTestAutoSuccess(),
}] }
