import { keyedFlashbackAbility } from '../../_shared.js'
export default {
  code: '07051', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) {
    api.mechanics.keys.transfer('blue', 'setAside', `location:${location.id}`, { reveal: true })
  } },
  abilities: [keyedFlashbackAbility({ key: 'purple', flashback: 'flashback4', label: '持有紫色钥匙且线索已清空：阅读记忆闪回IV' })],
}
