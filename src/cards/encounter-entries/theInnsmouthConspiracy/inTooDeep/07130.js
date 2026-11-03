import { keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07130', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '谈判：意志(调查员人数)，成功移除1个屏障', cost: { action: 1 },
    resolve: ({ state, inv, source, api }) => api.test(inv.seat, 'willpower', state.numInvestigators, {
      source: { type: 'scenario', action: 'parley', code: '07130', name: source.name, ability: true },
      target: { kind: 'location', id: source.id }, actionKind: 'parley',
      resolve: result => { if (result.success) api.barriers.removeConnected(inv.seat, source.id) },
    }),
  }, {
    ...keyedFlashbackAbility({ keyCount: 7, requiresNoClues: false, flashback: 'flashback7', label: '全队持有7把钥匙：谈判并阅读记忆闪回VII' }),
    actionKind: 'parley',
  }],
}
