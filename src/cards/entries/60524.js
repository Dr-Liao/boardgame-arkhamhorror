const CODE = '60524'

function reachableClues(state, locationId) {
  const location = state.locations.find(item => item.id === locationId)
  const reachable = new Set([locationId, ...(location?.connections || [])])
  return state.locations.filter(item => reachable.has(item.id) && item.clues > 0)
}

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'investigateFail',
    label: '调查失败至多 3 点后：在本地点与连接地点中发现共 2 个线索',
    criteria: ({ state, inv, context }) => context.seat === inv.seat && context.failedBy <= 3
      && reachableClues(state, inv.location).length > 0,
    resolve: ({ state, inv, api }) => {
      for (let remaining = 2; remaining > 0; remaining--) {
        const locations = reachableClues(state, inv.location)
        if (!locations.length) break
        const locationId = locations.length === 1 ? locations[0].id : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '选择一个地点发现 1 个线索。',
          options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })),
        })
        api.discoverClue(inv.seat, 1, locationId)
      }
    },
  }],
}
