import { evadeTraitAndDrainLocation, hasTrait } from '../../_shared.js'

export default {
  code: '07325', scope: 'location',
  modifiers: [{ target: 'enemyFight', amount: 2,
    condition: { when: ({ source, entity }) => source.revealed && entity.location === source.id && hasTrait(entity, 'Deep One') },
  }],
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置绿色钥匙并共同花费每人1个线索：躲避古神并永久排水',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    additionalKeyCost: { colors: ['green'], destination: 'source' },
    limit: { scope: 'perGame', owner: 'group' },
    resolve: evadeTraitAndDrainLocation,
  }],
}
