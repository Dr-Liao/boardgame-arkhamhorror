import { keysAt, barrierEdges } from '../../_shared.js'
export default {
  code: '07141', scope: 'location', implemented: true,
  abilities: [
    {
      kind: 'free', actionKind: 'move', label: '持有钥匙时：移动到连接地点',
      criteria: ({ state, inv, source, helpers }) => keysAt(state, `investigator:${inv.seat}`).length > 0
        && source.connections?.some(id => helpers.canMoveTo(inv.seat, id)),
      resolve: ({ state, inv, source, api }) => {
        const locations = state.locations.filter(location => source.connections?.includes(location.id) && api.canMoveTo(inv.seat, location.id))
        if (!locations.length) return
        const id = locations.length === 1 ? locations[0].id : api.choice({ kind: 'location', source: '07141', seat: inv.seat,
          prompt: '选择一个连接地点。', options: locations.map(location => ({ id: location.id, label: location.name })) })
        if (locations.some(location => location.id === id)) api.moveInvestigator(inv.seat, id)
      },
    },
    {
      kind: 'action', actionKind: 'parley', label: '谈判：弃置1张受控资产，移除1个屏障',
      cost: { action: 1, discardControlledAsset: 1 },
      criteria: ({ state, source }) => barrierEdges(state, source.id).length > 0,
      resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
    },
  ],
}
