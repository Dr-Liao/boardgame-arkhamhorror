import { localKeyFlashbackAbility } from '../../_shared.js'

export default {
  code: '07175a',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.water.change(location.id, 1)
      api.mechanics.keys.transfer('purple', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [localKeyFlashbackAbility({
    keys: ["red","blue"], cluesPerInvestigator: 2, flashback: 'flashback9',
    label: '本地点控制红色与蓝色钥匙，团队花费每人2线索：取得紫色钥匙并阅读记忆闪回',
  })],
}
