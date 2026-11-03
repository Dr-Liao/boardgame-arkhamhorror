import { barrierEdges } from '../../_shared.js'
export default {
  code: '07132', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) { api.mechanics.keys.placeRandom(`location:${location.id}`) } },
  abilities: [{
    kind: 'free', actionKind: 'parley', label: '弃掉1张手牌并谈判：移除1个屏障', cost: { discardHand: 1 },
    criteria: [({ state, source }) => barrierEdges(state, source.id).some(edge => edge.count > 0)],
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }],
}
