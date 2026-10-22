// 04182 霍奇米尔科湖
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在霍奇米尔科湖入场后：每位在本地点的调查员失去其所有剩余行动。
// 卡面：你调查霍奇米尔科湖时，你每剩余一个行动，该地点隐蔽值+2。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04182', scope: 'location',
  locationRule: { shroudModifier(state, location, inv) { return 2 * (inv?.actionsLeft || 0) } },
}
