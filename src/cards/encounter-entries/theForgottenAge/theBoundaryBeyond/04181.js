// 04181 特诺奇蒂特兰运河
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在特诺奇蒂特兰运河入场后：在该卡牌上放置4资源。
// 卡面：特诺奇蒂特兰运河上每有一个资源，隐藏值+1。
// 卡面：强制 - 当一轮结束时：弃掉特诺奇蒂特兰运河的1资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04181', scope: 'location',
  locationRule: { shroudModifier(state, location) { return location.resources || 0 } },
}
