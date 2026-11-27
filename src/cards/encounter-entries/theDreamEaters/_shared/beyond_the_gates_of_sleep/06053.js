// 06053 魔幻森林·石制活板门（Enchanted Woods · Stone Trapdoor）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：当你调查本地点时，你手牌中每有 1 张卡牌，本地点帷幕 +1。
// 调查难度使用地点的手牌数修正。
export default {
  code: '06053',
  scope: 'location',
  implemented: true,
  locationRule: {
    shroudModifier: (state, location, inv) => inv?.hand.length || 0,
  },
}
