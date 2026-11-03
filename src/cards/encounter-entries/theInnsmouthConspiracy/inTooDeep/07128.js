import { barrierEdges } from '../../_shared.js'
export default {
  code: '07128', scope: 'act', implemented: true,
  actRule: {
    objective: state => state.investigators.some(inv => !inv.defeated)
      && state.investigators.every(inv => inv.defeated || inv.resigned),
    onReveal(state, act, api) {
      api.setCampaignRecord('TheInvestigatorsMadeItSafelyToTheirVehicles', true)
      api.finish('resolution1')
    },
  },
  abilities: [{
    kind: 'free', actionKind: 'activate', range: 'anywhere', groupClueScope: 'anywhere',
    label: '全队花费调查员人数+1线索：移除你所在地点的一道屏障',
    cost: { groupClues: ({ state }) => state.numInvestigators + 1 },
    criteria: ({ state, inv }) => barrierEdges(state, inv.location).some(edge => edge.count > 0),
    resolve: ({ inv, api }) => api.barriers.removeConnected(inv.seat, inv.location),
  }],
}
