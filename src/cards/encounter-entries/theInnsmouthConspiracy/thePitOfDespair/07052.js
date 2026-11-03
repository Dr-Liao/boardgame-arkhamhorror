// 封印出口：绿色钥匙由本地点任一调查员持有即可；撤退者留下所有钥匙，弃掉所有线索。
export default {
  code: '07052', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api) { api.mechanics.water.set(location.id, 2) },
  },
  abilities: [{
    kind: 'action', actionKind: 'resign', label: '封印出口：撤退', cost: { action: 1 },
    criteria: [({ state, source }) => state.investigators.some(inv => inv.location === source.id
      && !inv.defeated && !inv.resigned
      && state.scenarioFlags?.mechanics?.keys?.green?.holder === `investigator:${inv.seat}`)],
    resolve: ({ inv, source, api }) => {
      api.scenario.loseClues(inv.seat, inv.clues || 0)
      for (const color of api.keys.at(`investigator:${inv.seat}`, { reveal: true })) {
        api.keys.transfer(color, `investigator:${inv.seat}`, `location:${source.id}`)
      }
      api.resign(inv.seat)
    },
  }],
}
