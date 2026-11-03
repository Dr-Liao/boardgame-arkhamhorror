import { keysAt } from '../../_shared.js'
import { locationLookCandidates } from '../../_shared.js'

const OFFSETS = {
  '0,3': [{ x: -1, y: 0 }],
  '4,2': [{ x: 1, y: 0 }],
  '4,-2': [{ x: 1, y: 0 }],
  '-4,2': [{ x: -1, y: 0 }],
  '-4,-2': [{ x: -1, y: 0 }],
}

export default {
  code: '07172',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      const position = api.mechanics.map.position(location.id)
      const offsets = OFFSETS[`${position?.x},${position?.y}`]
      if (!offsets) throw new Error('盐沼必须位于魔鬼礁石地图的一个岛屿锚点')
      api.mechanics.water.change(location.id, 1)
      api.mechanics.map.expand(location.id, offsets, 'tidalTunnels')
    },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    limit: { scope: 'perGame', owner: 'group' },
    label: '控制紫色钥匙：查看任意潮水通道或无常深渊的已揭示面',
    criteria: ({ state, inv }) => keysAt(state, `investigator:${inv.seat}`).includes('purple'),
    target: {
      kind: 'location',
      range: 'anywhere',
      query: ({ state, candidate }) => locationLookCandidates(state, {
        unrevealedNames: ['Tidal Tunnel', 'Unfathomable Depths'],
      }).some(location => location.id === candidate.id),
    },
    resolve: ({ inv, target, api }) => api.scenario.peekLocation(inv.seat, target.id),
  }],
}
