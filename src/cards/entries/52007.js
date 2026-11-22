const code = '52007'
const riskTokens = new Set(['skull', 'cultist', 'tablet', 'elderthing', 'autofail'])

export default {
  code,
  uses: 4,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    label: '检定意志，成功差值换取资源',
    cost: { action: true, exhaust: true, uses: 1 },
    resolve: ({ inv, api }) => api.startTest({
      seat: inv.seat, skill: 'willpower', difficulty: 0, source: { label: '支援能力', code },
      resolve: result => {
        if (result.success) api.gainResources(inv.seat, Math.min(4, result.value - result.difficulty))
        if (result.drawn?.some(token => riskTokens.has(token))) api.harm(inv.seat, { damage: 1 })
      },
    }),
  }],
}
