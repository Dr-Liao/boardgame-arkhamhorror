export default {
  code: '07001', kind: 'investigator',
  investigator: { setupChaosTokens: { bless: 2 }, roundEndReaction: true, elderSign: { bonus: 1 } },
  elderSign: { label: '旧印：+1，成功后加入祝福', resolve: ({ api }) => {
    api.investigatorTools.onSuccessTokens('bless', 1)
    return { delta: 1 }
  } },
  abilities: [{ kind: 'reaction', trigger: 'roundEnds', label: '轮末加入 1 个祝福',
    criteria: ({ helpers }) => helpers.poolTokenRoom('bless') > 0,
    limit: 'oncePerRound', resolve: ({ api }) => api.chaosTokens.add('bless', 1) }],
}
