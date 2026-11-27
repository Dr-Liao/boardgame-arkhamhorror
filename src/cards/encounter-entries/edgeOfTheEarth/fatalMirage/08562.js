// 08562 沿海水域
export default {
  code: '08562', scope: 'location', implemented: true,
  flags: { mirageId: 'coastalWaters', tier: 2 },
  abilities: [{
    kind: 'forced', trigger: 'tokenReveal', label: '揭示寒霜：受到 1 恐惧；调查成功额外发现 1 线索',
    limit: { scope: 'perTest', owner: 'instance' },
    criteria: ({ state, inv, source, context }) => context.seat === inv.seat && context.token === 'frost'
      && state.skillTest?.actionKind === 'investigate' && state.skillTest?.target?.id === source.id,
    resolve: ({ inv, api }) => {
      api.horror(inv.seat, 1)
      api.addTestClueBonus(1)
    },
  }],
}
