import { evadeTraitAndDrainLocation } from '../../_shared.js'

export default {
  code: '07326', scope: 'location',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置红色钥匙并共同花费每人1个线索：躲避古神并永久排水',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    additionalKeyCost: { colors: ['red'], destination: 'source' },
    limit: { scope: 'perGame', owner: 'group' },
    resolve: evadeTraitAndDrainLocation,
  }, {
    kind: 'forced', trigger: 'floodChanged', label: '任意地点淹没等级提升：本地点每位调查员受到1点恐惧',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, source, context }) => context.delta > 0
      && state.investigators.some(inv => inv.location === source.id && !inv.defeated && !inv.resigned),
    resolve: ({ state, source, api }) => {
      for (const inv of state.investigators.filter(inv => inv.location === source.id && !inv.defeated && !inv.resigned)) api.horror(inv.seat, 1)
    },
  }],
}
