export default { code: '07031', abilities: [{ kind: 'played', fast: true, trigger: 'treachery',
  criteria: { sameLocation: true, nonWeaknessOnly: true }, label: '揭示 5 枚标记；有祝福或旧印时取消显现',
  resolve: ({ context, api }) => {
    const tokens = api.chaosTokens.inspect(5)
    api.info(`光辉结界揭示：${tokens.map(token => api.tokenLabel(token)).join('、')}。`)
    if (!context.cannotCancel && tokens.some(token => ['bless', 'eldersign'].includes(token))) {
      api.setReactionFlag('cancelled', true)
      api.noteCancelled('treachery')
    }
  },
}] }
