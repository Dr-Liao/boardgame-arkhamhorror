export default {
  code: '60424',
  abilities: [{
    kind: 'commit',
    label: '检定成功时抽 1 张牌，成功至少 2 点时改抽 2 张',
    skill: {
      maxPerTest: 1,
      onSuccessResolve: ({ result, api, inv }) => api.drawCards(inv.seat, result.successBy >= 2 ? 2 : 1),
    },
  }],
}
