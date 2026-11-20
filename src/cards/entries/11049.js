export default {
  code: '11049',
  abilities: [{
    kind: 'reaction', trigger: 'skillTestSuccess',
    label: '横置：恰好成功 1/3 点发现线索，2/4 点抽牌并获得资源，5 点下个回合获得额外行动',
    cost: { exhaust: true },
    criteria: [({ state, inv, context, helpers }) => {
      if (state.skillTest?.seat !== inv.seat) return false
      const margin = context.successBy
      if (margin === 1 || margin === 3) return helpers.canDiscoverClueAt(inv.seat, inv.location)
      if (margin === 2 || margin === 4) return helpers.canDrawCards() || helpers.canGainResources()
      return margin === 5
    }],
    resolve: ({ inv, context, api }) => {
      const margin = context.successBy
      if (margin === 1 || margin === 3) api.discoverClue(inv.seat, 1, inv.location)
      if (margin === 2 || margin === 4) {
        api.drawCards(inv.seat, 1)
        api.gainResources(inv.seat, 1)
      }
      if (margin === 5) api.grantActionOnNextTurn(inv.seat, 1)
    },
  }],
}
