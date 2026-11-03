import { barrierEdges, keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07135', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '抽1张遭遇卡并谈判：移除1个屏障', cost: { action: 2, drawEncounter: 1 },
    criteria: ({ state, source }) => barrierEdges(state, source.id).some(edge => edge.count > 0),
    resolve: ({ inv, source, api }) => api.barriers.removeConnected(inv.seat, source.id),
  }, {
    ...keyedFlashbackAbility({ keyCount: 5, requiresNoClues: false, flashback: 'flashback6', label: '全队持有至少5把钥匙：谈判并阅读记忆闪回VI' }),
    actionKind: 'parley',
  }],
}
