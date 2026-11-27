import { barrierEdges, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07136', scope: 'location', implemented: true,
  modifiers: [{ target: 'locationShroud', amount: ({ state, entity }) => barrierEdges(state, entity.id)
    .filter(edge => entity.connections?.includes(edge.a === entity.id ? edge.b : edge.a))
    .reduce((total, edge) => total + edge.count, 0) }],
  abilities: [removeBarrierParley({
    label: '加入2个诅咒并谈判：移除1个屏障',
    cost: { action: 1 },
    additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
  })],
}
