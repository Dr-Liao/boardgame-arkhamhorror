import { keyedFlashbackAbility, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07133', scope: 'location', implemented: true,
  abilities: [removeBarrierParley({
    label: '花费3资源并谈判：移除1个屏障',
    cost: { action: 1, resources: 3 },
  }), {
    ...keyedFlashbackAbility({ key: 'black', requiresNoClues: false, flashback: 'flashback8', label: '持有黑色钥匙：阅读记忆闪回VIII' }),
    actionKind: 'parley',
  }],
}
