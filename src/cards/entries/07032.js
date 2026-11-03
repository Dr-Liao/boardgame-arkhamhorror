export default { code: '07032', abilities: [{ kind: 'commit', label: '投入后添加 1 诅咒，无法添加则受 2 恐惧', skill: {
  onCommit: ({ inv, api }) => { if (api.chaosTokens.add('curse', 1, { exact: true }) !== 1) api.horror(inv.seat, 2) },
} }] }
