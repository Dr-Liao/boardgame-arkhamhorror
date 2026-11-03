import { evadeTraitAndDrainLocation } from '../../_shared.js'

// The printed enemy-phase as-if-engaged attack rule remains dependent on main's
// actual enemy-phase attack eligibility contract; do not count this as complete.
export default {
  code: '07327', scope: 'location',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置黄色钥匙并共同花费每人1个线索：躲避古神并永久排水',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    additionalKeyCost: { colors: ['yellow'], destination: 'source' },
    limit: { scope: 'perGame', owner: 'group' },
    resolve: evadeTraitAndDrainLocation,
  }],
}
