const OFFSETS = {
  '0,3': [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  '4,2': [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }],
  '4,-2': [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  '-4,2': [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }],
  '-4,-2': [{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
}

export default {
  code: '07171',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      const position = api.mechanics.map.position(location.id)
      const offsets = OFFSETS[`${position?.x},${position?.y}`]
      if (!offsets) throw new Error('浪蚀岛必须位于魔鬼礁石地图的一个岛屿锚点')
      api.mechanics.water.change(location.id, 1)
      api.mechanics.map.expand(location.id, offsets.slice(0, 2), 'tidalTunnels')
      api.mechanics.map.expand(location.id, offsets.slice(2), 'unfathomableDepths')
    },
  },
}
