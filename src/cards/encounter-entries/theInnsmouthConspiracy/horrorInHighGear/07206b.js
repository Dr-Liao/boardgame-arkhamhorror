import { locationLookCandidates } from '../../_shared.js'

export default {
  code: '07206b',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.map.extendRoad(location.id, 2)
    },
  },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    label: '本地点团队花费每人1线索：查看任意前方地点的已揭示面',
    target: {
      kind: 'location',
      range: 'anywhere',
      query: ({ state, source, candidate }) => locationLookCandidates(state, {
        aheadOf: source.id, includeRevealed: true,
      }).some(location => location.id === candidate.id),
    },
    resolve: ({ inv, target, api }) => api.scenario.peekLocation(inv.seat, target.id),
  }],
}
