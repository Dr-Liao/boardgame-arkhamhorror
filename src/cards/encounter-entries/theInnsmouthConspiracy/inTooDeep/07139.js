import { barrierEdges, canPlaceBarrier, keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07139', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) {
    if (api.takeFromSetAside('07144')) api.spawn('07144', location.id, { exhausted: true })
  } },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '谈判：将一个屏障移至另一条连接通道', cost: { action: 1 },
    criteria: ({ state, source }) => barrierEdges(state, source.id).some(edge =>
      source.connections?.some(id => ![edge.a, edge.b].includes(id) && canPlaceBarrier(state, source.id, id))),
    resolve: ({ inv, source, api }) => api.barriers.moveConnected(inv.seat, source.id),
  }, {
    ...keyedFlashbackAbility({ keyCount: 2, requiresNoClues: false, flashback: 'flashback5', label: '全队持有至少2把钥匙：谈判并阅读记忆闪回V' }),
    actionKind: 'parley',
  }],
}
