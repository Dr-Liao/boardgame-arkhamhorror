import { barrierEdges } from '../../_shared.js'
export default {
  code: '07134', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) { api.mechanics.keys.placeRandom(`location:${location.id}`) } },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '无剩余线索时谈判：移除1个屏障', cost: { action: 1 },
    criteria: [({ state, source }) => source.clues === 0 && barrierEdges(state, source.id).some(edge => edge.count > 0)],
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }],
}
