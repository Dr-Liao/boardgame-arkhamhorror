import { localKeyFlashbackAbility } from '../../_shared.js'

export default {
  code: '07177a',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('black', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
  abilities: [localKeyFlashbackAbility({
    keys: ["red","green"], cluesPerInvestigator: 2, flashback: 'flashback11',
    label: '本地点控制红色与绿色钥匙，团队花费每人2线索：取得黑色钥匙并阅读记忆闪回',
  })],
}
