const code = '11101'

export default {
  code,
  abilities: [
    {
      kind: 'commit', label: '成功：检定者可使成功差值增加或减少至多 2 点（最低为 0）',
      skill: {
        modifySuccessfulMargin: ({ result, test, api }) => {
          const margin = Math.max(0, result.successBy ?? (result.value - result.difficulty))
          const options = [
            ...[-2, -1].filter(delta => margin + delta >= 0).map(delta => ({ id: String(delta), label: `减少 ${-delta} 点` })),
            { id: '0', label: '保持不变' },
            { id: '1', label: '增加 1 点' },
            { id: '2', label: '增加 2 点' },
          ]
          const id = api.choice({
            kind: 'amount', source: code, seat: test.seat,
            prompt: '选择如何调整本次检定的成功差值。', options,
          })
          return margin + (options.some(item => item.id === id) ? Number(id) : 0)
        },
      },
    },
  ],
}
