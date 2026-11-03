export default { code: '07036', abilities: [
  { kind: 'commit', label: '祝福可以替换为自动成功', skill: {} },
  { kind: 'reaction', trigger: 'tokenEffectWouldResolve', label: '移除受宠者：该祝福改为自动成功并在检定后归袋',
    criteria: ({ state, source, context }) => context.token === 'bless' && state.skillTest?.committed.includes(source),
    resolve: ({ source, context, api }) => {
      if (!api.playerTools.removeCommitment(source)) return
      api.chaosTokens.treat({ index: context.tokenIndex, modifier: 0, autoSuccess: true, stop: true, retain: true })
    } },
] }
