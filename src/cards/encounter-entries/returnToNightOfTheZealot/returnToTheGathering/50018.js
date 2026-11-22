// 50018 阁楼（Attic）· 地点 · return_to_the_gathering
// 卡面：强制 - 阁楼揭示后：将放在一边的远在房屋之上（50019）放置入场。
// 读点：locations.js#revealLocation → locationRule.onReveal。

export default {
  code: '50018',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, loc, api) {
      void state
      void loc
      api.place('farAboveYourHouse')
      api.info('「阁楼」揭示：放在一边的「远在房屋之上」放置入场。')
    },
  },
}
