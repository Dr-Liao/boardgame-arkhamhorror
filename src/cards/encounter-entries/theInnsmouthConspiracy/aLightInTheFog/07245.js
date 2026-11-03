import { locationLookCandidates } from '../../_shared.js'
export default {
  code: '07245', scope: 'location',
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '沉没岩洞（中层）：共同花费线索，查看本行潮水通道',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    criteria: ({ state, source }) => locationLookCandidates(state, { rowOf: source.id, unrevealedNames: ['Tidal Tunnel'] }).length > 0,
    resolve: ({ inv, source, api }) => api.scenario.lookAtLocation(inv.seat, {
      rowOf: source.id, unrevealedNames: ['Tidal Tunnel'], source: '07245',
    }),
  }],
}
