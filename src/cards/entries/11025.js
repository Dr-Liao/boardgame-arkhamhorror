export default {
  code: '11025', trackRoundActionHistory: true,
  abilities: [
    {
      kind: 'commit', label: '每次本轮成功攻击提供 1 个战斗图标和 1 个万能图标',
      skill: {
        maxPerTest: 1,
        iconBonus: ({ state, inv, owner = inv, skill }) => {
          const history = owner?.roundActionHistory
          if (history?.round !== state.round) return 0
          const attacks = history.successes.filter(kind => kind === 'fight').length
          return attacks * ([].concat(skill).includes('combat') ? 2 : 1)
        },
      },
    },
  ],
}
