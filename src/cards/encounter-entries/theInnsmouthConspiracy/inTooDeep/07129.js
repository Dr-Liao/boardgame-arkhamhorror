export default {
  code: '07129', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) { api.mechanics.keys.placeRandom(`location:${location.id}`) } },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '谈判：智力(3)，成功移除1个屏障', cost: { action: 2 },
    resolve: ({ inv, source, api }) => api.test(inv.seat, 'intellect', 3, {
      source: { type: 'scenario', action: 'parley', code: '07129', name: source.name, ability: true },
      target: { kind: 'location', id: source.id }, actionKind: 'parley',
      resolve: result => { if (result.success) api.barriers.removeConnected(inv.seat, source.id) },
    }),
  }],
}
