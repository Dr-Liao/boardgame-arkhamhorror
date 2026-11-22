// 50020 地窖（Cellar）· 地点 · return_to_the_gathering
// 卡面：强制 - 地窖揭示后：将放在一边的远在房屋之下（50021）放置入场。
// 读点：locations.js#revealLocation → locationRule.onReveal。

export default {
  code: '50020',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, loc, api) {
      void state
      void loc
      api.place('deepBelowYourHouse')
      api.info('「地窖」揭示：放在一边的「远在房屋之下」放置入场。')
    },
  },
}
