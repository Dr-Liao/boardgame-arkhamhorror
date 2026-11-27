// 08574 黑色岩石
import { partnerShroud } from './_shared.js'
import { frostPoolRoom } from '../../_shared.js'

export default {
  code: '08574', scope: 'location', implemented: true,
  flags: { mirageId: 'theBlackStone', tier: 2 },
  locationRule: { shroudModifier: partnerShroud('08591', '08718') },
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '加 1 个寒霜：发现本地点 2 线索',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, source }) => source.clues > 0 && frostPoolRoom(state) > 0,
    resolve: ({ inv, source, api }) => {
      if (api.mechanics.frost.add(1)) api.discoverClue(inv.seat, 2, source.id)
    },
  }],
}
