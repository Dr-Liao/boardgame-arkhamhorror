import { localKeyFlashbackAbility } from '../../_shared.js'

export default {
  code: '07177b',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('black', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [localKeyFlashbackAbility({
    keys: ["blue","yellow"], cluesPerInvestigator: 3, flashback: 'flashback11',
    label: '本地点控制蓝色与黄色钥匙，团队花费每人3线索：取得黑色钥匙并阅读记忆闪回',
  })],
}
