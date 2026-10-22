// 04185 圣林
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：你位于圣林时，你打出每张卡牌的费用提升2。
// 卡面：你调查圣林时，你每控制一张支援卡牌，圣林隐藏值-1。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04185', scope: 'location',
  locationRule: { shroudModifier(state, location, inv) { return -(inv?.assets?.length || 0) } },
}
