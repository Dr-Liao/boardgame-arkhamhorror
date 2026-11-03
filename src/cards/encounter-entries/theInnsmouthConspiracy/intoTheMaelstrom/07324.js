import { evadeTraitAndDrainLocation } from '../../_shared.js'

export default {
  code: '07324', scope: 'location', implemented: true,
  // 背面：伊哈·恩斯雷圣堂以完全淹没入场（即使未揭示）。读点 locations.js#placeLocation。
  locationRule: { entersPlayFlooded: 2 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '放置蓝色钥匙并共同花费每人1个线索：躲避古神并永久排水',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    additionalKeyCost: { colors: ['blue'], destination: 'source' },
    limit: { scope: 'perGame', owner: 'group' },
    resolve: evadeTraitAndDrainLocation,
  }, {
    kind: 'forced', trigger: 'investigateFail', label: '调查失败：受到1点伤害',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.location === source.id && context.seat === inv.seat,
    resolve: ({ inv, api }) => api.damage(inv.seat, 1),
  }],
}
