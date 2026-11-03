import { keysHeldAtLocation, keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07048', scope: 'location', implemented: true,
  modifiers: [{ target: 'locationShroud', amount: ({ state, entity }) => -keysHeldAtLocation(state, entity.id).length }],
  abilities: [keyedFlashbackAbility({ key: 'yellow', flashback: 'flashback2', label: '持有黄色钥匙且线索已清空：阅读记忆闪回II' })],
}
