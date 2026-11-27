import { keyedFlashbackAbility, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07135', scope: 'location', implemented: true,
  abilities: [removeBarrierParley({
    label: '抽1张遭遇卡并谈判：移除1个屏障',
    cost: { action: 2, drawEncounter: 1 },
  }), {
    ...keyedFlashbackAbility({ keyCount: 5, requiresNoClues: false, flashback: 'flashback6', label: '全队持有至少5把钥匙：谈判并阅读记忆闪回VI' }),
    actionKind: 'parley',
  }],
}
