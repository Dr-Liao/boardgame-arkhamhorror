const code = '11107'

export default {
  code,
  abilities: [{
    kind: 'commit',
    label: '每次检定最多投入一张；投入后可花费最多 3 资源，每个资源使本卡获得 2 百搭',
    skill: {
      maxPerTest: 1,
      onCommit: ({ inv, api }) => {
        const maximum = Math.min(3, api.availableResources(inv))
        if (!maximum) return
        const amount = Number(api.choice({
          kind: 'amount', source: code, seat: inv.seat, prompt: '选择要花费的资源数量。',
          options: Array.from({ length: maximum + 1 }, (_, value) => ({ id: String(value), label: `${value} 资源` })),
        }))
        if (amount && api.spendResources(inv.seat, amount)) api.addCommittedCardIcons(inv.seat, amount * 2)
      },
    },
  }],
}
