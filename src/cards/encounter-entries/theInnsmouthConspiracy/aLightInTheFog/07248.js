import { keyedFlashbackAbility } from '../../_shared.js'

export default {
  code: '07248', scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.water.change(location.id, 1)
    },
  },
  abilities: [keyedFlashbackAbility({ key: 'purple', requiresNoClues: false, flashback: 'flashback13', label: '深潜者育婴室：紫色钥匙，记忆闪回XIII' })],
}
