import { keysAt } from '../../_shared.js'

export default {
  code: '07323', scope: 'location', implemented: true,
  // 背面：伊哈·恩斯雷地点以部分淹没入场（即使未揭示）。读点 locations.js#placeLocation。
  locationRule: { entersPlayFlooded: 1 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '海底走廊：将白色钥匙放在此处',
    criteria: ({ state, inv }) => keysAt(state, `investigator:${inv.seat}`).includes('white'),
    resolve: ({ inv, source, api }) => api.keys.transfer('white', `investigator:${inv.seat}`, `location:${source.id}`, { reveal: true }),
  }, {
    kind: 'free', actionKind: 'move', label: '海底走廊：移动到一个相连地点',
    limit: { scope: 'perRound', owner: 'investigatorInstance' },
    criteria: ({ state, source }) => keysAt(state, `location:${source.id}`).includes('white'),
    effect: { type: 'moveTo' },
  }],
}
