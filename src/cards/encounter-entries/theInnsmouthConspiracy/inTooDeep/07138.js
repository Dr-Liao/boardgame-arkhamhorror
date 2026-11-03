import { barrierEdges } from '../../_shared.js'
const destination = state => state.locations.find(location => (location.originalCode || location.code) === '07132')
export default {
  code: '07138', scope: 'location', implemented: true,
  abilities: [{
    kind: 'reaction', trigger: 'move', label: '印斯茅斯港口：移动到水街老屋',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ state, inv, source, context, helpers }) => context.seat === inv.seat && context.location === source.id
      && !!destination(state) && helpers.canMoveTo(inv.seat, destination(state).id)],
    resolve: ({ state, inv, api }) => { const target = destination(state); if (target) api.moveInvestigator(inv.seat, target.id) },
  }, {
    kind: 'action', actionKind: 'parley', label: '谈判：移除1个屏障', cost: { action: 2 },
    criteria: [({ state, source }) => barrierEdges(state, source.id).some(edge => edge.count > 0)],
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }],
}
