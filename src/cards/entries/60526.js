export default {
  code: '60526',
  abilities: [{
    kind: 'commit',
    label: '检定失败时将本卡返回手牌',
    skill: {
      maxPerTest: 1,
      destination: ({ result }) => result?.success === false && !result.failureEffectsCancelled ? 'hand' : null,
    },
  }],
}
