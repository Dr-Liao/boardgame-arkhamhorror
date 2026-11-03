// 乔·萨金特：每次免费移动花一张车票；不能前往完全淹没的地点，离场移出游戏。
const choices = (state, inv) => {
  const here = state.locations.find(location => location.id === inv.location)
  return state.locations.filter(location => here?.connections?.includes(location.id)
    && (state.scenarioFlags?.mechanics?.flood?.[location.id] || 0) < 2)
}
export default {
  code: '07150', scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'ticket', removeFromGameOnLeave: true, discardOnElimination: true,
  abilities: [{
    kind: 'free', actionKind: 'move', label: '乔·萨金特：花费1张车票移动', cost: { uses: 1 },
    criteria: [({ state, inv, helpers }) => choices(state, inv)
      .some(location => helpers?.canMoveTo?.(inv.seat, location.id) !== false)],
    resolve: ({ state, inv, api }) => {
      const locations = choices(state, inv).filter(location => api.canMoveTo(inv.seat, location.id))
      if (!locations.length) return
      const destination = locations.length === 1 ? locations[0].id : api.choice({
        kind: 'target', seat: inv.seat, source: '07150', prompt: '选择一个未完全淹没的连接地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      if (locations.some(location => location.id === destination)) api.moveInvestigator(inv.seat, destination)
    },
  }],
}
