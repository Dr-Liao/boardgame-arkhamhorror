import { localKeyFlashbackAbility } from '../../_shared.js'

export default {
  code: '07176b',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.water.set(location.id, 2)
      api.mechanics.keys.transfer('white', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [localKeyFlashbackAbility({
    keys: ["blue","green"], cluesPerInvestigator: 3, flashback: 'flashback10',
    label: '本地点控制蓝色与绿色钥匙，团队花费每人3线索：取得白色钥匙并阅读记忆闪回',
  })],
}
