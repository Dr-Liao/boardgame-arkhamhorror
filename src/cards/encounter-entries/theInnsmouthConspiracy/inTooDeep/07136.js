import { barrierEdges } from '../../_shared.js'
export default {
  code: '07136', scope: 'location', implemented: true,
  modifiers: [{ target: 'locationShroud', amount: ({ state, entity }) => barrierEdges(state, entity.id)
    .filter(edge => entity.connections?.includes(edge.a === entity.id ? edge.b : edge.a))
    .reduce((total, edge) => total + edge.count, 0) }],
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '加入2个诅咒并谈判：移除1个屏障', cost: { action: 1 },
    additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
    criteria: [({ state, source }) => barrierEdges(state, source.id).some(edge => edge.count > 0)],
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }],
}
