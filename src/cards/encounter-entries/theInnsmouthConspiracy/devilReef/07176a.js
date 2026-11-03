import { localKeyFlashbackAbility } from '../../_shared.js'

export default {
  code: '07176a',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.water.set(location.id, 2)
      api.mechanics.keys.transfer('white', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [localKeyFlashbackAbility({
    keys: ["red","yellow"], cluesPerInvestigator: 2, flashback: 'flashback10',
    label: '本地点控制红色与黄色钥匙，团队花费每人2线索：取得白色钥匙并阅读记忆闪回',
  })],
}
