import { keyedFlashbackAbility, removeBarrierParley } from '../../_shared.js'
export default {
  code: '07130', scope: 'location', implemented: true,
  abilities: [removeBarrierParley({
    label: '谈判：意志(调查员人数)，成功移除1个屏障',
    cost: { action: 1 },
    test: { skill: 'willpower', difficulty: ({ state }) => state.numInvestigators },
  }), {
    ...keyedFlashbackAbility({ keyCount: 7, requiresNoClues: false, flashback: 'flashback7', label: '全队持有7把钥匙：谈判并阅读记忆闪回VII' }),
    actionKind: 'parley',
  }],
}
