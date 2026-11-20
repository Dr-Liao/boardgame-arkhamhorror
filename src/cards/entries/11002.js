export default {
  code: '11002',
  abilities: [{
    kind: 'commit', label: '自己的事件检定成功后可收回',
    skill: {
      destination: ({ inv, result, test, api }) => {
        if (!result?.success || test.seat !== inv.seat || !test.source?.code
          || api.cardType(test.source.code) !== 'event') return undefined
        const choice = api.choice({
          kind: 'card', source: '11002', seat: inv.seat, prompt: '是否收回已投入的技能牌？',
          options: [{ id: 'skip', label: '弃掉' }, { id: 'return', label: '返回手牌' }],
        })
        return choice === 'return' ? 'hand' : undefined
      },
    },
  }],
}
