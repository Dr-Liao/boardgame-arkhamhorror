import { barrierEdges, keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07133', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '花费3资源并谈判：移除1个屏障', cost: { action: 1, resources: 3 },
    criteria: [({ state, source }) => barrierEdges(state, source.id).some(edge => edge.count > 0)],
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }, {
    ...keyedFlashbackAbility({ key: 'black', requiresNoClues: false, flashback: 'flashback8', label: '持有黑色钥匙：阅读记忆闪回VIII' }),
    actionKind: 'parley',
  }],
}
