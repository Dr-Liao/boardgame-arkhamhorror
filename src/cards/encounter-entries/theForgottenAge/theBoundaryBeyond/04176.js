// 04176 特诺奇蒂特兰神庙
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在特诺奇蒂特兰神庙入场后：每位在本地点的调查员受到1点直接伤害。
// 卡面：你调查特诺奇蒂特兰神庙时，如果你的生命值少于或等于3，该地点隐藏值-2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 84 轮：古代地点的帷幕修正。

export default {
  code: '04176', scope: 'location',
  locationRule: {
    shroudModifier(state, location, inv) {
      return inv && (inv.maxHealth ?? 0) - (inv.damage || 0) <= 3 ? -2 : 0
    },
  },
}
