// Token of Faith — counts revealed tokens from any investigator's completed test.
const count = context => [...(context.result?.drawn || []), ...(context.result?.cancelledTokens || [])]
  .filter(token => token === 'curse' || token === 'autofail').length
export default { code: '07033', abilities: [{
  kind: 'reaction', trigger: 'testEnds', label: '横置信仰信物：加入等量祝福', cost: { exhaust: true },
  criteria: ({ context, helpers }) => count(context) > 0 && helpers.poolTokenRoom('bless') > 0,
  resolve: ({ context, api }) => api.chaosTokens.add('bless', count(context)),
}] }
