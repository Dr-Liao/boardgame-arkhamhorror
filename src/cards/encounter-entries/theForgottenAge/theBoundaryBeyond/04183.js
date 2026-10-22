// 04183 霍奇米尔科湖
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在霍奇米尔科湖入场后：每位在本地点的调查员受到1点直接恐惧。
// 卡面：你调查霍奇米尔科湖时，如果你的神智值少于或等于3，该地点隐藏值-2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04183', scope: 'location',
  locationRule: {
    shroudModifier(state, location, inv) {
      return inv && (inv.maxSanity ?? 0) - (inv.horror || 0) <= 3 ? -2 : 0
    },
  },
}
