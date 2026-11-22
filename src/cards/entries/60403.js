const code = '60403'

export default {
  code,
  threatEffect: {
    prohibitedChaosTokenChanges: ['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail'],
  },
  abilities: [{
    kind: 'weakness',
    label: '显现：放入你的威胁区域',
    weakness: { type: 'threat' },
  }, {
    kind: 'forced',
    trigger: 'turnEnded',
    label: '你的回合结束时：揭示 5 枚混乱标记。若揭示旧印，则弃掉本卡',
    criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ api, inv, source }) => {
      const tokens = api.revealChaosTokens(5, { seat: inv.seat, source: code })
      if (tokens.includes('eldersign')) api.removeThreat(source)
    },
  }],
}
