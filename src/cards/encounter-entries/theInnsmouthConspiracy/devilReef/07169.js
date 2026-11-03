const OFFSETS = {
  '0,3': [{ x: -1, y: 0 }, { x: 1, y: 0 }],
  '4,2': [{ x: 1, y: 0 }, { x: 0, y: -1 }],
  '4,-2': [{ x: 1, y: 0 }, { x: 0, y: 1 }],
  '-4,2': [{ x: -1, y: 0 }, { x: 0, y: -1 }],
  '-4,-2': [{ x: -1, y: 0 }, { x: 0, y: 1 }],
}

export default {
  code: '07169',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      const position = api.mechanics.map.position(location.id)
      const offsets = OFFSETS[`${position?.x},${position?.y}`]
      if (!offsets) throw new Error('孤岛必须位于魔鬼礁石地图的一个岛屿锚点')
      api.mechanics.map.expand(location.id, offsets, 'tidalTunnels')
    },
  },
}
