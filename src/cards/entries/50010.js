export default {
  code: '50010',
  abilities: [{
    kind: 'reaction', trigger: 'skillTestFail', cost: { exhaust: true },
    label: '失败后横置：按失败差值检索牌库顶并抽取 1 张',
    criteria: ({ inv, state, context }) => state.skillTest?.seat === inv.seat
      && context.failedBy > 0 && inv.deck.length > 0,
    resolve: ({ inv, context, api }) => api.searchTop(inv.seat, {
      amount: context.failedBy, choose: 1, mandatory: true, source: '50010',
    }),
  }],
}
