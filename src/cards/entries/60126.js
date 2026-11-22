export default {
  code: '60126',
  abilities: [{
    kind: 'commit', label: '检定成功后抽牌，超过难度至少 2 时改为抽 2 张',
    skill: {
      maxPerTest: 1,
      afterTest: ({ inv, result, api }) => {
        if (result?.success) api.drawCards(inv.seat, result.value - result.difficulty >= 2 ? 2 : 1)
      },
    },
  }],
}
