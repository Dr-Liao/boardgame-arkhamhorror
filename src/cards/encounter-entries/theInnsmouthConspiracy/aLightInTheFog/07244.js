import { locationLookCandidates } from '../../_shared.js'
import { keysAt } from '../../_shared.js'

export default {
  code: '07244', scope: 'location',
  locationRule: {
    entryError: (state, location, inv) => keysAt(state, `investigator:${inv.seat}`).includes('blue')
      ? null : '灯塔地下室被锁住：你必须控制蓝色钥匙才能进入。',
  },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '沉没岩洞（浅层）：共同花费线索，查看本行潮水通道',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    criteria: ({ state, source }) => locationLookCandidates(state, { rowOf: source.id, unrevealedNames: ['Tidal Tunnel'] }).length > 0,
    resolve: ({ inv, source, api }) => api.scenario.lookAtLocation(inv.seat, {
      rowOf: source.id, unrevealedNames: ['Tidal Tunnel'], source: '07244',
    }),
  }],
}
